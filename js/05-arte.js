/* ---------- ARTE ---------- */
rota('arte', async (_p, el) => {
  S.cache.voltarArte = 'arte';
  const designers = S.base?.designers || [];
  definirTopoEm(el, 'Arte', `<button class="btn" onclick="recarregar()">Atualizar</button>`);
  const f = S.cache.abaArte || (S.cache.abaArte = 'em_andamento');
  const fl = S.cache.filtroArteFila || (S.cache.filtroArteFila = 'todos');
  const des = S.cache.desArte || '';
  const abas = [['em_andamento', 'Em andamento'], ['concluidas', 'Concluídas'], ['todas', 'Todas']];
  const b = S.cache.buscaArte || '';
  const vd = S.cache.vendArte || '';
  const r = await api('listar_artes', { situacao: f, designer_id: des || null, vendedor_id: vd || null, busca: b || null, limite: 100 });
  vistaDoEl(el).artes = r.artes;
  await carregarGabaritos().catch(() => {});
  el.innerHTML = `
    <div class="chips" style="margin-bottom:14px">${abas.map(([k, n]) => `<button class="chip ${f === k ? 'ativo' : ''}" onclick="S.cache.abaArte='${k}';recarregar()">${n}</button>`).join('')}</div>
    ${barraFiltroArte({ artes: r.artes, filtro: fl, busca: b, aoFiltrar: 'filtrarFilaArte', idBusca: 'b-arte',
      vendedores: S.base?.vendedores || [], vendSel: vd, idVend: 'f-vend-arte', designers, desSel: des, idDes: 'f-des-arte' })}
    <p class="small muted">${r.total} arte(s)${b || vd || des ? ' no filtro' : ''}.</p>
    ${listaArtesResumo(r.artes.filter(filtroArteFn(fl)), 'interno')}`;
  ligarBuscaArte(el, '#b-arte', 'buscaArte');
  ligarFiltroArte(el, '#f-vend-arte', 'vendArte');
  ligarFiltroArte(el, '#f-des-arte', 'desArte');
  preencherArquivosArte(el);
});
function filtrarFilaArte(k) { S.cache.filtroArteFila = k; recarregar(); }
async function moverItem(id, status) { await api('mudar_status_itens', { itens: [id], status }); toast(`Item movido para ${nomeStatusItem(status)}.`); recarregar(); }
function modalArte(id) {
  const i = S.vistaAtual.dados.find(x => x.id === id);
  const m = abrirModal({ titulo: `Arte · ${i.descricao}`, corpo: `
    <form id="f-arte" class="grade">
      <label class="campo">Link da prova / aprovação<input type="text" name="arte_url" value="${esc(i.arte_url || '')}"></label>
      <label class="campo">Link da arte no Drive<input type="text" name="arte_drive_url" value="${esc(i.arte_drive_url || '')}"></label>
      <label class="campo">Enviar arte final (produção)<input type="file" id="arq" multiple accept=".pdf,.png,.jpg,.jpeg,.webp,.tif,.tiff,.ai,.eps,.psd,.cdr,.svg,.zip"></label>
      <label class="campo">Identificação <span class="muted">(opcional — ex.: Frente, Verso, Faca)</span><input type="text" id="arq-rot" maxlength="40"></label>
    </form>`, rodape: `<button class="btn" data-v>Voltar</button><button class="btn prim" data-s>Salvar</button>` });
  m.el.querySelector('[data-v]').onclick = m.fechar;
  m.el.querySelector('[data-s]').onclick = async () => {
    await api('salvar_item', { id, ...formDados($('#f-arte', m.el)) });
    for (const arq of [...$('#arq', m.el).files]) {
      try { await enviarArquivoDrive(i.pedido_id, arq, 'producao', id, $('#arq-rot', m.el).value.trim()); }
      catch (e) { toast(`${arq.name}: ${e.message}`, true); }
    }
    m.fechar(); toast('Arte atualizada.'); recarregar();
  };
}

/* ---------- ARTES (AR2) ---------- */
// Situações da arte. A designer move a arte; o item anda sozinho conforme as artes dele.
const ARTE_SIT = {
  a_fazer: ['Arte pendente', 'b-cinza'], em_criacao: ['Em andamento', 'b-azul'],
  em_alteracao: ['Em andamento', 'b-azul'], aguardando_cliente: ['Em aprovação', 'b-ambar'],
  pausada: ['Pausada · com o vendedor', 'b-vermelho'], aprovada: ['Aprovado pelo cliente', 'b-azul'],
  pronta: ['Arquivo pronto para impressão', 'b-verde'], resolvida_vendedor: ['Resolvida pelo vendedor', 'b-cinza'],
  cancelada: ['Cancelada', 'b-vermelho']
};
const badgeArte = s => badge((ARTE_SIT[s] || [s])[0], (ARTE_SIT[s] || [, 'b-cinza'])[1]);
// Cada pessoa tem uma cor no cadastro (Cadastros › Usuários). Sem cor, cai numa cor
// derivada do nome, para nunca ficar sem identificação visual.
const COR_PESSOA_PADRAO = '#5D6B73';
function corDaPessoa(nome, cor) {
  if (cor && /^#[0-9A-Fa-f]{6}$/.test(cor)) return cor;
  if (!nome) return COR_PESSOA_PADRAO;
  const p = ['#00838F', '#AD1457', '#5D4037', '#455A64', '#9E9D24', '#4527A0', '#C62828'];
  let h = 0; for (const c of String(nome)) h = (h * 31 + c.charCodeAt(0)) % 9973;
  return p[h % p.length];
}
// texto branco ou escuro conforme o que der mais contraste com a cor de fundo,
// medido pela regra de contraste da WCAG — serve para qualquer cor que o diretor escolher
function luminancia(hex) {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const contrasteEntre = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
const LUM_ESCURO = luminancia('#132A32');
function textoSobre(hex) {
  const L = luminancia(hex);
  return contrasteEntre(L, 1) >= contrasteEntre(L, LUM_ESCURO) ? '#fff' : '#132A32';
}
function tagPessoa(nome, cor, papel) {
  if (!nome) return '';
  const c = corDaPessoa(nome, cor);
  return `<span class="tag-pessoa" style="background:${c};color:${textoSobre(c)}" title="${esc(papel ? papel + ': ' + nome : nome)}">${esc(nome)}${papel ? `<span class="papel">${esc(papel)}</span>` : ''}</span>`;
}
const soPainelArte = () => !!S.perm.so_painel_arte;
const gerenciaArtes = () => !!S.perm.gerencia_artes;
const arteTipos = () => (S.base?.arte_tipos || []).filter(t => t.ativo);
const nomeTipoArte = c => (S.base?.arte_tipos || []).find(t => t.codigo === c)?.nome || c;

function tempoCurto(seg) {
  const s = Math.max(0, Math.round(Number(seg) || 0));
  if (s < 60) return s + ' s';
  const m = Math.round(s / 60); if (m < 60) return m + ' min';
  const h = Math.floor(m / 60), mm = m % 60;
  if (h < 24) return h + 'h' + (mm ? ' ' + mm + 'min' : '');
  const d = Math.floor(h / 24); return d + (d === 1 ? ' dia' : ' dias') + (h % 24 ? ' ' + (h % 24) + 'h' : '');
}
function etiquetasArte(a) {
  const e = [];
  if (a.urgente) e.push(badge('URGENTE', 'b-vermelho'));
  if (a.entrega_atrasada) e.push(badge('ATRASADO', 'b-vermelho'));
  if (a.tempo_estourado) e.push(badge('Passou do tempo previsto', 'b-ambar'));
  if (a.situacao === 'aprovada') e.push(badge('FALTA FECHAR O ARQUIVO', 'b-ambar'));
  if (a.situacao === 'em_alteracao') e.push(badge('Alteração pedida', 'b-ambar'));
  if (a.falta_pagamento) e.push(badge('Falta pagamento', 'b-ambar'));
  return e.join(' ');
}
// Botões da designer: um passo por vez, na ordem do trabalho dela.
/* ---------- AR3c: montador de provas (arquivo montador.js, carregado só no clique) ---------- */
const podeMontarProva = a => ['a_fazer', 'em_criacao', 'em_alteracao', 'aguardando_cliente'].includes(a.situacao) && !!a.item_id;
let carregandoMontador = null;
async function copiarLinkProva(chave) {
  const link = location.origin + location.pathname + '#/prova/' + chave;
  try { await navigator.clipboard.writeText(link); toast('Link de aprovação copiado.'); } catch (e) { prompt('Copie o link:', link); }
}
async function carregarMontador() {
  if (!window.abrirMontador) {
    carregandoMontador = carregandoMontador || new Promise((ok, falha) => {
      const sc = document.createElement('script'); sc.src = 'montador.js?v=20261027a';
      sc.onload = ok; sc.onerror = () => { carregandoMontador = null; falha(new Error('Não foi possível abrir o montador de provas. Atualize a página (Ctrl+F5).')); };
      document.head.appendChild(sc);
    });
    try { await carregandoMontador; } catch (e) { toast(e.message, true); return false; }
  }
  return true;
}
async function montarProva(arteId) { if (await carregarMontador()) window.abrirMontador(arteId); }
// Vendedor (ou quem for) testa o arquivo do cliente contra o gabarito do item: só na tela, nada é salvo nem enviado
async function testarArquivo(itemId) {
  const v = S.vistaAtual || {};
  const i = ((v.dados && v.dados.itens) || []).find(x => x.id === itemId);
  const a = (v.artes || []).find(x => x.item_id === itemId);
  const item = i ? { item_descricao: i.descricao, urgencia: i.urgencia } : a ? { item_descricao: a.item_descricao, urgencia: a.urgencia } : null;
  if (!item) return toast('Item não encontrado. Atualize a tela.', true);
  // AR4 caminho direto: arquivo do cliente dentro do gabarito vai como arquivo para impressão
  const pend = (v.artes || []).filter(x => x.item_id === itemId && ['a_fazer', 'em_criacao', 'aguardando_cliente', 'em_alteracao', 'pausada', 'aprovada'].includes(x.situacao));
  const statusItem = i ? i.status : a && a.item_status;
  const podeVend = !pode('so_painel_arte') && (pode('cria_pedidos') || gerenciaArtes());
  let direto = null;
  if (podeVend && ITEM_NA_ARTE.includes(statusItem)) {
    if (pend.length === 1) direto = { arte: pend[0], motivo: null };
    else direto = { arte: null, motivo: pend.length > 1 ? 'Este item tem mais de uma arte em andamento: use o caminho normal (arte por arte).'
                                                     : 'Este item não tem arte em andamento.' };
    if (direto.arte && item.urgencia && item.urgencia.digital && item.urgencia.digital.digital)
      direto = { arte: null, motivo: 'Item na impressão digital: a folha montada (A4/SRA3) é feita pela designer. Use o caminho normal.' };
  }
  if (await carregarMontador()) window.abrirMontador(null, { teste: true, item, direto, aoUsar: usarArquivoCliente });
}
// Envia os arquivos do cliente como arquivo para impressão e encerra a arte (resolvida pelo vendedor)
async function usarArquivoCliente(arte, files, conf, aoProgresso) {
  let confirmarDesigner = false;
  if (arte.situacao !== 'a_fazer') {
    if (!(await confirmar(`${arte.designer_nome || 'A designer'} já começou esta arte. Usar o arquivo do cliente encerra a arte sem pagamento à designer. Continuar?`, 'Usar o arquivo do cliente'))) return null;
    confirmarDesigner = true;
  }
  const ids = [];
  for (const [k, f] of files.entries()) {
    ids.push(await enviarArquivoDrive(arte.pedido_id, f, 'producao', arte.item_id, files.length > 1 ? `Cliente ${k + 1}` : 'Arquivo do cliente',
      fr => aoProgresso && aoProgresso(`Enviando ${f.name}… ${Math.round(fr * 100)}%`), null, { arte_id: arte.id }));
  }
  const r = await api('arte_usar_arquivo_cliente', { arte_id: arte.id, arquivo_ids: ids, confirmar: confirmarDesigner, conferencia: conf });
  toast(r.pre_impressao ? 'Arquivo do cliente enviado: o item foi para a pré-impressão.'
      : r.falta_pagamento ? 'Arquivo do cliente enviado. O item vai para a pré-impressão sozinho quando o pagamento entrar (ou o pedido for autorizado).'
      : r.item_status === 'arte_aprovada' ? 'Arquivo do cliente enviado: o item está pronto para a pré-impressão.'
      : 'Arquivo do cliente enviado e arte resolvida pelo vendedor.');
  recarregar();
  return r;
}
// Linha "Prova v2 · com o cliente desde…" no quadro da arte
function linhaProva(a) {
  const pv = a.prova; if (!pv) return '';
  const sit = { enviada: 'com o cliente', aprovada: 'aprovada', alteracao: 'cliente pediu alteração', substituida: 'substituída' }[pv.situacao] || pv.situacao;
  return `<div class="small muted" style="margin-top:6px">Prova v${pv.versao}${pv.modo === '3d' ? ' (3D)' : ''}${pv.final ? ' · <b>arte pronta para impressão</b>' : ''} · ${sit}${pv.decidido_nome ? ' por ' + esc(pv.decidido_nome) : ''} · ${dataHora(pv.decidido_em || pv.em)}</div>`;
}
function acoesDesigner(a) {
  const b = [];
  if (a.situacao === 'a_fazer') b.push(`<button class="btn prim peq" onclick="arteSituacao('${a.id}','em_criacao')">Começar a arte</button>`);
  if (podeMontarProva(a)) b.push(`<button class="btn prim peq" onclick="montarProva('${a.id}')">${a.situacao === 'aguardando_cliente' ? 'Nova versão da prova' : 'Montar prova'}</button>`);
  if (a.situacao === 'em_criacao' || a.situacao === 'em_alteracao') b.push(`<button class="btn peq" onclick="arteSituacao('${a.id}','aguardando_cliente')" title="Use quando a prova foi mandada por fora do sistema">Enviei a prova por fora</button>`);
  if (a.situacao === 'aguardando_cliente') {
    b.push(`<button class="btn prim peq" onclick="arteSituacao('${a.id}','aprovada')">Cliente aprovou</button>`);
    b.push(`<button class="btn peq" onclick="modalAlteracaoCliente('${a.id}')">Cliente pediu alteração</button>`);
  }
  if (a.situacao === 'em_criacao' || a.situacao === 'em_alteracao') b.push(`<button class="btn peq" onclick="modalAlteracaoCliente('${a.id}', true)" title="O cliente quer mudar quantidade, tamanho, papel… — a arte fica com o vendedor">Pausar (alteração no material)</button>`);
  if (a.situacao === 'aprovada') {
    b.push(`<button class="btn prim peq" onclick="modalFecharArte('${a.id}')">Enviar arquivo para impressão</button>`);
    b.push(`<button class="btn peq" onclick="modalAlteracaoCliente('${a.id}', true)">Pausar (alteração no material)</button>`);
  }
  if (a.situacao === 'pausada') b.push(`<span class="small muted">Aguardando o vendedor ajustar o material.</span>`);
  return b.join(' ');
}
function acoesVendedorArte(a, pode) {
  if (!pode) return '';
  const b = [];
  if (podeMontarProva(a) && a.designer_id) b.push(`<button class="btn peq" onclick="montarProva('${a.id}')">${a.situacao === 'aguardando_cliente' ? 'Nova versão da prova' : 'Montar prova'}</button>`);
  if (a.situacao === 'aguardando_cliente') {
    b.push(`<button class="btn prim peq" onclick="arteSituacao('${a.id}','aprovada')">Cliente aprovou</button>`);
    b.push(`<button class="btn peq" onclick="modalAlteracaoCliente('${a.id}')">Cliente pediu alteração</button>`);
  }
  if (a.situacao === 'pausada') b.push(`<button class="btn prim peq" onclick="arteSituacao('${a.id}','em_alteracao',2)">Material ajustado · devolver para a designer</button>`);
  if (a.situacao === 'aprovada' || a.situacao === 'pronta') b.push(`<button class="btn peq" onclick="arteSituacao('${a.id}','em_alteracao',1)">Devolver para a designer</button>`);
  if (['a_fazer', 'em_criacao', 'aguardando_cliente', 'em_alteracao', 'pausada', 'aprovada'].includes(a.situacao)) {
    b.push(`<button class="btn peq" onclick="modalArteEditar('${a.id}')">Editar</button>`);
    b.push(`<button class="btn peq" onclick="arteResolverVendedor('${a.id}')">Resolvida pelo vendedor</button>`);
  }
  return b.join(' ');
}

// Filtros rápidos da fila. Cada um é uma pergunta que a equipe faz de verdade no dia a dia.
const FILTROS_ARTE = [
  ['todos', 'Todos', () => true],
  ['urgentes', 'Urgentes', a => a.urgente || urgenteProducao(a.urgencia)],
  ['a_fazer', 'Artes pendentes', a => a.situacao === 'a_fazer'],
  ['em_criacao', 'Em andamento', a => a.situacao === 'em_criacao' || a.situacao === 'em_alteracao'],
  ['em_alteracao', 'Alteração pedida', a => a.situacao === 'em_alteracao'],
  ['aguardando_cliente', 'Em aprovação', a => a.situacao === 'aguardando_cliente'],
  ['aprovada', 'Fechar arquivo', a => a.situacao === 'aprovada'],
  ['pausada', 'Pausadas', a => a.situacao === 'pausada'],
  ['atrasados', 'Atrasados', a => a.entrega_atrasada || a.tempo_estourado],
  ['sem_designer', 'Sem designer', a => !a.designer_id]
];
// Barra de filtros das telas de arte: busca por pedido, cliente, material, vendedor ou designer,
// no mesmo padrão da tela de Pedidos, mais os chips de situação.
function barraFiltroArte({ artes, filtro, busca, aoFiltrar, idBusca, designers, desSel, idDes, vendedores, vendSel, idVend }) {
  return `<div class="painel filtros">
    <div class="linha-form">
      <label class="campo" style="flex:2">Buscar<input type="search" id="${idBusca}" value="${esc(busca || '')}"
        placeholder="Número do pedido ou nome do cliente"></label>
      ${vendedores && vendedores.length ? `<label class="campo">Vendedor<select id="${idVend}"><option value="">Todos</option>
        ${vendedores.map(v => `<option value="${v.id}" ${vendSel === v.id ? 'selected' : ''}>${esc(v.nome)}</option>`).join('')}</select></label>` : ''}
      ${designers && designers.length ? `<label class="campo">Designer<select id="${idDes}"><option value="">Todas</option>
        ${designers.map(d => `<option value="${d.id}" ${desSel === d.id ? 'selected' : ''}>${esc(d.nome)}</option>`).join('')}</select></label>` : ''}
    </div>
    ${chipsFiltroArte(artes, filtro, aoFiltrar, true)}
  </div>`;
}
// liga um dropdown de filtro das telas de arte
function ligarFiltroArte(el, sel, chave) {
  const c = el.querySelector(sel); if (!c) return;
  c.onchange = () => { S.cache[chave] = c.value; recarregar(); };
}
function chipsFiltroArte(artes, atual, aoClicar, dentroDoPainel) {
  return `<div class="chips" style="margin-${dentroDoPainel ? 'top' : 'bottom'}:14px">${FILTROS_ARTE.map(([k, n, teste]) => {
    const q = artes.filter(teste).length;
    if (!q && k !== 'todos' && k !== atual) return '';
    return `<button class="chip ${atual === k ? 'ativo' : ''}" onclick="${aoClicar}('${k}')">${n} (${q})</button>`;
  }).join('')}</div>`;
}
const filtroArteFn = k => (FILTROS_ARTE.find(f => f[0] === k) || FILTROS_ARTE[0])[2];
// pedidos abertos no "ver mais" — guardado por tela, para não fechar sozinho ao atualizar
const abertoArte = (nome, id) => !!(S.cache.artesAbertas?.[nome]?.[id]);
function alternarPedidoArte(nome, id) {
  S.cache.artesAbertas = S.cache.artesAbertas || {};
  const m = (S.cache.artesAbertas[nome] = S.cache.artesAbertas[nome] || {});
  m[id] = !m[id]; recarregar();
}
// Resumo do pedido: o que a pessoa precisa para decidir se abre ou não.
function resumoArtes(lista) {
  const por = {};
  lista.forEach(a => { por[a.situacao] = (por[a.situacao] || 0) + 1; });
  const ordem = ['a_fazer', 'em_criacao', 'em_alteracao', 'aguardando_cliente', 'pausada', 'aprovada', 'pronta', 'resolvida_vendedor', 'cancelada'];
  return ordem.filter(k => por[k]).map(k => `${badge((por[k] > 1 ? por[k] + ' ' : '') + (ARTE_SIT[k] || [k])[0], (ARTE_SIT[k] || [, 'b-cinza'])[1])}`).join(' ');
}

// Um card por pedido, com as artes dele agrupadas por item — é assim que a equipe de arte trabalha hoje.
// Fechado mostra só o resumo; "Ver mais" abre os itens.
// Lista: um card-resumo por pedido; clicar abre a tela "Artes do pedido" (uma de cada vez, como em Pedidos).
// detalhe = true: é a própria tela do pedido, com tudo aberto.
function cardsArtesPorPedido(artes, modo, nomeTela, detalhe) {
  if (!artes.length) return '<div class="vazio">Nenhuma arte por aqui.</div>';
  const porPedido = new Map();
  artes.forEach(a => { if (!porPedido.has(a.pedido_id)) porPedido.set(a.pedido_id, []); porPedido.get(a.pedido_id).push(a); });
  return [...porPedido.values()].map(lista => {
    const p = lista[0];
    const porItem = new Map();
    lista.forEach(a => { const k = a.item_id || a.id; if (!porItem.has(k)) porItem.set(k, []); porItem.get(k).push(a); });
    const urgente = lista.some(a => a.urgente);
    const zap = p.cliente_whatsapp ? `<a class="btn peq" href="https://wa.me/${esc(p.cliente_whatsapp)}" target="_blank" rel="noopener">WhatsApp</a>` : '';
    const aberto = !!detalhe;
    const nItens = porItem.size, nArtes = lista.length;
    const urgProd = lista.find(a => a.urgencia?.nivel === 'muito_urgente') || lista.find(a => a.urgencia?.nivel === 'urgente');
    const alertas = [lista.some(a => a.entrega_atrasada) ? badge('ATRASADO', 'b-vermelho') : '',
                     urgProd ? badgeUrgencia(urgProd.urgencia) : '',
                     urgente ? badge('URGENTE', 'b-vermelho') : '',
                     lista.some(a => a.tempo_estourado) ? badge('Passou do tempo previsto', 'b-ambar') : '',
                     lista.some(a => a.falta_pagamento) ? badge('Falta pagamento', 'b-ambar') : ''].filter(Boolean).join(' ');
    return `
    <div class="painel ${detalhe ? '' : 'clicavel'}" ${detalhe ? '' : `data-abrir-arte="${p.pedido_id}"`} style="${urgente || urgProd ? 'border-left:3px solid var(--vermelho)' : ''}">
      <div class="painel-cab">
        <div>
          <h2 style="margin:0">Pedido ${esc(p.pedido_numero)} · ${esc(p.cliente_nome || 'Sem cliente')}</h2>
          <div class="small muted">Entrega prevista ${data(p.data_prevista_entrega)} · ${nItens} ${nItens === 1 ? 'material' : 'materiais'} · ${nArtes} ${nArtes === 1 ? 'arte' : 'artes'}</div>
          <div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap;align-items:center">
            ${tagPessoa(p.vendedor_nome, p.vendedor_cor, 'vendedor')}
            ${[...new Set(lista.filter(a => a.designer_nome).map(a => a.designer_nome + '|' + (a.designer_cor || '')))]
              .map(x => tagPessoa(x.split('|')[0], x.split('|')[1], 'designer')).join('')}
            ${lista.some(a => !a.designer_id) ? badge('Sem designer', 'b-ambar') : ''}
          </div>
          <div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap">${resumoArtes(lista)} ${alertas}</div>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">${zap}
          ${modo === 'designer' ? '' : `<a class="btn peq" href="#/pedido/${p.pedido_id}">Abrir pedido</a>`}
          ${detalhe ? '' : `<a class="btn peq prim" href="#/arte-pedido/${p.pedido_id}">Abrir</a>`}</div>
      </div>
      ${!aberto ? '' : `<div class="lista-exp" style="border-top:1px solid var(--linha);margin-top:12px">${[...porItem.values()].map(as => {
        const it = as[0];
        // resumo do item (fechado); ao abrir: gabarito, observação e cada arte com as ações
        const resumoItem = `<b>${esc(it.item_descricao)}</b>${it.quantidade ? ` <span class="small muted">${num(it.quantidade)} un</span>` : ''}
            ${as.length > 1 ? `<span class="small muted">· ${as.length} artes</span>` : ''} ${resumoArtes(as)} ${badgeUrgencia(it.urgencia)} ${seloSemGabarito(it.urgencia)}
            ${it.urgencia && it.urgencia.gabarito_nome ? `<span class="small muted">· ${esc(it.urgencia.grupo_nome || '')}${it.urgencia.grupo_nome ? ' — ' : ''}${esc(it.urgencia.gabarito_nome)}</span>` : ''}`;
        return `<div>${blocoExp('arte-ped-item-' + (it.item_id || it.id), resumoItem, `
          ${it.categoria_nome ? `<div class="small muted">${esc(catCurta(it.categoria_nome))}</div>` : ''}
          ${it.item_id ? htmlGabaritoItem(it.item_id, it.gabarito_grupo_id, it.urgencia,
              as.some(a => ['a_fazer', 'em_criacao', 'aguardando_cliente', 'em_alteracao', 'pausada', 'aprovada'].includes(a.situacao))
              && (modo === 'designer' || pode('cria_pedidos') || gerenciaArtes() || pode('gerencia_cadastros'))) : ''}
          ${it.item_observacao ? `<div class="small" style="margin-top:4px"><span class="muted">Observação:</span> ${esc(it.item_observacao)}</div>` : ''}
          ${as.map((a, k) => `
            <div style="margin-top:10px;padding:10px;background:var(--fundo-2, #f7f8f9);border-radius:8px">
              <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
                ${as.length > 1 ? `<span class="small muted">Arte ${k + 1}</span>` : ''}
                ${badgeArte(a.situacao)} ${badge(nomeTipoArte(a.tipo), 'b-cinza')} ${etiquetasArte(a)}
                ${a.valor != null ? badge(brl(a.valor), 'b-cinza') : ''}
              </div>
              ${a.instrucoes ? `<div class="small" style="margin-top:6px"><span class="muted">Instruções:</span> ${esc(a.instrucoes)}</div>` : ''}
              <div class="small muted" style="margin-top:6px">Na sua mão ${tempoCurto(a.seg_designer)} · Esperando o cliente ${tempoCurto(a.seg_cliente)}</div>${linhaProva(a)}
              ${modo !== 'designer' && a.designer_nome ? `<div style="margin-top:6px">${tagPessoa(a.designer_nome, a.designer_cor, 'designer')}</div>` : ''}
              <div data-arte-arq="${a.id}" data-arte-item="${a.item_id || ''}" class="small" style="margin-top:6px"></div>
              <div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap">
                ${modo === 'designer' ? acoesDesigner(a) : acoesVendedorArte(a, true)}
                ${a.item_id && modo === 'designer' && a.situacao !== 'cancelada' ? `<button class="btn peq" onclick="modalEnviarArteDesigner('${a.id}')">Enviar arquivo</button>` : ''}
                ${a.item_id && modo !== 'designer' && k === 0 ? `<button class="btn peq" onclick="testarArquivo('${a.item_id}')">Testar arquivo do cliente</button>` : ''}
                ${a.item_id ? `<button class="btn peq" onclick="modalConversaArte('${a.id}')">Conversa${a.ultima_mensagem_em ? ' •' : ''}</button>` : ''}
              </div>
            </div>`).join('')}`, porItem.size === 1)}</div>`;
      }).join('')}</div>`}
    </div>`;
  }).join('');
}

/* ---------- telas de arte simples (14/10, teste do dono): lista curta e, no pedido, o passo a passo de cada material ---------- */
const ITEM_NA_ARTE = ['arte_a_fazer', 'arte_em_alteracao', 'arte_em_aprovacao', 'arte_pausada', 'arte_fechando', 'arte_aprovada'];
const ORDEM_PRINCIPAL = {
  designer: ['em_alteracao', 'aprovada', 'a_fazer', 'em_criacao', 'aguardando_cliente', 'pausada', 'pronta', 'resolvida_vendedor', 'cancelada'],
  interno: ['pausada', 'aguardando_cliente', 'pronta', 'em_alteracao', 'aprovada', 'a_fazer', 'em_criacao', 'resolvida_vendedor', 'cancelada'] };
function chipArte(a, modo) {
  const d = modo === 'designer', paraEnviar = !d && a.situacao === 'pronta' && a.item_status === 'arte_aprovada';
  const m = { a_fazer: [d ? 'Começar' : 'Arte pendente', 'prox-fazer'], em_criacao: ['Em andamento', 'prox-fazer'],
    em_alteracao: ['Alteração pedida', 'prox-alerta'], aguardando_cliente: [d ? 'Esperando o cliente' : 'Com o cliente', 'prox-espera'],
    pausada: d ? ['Pausada (com o vendedor)', 'prox-espera'] : ['Ajustar o material', 'prox-alerta'],
    aprovada: d ? ['Fechar arquivo', 'prox-acao'] : ['Aprovado pelo cliente', 'prox-espera'],
    pronta: paraEnviar ? ['Enviar para pré-impressão', 'prox-acao'] : ['Arquivo pronto', 'prox-ok'],
    resolvida_vendedor: ['Resolvida pelo vendedor', 'prox-ok'], cancelada: ['Cancelada', 'prox-espera'] }[a.situacao] || [a.situacao, 'prox-espera'];
  return `<span class="proximo ${m[1]}">${esc(m[0])}</span>`;
}
const artePrincipal = (lista, modo) => { const o = ORDEM_PRINCIPAL[modo === 'designer' ? 'designer' : 'interno']; return [...lista].sort((x, y) => o.indexOf(x.situacao) - o.indexOf(y.situacao))[0]; };
function entregaCurta(lista) {
  const p = lista[0], u = lista.map(a => a.urgencia).find(x => x && x.dias_para_entrega != null) || {}, d = u.dias_para_entrega;
  const txt = d == null ? (p.data_prevista_entrega ? 'Entrega ' + data(p.data_prevista_entrega) : 'Sem previsão')
    : d < 0 ? 'Entrega atrasada' : d === 0 ? 'Entrega hoje' : d === 1 ? 'Entrega amanhã' : 'Entrega ' + data(p.data_prevista_entrega);
  const forte = d != null && d <= 1, cor = d != null && d <= 0 ? 'var(--vermelho)' : d === 1 ? '#9a6410' : 'var(--texto-2)';
  const urg = lista.some(a => a.urgente || urgenteProducao(a.urgencia));
  return `<span class="small" style="color:${cor};font-weight:${forte ? 600 : 400};white-space:nowrap">${txt}</span>${urg ? ' ' + badge('URGENTE', 'b-vermelho') : ''}`;
}
// Lista: uma linha por pedido — cliente, materiais, o próximo passo e a entrega
function listaArtesResumo(artes, modo) {
  if (!artes.length) return '<div class="painel"><div class="vazio">Nenhuma arte por aqui.</div></div>';
  const porPedido = new Map();
  artes.forEach(a => { if (!porPedido.has(a.pedido_id)) porPedido.set(a.pedido_id, []); porPedido.get(a.pedido_id).push(a); });
  return `<div class="painel lista-artes" style="padding:0">${[...porPedido.values()].map(lista => {
    const p = lista[0], prin = artePrincipal(lista, modo), mats = [...new Set(lista.map(a => a.item_descricao))];
    const iguais = lista.filter(a => a !== prin && a.situacao === prin.situacao).length;
    return `<a class="linha-arte" href="#/arte-pedido/${p.pedido_id}">
      <div style="min-width:0"><b>Pedido ${esc(p.pedido_numero)}</b> · ${esc(p.cliente_nome || 'Sem cliente')}
        <div class="small muted" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(mats.slice(0, 2).join(' · '))}${mats.length > 2 ? ` · +${mats.length - 2}` : ''}</div></div>
      <div>${chipArte(prin, modo)}${iguais ? ` <span class="small muted">+${iguais}</span>` : ''}${modo !== 'designer' && prin.designer_nome ? `<div class="small muted" style="margin-top:3px">${esc(prin.designer_nome)}</div>` : ''}</div>
      <div class="dir">${entregaCurta(lista)}</div></a>`;
  }).join('')}</div>`;
}
const PASSOS_ARTE = [['Pendente', ['a_fazer']], ['Em andamento', ['em_criacao', 'em_alteracao', 'pausada']], ['Em aprovação', ['aguardando_cliente']],
                     ['Aprovado pelo cliente', ['aprovada']], ['Arquivo pronto', ['pronta', 'resolvida_vendedor']]];
function passosArte(a) {
  const at = PASSOS_ARTE.findIndex(x => x[1].includes(a.situacao)), alerta = a.situacao === 'em_alteracao' || a.situacao === 'pausada';
  return `<div class="passos">${PASSOS_ARTE.map((x, i) => {
    const cls = i < at || (i === at && at === PASSOS_ARTE.length - 1) ? 'feito' : i === at ? 'atual' + (alerta ? ' alerta' : '') : '';
    const nome = i === at && a.situacao === 'pausada' ? 'Pausada (vendedor)' : i === at && a.situacao === 'em_alteracao' ? 'Alteração pedida' : x[0];
    return `<div class="${cls}">${nome}</div>`; }).join('')}</div>`;
}
// O pedido de alteração em destaque (do cliente, ou a devolução do vendedor)
function caixaAlteracao(a) {
  const alt = a.alteracao || {}, bruto = String(alt.texto || '');
  const daPre = /^Arte devolvida: pela pré-impressão/.test(bruto) && a.situacao === 'aprovada' && (!a.aprovada_em || !alt.em || new Date(alt.em) >= new Date(a.aprovada_em) - 5000);
  if (a.situacao !== 'em_alteracao' && a.situacao !== 'pausada' && !daPre) return '';
  const titulo = daPre ? 'URGENTE · A pré-impressão devolveu a arte: feche o arquivo para impressão de novo'
    : a.situacao === 'pausada' ? 'O cliente pediu mudança no material'
    : /^Arte devolvida:/.test(bruto) ? 'O vendedor devolveu a arte'
    : /^Material ajustado pelo vendedor:/.test(bruto) ? 'O vendedor ajustou o material'
    : /^Alteração no material:/.test(bruto) ? 'Voltou do vendedor (o cliente tinha pedido mudança no material)'
    : 'O cliente pediu alteração na arte';
  const txt = bruto.replace(/^(Alteração no material|Material ajustado pelo vendedor|Arte devolvida): (pela pré-impressão( \(URGENTE\))? — )?/, '');
  return `<div class="caixa-alteracao"><div class="tit">${titulo}</div>${txt ? `<div class="txt">${esc(txt)}</div>` : ''}${alt.em ? `<div class="small muted" style="margin-top:4px">${dataHora(alt.em)}</div>` : ''}</div>`;
}
// Item na digital: a designer monta a cartela na folha (SRA3 ou A4)
function linhaGabaritoDigital(u) {
  const l = u && u.digital && u.digital.digital && u.gabarito_digital; if (!l || !l.length) return '';
  return `<div class="small" style="margin-top:4px">${badge('Digital', 'b-digital')} <span class="muted">a designer monta a cartela na folha:</span> ${l.map(g => `<b>${esc(g.nome)}</b>${g.url ? ` · <a href="${esc(g.url)}" target="_blank" rel="noopener">abrir</a>` : ''}`).join(' · ')}</div>`;
}
function linhaGabaritoCurta(u) {
  if (!u) return '';
  if (u.digital && u.digital.digital && u.gabarito_digital) return (u.gabarito_nome ? `<div class="small" style="margin-top:4px"><span class="muted">Peça:</span> ${esc(u.grupo_nome || '')}${u.grupo_nome ? ' — ' : ''}${esc(u.gabarito_nome)}${u.gabarito_url ? ` · <a href="${esc(u.gabarito_url)}" target="_blank" rel="noopener">Abrir gabarito</a>` : ''}</div>` : '') + linhaGabaritoDigital(u);
  if (u.gabarito_nome) return `<div class="small" style="margin-top:4px"><span class="muted">Gabarito:</span> ${esc(u.grupo_nome || '')}${u.grupo_nome ? ' — ' : ''}${esc(u.gabarito_nome)}${u.gabarito_url ? ` · <a href="${esc(u.gabarito_url)}" target="_blank" rel="noopener">Abrir gabarito</a>` : ''}</div>`;
  return u.sem_gabarito ? '<div class="small muted" style="margin-top:4px">Sem gabarito neste material.</div>' : '';
}
// O que fazer agora em cada arte: um texto, o botão principal e o resto em "Mais opções"
function passoArteAcoes(a, modo, podeMexer) {
  const d = modo === 'designer', id = a.id, s = a.situacao, naArte = ITEM_NA_ARTE.includes(a.item_status);
  const B = (txt, fn, prim) => `<button class="btn ${prim ? 'prim' : ''} peq" onclick="${fn}">${txt}</button>`;
  let texto = '', bot = [], mais = [];
  const pausar = B('Pausar (alteração no material)', `modalAlteracaoCliente('${id}', true)`);
  if (d) {
    if (s === 'a_fazer') { texto = 'Comece quando for trabalhar nesta arte.'; bot.push(B('Começar a arte', `arteSituacao('${id}','em_criacao')`, 1)); }
    else if (s === 'em_criacao') { texto = 'Faça a arte e envie a prova para o cliente aprovar.'; bot.push(B('Montar prova', `montarProva('${id}')`, 1));
      mais.push(B('Enviei a prova por fora', `arteSituacao('${id}','aguardando_cliente')`), pausar); }
    else if (s === 'em_alteracao') { texto = 'Faça a alteração e envie a nova prova.'; bot.push(B('Montar nova prova', `montarProva('${id}')`, 1));
      mais.push(B('Enviei a prova por fora', `arteSituacao('${id}','aguardando_cliente')`), pausar); }
    else if (s === 'aguardando_cliente') { texto = 'A prova está com o cliente. Quando ele responder pelo link, a arte muda sozinha.';
      bot.push(B('Cliente aprovou', `arteSituacao('${id}','aprovada')`), B('Cliente pediu alteração', `modalAlteracaoCliente('${id}')`));
      mais.push(B('Nova versão da prova', `montarProva('${id}')`)); }
    else if (s === 'pausada') texto = 'A arte está com o vendedor. Quando ele ajustar o material, ela volta para você.';
    else if (s === 'aprovada') { texto = 'O cliente aprovou. Agora feche o arquivo para impressão.'; bot.push(B('Enviar arquivo para impressão', `modalFecharArte('${id}')`, 1)); mais.push(pausar); }
    else if (s === 'pronta') texto = a.item_status === 'arte_aprovada' ? 'Arquivo pronto. O vendedor vai enviar para a pré-impressão.' : 'Arquivo pronto. O material já seguiu para a pré-impressão.';
    else if (s === 'resolvida_vendedor') texto = 'Resolvida pelo vendedor.';
    if (a.item_id && naArte && s !== 'cancelada') mais.push(B('Enviar arquivo', `modalEnviarArteDesigner('${id}')`));
  } else {
    const comDesigner = a.designer_nome ? ` (${esc(a.designer_nome)})` : '';
    if (!a.designer_id && ['a_fazer', 'em_criacao', 'em_alteracao'].includes(s)) texto = 'Arte sem designer: escolha a designer do pedido.';
    else if (s === 'a_fazer') texto = `Com a designer${comDesigner}: ainda não começou.`;
    else if (s === 'em_criacao' || s === 'em_alteracao') texto = `Com a designer${comDesigner}: fazendo a arte.`;
    else if (s === 'aguardando_cliente') { texto = 'A prova está com o cliente.';
      if (podeMexer) bot.push(B('Cliente aprovou', `arteSituacao('${id}','aprovada')`), B('Cliente pediu alteração', `modalAlteracaoCliente('${id}')`)); }
    else if (s === 'pausada') { texto = 'O cliente pediu mudança no material. Ajuste o item no pedido e devolva para a designer.';
      if (podeMexer) bot.push(B('Material ajustado · devolver para a designer', `arteSituacao('${id}','em_alteracao',2)`, 1)); }
    else if (s === 'aprovada') texto = `Aprovado pelo cliente. A designer${comDesigner} vai fechar o arquivo para impressão.`;
    else if (s === 'pronta') {
      if (a.item_status === 'arte_aprovada' && podeStatus('pre_impressao')) { texto = 'Arquivo pronto para impressão. Confira e envie.'; bot.push(B('Enviar para pré-impressão', `enviarPreImpressao('${a.item_id}')`, 1)); }
      else texto = naArte ? 'Arquivo pronto para impressão.' : 'Arquivo pronto. O item já está na pré-impressão ou adiante.'; }
    else if (s === 'resolvida_vendedor') texto = 'Resolvida pelo vendedor.';
    if (podeMexer) {
      if (podeMontarProva(a) && a.designer_id) mais.push(B(s === 'aguardando_cliente' ? 'Nova versão da prova' : 'Montar prova', `montarProva('${id}')`));
      if ((s === 'aprovada' || s === 'pronta') && naArte) mais.push(B('Devolver para a designer', `arteSituacao('${id}','em_alteracao',1)`));
      if (['a_fazer', 'em_criacao', 'em_alteracao', 'aguardando_cliente', 'pausada', 'aprovada'].includes(s)) {
        mais.push(B('Editar', `modalArteEditar('${id}')`), B('Resolvida pelo vendedor', `arteResolverVendedor('${id}')`)); }
    } else bot = [];
  }
  if (a.item_id) mais.push(B('Conversa' + (a.ultima_mensagem_em ? ' •' : ''), `modalConversaArte('${id}')`));
  if (!d && a.item_id) mais.push(B('Testar arquivo do cliente', `testarArquivo('${a.item_id}')`));
  return { texto, bot, mais };
}
// Um material (item) com as artes dele: passo a passo, alteração em destaque e o próximo passo
function blocoMaterialArte(as, modo, o = {}) {
  const it = as[0], u = it.urgencia, podeMexer = o.podeMexer !== false;
  const urg = as.some(a => a.urgente) || urgenteProducao(u);
  const ativa = as.some(a => ['a_fazer', 'em_criacao', 'aguardando_cliente', 'em_alteracao', 'pausada', 'aprovada'].includes(a.situacao));
  return `<div class="material-arte">
    <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:baseline">
      <h3 style="font-size:16px;font-weight:700;margin:0">${esc(it.item_descricao)} <span class="small muted" style="font-weight:400">${it.quantidade ? num(it.quantidade) + ' un' : ''}</span></h3>
      <div>${urg ? badge('URGENTE', 'b-vermelho') : ''}${modo !== 'designer' && as.some(a => a.falta_pagamento) ? ' ' + badge('Falta pagamento', 'b-ambar') : ''}${seloConferencia(u && u.conferencia)}</div></div>
    ${linhaGabaritoCurta(u)}
    ${as.map((a, k) => { const ac = passoArteAcoes(a, modo, podeMexer);
      return `<div>${as.length > 1 ? `<div class="small" style="margin-top:12px;font-weight:600">Arte ${k + 1} de ${as.length}</div>` : ''}
        ${passosArte(a)}
        ${caixaAlteracao(a)}
        ${a.instrucoes ? `<div class="small" style="margin-top:6px"><b>Instruções do vendedor:</b> ${esc(a.instrucoes)}</div>` : ''}
        <div class="proximo-passo"><div class="o-que">${ac.texto}</div>${ac.bot.length ? `<div style="display:flex;gap:6px;flex-wrap:wrap">${ac.bot.join('')}</div>` : ''}</div>
        ${blocoExp('mais-arte-' + a.id, 'Mais opções e detalhes', `
          ${ac.mais.length ? `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">${ac.mais.join('')}</div>` : ''}
          ${linhaProva(a)}
          <div class="small muted" style="margin-top:6px">${esc(nomeTipoArte(a.tipo))} · designer ${tempoCurto(a.seg_designer)} · cliente ${tempoCurto(a.seg_cliente)}${a.seg_vendedor ? ' · vendedor ' + tempoCurto(a.seg_vendedor) : ''}${a.tempo_estourado ? ' · <b>passou do tempo previsto</b>' : ''}${a.valor != null ? ' · ' + brl(a.valor) : ''}</div>
          ${modo !== 'designer' && a.designer_nome ? `<div class="small muted">Designer: ${esc(a.designer_nome)}</div>` : ''}
          <div data-arte-arq="${a.id}" data-arte-item="${a.item_id || ''}" class="small" style="margin-top:6px"></div>
          ${k === 0 && it.item_id ? htmlGabaritoItem(it.item_id, it.gabarito_grupo_id, u, ativa && (modo === 'designer' || pode('cria_pedidos') || gerenciaArtes() || pode('gerencia_cadastros'))) : ''}
          ${k === 0 && it.item_observacao ? `<div class="small" style="margin-top:6px"><span class="muted">Observação do item:</span> ${esc(it.item_observacao)}</div>` : ''}
          ${k === 0 && o.extraItem ? o.extraItem : ''}`, false, 'leve')}</div>`; }).join('')}
  </div>`;
}
// Tela do pedido na arte: cabeçalho curto e um bloco por material
function detalheArtesPedido(artes, modo) {
  const p = artes[0];
  const porItem = new Map();
  artes.forEach(a => { const k = a.item_id || a.id; if (!porItem.has(k)) porItem.set(k, []); porItem.get(k).push(a); });
  const zap = p.cliente_whatsapp ? `<a class="btn peq" href="https://wa.me/${esc(p.cliente_whatsapp)}" target="_blank" rel="noopener">WhatsApp do cliente</a>` : '';
  return `<div class="painel" style="padding:14px 18px;margin-bottom:12px"><div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:center">
      <div><b style="font-size:17px">${esc(p.cliente_nome || 'Sem cliente')}</b>
        <div class="small muted">Vendedor: ${esc(p.vendedor_nome || '—')} · ${entregaCurta(artes)}</div></div>${zap}</div></div>
    ${[...porItem.values()].map(as => blocoMaterialArte(as, modo)).join('')}`;
}

async function arteSituacao(id, situacao, pedeObs) {
  let obs = null;
  if (pedeObs === 2) {
    obs = prompt('O que foi ajustado no material? (opcional — aparece na conversa da arte)');
    if (obs == null) return;
  } else if (pedeObs) {
    obs = prompt(situacao === 'em_alteracao' ? 'O que precisa mudar? (motivo da devolução)' : 'Observação:');
    if (obs == null || !obs.trim()) return;
  }
  try { await api('arte_situacao', { id, situacao, obs: obs ? obs.trim() : null }); toast('Arte atualizada.'); recarregar(); }
  catch (e) { toast(e.message, true); }
}
// O cliente só escreve; quem decide se é alteração na arte ou no material é a designer (ou o vendedor).
function modalAlteracaoCliente(id, soMaterial) {
  const a = (S.vistaAtual?.artes || []).find(x => x.id === id) || {};
  const m = abrirModal({ titulo: soMaterial ? 'Pausar: alteração no material' : 'Cliente pediu alteração', corpo: `
    ${soMaterial ? '' : `<div class="campo">Que tipo de alteração?
      <label class="caixa-linha" style="margin-top:6px"><input type="radio" name="tipo-alt" value="em_alteracao" checked>
        <span><b>Na arte</b><br><span class="small muted">Texto, cor, layout, foto… A arte volta para <b>Em andamento</b> com a designer.</span></span></label>
      <label class="caixa-linha" style="margin-top:6px"><input type="radio" name="tipo-alt" value="pausada">
        <span><b>No material</b><br><span class="small muted">Quantidade, tamanho, papel, acabamento… A arte fica <b>Pausada</b> e vai para o vendedor ajustar o pedido.</span></span></label></div>`}
    ${soMaterial ? '<p class="small muted" style="margin:0">A arte fica <b>Pausada · com o vendedor</b>. Quando ele ajustar o pedido, devolve para você.</p>' : ''}
    <label class="campo">O que o cliente pediu *<textarea id="alt-txt" rows="3" placeholder="Ex.: trocar o telefone / quer 500 unidades em vez de 250"></textarea></label>`,
    rodape: `<button class="btn" data-v>Voltar</button><button class="btn prim" data-s>Salvar</button>` });
  m.el.querySelector('[data-v]').onclick = m.fechar;
  const bs = m.el.querySelector('[data-s]');
  bs.onclick = async () => {
    const txt = m.el.querySelector('#alt-txt').value.trim();
    if (!txt) return toast('Escreva o que o cliente pediu.', true);
    const para = soMaterial ? 'pausada' : m.el.querySelector('[name=tipo-alt]:checked').value;
    try { await ocupado(bs, () => api('arte_situacao', { id, situacao: para, obs: txt })); m.fechar();
      toast(para === 'pausada' ? 'Arte pausada. O vendedor foi avisado.' : 'Arte de volta para Em andamento.'); recarregar(); } catch (e) {}
  };
}
// Fechar a arte = enviar o arquivo para impressão. É aqui que a designer passa a receber pela arte.
function modalFecharArte(id) {
  const a = (S.vistaAtual?.artes || []).find(x => x.id === id); if (!a) return;
  // item na digital: o arquivo para impressão é a folha montada (A4 22×32 ou SRA3 32×45); gabarito "cabe na área" (apostila) não precisa
  const gr = a.urgencia && a.urgencia.gabarito_medidas && a.urgencia.gabarito_medidas.regras;
  const dig = !!(a.urgencia && a.urgencia.digital && a.urgencia.digital.digital) && !(gr && gr.modo === 'area');
  let folhaOk = null;
  const m = abrirModal({ titulo: `Arquivo para impressão · ${a.item_descricao}`, corpo: `
    <p class="small muted" style="margin:0">O cliente aprovou a prova. Envie o arquivo final de produção (sem linhas de gabarito). Ao enviar, a arte fica <b>Arquivo pronto para impressão</b> e o vendedor pode mandar o item para a pré-impressão.</p>
    ${a.urgencia && (a.urgencia.gabarito_nome || a.urgencia.grupo_nome) ? `<p class="small" style="margin:8px 0 0"><span class="muted">Gabarito:</span> ${esc(a.urgencia.grupo_nome || '')}${a.urgencia.gabarito_nome ? ' — ' + esc(a.urgencia.gabarito_nome) : ''}</p>` : ''}
    ${dig ? `<div class="alerta" style="margin-top:8px"><b>Item na impressão digital</b>${a.urgencia.digital.motivo ? ` (${esc(a.urgencia.digital.motivo)})` : ''}: envie a <b>folha montada</b> em PDF (A4 22 × 32 cm ou SRA3 32 × 45 cm). O sistema confere o tamanho.</div>` : ''}
    <label class="campo">${dig ? 'Folha montada' : 'Arquivo(s)'} *<input type="file" id="fa-arq" multiple accept=".pdf,.png,.jpg,.jpeg,.tif,.tiff,.ai,.eps,.psd,.cdr,.svg,.zip"></label>
    <div id="fa-folha" class="small"></div>
    <label class="campo">Identificação <span class="muted">(opcional — ex.: Frente, Verso, Faca)</span><input type="text" id="fa-rot" maxlength="40" value="${dig ? 'Folha montada' : ''}"></label>
    <div id="fa-status" class="small"></div>`,
    rodape: `<button class="btn" data-v>Voltar</button><button class="btn prim" data-s>Enviar e fechar a arte</button>` });
  m.el.querySelector('[data-v]').onclick = m.fechar;
  if (dig) m.el.querySelector('#fa-arq').onchange = async () => {
    const box = m.el.querySelector('#fa-folha'), arqs = [...m.el.querySelector('#fa-arq').files]; folhaOk = null; box.innerHTML = '';
    if (!arqs.length || !(await carregarMontador())) return;
    const linhas = [];
    folhaOk = true;
    for (const f of arqs) {
      let md = null; try { md = await window.medirArquivoMm(f); } catch (e) {}
      const nome = md && window.folhaDigitalMm(md.w, md.h);
      if (!nome) folhaOk = false;
      linhas.push(!md ? `<span style="color:var(--vermelho)">${esc(f.name)}: não é PDF, o tamanho não foi conferido.</span>`
        : nome ? `<span style="color:#007a61">✓ ${esc(f.name)}: folha ${nome} (${fmtMm(Math.round(md.w))} × ${fmtMm(Math.round(md.h))} mm).</span>`
        : `<span style="color:var(--vermelho)">${esc(f.name)}: ${fmtMm(Math.round(md.w))} × ${fmtMm(Math.round(md.h))} mm, não é A4 (220 × 320) nem SRA3 (320 × 450).</span>`);
    }
    box.innerHTML = linhas.join('<br>');
  };
  const bs = m.el.querySelector('[data-s]');
  bs.onclick = async () => {
    const arqs = [...m.el.querySelector('#fa-arq').files];
    if (!arqs.length) return toast(dig ? 'Escolha a folha montada.' : 'Escolha o arquivo para impressão.', true);
    // AR3b: conferência do arquivo para impressão (só avisa; vermelho pede "enviar mesmo assim" com motivo)
    if (!(await carregarMontador())) return;
    const conf = await window.conferirArquivosParaImpressao({ files: arqs, urgencia: a.urgencia, descricao: a.item_descricao, prova: a.prova, folha: dig,
      limiteMb: (S.cache.gabaritos && S.cache.gabaritos.dados && S.cache.gabaritos.dados.limite_mb) || 100 });
    if (!conf) return;
    const st = m.el.querySelector('#fa-status'), rot = m.el.querySelector('#fa-rot').value.trim();
    bs.disabled = true; bs.classList.add('ocupado'); const ids = [];
    for (const arq of arqs) {
      try { ids.push(await enviarArquivoDrive(a.pedido_id, arq, 'producao', a.item_id, rot, f => { st.textContent = `Enviando ${arq.name}… ${Math.round(f * 100)}%`; }, null, { arte_id: a.id })); }
      catch (e) { toast(`${arq.name}: ${e.message}`, true); }
    }
    if (!ids.length) { bs.disabled = false; bs.classList.remove('ocupado'); st.textContent = ''; return; }
    try { await api('conferencia_registrar', { arte_id: a.id, arquivo_ids: ids, origem: 'fechar_arte', ...conf }, true); }
    catch (e) { toast('O arquivo foi enviado, mas a conferência não ficou registrada: ' + e.message, true); }
    try { const r = await api('arte_situacao', { id, situacao: 'pronta' }); m.fechar();
      toast(r.arte && r.arte.item_status === 'pre_impressao' ? 'Arte fechada. O pedido tem pagamento: o item já foi para a pré-impressão.'
          : r.arte && r.arte.item_status === 'arte_aprovada' ? 'Arte fechada: arquivo pronto. Como o pedido ainda não tem pagamento, o vendedor envia para a pré-impressão.'
          : 'Arte fechada: arquivo pronto para impressão.'); recarregar(); }
    catch (e) { bs.disabled = false; bs.classList.remove('ocupado'); st.textContent = 'O arquivo foi enviado, mas a arte não fechou. Tente de novo.'; }
  };
}
// Item com arquivo pronto: o vendedor confere e envia para a pré-impressão (a trava de pagamento continua valendo)
async function enviarPreImpressao(ids) {
  const lista = String(ids).split(',').filter(Boolean); if (!lista.length) return;
  try { await api('mudar_status_itens', { itens: lista, status: 'pre_impressao' }); toast(lista.length > 1 ? `${lista.length} itens enviados para a pré-impressão.` : 'Item enviado para a pré-impressão.'); recarregar(); }
  catch (e) {}
}
async function arteResolverVendedor(id) {
  const ok = confirm('Marcar esta arte como resolvida pelo vendedor? Ela sai da fila da designer e não gera pagamento para ela.');
  if (!ok) return;
  const fazer = async (confirmar) => {
    const r = await api('arte_resolver_vendedor', confirmar ? { id, confirmar: true } : { id });
    toast('Arte resolvida pelo vendedor.');
    await oferecerPreImpressao(r.arte);
    recarregar();
  };
  try { await fazer(false); }
  catch (e) {
    if (e.codigo === 'CONFIRMAR') {
      if (!confirm(e.message + '\n\nConfirmar e encerrar a arte?')) return;
      try { await fazer(true); } catch (e2) { toast(e2.message, true); }
    } else toast(e.message, true);
  }
}
// Com a arte resolvida, o item pode já seguir. Perguntamos em vez de mover sozinho:
// o pagamento e a autorização continuam valendo, e a trava do banco responde se não puder.
async function oferecerPreImpressao(arte) {
  if (!arte || !arte.item_id) return;
  if (![ 'arte_a_fazer', 'arte_em_alteracao', 'arte_em_aprovacao', 'arte_pausada', 'arte_fechando', 'arte_aprovada'].includes(arte.item_status)) return;
  if (!podeStatus('pre_impressao')) return;
  let r; try { r = await api('listar_artes', { situacao: 'em_andamento', pedido_id: arte.pedido_id, limite: 100 }, true); } catch { return; }
  const pendentes = (r.artes || []).filter(a => a.item_id === arte.item_id);
  if (pendentes.length) {
    toast(`O material "${arte.item_descricao}" ainda tem ${pendentes.length} arte(s) em andamento.`);
    return;
  }
  if (!confirm(`O material "${arte.item_descricao}" está em ${nomeStatusItem(arte.item_status)} e já não tem arte pendente.\n\nEnviar para a pré-impressão agora?`)) return;
  try { await api('mudar_status_itens', { itens: [arte.item_id], status: 'pre_impressao' }); toast('Item enviado para a pré-impressão.'); }
  catch (e) {
    toast(e.message, true);
  }
}
function modalArteEditar(id) {
  const a = (S.vistaAtual?.artes || []).find(x => x.id === id); if (!a) return;
  const m = abrirModal({
    titulo: `Arte · ${a.item_descricao}`, corpo: `
    <form id="f-arte-ed" class="grade">
      <label class="campo">Tipo de arte<select name="tipo">${arteTipos().map(t => `<option value="${t.codigo}" ${a.tipo === t.codigo ? 'selected' : ''}>${esc(t.nome)}${t.valor != null ? ' — ' + brl(t.valor) : ''}</option>`).join('')}</select></label>
      <label class="campo">Instruções para a designer<textarea name="instrucoes" rows="3">${esc(a.instrucoes || '')}</textarea></label>
      <label class="caixa-linha"><input type="checkbox" name="urgente" ${a.urgente ? 'checked' : ''}>
        <span><b>Arte urgente</b><br><span class="small muted">Vai para o topo da fila da designer.</span></span></label>
    </form>`, rodape: `<button class="btn" data-v>Voltar</button><button class="btn prim" data-s>Salvar</button>` });
  m.el.querySelector('[data-v]').onclick = m.fechar;
  m.el.querySelector('[data-s]').onclick = async () => {
    const f = $('#f-arte-ed', m.el);
    try {
      await api('salvar_arte', { id, tipo: f.elements.tipo.value, instrucoes: f.elements.instrucoes.value.trim(), urgente: f.elements.urgente.checked });
      m.fechar(); toast('Arte salva.'); recarregar();
    } catch (e) { toast(e.message, true); }
  };
}
async function modalConversaArte(id) {
  let r; try { r = await api('obter_arte', { id }); } catch (e) { return toast(e.message, true); }
  const msgs = r.mensagens || [];
  const linha = x => `<div style="padding:8px 10px;border-radius:8px;margin-bottom:6px;background:${x.canal === 'cliente' ? 'var(--ambar-bg)' : 'var(--linha-2)'}">
      <div class="small muted">${x.canal === 'cliente' ? 'Pedido do cliente' : esc(x.autor_nome || '')} · ${dataHora(x.created_at)}</div>
      <div>${esc(x.texto)}</div></div>`;
  const m = abrirModal({
    titulo: `Conversa · ${r.arte.item_descricao}`, corpo: `
    <div style="max-height:46vh;overflow:auto;margin-bottom:12px">${msgs.length ? msgs.map(linha).join('') : '<p class="small muted">Nenhuma mensagem ainda.</p>'}</div>
    <label class="campo">Nova mensagem<textarea id="msg-arte" rows="3" placeholder="Para o vendedor ou para a designer"></textarea></label>`,
    rodape: `<button class="btn" data-v>Fechar</button><button class="btn prim" data-s>Enviar</button>` });
  m.el.querySelector('[data-v]').onclick = m.fechar;
  m.el.querySelector('[data-s]').onclick = async () => {
    const t = $('#msg-arte', m.el).value.trim(); if (!t) return;
    try { await api('arte_mensagem', { id, canal: 'equipe', texto: t }); m.fechar(); toast('Mensagem enviada.'); recarregar(); }
    catch (e) { toast(e.message, true); }
  };
}

// A designer envia o arquivo direto do card: material do cliente, prova ou arte final.
function modalEnviarArteDesigner(arteId) {
  const a = (S.vistaAtual?.artes || []).find(x => x.id === arteId); if (!a) return;
  const m = abrirModal({ titulo: `Enviar arquivo · ${a.item_descricao}`, corpo: `
    <form id="f-env-arte" class="grade">
      <label class="campo">O que é este arquivo
        <select name="tipo">
          <option value="producao">Arte final (vai para a produção)</option>
          <option value="prova">Prova (o que foi mostrado ao cliente)</option>
          <option value="arte">Material que o cliente mandou</option>
        </select></label>
      <label class="campo">Arquivo<input type="file" id="env-arq" multiple accept=".pdf,.png,.jpg,.jpeg,.webp,.tif,.tiff,.ai,.eps,.psd,.cdr,.svg,.zip"></label>
      <label class="campo">Identificação <span class="muted">(opcional — ex.: Frente, Verso, Faca)</span>
        <input type="text" id="env-rot" maxlength="40"></label>
      <div class="small muted">O arquivo vai para a pasta deste pedido no Drive.</div>
      <div id="env-status" class="small"></div>
    </form>`, rodape: `<button class="btn" data-v>Voltar</button><button class="btn prim" data-s>Enviar</button>` });
  m.el.querySelector('[data-v]').onclick = m.fechar;
  m.el.querySelector('[data-s]').onclick = async (ev) => {
    const arqs = [...$('#env-arq', m.el).files];
    if (!arqs.length) return toast('Escolha o arquivo.', true);
    const btn = ev.currentTarget; btn.disabled = true;
    const st = $('#env-status', m.el);
    const tipo = $('#f-env-arte', m.el).elements.tipo.value, rot = $('#env-rot', m.el).value.trim();
    let falhou = 0;
    for (const arq of arqs) {
      st.textContent = `Enviando ${arq.name}…`;
      try { await enviarArquivoDrive(a.pedido_id, arq, tipo, a.item_id, rot, f => { st.textContent = `Enviando ${arq.name}… ${Math.round(f * 100)}%`; }); }
      catch (e) { falhou++; toast(`${arq.name}: ${e.message}`, true); }
    }
    btn.disabled = false;
    if (falhou < arqs.length) { m.fechar(); toast('Arquivo enviado.'); recarregar(); }
    else st.textContent = '';
  };
}

/* ---------- painel da designer ---------- */
rota('minhas-artes', async (_p, el) => {
  S.cache.voltarArte = 'minhas-artes';
  definirTopoEm(el, 'Minhas artes', `<button class="btn" onclick="recarregar()">Atualizar</button>`);
  const f = S.cache.filtroMinhasArtes || (S.cache.filtroMinhasArtes = 'todos');
  const b = S.cache.buscaMinhasArtes || '';
  const vd = S.cache.vendMinhasArtes || '';
  const r = await api('listar_artes', { situacao: 'em_andamento', busca: b || null, vendedor_id: vd || null, limite: 100 });
  vistaDoEl(el).artes = r.artes;
  await carregarGabaritos().catch(() => {});
  const lista = r.artes.filter(filtroArteFn(f));
  el.innerHTML = `${barraFiltroArte({ artes: r.artes, filtro: f, busca: b, aoFiltrar: 'filtrarMinhasArtes', idBusca: 'b-minhas',
      vendedores: S.base?.vendedores || [], vendSel: vd, idVend: 'f-vend-minhas' })}
    ${r.total > r.artes.length ? `<p class="small muted">Mostrando ${r.artes.length} de ${r.total}.</p>` : ''}
    ${listaArtesResumo(lista, 'designer')}`;
  ligarBuscaArte(el, '#b-minhas', 'buscaMinhasArtes');
  ligarFiltroArte(el, '#f-vend-minhas', 'vendMinhasArtes');
  preencherArquivosArte(el);
});
// Tela "Artes do pedido": tudo do pedido aberto (itens, gabarito, artes, provas, arquivos e ações)
rota('arte-pedido', async (id, el) => {
  const voltar = S.cache.voltarArte || (soPainelArte() ? 'minhas-artes' : 'arte');
  const r = await api('listar_artes', { situacao: 'todas', pedido_id: id, limite: 200 });
  const artes = (r.artes || []).filter(a => a.situacao !== 'cancelada');
  vistaDoEl(el).artes = artes;
  await carregarGabaritos().catch(() => {});
  const p = artes[0];
  definirTopoEm(el, p ? `Artes · Pedido ${p.pedido_numero}` : 'Artes do pedido', `<a class="btn" href="#/${voltar}">Voltar</a>
    ${p && !soPainelArte() ? `<a class="btn" href="#/pedido/${id}">Abrir pedido</a>` : ''}
    ${p && p.prova_chave ? `<button class="btn" onclick="copiarLinkProva('${p.prova_chave}')">Copiar link de aprovação</button>` : ''}
    <button class="btn" onclick="recarregar()">Atualizar</button>`);
  const prontos = soPainelArte() || !podeStatus('pre_impressao') ? [] : [...new Set(artes.filter(a => a.item_status === 'arte_aprovada').map(a => a.item_id))];
  el.innerHTML = (prontos.length ? `<div class="alerta" style="background:var(--verde-bg);color:var(--grafite);margin-bottom:12px;display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:center">
      <span><b>Arquivo pronto para impressão</b> em ${prontos.length} ${prontos.length === 1 ? 'item' : 'itens'}.</span>
      <button class="btn prim peq" onclick="enviarPreImpressao('${prontos.join(',')}')">Enviar para pré-impressão</button></div>` : '')
    + (artes.length ? detalheArtesPedido(artes, soPainelArte() ? 'designer' : 'interno')
    : '<div class="painel"><div class="vazio">Nenhuma arte deste pedido para você.</div></div>');
  preencherArquivosArte(el);
});
function filtrarMinhasArtes(k) { S.cache.filtroMinhasArtes = k; recarregar(); }
// Busca das telas de arte: procura ao sair do campo ou com Enter, como na tela de Pedidos.
function ligarBuscaArte(el, sel, chave) {
  const i = el.querySelector(sel); if (!i) return;
  const buscar = () => { const v = i.value.trim(); if (v === (S.cache[chave] || '')) return; S.cache[chave] = v; recarregar(); };
  i.onchange = buscar;
  i.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); buscar(); } };
}
rota('artes-feitas', async (_p, el) => {
  S.cache.voltarArte = 'artes-feitas';
  definirTopoEm(el, 'Artes concluídas', `<button class="btn" onclick="recarregar()">Atualizar</button>`);
  const busca = S.cache.buscaArtesFeitas || '';
  const f = S.cache.filtroArtesFeitas || (S.cache.filtroArtesFeitas = 'todos');
  const vdf = S.cache.vendArtesFeitas || '';
  const r = await api('listar_artes', { situacao: 'concluidas', busca: busca || null, vendedor_id: vdf || null, limite: 50 });
  vistaDoEl(el).artes = r.artes;
  await carregarGabaritos().catch(() => {});
  el.innerHTML = `${barraFiltroArte({ artes: r.artes, filtro: f, busca, aoFiltrar: 'filtrarArtesFeitas', idBusca: 'b-artes',
      vendedores: S.base?.vendedores || [], vendSel: vdf, idVend: 'f-vend-feitas' })}
    <p class="small muted">${r.total} arte(s) concluída(s).</p>
    ${listaArtesResumo(r.artes.filter(filtroArteFn(f)), 'designer')}`;
  ligarBuscaArte(el, '#b-artes', 'buscaArtesFeitas');
  ligarFiltroArte(el, '#f-vend-feitas', 'vendArtesFeitas');
  preencherArquivosArte(el);
});
function filtrarArtesFeitas(k) { S.cache.filtroArtesFeitas = k; recarregar(); }
rota('meus-pagamentos', async (_p, el) => {
  definirTopoEm(el, soPainelArte() ? 'Meus pagamentos' : 'Pagamentos das artes', `<button class="btn" onclick="recarregar()">Atualizar</button>`);
  const r = await api('artes_pagamentos', {});
  const sem = (r.semanas || []);
  el.innerHTML = `
    <div class="grade g2">
      <div class="cartao-num"><span class="n num">${brl(r.total)}</span><span class="muted small">Total no período</span></div>
      <div class="cartao-num"><span class="n num">${r.quantidade}</span><span class="muted small">Artes aprovadas</span></div>
    </div>
    <p class="small muted">Período de ${data(r.de)} a ${data(r.ate)}. Conta a arte feita pela designer quando ela entrega o arquivo pronto para impressão.</p>
    ${sem.length ? sem.map(s => `
      <div class="painel">
        <div class="painel-cab"><h2 style="margin:0">Semana de ${data(s.semana)} ${soPainelArte() ? '' : tagPessoa(s.designer_nome, (S.base?.designers || []).find(d => d.id === s.designer_id)?.cor)}</h2>
          <b class="num">${brl(s.total)}</b></div>
        <div class="tabela-wrap"><table><thead><tr><th>Pedido</th><th>Item</th><th>Tipo</th><th class="dir">Valor</th><th>Arquivo pronto em</th></tr></thead>
          <tbody>${(r.artes || []).filter(a => (!s.designer_id || a.designer_id === s.designer_id) && String(a.aprovada_em).slice(0, 10) >= String(s.semana) && String(a.aprovada_em).slice(0, 10) <= addDiasISO(s.semana, 6))
            .map(a => `<tr><td><b>${esc(a.pedido_numero)}</b></td><td>${esc(a.item_descricao)}</td><td>${esc(a.tipo_nome)}</td>
              <td class="dir num">${brl(a.valor)}</td><td class="small">${dataHora(a.aprovada_em)}</td></tr>`).join('')}</tbody></table></div>
      </div>`).join('') : '<div class="vazio">Nenhuma arte aprovada no período.</div>'}`;
});
const addDiasISO = (iso, d) => { const x = new Date(String(iso).slice(0, 10) + 'T12:00:00'); x.setDate(x.getDate() + d); return x.toISOString().slice(0, 10); };

// mostra os arquivos de arte de cada arte (material do cliente, prova, arte final)
async function preencherArquivosArte(el) {
  ligarSelectsGabarito(el);
  el.querySelectorAll('[data-abrir-arte]').forEach(c => c.onclick = e => {
    if (e.target.closest('a,button,select,input,textarea,label')) return;
    location.hash = '#/arte-pedido/' + c.dataset.abrirArte;
  });
  const caixas = [...el.querySelectorAll('[data-arte-item]')].filter(c => c.dataset.arteItem);
  if (!caixas.length) return;
  let r; try { r = await api('listar_arquivos_itens', { item_ids: [...new Set(caixas.map(c => c.dataset.arteItem))] }, true); } catch { return; }
  const porItem = r.itens || {};
  caixas.forEach(c => {
    const arqs = porItem[c.dataset.arteItem] || [];
    c.innerHTML = arqs.length
      ? '<span class="muted">Arte final:</span> ' + arqs.map(a => `<a href="${esc(a.url)}" target="_blank" rel="noopener" title="${esc(a.nome)}">${esc(a.rotulo || a.nome)}</a>`).join(' · ')
      : '<span class="muted">Sem arquivo de arte ainda.</span>';
  });
}

/* ---------- bloco "Artes" na tela do pedido (vendedor / diretor) ---------- */
async function preencherArtesPedido(el, p) {
  const alvo = el.querySelector('[data-artes-pedido]'); if (!alvo) return;
  let r;
  try { r = await api('listar_artes', { situacao: 'todas', limite: 200, pedido_id: p.id }, true); }
  catch (e) { alvo.innerHTML = `<div class="painel-cab"><h2>Artes</h2></div><p class="small" style="color:var(--vermelho);margin:0">Não foi possível carregar as artes: ${esc(e.message)}</p>`; return; }
  const artes = r.artes || [];
  vistaDoEl(el).artes = artes;
  await carregarGabaritos().catch(() => {});
  const designers = S.base?.designers || [];
  const desPedido = artes.find(a => a.designer_id)?.designer_id || '';
  const podeMexer = pode('cria_pedidos') || gerenciaArtes();
  const itens = p.itens.filter(i => i.status !== 'cancelado');

  alvo.innerHTML = `
    <div class="painel-cab"><h2>Artes ${artes.length && artes[0].vendedor_nome ? tagPessoa(artes[0].vendedor_nome, artes[0].vendedor_cor, 'vendedor') : ''}
        ${p.prova_chave ? `<button class="btn link peq" onclick="copiarLinkProva('${p.prova_chave}')" title="Link de aprovação das provas deste pedido (sempre o mesmo)">Copiar link de aprovação</button>` : ''}</h2>
      ${podeMexer && designers.length ? `<label class="campo" style="margin:0;min-width:220px">Designer do pedido
        <select id="des-pedido">
          <option value="">Sem designer</option>
          ${designers.map(d => `<option value="${d.id}" ${desPedido === d.id ? 'selected' : ''}>${esc(d.nome)}</option>`).join('')}
        </select></label>
        ${desPedido ? `<div style="align-self:flex-end;padding-bottom:10px">${tagPessoa((designers.find(d => d.id === desPedido) || {}).nome, (designers.find(d => d.id === desPedido) || {}).cor, 'designer')}</div>` : ''}` : ''}
    </div>
    ${itens.length ? itens.map(i => {
      const as = artes.filter(a => a.item_id === i.id && a.situacao !== 'cancelada');
      const naArte = ITEM_NA_ARTE.includes(i.status);
      if (i.sem_arte || !as.length) return `
        <div class="material-arte"><b>${esc(i.descricao)}</b> <span class="small muted">${num(i.quantidade)} un</span>
          ${i.sem_arte ? badge('Não precisa de arte', 'b-cinza') : '<span class="small muted">· sem arte</span>'}
          <div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap">
            ${podeMexer && naArte && i.sem_arte ? `<button class="btn peq" onclick="alternarSemArte('${i.id}',false)">Este item precisa de arte</button>` : ''}
            <button class="btn peq" onclick="testarArquivo('${i.id}')">Testar arquivo do cliente</button></div></div>`;
      const extra = podeMexer && naArte && p.status !== 'cancelado' ? `<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:10px">
          <label class="small muted">Qtde de artes <input type="number" min="1" max="20" value="${as.length}" style="width:64px" data-qtd-artes="${i.id}"></label>
          <button class="btn peq" onclick="alternarSemArte('${i.id}',true)">Não precisa de arte</button></div>` : '';
      return blocoMaterialArte(as, 'interno', { podeMexer: podeMexer && p.status !== 'cancelado', extraItem: extra });
    }).join('') : '<p class="small muted" style="margin:0">Nenhum item ativo.</p>'}
    <div style="margin-top:10px">${blocoExp('ajuda-artes', 'Como funciona', '<p class="small muted" style="margin:0">O item sai da etapa de arte quando todas as artes dele tiverem o arquivo pronto para impressão. Arte final enviada pelo vendedor marca a arte como resolvida por ele, sem pagamento à designer.</p>', false, 'leve')}</div>`;

  const sel = alvo.querySelector('#des-pedido');
  if (sel) sel.onchange = async () => {
    try { await api('pedido_designer', { pedido_id: p.id, designer_id: sel.value || null }); toast('Designer do pedido atualizada.'); recarregar(); }
    catch (e) { toast(e.message, true); sel.value = desPedido; }
  };
  ligarSelectsGabarito(alvo);
  alvo.querySelectorAll('[data-qtd-artes]').forEach(inp => inp.onchange = async () => {
    const id = inp.dataset.qtdArtes, qtd = Number(inp.value);
    try { await api('item_qtd_artes', { item_id: id, qtd }); toast('Quantidade de artes atualizada.'); recarregar(); }
    catch (e) { toast(e.message, true); recarregar(); }
  });
}
async function alternarSemArte(itemId, valor) {
  if (valor && !confirm('Marcar que este item não precisa de arte? Ele não aparece para a designer e não gera pagamento.')) return;
  try { await api('item_sem_arte', { item_id: itemId, sem_arte: valor }); toast('Item atualizado.'); recarregar(); }
  catch (e) { toast(e.message, true); }
}

