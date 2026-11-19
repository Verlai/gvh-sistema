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
    if (!/^(login|sessao|base|resumo|listar_|obter_|buscar_|artes_pagamentos|arte_arquivo|comprovante_arquivo|calcular_preco|conferir_produto|verificar_documento|ncm_consultar|fornecedor_senha|orc_publico|prova_publica$|prova_publica_imagem|previa_cancelamento|gabaritos$|gabarito_historico$|gabarito_drive$|tarefas$|tarefa_salvar$)/.test(acao) && acao !== 'cadastro_publico' && !(acao === 'feriados' && !dados.salvar && !dados.excluir)) marcarTelasDesatualizadas();
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
function confirmar(texto, rotulo = 'Confirmar', perigo = false, { html = false } = {}) {
  return new Promise(res => {
    const m = abrirModal({ titulo: 'Confirmação', corpo: `<p style="margin:0">${html ? texto : esc(texto)}</p>`,
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
  removerBalaoTarefas();
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
  iniciarBalaoTarefas();
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
function aplicarTopo(t) {
  $('#titulo', document).textContent = t.titulo;
  const box = $('#topo-acoes', document);
  if (t.nos) box.replaceChildren(...t.nos); else box.innerHTML = t.acoes || '';
  document.title = (t.titulo || 'Sistema') + ' · GVH';
}

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
      // mudança só nas tarefas atualiza só o balão (as telas não mudam)
      let soTarefas = true;
      const aviso = m => {
        if ((m && m.payload && m.payload.tabela) !== 'tarefas') soTarefas = false;
        clearTimeout(timerRealtime);
        timerRealtime = setTimeout(() => {
          if (!soTarefas) { marcarTelasDesatualizadas(); tentarAtualizarTelaAtual(); }
          soTarefas = true; carregarTarefas();
        }, 800);
      };
      canalRealtime = cli.channel('gvh-mudancas', { config: { private: true } })
        .on('broadcast', { event: 'INSERT' }, aviso)
        .on('broadcast', { event: 'UPDATE' }, aviso)
        .on('broadcast', { event: 'DELETE' }, aviso)
        .subscribe();
    } catch (e) { console.warn('Realtime indisponível', e); }
  }
  clearInterval(timerSeguranca);
  timerSeguranca = setInterval(() => { if (document.visibilityState === 'visible') { marcarTelasDesatualizadas(); tentarAtualizarTelaAtual(); carregarTarefas(); } }, INTERVALO_SEGURANCA_MS);
}

/* ---------- balão de tarefas (canto inferior direito, em todas as telas) ----------
   JC e Fátima (config_sistema.tarefas_producao_usuarios): alertas da produção (mesma regra do e-mail, fn_producao_alertas)
   + anotações da produção, com responsável. Os outros: só anotações pessoais. Regras e permissão ficam no banco. */
// etiqueta curta de cada tipo de alerta (mesmos números do e-mail; 10 = site não lido) e a ordem de urgência
const TAREFA_TIPOS = {
  0: ['🔎 Código não achado', 'vermelho'], 1: ['🧾 Recusado/cancelado', 'vermelho'], 2: ['🚨 Prazo do cliente', 'vermelho'],
  10: ['⚠️ Site não lido', 'vermelho'], 3: ['⏱️ Prazo não bate', 'ambar'], 4: ['🔄 Prazo mudou', 'ambar'],
  5: ['📞 Cobrar fornecedor', 'ambar'], 8: ['📱 Confirmar', 'azul'], 6: ['📦 Pronto', 'verde'],
};
const TAREFA_PRIO = { 0: 0, 1: 1, 2: 2, 10: 3, 3: 4, 4: 5, 5: 6, 8: 7, 6: 8 };
const prioTarefa = t => t.tipo === 'producao' ? (TAREFA_PRIO[t.k] ?? 9) : 10;
const ddmm = v => v ? String(v).slice(8, 10) + '/' + String(v).slice(5, 7) : '—';
const linkSeguro = u => /^https:\/\/[^\s"'<>]+$/.test(String(u || '')) ? u : '';
const TF = { dados: null, aberto: false, soMinhas: false, mapa: {}, carregando: false, deNovo: false };

function iniciarBalaoTarefas() {
  if (!$('#tarefas-bolha', document)) {
    const b = document.createElement('button');
    b.id = 'tarefas-bolha'; b.type = 'button'; b.setAttribute('aria-label', 'Tarefas');
    b.innerHTML = `<span aria-hidden="true">✓</span><i hidden></i>`;
    b.onclick = () => abrirPainelTarefas(!TF.aberto);
    const p = document.createElement('div');
    p.id = 'tarefas-painel'; p.hidden = true; p.setAttribute('role', 'dialog'); p.setAttribute('aria-label', 'Tarefas');
    p.innerHTML = `<div class="tf-cab"><b>Tarefas</b>
        <div class="tf-filtro" hidden role="group" aria-label="Filtro"><button type="button" data-tf-f="0" class="ativo">Todas</button><button type="button" data-tf-f="1">Minhas</button></div>
        <button type="button" class="tf-fechar" aria-label="Fechar">×</button></div>
      <form class="tf-nova"><input name="texto" maxlength="500" placeholder="Nova anotação…" autocomplete="off">
        <select name="compartilhada" hidden aria-label="Quem vê"><option value="1">Produção</option><option value="0">Só eu</option></select>
        <button type="submit" aria-label="Adicionar">+</button></form>
      <div class="tf-lista"></div>`;
    p.querySelector('.tf-fechar').onclick = () => abrirPainelTarefas(false);
    p.querySelector('.tf-nova').onsubmit = salvarNovaTarefa;
    p.querySelectorAll('[data-tf-f]').forEach(bt => bt.onclick = () => {
      TF.soMinhas = bt.dataset.tfF === '1';
      p.querySelectorAll('[data-tf-f]').forEach(x => x.classList.toggle('ativo', x === bt));
      desenharTarefas();
    });
    p.addEventListener('keydown', e => { if (e.key === 'Escape') abrirPainelTarefas(false); });
    document.body.append(b, p);
    document.body.classList.add('com-tarefas');
  }
  carregarTarefas();
}
function removerBalaoTarefas() {
  ['#tarefas-bolha', '#tarefas-painel'].forEach(s => { const e = $(s, document); if (e) e.remove(); });
  document.body.classList.remove('com-tarefas', 'tf-aberto');
  Object.assign(TF, { dados: null, aberto: false, soMinhas: false, mapa: {} });
}
function abrirPainelTarefas(abrir) {
  const p = $('#tarefas-painel', document); if (!p) return;
  TF.aberto = abrir; p.hidden = !abrir; document.body.classList.toggle('tf-aberto', abrir);
  if (abrir) { desenharTarefas(); carregarTarefas(); p.querySelector('.tf-nova input').focus(); }
}
async function carregarTarefas() {
  if (!S.token || !$('#tarefas-bolha', document)) return;
  if (TF.carregando) { TF.deNovo = true; return; }
  TF.carregando = true;
  try {
    do { TF.deNovo = false; TF.dados = await api('tarefas', {}, true); desenharTarefas(); } while (TF.deNovo);
  } catch (e) { console.warn('Tarefas indisponíveis', e); }
  finally { TF.carregando = false; }
}
function desenharTarefas() {
  const b = $('#tarefas-bolha', document), p = $('#tarefas-painel', document), d = TF.dados;
  if (!b || !p || !d) return;
  const meu = S.usuario && S.usuario.id;
  const todas = d.tarefas || [];
  TF.mapa = Object.fromEntries(todas.map(t => [t.id, t]));
  const abertas = todas.filter(t => !t.feita_em), feitas = todas.filter(t => t.feita_em);
  // número no balão: o que está aberto e é da pessoa (alertas e anotações da produção com ela de responsável + as pessoais)
  const minhas = abertas.filter(t => !t.compartilhada || t.responsavel_id === meu);
  const n = d.producao ? minhas.length : abertas.length;
  const i = b.querySelector('i'); i.hidden = !n; i.textContent = n > 99 ? '99+' : n;
  b.classList.toggle('urgente', minhas.some(t => [0, 1, 2, 10].includes(t.k)));
  b.title = n ? `${n} tarefa${n > 1 ? 's' : ''} em aberto` : 'Tarefas';
  p.querySelector('.tf-nova select').hidden = !d.producao;
  p.querySelector('.tf-filtro').hidden = !d.producao;
  p.querySelector('.tf-nova').classList.toggle('com-sel', !!d.producao);
  if (!TF.aberto) return;

  const visiveis = abertas.filter(t => !TF.soMinhas || !t.compartilhada || t.responsavel_id === meu);
  const cartoes = [];
  // um cartão por pedido (o mais urgente em cima); tarefas sem pedido e anotações vêm depois
  const porPedido = new Map();
  visiveis.filter(t => t.tipo === 'producao' && t.pedido_id).forEach(t => {
    if (!porPedido.has(t.pedido_id)) porPedido.set(t.pedido_id, []);
    porPedido.get(t.pedido_id).push(t);
  });
  [...porPedido.values()]
    .map(l => l.sort((a, b) => prioTarefa(a) - prioTarefa(b)))
    .sort((a, b) => prioTarefa(a[0]) - prioTarefa(b[0]) || String(a[0].dados?.numero).localeCompare(String(b[0].dados?.numero), 'pt', { numeric: true }))
    .forEach(l => {
      const x = l[0].dados || {};
      const variosItens = new Set(l.map(t => t.dados?.item || '')).size > 1;
      cartoes.push(cartaoTarefas(
        `<a class="tf-ped" href="#/pedido/${esc(l[0].pedido_id)}" data-tf-ir>#${esc(x.numero)}</a><span class="tf-cli">${esc(x.cliente || '')}</span>`,
        l, d, variosItens, TAREFA_TIPOS[l[0].k]?.[1]));
    });
  const semPedido = visiveis.filter(t => t.tipo === 'producao' && !t.pedido_id);
  if (semPedido.length) cartoes.push(cartaoTarefas('<span class="tf-ped">Fornecedores</span>', semPedido, d, false, 'vermelho'));
  const notasProd = visiveis.filter(t => t.tipo === 'nota' && t.compartilhada);
  if (notasProd.length) cartoes.push(cartaoTarefas('<span class="tf-ped">📝 Anotações da produção</span>', notasProd, d));
  const pessoais = visiveis.filter(t => t.tipo === 'nota' && !t.compartilhada);
  if (pessoais.length) cartoes.push(cartaoTarefas(`<span class="tf-ped">${d.producao ? '🔒 Só minhas' : '📝 Minhas anotações'}</span>`, pessoais, d));
  if (!cartoes.length) cartoes.push(`<p class="tf-vazio">${TF.soMinhas ? 'Nada em aberto com você. 🎉' : 'Nada em aberto. 🎉'}</p>`);
  if (feitas.length) cartoes.push(blocoExp('tarefas-feitas', `Feitas hoje (${feitas.length})`,
    `<div class="tf-card tf-feitas">${feitas.map(t => linhaTarefa(t, d, true)).join('')}</div>`, false, 'leve'));

  const lista = p.querySelector('.tf-lista');
  lista.innerHTML = cartoes.join('');
  ligarTarefas(lista);
}
function cartaoTarefas(cab, lista, d, variosItens, cor) {
  return `<div class="tf-card ${cor ? 'tf-' + cor : ''}"><div class="tf-card-cab">${cab}</div>${lista.map(t => linhaTarefa(t, d, false, variosItens)).join('')}</div>`;
}
function linhaTarefa(t, d, comPedido, comItem) {
  const x = t.dados || {}, feita = !!t.feita_em, tp = TAREFA_TIPOS[t.k];
  const etiqueta = t.tipo === 'producao' && tp ? `<span class="tf-tag tf-${tp[1]}">${esc(tp[0])}</span>` : '';
  const resp = t.compartilhada && !feita && d.producao
    ? `<select class="tf-pill" data-tf-resp="${esc(t.id)}" aria-label="Responsável" title="Responsável">${(d.responsaveis || []).map(r =>
        `<option value="${esc(r.id)}" ${r.id === t.responsavel_id ? 'selected' : ''}>${esc(String(r.nome).split(' ')[0])}</option>`).join('')}</select>`
    : (t.compartilhada && t.responsavel ? `<span class="tf-pill fixa">${esc(String(t.responsavel).split(' ')[0])}</span>` : '');
  const linhas = [];
  if (comPedido && t.pedido_id) linhas.push(`<a href="#/pedido/${esc(t.pedido_id)}" data-tf-ir>#${esc(x.numero)}</a> ${esc(x.cliente || '')}`);
  if (comItem && x.item) linhas.push(`<span class="tf-item-nome">${esc(x.item)}</span>`);
  if (t.tipo === 'producao' && t.k !== 10) {
    const lk = linkSeguro(x.link);
    const forn = lk ? `<a href="${esc(lk)}" target="_blank" rel="noopener noreferrer" title="Abrir no site do fornecedor">${esc(x.forn || 'Fornecedor')} ↗</a>` : esc(x.forn || '—');
    linhas.push(`${forn}${x.codigo ? ` <span class="tf-cod">${esc(x.codigo)}</span>` : ''}`
      + ` · Forn. ${esc(ddmm(x.prev))}${x.prev && !x.prev_site ? '<span class="muted" title="Data anotada no sistema (não veio do site do fornecedor)">*</span>' : ''} · Cliente ${esc(ddmm(x.cli))}`);
  } else if (t.k === 10 && linkSeguro(x.link)) {
    linhas.push(`<a href="${esc(linkSeguro(x.link))}" target="_blank" rel="noopener noreferrer">Abrir o site da ${esc(x.forn || 'fornecedora')} ↗</a>`);
  } else if (t.tipo === 'nota' && t.compartilhada && t.autor) {
    linhas.push(`Anotado por ${esc(t.autor)}`);
  }
  const info = feita
    ? `<button type="button" class="tf-info" data-tf-info="${esc(t.id)}" aria-label="Por que foi finalizada" title="Informação">i</button>` : '';
  const apagar = t.tipo === 'nota' && !feita
    ? `<button type="button" class="tf-x" data-tf-x="${esc(t.id)}" aria-label="Excluir anotação" title="Excluir">×</button>` : '';
  return `<div class="tf-item ${feita ? 'feita' : ''}" data-tf="${esc(t.id)}">
      <input type="checkbox" data-tf-ok="${esc(t.id)}" ${feita ? 'checked' : ''} ${feita && t.feita_sistema ? 'disabled' : ''} aria-label="Feito">
      <div class="tf-corpo">${etiqueta || resp ? `<div class="tf-topo">${etiqueta}${resp}</div>` : ''}
        <div class="tf-txt">${esc(t.texto)}</div>${linhas.length ? `<div class="tf-det">${linhas.join('<br>')}</div>` : ''}
        <div class="tf-motivo" hidden></div></div>${info}${apagar}</div>`;
}
function ligarTarefas(el) {
  el.querySelectorAll('[data-tf-ok]').forEach(c => c.onchange = async () => {
    const id = c.dataset.tfOk, linha = c.closest('.tf-item');
    linha.classList.toggle('feita', c.checked); c.disabled = true;
    try { await api('tarefa_salvar', { id, feita: c.checked }); }
    catch { c.checked = !c.checked; linha.classList.toggle('feita', c.checked); }
    setTimeout(carregarTarefas, c.checked ? 600 : 0);
  });
  el.querySelectorAll('[data-tf-resp]').forEach(s => s.onchange = async () => {
    try { await api('tarefa_salvar', { id: s.dataset.tfResp, responsavel_id: s.value }); }
    finally { carregarTarefas(); }
  });
  el.querySelectorAll('[data-tf-x]').forEach(bt => bt.onclick = async () => {
    if (!await confirmar('Excluir esta anotação?', 'Excluir', true)) return;
    try { await api('tarefa_salvar', { id: bt.dataset.tfX, excluir: true }); } finally { carregarTarefas(); }
  });
  el.querySelectorAll('[data-tf-info]').forEach(bt => bt.onclick = () => {
    const t = TF.mapa[bt.dataset.tfInfo], m = bt.closest('.tf-item').querySelector('.tf-motivo');
    if (!t || !m) return;
    m.textContent = t.feita_sistema ? (t.motivo || 'Finalizada pelo sistema.') : `Feita por ${t.feita_por || '—'} em ${dataHora(t.feita_em)}.`;
    m.hidden = !m.hidden;
  });
  el.querySelectorAll('[data-tf-ir]').forEach(a => a.addEventListener('click', () => abrirPainelTarefas(false)));
}
async function salvarNovaTarefa(e) {
  e.preventDefault();
  const f = e.target, inp = f.querySelector('input'), texto = inp.value.trim();
  if (!texto) { inp.focus(); return; }
  const btn = f.querySelector('button');
  await ocupado(btn, async () => {
    try {
      await api('tarefa_salvar', { texto, compartilhada: !!(TF.dados && TF.dados.producao) && f.querySelector('select').value === '1' });
      inp.value = '';
    } catch {}
  });
  carregarTarefas(); inp.focus();
}
