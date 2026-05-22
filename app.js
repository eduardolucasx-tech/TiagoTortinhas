const STORE_KEY = 'sr_tortinhas_control_v10_8_2_corrige_chip_sync';
const PIX_INFO = { nome: 'TIAGO DUARTE SIERRA', chave: '13 99621-4064', qrImage: 'pix_qr_sr_tortinhas.png' };
const PRODUCTS = { 'Maracujá': 7, 'Limão': 7, 'Chocolate': 9 };
const PRODUCT_LABELS = { 'Maracujá': 'Maracujá', 'Limão': 'Limão', 'Chocolate': 'Chocolate' };
const PRODUCT_CLASSES = { 'Maracujá': 'maracuja', 'Limão': 'limao', 'Chocolate': 'chocolate' };
const NAV = [
  ['venda', '🧾', 'Venda'],
  ['financeiro', '📊', 'Financeiro'],
  ['estoque', '🥧', 'Estoque'],
  ['clientes', '👤', 'Clientes']
];

let route = 'venda';
let saleDraft = { produto:'Maracujá', quantidade:1, status:'pago', forma:'Pix', cliente:'', data:today(), itens:[], editingTicketId:'', avulsa:false, valorRecebido:'' };
let state = load();
let clientFormOpen = false;
let clientDraft = emptyClientDraft();
let returnToSaleAfterClient = false;
let lotFormOpen = false;
let lotDraft = emptyLotDraft();
let recipeDraft = emptyRecipeDraft();
let recipeFormOpen = false;
let expenseDraft = emptyExpenseDraft();
let accountDraft = emptyAccountDraft();
let productDraft = emptyProductDraft();
let productFormOpen = false;

let cloudUser = null;
let authChecked = false;
let cloudReady = false;
let cloudEnabled = false;
let cloudUnsubscribe = null;
let cloudSaveTimer = null;
let applyingRemoteState = false;
let cloudPendingWrites = false;
let cloudLastSaveStatus = '';
let lastCloudUpdatedAt = 0;
let lastCloudUpdatedBy = '';
const CLOUD_DEVICE_ID = localStorage.getItem('sr_tortinhas_device_id') || (() => {
  const id = uid('device');
  localStorage.setItem('sr_tortinhas_device_id', id);
  return id;
})();
const CLOUD_DOC_COLLECTION = 'sr_tortinhas_users';
const CLOUD_DOC_NAME = 'app_state';


function emptyClientDraft(){ return { id:'', nome:'', telefone:'' }; }
function emptyLotDraft(){ return { id:'', produto:'Maracujá', quantidade:10, data:today(), validade:addDays(today(),3) }; }
function emptyRecipeDraft(){ return { id:'', nome:'', rendimento:6, precoVenda:0, observacoes:'', ingredientes:[{item:'', custoReceita:0}] }; }
function emptyExpenseDraft(){ return { id:'', data:today(), valor:'', categoria:'Ingredientes', descricao:'' }; }
function emptyAccountDraft(){ return { id:'', data:today(), tipo:'entrada', forma:'Pix', valor:'', descricao:'' }; }
function emptyProductDraft(){ return { id:'', nome:'', preco:7, ativo:true, fichaId:'', mostrarNaVenda:true }; }
function today(){ return new Date().toISOString().slice(0,10); }
function addDays(s,n){ const d = new Date((s||today())+'T12:00:00'); d.setDate(d.getDate()+n); return d.toISOString().slice(0,10); }
function brl(v){ return (Number(v)||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}); }
function dateBR(s){ return s ? new Date(s+'T12:00:00').toLocaleDateString('pt-BR') : ''; }
function slug(s){ return String(s||'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'') || 'sem-nome'; }
function uid(prefix){ return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2,7)}`; }
function moneyInput(v){ return Math.round((Number(v)||0)*100)/100; }
function escapeHtml(s){ return String(s||'').replace(/[&<>'"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[m])); }
function isCanceled(v){ return v.statusPagamento === 'cancelado'; }
function activeSales(list){ return (list || state.vendas).filter(v => !isCanceled(v)); }


function defaultProducts(){
  return Object.entries(PRODUCTS).map(([nome,preco]) => ({ id:slug(nome), nome, preco:Number(preco)||0, ativo:true, fichaId:'', mostrarNaVenda:true }));
}
function syncProductRegistry(source){
  const s = source || state || {};
  const produtos = s.produtos && s.produtos.length ? s.produtos : defaultProducts();
  Object.keys(PRODUCTS).forEach(k => delete PRODUCTS[k]);
  Object.keys(PRODUCT_LABELS).forEach(k => delete PRODUCT_LABELS[k]);
  Object.keys(PRODUCT_CLASSES).forEach(k => delete PRODUCT_CLASSES[k]);
  produtos.forEach(p => {
    PRODUCTS[p.nome] = Number(p.preco)||0;
    PRODUCT_LABELS[p.nome] = p.nome;
    PRODUCT_CLASSES[p.nome] = ['Maracujá','Limão','Chocolate'].includes(p.nome) ? ({'Maracujá':'maracuja','Limão':'limao','Chocolate':'chocolate'}[p.nome]) : 'custom-product';
  });
}
function allProducts(){ return (state?.produtos?.length ? state.produtos : defaultProducts()).slice().sort((a,b)=>a.nome.localeCompare(b.nome,'pt-BR')); }
function activeProducts(){ return allProducts().filter(p=>p.ativo !== false); }
function productPrice(nome){ return Number(PRODUCTS[nome]) || Number((state?.produtos||[]).find(p=>p.nome===nome)?.preco) || 0; }
function productClass(nome){ return PRODUCT_CLASSES[nome] || 'custom-product'; }
function productOptions(selected=''){
  return activeProducts().map(p=>`<option value="${escapeHtml(p.nome)}" ${selected===p.nome?'selected':''}>${escapeHtml(p.nome)}</option>`).join('');
}

function normalize(s){
  s = s || {};
  const produtoMap = new Map(defaultProducts().map(p=>[slug(p.nome), p]));
  (s.produtos || []).forEach(p => produtoMap.set(slug(p.nome), { id:p.id||slug(p.nome), nome:p.nome||'Produto', preco:Number(p.preco)||0, ativo:p.ativo!==false, fichaId:p.fichaId||'', mostrarNaVenda:p.mostrarNaVenda!==false }));
  s.produtos = [...produtoMap.values()];
  syncProductRegistry(s);
  s.vendas = (s.vendas || []).map(v => {
    let produto = v.produto || 'Limão';
    if (String(produto).toLowerCase() === 'tortinha') produto = (+v.valorUnitario === 9 ? 'Chocolate' : 'Limão');
    const status = v.statusPagamento === 'em_aberto' ? 'em_aberto' : (v.statusPagamento === 'cancelado' ? 'cancelado' : 'pago');
    const qtd = Number(v.quantidade) || 1;
    const unit = productPrice(produto) || Number(v.valorUnitario) || 7;
    return {
      ...v,
      id: v.id || uid('venda'),
      ticketId: v.ticketId || `ticket_${v.id || uid('legacy')}`,
      data: v.data || today(),
      cliente: v.cliente || 'Cliente sem nome',
      produto,
      quantidade: qtd,
      valorUnitario: unit,
      valorTotal: moneyInput(qtd * unit),
      valorPago: status === 'pago' ? moneyInput(qtd * unit) : Math.min(Number(v.valorPago)||0, moneyInput(qtd * unit)),
      statusPagamento: status,
      formaPagamento: status === 'pago' ? (v.formaPagamento && v.formaPagamento !== 'Não informado' ? v.formaPagamento : 'Pix') : '',
      vencimento: v.vencimento || v.data || today(),
      observacoes: v.observacoes || ''
    };
  });
  s.clientes = (s.clientes || []).map(c => ({
    id: c.id || `cliente_${slug(c.nome)}`,
    nome: c.nome || '',
    telefone: c.telefone || '',
    observacoes: c.observacoes || ''
  }));
  const bySlug = new Map(s.clientes.map(c => [slug(c.nome), c]));
  s.vendas.forEach(v => {
    const key = slug(v.cliente);
    if (!bySlug.has(key)) {
      const c = { id:`cliente_${key}`, nome:v.cliente, telefone:'', observacoes:'' };
      s.clientes.push(c);
      bySlug.set(key, c);
    }
  });
  s.producao = (s.producao || []).map(l => ({ id:l.id||uid('lote'), data:l.data||l.fabricacao||today(), produto:l.produto||l.sabor||'Maracujá', quantidade:Number(l.quantidade)||0, validade:l.validade||addDays(l.data||today(),3), observacoes:l.observacoes||'' }));
  s.gastos = (s.gastos || []).map(g => ({ ...g, id:g.id||uid('gasto'), data:g.data||today(), valor:Number(g.valor)||0, categoria:g.categoria||'Outros', descricao:g.descricao||g.descrição||'Gasto' }));
  s.contas = (s.contas || []).map(m => ({ ...m, id:m.id||uid('mov'), data:m.data||today(), tipo:m.tipo||'entrada', forma:m.forma||'Pix', descricao:m.descricao||'Movimentação', valor:Number(m.valor)||0 }));
  s.receitasProdutos = (s.receitasProdutos || []).map(r => ({ ...r, id:r.id||slug(r.nome), nome:r.nome||'Receita', rendimento:Number(r.rendimento)||0, custoUnidade:Number(r.custoUnidade)||0, precoVenda:Number(r.precoVenda)||0, lucroUnidade:Number(r.lucroUnidade)||0, observacoes:r.observacoes||'', ingredientes:(r.ingredientes||[]).map(i=>({item:i.item||'', custoReceita:Number(i.custoReceita)||0})) }));
  return s;
}
function load(){
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return normalize(JSON.parse(raw));
  } catch(e){}
  return normalize(structuredClone(window.SEED_DATA || {}));
}
function save(){
  localStorage.setItem(STORE_KEY, JSON.stringify(state));
  scheduleCloudSave();
}
function toast(msg){ const t=document.getElementById('toast'); t.textContent=msg; t.classList.add('show'); clearTimeout(window.__toast); window.__toast=setTimeout(()=>t.classList.remove('show'),1800); }
function setHeader(txt){ document.getElementById('headerHint').textContent = txt; }
function setRoute(r){ route = r; 
window.loginGoogle = loginGoogle;
window.logoutGoogle = logoutGoogle;
window.forceCloudUpload = forceCloudUpload;
window.forceCloudDownload = forceCloudDownload;

initFirebaseSync();
render(); }
function renderNav(){ document.getElementById('nav').innerHTML = NAV.map(([id,ico,label]) => `<button class="${route===id?'active':''}" onclick="setRoute('${id}')"><span class="ico">${ico}</span><span>${label}</span></button>`).join(''); }



function syncChipModeClass(){
  const status = String(window.cloudLastSaveStatus || cloudLastSaveStatus || '');
  const pending = Boolean(window.cloudPendingWrites || cloudPendingWrites);
  if(status.toLowerCase().includes('erro')) return 'is-error';
  if(pending) return 'is-pending';
  if(firebaseConfigured() && cloudUser && cloudReady) return 'is-cloud';
  return 'is-local';
}

function syncChipStatusLabel(){
  const status = String(cloudLastSaveStatus || '');
  if(status.toLowerCase().includes('erro')) return 'Erro';
  if(!firebaseConfigured()) return 'Local';
  if(!cloudUser) return 'Local';
  if(cloudPendingWrites) return 'Salvando';
  if(cloudReady) return 'Nuvem';
  return 'Conectando';
}
function syncChipName(){
  if(cloudUser){
    return cloudUser.displayName || cloudUser.email || 'Conta Google';
  }
  return 'Somente neste aparelho';
}
function syncChipPhoto(){
  return cloudUser?.photoURL || '';
}
function syncChipInitial(){
  const name = syncChipName();
  return (name || 'L').trim().charAt(0).toUpperCase();
}
function syncChipTooltip(){
  const status = String(cloudLastSaveStatus || '');
  if(status.toLowerCase().includes('erro')) return 'Erro de sincronização. Toque para abrir a área de sync.';
  if(!firebaseConfigured()) return 'Funcionando apenas localmente neste navegador';
  if(!cloudUser) return 'Firebase configurado, mas sem conta conectada';
  return `Sincronização ${cloudPendingWrites ? 'salvando' : (cloudReady ? 'na nuvem' : 'conectando')} • ${cloudUser.email || ''}`;
}
function updateHeaderSyncChip(){
  const header = document.querySelector('.app-header');
  if(!header) return;
  const host = header.querySelector('.brand-meta') || header;
  let chip = host.querySelector('.header-sync-chip');
  if(!chip){
    chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'header-sync-chip';
    chip.setAttribute('aria-label', 'Conta e sincronização');
    chip.addEventListener('click', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      if(route !== 'financeiro'){
        route = 'financeiro';
        render();
      }
      setTimeout(() => {
        const syncDrawer = document.querySelector('.cloud-sync-drawer');
        if(syncDrawer && !syncDrawer.open) syncDrawer.open = true;
        syncDrawer?.scrollIntoView({ behavior:'smooth', block:'center' });
      }, 60);
    });
    host.appendChild(chip);
  }
  const status = syncChipStatusLabel();
  const photo = syncChipPhoto();
  const initial = escapeHtml(syncChipInitial());
  const name = escapeHtml(syncChipName());
  const modeClass = syncChipModeClass();
  const modeLabel = (modeClass === 'is-cloud') ? 'Google • Nuvem' : (modeClass === 'is-pending') ? 'Google • Salvando' : (modeClass === 'is-error') ? 'Google • Erro' : 'Somente local';
  chip.className = `header-sync-chip ${modeClass}`;
  chip.title = syncChipTooltip();
  chip.innerHTML = `
    <span class="header-sync-chip__avatar">
      ${photo ? `<img src="${photo}" alt="${name}">` : `<span>${initial}</span>`}
    </span>
    <span class="header-sync-chip__text">
      <strong>${name}</strong>
      <small>${modeLabel}</small>
    </span>
    <span class="header-sync-chip__dot" aria-hidden="true"></span>
  `;
}


function firebaseConfigured(){
  const cfg = window.SR_TORTINHAS_FIREBASE_CONFIG;
  return !!(cfg && cfg.apiKey && cfg.projectId && cfg.appId && !String(cfg.apiKey).includes('COLE_AQUI'));
}
function cloudStatusText(){
  if(!firebaseConfigured()) return 'Firebase não configurado';
  if(!cloudUser) return 'offline';
  if(!cloudReady) return 'conectando...';
  return 'sincronizado';
}
function cloudUserLabel(){
  if(!cloudUser) return 'Entrar com Google';
  return cloudUser.displayName || cloudUser.email || 'Conta Google';
}
function initFirebaseSync(){
  if(!window.firebase || !firebaseConfigured()){
    cloudEnabled = false;
    return;
  }
  try{
    if(!firebase.apps.length) firebase.initializeApp(window.SR_TORTINHAS_FIREBASE_CONFIG);
    cloudEnabled = true;
    firebase.auth().onAuthStateChanged(user => {
      authChecked = true;
      cloudUser = user || null;
      cloudReady = false;
      if(cloudUnsubscribe){ cloudUnsubscribe(); cloudUnsubscribe = null; }
      if(cloudUser){
        startCloudListener();
      }
      render();
    });
  }catch(err){
    console.error('Firebase init error', err);
    cloudEnabled = false;
  }
}
function cloudDocRef(){
  if(!cloudUser || !window.firebase) return null;
  return firebase.firestore()
    .collection(CLOUD_DOC_COLLECTION)
    .doc(cloudUser.uid)
    .collection('apps')
    .doc(CLOUD_DOC_NAME);
}
function cloudSafeState(){
  return JSON.parse(JSON.stringify(state || {}));
}
function startCloudListener(){
  const ref = cloudDocRef();
  if(!ref) return;
  cloudReady = false;
  cloudUnsubscribe = ref.onSnapshot(snapshot => {
    const data = snapshot.exists ? snapshot.data() : null;
    if(!data || !data.state){
      pushCloudState(true);
      cloudReady = true;
      render();
      return;
    }
    const remoteUpdatedAt = Number(data.updatedAt || 0);
    const remoteBy = data.updatedBy || '';
    lastCloudUpdatedAt = remoteUpdatedAt;
    lastCloudUpdatedBy = remoteBy;
    if(remoteBy === CLOUD_DEVICE_ID){
      cloudReady = true;
      render();
      return;
    }
    applyingRemoteState = true;
    try{
      state = normalize(data.state);
      localStorage.setItem(STORE_KEY, JSON.stringify(state));
      cloudReady = true;
      toast('Dados sincronizados da nuvem');
      render();
    }catch(err){
      console.error('Erro ao aplicar dados da nuvem', err);
      cloudReady = true;
      render();
    }finally{
      applyingRemoteState = false;
    }
  }, err => {
    console.error('Firestore sync error', err);
    cloudReady = false;
    toast('Erro na sincronização Firebase');
    render();
  });
}
function scheduleCloudSave(){
  if(applyingRemoteState) return;
  if(!cloudEnabled || !cloudUser || !cloudReady) return;
  clearTimeout(cloudSaveTimer);
  cloudSaveTimer = setTimeout(() => pushCloudState(false), 450);
}
function pushCloudState(force=false){
  const ref = cloudDocRef();
  if(!ref) return;
  const now = Date.now();
  if(!force && now - lastCloudUpdatedAt < 120 && lastCloudUpdatedBy && lastCloudUpdatedBy !== CLOUD_DEVICE_ID){
    return;
  }
  lastCloudUpdatedAt = now;
  lastCloudUpdatedBy = CLOUD_DEVICE_ID;
  return ref.set({
    app: 'sr_tortinhas_control',
    version: 'v9.9',
    updatedAt: now,
    updatedBy: CLOUD_DEVICE_ID,
    userEmail: cloudUser.email || '',
    state: cloudSafeState()
  }, { merge: true }).catch(err => {
    console.error('Erro ao salvar na nuvem', err);
    toast('Não foi possível salvar na nuvem');
  });
}
function loginGoogle(){
  if(!window.firebase || !firebaseConfigured()){
    toast('Configure o Firebase antes de entrar');
    return;
  }
  const provider = new firebase.auth.GoogleAuthProvider();
  firebase.auth().signInWithPopup(provider).catch(err => {
    console.error('Login Google popup error', err);
    firebase.auth().signInWithRedirect(provider).catch(err2 => {
      console.error('Login Google redirect error', err2);
      toast('Erro ao entrar com Google');
    });
  });
}
function logoutGoogle(){
  if(window.firebase) firebase.auth().signOut().then(()=>{ route='venda'; render(); });
}
function forceCloudUpload(){
  if(!cloudUser){ toast('Entre com Google primeiro'); return; }
  pushCloudState(true)?.then(()=>toast('Dados enviados para a nuvem'));
}
function forceCloudDownload(){
  if(!cloudUser){ toast('Entre com Google primeiro'); return; }
  if(cloudUnsubscribe){ cloudUnsubscribe(); cloudUnsubscribe = null; }
  startCloudListener();
  toast('Sincronização recarregada');
}
function firebaseLoginCard(){
  const configured = firebaseConfigured();
  return `<details class="accordion cloud-sync-drawer" open>
    <summary>
      <div>
        <strong>Google e sincronização em tempo real</strong>
        <small>${configured ? cloudStatusText() : 'configure firebase-config.js'}</small>
      </div>
    </summary>
    <div class="cloud-sync-card">
      <div class="cloud-status ${cloudUser ? 'online' : 'offline'}">
        <div>
          <strong>${escapeHtml(cloudUserLabel())}</strong>
          <small>${cloudUser ? escapeHtml(cloudUser.email || 'conta conectada') : 'Conecte para sincronizar PC e celular'}</small>
        </div>
        <span>${configured ? (cloudUser ? 'online' : 'offline') : 'pendente'}</span>
      </div>
      <div class="cloud-actions">
        ${cloudUser ? `<button type="button" class="ghost" onclick="forceCloudUpload()">Enviar dados locais</button><button type="button" class="ghost" onclick="forceCloudDownload()">Baixar da nuvem</button><button type="button" class="danger" onclick="logoutGoogle()">Sair</button>` : `<button type="button" class="big-action" onclick="loginGoogle()" ${configured?'':'disabled'}>Entrar com Google</button>`}
      </div>
      <p class="cloud-note">${configured ? 'Quando conectado, alterações salvas no PC e no celular atualizam a mesma base no Firestore.' : 'Cole a configuração do Firebase no arquivo firebase-config.js para liberar o login.'}</p>
    </div>
  </details>`;
}



function firebaseSetupGate(){
  setHeader('Configuração Firebase');
  return `<div class="login-gate-screen">
    <div class="login-gate-card setup-warning">
      <img src="logo.png" alt="Sr. Tortinhas Control" class="login-gate-logo">
      <h1>Firebase não configurado</h1>
      <p>Para usar login Google e sincronização, preencha o arquivo <b>firebase-config.js</b> com as chaves reais do seu projeto Firebase.</p>
      <div class="setup-steps">
        <strong>Checklist rápido</strong>
        <small>1. Preencher firebase-config.js</small>
        <small>2. Ativar Authentication > Google</small>
        <small>3. Ativar Firestore Database</small>
        <small>4. Adicionar domínio da Vercel em Authorized domains</small>
      </div>
    </div>
  </div>`;
}

function googleLoginGate(){
  setHeader('Entrada com Google');
  return `<div class="login-gate-screen">
    <div class="login-gate-card">
      <img src="logo.png" alt="Sr. Tortinhas Control" class="login-gate-logo">
      <h1>Sr. Tortinhas Control</h1>
      <p>Entre com sua conta Google para sincronizar os dados entre celular e computador.</p>
      <button type="button" class="big-action login-google-main" onclick="loginGoogle()">Entrar com Google</button>
      <small>Se for a primeira vez, depois de entrar toque em “Enviar dados locais” na área de Backup, dados e manual para subir a base atual.</small>
    </div>
  </div>`;
}
function firebaseLoadingGate(){
  setHeader('Conectando');
  return `<div class="login-gate-screen">
    <div class="login-gate-card">
      <img src="logo.png" alt="Sr. Tortinhas Control" class="login-gate-logo">
      <h1>Conectando...</h1>
      <p>Verificando sua conta Google e sincronização.</p>
    </div>
  </div>`;
}

function render(){
  renderNav();
  const app = document.getElementById('app');

  if(!firebaseConfigured()){
    document.body.setAttribute('data-route', 'login');
    app.setAttribute('data-route', 'login');
    app.className = 'app-shell login-screen';
    app.innerHTML = firebaseSetupGate();
    updateHeaderSyncChip();
  requestAnimationFrame(updateHeaderSyncChip);
    bind();
    return;
  }

  if(firebaseConfigured() && !authChecked){
    document.body.setAttribute('data-route', 'login');
    app.setAttribute('data-route', 'login');
    app.className = 'app-shell login-screen';
    app.innerHTML = firebaseLoadingGate();
    updateHeaderSyncChip();
    bind();
    return;
  }

  if(firebaseConfigured() && !cloudUser){
    document.body.setAttribute('data-route', 'login');
    app.setAttribute('data-route', 'login');
    app.className = 'app-shell login-screen';
    app.innerHTML = googleLoginGate();
    updateHeaderSyncChip();
    bind();
    return;
  }

  document.body.setAttribute('data-route', route);
  app.setAttribute('data-route', route);
  app.className = `app-shell ${route}-screen`;
  app.innerHTML = ({ venda, estoque, clientes, financeiro })[route]();
  updateHeaderSyncChip();
  bind();
}

function ticketTotal(items=saleDraft.itens){ return moneyInput((items||[]).reduce((acc,it)=>acc + ((productPrice(it.produto)||0) * (Number(it.quantidade)||0)), 0)); }
function itemPaid(v){ return isCanceled(v) ? 0 : (v.statusPagamento === 'pago' ? Number(v.valorTotal)||0 : Math.min(Number(v.valorPago)||0, Number(v.valorTotal)||0)); }
function itemOpen(v){ return isCanceled(v) ? 0 : Math.max(0, (Number(v.valorTotal)||0) - itemPaid(v)); }
function updateSaleTotal(){ const el=document.getElementById('saleTotal'); if(el) el.textContent = brl(ticketTotal()); }

function helpTip(title, text){
  return `<details class="help-tip">
    <summary title="${escapeHtml(title)}">?</summary>
    <div class="help-tip-box">
      <strong>${escapeHtml(title)}</strong>
      <p>${escapeHtml(text)}</p>
    </div>
  </details>`;
}

function appQuickManual(){
  return `<details class="accordion manual-drawer">
    <summary>
      <div>
        <strong>Manual rápido do app</strong>
        <small>Guia enxuto para usar sem sair do sistema</small>
      </div>
    </summary>
    <div class="manual-content">
      <section class="manual-mini-section">
        <h3>1. Venda</h3>
        <p>Monte o ticket tocando nos sabores. Depois informe cliente ou use venda avulsa, escolha Pago ou Em aberto e salve.</p>
        <ul>
          <li><b>Pix:</b> mostra nome, chave e botão para QR Code.</li>
          <li><b>Dinheiro:</b> informe o valor pago para calcular o troco.</li>
          <li><b>Em aberto:</b> exige cliente para aparecer em Recebíveis.</li>
        </ul>
      </section>
      <section class="manual-mini-section">
        <h3>2. Financeiro</h3>
        <p>Use para conferir recebido, a receber, pagamentos por forma, gastos e relatórios.</p>
        <ul>
          <li><b>Recebíveis:</b> quem ainda falta pagar.</li>
          <li><b>Pagamentos:</b> Pix, Débito, Crédito e Dinheiro por cliente e ticket.</li>
          <li><b>Gastos:</b> lance ingredientes, embalagens, taxas e outras saídas.</li>
        </ul>
      </section>
      <section class="manual-mini-section">
        <h3>3. Estoque</h3>
        <p>Lance produção, confira saldo por sabor e acompanhe lotes. O estoque pode ficar negativo para não travar venda. Use os botões ? da aba para entender cada área.</p>
        <ul>
          <li><b>Adicionar produção:</b> quantidade, data e validade.</li>
          <li><b>Produtos do caixa:</b> define o que aparece na venda.</li>
          <li><b>Ficha técnica:</b> receitas, custos e rendimento.</li>
        </ul>
      </section>
      <section class="manual-mini-section">
        <h3>4. Clientes</h3>
        <p>Mostra histórico, pedidos pagos, abertos, parciais e cancelados.</p>
        <ul>
          <li><b>Branco:</b> sem pedidos no mês.</li>
          <li><b>Verde:</b> pedidos pagos.</li>
          <li><b>Amarelo:</b> aberto no mês.</li>
          <li><b>Vermelho:</b> pendência de mês anterior.</li>
        </ul>
      </section>
      <section class="manual-mini-section">
        <h3>Rotina ideal</h3>
        <p>Produziu? Lance no Estoque. Vendeu? Registre no Caixa. Gastou? Lance em Gastos. Fim do dia? Confira Financeiro e Relatórios.</p>
      </section>
    </div>
  </details>`;
}

function clientOptions(){ return state.clientes.slice().sort((a,b)=>a.nome.localeCompare(b.nome,'pt-BR')).map(c=>`<option value="${escapeHtml(c.nome)}"></option>`).join(''); }
function paymentChips(){ return ['Pix','Débito','Crédito','Dinheiro'].map(f => `<button type="button" class="chip ${saleDraft.forma===f?'active':''}" onclick="pickPay('${f}')">${f}</button>`).join(''); }


function openPixQrModal(){
  const modal = document.getElementById('pixQrModal');
  if(modal){
    modal.classList.add('open');
    return;
  }
  window.open(PIX_INFO.qrImage, '_blank');
}
function closePixQrModal(){
  const modal = document.getElementById('pixQrModal');
  if(modal) modal.classList.remove('open');
}
window.openPixQrModal = openPixQrModal;
window.closePixQrModal = closePixQrModal;

function pixInfoBox(){
  if(saleDraft.status !== 'pago' || saleDraft.forma !== 'Pix') return '';
  return `<div class="pix-trigger-box">
    <div class="pix-trigger-text">
      <strong>Pagamento via Pix</strong>
      <small>Mostre a chave ou abra o QR Code para o cliente</small>
    </div>
    <div class="pix-inline-info">
      <div class="pix-inline-card">
        <span>Nome</span>
        <b>${escapeHtml(PIX_INFO.nome)}</b>
      </div>
      <div class="pix-inline-card">
        <span>Chave Pix</span>
        <b>${escapeHtml(PIX_INFO.chave)}</b>
      </div>
    </div>
    <div class="pix-trigger-actions">
      <button type="button" class="ghost big-ghost pix-open-btn" onclick="openPixQrModal()">Exibir QR Code</button>
    </div>
    <div class="pix-modal" id="pixQrModal" onclick="if(event.target===this) closePixQrModal()">
      <div class="pix-modal-card">
        <button type="button" class="pix-modal-close" onclick="closePixQrModal()">Fechar</button>
        <div class="pix-modal-body">
          <img src="${PIX_INFO.qrImage}" alt="QR Code Pix ampliado" class="pix-qr-image-large">
          <div class="pix-modal-info">
            <strong>${escapeHtml(PIX_INFO.nome)}</strong>
            <span>Chave Pix</span>
            <b>${escapeHtml(PIX_INFO.chave)}</b>
          </div>
        </div>
      </div>
    </div>
  </div>`;
}

function paidCashValue(){
  return moneyInput(Number(String(saleDraft.valorRecebido || '').replace(',', '.').replace(/[^0-9.]/g,'')) || 0);
}
function cashChangeValue(){
  return Math.max(0, moneyInput(paidCashValue() - ticketTotal()));
}
function cashRemainingValue(){
  return Math.max(0, moneyInput(ticketTotal() - paidCashValue()));
}
function updateCashReceived(value){
  saleDraft.valorRecebido = value;
  const total = ticketTotal();
  const paid = paidCashValue();
  const troco = Math.max(0, moneyInput(paid - total));
  const falta = Math.max(0, moneyInput(total - paid));
  const paidEl = document.getElementById('cashPaidPreview');
  const changeEl = document.getElementById('cashChangePreview');
  const hintEl = document.getElementById('cashHint');
  if(paidEl) paidEl.textContent = brl(paid);
  if(changeEl) changeEl.textContent = brl(troco);
  if(hintEl){
    if(!paid){
      hintEl.textContent = 'Informe o valor pago para calcular o troco.';
    } else if(falta > 0){
      hintEl.textContent = `Ainda faltam ${brl(falta)} para completar a venda.`;
    } else if(troco > 0){
      hintEl.textContent = `Troco para devolver: ${brl(troco)}.`;
    } else {
      hintEl.textContent = 'Pagamento exato.';
    }
  }
}
window.updateCashReceived = updateCashReceived;

function cashInfoBox(){
  if(saleDraft.status !== 'pago' || saleDraft.forma !== 'Dinheiro') return '';
  const total = ticketTotal();
  const paid = paidCashValue();
  const troco = Math.max(0, moneyInput(paid - total));
  const falta = Math.max(0, moneyInput(total - paid));
  const hint = !paid
    ? 'Informe o valor pago para calcular o troco.'
    : falta > 0
      ? `Ainda faltam ${brl(falta)} para completar a venda.`
      : troco > 0
        ? `Troco para devolver: ${brl(troco)}.`
        : 'Pagamento exato.';
  return `<details class="cash-box" open>
    <summary>Troco no dinheiro</summary>
    <div class="cash-grid">
      <div class="cash-stat">
        <small>Total da venda</small>
        <b>${brl(total)}</b>
      </div>
      <label class="cash-input-wrap">
        <span>Valor pago</span>
        <input id="cashReceived" inputmode="decimal" type="number" min="0" step="0.01" placeholder="0,00" value="${escapeHtml(saleDraft.valorRecebido)}" oninput="updateCashReceived(this.value)">
      </label>
    </div>
    <div class="cash-result-row">
      <div class="cash-result">
        <small>Recebido</small>
        <b id="cashPaidPreview">${brl(paid)}</b>
      </div>
      <div class="cash-result highlight">
        <small>Troco</small>
        <b id="cashChangePreview">${brl(troco)}</b>
      </div>
    </div>
    <div class="cash-hint" id="cashHint">${hint}</div>
  </details>`;
}

function statusChips(){ return `<button type="button" class="chip okchip ${saleDraft.status==='pago'?'active':''}" onclick="pickStatus('pago')">Pago</button><button type="button" class="chip openchip ${saleDraft.status==='em_aberto'?'active':''}" onclick="pickStatus('em_aberto')">Em aberto</button>`; }

function soldTodayByProduct(){
  const out = {};
  allProducts().forEach(p => out[p.nome] = 0);
  activeSales().filter(v=>v.data===today()).forEach(v => { out[v.produto] += Number(v.quantidade) || 0; });
  return out;
}
function availableByProduct(){
  return stockByProduct();
}
function productCards(){
  const sold = soldTodayByProduct();
  const stock = availableByProduct();
  const products = activeProducts().filter(prod => prod.mostrarNaVenda !== false);
  if(!products.length) return '<div class="empty-inline">Nenhum produto configurado para aparecer na venda.</div>';
  return products.map(prod => {
    const p = prod.nome;
    const x = sold[p] || 0;
    const y = stock[p]?.disp || 0;
    const selectedQty = saleDraft.itens.find(it => it.produto === p)?.quantidade || 0;
    const activeClass = selectedQty > 0 ? 'active selected' : '';
    const bubbleClass = selectedQty > 0 ? 'plus count' : 'plus';
    const bubbleLabel = selectedQty > 0 ? String(selectedQty) : '+';
    return `<button type="button" aria-pressed="${selectedQty > 0 ? 'true' : 'false'}" class="product-pick ${productClass(p)} ${activeClass}" onclick="addProductQuick('${p}')"><span class="${bubbleClass}">${bubbleLabel}</span><b>${escapeHtml(p)}</b><small>${brl(productPrice(p))}</small><span class="xy">${x}/${y}</span><em>vendido/disponível</em></button>`;
  }).join('');
}
function currentTicketItems(){
  if(!saleDraft.itens.length) return '<div class="empty-inline">Toque em um sabor para montar o ticket.</div>';
  return saleDraft.itens.map((it,idx)=>`<div class="ticket-line ${productClass(it.produto)}"><div><strong>${escapeHtml(it.produto)}</strong><small>${brl(productPrice(it.produto))} cada</small></div><div class="ticket-controls"><button type="button" class="mini ghost" onclick="adjustTicketItem(${idx},-1)">−</button><b>${it.quantidade}</b><button type="button" class="mini ghost" onclick="adjustTicketItem(${idx},1)">+</button><span class="line-total">${brl((productPrice(it.produto)||0)*(it.quantidade||0))}</span><button type="button" class="mini danger" onclick="removeItemFromTicket(${idx})">Remover</button></div></div>`).join('');
}
function venda(){
  setHeader(saleDraft.editingTicketId ? 'Editar venda' : 'Caixa rápido');
  return `
    <h1 class="screen-title">Venda</h1>

    <div class="quick-products">
      ${productCards()}
    </div>

    <form id="saleForm">
      <section class="card checkout-card">
        <div class="section-head compact"><h2>Ticket ${helpTip("Ticket", "Toque nos sabores para montar a venda. Você pode aumentar, diminuir ou remover itens antes de salvar.")}</h2><span>${saleDraft.itens.length} item(ns)</span></div>
        <div class="ticket-box clean-ticket">${currentTicketItems()}</div>
        <div class="total-box"><span>Total</span><b id="saleTotal">${brl(ticketTotal())}</b></div>
      </section>

      <section class="card checkout-card">
        <div class="section-head compact"><h2>Cliente ${helpTip("Cliente", "Use cliente cadastrado para histórico e cobranças. Venda avulsa é ideal para balcão e só funciona como paga.")}</h2><div class="row" style="gap:8px;flex-wrap:wrap"><button type="button" class="mini ghost" onclick="goToNewClient()">+ Cliente</button><button type="button" class="mini ${saleDraft.avulsa?'active-mini':''}" onclick="toggleAvulsa()">Venda avulsa</button></div></div>
        ${saleDraft.avulsa ? `<div class="avulsa-box"><strong>Venda avulsa</strong><small>Cliente padrão balcão • disponível somente para venda paga</small></div>` : `<input id="saleClient" name="cliente" list="clientesList" autocomplete="off" placeholder="Nome do cliente" value="${escapeHtml(saleDraft.cliente)}">`}
        <datalist id="clientesList">${clientOptions()}</datalist>
        <input id="saleDate" name="data" type="date" value="${saleDraft.data || today()}" class="date-quiet">
      </section>

      <section class="card checkout-card">
        <div class="section-head compact"><h2>Pagamento ${helpTip("Pagamento", "Pago entra em Pagamentos. Em aberto vai para Recebíveis e precisa ter cliente informado.")}</h2><span>${saleDraft.status==='pago' ? 'Recebido' : 'A cobrar'}</span></div>
        <div class="chips">${statusChips()}</div>
        <div id="payBox" style="display:${saleDraft.status==='pago'?'block':'none'};margin-top:10px">
          <div class="chips">${paymentChips()}</div>
          <div class="payment-helper-stack">
            ${pixInfoBox()}
            ${cashInfoBox()}
          </div>
        </div>
      </section>

      <div class="action-row sale-final-actions">
        <button type="button" class="ghost" onclick="clearCurrentSale()">${saleDraft.editingTicketId ? 'Cancelar edição' : 'Limpar'}</button>
        <button class="big-action">${saleDraft.editingTicketId ? 'Atualizar venda' : 'Salvar venda'}</button>
      </div>
    </form>
  `;
}

function totals(filterDate=null){
  const vendas = activeSales(filterDate ? state.vendas.filter(v=>v.data===filterDate) : state.vendas);
  return vendas.reduce((acc,v)=>{
    acc.un += Number(v.quantidade)||0;
    acc.total += Number(v.valorTotal)||0;
    acc.pago += itemPaid(v);
    acc.aberto += itemOpen(v);
    return acc;
  }, {un:0,total:0,pago:0,aberto:0});
}
function saleRowForLot(v, quantidade){
  const unitValue = Number(v.valorUnitario) || (productPrice(v.produto) || 0);
  return {
    vendaId: v.id,
    ticketId: v.ticketId,
    data: v.data,
    cliente: v.cliente,
    produto: v.produto,
    quantidade,
    valor: moneyInput(quantidade * unitValue),
    statusPagamento: v.statusPagamento,
    formaPagamento: v.formaPagamento || ''
  };
}
function lotAllocationData(){
  const used = new Map();
  const sales = new Map();
  const shortages = new Map();
  state.producao.forEach(l => { used.set(l.id, 0); sales.set(l.id, []); });
  allProducts().forEach(p => shortages.set(p.nome, []));

  const sortedSales = activeSales()
    .slice()
    .sort((a,b)=>(a.data||'').localeCompare(b.data||'') || String(a.id||'').localeCompare(String(b.id||'')));

  sortedSales.forEach(v => {
    let remaining = Number(v.quantidade) || 0;
    const eligibleLots = state.producao
      .filter(l => l.produto === v.produto)
      .slice()
      .sort((a,b)=>(a.validade||'').localeCompare(b.validade||'') || (a.data||'').localeCompare(b.data||''));

    eligibleLots.forEach(l => {
      if(remaining <= 0) return;
      const capacity = Math.max(0, (Number(l.quantidade)||0) - (used.get(l.id)||0));
      if(capacity <= 0) return;
      const q = Math.min(capacity, remaining);
      used.set(l.id, (used.get(l.id)||0) + q);
      sales.get(l.id).push(saleRowForLot(v, q));
      remaining -= q;
    });

    if(remaining > 0){
      shortages.get(v.produto).push(saleRowForLot(v, remaining));
    }
  });
  return { used, sales, shortages };
}
function lotUsageMap(){
  return lotAllocationData().used;
}
function lotSalesMap(){
  return lotAllocationData().sales;
}
function shortageSalesMap(){
  return lotAllocationData().shortages;
}

function stockCardTip(produto, data){
  const disp = Number(data?.disp)||0;
  if(disp < 0) return helpTip('Estoque negativo', 'Este produto vendeu mais do que foi lançado em produção. A venda não trava; lance a produção que faltou para regularizar.');
  if(disp === 0) return helpTip('Sem saldo', 'O produto está zerado no sistema. Você ainda pode vender, mas depois deve conferir ou lançar produção.');
  return helpTip('Saldo do estoque', 'Mostra produzido, vendido e disponível. O disponível é recalculado automaticamente com base nas vendas salvas.');
}

function stockByProduct(){
  const usage = lotUsageMap();
  const out = {};
  allProducts().forEach(p=> out[p.nome] = {feito:0,vendido:0,disp:0,validade:'',vencidos:0,negativo:0});
  state.producao.forEach(l=>{
    if(!out[l.produto]) return;
    const qtd = Number(l.quantidade)||0;
    const usado = usage.get(l.id) || 0;
    const restante = Math.max(0, qtd - usado);
    out[l.produto].feito += qtd;
    if(restante > 0 && l.validade && (!out[l.produto].validade || l.validade < out[l.produto].validade)) out[l.produto].validade = l.validade;
    if(restante > 0 && l.validade && l.validade < today()) out[l.produto].vencidos += restante;
  });
  activeSales().forEach(v => {
    if(out[v.produto]) out[v.produto].vendido += Number(v.quantidade)||0;
  });
  Object.keys(out).forEach(p => {
    out[p].disp = out[p].feito - out[p].vendido;
    out[p].negativo = Math.max(0, -out[p].disp);
  });
  return out;
}

function stockMini(){
  const s = stockByProduct();
  const sold = soldTodayByProduct();
  return `<div class="pill-box"><div class="stock-mini">${Object.entries(s).map(([p,x])=>`<div class="stock-pill ${productClass(p)}"><strong>${p}</strong><b>${sold[p]||0}/${x.disp}</b><small>vendido/disponível</small></div>`).join('')}</div></div>`;
}

function groupTickets(list){
  const map = new Map();
  list.forEach(v => {
    const ticketId = v.ticketId || `ticket_${v.id}`;
    if(!map.has(ticketId)) map.set(ticketId, { ticketId, data:v.data, cliente:v.cliente, forma:v.formaPagamento||'', status:v.statusPagamento, itens:[], total:0, openTotal:0, paidTotal:0, canceled:0 });
    const g = map.get(ticketId);
    g.data = g.data || v.data;
    g.cliente = g.cliente || v.cliente;
    if(v.formaPagamento) g.forma = v.formaPagamento;
    g.itens.push(v);
    if(v.statusPagamento !== 'cancelado') g.total += Number(v.valorTotal)||0;
    g.openTotal += itemOpen(v);
    g.paidTotal += itemPaid(v);
    if(v.statusPagamento==='cancelado') g.canceled += 1;
  });
  return [...map.values()].sort((a,b)=>(b.data||'').localeCompare(a.data||''));
}
function inferTicketStatus(ticket){
  if(ticket.itens.every(it => it.statusPagamento==='cancelado')) return 'cancelado';
  if(ticket.openTotal <= 0) return 'pago';
  return ticket.paidTotal > 0 ? 'parcial' : 'em_aberto';
}
function ticketSummaryLines(ticket){
  const grouped = {};
  ticket.itens.filter(it => it.statusPagamento !== 'cancelado').forEach(it => { grouped[it.produto] = (grouped[it.produto]||0) + (Number(it.quantidade)||0); });
  const text = Object.entries(grouped).map(([p,q])=>`${q}x ${p}`).join(' • ');
  return text || 'Venda cancelada';
}
function ticketCard(ticket, showClient=true){
  const status = inferTicketStatus(ticket);
  return `<div class="item">
    <div class="between"><div><strong>${showClient ? escapeHtml(ticket.cliente) : ticketSummaryLines(ticket)}</strong><small>${showClient ? `${ticketSummaryLines(ticket)} • ${dateBR(ticket.data)}` : `${dateBR(ticket.data)} • ${escapeHtml(ticket.cliente)}`}</small></div><div style="text-align:right"><div class="price">${brl(ticket.openTotal || ticket.total)}</div><span class="tag ${status}">${status==='pago'?'Pago':status==='cancelado'?'Cancelado':status==='parcial'?'Parcial':'Em aberto'}</span></div></div>
    ${ticket.forma && status==='pago' ? `<div class="sale-meta"><span class="tag total">${escapeHtml(ticket.forma)}</span></div>`:''}
    ${status!=='cancelado' && ticket.openTotal>0 ? `<small class="open-line">Em aberto: ${brl(ticket.openTotal)} ${ticket.paidTotal>0 ? `• Pago parcial: ${brl(ticket.paidTotal)}` : ''}</small>` : ''}
    <div class="drawer row" style="justify-content:flex-end;flex-wrap:wrap">
      ${status!=='cancelado' ? `<button class="mini ghost" onclick="editTicket('${ticket.ticketId}')">Editar</button>` : ''}
      ${status!=='cancelado' && ticket.openTotal>0 ? `<button class="mini ghost" onclick="partialPayTicket('${ticket.ticketId}')">Baixa parcial</button>` : ''}
      ${status!=='cancelado' ? `<button class="mini ghost" onclick="toggleTicketPaid('${ticket.ticketId}')">${status==='pago'?'Reabrir':'Marcar pago'}</button>` : ''}
      ${status!=='cancelado' ? `<button class="mini danger" onclick="cancelTicket('${ticket.ticketId}')">Cancelar venda</button>` : ''}
    </div>
  </div>`;
}

function hoje(){
  setHeader('Resumo do dia');
  const t = totals(today());
  const tickets = groupTickets(state.vendas.filter(v=>v.data===today()));
  return `
    <h1 class="screen-title">Hoje</h1>
    <div class="kpis">
      <div class="kpi"><small>Unidades</small><b>${t.un}</b></div>
      <div class="kpi"><small>Pago</small><b>${brl(t.pago)}</b></div>
      <div class="kpi"><small>Em aberto</small><b>${brl(t.aberto)}</b></div>
    </div>
    <div class="section-head"><h2>Saldos</h2><span>Vendido/Disponível</span></div>
    ${stockMini()}
    <div class="section-head"><h2>Tickets de hoje</h2><span>${tickets.length}</span></div>
    <div class="list">${tickets.map(tk=>ticketCard(tk,true)).join('') || '<div class="card empty">Nenhuma venda lançada hoje.</div>'}</div>
  `;
}

function daysUntil(dateStr){
  const a = new Date(today()+'T12:00:00');
  const b = new Date((dateStr||today())+'T12:00:00');
  return Math.round((b-a)/86400000);
}
function lotState(l, remaining){
  if(!remaining) return {label:'Esgotado', cls:'neutral', priority:4};
  const d = daysUntil(l.validade);
  if(d < 0) return {label:'Vencido', cls:'danger', priority:0};
  if(d === 0) return {label:'Vence hoje', cls:'warn', priority:1};
  if(d === 1) return {label:'Vence amanhã', cls:'warn', priority:2};
  if(remaining <= 3) return {label:'Estoque baixo', cls:'warn', priority:3};
  return {label:'Normal', cls:'ok', priority:5};
}
function productTrackingList(product){
  const loteSales = [];
  const lots = state.producao
    .filter(l => l.produto === product)
    .slice()
    .sort((a,b)=>(a.validade||'').localeCompare(b.validade||'') || (a.data||'').localeCompare(b.data||''));
  const salesMap = lotSalesMap();
  lots.forEach(l => {
    const sales = salesMap.get(l.id) || [];
    sales.forEach(s => loteSales.push({...s, loteId:l.id, loteData:l.data, loteValidade:l.validade}));
  });
  const negative = shortageSalesMap().get(product) || [];
  const rows = [
    ...loteSales.map(s => ({...s, origem:'Lote', extra:`Lote ${dateBR(s.loteData)} • vence ${dateBR(s.loteValidade)}`})),
    ...negative.map(s => ({...s, origem:'Negativo', extra:'Sem lote suficiente'}))
  ].sort((a,b)=>(b.data||'').localeCompare(a.data||''));

  if(!rows.length) return '<div class="empty-inline">Nenhuma venda registrada para este sabor.</div>';

  return `<div class="lot-sales">${rows.map(s=>`<div class="lot-sale-row ${s.origem==='Negativo'?'negative-sale':''}">
    <div>
      <strong>${escapeHtml(s.cliente)}</strong>
      <small>${dateBR(s.data)} • ${s.quantidade}x ${escapeHtml(s.produto)} • ${s.formaPagamento || 'A cobrar'}</small>
      <small>${escapeHtml(s.extra)}</small>
    </div>
    <div style="text-align:right">
      <b>${brl(s.valor)}</b>
      <span class="tag ${s.origem==='Negativo'?'cancelado':s.statusPagamento}">${s.origem==='Negativo'?'Negativo':(s.statusPagamento==='pago'?'Pago':s.statusPagamento==='parcial'?'Parcial':'Em aberto')}</span>
    </div>
  </div>`).join('')}</div>`;
}
function productLotList(product){
  const usage = lotUsageMap();
  const lots = state.producao
    .filter(l => l.produto === product)
    .slice()
    .sort((a,b)=>(a.validade||'').localeCompare(b.validade||'') || (a.data||'').localeCompare(b.data||''));
  if(!lots.length) return '<div class="empty-inline">Nenhum lote cadastrado para este sabor.</div>';
  return `<div class="mini-lots">${lots.map(l=>{
    const qtd = Number(l.quantidade)||0;
    const sold = usage.get(l.id)||0;
    const rest = Math.max(0, qtd-sold);
    const st = lotState(l, rest);
    return `<div class="mini-lot">
      <div>
        <strong>${rest}/${qtd}</strong>
        <small>Fabricado ${dateBR(l.data)} • vence ${dateBR(l.validade)}</small>
      </div>
      <span class="lot-badge ${st.cls}">${st.label}</span>
    </div>`;
  }).join('')}</div>`;
}
function productStockDrawer(product, x, soldToday){
  const negativeQty = Math.max(0, -x.disp);
  const badge = x.disp < 0
    ? `<span class="stock-alert danger">Faltam ${negativeQty}</span>`
    : (x.disp === 0 ? '<span class="stock-alert danger">Sem lote</span>' : (x.vencidos ? '<span class="stock-alert danger">Vencido</span>' : (x.disp <= 3 ? '<span class="stock-alert warn">Estoque baixo</span>' : '<span class="stock-alert ok">Ok</span>')));
  return `<details class="product-stock-drawer stock-main-card ${productClass(product)} ${x.disp < 0 ? 'negative' : ''}">
    <summary>
      <div class="product-summary-top">
        <div>
          <strong>${product}</strong>
          <b>${soldToday || 0}/${x.disp < 0 ? 0 : x.disp}</b>
          <small>vendido hoje / disponível</small>
          <em>${x.disp < 0 ? `Venda sem produção: ${negativeQty} un.` : (x.validade ? 'Próx. validade: '+dateBR(x.validade) : 'Sem produção lançada')}</em>
        </div>
        ${badge}
      </div>
    </summary>
    <div class="product-stock-body">
      <div class="mini-kpis clean-stock-kpis">
        <div><small>Fabricado</small><b>${x.feito}</b></div>
        <div><small>Vendido</small><b>${x.vendido}</b></div>
        <div><small>${x.disp < 0 ? 'Venda sem produção' : 'Disponível'}</small><b>${x.disp < 0 ? negativeQty : x.disp}</b></div>
      </div>
      <div class="mini-link-row">
        <button class="mini ghost" onclick="startProductionFor('${product}')">Adicionar produção</button>
      </div>
      <details class="inner-drawer">
        <summary>Produção e vendas deste produto</summary>
        <div class="section-head compact-head"><h2>Histórico de produção</h2><span>${product}</span></div>
        ${productLotList(product)}
        <div class="section-head compact-head"><h2>Vendas deste produto</h2><span>${negativeQty ? `sem produção ${negativeQty}` : 'vendas vinculadas'}</span></div>
        ${productTrackingList(product)}
      </details>
    </div>
  </details>`;
}
function stockDashboard(){
  const stock = stockByProduct();
  const sold = soldTodayByProduct();
  return `<div class="stock-dashboard unified">${Object.entries(stock).map(([p,x])=>productStockDrawer(p,x,sold[p]||0)).join('')}</div>`;
}

function lotSalesList(l){
  const sales = lotSalesMap().get(l.id) || [];
  if(!sales.length) return '<div class="empty-inline">Nenhuma venda vinculada a este lote.</div>';
  return `<div class="lot-sales">${sales.map(s=>`<div class="lot-sale-row"><div><strong>${escapeHtml(s.cliente)}</strong><small>${dateBR(s.data)} • ${s.quantidade}x ${escapeHtml(s.produto)} • ${s.formaPagamento || 'A cobrar'}</small></div><div style="text-align:right"><b>${brl(s.valor)}</b><span class="tag ${s.statusPagamento}">${s.statusPagamento==='pago'?'Pago':s.statusPagamento==='parcial'?'Parcial':'Em aberto'}</span></div></div>`).join('')}</div>`;
}
function lotDrawer(l){
  const usage = lotUsageMap();
  const sold = usage.get(l.id) || 0;
  const qtd = Number(l.quantidade)||0;
  const remaining = Math.max(0, qtd - sold);
  const st = lotState(l, remaining);
  return `<details class="lot-drawer ${st.cls}">
    <summary>
      <div>
        <strong>${escapeHtml(l.produto)} — ${remaining}/${qtd}</strong>
        <small>Fabricado ${dateBR(l.data)} • vence ${dateBR(l.validade)}</small>
      </div>
      <span class="lot-badge ${st.cls}">${st.label}</span>
    </summary>
    <div class="lot-body">
      <div class="mini-kpis lot-kpis">
        <div><small>Fabricado</small><b>${qtd}</b></div>
        <div><small>Vendido</small><b>${sold}</b></div>
        <div><small>Restante</small><b>${remaining}</b></div>
      </div>
      <div class="section-head compact-head"><h2>Vendas deste lote</h2><span>${sold} un.</span></div>
      ${lotSalesList(l)}
      <div class="row" style="justify-content:flex-end;flex-wrap:wrap;margin-top:10px">
        <button class="mini ghost" onclick="editLot('${l.id}')">Editar lote</button>
        <button class="mini danger" onclick="deleteLot('${l.id}')">Excluir lote</button>
      </div>
    </div>
  </details>`;
}

function recipePrice(nome, precoVenda=0){
  if(Number(precoVenda) > 0) return Number(precoVenda);
  const n = String(nome||'').toLowerCase();
  if(n.includes('lim')) return productPrice('Limão');
  if(n.includes('maracuj')) return productPrice('Maracujá');
  if(n.includes('choc')) return productPrice('Chocolate');
  return 0;
}
function recipeTotals(r){
  const totalIngredientes = (r.ingredientes||[]).reduce((a,i)=>a+(Number(i.custoReceita)||0),0);
  const rendimento = Number(r.rendimento)||0;
  const custoUnidade = rendimento ? totalIngredientes / rendimento : 0;
  const preco = recipePrice(r.nome, r.precoVenda);
  const margem = preco ? preco - custoUnidade : 0;
  const margemPct = preco ? (margem / preco) * 100 : 0;
  return { totalIngredientes, rendimento, custoUnidade, preco, margem, margemPct };
}
function recipeDrawer(r){
  const t = recipeTotals(r);
  return `<details class="recipe-drawer accordion">
    <summary>
      <div><strong>${escapeHtml(r.nome)}</strong><small>Rende ${r.rendimento || '-'} un. • custo un. ${brl(t.custoUnidade)}</small></div>
      <div class="money-summary-value"><b>${t.preco ? brl(t.margem) : brl(0)}</b><span>margem un.</span></div>
    </summary>
    <div class="card" style="margin:0;border:0;border-radius:0;box-shadow:none">
      <div class="mini-kpis recipe-kpis">
        <div><small>Rendimento</small><b>${r.rendimento || '-'}</b></div>
        <div><small>Custo total</small><b>${brl(t.totalIngredientes)}</b></div>
        <div><small>Preço</small><b>${t.preco ? brl(t.preco) : '-'}</b></div><div><small>Margem %</small><b>${t.preco ? t.margemPct.toFixed(0)+'%' : '-'}</b></div>
      </div>
      ${r.observacoes ? `<div class="recipe-note"><strong>Observações</strong><small>${escapeHtml(r.observacoes)}</small></div>` : ''}
      <div class="section-head compact"><h2>Ingredientes</h2><span>${(r.ingredientes||[]).length}</span></div>
      <div class="recipe-ingredients">
        ${(r.ingredientes||[]).map(i=>`<div><span>${escapeHtml(i.item)}</span><b>${brl(i.custoReceita)}</b></div>`).join('') || '<div class="empty-inline">Sem ingredientes cadastrados.</div>'}
      </div>
      <div class="row" style="justify-content:flex-end;flex-wrap:wrap;margin-top:12px">
        <button class="mini ghost" onclick="startProductionFor('${escapeHtml(r.nome.includes('Lim') ? 'Limão' : r.nome.includes('Maracuj') ? 'Maracujá' : r.nome.includes('Choc') ? 'Chocolate' : 'Maracujá')}')">Produzir</button>
        <button class="mini ghost" onclick="duplicateRecipe('${r.id}')">Duplicar</button>
        <button class="mini ghost" onclick="editRecipe('${r.id}')">Editar</button>
        <button class="mini danger" onclick="deleteRecipe('${r.id}')">Excluir</button>
      </div>
    </div>
  </details>`;
}
function recipeIngredientFields(){
  return (recipeDraft.ingredientes||[]).map((ing,idx)=>`
    <div class="recipe-ing-row">
      <label><span>Ingrediente</span><input name="ing_item_${idx}" value="${escapeHtml(ing.item)}" placeholder="Ex.: leite condensado"></label>
      <label><span>Custo</span><input name="ing_cost_${idx}" type="number" step="0.01" inputmode="decimal" value="${Number(ing.custoReceita)||0}"></label>
      <button type="button" class="mini danger" onclick="removeRecipeIngredient(${idx})">×</button>
    </div>
  `).join('');
}
function recipeFormBlock(){
  const editing = !!recipeDraft.id;
  return `<details class="accordion recipe-form" ${recipeFormOpen || editing ? 'open' : ''}>
    <summary>${editing ? 'Editar receita' : 'Criar nova receita'}</summary>
    <div class="card" style="margin:0;border:0;border-radius:0;box-shadow:none">
      <form id="recipeForm">
        <input type="hidden" name="id" value="${escapeHtml(recipeDraft.id)}">
        <label><span>Nome da receita</span><input name="nome" required value="${escapeHtml(recipeDraft.nome)}" placeholder="Ex.: Tortinha de Morango"></label>
        <div class="grid grid2">
          <label><span>Rendimento</span><input name="rendimento" type="number" min="1" inputmode="numeric" value="${Number(recipeDraft.rendimento)||6}"></label>
          <label><span>Preço de venda</span><input name="precoVenda" type="number" step="0.01" inputmode="decimal" value="${Number(recipeDraft.precoVenda)||0}"></label>
        </div>
        <label><span>Observações</span><input name="observacoes" value="${escapeHtml(recipeDraft.observacoes||'')}" placeholder="Opcional: preparo, validade, dicas..."></label>
        <div class="section-head compact"><h2>Ingredientes</h2><button type="button" class="mini ghost" onclick="addRecipeIngredient()">+ Ingrediente</button></div>
        <div class="recipe-ing-list">${recipeIngredientFields()}</div>
        <br>
        <div class="row" style="justify-content:flex-end;flex-wrap:wrap">
          ${(recipeFormOpen || editing) ? '<button type="button" class="ghost" onclick="cancelRecipeForm()">Cancelar</button>' : ''}
          <button>${editing ? 'Salvar alterações' : 'Salvar receita'}</button>
        </div>
      </form>
    </div>
  </details>`;
}

function linkedRecipeName(id){
  const r = (state.receitasProdutos||[]).find(x=>x.id===id);
  return r ? r.nome : '';
}
function produtoRow(p){
  return `<div class="product-admin-row ${productClass(p.nome)} ${p.ativo===false?'inactive':''}">
    <div>
      <strong>${escapeHtml(p.nome)}</strong>
      <small>${brl(p.preco)} • caixa: ${p.mostrarNaVenda===false?'não aparece':'aparece'}${p.fichaId ? ' • ficha: '+escapeHtml(linkedRecipeName(p.fichaId)) : ''}</small>
    </div>
    <div style="text-align:right">
      <button class="mini ghost" onclick="editProduct('${p.id}')">Editar</button>
      <button class="mini ghost" onclick="toggleProduct('${p.id}')">${p.mostrarNaVenda===false?'Mostrar':'Ocultar'}</button>
      <button class="mini danger" onclick="deleteProduct('${p.id}')">Excluir</button>
    </div>
  </div>`;
}
function productFormBlock(){
  const editing = !!productDraft.id;
  const receitas = state.receitasProdutos || [];
  return `<details class="accordion product-form" ${productFormOpen || editing ? 'open' : ''}>
    <summary>${editing ? 'Editar produto' : 'Novo produto'}</summary>
    <div class="card" style="margin:0;border:0;border-radius:0;box-shadow:none">
      <form id="productForm">
        <input type="hidden" name="id" value="${escapeHtml(productDraft.id)}">
        <label><span>Nome do produto</span><input name="nome" required value="${escapeHtml(productDraft.nome)}" placeholder="Ex.: Tortinha de Morango"></label>
        <div class="grid">
          <label><span>Preço de venda</span><input name="preco" type="number" step="0.01" inputmode="decimal" value="${Number(productDraft.preco)||0}" required></label>
        </div>
        <label><span>Mostrar no caixa?</span><select name="mostrarNaVenda"><option value="true" ${productDraft.mostrarNaVenda!==false?'selected':''}>Sim</option><option value="false" ${productDraft.mostrarNaVenda===false?'selected':''}>Não</option></select></label>
        <label><span>Ficha técnica vinculada</span><select name="fichaId"><option value="">Nenhuma</option>${receitas.map(r=>`<option value="${r.id}" ${productDraft.fichaId===r.id?'selected':''}>${escapeHtml(r.nome)}</option>`).join('')}</select></label>
        <br>
        <div class="row" style="justify-content:flex-end;flex-wrap:wrap">
          ${(productFormOpen || editing) ? '<button type="button" class="ghost" onclick="cancelProductForm()">Cancelar</button>' : ''}
          <button>${editing ? 'Salvar alterações' : 'Salvar produto'}</button>
        </div>
      </form>
    </div>
  </details>`;
}
function produtosBlock(){
  const produtos = allProducts();
  return `<details class="accordion products-block">
    <summary>Produtos do caixa (${produtos.filter(p=>p.mostrarNaVenda!==false).length} visíveis)</summary>
    <div class="card" style="margin:0;border:0;border-radius:0;box-shadow:none">
      ${productFormBlock()}
      <div class="section-head compact"><h2>Produtos do caixa</h2><span>${produtos.length}</span></div>
      <div class="product-admin-list">${produtos.map(produtoRow).join('')}</div>
    </div>
  </details>`;
}

function receitasBlock(){
  const receitas = state.receitasProdutos || [];
  return `<details class="accordion recipes-block">
    <summary>Ficha técnica (${receitas.length})</summary>
    <div class="card" style="margin:0;border:0;border-radius:0;box-shadow:none">
      ${recipeFormBlock()}
      <div class="section-head compact"><h2>Fichas salvas</h2><span>${receitas.length}</span></div>
      <div class="list">${receitas.map(recipeDrawer).join('') || '<div class="empty-inline">Nenhuma receita importada.</div>'}</div>
    </div>
  </details>`;
}

function estoque(){
  setHeader('Estoque');
  const usage = lotUsageMap();
  const lots = state.producao.slice().sort((a,b)=>{
    const ar = Math.max(0,(Number(a.quantidade)||0) - (usage.get(a.id)||0));
    const br = Math.max(0,(Number(b.quantidade)||0) - (usage.get(b.id)||0));
    const as = lotState(a, ar), bs = lotState(b, br);
    return as.priority - bs.priority || (a.validade||'').localeCompare(b.validade||'') || (b.data||'').localeCompare(a.data||'');
  });
  const formOpen = lotFormOpen || !!lotDraft.id;
  return `
    <h1 class="screen-title">Estoque ${helpTip("Estoque", "Controle produção, validade, saldo, produtos do caixa e ficha técnica. Se ficar negativo, venda não trava: ajuste lançando produção.")}</h1>
    <div class="stock-guide">Produtos, produção e fichas técnicas. Toque em um produto para ver os detalhes.</div>
    ${stockDashboard()}

    ${produtosBlock()}

    <details class="accordion" ${formOpen ? 'open' : ''}>
      <summary>${lotDraft.id ? 'Editar produção' : 'Adicionar produção'}</summary>
      <div class="card" style="margin:0;border:0;border-radius:0;box-shadow:none">
        <form id="prodForm">
          <input type="hidden" name="id" value="${escapeHtml(lotDraft.id)}">
          <div class="grid grid2">
            <label><span>Sabor</span><select name="produto">${productOptions(lotDraft.produto)}</select></label>
            <label><span>Quantidade fabricada</span><input name="quantidade" type="number" min="1" inputmode="numeric" value="${Number(lotDraft.quantidade)||10}"></label>
            <label><span>Data de fabricação</span><input id="prodDate" name="data" type="date" value="${lotDraft.data || today()}"></label>
            <label><span>Validade</span><input id="prodVal" name="validade" type="date" value="${lotDraft.validade || addDays(lotDraft.data||today(),3)}"></label>
          </div>
          <br>
          <div class="row" style="justify-content:flex-end;flex-wrap:wrap">
            ${formOpen ? '<button type="button" class="ghost" onclick="cancelLotForm()">Cancelar</button>' : ''}
            <button>${lotDraft.id ? 'Salvar alterações' : 'Salvar produção'}</button>
          </div>
        </form>
      </div>
    </details>

    ${receitasBlock()}

    <details class="accordion" style="margin-top:12px">
      <summary>Histórico de produção (${lots.length})</summary>
      <div class="card" style="margin:0;border:0;border-radius:0;box-shadow:none">
        <div class="list">${lots.map(lotDrawer).join('') || '<div class="empty">Nenhum lote cadastrado.</div>'}</div>
      </div>
    </details>
  `;
}

function clientStats(){
  const mk = today().slice(0,7);
  return state.clientes.map(c=>{
    const vs = activeSales(state.vendas.filter(v=>slug(v.cliente)===slug(c.nome)));
    const month = vs.filter(v=>(v.data||'').slice(0,7)===mk);
    const previous = vs.filter(v=>(v.data||'').slice(0,7) < mk);
    const unMes = month.reduce((a,v)=>a+(+v.quantidade||0),0);
    const unTotal = vs.reduce((a,v)=>a+(+v.quantidade||0),0);
    const abertoMes = month.reduce((a,v)=>a+itemOpen(v),0);
    const abertoAnterior = previous.reduce((a,v)=>a+itemOpen(v),0);
    const aberto = vs.reduce((a,v)=>a+itemOpen(v),0);
    const total = vs.reduce((a,v)=>a+(+v.valorTotal||0),0);
    const pago = vs.reduce((a,v)=>a+itemPaid(v),0);

    let statusClass = 'client-idle';
    let statusHint = 'Sem pedidos no mês';
    if(abertoAnterior > 0){
      statusClass = 'client-overdue';
      statusHint = 'Em aberto do mês anterior';
    }else if(unMes > 0 && abertoMes > 0){
      statusClass = 'client-open';
      statusHint = 'Pedido(s) em aberto no mês';
    }else if(unMes > 0){
      statusClass = 'client-paid';
      statusHint = 'Pedidos do mês 100% pagos';
    }

    return {
      ...c,
      unMes,
      unTotal,
      aberto,
      abertoMes,
      abertoAnterior,
      total,
      pago,
      ultimaCompra: vs.map(v=>v.data).filter(Boolean).sort().pop() || '',
      statusClass,
      statusHint
    };
  }).sort((a,b)=>a.nome.localeCompare(b.nome,'pt-BR'));
}

function clientTickets(nome){
  return groupTickets(activeSales().filter(v => slug(v.cliente) === slug(nome)))
    .sort((a,b)=>(b.data||'').localeCompare(a.data||''));
}
function clientTicketRow(ticket){
  const status = inferTicketStatus(ticket);
  const statusLabel = status === 'pago' ? 'Pago' : status === 'parcial' ? 'Parcial' : status === 'cancelado' ? 'Cancelado' : 'Em aberto';
  return `<div class="client-ticket ${status}">
    <div class="client-ticket-top">
      <div>
        <strong>${ticketSummaryLines(ticket)}</strong>
        <small>${dateBR(ticket.data)} • ${ticket.forma || 'A cobrar'}</small>
        ${ticket.openTotal > 0 && ticket.paidTotal > 0 ? `<small>Pago: ${brl(ticket.paidTotal)} • Falta: ${brl(ticket.openTotal)}</small>` : ''}
      </div>
      <div style="text-align:right">
        <b>${brl(ticket.total)}</b>
        <span class="tag ${status}">${statusLabel}</span>
      </div>
    </div>
    <div class="client-ticket-actions">
      ${ticket.openTotal > 0 ? `<button class="mini ghost" onclick="partialPayTicket('${ticket.ticketId}')">Baixa parcial</button>` : ''}
      ${status === 'em_aberto' || status === 'parcial' ? `<button class="mini ok" onclick="toggleTicketPaid('${ticket.ticketId}')">Marcar pago</button>` : `<button class="mini ghost" onclick="toggleTicketPaid('${ticket.ticketId}')">Reabrir</button>`}
      ${status !== 'cancelado' ? `<button class="mini ghost" onclick="editTicket('${ticket.ticketId}')">Editar</button><button class="mini danger" onclick="cancelTicket('${ticket.ticketId}')">Cancelar</button>` : ''}
    </div>
  </div>`;
}
function clientHistoryBlock(c){
  const tickets = clientTickets(c.nome);
  const openTickets = tickets.filter(t => {
    const s = inferTicketStatus(t);
    return s === 'em_aberto' || s === 'parcial';
  });
  const paidTickets = tickets.filter(t => inferTicketStatus(t) === 'pago');
  const canceledTickets = tickets.filter(t => inferTicketStatus(t) === 'cancelado');

  return `<div class="client-history client-history-clean">
    <details class="inner-drawer" ${openTickets.length ? 'open' : ''}>
      <summary>Pendências (${openTickets.length})</summary>
      <div class="client-ticket-list">
        ${openTickets.map(clientTicketRow).join('') || '<div class="empty-inline">Nada em aberto.</div>'}
      </div>
    </details>

    <details class="inner-drawer">
      <summary>Pagos (${paidTickets.length})</summary>
      <div class="client-ticket-list">
        ${paidTickets.map(clientTicketRow).join('') || '<div class="empty-inline">Nenhum pagamento.</div>'}
      </div>
    </details>

    ${canceledTickets.length ? `<details class="inner-drawer">
      <summary>Cancelados (${canceledTickets.length})</summary>
      <div class="client-ticket-list">${canceledTickets.map(clientTicketRow).join('')}</div>
    </details>` : ''}
  </div>`;
}

function clientItem(c){
  return `<details class="item client-drawer client-row clean-client-card ${c.statusClass}" data-search="${escapeHtml((c.nome+' '+(c.telefone||'')).toLowerCase())}">
    <summary class="client-drawer-summary">
      <div class="client-summary clean-client-summary">
        <div>
          <strong>${escapeHtml(c.nome)}</strong>
          <small>${c.statusHint}</small>
        </div>
        <div style="text-align:right">
          <div class="price">${brl(c.aberto)}</div>
          <small>A pagar</small>
        </div>
      </div>
    </summary>
    <div class="drawer client-drawer-body clean-client-body">
      <div class="client-quick-data">
        <span>Telefone: ${escapeHtml(c.telefone || '—')}</span>
        <span>Total: ${c.unTotal} un. • ${brl(c.total)}</span>
        <span>Pago: ${brl(c.pago)}</span>
      </div>
      <div class="row client-clean-actions">
        <button class="mini ghost" onclick="editClient('${c.id}')">Editar</button>
        <button class="mini ghost" onclick="prefillClient('${escapeHtml(c.nome)}')">Nova venda</button>
      </div>
      ${clientHistoryBlock(c)}
    </div>
  </details>`;
}
function clientFormTitle(){ return clientDraft.id ? 'Editar cliente' : 'Adicionar cliente'; }
function clientFormActionText(){ return clientDraft.id ? 'Salvar alterações' : (returnToSaleAfterClient ? 'Salvar e voltar' : 'Salvar cliente'); }
function clientes(){
  setHeader('Clientes');
  const rows = clientStats();
  const opened = clientFormOpen || returnToSaleAfterClient || clientDraft.id || clientDraft.nome;
  return `
    <h1 class="screen-title">Clientes ${helpTip("Clientes", "Branco: sem pedido no mês. Verde: pago. Amarelo: aberto no mês. Vermelho: pendência anterior.")}</h1>
    <details class="accordion" ${opened ? 'open' : ''}>
      <summary>${clientFormTitle()}</summary>
      <div class="card" style="margin:0;border:0;border-radius:0;box-shadow:none">
        <form id="clientForm">
          <input type="hidden" name="id" value="${escapeHtml(clientDraft.id)}">
          <label><span>Nome</span><input id="clientName" name="nome" required value="${escapeHtml(clientDraft.nome)}"></label>
          <label><span>Telefone</span><input name="telefone" inputmode="tel" value="${escapeHtml(clientDraft.telefone)}"></label>
          <br>
          <div class="row" style="justify-content:flex-end;flex-wrap:wrap">
            ${(opened) ? '<button type="button" class="ghost" onclick="cancelClientForm()">Cancelar</button>' : ''}
            <button>${clientFormActionText()}</button>
          </div>
        </form>
      </div>
    </details>
    <div class="client-search-card">
      <div class="search-wrap">
        <span class="search-icon">⌕</span>
        <input id="clientSearch" placeholder="Buscar por nome ou telefone" autocomplete="off">
        <button type="button" class="search-clear" onclick="clearClientSearch()" aria-label="Limpar busca">×</button>
      </div>
      <small id="clientSearchHint">${rows.length} cliente(s) em ordem alfabética</small>
    </div>
    <div class="list" id="clientsList">${rows.map(clientItem).join('') || '<div class="card empty">Nenhum cliente cadastrado.</div>'}</div>
    <div class="card empty" id="clientNoResults" style="display:none">Nenhum cliente encontrado.</div>
  `;
}


function groupedCollections(){
  const byClient = new Map();
  groupTickets(activeSales()).forEach(ticket => {
    const clientKey = slug(ticket.cliente);
    if(!byClient.has(clientKey)) {
      byClient.set(clientKey, {
        key: clientKey,
        nome: ticket.cliente,
        tickets: [],
        aberto: 0,
        pago: 0,
        total: 0,
        ticketsAbertos: 0,
        ticketsPagos: 0
      });
    }
    const client = byClient.get(clientKey);
    const status = inferTicketStatus(ticket);
    client.tickets.push(ticket);
    client.total += Number(ticket.total) || 0;
    client.aberto += Number(ticket.openTotal) || 0;
    client.pago += Number(ticket.paidTotal) || 0;
    if(status === 'pago') client.ticketsPagos += 1;
    if(status === 'em_aberto' || status === 'parcial') client.ticketsAbertos += 1;
  });

  return [...byClient.values()]
    .filter(c => c.aberto > 0)
    .sort((a,b) => (b.aberto - a.aberto) || a.nome.localeCompare(b.nome,'pt-BR'));
}

function ticketMiniCard(ticket){
  const status = inferTicketStatus(ticket);
  const statusLabel = status === 'pago' ? 'Pago' : status === 'parcial' ? 'Parcial' : status === 'cancelado' ? 'Cancelado' : 'Em aberto';
  const value = status === 'pago' ? ticket.paidTotal : (ticket.openTotal || ticket.total);
  return `
    <div class="charge-ticket ${status}">
      <div class="charge-ticket-main">
        <div>
          <strong>${ticketSummaryLines(ticket)}</strong>
          <small>${dateBR(ticket.data)} • ${ticket.forma || 'A cobrar'}</small>
          ${ticket.openTotal > 0 && ticket.paidTotal > 0 ? `<small>Pago: ${brl(ticket.paidTotal)} • Falta: ${brl(ticket.openTotal)}</small>` : ''}
        </div>
        <div class="charge-ticket-value">
          <b>${brl(value)}</b>
          <span class="tag ${status}">${statusLabel}</span>
        </div>
      </div>
      <div class="charge-actions">
        ${ticket.openTotal > 0 ? `<button class="mini ghost" onclick="partialPayTicket('${ticket.ticketId}')">Baixa parcial</button>` : ''}
        ${status === 'em_aberto' || status === 'parcial' ? `<button class="mini ok" onclick="toggleTicketPaid('${ticket.ticketId}')">Marcar pago</button>` : `<button class="mini ghost" onclick="toggleTicketPaid('${ticket.ticketId}')">Reabrir</button>`}
        ${status !== 'cancelado' ? `<button class="mini ghost" onclick="editTicket('${ticket.ticketId}')">Editar</button><button class="mini danger" onclick="cancelTicket('${ticket.ticketId}')">Cancelar</button>` : ''}
      </div>
    </div>
  `;
}


function ticketReadOnlyCard(ticket){
  const status = inferTicketStatus(ticket);
  const statusLabel = status === 'pago' ? 'Pago' : status === 'parcial' ? 'Parcial' : status === 'cancelado' ? 'Cancelado' : 'Em aberto';
  return `
    <div class="charge-ticket read-only ${status}">
      <div class="charge-ticket-main">
        <div>
          <strong>${ticketSummaryLines(ticket)}</strong>
          <small>${dateBR(ticket.data)} • ${escapeHtml(ticket.cliente)} • ${ticket.forma || 'A cobrar'}</small>
          ${ticket.openTotal > 0 && ticket.paidTotal > 0 ? `<small>Pago: ${brl(ticket.paidTotal)} • Falta: ${brl(ticket.openTotal)}</small>` : ''}
        </div>
        <div class="charge-ticket-value">
          <b>${brl(ticket.total)}</b>
          <span class="tag ${status}">${statusLabel}</span>
        </div>
      </div>
      <div class="mini-link-row">
        <button class="mini ghost" onclick="openClientByName('${escapeHtml(ticket.cliente)}')">Ver cliente</button>
        ${ticket.openTotal > 0 ? `<button class="mini ghost" onclick="setRoute('financeiro')">Receber</button>` : ''}
      </div>
    </div>
  `;
}

function clientChargeItem(group){
  const openTickets = group.tickets.filter(t => {
    const status = inferTicketStatus(t);
    return status === 'em_aberto' || status === 'parcial';
  });

  return `
    <details class="client-charge accordion">
      <summary>
        <div class="client-charge-summary">
          <div>
            <strong>${escapeHtml(group.nome)}</strong>
            <small>${group.ticketsAbertos} pendência(s)</small>
          </div>
          <div class="client-charge-total">
            <b>${brl(group.aberto)}</b>
            <span>A receber</span>
          </div>
        </div>
      </summary>

      <div class="client-charge-body">
        <div class="charge-quick-actions">
          <button class="mini ghost" onclick="copyClientCharge('${group.key}')">Copiar cobrança</button>
          <button class="mini ghost" onclick="openClientByName('${escapeHtml(group.nome)}')">Ver cliente</button>
          <button class="mini ghost" onclick="prefillClient('${escapeHtml(group.nome)}')">Nova venda</button>
        </div>

        <div class="charge-section">
          <div class="section-head compact"><h2>Pendências</h2><span>${openTickets.length}</span></div>
          <div class="charge-ticket-list">
            ${openTickets.map(ticketMiniCard).join('') || '<div class="empty-inline">Nenhum ticket em aberto.</div>'}
          </div>
        </div>
      </div>
    </details>
  `;
}

function cobrancas(){
  setHeader('Clientes a cobrar');
  const groups = groupedCollections();
  const total = groups.reduce((a,g)=>a+g.aberto,0);
  return `
    <h1 class="screen-title">A cobrar</h1>
    <div class="kpis">
      <div class="kpi wide"><small>Total em aberto</small><b>${brl(total)}</b></div>
      <div class="kpi"><small>Clientes</small><b>${groups.length}</b></div>
    </div>
    <div class="section-head"><h2>Clientes</h2><span>Toque para abrir</span></div>
    <div class="list charge-list">${groups.map(clientChargeItem).join('') || '<div class="card empty">Nada a cobrar.</div>'}</div>
    <details class="accordion" style="margin-top:12px">
      <summary>Backup, dados e manual</summary>
      <div class="card" style="margin:0;border:0;border-radius:0;box-shadow:none">
        ${firebaseLoginCard()}${appQuickManual()}
        <div class="grid">
          <button class="ghost" onclick="exportBackup()">Exportar backup</button>
          <label class="ghost upload-btn"><input type="file" id="importFile" accept="application/json" hidden>Importar backup</label>
          <button class="danger" onclick="resetBase()">Restaurar base</button>
        <small class="clean-note">Versão v10.8.2 Corrige chip sync</small>
        <details class="inner-drawer final-guide">
          <summary>Checklist de uso</summary>
          <div class="final-guide-list">
            <span>1. Cadastre ou revise os produtos do caixa.</span>
            <span>2. Lance a produção do dia.</span>
            <span>3. Venda pelo caixa rápido.</span>
            <span>4. Use Recebíveis para cobrar pendências.</span>
            <span>5. Lance gastos no Financeiro.</span>
            <span>6. Exporte backup com frequência.</span>
          </div>
        </details>
        </div>
      </div>
    </details>
  `;
}



function ticketMiniCard(ticket, showClient=true){
  const status = inferTicketStatus(ticket);
  return `<div class="ticket-mini">
    <div>
      <strong>${showClient ? escapeHtml(ticket.cliente) : ticketSummaryLines(ticket)}</strong>
      <small>${showClient ? ticketSummaryLines(ticket) : escapeHtml(ticket.cliente)} • ${dateBR(ticket.data)}</small>
    </div>
    <div style="text-align:right">
      <b>${brl(ticket.total)}</b>
      <span class="tag ${status}">${status==='pago'?'Pago':status==='cancelado'?'Cancelado':status==='parcial'?'Parcial':'Em aberto'}</span>
    </div>
  </div>`;
}
function ticketsStats(tickets){
  return tickets.reduce((a,t)=>{
    if(inferTicketStatus(t)==='cancelado') return a;
    a.tickets += 1;
    a.un += t.itens.reduce((s,it)=>s+(Number(it.quantidade)||0),0);
    a.vendido += Number(t.total)||0;
    a.recebido += Number(t.paidTotal)||0;
    a.aberto += Number(t.openTotal)||0;
    return a;
  }, {tickets:0, un:0, vendido:0, recebido:0, aberto:0});
}
function reportDrawer(title, subtitle, tickets, open=false){
  const st = ticketsStats(tickets);
  return `<details class="report-drawer" ${open?'open':''}>
    <summary>
      <div>
        <strong>${title}</strong>
        <small>${subtitle}</small>
      </div>
      <div class="drawer-total">
        <b>${brl(st.vendido)}</b>
        <span>${st.tickets} venda(s)</span>
      </div>
    </summary>
    <div class="drawer-content">
      <div class="mini-kpis">
        <div><small>Unidades</small><b>${st.un}</b></div>
        <div><small>Recebido</small><b>${brl(st.recebido)}</b></div>
        <div><small>Aberto</small><b>${brl(st.aberto)}</b></div>
      </div>
      <div class="list compact-list">${tickets.length ? tickets.map(t=>ticketMiniCard(t,true)).join('') : '<div class="empty-inline">Nenhuma venda neste período.</div>'}</div>
    </div>
  </details>`;
}
function monthLabel(){
  return new Date(today()+'T12:00:00').toLocaleDateString('pt-BR',{month:'long', year:'numeric'});
}


function monthTitle(monthKey){
  return new Date(monthKey+'-02T12:00:00').toLocaleDateString('pt-BR',{month:'long', year:'numeric'});
}
function gastoPorMes(monthKey){
  return (state.gastos||[]).filter(g => (g.data||'').slice(0,7) === monthKey).reduce((a,g)=>a+(Number(g.valor)||0),0);
}
function monthKeys(){
  const keys = new Set();
  activeSales().forEach(v => { if(v.data) keys.add(v.data.slice(0,7)); });
  (state.gastos||[]).forEach(g => { if(g.data) keys.add(g.data.slice(0,7)); });
  keys.add(today().slice(0,7));
  return [...keys].sort((a,b)=>b.localeCompare(a));
}

function summarizeTicketsByClient(tickets){
  const map = new Map();
  tickets.forEach(t => {
    const key = slug(t.cliente);
    if(!map.has(key)) map.set(key,{nome:t.cliente, tickets:0, unidades:0, vendido:0, recebido:0, aberto:0});
    const g = map.get(key);
    g.tickets += 1;
    g.unidades += t.itens.reduce((s,it)=>s+(Number(it.quantidade)||0),0);
    g.vendido += Number(t.total)||0;
    g.recebido += Number(t.paidTotal)||0;
    g.aberto += Number(t.openTotal)||0;
  });
  return [...map.values()].sort((a,b)=>(b.vendido-a.vendido)||a.nome.localeCompare(b.nome,'pt-BR'));
}
function summarizeTicketsByDay(tickets){
  const map = new Map();
  tickets.forEach(t => {
    const key = t.data || '';
    if(!map.has(key)) map.set(key,{data:key, tickets:0, unidades:0, vendido:0, recebido:0, aberto:0});
    const g = map.get(key);
    g.tickets += 1;
    g.unidades += t.itens.reduce((s,it)=>s+(Number(it.quantidade)||0),0);
    g.vendido += Number(t.total)||0;
    g.recebido += Number(t.paidTotal)||0;
    g.aberto += Number(t.openTotal)||0;
  });
  return [...map.values()].sort((a,b)=>b.data.localeCompare(a.data));
}

function summarizeTicketsByProduct(tickets){
  const map = new Map();
  tickets.forEach(t => {
    (t.itens||[]).filter(it => it.statusPagamento !== 'cancelado').forEach(it => {
      const nome = it.produto || 'Produto';
      if(!map.has(nome)) map.set(nome,{nome, unidades:0, vendido:0});
      const g = map.get(nome);
      const qtd = Number(it.quantidade)||0;
      const unit = productPrice(nome) || 0;
      g.unidades += qtd;
      g.vendido += qtd * unit;
    });
  });
  return [...map.values()].sort((a,b)=>b.unidades-a.unidades || b.vendido-a.vendido || a.nome.localeCompare(b.nome,'pt-BR'));
}
function topLabel(rows, mainKey, fallback='Sem dados'){
  if(!rows || !rows.length) return fallback;
  const r = rows[0];
  if(r.nome) return `${r.nome} • ${mainKey==='unidades' ? r.unidades+' un.' : brl(r[mainKey]||0)}`;
  if(r.data) return `${dateBR(r.data)} • ${r.unidades} un.`;
  return fallback;
}
function reportMetric(label, value, hint=''){
  return `<div class="report-metric"><small>${label}</small><b>${value}</b>${hint ? `<span>${hint}</span>` : ''}</div>`;
}

function monthlyViewBySale(tickets){
  return `<div class="list compact-list">${tickets.length ? tickets.map(t=>ticketReadOnlyCard(t)).join('') : '<div class="empty-inline">Nenhuma venda neste mês.</div>'}</div>`;
}
function monthlyViewByClient(tickets){
  const rows = summarizeTicketsByClient(tickets);
  return `<div class="list compact-list">${rows.length ? rows.map(r=>`<div class="monthly-row">
    <div>
      <strong>${escapeHtml(r.nome)}</strong>
      <small>${r.tickets} venda(s) • ${r.unidades} un.</small>
    </div>
    <div style="text-align:right">
      <b>${brl(r.vendido)}</b>
      <small>recebido ${brl(r.recebido)}${r.aberto ? ` • aberto ${brl(r.aberto)}` : ''}</small>
    </div>
  </div>`).join('') : '<div class="empty-inline">Nenhum cliente neste mês.</div>'}</div>`;
}
function monthlyViewByDay(tickets){
  const rows = summarizeTicketsByDay(tickets);
  return `<div class="list compact-list">${rows.length ? rows.map(r=>`<div class="monthly-row">
    <div>
      <strong>${dateBR(r.data)}</strong>
      <small>${r.tickets} venda(s) • ${r.unidades} un.</small>
    </div>
    <div style="text-align:right">
      <b>${brl(r.vendido)}</b>
      <small>recebido ${brl(r.recebido)}${r.aberto ? ` • aberto ${brl(r.aberto)}` : ''}</small>
    </div>
  </div>`).join('') : '<div class="empty-inline">Nenhuma venda neste mês.</div>'}</div>`;
}
function monthlySwitch(monthKey, tickets){
  const id = 'mv_' + monthKey.replace(/[^0-9]/g,'');
  return `<details class="inner-drawer monthly-view-drawer">
    <summary>Ver vendas do mês</summary>
    <div class="monthly-switch" data-month="${monthKey}">
      <input id="${id}_venda" name="${id}" type="radio" checked>
      <label for="${id}_venda" onclick="setMonthlyView('${monthKey}','venda')">Vendas</label>
      <input id="${id}_cliente" name="${id}" type="radio">
      <label for="${id}_cliente" onclick="setMonthlyView('${monthKey}','cliente')">Clientes</label>
      <input id="${id}_dia" name="${id}" type="radio">
      <label for="${id}_dia" onclick="setMonthlyView('${monthKey}','dia')">Dias</label>
      <span></span>
    </div>
    <div class="monthly-view-panel" id="monthlyView_${monthKey}">
      ${monthlyViewBySale(tickets)}
    </div>
    <template id="monthlySale_${monthKey}">${monthlyViewBySale(tickets)}</template>
    <template id="monthlyClient_${monthKey}">${monthlyViewByClient(tickets)}</template>
    <template id="monthlyDay_${monthKey}">${monthlyViewByDay(tickets)}</template>
  </details>`;
}


function financeMonthDrawer(monthKey, open=false){
  const tickets = groupTickets(state.vendas.filter(v => (v.data||'').slice(0,7) === monthKey));
  const st = ticketsStats(tickets);
  const gastos = gastoPorMes(monthKey);
  const saldo = st.recebido - gastos;
  return `<details class="month-drawer" ${open?'open':''}>
    <summary>
      <div>
        <strong>${monthTitle(monthKey)}</strong>
        <small>${st.tickets} venda(s) • ${st.un} un.</small>
      </div>
      <div class="month-total">
        <b>${brl(st.recebido)}</b>
        <span>recebido</span>
      </div>
    </summary>
    <div class="drawer-content">
      <div class="mini-kpis month-kpis">
        <div><small>Vendido</small><b>${brl(st.vendido)}</b></div>
        <div><small>Recebido</small><b>${brl(st.recebido)}</b></div>
        <div><small>A receber</small><b>${brl(st.aberto)}</b></div>
        <div><small>Gastos</small><b>${brl(gastos)}</b></div>
        <div><small>Saldo</small><b>${brl(saldo)}</b></div>
        <div><small>Tickets</small><b>${st.tickets}</b></div>
      </div>
      ${monthlySwitch(monthKey, tickets)}
      <div class="mini-link-row"><button class="mini ghost" onclick="copyMonthSummary('${monthKey}')">Copiar resumo</button></div>
    </div>
  </details>`;
}


function vendasHojeBlock(todayTickets, todayStats){
  return `<details class="finance-day-drawer accordion sales-drawer" open>
    <summary>
      <div>
        <strong>Vendas do dia</strong>
        <small>${dateBR(today())} • ${todayStats.tickets} venda(s) • ${todayStats.un} un.</small>
      </div>
      <div class="money-summary-value">
        <b>${brl(todayStats.vendido)}</b>
        <span>hoje</span>
      </div>
    </summary>
    <div class="card" style="margin:0;border:0;border-radius:0;box-shadow:none">
      <div class="today-kpis">
        <div><small>Recebido</small><b>${brl(todayStats.recebido)}</b></div>
        <div><small>A receber</small><b>${brl(todayStats.aberto)}</b></div>
        <div><small>Unidades</small><b>${todayStats.un}</b></div>
      </div>
      <div class="list charge-list">${todayTickets.length ? todayTickets.map(ticketReadOnlyCard).join('') : '<div class="empty-inline">Nenhuma venda lançada hoje.</div>'}</div>
    </div>
  </details>`;
}

function dinheiroReceberBlock(){
  const groups = groupedCollections();
  const total = groups.reduce((a,g)=>a+g.aberto,0);
  return `<details class="money-drawer accordion receive-drawer" ${groups.length ? 'open' : ''}>
    <summary>
      <div>
        <strong>Precisa receber</strong>
        <small>${groups.length} cliente(s) com pendência</small>
      </div>
      <div class="money-summary-value">
        <b>${brl(total)}</b>
        <span>a receber</span>
      </div>
    </summary>
    <div class="card" style="margin:0;border:0;border-radius:0;box-shadow:none">
      <div class="list charge-list">${groups.map(clientChargeItem).join('') || '<div class="empty-inline">Nada a cobrar.</div>'}</div>
    </div>
  </details>`;
}
function dinheiroDadosBlock(){
  return `<details class="accordion" style="margin-top:12px">
    <summary>Dados do app</summary>
    <div class="card" style="margin:0;border:0;border-radius:0;box-shadow:none">
      <div class="grid">
        <button class="ghost" onclick="exportBackup()">Exportar backup</button>
        <label class="ghost upload-btn"><input type="file" id="importFile" accept="application/json" hidden>Importar backup</label>
        <button class="danger" onclick="resetBase()">Restaurar base</button>
        <small class="clean-note">Versão v10.8.2 Corrige chip sync</small>
        <details class="inner-drawer final-guide">
          <summary>Checklist de uso</summary>
          <div class="final-guide-list">
            <span>1. Cadastre ou revise os produtos do caixa.</span>
            <span>2. Lance a produção do dia.</span>
            <span>3. Venda pelo caixa rápido.</span>
            <span>4. Use Recebíveis para cobrar pendências.</span>
            <span>5. Lance gastos no Financeiro.</span>
            <span>6. Exporte backup com frequência.</span>
          </div>
        </details>
      </div>
    </div>
  </details>`;
}

const EXPENSE_CATEGORIES = ['Ingredientes','Embalagens','Transporte','Equipamentos','Marketing','Outros'];

function gastosDoMes(monthKey){
  return (state.gastos||[])
    .filter(g => (g.data||'').slice(0,7) === monthKey)
    .slice()
    .sort((a,b)=>(b.data||'').localeCompare(a.data||''));
}
function gastosPorCategoria(gastos){
  const map = new Map();
  gastos.forEach(g => {
    const cat = g.categoria || 'Outros';
    map.set(cat, (map.get(cat)||0) + (Number(g.valor)||0));
  });
  return [...map.entries()].sort((a,b)=>b[1]-a[1]);
}
function expenseFormBlock(){
  const editing = !!expenseDraft.id;
  return `<details class="accordion expense-accordion" ${editing ? 'open' : ''}>
    <summary>${editing ? 'Editar gasto' : 'Adicionar gasto'}</summary>
    <div class="card" style="margin:0;border:0;border-radius:0;box-shadow:none">
      <form id="expenseForm">
        <input type="hidden" name="id" value="${escapeHtml(expenseDraft.id)}">
        <div class="grid grid2">
          <label><span>Data</span><input name="data" type="date" value="${expenseDraft.data || today()}"></label>
          <label><span>Valor</span><input name="valor" type="number" step="0.01" inputmode="decimal" required value="${escapeHtml(expenseDraft.valor)}"></label>
        </div>
        <label><span>Categoria</span><select name="categoria">${EXPENSE_CATEGORIES.map(c=>`<option ${expenseDraft.categoria===c?'selected':''}>${c}</option>`).join('')}</select></label>
        <label><span>Descrição</span><input name="descricao" placeholder="Ex.: leite condensado, embalagem..." value="${escapeHtml(expenseDraft.descricao)}"></label>
        <br>
        <div class="row" style="justify-content:flex-end;flex-wrap:wrap">
          ${editing ? '<button type="button" class="ghost" onclick="cancelExpenseEdit()">Cancelar</button>' : ''}
          <button class="full">${editing ? 'Salvar alteração' : 'Salvar gasto'}</button>
        </div>
      </form>
    </div>
  </details>`;
}
function expenseRow(g){
  return `<div class="expense-row">
    <div>
      <strong>${escapeHtml(g.descricao || 'Gasto')}</strong>
      <small>${dateBR(g.data)} • ${escapeHtml(g.categoria || 'Outros')}</small>
    </div>
    <div style="text-align:right">
      <b>${brl(g.valor)}</b>
      <button class="mini ghost" onclick="editExpense('${g.id}')">Editar</button>
      <button class="mini danger" onclick="deleteExpense('${g.id}')">Excluir</button>
    </div>
  </div>`;
}

function gastoMonthKeys(){
  const keys = new Set();
  (state.gastos||[]).forEach(g => { if(g.data) keys.add(g.data.slice(0,7)); });
  keys.add(today().slice(0,7));
  return [...keys].sort((a,b)=>b.localeCompare(a));
}
function expenseMonthDrawer(monthKey, open=false){
  const gastos = gastosDoMes(monthKey);
  const total = gastos.reduce((a,g)=>a+(Number(g.valor)||0),0);
  const cats = gastosPorCategoria(gastos);
  return `<details class="expense-month-drawer" ${open?'open':''}>
    <summary>
      <div>
        <strong>${monthTitle(monthKey)}</strong>
        <small>${gastos.length} lançamento(s)</small>
      </div>
      <div class="month-total">
        <b>${brl(total)}</b>
        <span>gastos</span>
      </div>
    </summary>
    <div class="drawer-content">
      <div class="expense-cats compact-cats">
        ${cats.length ? cats.map(([cat,val])=>`<div><small>${escapeHtml(cat)}</small><b>${brl(val)}</b></div>`).join('') : '<div class="empty-inline">Nenhum gasto neste mês.</div>'}
      </div>
      <div class="section-head compact"><h2>Lançamentos</h2><span>${gastos.length}</span></div>
      <div class="expense-list">${gastos.map(expenseRow).join('') || '<div class="empty-inline">Nenhum gasto lançado.</div>'}</div>
    </div>
  </details>`;
}
function expenseHistoryBlock(){
  const keys = gastoMonthKeys();
  const totalGeral = (state.gastos||[]).reduce((a,g)=>a+(Number(g.valor)||0),0);
  return `<details class="accordion expense-history">
    <summary>
      <div>
        <strong>Histórico de gastos</strong>
        <small>${(state.gastos||[]).length} lançamento(s) no total</small>
      </div>
      <div class="money-summary-value">
        <b>${brl(totalGeral)}</b>
        <span>total</span>
      </div>
    </summary>
    <div class="card" style="margin:0;border:0;border-radius:0;box-shadow:none">
      <div class="list">${keys.map((k,i)=>expenseMonthDrawer(k, i===0)).join('')}</div>
    </div>
  </details>`;
}

function gastosControlBlock(monthKey){
  const gastos = gastosDoMes(monthKey);
  const total = gastos.reduce((a,g)=>a+(Number(g.valor)||0),0);
  const cats = gastosPorCategoria(gastos);
  return `<details class="accordion expense-control expense-drawer" open>
    <summary>
      <div>
        <strong>Controle de gastos</strong>
        <small>${gastos.length} lançamento(s) este mês</small>
      </div>
      <div class="money-summary-value">
        <b>${brl(total)}</b>
        <span>mês atual</span>
      </div>
    </summary>
    <div class="card" style="margin:0;border:0;border-radius:0;box-shadow:none">
      ${expenseFormBlock()}

      <div class="section-head compact"><h2>Resumo deste mês</h2><span>${cats.length} categoria(s)</span></div>
      <div class="expense-cats">
        ${cats.length ? cats.map(([cat,val])=>`<div><small>${escapeHtml(cat)}</small><b>${brl(val)}</b></div>`).join('') : '<div class="empty-inline">Nenhum gasto lançado neste mês.</div>'}
      </div>

      <details class="inner-drawer expense-current-list">
        <summary>Lançamentos deste mês (${gastos.length})</summary>
        <div class="expense-list">${gastos.map(expenseRow).join('') || '<div class="empty-inline">Nenhum gasto lançado.</div>'}</div>
      </details>

      ${expenseHistoryBlock(false)}
    </div>
  </details>`;
}

function gastoMonthKeys(){
  const keys = new Set();
  (state.gastos||[]).forEach(g => { if(g.data) keys.add(g.data.slice(0,7)); });
  keys.add(today().slice(0,7));
  return [...keys].sort((a,b)=>b.localeCompare(a));
}
function expenseMonthDrawer(monthKey, open=false){
  const gastos = gastosDoMes(monthKey);
  const total = gastos.reduce((a,g)=>a+(Number(g.valor)||0),0);
  const cats = gastosPorCategoria(gastos);
  return `<details class="expense-month-drawer" ${open?'open':''}>
    <summary>
      <div>
        <strong>${monthTitle(monthKey)}</strong>
        <small>${gastos.length} lançamento(s)</small>
      </div>
      <div class="month-total">
        <b>${brl(total)}</b>
        <span>gastos</span>
      </div>
    </summary>
    <div class="drawer-content">
      <div class="expense-cats compact-cats">
        ${cats.length ? cats.map(([cat,val])=>`<div><small>${escapeHtml(cat)}</small><b>${brl(val)}</b></div>`).join('') : '<div class="empty-inline">Nenhum gasto neste mês.</div>'}
      </div>
      <div class="section-head compact"><h2>Lançamentos</h2><span>${gastos.length}</span></div>
      <div class="expense-list">${gastos.map(expenseRow).join('') || '<div class="empty-inline">Nenhum gasto lançado.</div>'}</div>
    </div>
  </details>`;
}
function expenseHistoryBlock(showSummary=true){
  const keys = gastoMonthKeys();
  const totalGeral = (state.gastos||[]).reduce((a,g)=>a+(Number(g.valor)||0),0);
  return `<details class="accordion expense-history compact-history">
    <summary>
      <div>
        <strong>Histórico</strong>
        <small>${(state.gastos||[]).length} lançamento(s) no total</small>
      </div>
      ${showSummary ? `<div class="money-summary-value"><b>${brl(totalGeral)}</b><span>total</span></div>` : ''}
    </summary>
    <div class="card" style="margin:0;border:0;border-radius:0;box-shadow:none">
      <div class="list">${keys.map((k,i)=>expenseMonthDrawer(k, false)).join('')}</div>
    </div>
  </details>`;
}

function normalizeForma(f){
  f = String(f||'').toLowerCase();
  if(f.includes('pix')) return 'Pix';
  if(f.includes('deb')) return 'Débito';
  if(f.includes('cred') || f.includes('créd')) return 'Crédito';
  if(f.includes('cart')) return 'Débito/Crédito';
  if(f.includes('din')) return 'Dinheiro';
  return 'Não informado';
}
function contasDoMes(monthKey){
  return (state.contas||[]).filter(m => (m.data||'').slice(0,7) === monthKey).slice().sort((a,b)=>(b.data||'').localeCompare(a.data||''));
}
function salesPaidByForma(monthKey){
  const map = new Map();
  activeSales().filter(v => (v.data||'').slice(0,7) === monthKey).forEach(v => {
    const paid = itemPaid(v);
    if(paid <= 0) return;
    const forma = normalizeForma(v.formaPagamento);
    map.set(forma, (map.get(forma)||0) + paid);
  });
  return map;
}
function manualByForma(monthKey){
  const map = new Map();
  contasDoMes(monthKey).forEach(m => {
    const forma = normalizeForma(m.forma);
    const val = Number(m.valor)||0;
    map.set(forma, (map.get(forma)||0) + (m.tipo === 'saida' ? -val : val));
  });
  return map;
}
function contaTotalForma(forma, monthKey){
  return (salesPaidByForma(monthKey).get(forma)||0) + (manualByForma(monthKey).get(forma)||0);
}
function ticketsByPaymentMethod(monthKey, forma){
  return groupTickets(
    activeSales().filter(v =>
      (v.data||'').slice(0,7) === monthKey &&
      normalizeForma(v.formaPagamento) === forma &&
      itemPaid(v) > 0
    )
  );
}
function paymentGroupsByClient(monthKey, forma){
  const map = new Map();
  ticketsByPaymentMethod(monthKey, forma).forEach(t => {
    const key = slug(t.cliente);
    if(!map.has(key)) map.set(key, { nome:t.cliente, tickets:[], totalPago:0, unidades:0 });
    const g = map.get(key);
    g.tickets.push(t);
    g.totalPago += Number(t.paidTotal)||0;
    g.unidades += (t.itens||[]).filter(it=>it.statusPagamento!=='cancelado').reduce((s,it)=>s+(Number(it.quantidade)||0),0);
  });
  return [...map.values()]
    .map(g => ({...g, tickets:g.tickets.sort((a,b)=>(b.data||'').localeCompare(a.data||''))}))
    .sort((a,b)=>a.nome.localeCompare(b.nome,'pt-BR'));
}
function paymentTicketCard(ticket){
  const status = inferTicketStatus(ticket);
  const statusLabel = status === 'pago' ? 'Pago' : status === 'parcial' ? 'Parcial' : status === 'cancelado' ? 'Cancelado' : 'Em aberto';
  return `<div class="charge-ticket read-only ${status}">
    <div class="charge-ticket-main">
      <div>
        <strong>${ticketSummaryLines(ticket)}</strong>
        <small>${dateBR(ticket.data)} • ${ticket.forma || 'Não informado'}</small>
        ${ticket.openTotal > 0 && ticket.paidTotal > 0 ? `<small>Pago: ${brl(ticket.paidTotal)} • Falta: ${brl(ticket.openTotal)}</small>` : ''}
      </div>
      <div class="charge-ticket-value">
        <b>${brl(ticket.paidTotal || ticket.total)}</b>
        <span class="tag ${status}">${statusLabel}</span>
      </div>
    </div>
  </div>`;
}
function paymentMethodBlock(forma, monthKey){
  const total = contaTotalForma(forma, monthKey);
  const groups = paymentGroupsByClient(monthKey, forma);
  return `<details class="payment-method-drawer account-card">
    <summary>
      <div>
        <small>${forma}</small>
        <b>${brl(total)}</b>
        <span>vendas + ajustes</span>
      </div>
    </summary>
    <div class="payment-method-body">
      ${groups.length ? groups.map(g=>`<details class="payment-client-drawer inner-drawer">
        <summary>
          <div>
            <strong>${escapeHtml(g.nome)}</strong>
            <small>${g.tickets.length} ticket(s) • ${g.unidades} un.</small>
          </div>
          <div style="text-align:right">
            <b>${brl(g.totalPago)}</b>
            <small>recebido</small>
          </div>
        </summary>
        <div class="payment-client-body">
          <div class="client-ticket-list">${g.tickets.map(paymentTicketCard).join('')}</div>
        </div>
      </details>`).join('') : '<div class="empty-inline">Nenhum recebimento nesta forma neste mês.</div>'}
    </div>
  </details>`;
}
function accountMoveRow(m){
  return `<div class="account-move ${m.tipo}">
    <div><strong>${escapeHtml(m.descricao || 'Movimentação')}</strong><small>${dateBR(m.data)} • ${escapeHtml(m.forma)} • ${m.tipo === 'saida' ? 'Saída' : 'Entrada'}</small></div>
    <div style="text-align:right"><b>${m.tipo === 'saida' ? '-' : '+'}${brl(m.valor)}</b><button class="mini ghost" onclick="editAccountMove('${m.id}')">Editar</button><button class="mini danger" onclick="deleteAccountMove('${m.id}')">Excluir</button></div>
  </div>`;
}
function contasFinanceiroBlock(monthKey){
  const formas = ['Pix','Débito','Crédito','Dinheiro'];
  const movimentos = contasDoMes(monthKey);
  const entradaManual = movimentos.filter(m=>m.tipo==='entrada').reduce((a,m)=>a+(Number(m.valor)||0),0);
  const saidaManual = movimentos.filter(m=>m.tipo==='saida').reduce((a,m)=>a+(Number(m.valor)||0),0);
  const totalPagamentos = formas.reduce((a,f)=>a+contaTotalForma(f, monthKey),0);
  return `<section class="finance-area accounts-area compact-area">
    <details class="accordion payments-drawer">
      <summary>
        <div class="finance-area-title clean-title">
          <strong><span class="area-icon">◒</span> Pagamentos ${helpTip("Pagamentos", "Mostra o que já foi recebido por Pix, Débito, Crédito ou Dinheiro, separado por cliente e ticket.")}</strong>
          <span>formas recebidas no mês</span>
        </div>
        <div class="money-summary-value">
          <b>${brl(totalPagamentos)}</b>
          <span>recebido</span>
        </div>
      </summary>
      <div class="card" style="margin:0;border:0;border-radius:0;box-shadow:none">
        <div class="payment-method-list">${formas.map(f=>paymentMethodBlock(f, monthKey)).join('')}</div>
        <details class="accordion" style="margin-top:12px">
          <summary>Ajustes manuais</summary>
          <div class="card" style="margin:0;border:0;border-radius:0;box-shadow:none">
            <div class="mini-kpis">
              <div><small>Entradas</small><b>${brl(entradaManual)}</b></div>
              <div><small>Saídas</small><b>${brl(saidaManual)}</b></div>
              <div><small>Saldo ajustes</small><b>${brl(entradaManual-saidaManual)}</b></div>
            </div>
            <form id="accountForm" style="margin-top:12px">
              <input type="hidden" name="id" value="${escapeHtml(accountDraft.id)}">
              <div class="grid grid2">
                <label><span>Data</span><input name="data" type="date" value="${accountDraft.data || today()}"></label>
                <label><span>Tipo</span><select name="tipo"><option value="entrada" ${accountDraft.tipo==='entrada'?'selected':''}>Entrada</option><option value="saida" ${accountDraft.tipo==='saida'?'selected':''}>Saída</option></select></label>
                <label><span>Conta/Forma</span><select name="forma">${formas.map(f=>`<option ${accountDraft.forma===f?'selected':''}>${f}</option>`).join('')}</select></label>
                <label><span>Valor</span><input name="valor" type="number" step="0.01" inputmode="decimal" required value="${escapeHtml(accountDraft.valor)}"></label>
              </div>
              <label><span>Descrição</span><input name="descricao" placeholder="Ex.: taxa, transferência, ajuste..." value="${escapeHtml(accountDraft.descricao)}"></label>
              <br>
              <div class="row" style="justify-content:flex-end;flex-wrap:wrap">
                ${accountDraft.id ? '<button type="button" class="ghost" onclick="cancelAccountEdit()">Cancelar</button>' : ''}
                <button class="full">${accountDraft.id ? 'Salvar alteração' : 'Salvar ajuste'}</button>
              </div>
            </form>
            <div class="section-head compact"><h2>Ajustes do mês</h2><span>${movimentos.length}</span></div>
            <div class="account-moves">${movimentos.map(accountMoveRow).join('') || '<div class="empty-inline">Nenhum ajuste manual lançado.</div>'}</div>
          </div>
        </details>
      </div>
    </details>
  </section>`;
}


function csvEscape(v){
  v = String(v ?? '');
  return /[;"\n]/.test(v) ? `"${v.replace(/"/g,'""')}"` : v;
}
function downloadText(filename, content, type='text/plain'){
  const blob = new Blob([content], {type});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
}
function monthTickets(monthKey){
  return groupTickets(activeSales().filter(v => (v.data||'').slice(0,7) === monthKey));
}
function monthReportData(monthKey){
  const tickets = monthTickets(monthKey);
  const st = ticketsStats(tickets);
  const gastos = gastoPorMes(monthKey);
  const saldo = st.recebido - gastos;
  const byClient = summarizeTicketsByClient(tickets);
  const byDay = summarizeTicketsByDay(tickets);
  const byProduct = summarizeTicketsByProduct(tickets);
  return { tickets, st, gastos, saldo, byClient, byDay, byProduct };
}
function bestDayLabel(rows){
  if(!rows.length) return 'Sem vendas';
  const best = rows.slice().sort((a,b)=>b.unidades-a.unidades || b.vendido-a.vendido)[0];
  return `${dateBR(best.data)} • ${best.unidades} un.`;
}
function reportsBlock(){
  const keys = monthKeys();
  const current = today().slice(0,7);
  const currentData = monthReportData(current);
  return `<section class="finance-area reports-area">
    <details class="accordion reports-drawer">
      <summary>
        <div class="finance-area-title clean-title">
          <strong><span class="area-icon">◈</span> Relatórios ${helpTip("Relatórios", "Use para ver o mês por produto, por dia e por cliente. O relatório por dia funciona como fechamento diário.")}</strong>
          <span>controle mensal</span>
        </div>
        <div class="money-summary-value">
          <b>${brl(currentData.st.vendido)}</b>
          <span>mês atual</span>
        </div>
      </summary>
      <div class="card" style="margin:0;border:0;border-radius:0;box-shadow:none">
        <div class="section-head compact report-section-title"><h2>Meses</h2><span>${keys.length}</span></div>
        <div class="list report-month-list">${keys.map((k,i)=>reportMonthDrawer(k, i===0)).join('')}</div>
      </div>
    </details>
  </section>`;
}


function monthlyControlProductRows(tickets){
  const rows = summarizeTicketsByProduct(tickets);
  return `<div class="list compact-list">${rows.length ? rows.map(r=>`<div class="monthly-row control-row">
    <div>
      <strong>${escapeHtml(r.nome)}</strong>
      <small>${r.unidades} un. vendidas</small>
    </div>
    <div style="text-align:right">
      <b>${brl(r.vendido)}</b>
      <small>total vendido</small>
    </div>
  </div>`).join('') : '<div class="empty-inline">Nenhum produto vendido neste mês.</div>'}</div>`;
}

function ticketsForDay(tickets, data){
  return tickets.filter(t => t.data === data);
}
function daySalesByClient(tickets, data){
  const dayTickets = ticketsForDay(tickets, data);
  const clients = summarizeTicketsByClient(dayTickets);
  if(!clients.length) return '<div class="empty-inline">Nenhuma venda neste dia.</div>';
  return clients.map(c=>{
    const list = dayTickets.filter(t => slug(t.cliente) === slug(c.nome));
    return `<details class="inner-drawer day-client-drawer">
      <summary>
        <div><strong>${escapeHtml(c.nome)}</strong><small>${c.tickets} venda(s) • ${c.unidades} un.</small></div>
        <div class="month-total"><b>${brl(c.vendido)}</b><span>vendido</span></div>
      </summary>
      <div class="client-ticket-list">${list.map(ticketReadOnlyCard).join('')}</div>
    </details>`;
  }).join('');
}

function monthlyControlDayRows(tickets){
  const rows = summarizeTicketsByDay(tickets);
  return `<div class="list compact-list">${rows.length ? rows.map(r=>`<details class="monthly-row control-row day-report-row">
    <summary>
      <div>
        <strong>${dateBR(r.data)}</strong>
        <small>${r.tickets} venda(s) • ${r.unidades} un.</small>
      </div>
      <div style="text-align:right">
        <b>${brl(r.vendido)}</b>
        <small>${r.aberto ? 'a receber '+brl(r.aberto) : 'recebido '+brl(r.recebido)}</small>
      </div>
    </summary>
    <div class="day-sales-detail">
      ${daySalesByClient(tickets, r.data)}
    </div>
  </details>`).join('') : '<div class="empty-inline">Nenhuma venda neste mês.</div>'}</div>`;
}
function monthlyControlClientRows(tickets){
  const rows = summarizeTicketsByClient(tickets).sort((a,b)=>a.nome.localeCompare(b.nome,'pt-BR'));
  if(!rows.length) return '<div class="empty-inline">Nenhum cliente neste mês.</div>';
  return `<div class="report-client-list">${rows.map(r=>{
    const clientTickets = tickets
      .filter(t=>slug(t.cliente)===slug(r.nome))
      .sort((a,b)=>(b.data||'').localeCompare(a.data||''));
    return `<details class="inner-drawer report-client-drawer">
      <summary>
        <div>
          <strong>${escapeHtml(r.nome)}</strong>
          <small>${r.tickets} venda(s) • ${r.unidades} un.</small>
        </div>
        <div style="text-align:right">
          <b>${brl(r.vendido)}</b>
          <small>${r.aberto ? 'a receber '+brl(r.aberto) : 'recebido '+brl(r.recebido)}</small>
        </div>
      </summary>
      <div class="report-client-body">
        <div class="mini-link-row report-client-actions">
          <button class="mini ghost" onclick="openClientByName('${escapeHtml(r.nome)}')">Abrir cliente</button>
        </div>
        <div class="client-ticket-list">${clientTickets.map(ticketReadOnlyCard).join('')}</div>
      </div>
    </details>`;
  }).join('')}</div>`;
}
function monthlyTicketsByClient(tickets){
  const rows = summarizeTicketsByClient(tickets);
  if(!rows.length) return '<div class="empty-inline">Nenhuma venda por cliente neste mês.</div>';
  return rows.map(c=>{
    const clientTickets = tickets.filter(t=>slug(t.cliente)===slug(c.nome));
    return `<details class="inner-drawer client-sales-month">
      <summary>${escapeHtml(c.nome)} — ${c.unidades} un. • ${brl(c.vendido)}</summary>
      <div class="client-ticket-list">${clientTickets.map(ticketReadOnlyCard).join('')}</div>
    </details>`;
  }).join('');
}
function monthlyControlBlock(title, subtitle, html, open=false){
  const priority = String(title||'').includes('Relatório diário') ? ' month-section-priority' : '';
  return `<details class="inner-drawer monthly-control-block${priority}" ${open?'open':''}>
    <summary>
      <div>
        <strong>${title}</strong>
        <small>${subtitle}</small>
      </div>
    </summary>
    ${html}
  </details>`;
}

function reportMonthDrawer(monthKey, open=false){
  const r = monthReportData(monthKey);
  const ticketMedio = r.st.tickets ? r.st.vendido / r.st.tickets : 0;
  const unPorTicket = r.st.tickets ? r.st.un / r.st.tickets : 0;
  const recebimentoPct = r.st.vendido ? (r.st.recebido / r.st.vendido) * 100 : 0;
  return `<details class="report-month-drawer clean-report-month control-report-month" ${open?'open':''}>
    <summary>
      <div>
        <strong>${monthTitle(monthKey)}</strong>
        <small>${r.st.un} tortinha(s) • ${r.st.tickets} venda(s) • ${brl(ticketMedio)} ticket médio</small>
      </div>
      <div class="month-total">
        <b>${brl(r.st.vendido)}</b>
        <span>vendido</span>
      </div>
    </summary>
    <div class="drawer-content">
      <div class="executive-report monthly-control-summary">
        ${reportMetric('Tortinhas vendidas', r.st.un, `${r.st.tickets} venda(s)`)}
        ${reportMetric('Vendido', brl(r.st.vendido), `${brl(ticketMedio)} por venda`)}
        ${reportMetric('Recebido', brl(r.st.recebido), `${recebimentoPct.toFixed(0)}% recebido`)}
        ${reportMetric('A receber', brl(r.st.aberto), r.st.aberto ? 'pendente' : 'em dia')}
        ${reportMetric('Gastos', brl(r.gastos), 'saídas do mês')}
        ${reportMetric('Saldo', brl(r.saldo), 'recebido - gastos')}
      </div>

      ${monthlyControlBlock('Relatório diário ' + helpTip('Relatório diário', 'Abra uma data para ver o fechamento do dia: vendas, clientes, tickets, unidades e valores.'), 'principal • fechamento por dia, com tickets e clientes', monthlyControlDayRows(r.tickets), true)}
      ${monthlyControlBlock('Por cliente ' + helpTip('Por cliente', 'Mostra quem comprou no mês e permite abrir os tickets de cada cliente.'), 'quantidade e valor vendido por cliente', monthlyControlClientRows(r.tickets))}
      ${monthlyControlBlock('Por sabor/produto ' + helpTip('Por sabor', 'Mostra quantas unidades de cada produto venderam no mês. Ajuda no planejamento da produção.'), 'apoio para produção • quantas tortinhas de cada tipo', monthlyControlProductRows(r.tickets))}

      <div class="report-month-actions">
        <button class="mini ghost" onclick="copyMonthSummary('${monthKey}')">Copiar resumo do mês</button>
        <button class="mini ghost" onclick="copyYearSummary('${monthKey.slice(0,4)}')">Copiar resumo anual</button>
      </div>
    </div>
  </details>`;
}

function financeiro(){
  setHeader('Financeiro');
  const monthKey = today().slice(0,7);
  const todayTickets = groupTickets(state.vendas.filter(v=>v.data===today()));
  const monthTickets = groupTickets(state.vendas.filter(v=>(v.data||'').slice(0,7)===monthKey));
  const todayStats = ticketsStats(todayTickets);
  const monthStats = ticketsStats(monthTickets);
  const gastosMes = gastoPorMes(monthKey);
  const saldoMes = monthStats.recebido - gastosMes;
  return `
    <h1 class="screen-title">Financeiro</h1>
    <section class="finance-area sales-area">
      <div class="finance-area-title"><strong><span class="area-icon">◔</span> Movimento ${helpTip("Movimento", "Resumo do dia e do mês. Saldo considera o que foi recebido menos os gastos lançados.")}</strong><span>vendas e saldo</span></div>
      ${vendasHojeBlock(todayTickets, todayStats)}
      <div class="finance-main-card compact-finance-card result-card">
        <small>Saldo do mês</small>
        <b>${brl(saldoMes)}</b>
        <span>Recebido ${brl(monthStats.recebido)} • Gastos ${brl(gastosMes)} • A receber ${brl(monthStats.aberto)}</span>
      </div>
    </section>

    <section class="finance-area receive-area">
      <div class="finance-area-title"><strong><span class="area-icon">📌</span> Recebíveis ${helpTip("Recebíveis", "Aqui aparecem as vendas em aberto. Use para cobrar, marcar como pago ou fazer baixa parcial.")}</strong><span>quem falta pagar</span></div>
      ${dinheiroReceberBlock()}
    </section>

    ${contasFinanceiroBlock(monthKey)}

    <section class="finance-area expense-area">
      <div class="finance-area-title"><strong><span class="area-icon">◫</span> Gastos ${helpTip("Gastos", "Lance ingredientes, embalagens, taxas e outras saídas para o saldo ficar real.")}</strong><span>saídas do mês</span></div>
      ${gastosControlBlock(monthKey)}
    </section>

    ${reportsBlock()}

    ${dinheiroDadosBlock()}
  `;
}


function bind(){
  const sf = document.getElementById('saleForm');
  if(sf){
    const qty = document.getElementById('saleQty');
    const client = document.getElementById('saleClient');
    const data = document.getElementById('saleDate');
    const product = document.getElementById('saleProduct');
    if(qty) qty.oninput = e => { saleDraft.quantidade = Math.max(1, Number(e.target.value) || 1); };
    if(client) client.oninput = e => { saleDraft.cliente = e.target.value; };
    if(data) data.oninput = e => { saleDraft.data = e.target.value || today(); };
    if(product) product.onchange = e => { saleDraft.produto = e.target.value; render(); };
    sf.onsubmit = e => {
      e.preventDefault();
      let clienteNome = (document.getElementById('saleClient')?.value || saleDraft.cliente || '').trim();
      const saleDate = document.getElementById('saleDate')?.value || saleDraft.data || today();
      if(!saleDraft.itens.length){ toast('Adicione ao menos um item ao ticket'); return; }
      if(saleDraft.avulsa){
        saleDraft.status = 'pago';
        clienteNome = 'Cliente balcão';
      }
      if(!clienteNome && saleDraft.status === 'pago') clienteNome = 'Cliente balcão';
      if(!clienteNome){ toast('Informe o cliente para deixar em aberto'); return; }
      if(saleDraft.status === 'pago' && saleDraft.forma === 'Dinheiro'){
        const falta = cashRemainingValue();
        if(falta > 0){
          toast(`Ainda faltam ${brl(falta)} para completar o pagamento em dinheiro`);
          return;
        }
      }
      const c = ensureClient(clienteNome);
      const wasEditing = !!saleDraft.editingTicketId;
      const ticketId = saleDraft.editingTicketId || uid('ticket');
      if(saleDraft.editingTicketId){
        state.vendas = state.vendas.filter(v => v.ticketId !== saleDraft.editingTicketId);
      }
      saleDraft.itens.forEach(it => {
        const totalItem = moneyInput((Number(it.quantidade)||1) * productPrice(it.produto));
        state.vendas.push({
          id: uid('venda'),
          ticketId,
          data: saleDate,
          cliente: c.nome,
          produto: it.produto,
          quantidade: Number(it.quantidade)||1,
          valorUnitario: productPrice(it.produto),
          valorTotal: totalItem,
          valorPago: saleDraft.status === 'pago' ? totalItem : 0,
          statusPagamento: saleDraft.status,
          formaPagamento: saleDraft.status === 'pago' ? saleDraft.forma : '',
          vencimento: saleDate,
          observacoes: ''
        });
      });
      save();
      saleDraft = { produto:'Maracujá', quantidade:1, status:'pago', forma:'Pix', cliente:'', data:today(), itens:[], editingTicketId:'', avulsa:false, valorRecebido:'' };
      toast(wasEditing ? 'Ticket atualizado' : 'Ticket salvo');
      render();
    };
  }

  const pf = document.getElementById('prodForm');
  if(pf){
    const d = document.getElementById('prodDate');
    const val = document.getElementById('prodVal');
    if(d && val){
      d.onchange = ()=>{ if(!val.dataset.touched) val.value = addDays(d.value,3); };
      val.onchange = ()=> val.dataset.touched = '1';
    }
    pf.onsubmit = e => {
      e.preventDefault();
      const f = Object.fromEntries(new FormData(productFormEl));
      const data = f.data || today();
      const payload = { produto:f.produto, quantidade:Number(f.quantidade)||0, data, validade:f.validade||addDays(data,3), observacoes:'' };
      if(f.id){
        const lot = state.producao.find(l=>l.id===f.id);
        if(lot) Object.assign(lot, payload);
      } else {
        state.producao.push({ id:uid('lote'), ...payload });
      }
      lotFormOpen = false;
      lotDraft = emptyLotDraft();
      save();
      toast(f.id ? 'Lote atualizado' : 'Produção salva');
      render();
    };
  }

  const cf = document.getElementById('clientForm');
  if(cf){
    cf.onsubmit = e => {
      e.preventDefault();
      const f = Object.fromEntries(new FormData(cf));
      const nome = String(f.nome||'').trim();
      const telefone = String(f.telefone||'').trim();
      if(!nome){ toast('Informe o nome do cliente'); return; }
      let c;
      if(f.id){
        c = state.clientes.find(x => x.id === f.id);
        if(c){
          const oldSlug = slug(c.nome);
          c.nome = nome;
          c.telefone = telefone;
          c.id = `cliente_${slug(nome)}`;
          state.vendas.forEach(v => { if(slug(v.cliente) === oldSlug){ v.cliente = nome; } });
        }
      }
      if(!c){
        c = ensureClient(nome);
        c.telefone = telefone || c.telefone || '';
      }
      save();
      toast(clientDraft.id ? 'Cliente atualizado' : 'Cliente salvo');
      if(returnToSaleAfterClient){
        saleDraft.cliente = c.nome;
        clientFormOpen = false;
        clientDraft = emptyClientDraft();
        returnToSaleAfterClient = false;
        route = 'venda';
        render();
        setTimeout(()=>{ const input=document.getElementById('saleClient'); if(input) input.focus(); },60);
        return;
      }
      clientFormOpen = false;
      clientDraft = emptyClientDraft();
      render();
    };
  }

  const clientSearch = document.getElementById('clientSearch');
  if(clientSearch) clientSearch.oninput = e => filterClients(e.target.value);
  const ef = document.getElementById('expenseForm');
  if(ef){ ef.onsubmit = e => { e.preventDefault(); const f=Object.fromEntries(new FormData(ef)); const payload={id:f.id||uid('gasto'), data:f.data||today(), valor:Number(f.valor)||0, categoria:f.categoria||'Outros', descricao:f.descricao||'Gasto'}; if(f.id){ const ix=state.gastos.findIndex(g=>g.id===f.id); if(ix>=0) state.gastos[ix]=payload; else state.gastos.push(payload); } else state.gastos.push(payload); expenseDraft=emptyExpenseDraft(); save(); toast('Gasto salvo'); render(); }; }
  const af = document.getElementById('accountForm');
  if(af){ af.onsubmit = e => { e.preventDefault(); const f=Object.fromEntries(new FormData(af)); const payload={id:f.id||uid('mov'), data:f.data||today(), tipo:f.tipo||'entrada', forma:f.forma||'Pix', valor:Number(f.valor)||0, descricao:f.descricao||'Movimentação'}; if(f.id){ const ix=state.contas.findIndex(m=>m.id===f.id); if(ix>=0) state.contas[ix]=payload; else state.contas.push(payload); } else state.contas.push(payload); accountDraft=emptyAccountDraft(); save(); toast('Ajuste salvo'); render(); }; }
  const productFormEl = document.getElementById('productForm');
  if(productFormEl){ productFormEl.onsubmit = e => { e.preventDefault(); const f=Object.fromEntries(new FormData(productFormEl)); const payload={ id:f.id||slug(f.nome), nome:String(f.nome||'Produto').trim(), preco:Number(f.preco)||0, ativo:true, fichaId:f.fichaId||'', mostrarNaVenda:f.mostrarNaVenda !== 'false' }; const ix=state.produtos.findIndex(p=>p.id===payload.id); if(ix>=0) state.produtos[ix]=payload; else state.produtos.push(payload); productDraft=emptyProductDraft(); productFormOpen=false; syncProductRegistry(state); save(); toast('Produto salvo'); render(); }; }
  const rf = document.getElementById('recipeForm');
  if(rf){ rf.onsubmit = e => { e.preventDefault(); const f=Object.fromEntries(new FormData(rf)); const ingredientes = (recipeDraft.ingredientes||[]).map((ing,idx)=>({ item:String(f['ing_item_'+idx]||'').trim(), custoReceita:Number(f['ing_cost_'+idx])||0 })).filter(i=>i.item || i.custoReceita>0); const payload = { id:f.id || uid('receita'), nome:String(f.nome||'Receita').trim(), rendimento:Number(f.rendimento)||0, precoVenda:Number(f.precoVenda)||0, lucroUnidade:0, observacoes:String(f.observacoes||'').trim(), ingredientes }; if(f.id){ const ix = state.receitasProdutos.findIndex(r=>r.id===f.id); if(ix>=0) state.receitasProdutos[ix] = payload; else state.receitasProdutos.push(payload); } else { state.receitasProdutos.push(payload); } recipeDraft = emptyRecipeDraft(); recipeFormOpen = false; save(); toast('Receita salva'); render(); }; }
  const imp = document.getElementById('importFile');
  if(imp) imp.onchange = importBackup;
  if(route === 'clientes' && (clientFormOpen || returnToSaleAfterClient || clientDraft.id || clientDraft.nome)){
    const nameInput = document.getElementById('clientName');
    if(nameInput) setTimeout(()=>nameInput.focus(), 50);
  }
}


function openClientByName(nome){
  route = 'clientes';
  render();
  setTimeout(() => {
    const input = document.getElementById('clientSearch');
    if(input){
      input.value = nome || '';
      filterClients(input.value);
    }
    const rows = [...document.querySelectorAll('.client-row')];
    const target = rows.find(el => (el.dataset.search||'').includes(String(nome||'').toLowerCase()));
    if(target){
      target.open = true;
      target.scrollIntoView({behavior:'smooth', block:'center'});
    }
  }, 60);
}
function startProductionFor(product){
  lotDraft = { id:'', produto:product || 'Maracujá', quantidade:10, data:today(), validade:addDays(today(),3) };
  lotFormOpen = true;
  route = 'estoque';
  render();
}

function pickProduct(p){ saleDraft.produto = p; render(); }
function pickStatus(s){ saleDraft.status = s; if(s !== 'pago'){ saleDraft.avulsa = false; saleDraft.valorRecebido = ''; } render(); }
function toggleAvulsa(){ saleDraft.avulsa = !saleDraft.avulsa; if(saleDraft.avulsa){ saleDraft.status = 'pago'; saleDraft.forma = saleDraft.forma || 'Pix'; saleDraft.cliente = ''; } if(!saleDraft.avulsa && saleDraft.forma !== 'Dinheiro') saleDraft.valorRecebido = ''; render(); }
function pickPay(f){ saleDraft.forma = f; if(f !== 'Dinheiro') saleDraft.valorRecebido = ''; render(); }
function changeQty(delta){ const current = Number(document.getElementById('saleQty')?.value) || saleDraft.quantidade || 1; saleDraft.quantidade = Math.max(1, current + delta); const input = document.getElementById('saleQty'); if(input) input.value = saleDraft.quantidade; }
function addProductQuick(product){
  const existing = saleDraft.itens.find(it => it.produto === product);
  if(existing) existing.quantidade += 1;
  else saleDraft.itens.push({ produto: product, quantidade: 1 });
  saleDraft.produto = product;
  render();
}
function addItemToTicket(){
  const qty = Math.max(1, Number(document.getElementById('saleQty')?.value) || saleDraft.quantidade || 1);
  const product = document.getElementById('saleProduct')?.value || saleDraft.produto;
  const existing = saleDraft.itens.find(it => it.produto === product);
  if(existing) existing.quantidade += qty;
  else saleDraft.itens.push({ produto: product, quantidade: qty });
  saleDraft.quantidade = 1;
  render();
}
function adjustTicketItem(index, delta){
  const it = saleDraft.itens[index];
  if(!it) return;
  it.quantidade = Math.max(0, (Number(it.quantidade)||0) + delta);
  if(it.quantidade <= 0) saleDraft.itens.splice(index,1);
  render();
}
function removeItemFromTicket(index){ saleDraft.itens.splice(index,1); render(); }

function clearCurrentSale(){ saleDraft = { ...saleDraft, produto:'Maracujá', quantidade:1, cliente:'', data:today(), itens:[], editingTicketId:'', avulsa:false, status:'pago', forma:'Pix', valorRecebido:'' }; toast('Venda limpa'); render(); }
function goToNewClient(){ clientDraft = { id:'', nome:(document.getElementById('saleClient')?.value || saleDraft.cliente || '').trim(), telefone:'' }; clientFormOpen = true; returnToSaleAfterClient = true; route = 'clientes'; render(); }
function editClient(id){ const c = state.clientes.find(x => x.id === id); if(!c) return; clientDraft = { id:c.id, nome:c.nome, telefone:c.telefone||'' }; clientFormOpen = true; returnToSaleAfterClient = false; route = 'clientes'; render(); }
function cancelClientForm(){ clientFormOpen = false; clientDraft = emptyClientDraft(); const backToSale = returnToSaleAfterClient; returnToSaleAfterClient = false; if(backToSale){ route = 'venda'; } render(); }
function ensureClient(nome){ const key = slug(nome); let c = state.clientes.find(x=>slug(x.nome)===key); if(!c){ c = { id:`cliente_${key}`, nome:nome.trim(), telefone:'', observacoes:'' }; state.clientes.push(c); } return c; }
function prefillClient(nome){ const c = state.clientes.find(x=>slug(x.nome)===slug(nome)); saleDraft.cliente = c ? c.nome : nome; route = 'venda'; render(); setTimeout(()=>{ const input=document.getElementById('saleClient'); if(input) input.focus(); },50); }
function filterClients(q){
  q = String(q||'').trim().toLowerCase();
  const rows = [...document.querySelectorAll('.client-row')];
  let visible = 0;
  rows.forEach(el => {
    const ok = !q || el.dataset.search.includes(q);
    el.style.display = ok ? 'block' : 'none';
    if(ok) visible += 1;
  });
  const hint = document.getElementById('clientSearchHint');
  if(hint) hint.textContent = q ? `${visible} resultado(s) para "${q}"` : `${rows.length} cliente(s) em ordem alfabética`;
  const no = document.getElementById('clientNoResults');
  if(no) no.style.display = (q && visible === 0) ? 'block' : 'none';
}
function clearClientSearch(){
  const input = document.getElementById('clientSearch');
  if(input) input.value = '';
  filterClients('');
  if(input) input.focus();
}
function togglePaid(id){ const v = state.vendas.find(x=>x.id===id); if(!v) return; v.statusPagamento = v.statusPagamento === 'pago' ? 'em_aberto' : 'pago'; v.formaPagamento = v.statusPagamento === 'pago' ? (v.formaPagamento || 'Pix') : ''; v.valorPago = v.statusPagamento === 'pago' ? Number(v.valorTotal)||0 : 0; save(); toast('Status atualizado'); render(); }
function toggleTicketPaid(ticketId){ const items = state.vendas.filter(v=>v.ticketId===ticketId && !isCanceled(v)); if(!items.length) return; const allPaid = items.every(v=>v.statusPagamento==='pago'); items.forEach(v => { v.statusPagamento = allPaid ? 'em_aberto' : 'pago'; v.formaPagamento = allPaid ? '' : (v.formaPagamento || 'Pix'); v.valorPago = allPaid ? 0 : (Number(v.valorTotal)||0); }); save(); toast('Status do ticket atualizado'); render(); }
function cancelTicket(ticketId){ const items = state.vendas.filter(v=>v.ticketId===ticketId); if(!items.length) return; if(!safeConfirm('Cancelar esta venda?', 'Essa ação remove a venda dos totais, do estoque e das cobranças.')) return; items.forEach(v => { v.statusPagamento = 'cancelado'; v.formaPagamento = ''; v.valorPago = 0; }); save(); toast('Venda cancelada'); render(); }
function editLot(id){
  const l = state.producao.find(x=>x.id===id);
  if(!l) return;
  lotDraft = { id:l.id, produto:l.produto, quantidade:l.quantidade, data:l.data, validade:l.validade };
  lotFormOpen = true;
  route = 'estoque';
  render();
}
function cancelLotForm(){ lotFormOpen = false; lotDraft = emptyLotDraft(); render(); }
function deleteLot(id){ if(!safeConfirm('Excluir este lote?', 'Essa ação altera o cálculo de estoque e rastreio por lote.')) return; state.producao = state.producao.filter(l=>l.id!==id); save(); toast('Produção excluída'); render(); }
function copyClientCharge(key){ const group = groupedCollections().find(g=>g.key===key); if(!group) return; const abertos = group.tickets.filter(t=>t.openTotal>0); const itens = abertos.map(t=>`${ticketSummaryLines(t)} (${dateBR(t.data)}) - ${brl(t.openTotal)}`).join('; '); const msg = `Oi, tudo bem? Consta em aberto com ${group.nome}: ${itens}. Total pendente: ${brl(group.aberto)}. Pode me confirmar o pagamento, por favor?`; navigator.clipboard?.writeText(msg); toast('Cobrança copiada'); }

function editTicket(ticketId){
  const items = state.vendas.filter(v => v.ticketId === ticketId && !isCanceled(v));
  if(!items.length){ toast('Ticket não encontrado'); return; }
  const first = items[0];
  const grouped = {};
  items.forEach(v => grouped[v.produto] = (grouped[v.produto]||0) + (Number(v.quantidade)||0));
  saleDraft = {
    produto: Object.keys(grouped)[0] || 'Maracujá',
    quantidade: 1,
    status: items.every(v=>v.statusPagamento==='pago') ? 'pago' : 'em_aberto',
    forma: first.formaPagamento || 'Pix',
    cliente: first.cliente === 'Cliente balcão' ? '' : (first.cliente || ''),
    data: first.data || today(),
    itens: Object.entries(grouped).map(([produto, quantidade]) => ({ produto, quantidade })),
    editingTicketId: ticketId,
    avulsa: first.cliente === 'Cliente balcão',
    valorRecebido: ''
  };
  route = 'venda';
  toast('Ticket carregado para edição');
  render();
}
function partialPayTicket(ticketId){
  const items = state.vendas.filter(v => v.ticketId === ticketId && !isCanceled(v));
  const open = items.reduce((a,v)=>a+itemOpen(v),0);
  if(open <= 0){ toast('Nada em aberto'); return; }
  const raw = prompt(`Valor recebido parcialmente? Em aberto: ${brl(open)}`);
  if(raw === null) return;
  let amount = Number(String(raw).replace(',', '.').replace(/[^0-9.]/g,''));
  if(!amount || amount <= 0){ toast('Valor inválido'); return; }
  amount = Math.min(amount, open);
  for(const v of items){
    let rem = itemOpen(v);
    if(rem <= 0) continue;
    const add = Math.min(rem, amount);
    v.valorPago = moneyInput(itemPaid(v) + add);
    v.statusPagamento = v.valorPago >= (Number(v.valorTotal)||0) ? 'pago' : 'em_aberto';
    if(v.statusPagamento === 'pago') v.formaPagamento = v.formaPagamento || 'Pix';
    amount = moneyInput(amount - add);
    if(amount <= 0) break;
  }
  save();
  toast('Baixa parcial registrada');
  render();
}

function syncRecipeDraftFromForm(){
  const form = document.getElementById('recipeForm');
  if(!form) return;
  const f = Object.fromEntries(new FormData(form));
  recipeDraft.id = f.id || recipeDraft.id || '';
  recipeDraft.nome = String(f.nome || '').trim();
  recipeDraft.rendimento = Number(f.rendimento) || 6;
  recipeDraft.precoVenda = Number(f.precoVenda) || 0;
  recipeDraft.observacoes = String(f.observacoes || '').trim();
  recipeDraft.ingredientes = (recipeDraft.ingredientes || []).map((ing,idx)=>({
    item: String(f['ing_item_'+idx] || '').trim(),
    custoReceita: Number(f['ing_cost_'+idx]) || 0
  }));
}
function deleteProduct(id){
  const p = (state.produtos||[]).find(x=>x.id===id);
  if(!p) return;

  const hasSales = (state.vendas||[]).some(v => v.produto === p.nome);
  const hasProduction = (state.producao||[]).some(l => l.produto === p.nome);

  if(hasSales || hasProduction){
    if(!safeConfirm('Excluir produto com histórico?', 'Este produto tem venda ou produção registrada. Ele será removido do cadastro e do caixa, mas as vendas e produções antigas continuam no histórico.')) return;
  } else {
    if(!safeConfirm('Excluir produto?', 'Essa ação remove o produto do cadastro e do caixa.')) return;
  }

  state.produtos = (state.produtos||[]).filter(x=>x.id!==id);
  if(productDraft.id === id) productDraft = emptyProductDraft();

  syncProductRegistry(state);
  save();
  toast('Produto excluído');
  render();
}

function editProduct(id){
  const p = (state.produtos||[]).find(x=>x.id===id);
  if(!p) return;
  productDraft = { ...p };
  productFormOpen = true;
  route = 'estoque';
  render();
}
function cancelProductForm(){
  productDraft = emptyProductDraft();
  productFormOpen = false;
  render();
}
function toggleProduct(id){
  const p = (state.produtos||[]).find(x=>x.id===id);
  if(!p) return;
  const willShow = p.mostrarNaVenda === false;
  if(!willShow && !safeConfirm('Ocultar produto do caixa?', 'O produto deixa de aparecer na aba Venda, mas histórico, vendas antigas e estoque permanecem salvos.')) return;
  p.mostrarNaVenda = willShow ? true : false;
  p.ativo = true;
  syncProductRegistry(state);
  save();
  toast(p.mostrarNaVenda ? 'Produto visível no caixa' : 'Produto oculto do caixa');
  render();
}

function addRecipeIngredient(){
  syncRecipeDraftFromForm();
  recipeDraft.ingredientes = recipeDraft.ingredientes || [];
  recipeDraft.ingredientes.push({item:'', custoReceita:0});
  recipeFormOpen = true;
  render();
  setTimeout(()=>{ const el=document.querySelector('.recipes-block'); if(el) el.open = true; const rf=document.querySelector('.recipe-form'); if(rf) rf.open = true; }, 0);
}
function removeRecipeIngredient(idx){
  syncRecipeDraftFromForm();
  recipeDraft.ingredientes = recipeDraft.ingredientes || [];
  recipeDraft.ingredientes.splice(idx,1);
  if(!recipeDraft.ingredientes.length) recipeDraft.ingredientes.push({item:'', custoReceita:0});
  recipeFormOpen = true;
  render();
  setTimeout(()=>{ const el=document.querySelector('.recipes-block'); if(el) el.open = true; const rf=document.querySelector('.recipe-form'); if(rf) rf.open = true; }, 0);
}
function editRecipe(id){
  const r = (state.receitasProdutos||[]).find(x=>x.id===id);
  if(!r) return;
  recipeDraft = JSON.parse(JSON.stringify(r));
  recipeFormOpen = true;
  route = 'estoque';
  render();
}
function cancelRecipeForm(){
  recipeDraft = emptyRecipeDraft();
  recipeFormOpen = false;
  render();
}
function deleteRecipe(id){
  if(!safeConfirm('Excluir esta ficha técnica?', 'Essa ação remove a ficha salva, mas não apaga vendas ou estoque.')) return;
  state.receitasProdutos = (state.receitasProdutos||[]).filter(r=>r.id!==id);
  save();
  toast('Ficha técnica excluída');
  render();
}

function safeConfirm(title, detail){
  return confirm(`${title}\n\n${detail}`);
}
function editExpense(id){
  const g = (state.gastos||[]).find(x=>x.id===id);
  if(!g) return;
  expenseDraft = { id:g.id, data:g.data||today(), valor:g.valor, categoria:g.categoria||'Outros', descricao:g.descricao||'' };
  route = 'financeiro';
  render();
}
function cancelExpenseEdit(){
  expenseDraft = emptyExpenseDraft();
  render();
}
function editAccountMove(id){
  const m = (state.contas||[]).find(x=>x.id===id);
  if(!m) return;
  accountDraft = { id:m.id, data:m.data||today(), tipo:m.tipo||'entrada', forma:m.forma||'Pix', valor:m.valor, descricao:m.descricao||'' };
  route = 'financeiro';
  render();
}
function cancelAccountEdit(){
  accountDraft = emptyAccountDraft();
  render();
}
function duplicateRecipe(id){
  const r = (state.receitasProdutos||[]).find(x=>x.id===id);
  if(!r) return;
  recipeDraft = JSON.parse(JSON.stringify(r));
  recipeDraft.id = '';
  recipeDraft.nome = `${recipeDraft.nome} cópia`;
  recipeFormOpen = true;
  route = 'estoque';
  render();
}
function exportMonthCSV(monthKey){
  const tickets = monthTickets(monthKey);
  const lines = [['Data','Cliente','Itens','Total','Recebido','A receber','Status','Forma'].join(';')];
  tickets.forEach(t => {
    lines.push([
      dateBR(t.data),
      csvEscape(t.cliente),
      csvEscape(ticketSummaryLines(t)),
      (Number(t.total)||0).toFixed(2).replace('.',','),
      (Number(t.paidTotal)||0).toFixed(2).replace('.',','),
      (Number(t.openTotal)||0).toFixed(2).replace('.',','),
      inferTicketStatus(t),
      csvEscape(t.forma || '')
    ].join(';'));
  });
  downloadText(`relatorio-${monthKey}.csv`, lines.join('\n'), 'text/csv;charset=utf-8');
  toast('CSV exportado');
}
function exportAllCSV(){
  const lines = [['Data','Cliente','Produto','Quantidade','Valor unitário','Total','Recebido','A receber','Status','Forma'].join(';')];
  activeSales().slice().sort((a,b)=>(a.data||'').localeCompare(b.data||'')).forEach(v => {
    lines.push([
      dateBR(v.data),
      csvEscape(v.cliente),
      csvEscape(v.produto),
      Number(v.quantidade)||0,
      (Number(v.valorUnitario)||0).toFixed(2).replace('.',','),
      (Number(v.valorTotal)||0).toFixed(2).replace('.',','),
      itemPaid(v).toFixed(2).replace('.',','),
      itemOpen(v).toFixed(2).replace('.',','),
      v.statusPagamento,
      csvEscape(v.formaPagamento || '')
    ].join(';'));
  });
  downloadText('relatorio-geral-vendas.csv', lines.join('\n'), 'text/csv;charset=utf-8');
  toast('CSV geral exportado');
}

function copyMonthSummary(monthKey){
  const r = monthReportData(monthKey);
  const ticketMedio = r.st.tickets ? r.st.vendido / r.st.tickets : 0;
  const recebimentoPct = r.st.vendido ? (r.st.recebido / r.st.vendido) * 100 : 0;
  const topClient = topLabel(r.byClient, 'vendido', 'Sem cliente');
  const topProduct = topLabel(r.byProduct, 'unidades', 'Sem produto');
  const topDay = bestDayLabel(r.byDay);
  const msg = `Resumo ${monthTitle(monthKey)}
Vendido: ${brl(r.st.vendido)}
Recebido: ${brl(r.st.recebido)} (${recebimentoPct.toFixed(0)}%)
A receber: ${brl(r.st.aberto)}
Gastos: ${brl(r.gastos)}
Saldo: ${brl(r.saldo)}
Unidades vendidas: ${r.st.un}
Tickets: ${r.st.tickets}
Ticket médio: ${brl(ticketMedio)}
Produto mais vendido: ${topProduct}
Melhor cliente: ${topClient}
Melhor dia: ${topDay}`;
  navigator.clipboard?.writeText(msg);
  toast('Resumo copiado');
}

function copyYearSummary(year){
  const months = monthKeys().filter(k => k.slice(0,4) === String(year));
  const data = months.map(k => ({ key:k, ...monthReportData(k) }));
  const totals = data.reduce((a,m)=>{
    a.vendido += m.st.vendido;
    a.recebido += m.st.recebido;
    a.aberto += m.st.aberto;
    a.gastos += m.gastos;
    a.un += m.st.un;
    a.tickets += m.st.tickets;
    return a;
  }, {vendido:0, recebido:0, aberto:0, gastos:0, un:0, tickets:0});
  const saldo = totals.recebido - totals.gastos;
  const ticketMedio = totals.tickets ? totals.vendido / totals.tickets : 0;
  const msg = `Resumo anual ${year}
Vendido: ${brl(totals.vendido)}
Recebido: ${brl(totals.recebido)}
A receber: ${brl(totals.aberto)}
Gastos: ${brl(totals.gastos)}
Saldo: ${brl(saldo)}
Unidades vendidas: ${totals.un}
Tickets: ${totals.tickets}
Ticket médio: ${brl(ticketMedio)}
Meses no relatório: ${months.length}`;
  navigator.clipboard?.writeText(msg);
  toast('Resumo anual copiado');
}

function deleteAccountMove(id){
  if(!safeConfirm('Excluir este ajuste de conta?', 'Essa ação remove o ajuste dos totais de pagamentos.')) return;
  state.contas = (state.contas||[]).filter(m => m.id !== id);
  save();
  toast('Ajuste excluído');
  render();
}

function deleteExpense(id){
  if(!safeConfirm('Excluir este gasto?', 'Essa ação remove o lançamento do histórico e do saldo do mês.')) return;
  state.gastos = (state.gastos||[]).filter(g => g.id !== id);
  save();
  toast('Gasto excluído');
  render();
}

function exportBackup(){ const blob = new Blob([JSON.stringify(state,null,2)], {type:'application/json'}); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'backup-sr-tortinhas-control.json'; a.click(); }
function importBackup(e){
  const file = e.target.files[0];
  if(!file) return;
  if(!safeConfirm('Importar backup?', 'Isso substitui os dados atuais deste navegador pelo arquivo escolhido. Exporte um backup antes se tiver dúvidas.')) return;
  const r = new FileReader();
  r.onload = ()=>{ try { state = normalize(JSON.parse(r.result)); syncProductRegistry(state); save(); toast('Backup importado'); render(); } catch(err){ toast('Arquivo inválido'); } };
  r.readAsText(file);
}
function resetBase(){ if(!safeConfirm('Restaurar base?', 'Isso remove os dados salvos neste navegador e volta para a base inicial do app.')) return; localStorage.removeItem(STORE_KEY); state = load(); toast('Base restaurada'); render(); }

function setMonthlyView(monthKey, mode){
  const panel = document.getElementById('monthlyView_' + monthKey);
  if(!panel) return;
  const source = document.getElementById(mode === 'cliente' ? 'monthlyClient_' + monthKey : mode === 'dia' ? 'monthlyDay_' + monthKey : 'monthlySale_' + monthKey);
  if(source) panel.innerHTML = source.innerHTML;
}

if('serviceWorker' in navigator && location.protocol !== 'file:'){ navigator.serviceWorker.register('service-worker.js').catch(()=>{}); }
initFirebaseSync();
render();

function srTortinhasGlobalError(e){
  if(String(e?.filename||'').includes('webpage_content_reporter')) return;
  console.error('Sr Tortinhas error:', e.message, e.filename, e.lineno);
}
window.addEventListener('error', srTortinhasGlobalError);
