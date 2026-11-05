/* ============================================================
   GVH · Sistema de Pedidos  —  frontend
   Comunicação: POST {token, acao, dados} → n8n → Supabase (função api)
   ============================================================ */
const API_URL = 'https://gvh-n8n.kjb64n.easypanel.host/webhook/gvh-sistema';
const API_GAB_URL = 'https://gvh-n8n.kjb64n.easypanel.host/webhook/gvh-gabaritos';
// Chave pública (feita para ficar no navegador). Ela só consegue OUVIR o canal de avisos
// "gvh-mudancas" — não lê nenhuma tabela. Os dados sempre vêm pelo n8n.
const SUPABASE_URL = 'https://zvcvdfkumjlvwqjdbiiw.supabase.co';
const SUPABASE_KEY = 'sb_publishable_B8Rn0FkmxWafKLo4pog7qA_s3evDks4';
const INTERVALO_SEGURANCA_MS = 300000; // 5 min: só cobre queda do Realtime
const S = { token: null, usuario: null, perm: {}, base: null, cache: {}, parcelas: {}, feriados: {}, exp: {} };

/* PADRÃO DE TELA (decisão do dono, 13/10): a tela mostra o principal; o resto fica em blocos que a pessoa abre.
   blocoExp(chave, resumo, corpo, abertoPadrao, classe) → <details> que lembra se a pessoa abriu ou fechou
   (vale enquanto a aba estiver aberta). Botões e campos ficam no corpo, nunca no resumo. */
function expAberto(chave, padrao) { return chave in S.exp ? S.exp[chave] : !!padrao; }
function blocoExp(chave, resumo, corpo, padrao, classe) {
  return `<details class="exp ${classe || ''}" data-exp="${esc(chave)}" ${expAberto(chave, padrao) ? 'open' : ''}><summary>${resumo}</summary><div class="exp-corpo">${corpo}</div></details>`;
}
// "Ver mais N": mostra os primeiros e guarda o resto num bloco que abre
function listaComMais(chave, itens, primeiros, nome) {
  if (itens.length <= primeiros) return itens.join('');
  const resto = itens.length - primeiros;
  return itens.slice(0, primeiros).join('') + blocoExp(chave, `Ver mais ${resto} ${nome}`, itens.slice(primeiros).join(''), false, 'leve');
}
// Só o clique da pessoa é lembrado (abrir/fechar feito pela busca não conta)
document.addEventListener('click', e => {
  const sm = e.target.closest && e.target.closest('details[data-exp] > summary'); if (!sm) return;
  const d = sm.parentElement; S.exp[d.dataset.exp] = !d.open;
});
// Nome da categoria sem a lista entre parênteses: "Impressos publicitários (folhetos, …)" → "Impressos publicitários"
const catCurta = n => String(n || '').replace(/\s*\(.*\)\s*$/, '');

/* ---------- utilitários ---------- */
// Sem "el", procura primeiro dentro da tela aberta (as telas ficam guardadas lado a lado)
const $ = (s, el) => el ? el.querySelector(s) : ((S.vistaAtual && S.vistaAtual.el.querySelector(s)) || document.querySelector(s));
const $$ = (s, el) => { if (el) return [...el.querySelectorAll(s)]; const r = S.vistaAtual ? [...S.vistaAtual.el.querySelectorAll(s)] : []; return r.length ? r : [...document.querySelectorAll(s)]; };
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const brl = v => (v === null || v === undefined || v === '') ? '—' : Number(v).toLocaleString('pt-BR', {style:'currency', currency:'BRL'});
const num = v => Number(v || 0).toLocaleString('pt-BR', {maximumFractionDigits: 3});
const data = v => { if (!v) return '—'; const [a,m,d] = String(v).slice(0,10).split('-'); return `${d}/${m}/${a}`; };
const dataHora = v => v ? new Date(v).toLocaleString('pt-BR', {day:'2-digit', month:'2-digit', year:'2-digit', hour:'2-digit', minute:'2-digit'}) : '—';
const hoje = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0,10); };
const somaDias = (iso, n) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0,10); };
const somaMeses = (iso, n) => { const d = new Date(iso + 'T12:00:00'); d.setMonth(d.getMonth() + n); return d.toISOString().slice(0,10); };
const pode = chave => !!S.perm[chave];
const podeStatus = st => (S.perm.status_item_permitidos || []).includes(st);
/* fornecedor: só quem acessa a aba Pré-impressão (mesma regra do banco: fn_ve_fornecedor) */
const veFornecedor = () => podeStatus('em_producao') || podeStatus('despachado');
const formDados = form => Object.fromEntries(new FormData(form).entries());
const soDoc = v => String(v || '').toUpperCase().replace(/[^0-9A-Z]/g, '');
const fmtDoc = v => { const d = soDoc(v);
  if (d.length === 11) return d.replace(/^(.{3})(.{3})(.{3})(.{2})$/, '$1.$2.$3-$4');
  if (d.length === 14) return d.replace(/^(.{2})(.{3})(.{3})(.{4})(.{2})$/, '$1.$2.$3/$4-$5');
  return v || ''; };
const fmtTel = v => { const d = String(v || '').replace(/\D/g, ''); const m = d.match(/^55(\d{2})(\d{4,5})(\d{4})$/);
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : (v || ''); };

function toast(msg, erro = false) {
  const t = document.createElement('div');
  t.className = 'toast' + (erro ? ' erro' : ''); t.textContent = msg;
  $('#toasts').appendChild(t); setTimeout(() => t.remove(), erro ? 6000 : 3000);
}

let carregando = 0;
function setCarregando(d) { carregando += d; $('#carregando').classList.toggle('hidden', carregando <= 0); }
// mostra que o botão está trabalhando (bolinha girando) até a ação terminar
async function ocupado(btn, fn) {
  if (!btn) return fn();
  btn.classList.add('ocupado'); btn.disabled = true;
  try { return await fn(); } finally { btn.classList.remove('ocupado'); btn.disabled = false; }
}
// aviso no meio da tela para ações sem botão na tela (ex.: escolher arquivo e enviar)
async function aguarde(texto, fn) {
  const d = document.createElement('div'); d.className = 'aguarde';
  d.innerHTML = `<div><span class="roda"></span><span>${esc(texto)}</span></div>`;
  document.body.appendChild(d);
  try { return await fn(); } finally { d.remove(); }
}

async function api(acao, dados = {}, silencioso = false) {
  setCarregando(1);
  try {
    const r = await fetch(acao === 'gabarito_drive' ? API_GAB_URL : API_URL, { method:'POST', headers:{'Content-Type':'application/json'},
                                     body: JSON.stringify({ token: S.token, acao, dados }) });
    let j; try { j = await r.json(); } catch { throw new Error('Resposta inválida do servidor.'); }
    if (Array.isArray(j)) j = j[0];
    if (!j || j.ok !== true) {
      if (j && j.codigo === 'SESSAO' && acao !== 'login') { sairLocal(); throw new Error('Sua sessão expirou. Entre novamente.'); }
      // o banco manda o código do caso (ex.: CONFIRMAR, SEM_PAGAMENTO) separado da mensagem
      const err = new Error((j && (j.erro || j.message)) || 'Não foi possível concluir a ação.');
      if (j && j.codigo) err.codigo = j.codigo;
      throw err;
    }
    if (!/^(login|sessao|base|resumo|listar_|obter_|buscar_|artes_pagamentos|arte_arquivo|comprovante_arquivo|calcular_preco|conferir_produto|verificar_documento|ncm_consultar|fornecedor_senha|orc_publico|prova_publica$|prova_publica_imagem|previa_cancelamento|gabaritos$|gabarito_historico$|gabarito_drive$)/.test(acao) && acao !== 'cadastro_publico' && !(acao === 'feriados' && !dados.salvar && !dados.excluir)) marcarTelasDesatualizadas();
    return j;
  } catch (e) {
    if (!silencioso) toast(e.message === 'Failed to fetch' ? 'Sem conexão com o servidor.' : e.message, true);
    throw e;
  } finally { setCarregando(-1); }
}

/* ---------- paginação ("mostrar mais") ---------- */
const PASSO_LISTA = 50;
const limLista = chave => (S.cache.lim ||= {})[chave] || PASSO_LISTA;
const zerarLista = chave => { (S.cache.lim ||= {})[chave] = PASSO_LISTA; };
function rodapeLista(chave, mostrados, total, rotulo, extra = '') {
  if (!total) return '';
  if (total <= mostrados) return `<p class="small muted" style="margin:10px 0 0">${total} ${rotulo}.${extra ? ' ' + extra : ''}</p>`;
  return `<div style="display:flex;align-items:center;gap:12px;margin-top:10px;flex-wrap:wrap"><span class="small muted">Mostrando ${mostrados} de ${total} ${rotulo}.${extra ? ' ' + extra : ''}</span>
    <button type="button" class="btn peq" data-mais="${chave}">Mostrar mais ${Math.min(PASSO_LISTA, total - mostrados)}</button></div>`;
}
function ligarMais(el, chave, aoMudar) {
  const b = el.querySelector(`[data-mais="${chave}"]`);
  if (b) b.onclick = () => { S.cache.lim[chave] = limLista(chave) + PASSO_LISTA; aoMudar(); };
}

/* ---------- modal ---------- */
function abrirModal({ titulo, corpo, rodape = '', largo = false, aoAbrir }) {
  const f = document.createElement('div');
  f.className = 'fundo-modal';
  f.innerHTML = `<div class="modal ${largo ? 'largo' : ''}" role="dialog" aria-modal="true">
      <div class="modal-cab"><h2>${esc(titulo)}</h2><button class="fechar" aria-label="Fechar">×</button></div>
      <div class="modal-corpo">${corpo}</div>
      ${rodape ? `<div class="modal-rodape">${rodape}</div>` : ''}</div>`;
  const fechar = () => f.remove();
  f.querySelector('.fechar').onclick = fechar;
  f.addEventListener('mousedown', e => { if (e.target === f) fechar(); });
  f.addEventListener('keydown', e => { if (e.key === 'Escape') fechar(); });
  $('#modais').appendChild(f);
  const primeiro = f.querySelector('input,select,textarea'); if (primeiro) primeiro.focus();
  if (aoAbrir) aoAbrir(f, fechar);
  return { el: f, fechar };
}
function confirmar(texto, rotulo = 'Confirmar', perigo = false) {
  return new Promise(res => {
    const m = abrirModal({ titulo: 'Confirmação', corpo: `<p style="margin:0">${texto}</p>`,
      rodape: `<button class="btn" data-n>Voltar</button><button class="btn ${perigo ? 'perigo' : 'prim'}" data-s>${esc(rotulo)}</button>` });
    m.el.querySelector('[data-n]').onclick = () => { m.fechar(); res(false); };
    m.el.querySelector('[data-s]').onclick = () => { m.fechar(); res(true); };
  });
}

/* ---------- status ---------- */
const ETAPAS = [
  ['criacao_arte','Criação de Arte'], ['pre_impressao','Pré-Impressão'],
  ['em_producao','Em produção'], ['despachado','Despachado'], ['expedicao','Expedição'], ['saida','Transporte / Retirada'], ['entregue','Entregue']
];
const ORDEM_PED = { criacao_arte:0, pre_impressao:1, em_producao:2, despachado:3, expedicao:4, em_transporte:5, aguardando_retirada:5, entregue:6, concluido:7, cancelado:-1 };
const ORDEM_ITEM = { arte_a_fazer:0, arte_em_alteracao:0, arte_em_aprovacao:0, arte_pausada:0, arte_fechando:0, arte_aprovada:0, pre_impressao:1, em_producao:2, despachado:3, expedicao:4, em_transporte:5, aguardando_retirada:5, entregue:6, cancelado:-1 };
const COR_STATUS = {
  arte_pausada:'b-vermelho', arte_fechando:'b-azul', arte_aprovada:'b-verde',
  recebido:'b-cinza', criacao_arte:'b-azul', arte_a_fazer:'b-azul', arte_em_alteracao:'b-ambar', arte_em_aprovacao:'b-azul',
  pre_impressao:'b-ambar', em_producao:'b-ambar', despachado:'b-azul', expedicao:'b-verde', em_transporte:'b-verde', aguardando_retirada:'b-verde',
  entregue:'b-verde', concluido:'b-escuro', cancelado:'b-vermelho'
};
const COR_FIN = { pago:'b-verde', atrasado:'b-vermelho', boleto:'b-azul', sinal_pago:'b-ambar', aguardando_pagamento:'b-cinza' };
const nomeStatusItem = c => (S.base?.status_item || []).find(s => s.codigo === c)?.nome || c;
const ordemStatus = c => Number((S.base?.status_item || []).find(s => s.codigo === c)?.ordem ?? 0);
const nomeStatusPed = c => (S.base?.status_pedido || []).find(s => s.codigo === c)?.nome || c;
const badge = (txt, cls) => `<span class="badge ${cls || 'b-cinza'}">${esc(txt)}</span>`;
const badgeItem = c => badge(nomeStatusItem(c), COR_STATUS[c]);
const badgePed = (c, nome) => badge(nome || nomeStatusPed(c), COR_STATUS[c]);
const badgeFin = (c, nome) => c ? badge(nome, COR_FIN[c]) : '';

function trilho(pedido) {
  const at = ORDEM_PED[pedido.status];
  if (at === -1) return `<div class="trilho cancelado">${'<span></span>'.repeat(7)}</div>`;
  const cont = [0,0,0,0,0,0,0];
  (pedido.itens || []).forEach(i => { const o = ORDEM_ITEM[i.status]; if (o >= 0) cont[o]++; });
  return `<div class="trilho" title="${esc(pedido.status_nome || '')}">` + ETAPAS.map((e, k) => {
    const cls = at === 7 || k < at ? 'feito' : (k === at ? 'atual' : '');
    return `<span class="${cls}">${cont[k] && at !== 7 ? `<i>${cont[k]}</i>` : ''}</span>`;
  }).join('') + '</div>';
}
function trilhoGrande(pedido) {
  const at = ORDEM_PED[pedido.status];
  const cont = [0,0,0,0,0,0,0];
  (pedido.itens || []).forEach(i => { const o = ORDEM_ITEM[i.status]; if (o >= 0) cont[o]++; });
  return `<div class="trilho-grande">` + ETAPAS.map((e, k) => {
    const cls = at === 7 || (at >= 0 && k < at) ? 'feito' : (k === at ? 'atual' : '');
    return `<div class="${cls}">${esc(e[1])}<small>${cont[k] ? cont[k] + (cont[k] > 1 ? ' itens' : ' item') : ''}</small></div>`;
  }).join('') + '</div>';
}

/* ---------- sessão ---------- */
function salvarSessao(j) {
  S.token = j.token; S.usuario = j.usuario; S.perm = j.permissoes || {};
  try { localStorage.setItem('gvh_token', S.token); } catch {}
}
function sairLocal() {
  S.token = null; S.usuario = null; S.perm = {}; S.base = null;
  try { localStorage.removeItem('gvh_token'); } catch {}
  $('#app').classList.add('hidden'); $('#tela-login').classList.remove('hidden');
  $('#modais', document).innerHTML = '';
  VISTAS.forEach(v => v.el.remove()); VISTAS.clear(); S.vistaAtual = null;
}
async function carregarBase() { S.base = (await api('base')); atualizarListaSugestoes(); }
// V2: lista de produtos sugeridos usada pelo campo Produto (datalist do navegador)
function atualizarListaSugestoes() {
  let dl = document.getElementById('dl-sugestoes');
  if (!dl) { dl = document.createElement('datalist'); dl.id = 'dl-sugestoes'; document.body.appendChild(dl); }
  dl.innerHTML = (S.base?.sugestoes || []).filter(x => x.ativo).map(x => `<option value="${esc(x.texto)}"></option>`).join('');
}
const sugestaoPorTexto = t => (S.base?.sugestoes || []).find(x => x.ativo && x.texto === String(t || '').trim());

$('#form-login').addEventListener('submit', async e => {
  e.preventDefault();
  const d = formDados(e.target); const err = $('#login-erro'); err.classList.add('hidden');
  const btn = e.target.querySelector('button'); btn.disabled = true;
  try {
    const r = await api('login', d, true);
    salvarSessao(r); await iniciarApp();
  } catch (ex) { err.textContent = ex.message; err.classList.remove('hidden'); }
  finally { btn.disabled = false; }
});
$('#btn-sair').onclick = async () => { try { await api('logout', {}, true); } catch {} sairLocal(); };
$('#btn-menu').onclick = () => $('#lateral').classList.toggle('aberta');

async function iniciarApp() {
  await carregarBase();
  $('#tela-login').classList.add('hidden'); $('#app').classList.remove('hidden');
  $('#u-nome').textContent = S.usuario.nome;
  $('#u-perfil').textContent = S.perm.nome || S.usuario.perfil;
  montarMenu();
  iniciarAtualizacaoAutomatica();
  const inicial = S.perm.so_painel_arte ? '#/minhas-artes' : '#/inicio';
  if (!location.hash || (S.perm.so_painel_arte && !/^#\/(minhas-artes|artes-feitas|meus-pagamentos|arte-pedido|gabaritos)/.test(location.hash))) location.hash = inicial;
  else rotear();
}

/* ---------- menu e rotas ---------- */
function itensMenu() {
  const m = [];
  // AR2: o perfil Designer só usa o painel das artes dela
  if (S.perm.so_painel_arte) {
    m.push(['Minhas artes']);
    m.push(['#/minhas-artes', 'Artes em andamento']);
    m.push(['#/artes-feitas', 'Concluídas']);
    m.push(['#/meus-pagamentos', 'Meus pagamentos']);
    m.push(['#/gabaritos', 'Gabaritos']);
    return m;
  }
  m.push(['Operação']);
  m.push(['#/inicio', 'Início']);
  m.push(['#/pedidos', 'Pedidos']);
  if (pode('cria_pedidos')) m.push(['#/orcamentos', 'Orçamentos']);
  if (podeStatus('arte_em_aprovacao')) m.push(['#/arte', 'Arte']);
  if (podeStatus('em_producao') || podeStatus('despachado')) m.push(['#/producao', 'Pré-impressão e produção']);
  if (podeStatus('expedicao')) m.push(['#/expedicao', 'Expedição e entrega']);
  if (pode('ve_financeiro') || pode('cria_pedidos')) m.push(['Financeiro']);
  if (pode('ve_financeiro')) m.push(['#/financeiro', 'Contas a receber']);
  if (pode('edita_financeiro')) m.push(['#/conciliacao', 'Conciliação']);
  if (pode('ve_todas_comissoes') || pode('cria_pedidos')) m.push(['#/comissoes', 'Comissões']);
  m.push(['Cadastros']);
  m.push(['#/clientes', 'Clientes']);
  if (pode('gerencia_cadastros')) { m.push(['#/fornecedores', 'Fornecedores']); m.push(['#/categorias', 'Categorias']); }
  if (podeNovaCategoria()) m.push(['#/sugestoes', 'Produtos sugeridos']);
  m.push(['#/gabaritos', 'Gabaritos']);
  if (podeCadastrarFornecedor()) m.push(['#/regras-fornecedor', 'Regras de fornecedor']);
  if (pode('gerencia_cadastros')) m.push(['#/feriados', 'Feriados']);
  if (pode('gerencia_usuarios')) m.push(['#/usuarios', 'Usuários']);
  if (S.perm.gerencia_artes) m.push(['#/meus-pagamentos', 'Pagamentos das artes']);
  return m;
}
function montarMenu() {
  $('#menu').innerHTML = itensMenu().map(i => i.length === 1
    ? `<div class="grupo">${esc(i[0])}</div>`
    : `<a href="${i[0]}" data-rota="${i[0]}">${esc(i[1])}</a>`).join('');
}
const ROTAS = {};
function rota(nome, fn) { ROTAS[nome] = fn; }
// Telas de formulário nunca se atualizam sozinhas: o que foi digitado fica guardado até salvar ou descartar.
const ROTAS_FORM = new Set(['novo', 'orcamento']);
const VISTAS = new Map();   // chave da rota -> { el, nome, param, form, sujo, editando, topo, dados }
const MAX_VISTAS = 12;

function chaveRota() { return (location.hash || '#/inicio').replace(/^#\/?/, '') || 'inicio'; }
// vista dona de um elemento de tela (cada desenho sabe a que tela pertence, mesmo com outro desenho acontecendo ao mesmo tempo)
function vistaDoEl(el) { for (const v of VISTAS.values()) if (v.el === el) return v; return { el, descartada: true }; }
function definirTopoEm(el, titulo, acoes = '') {
  const v = vistaDoEl(el); if (v.descartada) return;
  const caixa = document.createElement('div'); caixa.innerHTML = acoes;
  const t = { titulo, acoes, nos: [...caixa.childNodes] };
  v.topo = t;
  if (v === S.vistaAtual) aplicarTopo(t);
}
function definirTopo(titulo, acoes = '') {
  const v = vistaRender();
  // guarda os próprios botões (e não só o HTML): ao voltar para a tela, os cliques ligados por código continuam funcionando
  const caixa = document.createElement('div'); caixa.innerHTML = acoes;
  const t = { titulo, acoes, nos: [...caixa.childNodes] };
  if (v) v.topo = t;
  if (!v || v === S.vistaAtual) aplicarTopo(t);
}
function aplicarTopo(t) {
  $('#titulo', document).textContent = t.titulo;
  const box = $('#topo-acoes', document);
  if (t.nos) box.replaceChildren(...t.nos); else box.innerHTML = t.acoes || '';
  document.title = (t.titulo || 'Sistema') + ' · GVH';
}
// vista que está sendo desenhada agora (ou a atual, se nenhuma)
const vistaRender = () => S.vistaEmRender || S.vistaAtual;

async function renderVista(v, manter) {
  // nunca desenha a mesma tela duas vezes ao mesmo tempo (o aviso do Realtime chegava no meio e quebrava a tela)
  if (v.renderizando) { v.renderDeNovo = true; return v.renderizando; }
  v.renderizando = (async () => {
    do {
      v.renderDeNovo = false;
      S.vistaEmRender = v;
      // atualizar a mesma tela: o conteúdo antigo fica até o novo chegar e a rolagem continua onde estava
      const y = window.scrollY, mesma = manter && v.el.innerHTML && v === S.vistaAtual;
      v.sujo = false; v.editando = false; if (!mesma) v.el.innerHTML = '';
      esconderAvisoNovidades();
      const fn = ROTAS[v.nome] || ROTAS.inicio;
      try { await fn(v.param, v.el); if (mesma) requestAnimationFrame(() => window.scrollTo(0, y)); }
      catch (e) { v.el.innerHTML = `<div class="alerta erro">${esc(e.message)}</div>`; }
      finally { if (S.vistaEmRender === v) S.vistaEmRender = null; }
    } while (v.renderDeNovo && VISTAS.get(chaveDe(v)) === v);
  })();
  try { await v.renderizando; } finally { v.renderizando = null; }
}
const chaveDe = v => { for (const [k, x] of VISTAS) if (x === v) return k; return null; };
function limparVistasAntigas() {
  if (VISTAS.size <= MAX_VISTAS) return;
  for (const [k, v] of VISTAS) {
    if (VISTAS.size <= MAX_VISTAS) break;
    if (v !== S.vistaAtual && !v.form) { v.el.remove(); VISTAS.delete(k); }
  }
}
function descartarVista(chave) { const v = VISTAS.get(chave); if (v) { v.el.remove(); VISTAS.delete(chave); } }

async function rotear() {
  if (!S.token) return;
  $('#lateral', document).classList.remove('aberta');
  const chave = chaveRota();
  const [nome, ...resto] = chave.split('/');
  const param = resto.length ? decodeURIComponent(resto.join('/')) : null;
  const nomeMenu = nome === 'novo' || nome === 'pedido' ? 'pedidos' : nome === 'orcamento' ? 'orcamentos'
    : nome === 'arte-pedido' ? (S.cache.voltarArte || (S.perm.so_painel_arte ? 'minhas-artes' : 'arte')) : nome;
  $$('#menu a', document).forEach(a => a.classList.toggle('ativo', a.dataset.rota === '#/' + nomeMenu));
  VISTAS.forEach(v => v.el.hidden = true);
  let v = VISTAS.get(chave);
  if (!v) {
    const el = document.createElement('div'); el.className = 'vista';
    $('#conteudo', document).appendChild(el);
    v = { el, nome, param, form: ROTAS_FORM.has(nome), sujo: true };
    // qualquer digitação dentro da tela trava a atualização automática dela
    el.addEventListener('input', e => { if (!e.target.closest('.filtros')) v.editando = true; });
    el.addEventListener('change', e => { if (e.target.matches('input,select,textarea') && !e.target.closest('.filtros')) v.editando = true; });
    VISTAS.set(chave, v);
  } else {
    // devolve para o fim da fila (mais recente)
    VISTAS.delete(chave); VISTAS.set(chave, v);
  }
  S.vistaAtual = v; v.el.hidden = false;
  if (v.topo) aplicarTopo(v.topo); else aplicarTopo({ titulo: '', acoes: '' });
  if (v.sujo && !v.form) await renderVista(v);
  else if (v.sujo && v.form && !v.el.innerHTML) await renderVista(v);
  else if (v.sujo) mostrarAvisoNovidades();
  limparVistasAntigas();
}
window.addEventListener('hashchange', rotear);
// "Atualizar": refaz a tela atual na hora
function recarregar() { const v = S.vistaAtual; if (v) renderVista(v, true); }

/* ---------- atualização automática (Realtime + rede de segurança) ---------- */
function marcarTelasDesatualizadas() {
  VISTAS.forEach(v => { if (!v.form) v.sujo = true; });
}
function podeAtualizarSozinha(v) {
  if (!v || v.form) return false;
  if ($('.fundo-modal', document)) return false;
  if (v.editando) return false;
  const ativo = document.activeElement;
  if (ativo && v.el.contains(ativo) && ativo.matches('input,select,textarea')) return false;
  if (v.el.querySelector('.sel-item:checked')) return false;
  return true;
}
function tentarAtualizarTelaAtual() {
  const v = S.vistaAtual; if (!v || !v.sujo) return;
  if (podeAtualizarSozinha(v)) renderVista(v, true);
  else if (!v.form || v.nome !== 'novo') mostrarAvisoNovidades();
}
function mostrarAvisoNovidades() {
  let a = $('#aviso-novidades', document);
  if (!a) {
    a = document.createElement('div'); a.id = 'aviso-novidades';
    a.innerHTML = `<span>Há alterações novas nesta tela.</span><button class="btn peq prim" type="button">Atualizar agora</button>`;
    a.querySelector('button').onclick = () => { esconderAvisoNovidades(); recarregar(); };
    document.body.appendChild(a);
  }
  a.hidden = false;
}
function esconderAvisoNovidades() { const a = $('#aviso-novidades', document); if (a) a.hidden = true; }

let canalRealtime = null, timerRealtime = null, timerSeguranca = null;
function iniciarAtualizacaoAutomatica() {
  if (!canalRealtime && window.supabase) {
    try {
      const cli = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
      const aviso = () => { clearTimeout(timerRealtime); timerRealtime = setTimeout(() => { marcarTelasDesatualizadas(); tentarAtualizarTelaAtual(); }, 800); };
      canalRealtime = cli.channel('gvh-mudancas', { config: { private: true } })
        .on('broadcast', { event: 'INSERT' }, aviso)
        .on('broadcast', { event: 'UPDATE' }, aviso)
        .on('broadcast', { event: 'DELETE' }, aviso)
        .subscribe();
    } catch (e) { console.warn('Realtime indisponível', e); }
  }
  clearInterval(timerSeguranca);
  timerSeguranca = setInterval(() => { if (document.visibilityState === 'visible') { marcarTelasDesatualizadas(); tentarAtualizarTelaAtual(); } }, INTERVALO_SEGURANCA_MS);
}

