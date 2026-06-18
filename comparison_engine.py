import html
import json
import contextlib
import io
import re
import shutil
import subprocess
import unicodedata
from datetime import datetime
from difflib import SequenceMatcher
from pathlib import Path

import numpy as np
import pandas as pd
from pypdf import PdfReader
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import (
    Flowable,
    HRFlowable,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


def _load_notebook_engine():
    notebook = Path(__file__).with_name("cruzamento_dominio_dfe_colab.ipynb")
    data = json.loads(notebook.read_text(encoding="utf-8"))
    namespace = globals()
    for index in (2, 3):
        source = "".join(data["cells"][index]["source"])
        exec(compile(source, f"notebook_cell_{index}", "exec"), namespace)


_load_notebook_engine()


def carregar_entradas_pdf(caminho):
    texto = "\n".join(page.extract_text() or "" for page in PdfReader(caminho).pages)
    metadados = {
        "empresa": extrair_empresa_pdf_robusto(texto),
        "periodo_entradas": extrair_periodo_texto(texto),
        "periodo_dominio": extrair_periodo_texto(texto),
        "tipo_movimento": "entrada",
    }
    registros = []

    for numero_linha, linha in enumerate(texto.splitlines(), start=1):
        linha = " ".join(str(linha).split())
        if not re.search(r"\d{2}/\d{2}/\d{4}", linha):
            continue

        # Layout normal do relatório: Data, Nota, Série, Espécie ... Valor no fim.
        normal = re.search(
            r"^(?P<antes>.*?)(?P<data>\d{2}/\d{2}/\d{4})\s+"
            r"(?P<nota>\d+)\s+(?P<serie>\d+)\s+(?P<especie>\d+)\s+"
            r"(?P<resto>.*?)(?P<valor>[\d.]+,\d{2})$",
            linha,
        )

        fornecedor = ""
        if normal:
            data = normal.group("data")
            nota = normal.group("nota")
            serie = normal.group("serie")
            especie = normal.group("especie")
            valor = normal.group("valor")
            detalhe = normal.group("resto")
            fornecedor_match = re.search(
                r"(?:0,00\s*){3}(?P<fornecedor>.+?)\s*"
                r"(?P<uf>[A-Z]{2})(?P<ac>\d{2})(?P<cfop>\d-\d{3})\s*$",
                detalhe,
            )
            if fornecedor_match:
                fornecedor = fornecedor_match.group("fornecedor").strip()
        else:
            # Layout retornado pelo pypdf em alguns relatórios do Domínio:
            # valores tributários antes da data e fornecedor/CFOP após a espécie.
            invertido = re.search(
                r"(?P<data>\d{2}/\d{2}/\d{4})\s+"
                r"(?P<nota>\d+)\s+(?P<serie>\d+)\s+(?P<especie>\d+)\s+"
                r"(?P<detalhe>.+?)\s+(?P<valor>[\d.]+,\d{2})\s+ICMS\s*$",
                linha,
                flags=re.IGNORECASE,
            )
            if not invertido:
                continue
            data = invertido.group("data")
            nota = invertido.group("nota")
            serie = invertido.group("serie")
            especie = invertido.group("especie")
            valor = invertido.group("valor")
            detalhe = invertido.group("detalhe")
            fornecedor_match = re.search(
                r"(?:-?[\d.]+,\d{2}\s*){3}"
                r"(?P<fornecedor>.+?)(?P<uf>[A-Z]{2})"
                r"(?P<ac>\d{3})(?P<cfop>\d-\d{3})\s*$",
                detalhe,
            )
            if fornecedor_match:
                fornecedor = fornecedor_match.group("fornecedor").strip()

        registros.append(
            {
                "linha_pdf": numero_linha,
                "data": data,
                "nota": nota,
                "serie": serie,
                "especie": especie,
                "fornecedor": fornecedor,
                "valor_contabil": valor,
                "linha_original_pdf": linha,
            }
        )

    if not registros:
        raise ValueError(
            "Nao encontrei linhas de entradas no PDF. Confira se o PDF e o "
            "relatorio Acompanhamento de Entradas do Dominio."
        )

    original = pd.DataFrame(registros)
    original["numero_normalizado"] = original["nota"].map(normalizar_numero_nf)
    original["serie_normalizada"] = original["serie"].map(normalizar_serie)
    original["valor_normalizado"] = original["valor_contabil"].map(normalizar_valor)
    original["data_normalizada"] = pd.to_datetime(
        original["data"], errors="coerce", format="%d/%m/%Y"
    )

    # O Domínio pode imprimir uma nota em várias linhas (uma por tributação/CFOP).
    # O valor contábil da nota é a soma dessas linhas.
    agrupado = (
        original.groupby(
            ["numero_normalizado", "serie_normalizada", "data_normalizada"],
            dropna=False,
            as_index=False,
        )
        .agg(
            dominio_valor=("valor_normalizado", "sum"),
            dominio_fornecedor=(
                "fornecedor",
                lambda values: next((v for v in values if str(v).strip()), ""),
            ),
            dominio_linha_pdf=("linha_pdf", "min"),
        )
    )
    movimento = pd.DataFrame(
        {
            "dominio_numero": agrupado["numero_normalizado"],
            "dominio_serie": agrupado["serie_normalizada"],
            "dominio_valor": agrupado["dominio_valor"].round(2),
            "dominio_fornecedor": agrupado["dominio_fornecedor"],
            "dominio_data": agrupado["data_normalizada"],
            "dominio_aba_origem": "PDF - Entradas",
            "dominio_linha_pdf": agrupado["dominio_linha_pdf"],
        }
    )
    movimento = movimento[
        (movimento["dominio_numero"] != "") & (movimento["dominio_serie"] != "")
    ].copy()
    movimento.attrs.update(metadados)
    original.attrs.update(metadados)
    return movimento, original


def _money(value):
    return f"R$ {float(value):,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")


def _date(value):
    parsed = pd.to_datetime(value, errors="coerce")
    return "" if pd.isna(parsed) else parsed.strftime("%d/%m/%Y")


def _text(value):
    return "" if pd.isna(value) else str(value)


def compare_files(dominio_path: Path, dfe_path: Path, output_path: Path) -> dict:
    with contextlib.redirect_stdout(io.StringIO()):
        movimento, _ = carregar_movimento_dominio(str(dominio_path), "auto")
        dfe, ignoradas = carregar_dfe(str(dfe_path))
        resultado = cruzar_movimento(dfe, movimento)
        salvar_relatorio_movimento(resultado, movimento, ignoradas, str(output_path))

    tipo = movimento.attrs.get("tipo_movimento", "entrada")
    plural = "Saídas" if tipo == "saida" else "Entradas"
    status_faltante = "FALTANDO NAS SAIDAS" if tipo == "saida" else "FALTANDO NAS ENTRADAS"
    faltantes = resultado["StatusConferencia"].eq(status_faltante)
    canceladas = (
        resultado["_dfe_cancelada"].fillna(False)
        if "_dfe_cancelada" in resultado.columns
        else pd.Series(False, index=resultado.index)
    )
    diferencas = resultado["StatusConferencia"].str.startswith(
        ("DIFERENCA", "CONFERIR"), na=False
    )
    validas = faltantes & ~canceladas
    col_chave = achar_coluna(resultado, ["ChaveAcesso", "chave acesso"], obrigatoria=False)
    col_data = achar_coluna(resultado, ["DataEmissao", "data emissao"], obrigatoria=False)
    col_situacao = achar_coluna(resultado, ["Situacao"], obrigatoria=False)
    col_tipo = achar_coluna(
        resultado,
        ["TipoDeOperacaoEntradaOuSaida", "tipo operacao entrada saida"],
        obrigatoria=False,
    )
    col_parte = achar_coluna(
        resultado,
        ["NomeDestinatario", "nome destinatario"]
        if tipo == "saida"
        else ["NomeEmitente", "nome emitente"],
        obrigatoria=False,
    )
    documents = []
    for index, row in resultado.iterrows():
        documents.append(
            {
                "id": index + 1,
                "status": _text(row.get("StatusConferencia")),
                "chave": _text(row.get(col_chave)) if col_chave else _text(row.get("_dfe_chave")),
                "numero": _text(row.get("_dfe_numero")),
                "serie": _text(row.get("_dfe_serie")),
                "emissao": _date(row.get(col_data)) if col_data else "",
                "valor_dfe": _money(row.get("_dfe_valor", 0)),
                "valor_dominio": (
                    _money(row.get("ValorDominio"))
                    if pd.notna(row.get("ValorDominio"))
                    else "-"
                ),
                "diferenca": (
                    _money(row.get("DiferencaDfeMenosDominio"))
                    if pd.notna(row.get("DiferencaDfeMenosDominio"))
                    else "-"
                ),
                "similaridade": (
                    f"{float(row.get('SimilaridadeFornecedor')) * 100:.0f}%"
                    if pd.notna(row.get("SimilaridadeFornecedor"))
                    else "-"
                ),
                "situacao": _text(row.get(col_situacao)) if col_situacao else "",
                "operacao": _text(row.get(col_tipo)) if col_tipo else "",
                "parte_dfe": _text(row.get(col_parte)) if col_parte else "",
                "parte_dominio": _text(row.get("FornecedorDominio")),
                "cancelada": bool(row.get("_dfe_cancelada", False)),
            }
        )

    return {
        "tipo": tipo,
        "movimento": plural,
        "empresa": movimento.attrs.get("empresa") or "Empresa não identificada",
        "periodo_dominio": movimento.attrs.get("periodo_dominio")
        or movimento.attrs.get("periodo_entradas")
        or "Não identificado",
        "periodo_dfe": resultado.attrs.get("periodo_dfe") or "Não identificado",
        "total_dfe": int(len(resultado)),
        "total_dominio": int(len(movimento)),
        "ok": int(resultado["StatusConferencia"].eq("OK").sum()),
        "faltantes": int(faltantes.sum()),
        "canceladas": int(canceladas.sum()),
        "diferencas": int(diferencas.sum()),
        "chaves_para_baixar": int(validas.sum()),
        "valor_faltante": _money(resultado.loc[faltantes, "_dfe_valor"].sum()),
        "valor_para_baixar": _money(resultado.loc[validas, "_dfe_valor"].sum()),
        "chaves_faltantes": [
            _text(value)
            for value in resultado.loc[validas, "_dfe_chave"].dropna().tolist()
            if _text(value).strip()
        ],
        "conformidade": round(
            100 * resultado["StatusConferencia"].eq("OK").sum() / max(len(resultado), 1),
            1,
        ),
        "gerado_em": datetime.now().strftime("%d/%m/%Y %H:%M"),
        "documents": documents,
    }
