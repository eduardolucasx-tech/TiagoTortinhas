# Sr. Tortinhas Control

**Sr. Tortinhas Control** é um app/PWA mobile first para controle de vendas, caixa, financeiro, clientes, estoque, produção e relatórios de uma operação artesanal de tortinhas.

> Versão atual: **v1.0.1 — Release Mobile Polish**

---

## Resumo

A lógica principal do app é:

**Venda → Financeiro → Clientes → Estoque → Relatórios**

A venda alimenta o restante do sistema. O app foi pensado para uso rápido no celular, com sincronização Google/Firebase e backup local.

---

## Principais áreas

### Venda
- Ticket com múltiplos sabores/produtos.
- Venda por cliente ou venda avulsa.
- Pago ou Em aberto.
- Pix, Débito, Crédito e Dinheiro.
- Dinheiro com cálculo de troco.
- Botões de sabor com feedback visual de toque/seleção.

### Financeiro
- Movimento do dia e do mês.
- Recebíveis.
- Pagamentos por forma.
- Gastos.
- Relatório diário, por cliente e por sabor/produto.

### Estoque
- Produção por produto.
- Saldo disponível.
- Histórico de produção.
- Produtos do caixa.
- Ficha técnica.

### Clientes
- Cadastro e edição.
- Histórico de tickets.
- Status visual por cor:
  - branco: sem pedidos no mês;
  - verde: tudo pago;
  - amarelo: aberto no mês;
  - vermelho: pendência anterior.

### Dados do app
- Manual rápido.
- Checklist de uso.
- Backup/exportação.
- Importação.
- Restauração de base.

---

## Sincronização

O app usa Firebase/Google Sync quando configurado.

O chip no cabeçalho mostra o diagnóstico:

- verde: nuvem ok;
- amarelo: local / atenção;
- azul: salvando ou conectando;
- vermelho: erro.

---

## Deploy

Projeto estático. Pode ser publicado na Vercel/Netlify.

Configuração simples:

```txt
Build Command: vazio
Output Directory: .
```

Se usar a versão com variáveis de ambiente do Firebase, usar a linha segura específica de build.

---

## Rotina recomendada

1. Produziu? Lance no Estoque.
2. Vendeu? Registre em Venda.
3. Cliente ficou devendo? Marque Em aberto.
4. Recebeu depois? Baixe em Recebíveis/Clientes.
5. Gastou? Lance em Gastos.
6. Fim do dia? Confira Financeiro e Relatório diário.

---

## Histórico de versão

Esta `v1.0.1` é a primeira versão pública polida depois das versões internas de desenvolvimento.
