# Changelog — Sr. Tortinhas Control

## v10.8.6 — Chip avatar e status

### Melhorado
- Chip de conta compactado no cabeçalho.
- Removido nome da conta no topo.
- Status agora aparece por cor: verde, amarelo, vermelho e azul.


## v10.8.5 — Mobile first

### Melhorado
- Layout refinado com prioridade para mobile.
- Cabeçalho mais compacto e responsivo.
- Grid de venda otimizado para telas pequenas.
- Cards, espaçamentos e botões mais proporcionais para celular.


## v10.8.4 — Botões de venda apertados

### Melhorado
- Feedback visual de clique nos botões de venda.
- Efeito de botão pressionado ao tocar no sabor.
- Estado selecionado mais evidente quando o item já está no ticket.


## v10.8.3 — Cabeçalho alinhado

### Melhorado
- Cabeçalho com alinhamento mais limpo.
- Marca à esquerda e conta/sync à direita.
- Melhor comportamento responsivo no mobile.


## v10.8.2 — Corrige chip sync

### Corrigido
- Erro `cloudLastSaveStatus is not defined`.
- Chip de sincronização não quebra mais a renderização do cabeçalho.
- Mantida base anterior à v10.9.


## v10.8.1 — Botões venda no final

### Corrigido
- Botões Limpar/Salvar venda deixaram de ser flutuantes.
- Substituída classe antiga `checkout-actions` por `sale-final-actions` na tela de venda.
- CSS reforçado para impedir comportamento sticky antigo.


## v10.8 — Conta visível e venda ajustada

### Melhorado
- Conta Google/local mais visível no cabeçalho.
- Botões finais da venda não ficam mais flutuando sobre o conteúdo.
- Feedback visual de botão pressionado/selecionado nos sabores.


## v10.7 — Chip com cores de sync

### Melhorado
- Chip de conta/sync com cores mais claras por estado.
- Verde para nuvem.
- Amarelo para local.
- Azul para salvando.
- Vermelho para erro.


## v10.6 — Chip de Conta e Sync

### Adicionado
- Chip visual de conta/sincronização no cabeçalho.
- Exibe nome e foto da conta Google quando conectado.
- Exibe estado Local/Nuvem/Salvando.
- Toque no chip abre a área de sincronização.


## v10.5 — Sync Turbo

### Melhorado
- Sincronização em tempo real mais rápida.
- Salvamento na nuvem com debounce menor.
- Listener Firestore com metadados.
- Persistência offline.
- Merge local + nuvem por coleção.
- BroadcastChannel para abas locais.
- Status de sync mais claro.


## v10.4 — Firebase Key Final

### Corrigido
- `apiKey` do Firebase atualizada com o valor exato do Firebase Console.
- Correção do erro `auth/api-key-not-valid`.


## v10.3 — Firebase API Key Corrigida

### Corrigido
- Chave `apiKey` do Firebase corrigida.
- Erro esperado corrigido: `auth/api-key-not-valid`.
- Favicon configurado com `logo.png`.


## v10.2 — Firebase Config Preenchido

### Ajustado
- `firebase-config.js` preenchido.
- Login obrigatório com Google mantido.
- Gate de configuração deve avançar para tela de login quando publicado na Vercel.


## v10.1 — Login Gate Corrigido

### Corrigido
- Gate de login agora bloqueia o app quando Firebase não está configurado ou usuário não está logado.
- Adicionada tela de Firebase não configurado.
- Atualizado cache/service worker para evitar abrir versão anterior.


## v10.0 — Google Login Obrigatório

### Adicionado / alterado
- Tela inicial de login obrigatório com Google.
- Bloqueio das abas principais até autenticação.
- Navegação inferior ocultada durante o login.
- Fallback de login por redirect quando popup falhar.
- Logout retorna para tela de entrada.

### Importante
- Adicionar domínio da Vercel nos domínios autorizados do Firebase Authentication.


## v9.9 — Firebase Google Sync

### Adicionado
- Login com Google via Firebase Authentication.
- Sincronização em tempo real usando Cloud Firestore.
- Cartão de controle de sincronização dentro de Backup, dados e manual.
- Arquivos `firebase-config.js` e `firebase-config.example.js`.
- Botões para enviar dados locais e baixar dados da nuvem.

### Observação
- O app continua funcionando localmente mesmo sem Firebase configurado.
- Para ativar o sync, é necessário preencher `firebase-config.js` e configurar Authentication/Firestore no Firebase Console.



## v9.8 — Relatório diário corrigido

### Ajustes principais

- Corrigida a hierarquia dos relatórios mensais.
- Relatório diário agora aparece primeiro e com destaque.
- Ordem dos relatórios:
  1. Relatório diário
  2. Por cliente
  3. Por sabor/produto
- Mantidas dicas rápidas na aba Estoque.
- Mantido manual embutido na área de dados.
- Mantido Pix com nome, chave e botão para QR Code.
- Mantido cálculo automático de troco em dinheiro.
- Mantidos pagamentos detalhados por forma, cliente e ticket.
- Mantidas cores dos clientes por status.

---

## Histórico resumido

### v9.7 — Estoque com ajuda + relatório diário

- Reforçadas dicas rápidas na aba Estoque.
- Adicionadas ajudas contextuais em produção, produtos do caixa, ficha técnica e histórico.
- Tentativa inicial de priorização do relatório diário.

### v9.6 — Manual embutido

- Adicionados botões de ajuda `?` em pontos importantes do app.
- Adicionado manual enxuto dentro da área de dados.

### v9.5 — Release Final

- Versão consolidada com Pix, QR Code, dinheiro com troco, relatórios, clientes, financeiro e estoque.

### v9.4 — Pix com info escrita + botão QR

- Nome e chave Pix exibidos diretamente no caixa.
- QR Code exibido por botão.

### v9.3 — Pix com botão

- QR Code Pix passou a abrir somente via botão.

### v9.2 — QR maior sem corte

- QR Code substituído e ajustado para aparecer maior, proporcional e sem cortes.

### v9.1 — Pix corrigido + troco

- Corrigido erro `PIX_INFO is not defined`.
- Mantido Pix e troco em dinheiro.

---

## Regra para próximas atualizações

Sempre que uma nova versão for gerada, atualizar:

- `README.md`
- `CHANGELOG.md`
- `VERSION.txt`
- identificação da versão dentro do app, quando aplicável
