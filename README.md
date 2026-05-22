# Sr. Tortinhas Control

**Sr. Tortinhas Control** é um app/PWA simples e direto para controle de vendas, caixa, financeiro, clientes, estoque, produção e relatórios de uma operação artesanal de tortinhas.

> Versão atual: **v9.8 — Relatório diário corrigido**

---

## Visão geral

O app foi pensado para uma rotina real de venda: rápida no caixa, clara no financeiro e simples para acompanhar clientes e produção.

A lógica principal é:

**Venda → Financeiro → Clientes → Estoque → Relatórios**

Ou seja: uma venda salva no caixa alimenta automaticamente as outras áreas do sistema.

---

## Funcionalidades principais

### Caixa / Venda

- Ticket com múltiplos produtos.
- Venda por cliente ou venda avulsa.
- Status **Pago** ou **Em aberto**.
- Formas de pagamento:
  - Pix
  - Débito
  - Crédito
  - Dinheiro
- Pix com:
  - nome escrito;
  - chave Pix;
  - botão para abrir QR Code.
- Dinheiro com cálculo automático de troco.
- Validação quando o valor recebido em dinheiro não cobre o total da venda.

---

### Financeiro

- Movimento do dia e do mês.
- Recebíveis: clientes com vendas em aberto.
- Pagamentos por forma:
  - Pix
  - Débito
  - Crédito
  - Dinheiro
- Detalhamento por cliente e por ticket.
- Controle de gastos.
- Relatórios mensais.

---

### Estoque

- Lançamento de produção por produto/sabor.
- Controle de quantidade produzida, vendida e disponível.
- Validade por lote.
- Estoque negativo permitido para não travar a operação.
- Histórico de produção.
- Produtos do caixa: criar, editar, ocultar ou excluir produtos.
- Ficha técnica para receitas, rendimento e custos.

---

### Clientes

- Cadastro e edição de clientes.
- Histórico por cliente.
- Tickets pagos, em aberto, parciais e cancelados.
- Status visual por cor:
  - **Branco**: sem pedidos no mês;
  - **Verde**: pedidos do mês pagos;
  - **Amarelo**: pedidos em aberto no mês;
  - **Vermelho**: pendência de mês anterior.

---

### Relatórios

- Relatório mensal.
- **Relatório diário em destaque**, funcionando como fechamento do dia.
- Relatório por cliente.
- Relatório por sabor/produto.
- Botões para copiar resumos.

Na versão atual, a hierarquia dos relatórios mensais é:

1. **Relatório diário**
2. **Por cliente**
3. **Por sabor/produto**

---

### Manual embutido

O app possui dicas rápidas com botões **?** nos principais pontos da interface, além de um manual enxuto dentro da área de **Backup, dados e manual**.

---

## Pix configurado

- **Nome:** TIAGO DUARTE SIERRA
- **Chave Pix:** 13 99621-4064

---

## Como usar localmente

Baixe ou clone este projeto e abra o arquivo:

```txt
index.html
```

O app é estático e pode rodar diretamente no navegador.

---

## Como subir na Vercel ou Netlify

Este projeto é um app estático. Para publicar:

1. Suba os arquivos para um repositório no GitHub.
2. Conecte o repositório na Vercel ou Netlify.
3. Configure como projeto estático.
4. Use a raiz do projeto como diretório de publicação.
5. Não é necessário build command.

Configuração típica:

```txt
Build command: vazio
Publish directory: .
```

---

## Estrutura dos arquivos

```txt
.
├── index.html
├── app.js
├── styles.css
├── data-seed.js
├── manifest.webmanifest
├── service-worker.js
├── logo.png
├── pix_qr_sr_tortinhas.png
├── README.md
├── CHANGELOG.md
└── VERSION.txt
```

---

## Dados e armazenamento

Atualmente, o app usa armazenamento local do navegador.

Isso significa que os dados ficam no dispositivo/navegador onde o app é usado.

Antes de limpar cache, trocar de celular ou reinstalar o app, use a opção de **exportar backup** dentro da área de dados.

---

## Rotina recomendada

### Antes de vender

1. Lance a produção no Estoque.
2. Confira os produtos disponíveis no Caixa.

### Durante a venda

1. Monte o ticket.
2. Escolha cliente ou venda avulsa.
3. Defina pagamento.
4. Salve a venda.

### Fim do dia

1. Confira o Financeiro.
2. Abra o Relatório diário.
3. Confira pagamentos por forma.
4. Veja se existem Recebíveis.
5. Confira estoque negativo ou produtos zerados.

---

## Convenção de versões

A versão atual do app deve ser mantida em três lugares:

1. `VERSION.txt`
2. `CHANGELOG.md`
3. Cabeçalho/identificação visual do app, quando aplicável

Formato recomendado:

```txt
vMAJOR.MINOR — Nome da atualização
```

Exemplo:

```txt
v9.8 — Relatório diário corrigido
```

---

## Status atual

**Release recomendada para GitHub/Deploy:** `v9.8 — Relatório diário corrigido`

Essa versão consolida:

- Pix com info escrita + botão QR;
- troco automático no dinheiro;
- relatórios detalhados;
- relatório diário como prioridade;
- dicas rápidas e manual embutido;
- clientes com cores por status;
- estoque com ajuda contextual;
- PWA pronto para deploy estático.

---

## Observação

Este app foi criado para uma operação artesanal e pessoal. A prioridade é ser simples, rápido e prático, evitando complexidade desnecessária.
