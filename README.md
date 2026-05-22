# Cruzamento Dominio x SAT/DFE

Projeto para rodar no Google Colab e comparar:

- relatorio de Entradas do sistema Dominio (`.pdf`, `.xls` ou `.xlsx`);
- planilha DFE/SAT SC de NF-es (`.xlsx`).

O notebook pede os dois arquivos separadamente e gera um **PDF interativo** chamado `relatorio_dominio_x_dfe.pdf`.

## O que o PDF entrega

- primeira pagina em estilo dashboard com empresa em destaque, periodo das Entradas, periodo da DFE, quantidade de notas faltantes, soma do valor faltante, canceladas SAT/DFE e notas marcadas como Entrada;
- resumo da conferencia;
- sumario clicavel e marcadores do PDF;
- criterios usados no cruzamento;
- campo interativo com todas as chaves faltantes para selecionar e copiar;
- tabela de NF-es da DFE que faltam nas Entradas;
- secao propria para notas canceladas no SAT/DFE;
- secao propria para notas marcadas como `E`/Entrada na DFE/SAT;
- tabela de diferencas de valor ou fornecedor para conferir;
- base DFE com status;
- base de Entradas normalizada;
- linhas da DFE ignoradas por nao terem chave valida;

O projeto nao envia nem versiona arquivos de clientes. O GitHub deve conter somente o notebook, README e arquivos de codigo/configuracao.

## Como usar

1. Abra o arquivo `cruzamento_dominio_dfe_colab.ipynb` no Google Colab.
2. Execute as celulas em ordem.
3. Quando aparecer o primeiro upload, envie o arquivo de Entradas do Dominio (`.pdf`, `.xls` ou `.xlsx`).
4. Quando aparecer o segundo upload, envie a planilha DFE/SAT (`.xlsx`).
5. O Colab vai gerar e baixar automaticamente `relatorio_dominio_x_dfe.pdf`.

Se o `.xls` antigo do Dominio nao for lido diretamente pelo Python, o notebook instala/usa o LibreOffice no proprio Colab para converter uma copia temporaria para `.xlsx` e continua a conferencia.

Se o relatorio de Entradas vier em PDF, o notebook extrai as linhas do relatorio "Acompanhamento de Entradas" e usa numero da nota, serie, valor contabil e fornecedor para o cruzamento.

## Regra de conferencia

- Primeiro cruza por `NumeroDocumento + SerieDocumento`.
- Quando houver risco de notas com mesmo numero e serie de empresas diferentes, compara tambem a semelhanca entre `NomeEmitente` da DFE e `Fornecedor` das Entradas do Dominio.
- Se numero, serie, valor e fornecedor conferem: `OK`.
- Se nao existe combinacao correspondente nas Entradas: `FALTANDO NAS ENTRADAS`.
- Se existe, mas valor ou fornecedor divergem: o PDF mostra a nota nas pendencias para conferencia.

Linhas sem `ChaveAcesso` valida de 44 digitos sao tratadas como totais/rodapes da DFE e nao entram como notas faltantes.
