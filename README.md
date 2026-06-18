# Comparar DFE x Dominio

Aplicacao web interna, sem login, para comparar relatorios de Entradas ou Saidas do sistema Dominio com a planilha DFE/SAT SC.

## Recursos da interface

- identidade visual institucional Asseconsul+;
- painel com indicadores e todos os documentos da conferencia;
- filtros para faltantes, diferencas, canceladas e notas OK;
- busca por nota, chave, parte ou status;
- campo para copiar todas as chaves faltantes válidas;
- impressao do painel diretamente pelo navegador;
- download do relatorio completo em PDF;
- layout responsivo para computador, tablet e celular.
- arquivos temporarios removidos imediatamente apos o processamento;
- PDF mantido somente em memoria ate o download ou fechamento da pagina.

## Stack

- TypeScript + Fastify no servidor web;
- TypeScript e CSS responsivo na interface;
- Python apenas no motor de leitura fiscal (PDF, Excel e geracao do relatorio);
- Docker pronto para deploy pelo EasyPanel.

## Deploy no EasyPanel

1. Crie um novo servico usando este repositorio.
2. Selecione build por `Dockerfile`.
3. Configure a porta do servico como `8000`.
4. Nao e necessario banco de dados nem variaveis de ambiente.

O endpoint de health check e `/health`.

## Desenvolvimento local

```bash
npm install
python -m pip install -r requirements.txt
npm run build
npm start
```

Acesse `http://localhost:8000`.

---

## Notebook legado

Projeto para rodar no Google Colab e comparar:

- relatorio de Entradas ou Saidas do sistema Dominio (`.pdf`, `.xls` ou `.xlsx`);
- planilha DFE/SAT SC de NF-es (`.xlsx`).

O notebook detecta automaticamente se o relatorio do Dominio e de Entradas ou Saidas e gera um **PDF interativo** especifico para o movimento.

## O que o PDF entrega

- primeira pagina em estilo dashboard com empresa em destaque, periodo do Dominio, periodo da DFE, quantidade de notas faltantes, soma do valor faltante, canceladas SAT/DFE e notas OK;
- resumo da conferencia;
- sumario clicavel e marcadores do PDF;
- criterios usados no cruzamento;
- campo interativo com todas as chaves faltantes para selecionar e copiar;
- tabela de NF-es da DFE que faltam nas Entradas ou Saidas;
- secao propria para notas canceladas no SAT/DFE;
- secao propria para notas marcadas como `E`/Entrada na DFE/SAT;
- tabela de diferencas de valor ou fornecedor para conferir;
- base DFE com status;
- base do movimento do Dominio normalizada;
- linhas da DFE ignoradas por nao terem chave valida;

O projeto nao envia nem versiona arquivos de clientes. O GitHub deve conter somente o notebook, README e arquivos de codigo/configuracao.

## Como usar

1. Abra o arquivo `cruzamento_dominio_dfe_colab.ipynb` no Google Colab.
2. Execute as celulas em ordem.
3. Quando aparecer o primeiro upload, envie o arquivo de Entradas ou Saidas do Dominio (`.pdf`, `.xls` ou `.xlsx`).
4. Quando aparecer o segundo upload, envie a planilha DFE/SAT (`.xlsx`).
5. O Colab vai gerar e baixar automaticamente `relatorio_dominio_x_dfe.pdf`.

Se o `.xls` antigo do Dominio nao for lido diretamente pelo Python, o notebook instala/usa o LibreOffice no proprio Colab para converter uma copia temporaria para `.xlsx` e continua a conferencia.

Se o relatorio vier em PDF, o notebook reconhece "Acompanhamento de Entradas" ou "Acompanhamento de Saidas". Para Entradas, compara emitente/fornecedor; para Saidas, compara destinatario/cliente.

## Regra de conferencia

- Primeiro cruza por `NumeroDocumento + SerieDocumento`.
- Em Entradas, compara `NomeEmitente` da DFE com o fornecedor do Dominio.
- Em Saidas, filtra os documentos marcados como `S` na DFE e compara `NomeDestinatario` com o cliente do Dominio.
- Se numero, serie, valor e parte conferem: `OK`.
- Se nao existe combinacao correspondente: `FALTANDO NAS ENTRADAS` ou `FALTANDO NAS SAIDAS`.
- Se existe, mas valor ou nome divergem: o PDF mostra a nota nas pendencias para conferencia.

Linhas sem `ChaveAcesso` valida de 44 digitos sao tratadas como totais/rodapes da DFE e nao entram como notas faltantes.
