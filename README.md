# Cruzamento Domínio x SAT/DFE

Projeto para rodar no Google Colab e comparar:

- relatório de Entradas do sistema Domínio (`.pdf`, `.xls` ou `.xlsx`);
- planilha DFE/SAT SC de NF-es.

O notebook pede os dois arquivos separadamente, cruza as notas por `numero da nota + serie` e confere o valor. No final, gera uma planilha Excel com:

- uma aba inicial `Leia_me`, explicando para que serve cada aba do relatorio;
- resumo da conferência;
- pendências;
- NF-es da DFE que faltam nas Entradas;
- NF-es com diferença de valor;
- linhas da DFE ignoradas por não terem chave válida;
- base DFE com status;
- base de Entradas normalizada.

## Como usar

1. Abra o arquivo `cruzamento_dominio_dfe_colab.ipynb` no Google Colab.
2. Execute as células em ordem.
3. Quando aparecer o primeiro upload, envie o arquivo de Entradas do Domínio (`.pdf`, `.xls` ou `.xlsx`).
4. Quando aparecer o segundo upload, envie a planilha DFE/SAT (`.xlsx`).
5. O Colab vai gerar e baixar automaticamente `relatorio_dominio_x_dfe.xlsx`.

Se o `.xls` antigo do Domínio não for lido diretamente pelo Python, o notebook instala/usa o LibreOffice no próprio Colab para converter uma cópia temporária para `.xlsx` e continua a conferência.

Se o relatório de Entradas vier em PDF, o notebook extrai as linhas do relatório "Acompanhamento de Entradas" e usa número da nota, série e valor contábil para o cruzamento.

## Regra de conferência

- Se a DFE tem `NumeroDocumento + SerieDocumento` e essa combinação não existe nas Entradas: `FALTANDO NAS ENTRADAS`.
- Se a nota existe nas Entradas, mas o valor da DFE difere do valor contábil do Domínio: `DIFERENCA DE VALOR`.
- Se número, série e valor batem: `OK`.

O relatório de faltantes inclui a coluna `ChaveAcesso`, para baixar/importar as notas que faltam.

Linhas sem `ChaveAcesso` válida de 44 dígitos são tratadas como totais/rodapés da DFE e não entram como notas faltantes. Quando existirem, aparecem na aba `DFE_ignoradas_sem_chave`.
