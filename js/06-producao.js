/* ---------- PRÉ-IMPRESSÃO E PRODUÇÃO ---------- */
rota('producao', async (_p, el) => {
  definirTopoEm(el, 'Pré-impressão e produção', `${podeCadastrarFornecedor() ? '<a class="btn" href="#/regras-fornecedor">Regras de fornecedor</a> ' : ''}<button class="btn" onclick="recarregar()">Atualizar</button>`);
  const soDespacha = !podeStatus('em_producao');   // ex.: Financeiro — confere a produção e despacha, não envia para produção
  const despacha = podeStatus('despachado');
  const aba = soDespacha ? 'em_producao' : (S.cache.abaProd || (S.cache.abaProd = 'pre_impressao'));
  const fForn = S.cache.fornProd || '';
  // (29/10) carrega só a aba aberta (a de produção pode ter muitas linhas); a contagem das duas vem junto
  const r = await api('listar_itens', { status: [aba] });
  vistaDoEl(el).dados = r.itens;
  S.cache.preItens = r.itens;
  const cont = r.contagem || {};
  const pre = r.itens.filter(i => i.status === 'pre_impressao');
  let prod = r.itens.filter(i => i.status === 'em_producao');
  const atrasados = cont.atrasados ?? prod.filter(i => i.producao_atrasada).length;
  if (fForn) prod = prod.filter(i => i.fornecedor_id === fForn);
  const opForn = sel => opcoesFornecedor(sel);
  const criaForn = podeCadastrarFornecedor();
  const podeDevolverArte = podeStatus('em_producao') || gerenciaArtes();

  let corpo;
  if (aba === 'pre_impressao') {
    corpo = htmlPreImpressao(pre, { criaForn, podeDevolverArte });
  } else {
    const grupos = {};
    prod.forEach(i => (grupos[i.fornecedor_nome || 'Sem fornecedor'] ||= []).push(i));
    corpo = `<div class="linha-form filtros" style="margin-bottom:12px">
        <label class="campo" style="max-width:280px">Fornecedor<select id="f-forn"><option value="">Todos</option>${S.base.fornecedores.map(f => `<option value="${f.id}" ${f.id === fForn ? 'selected' : ''}>${esc(f.nome)}</option>`).join('')}</select></label>
        <span class="small muted" style="padding-bottom:9px;flex:2">Confira item por item com cada fornecedor. A previsão de produção é só referência (atrasados aparecem primeiro). Marque o que vai chegar no balcão e clique em "Marcar como despachado".</span>
        ${despacha ? `<button class="btn prim" id="btn-despachar" style="flex:0;white-space:nowrap" disabled>Marcar como despachado</button>` : ''}</div>`
      + (prod.length ? Object.entries(grupos).map(([nome, lista]) => `<div class="grupo-forn">
        <h3>${esc(nome)} <span class="badge b-cinza">${lista.length}</span> <span class="small" style="font-weight:400">${linkAcessoFornecedor(lista[0].fornecedor_id)}</span></h3>
        <div class="tabela-wrap"><table><thead><tr>${despacha ? '<th style="width:28px"></th>' : ''}<th>Pedido</th><th>Item</th><th>Código do fornecedor</th><th>Previsão de produção</th><th>Previsão de entrega</th><th>Em produção há</th><th></th></tr></thead><tbody>
        ${lista.sort((a, b) => (b.producao_atrasada - a.producao_atrasada) || String(a.prazo_producao).localeCompare(String(b.prazo_producao))).map(i => `<tr>
          ${despacha ? `<td><input type="checkbox" class="sel-desp" value="${i.id}" aria-label="Selecionar item"></td>` : ''}
          <td><a href="#/pedido/${i.pedido_id}"><b>${esc(i.pedido_numero)}</b></a><div class="small muted">${esc(i.cliente_nome)}</div></td>
          <td>${esc(i.descricao)}${etqPag(i)}${seloDigital(i.digital)}${seloConferencia(i.conferencia, i.status)}<div class="small muted">${num(i.quantidade)} un</div><div data-arq-item="${i.id}"></div>${i.observacao ? `<div class="small" style="margin-top:4px"><span class="muted">Obs. interna:</span> ${esc(i.observacao)}</div>` : ''}${infoAcabamento(i)}</td>
          <td>${esc(i.codigo_producao)}</td>
          <td class="num" style="${i.producao_atrasada ? 'color:var(--vermelho);font-weight:500' : ''}">${data(i.prazo_producao)}${i.producao_atrasada ? ' · atrasado' : ''}</td>
          <td class="num">${data(i.data_prevista_entrega)}</td>
          <td class="num">${i.dias_no_status} ${i.dias_no_status == 1 ? 'dia' : 'dias'}</td>
          <td class="dir" style="white-space:nowrap"><button class="btn peq" onclick="modalItemProd('${i.id}')">Ajustar</button></td>
        </tr>`).join('')}</tbody></table></div></div>`).join('') : '<div class="vazio">Nenhum item em produção.</div>');
  }
  el.innerHTML = `
    <div class="chips" style="margin-bottom:14px">
      ${soDespacha ? '' : `<button class="chip ${aba === 'pre_impressao' ? 'ativo' : ''}" onclick="S.cache.abaProd='pre_impressao';recarregar()">Pré-impressão (${cont.pre_impressao ?? pre.length})</button>`}
      <button class="chip ${aba === 'em_producao' ? 'ativo' : ''}" onclick="S.cache.abaProd='em_producao';recarregar()">Em produção (${cont.em_producao ?? prod.length}${atrasados ? ` · ${atrasados} atrasado${atrasados > 1 ? 's' : ''}` : ''})</button>
    </div>
    <div class="painel">${corpo}</div>`;
  if ($('#f-forn')) $('#f-forn').onchange = e => { S.cache.fornProd = e.target.value; recarregar(); };
  if (aba === 'pre_impressao') ligarPreImpressao(el);
  preencherArtesFinais(el);
  // aviso (sem bloquear) quando a previsão de produção passa da previsão de entrega
  const avisarPrev = inp => { const a = inp.parentElement.querySelector('.aviso-prev'); if (!a) return;
    a.textContent = inp.value && inp.dataset.entrega && inp.value > inp.dataset.entrega ? 'Depois da previsão de entrega' : ''; };
  $$('input[data-c="prazo_producao"]').forEach(inp => { avisarPrev(inp); inp.addEventListener('change', () => avisarPrev(inp)); });
  $$('select[data-c="fornecedor_id"]').forEach(sel => sel.addEventListener('change', () => {
    const tr = sel.closest('tr'); const box = tr && tr.querySelector('[data-acesso]'); if (box) box.innerHTML = linkAcessoFornecedor(sel.value); }));
  const bd = $('#btn-despachar');
  if (bd) {
    const marcados = () => $$('.sel-desp:checked').map(x => x.value);
    $$('.sel-desp').forEach(c => c.onchange = () => { const n = marcados().length; bd.disabled = !n; bd.textContent = n ? `Marcar como despachado (${n})` : 'Marcar como despachado'; });
    bd.onclick = async () => { const ids = marcados(); if (!ids.length) return;
      await api('mudar_status_itens', { itens: ids, status: 'despachado' });
      toast(`${ids.length} ${ids.length > 1 ? 'itens marcados' : 'item marcado'} como despachado.`); recarregar(); };
  }
});
/* ---------- PRÉ-IMPRESSÃO (27/10): lista enxuta + item que abre ---------- */
// prioridade: 0 entrega atrasada · 1 entrega hoje · 2 muito urgente · 3 urgente / entrega amanhã · 4 normal
function prioridadePre(i) {
  const u = i.urgencia || {};
  let d = u.dias_para_entrega;
  if (d == null && i.data_prevista_entrega) d = Math.round((new Date(i.data_prevista_entrega + 'T12:00:00') - new Date(hoje() + 'T12:00:00')) / 864e5);
  if (d != null && d < 0) return { p: 0, txt: 'Atrasado', cls: 'mk-verm', cor: 'var(--vermelho)', d };
  if (d === 0) return { p: 1, txt: 'Entrega hoje', cls: 'mk-verm', cor: 'var(--vermelho)', d };
  if (u.nivel === 'muito_urgente') return { p: 2, txt: 'Muito urgente', cls: 'mk-verm', cor: 'var(--vermelho)', d };
  if (u.nivel === 'urgente') return { p: 3, txt: 'Urgente', cls: 'mk-amb', cor: 'var(--ambar)', d };
  if (d === 1) return { p: 3, txt: 'Entrega amanhã', cls: 'mk-amb', cor: 'var(--ambar)', d };
  return { p: 4, txt: '', cls: '', cor: 'transparent', d };
}
const preProntoParaEnviar = i => !!(i.fornecedor_id && i.prazo_producao && String(i.codigo_producao || '').trim());
function preAlertaArquivo(i) {
  const c = i.conferencia; if (!c) return '';
  if (c.digital_mudou && !c.devolvida) return c.digital_atual ? 'Mudou para digital' : 'Saiu da digital';
  if (c.gabarito_mudou && !c.devolvida) return 'Gabarito mudou';
  if (c.resultado === 'erro') return 'Enviada com alerta';
  return '';
}
function htmlPreImpressao(pre, { criaForn, podeDevolverArte }) {
  if (!pre.length) return '<div class="vazio">Nenhum item aguardando pré-impressão.</div>';
  const custo = pode('ve_custo');
  const abertos = S.cache.preAberto || (S.cache.preAberto = {});
  const lista = pre.map(i => ({ i, pr: prioridadePre(i) }))
    .sort((a, b) => a.pr.p - b.pr.p || String(a.i.data_prevista_entrega || '9').localeCompare(String(b.i.data_prevista_entrega || '9'))
      || String(a.i.pedido_numero).localeCompare(String(b.i.pedido_numero), 'pt-BR', { numeric: true }));
  const nPrio = lista.filter(x => x.pr.p < 4).length, nPronto = pre.filter(preProntoParaEnviar).length;
  const nPag = pre.filter(i => i.pedido_sem_pagamento).length, nAlerta = pre.filter(i => preAlertaArquivo(i)).length;
  const f = S.cache.filtroPre || 'todos';
  const chip = (k, n, q) => `<button class="chip ${f === k ? 'ativo' : ''}" data-fpre="${k}">${n} (${q})</button>`;
  const cols = custo ? 9 : 8;
  const linha = ({ i, pr }) => {
    const alerta = preAlertaArquivo(i), pronto = preProntoParaEnviar(i);
    const prevDepois = i.prazo_producao && i.data_prevista_entrega && i.prazo_producao > i.data_prevista_entrega;
    const marcas = [pr.txt ? `<span class="mk ${pr.cls}">${pr.txt}</span>` : '',
      i.pedido_sem_pagamento ? '<span class="mk mk-amb">Falta pagamento</span>' : '',
      i.digital && i.digital.digital ? '<span class="mk mk-dig">Digital</span>' : '',
      i.refile ? '<span class="mk mk-cinza" title="Pedir formato maior e refilar">Refile</span>' : '',
      i.precisa_acabamento ? '<span class="mk mk-cinza">Acabamento</span>' : '',
      alerta ? `<span class="mk mk-verm">${esc(alerta)}</span>` : ''].filter(Boolean).join(' ');
    const filtros = [pr.p < 4 ? 'prio' : '', pronto ? 'pronto' : '', i.pedido_sem_pagamento ? 'pag' : '', alerta ? 'alerta' : ''].join(' ');
    const busca = normTxt([i.pedido_numero, i.cliente_nome, i.descricao].join(' '));
    const ab = !!abertos[i.id];
    return `<tbody class="pre-grupo" data-pre-grupo="${i.id}" data-filtros="${filtros}" data-busca="${esc(busca)}">
      <tr class="pre-linha ${ab ? 'aberta' : ''}" data-pre-abrir="${i.id}" style="--prio:${pr.cor}" title="Clique para abrir">
        <td><b>${esc(i.pedido_numero)}</b><div class="small muted cortar">${esc(i.cliente_nome || '')}</div></td>
        <td><div class="cortar" title="${esc(i.descricao)}"><b>${esc(i.descricao)}</b></div>
          <div class="small"><span class="muted">${num(i.quantidade)} un</span> <span data-pre-marcas="${i.id}">${marcas}</span></div></td>
        <td class="small">${i.fornecedor_nome ? esc(i.fornecedor_nome) : i.sugestao ? `<span class="forn-sug" title="${esc(i.sugestao.motivo)}">${esc(i.sugestao.fornecedor_nome)}</span><div class="muted" style="font-size:10.5px">sugerido</div>` : '<span class="muted">—</span>'}</td>
        <td class="num small" style="${pr.p <= 1 ? 'color:var(--vermelho);font-weight:600' : pr.d === 1 ? 'color:#9a6410;font-weight:600' : ''}">${data(i.data_prevista_entrega)}</td>
        <td class="num small" style="${prevDepois ? 'color:var(--vermelho);font-weight:600' : ''}" ${prevDepois ? 'title="Depois da previsão de entrega"' : ''}>${i.prazo_producao ? data(i.prazo_producao) : '<span class="muted">—</span>'}</td>
        <td class="small">${i.codigo_producao ? esc(i.codigo_producao) : '<span class="muted">—</span>'}</td>
        ${custo ? `<td class="num small dir">${i.custo != null ? brl(i.custo) : '<span class="muted">—</span>'}</td>` : ''}
        <td class="dir" style="white-space:nowrap">${pronto ? '<span class="mk mk-verde" title="Fornecedor, previsão e código preenchidos">Pronto</span>' : ''} <span class="seta">›</span></td>
      </tr>
      <tr class="pre-det" ${ab ? '' : 'hidden'}><td colspan="${cols}">${detalhePre(i, pr, { criaForn, podeDevolverArte, custo })}</td></tr>
    </tbody>`;
  };
  return `<div class="linha-form filtros" style="margin-bottom:10px;align-items:center">
      <label class="campo" style="flex:2;max-width:380px">Buscar<input type="search" id="b-pre" value="${esc(S.cache.buscaPre || '')}" placeholder="Pedido, cliente ou produto"></label>
      <div class="chips" style="flex:3;padding-top:16px">${chip('todos', 'Todos', pre.length)}${chip('prio', 'Prioridade', nPrio)}${chip('pronto', 'Prontos para enviar', nPronto)}${nPag ? chip('pag', 'Falta pagamento', nPag) : ''}${nAlerta ? chip('alerta', 'Alerta no arquivo', nAlerta) : ''}</div>
    </div>
    <div class="tabela-wrap"><table class="tab-pre">
      <thead><tr><th>Pedido</th><th>Item</th><th>Fornecedor</th><th>Previsão de entrega</th><th>Previsão de produção</th><th>Código do fornecedor</th>${custo ? '<th class="dir">Custo (R$)</th>' : ''}<th></th></tr></thead>
      ${lista.map(linha).join('')}
    </table></div>
    <p class="small muted" id="pre-vazio" hidden style="margin:10px 0 0">Nenhum item com esse filtro.</p>
    <div style="margin-top:10px">${blocoExp('ajuda-pre', 'Como funciona', '<p class="small muted" style="margin:0">A lista vem na ordem de prioridade: entrega atrasada, entrega hoje, muito urgente, urgente e entrega amanhã (faixa colorida à esquerda). Clique no item para abrir: lá ficam a arte final, as observações e os campos para enviar para produção. O item só vai para produção com fornecedor, previsão de produção e código do fornecedor; o pedido só muda de etapa quando todos os itens estiverem em produção.</p>', false, 'leve')}</div>`;
}
function detalhePre(i, pr, { criaForn, podeDevolverArte, custo }) {
  const u = i.urgencia || {};
  return `<div class="pre-caixa">
    <div class="pre-info">
      <div><b>${esc(i.descricao)}</b></div>
      <div class="small muted">${num(i.quantidade)} un${i.especificacao ? ' · ' + esc(i.especificacao) : ''}${i.categoria_nome ? ' · ' + esc(catCurta(i.categoria_nome)) : ''}</div>
      <div style="margin-top:6px">${badgeUrgencia(u)}${etqPag(i)}${seloConferencia(i.conferencia, i.status)}</div>
      ${u.nivel ? `<div class="small muted" style="margin-top:4px">${esc(textoUrgencia(u))}</div>` : ''}
      ${i.refile ? `<div class="alerta" style="padding:6px 10px;margin:8px 0 0;font-size:12.5px"><b>Refile:</b> este tamanho não existe no offset. Pedir o formato <b>${esc(i.refile.formato)} cm</b> e refilar para <b>${esc(i.refile.final)} cm</b>.</div>` : ''}
      <div data-arq-item="${i.id}" style="margin-top:6px"></div>
      ${i.arte_drive_url ? `<div class="small" style="margin-top:4px"><a href="${esc(i.arte_drive_url)}" target="_blank" rel="noopener">Arte no Drive</a></div>` : ''}
      ${i.observacao ? `<div class="small" style="margin-top:6px"><span class="muted">Obs. interna:</span> ${esc(i.observacao)}</div>` : ''}${infoAcabamento(i)}
      <div class="small" style="margin-top:8px"><a href="#/pedido/${i.pedido_id}">Abrir o pedido ${esc(i.pedido_numero)}</a> · <span class="muted">entrega ${data(i.data_prevista_entrega)} · na pré-impressão há ${i.dias_no_status} ${i.dias_no_status == 1 ? 'dia' : 'dias'}</span></div>
    </div>
    <div class="pre-form" data-form-item="${i.id}">
      <label class="campo">Fornecedor
        <div style="display:flex;gap:4px"><select data-c="fornecedor_id" style="flex:1">${opcoesFornecedor(i.fornecedor_id || (i.sugestao && i.sugestao.fornecedor_id))}</select>
        ${criaForn ? `<button type="button" class="btn peq" title="Cadastrar fornecedor" onclick="novoFornecedorNaLinha('${i.id}')">+</button>` : ''}</div>
        <span class="small" data-acesso="${i.id}">${linkAcessoFornecedor(i.fornecedor_id || (i.sugestao && i.sugestao.fornecedor_id))}</span></label>
      ${caixaSugestao(i)}
      <div class="grade g2" style="gap:10px">
        <label class="campo">Previsão de produção<input type="date" data-c="prazo_producao" value="${esc(i.prazo_producao || '')}" data-entrega="${esc(i.data_prevista_entrega || '')}"><span class="small aviso-prev" style="color:var(--vermelho)"></span></label>
        <label class="campo">Código do fornecedor<input type="text" data-c="codigo_producao" value="${esc(i.codigo_producao || '')}"></label>
        ${custo ? `<label class="campo">Custo (R$)<input type="number" step="0.01" min="0" data-c="custo" value="${esc(i.custo ?? '')}"></label>` : ''}
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-top:4px">
        <button class="btn prim peq" onclick="salvarLinhaProd('${i.id}',true)">Enviar para produção</button>
        <button class="btn peq" onclick="salvarLinhaProd('${i.id}',false)">Salvar</button>
        ${podeDevolverArte ? `<button class="btn link peq" style="color:var(--vermelho);margin-left:auto" onclick="devolverItemPre('${i.id}')" title="O arquivo para impressão está errado: a arte volta para a designer fechar de novo">Devolver para a designer</button>` : ''}
      </div>
    </div>
  </div>`;
}
// (29/10) regras escritas pelo Diretor: ficam pendentes até serem importadas pelo agente (Claude)
const podeRegras = () => pode('gerencia_regras_fornecedor');
// pergunta ao enviar para produção com fornecedor diferente do sugerido; resolve true para seguir, false para cancelar
function perguntarPorQueTrocou(it, escolhidoId) {
  const escolhido = ((S.base.fornecedores || []).find(f => f.id === escolhidoId) || {}).nome || 'outro fornecedor';
  return new Promise(resolve => {
    let feito = false; const fim = v => { if (!feito) { feito = true; resolve(v); } };
    const m = abrirModal({ titulo: 'Por que trocou o fornecedor?', corpo: `
      <p style="margin-top:0">O sistema sugeriu <b>${esc(it.sugestao.fornecedor_nome)}</b> e você escolheu <b>${esc(escolhido)}</b>.</p>
      ${podeRegras() ? `<div style="display:grid;gap:6px;margin-bottom:10px">
        <label class="check"><input type="radio" name="tp" value="so_desta_vez" checked> <span><b>Só desta vez</b> <span class="muted small">(preço, prazo do dia, falta de material…)</span></span></label>
        <label class="check"><input type="radio" name="tp" value="regra"> <span><b>Virar regra</b> <span class="muted small">— escreva com suas palavras; o agente monta a regra na sexta</span></span></label></div>` : ''}
      <label class="campo"><span data-rot>${podeRegras() ? 'Motivo (opcional)' : 'Motivo (opcional, ajuda o Diretor a criar regras)'}</span>
        <textarea rows="3" data-txt placeholder="Ex.: KWG sem prazo esta semana"></textarea></label>`,
      rodape: `<button class="btn" data-v>Voltar</button><button class="btn prim" data-s>Continuar e enviar</button>` });
    const tipo = () => (m.el.querySelector('input[name=tp]:checked') || {}).value || 'so_desta_vez';
    m.el.querySelectorAll('input[name=tp]').forEach(r => r.onchange = () => {
      const regra = tipo() === 'regra';
      m.el.querySelector('[data-rot]').textContent = regra ? 'Regra (com suas palavras) *' : 'Motivo (opcional)';
      m.el.querySelector('[data-txt]').placeholder = regra ? `Ex.: ${it.descricao || 'este material'} acima de 5.000 un vai para ${escolhido}` : 'Ex.: KWG sem prazo esta semana';
    });
    m.el.querySelector('[data-v]').onclick = () => { m.fechar(); fim(false); };
    m.el.querySelector('[data-s]').onclick = async () => {
      const texto = m.el.querySelector('[data-txt]').value.trim(), tp = tipo();
      if (tp === 'regra' && !texto) return toast('Escreva a regra.', true);
      if (texto) await api('registrar_regra_escrita', { tipo: tp, texto, item_id: it.id, fornecedor_escolhido: escolhidoId });
      if (tp === 'regra') toast('Regra anotada. Ela entra no arquivo da sexta para o agente.');
      m.fechar(); fim(true);
    };
  });
}
// escrever uma regra a partir do item, sem trocar o fornecedor
function escreverRegra(itemId) {
  const it = (S.cache.preItens || []).find(x => x.id === itemId) || {};
  const box = $(`[data-form-item="${itemId}"]`); const sel = box && box.querySelector('select[data-c="fornecedor_id"]');
  const m = abrirModal({ titulo: 'Escrever uma regra', corpo: `
    <p class="small muted" style="margin-top:0">Escreva com suas palavras quando um material deve ir para um fornecedor. A regra fica guardada e, na sexta, o agente no Claude transforma em regra do sistema (conversando com você antes).</p>
    <p class="small" style="margin:0 0 8px"><b>Item:</b> ${esc(it.descricao || '')} · ${num(it.quantidade)} un${(it.urgencia || {}).nivel ? ' · ' + esc(URG_REGRA[it.urgencia.nivel] || it.urgencia.nivel) : ''}</p>
    <label class="campo">Regra *<textarea rows="3" data-txt placeholder="Ex.: Cartão com laminação holográfica acima de 500 un vai para a Zap"></textarea></label>`,
    rodape: `<button class="btn" data-v>Voltar</button><button class="btn prim" data-s>Guardar regra</button>` });
  m.el.querySelector('[data-v]').onclick = m.fechar;
  m.el.querySelector('[data-s]').onclick = async () => {
    const texto = m.el.querySelector('[data-txt]').value.trim(); if (!texto) return toast('Escreva a regra.', true);
    const r = await api('registrar_regra_escrita', { tipo: 'regra', texto, item_id: itemId, fornecedor_escolhido: (sel && sel.value) || it.fornecedor_id || '' });
    m.fechar(); toast(`Regra guardada (${r.pendentes} aguardando o agente).`);
  };
}
async function baixarArquivoRegras() {
  const r = await api('arquivo_regras', {});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([r.texto], { type: 'text/markdown;charset=utf-8' }));
  a.download = r.nome; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  toast(r.pendentes ? `Arquivo baixado com ${r.pendentes} ${r.pendentes > 1 ? 'regras pendentes' : 'regra pendente'}.` : 'Arquivo baixado (nenhuma regra pendente).');
}
// lê o bloco "GVH-REGRAS v1" devolvido pelo agente
function lerBlocoRegras(txt) {
  const t = String(txt || ''); const i = t.indexOf('GVH-REGRAS');
  const corpo = i >= 0 ? t.slice(i) : t; const a = corpo.indexOf('{'), b = corpo.lastIndexOf('}');
  if (a < 0 || b < a) throw new Error('Não encontrei o bloco GVH-REGRAS v1 com o JSON.');
  try { return JSON.parse(corpo.slice(a, b + 1)); } catch { throw new Error('O bloco não está num formato válido. Peça ao agente para gerar de novo.'); }
}
function modalImportarRegras() {
  const m = abrirModal({ titulo: 'Importar regras do agente', largo: true, corpo: `
    <p class="small muted" style="margin-top:0">Cole aqui o bloco que o agente entregou (começa com <code>GVH-REGRAS v1</code>). Antes de salvar, você confere cada regra.</p>
    <textarea rows="8" data-txt style="width:100%;font-family:monospace;font-size:12px" placeholder="GVH-REGRAS v1&#10;{&quot;regras&quot;: [...]}"></textarea>
    <div data-prev style="margin-top:12px"></div>`,
    rodape: `<button class="btn" data-v>Voltar</button><button class="btn" data-c>Conferir</button><button class="btn prim" data-s disabled>Importar selecionadas</button>` });
  let dados = null;
  const prev = m.el.querySelector('[data-prev]'), bs = m.el.querySelector('[data-s]');
  const linhaRes = x => {
    const r = x.resumo || {}, p = [];
    if (r.materiais && r.materiais.length) p.push(r.materiais.length > 3 ? `${r.materiais.length} materiais (${esc(r.materiais[0])}, …)` : r.materiais.map(esc).join(', '));
    if (r.palavras && r.palavras.length) p.push('produto com “' + r.palavras.map(esc).join('” ou “') + '”');
    if (r.qtd_min != null || r.qtd_max != null) p.push(r.qtd_min != null && r.qtd_max != null ? `${num(r.qtd_min)} a ${num(r.qtd_max)} un` : r.qtd_min != null ? `a partir de ${num(r.qtd_min)} un` : `até ${num(r.qtd_max)} un`);
    if (r.urgencias && r.urgencias.length) p.push(r.urgencias.map(u => URG_REGRA[u] || u).join(' ou '));
    if (r.digital != null) p.push(r.digital ? 'só digital' : 'fora da digital');
    return p.join(' · ');
  };
  const NOME_ACAO = { criar: 'Nova', alterar: 'Alterar', desativar: 'Desativar' };
  m.el.querySelector('[data-v]').onclick = m.fechar;
  m.el.querySelector('[data-c]').onclick = async () => {
    try { dados = lerBlocoRegras(m.el.querySelector('[data-txt]').value); } catch (e) { prev.innerHTML = `<p class="alerta">${esc(e.message)}</p>`; bs.disabled = true; return; }
    const r = await api('importar_regras', { modo: 'previa', dados });
    prev.innerHTML = `
      ${r.regras.map(x => `<label class="check imp-regra ${x.erros.length ? 'com-erro' : ''}"><input type="checkbox" data-ap="${x.n}" ${x.erros.length ? 'disabled' : 'checked'}>
        <span><b>${NOME_ACAO[x.acao] || esc(x.acao)}: ${esc(x.nome || '')}</b>
          ${x.acao !== 'desativar' ? `<div class="small">${linhaRes(x)} → <b>${esc(x.resumo.fornecedor || '')}</b>${x.resumo.alternativo ? ` <span class="muted">(alternativo ${esc(x.resumo.alternativo)})</span>` : ''}</div>` : `<div class="small muted">${esc(x.resumo.motivo || '')}</div>`}
          ${x.duplicada ? `<div class="small" style="color:#9a6410">Igual à regra “${esc(x.duplicada)}” que já existe.</div>` : ''}
          ${x.erros.length ? `<div class="small" style="color:var(--vermelho)">${x.erros.map(esc).join(' · ')}</div>` : ''}
          <div class="small muted">${x.atende.length ? `Resolve ${x.atende.length} ${x.atende.length > 1 ? 'regras escritas' : 'regra escrita'}` : 'Não resolve nenhuma regra escrita'}</div></span></label>`).join('')}
      ${r.descartar.length ? `<p class="small" style="margin:10px 0 4px"><b>Regras escritas que o agente propõe descartar</b></p>
        ${r.descartar.map(x => `<label class="check imp-regra"><input type="checkbox" data-desc="${esc(x.id)}" ${x.existe ? 'checked' : 'disabled'}>
          <span>${esc(x.texto || '(não está pendente)')}<div class="small muted">${esc(x.motivo || '')}</div></span></label>`).join('')}` : ''}
      ${r.pendentes_fora.length ? `<p class="alerta small" style="margin-top:10px">${r.pendentes_fora.length} ${r.pendentes_fora.length > 1 ? 'regras escritas não foram tratadas' : 'regra escrita não foi tratada'} pelo agente e ${r.pendentes_fora.length > 1 ? 'continuam pendentes' : 'continua pendente'}: ${r.pendentes_fora.map(x => '“' + esc(x.texto) + '”').join(', ')}</p>` : ''}`;
    const atualiza = () => { bs.disabled = !prev.querySelector('input[data-ap]:checked, input[data-desc]:checked'); };
    prev.querySelectorAll('input').forEach(i => i.onchange = atualiza); atualiza();
  };
  bs.onclick = async () => {
    const aprovadas = [...prev.querySelectorAll('input[data-ap]:checked')].map(i => +i.dataset.ap);
    const descartes = [...prev.querySelectorAll('input[data-desc]:checked')].map(i => i.dataset.desc);
    const r = await api('importar_regras', { modo: 'salvar', dados, aprovadas, descartes });
    m.fechar();
    const p = [r.criadas && `${r.criadas} criada${r.criadas > 1 ? 's' : ''}`, r.alteradas && `${r.alteradas} alterada${r.alteradas > 1 ? 's' : ''}`,
      r.desativadas && `${r.desativadas} desativada${r.desativadas > 1 ? 's' : ''}`, r.descartadas && `${r.descartadas} descartada${r.descartadas > 1 ? 's' : ''}`].filter(Boolean);
    toast(`Regras importadas: ${p.join(', ') || 'nada mudou'}. ${r.pendentes ? r.pendentes + ' ainda pendente(s).' : 'Nenhuma pendente.'}`);
    recarregar();
  };
}
// (29/10) sugestão de fornecedor: regra escrita pela pré-impressão ou histórico do material
function caixaSugestao(i) {
  const g = i.sugestao;
  const criar = podeRegras() ? `<button type="button" class="btn link peq" onclick="escreverRegra('${i.id}')">Escrever uma regra</button> <button type="button" class="btn link peq" onclick="regraDoItem('${i.id}')">Montar no formulário</button>` : '';
  if (!g) return `<div class="small muted sug-box">Nenhuma regra para este material ainda. ${criar}</div>`;
  const outro = i.fornecedor_id && i.fornecedor_id !== g.fornecedor_id;
  return `<div class="small sug-box"><b>${outro ? 'Sugestão do sistema' : 'Sugerido'}: ${esc(g.fornecedor_nome)}</b> <span class="muted">· ${esc(g.motivo)}</span>
    ${g.alternativo_nome ? `<div>Alternativo: <b>${esc(g.alternativo_nome)}</b>${g.quando_alternativo ? ` <span class="muted">· ${esc(g.quando_alternativo)}</span>` : ''}</div>` : ''}
    ${g.observacao ? `<div class="muted">${esc(g.observacao)}</div>` : ''}
    <div>${criar}</div></div>`;
}
function regraDoItem(itemId) {
  const i = (S.cache.preItens || []).find(x => x.id === itemId) || {};
  const box = $(`[data-form-item="${itemId}"]`); const sel = box && box.querySelector('select[data-c="fornecedor_id"]');
  const nivel = (i.urgencia || {}).nivel;
  modalRegraFornecedor(null, {
    nome: '', grupos: i.gabarito_grupo_id ? [i.gabarito_grupo_id] : null,
    urgencias: nivel ? [nivel] : null, fornecedor_id: (sel && sel.value) || i.fornecedor_id || '', ativo: true,
    _dica: i.gabarito_grupo_id ? '' : 'Este item não tem material (gabarito) definido: use uma palavra do produto.'
  }, () => recarregar());
}
const URG_REGRA = { normal: 'Normal', urgente: 'Urgente', muito_urgente: 'Muito urgente' };
function resumoRegra(r, grupos) {
  const nomeG = id => (grupos.find(g => g.id === id) || {}).nome || '?';
  const p = [];
  if (r.grupos) p.push(r.grupos.length > 2 ? `${r.grupos.length} materiais (${esc(nomeG(r.grupos[0]))}, …)` : r.grupos.map(x => esc(nomeG(x))).join(', '));
  if (r.palavras) p.push('produto com “' + r.palavras.map(esc).join('” ou “') + '”');
  if (r.qtd_min != null || r.qtd_max != null) p.push(r.qtd_min != null && r.qtd_max != null ? `${num(r.qtd_min)} a ${num(r.qtd_max)} un` : r.qtd_min != null ? `a partir de ${num(r.qtd_min)} un` : `até ${num(r.qtd_max)} un`);
  if (r.urgencias) p.push(r.urgencias.map(u => URG_REGRA[u] || u).join(' ou '));
  if (r.digital != null) p.push(r.digital ? 'só digital' : 'fora da digital');
  return p.join(' · ');
}
rota('regras-fornecedor', async (_p, el) => {
  definirTopoEm(el, 'Regras de fornecedor', podeRegras() ? `<button class="btn" onclick="baixarArquivoRegras()">Baixar arquivo para o agente</button> <button class="btn" onclick="modalImportarRegras()">Importar regras</button> <button class="btn prim" onclick="modalRegraFornecedor(null, null, recarregar)">Nova regra</button>` : '');
  const [r] = await Promise.all([api('listar_regras_fornecedor', {}), carregarGabaritos(), carregarBase()]);
  vistaDoEl(el).dados = r.regras;
  const grupos = gruposGabarito();
  let escritas = null; if (podeRegras() && r.pendentes) { try { escritas = (await api('listar_regras_escritas', {}, true)).escritas.filter(e => e.status === 'pendente'); } catch {} }
  el.innerHTML = `${escritas && escritas.length ? `<div class="alerta" style="margin-bottom:12px"><b>${escritas.length} ${escritas.length > 1 ? 'regras escritas aguardando' : 'regra escrita aguardando'} importação.</b> Baixe o arquivo, converse com o agente no Claude e importe o bloco que ele devolver.
      <ul class="small" style="margin:6px 0 0;padding-left:18px">${escritas.map(e => `<li>${esc(e.texto)} <span class="muted">· ${esc(e.contexto && e.contexto.produto || 'sem item')}${e.contexto && e.contexto.pedido ? ' · pedido ' + esc(e.contexto.pedido) : ''} · ${dataHora(e.created_at)}</span></li>`).join('')}</ul></div>` : ''}
    <div class="painel">
    ${blocoExp('ajuda-regras', 'Como funciona', '<p class="small muted" style="margin:0">Na pré-impressão o sistema sugere o fornecedor pela regra que combina com o item. Se mais de uma combinar, vale a mais específica (palavra do produto, urgência e material pesam mais). Item que vai para a digital não recebe fornecedor de offset. Sem regra, o sistema sugere o fornecedor mais escolhido para aquele material nos últimos 12 meses. A sugestão nunca é obrigatória: quem faz a pré-impressão pode trocar.</p>', false, 'leve')}
    ${r.regras.length ? `<div class="tabela-wrap" style="margin-top:10px"><table><thead><tr><th>Regra</th><th>Quando</th><th>Fornecedor</th><th>Alternativo</th><th></th></tr></thead><tbody>
    ${r.regras.map(x => `<tr class="clicavel" data-regra="${x.id}"><td><b>${esc(x.nome)}</b>${x.observacao ? `<div class="small muted">${esc(x.observacao)}</div>` : ''}</td>
      <td class="small">${resumoRegra(x, grupos)}</td>
      <td><b>${esc(x.fornecedor_nome)}</b></td>
      <td class="small">${x.alternativo_nome ? esc(x.alternativo_nome) + (x.quando_alternativo ? `<div class="muted">${esc(x.quando_alternativo)}</div>` : '') : '<span class="muted">—</span>'}</td>
      <td>${x.ativo ? '' : badge('Inativa', 'b-cinza')}</td></tr>`).join('')}
    </tbody></table></div>` : '<div class="vazio">Nenhuma regra ainda.</div>'}</div>`;
  if (podeRegras()) el.querySelectorAll('[data-regra]').forEach(tr => tr.onclick = () => modalRegraFornecedor(r.regras.find(x => x.id === tr.dataset.regra), null, recarregar));
  else el.querySelectorAll('[data-regra]').forEach(tr => tr.classList.remove('clicavel'));
});
async function modalRegraFornecedor(regra, base, aoSalvar) {
  await Promise.all([carregarGabaritos(), S.base ? null : carregarBase()]);
  const r = regra || base || { ativo: true };
  const grupos = gruposGabarito().filter(g => g.ativo !== false).slice().sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  const sel = new Set(r.grupos || []);
  const urg = new Set(r.urgencias || []);
  const forn = (S.base.fornecedores || []).filter(f => f.ativo || f.id === r.fornecedor_id || f.id === r.alternativo_id);
  const opF = (v, vazio) => `<option value="">${vazio}</option>` + forn.map(f => `<option value="${f.id}" ${f.id === v ? 'selected' : ''}>${esc(f.nome)}</option>`).join('');
  const m = abrirModal({ titulo: regra ? 'Regra de fornecedor' : 'Nova regra de fornecedor', largo: true, corpo: `<form id="f-regra" class="grade g2">
    ${r._dica ? `<p class="alerta" style="grid-column:1/-1;margin:0">${esc(r._dica)}</p>` : ''}
    <label class="campo" style="grid-column:1/-1">Nome da regra *<input type="text" name="nome" value="${esc(r.nome || '')}" placeholder="Ex.: Folheto urgente"></label>
    <div class="campo" style="grid-column:1/-1">Material (gabarito) <span class="muted small">— deixe sem marcar para valer para qualquer material</span>
      <input type="search" id="rg-busca" placeholder="Buscar material" style="margin:4px 0">
      <div id="rg-lista" class="rg-lista">${grupos.map(g => `<label class="check" data-nome="${esc(normTxt(g.nome))}"><input type="checkbox" value="${g.id}" ${sel.has(g.id) ? 'checked' : ''}> ${esc(g.nome)}</label>`).join('')}</div>
      <span class="small muted" id="rg-n"></span></div>
    <label class="campo" style="grid-column:1/-1">Palavras no produto <span class="muted small">— separadas por vírgula; vale se o produto tiver qualquer uma (ex.: bopp, laminação)</span><input type="text" name="palavras" value="${esc((r.palavras || []).join(', '))}"></label>
    <label class="campo">Quantidade a partir de<input type="number" min="0" name="qtd_min" value="${esc(r.qtd_min ?? '')}"></label>
    <label class="campo">Quantidade até<input type="number" min="0" name="qtd_max" value="${esc(r.qtd_max ?? '')}"></label>
    <div class="campo">Urgência <span class="muted small">— nenhuma marcada = qualquer</span><div style="display:flex;gap:12px;flex-wrap:wrap;padding-top:6px">
      ${Object.entries(URG_REGRA).map(([k, n]) => `<label class="check"><input type="checkbox" name="urg" value="${k}" ${urg.has(k) ? 'checked' : ''}> ${n}</label>`).join('')}</div></div>
    <label class="campo">Digital<select name="digital"><option value="">Tanto faz</option><option value="true" ${r.digital === true ? 'selected' : ''}>Só quando vai para a digital</option><option value="false" ${r.digital === false ? 'selected' : ''}>Só fora da digital</option></select></label>
    <label class="campo">Fornecedor sugerido *<select name="fornecedor_id">${opF(r.fornecedor_id, 'Selecione')}</select></label>
    <label class="campo">Fornecedor alternativo<select name="alternativo_id">${opF(r.alternativo_id, 'Nenhum')}</select></label>
    <label class="campo" style="grid-column:1/-1">Quando usar o alternativo<input type="text" name="quando_alternativo" value="${esc(r.quando_alternativo || '')}" placeholder="Ex.: quando o preço compensar"></label>
    <label class="campo" style="grid-column:1/-1">Observação<input type="text" name="observacao" value="${esc(r.observacao || '')}"></label>
    ${regra ? `<label class="check" style="grid-column:1/-1"><input type="checkbox" name="ativo" value="true" ${r.ativo ? 'checked' : ''}> Ativa</label>` : ''}
  </form>`, rodape: `<button class="btn" data-v>Voltar</button><button class="btn prim" data-s>Salvar regra</button>` });
  const lista = m.el.querySelector('#rg-lista');
  const cont = () => { const n = lista.querySelectorAll('input:checked').length; m.el.querySelector('#rg-n').textContent = n ? `${n} ${n > 1 ? 'materiais marcados' : 'material marcado'}` : 'Qualquer material'; };
  lista.addEventListener('change', cont); cont();
  m.el.querySelector('#rg-busca').oninput = e => { const q = normTxt(e.target.value); lista.querySelectorAll('[data-nome]').forEach(l => l.hidden = !!q && !l.dataset.nome.includes(q)); };
  m.el.querySelector('[data-v]').onclick = m.fechar;
  m.el.querySelector('[data-s]').onclick = async () => {
    const f = $('#f-regra', m.el);
    const d = { nome: f.nome.value.trim(), fornecedor_id: f.fornecedor_id.value, alternativo_id: f.alternativo_id.value,
      grupos: [...lista.querySelectorAll('input:checked')].map(x => x.value),
      palavras: f.palavras.value.split(',').map(x => x.trim()).filter(Boolean),
      qtd_min: f.qtd_min.value, qtd_max: f.qtd_max.value, digital: f.digital.value,
      urgencias: [...f.querySelectorAll('input[name=urg]:checked')].map(x => x.value),
      quando_alternativo: f.quando_alternativo.value, observacao: f.observacao.value };
    if (!d.nome) return toast('Dê um nome para a regra.', true);
    if (!d.fornecedor_id) return toast('Escolha o fornecedor sugerido.', true);
    if (!d.grupos.length && !d.palavras.length && !d.digital) return toast('Marque pelo menos um material ou escreva uma palavra do produto.', true);
    if (regra) { d.id = regra.id; d.ativo = !!f.ativo.checked; }
    await api('salvar_regra_fornecedor', d); m.fechar(); toast('Regra salva.');
    if (aoSalvar) aoSalvar();
  };
}
function ligarPreImpressao(el) {
  const tab = el.querySelector('.tab-pre'); if (!tab) return;
  const abertos = S.cache.preAberto || (S.cache.preAberto = {});
  tab.addEventListener('click', e => {
    const tr = e.target.closest('tr.pre-linha'); if (!tr || e.target.closest('a,button,input,select')) return;
    const id = tr.dataset.preAbrir, det = tr.nextElementSibling;
    abertos[id] = det.hidden; det.hidden = !det.hidden; tr.classList.toggle('aberta', !det.hidden);
  });
  const filtrar = () => {
    const f = S.cache.filtroPre || 'todos', q = normTxt(S.cache.buscaPre || ''); let n = 0;
    tab.querySelectorAll('[data-pre-grupo]').forEach(g => {
      const ok = (f === 'todos' || g.dataset.filtros.split(' ').includes(f)) && (!q || g.dataset.busca.includes(q));
      g.hidden = !ok; if (ok) n++;
    });
    el.querySelector('#pre-vazio').hidden = n > 0;
  };
  el.querySelectorAll('[data-fpre]').forEach(b => b.onclick = () => {
    S.cache.filtroPre = b.dataset.fpre; el.querySelectorAll('[data-fpre]').forEach(x => x.classList.toggle('ativo', x === b)); filtrar(); });
  const b = el.querySelector('#b-pre'); if (b) b.oninput = () => { S.cache.buscaPre = b.value; filtrar(); };
  filtrar();
}
// mostra as artes finais (produção) de cada item, com a identificação escrita pela designer
async function preencherArtesFinais(el) {
  const caixas = [...el.querySelectorAll('[data-arq-item]')]; if (!caixas.length) return;
  let r; try { r = await api('listar_arquivos_itens', { item_ids: [...new Set(caixas.map(c => c.dataset.arqItem))] }, true); } catch { return; }
  const cancel = new Set(r.cancelamentos_pendentes || []);
  caixas.forEach(c => { const id = c.dataset.arqItem, l = (r.itens || {})[id] || [];
    const avisos = [(r.trocas_pendentes || {})[id] ? badge('Troca de arte aguardando confirmação', 'b-ambar') : '', cancel.has(id) ? badge('Pedido de cancelamento', 'b-vermelho') : ''].filter(Boolean);
    c.innerHTML = (l.length ? `<div class="small" style="margin-top:4px"><span class="muted">Arte final:</span> ${l.map(a =>
      `<a href="${esc(a.url)}" target="_blank" rel="noopener" title="${esc(a.nome)}">${esc(a.rotulo || a.nome)}</a>${a.origem ? ` <span class="muted">(do ${esc(a.origem)})</span>` : ''}`).join(' · ')}</div>` : '')
      + (avisos.length ? `<div style="margin-top:4px">${avisos.join(' ')} <span class="small muted">(decida no pedido)</span></div>` : '');
    // pré-impressão: marca na linha resumo
    const m = el.querySelector(`[data-pre-marcas="${id}"]`);
    if (m && avisos.length) m.insertAdjacentHTML('beforeend', cancel.has(id) ? ' <span class="mk mk-verm" title="Pedido de cancelamento: decida no pedido">Cancelamento</span>' : ' <span class="mk mk-amb" title="Troca de arte aguardando confirmação">Troca de arte</span>');
  });
}
async function salvarLinhaProd(id, enviar) {
  const tr = $(`[data-form-item="${id}"]`); const d = { id };
  $$('[data-c]', tr).forEach(el => d[el.dataset.c] = el.value);
  if (d.custo === '') delete d.custo;
  if (enviar && (!d.fornecedor_id || !d.prazo_producao || !d.codigo_producao.trim())) return toast('Preencha fornecedor, previsão de produção e código do fornecedor.', true);
  const it = (S.cache.preItens || []).find(x => x.id === id);
  if (enviar && it && it.sugestao && it.sugestao.fornecedor_id && d.fornecedor_id !== it.sugestao.fornecedor_id) {
    const ok = await perguntarPorQueTrocou(it, d.fornecedor_id); if (!ok) return;
  }
  await api('salvar_item', d);
  if (enviar) await api('mudar_status_itens', { itens: [id], status: 'em_producao' });
  toast(enviar ? 'Item enviado para produção.' : 'Dados salvos.'); recarregar();
}
function modalItemProd(id) {
  const i = S.vistaAtual.dados.find(x => x.id === id);
  const m = abrirModal({ titulo: `${i.pedido_numero} · ${i.descricao}`, corpo: `<form id="f-ip" class="grade g2">
    <label class="campo">Fornecedor<select name="fornecedor_id">${opcoesFornecedor(i.fornecedor_id)}</select></label>
    <div class="campo"><span>Previsão de entrega <span class="muted">(do pedido)</span></span><b class="num" style="padding:9px 0">${data(i.data_prevista_entrega)}</b></div>
    <label class="campo">Previsão de produção<input type="date" name="prazo_producao" value="${esc(i.prazo_producao || '')}"></label>
    <label class="campo">Código do fornecedor<input type="text" name="codigo_producao" value="${esc(i.codigo_producao || '')}"></label>
    ${pode('ve_custo') ? `<label class="campo">Custo (R$)<input type="number" step="0.01" name="custo" value="${esc(i.custo ?? '')}"></label>` : ''}
    <label class="campo" style="grid-column:1/-1">Observação interna<input type="text" name="observacao" value="${esc(i.observacao || '')}"></label>
    ${camposAcabamento(i)}</form>`,
    rodape: `<button class="btn" data-v>Voltar</button><button class="btn prim" data-s>Salvar</button>` });
  m.el.querySelector('[data-v]').onclick = m.fechar;
  ligarAcabamento($('#f-ip', m.el));
  m.el.querySelector('[data-s]').onclick = async () => { const d = formDados($('#f-ip', m.el)); if (d.custo === '') delete d.custo;
    if (!lerAcabamento($('#f-ip', m.el), d)) return; await api('salvar_item', { id, ...d }); m.fechar(); toast('Item atualizado.'); recarregar(); };
}

/* ---------- EXPEDIÇÃO E ENTREGA ---------- */
rota('expedicao', async (_p, el) => {
  definirTopoEm(el, 'Expedição e entrega', `<button class="btn" onclick="recarregar()">Atualizar</button>`);
  const r = await api('listar_itens', { status: ['despachado','expedicao','em_transporte','aguardando_retirada'] });
  const peds = {};
  r.itens.forEach(i => (peds[i.pedido_id] ||= { id: i.pedido_id, numero: i.pedido_numero, cliente: i.cliente_nome, obs: i.cliente_obs, forma: i.forma_entrega, itens: [] }).itens.push(i));
  const colunas = [
    ['despachado', 'Despachados', 'Saiu do fornecedor e está vindo para o balcão.'],
    ['expedicao', 'No balcão', 'Material chegou da produção.'],
    ['em_transporte', 'Em transporte', 'Saiu para o endereço do cliente.'],
    ['aguardando_retirada', 'Aguardando retirada', 'Cliente vem buscar no balcão.']
  ];
  const cartaoDespachado = p => {
    const its = p.itens.filter(i => i.status === 'despachado');
    const pode = podeStatus('expedicao');
    const acabPendente = i => i.precisa_acabamento && !i.acabamento_iniciado_em;
    const normais = its.filter(i => !acabPendente(i));
    return `<div class="painel" style="padding:14px;margin:0 0 10px">
      <div style="display:flex;justify-content:space-between;gap:8px"><a href="#/pedido/${p.id}"><b>${esc(p.numero)}</b></a>${badge(p.forma === 'entrega' ? 'Entrega' : 'Retirada', p.forma === 'entrega' ? 'b-azul' : 'b-cinza')}</div>
      <div>${esc(p.cliente)}</div>
      <ul style="margin:8px 0;padding-left:18px" class="small">${its.map(i => `<li style="margin-bottom:6px">${esc(i.descricao)} · ${num(i.quantidade)} un
        ${acabPendente(i) ? `<div>${badge('Precisa de acabamento', 'b-azul')} ${esc(i.acabamento_por || '')}</div>
          ${pode ? `<button class="btn prim peq" style="margin-top:4px" onclick="moverItensPedido('${i.id}','em_producao')">Chegou · vai para acabamento</button>` : ''}` : ''}</li>`).join('')}</ul>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
      ${pode && normais.length ? `<button class="btn prim peq" onclick="moverItensPedido('${normais.map(i => i.id).join(',')}','expedicao')">Chegou no balcão${its.length > normais.length ? ` (${normais.length})` : ''}</button>` : ''}
      ${podeStatus('despachado') ? `<button class="btn peq" onclick="naoChegou('${its.map(i => i.id).join(',')}')">Não chegou</button>` : ''}</div>
    </div>`;
  };
  const cartao = (p, etapa) => {
    if (etapa === 'despachado') return cartaoDespachado(p);
    const its = p.itens.filter(i => i.status === etapa);
    const prox = etapa === 'expedicao' ? (p.forma === 'entrega' ? ['em_transporte', 'Saiu para entrega'] : ['aguardando_retirada', 'Avisar retirada']) : ['entregue', 'Marcar como entregue'];
    return `<div class="painel" style="padding:14px;margin:0 0 10px">
      <div style="display:flex;justify-content:space-between;gap:8px"><a href="#/pedido/${p.id}"><b>${esc(p.numero)}</b></a>${badge(p.forma === 'entrega' ? 'Entrega' : 'Retirada', p.forma === 'entrega' ? 'b-azul' : 'b-cinza')}</div>
      <div>${esc(p.cliente)}</div>
      ${p.obs ? `<div class="alerta small" style="margin-top:6px;padding:6px 10px">${esc(p.obs)}</div>` : ''}
      <ul style="margin:8px 0;padding-left:18px" class="small">${its.map(i => `<li>${esc(i.descricao)} · ${num(i.quantidade)} un</li>`).join('')}</ul>
      ${podeStatus(prox[0]) ? `<button class="btn ${prox[0] === 'entregue' ? 'prim' : ''} peq" onclick="moverItensPedido('${its.map(i => i.id).join(',')}','${prox[0]}')">${prox[1]}</button>` : ''}
    </div>`;
  };
  el.innerHTML = `<div class="grade g4">${colunas.map(([k, t, d]) => {
    const lista = Object.values(peds).filter(p => p.itens.some(i => i.status === k));
    return `<div><h2 style="margin-bottom:2px">${t} <span class="badge b-cinza">${lista.length}</span></h2><p class="small muted" style="margin:0 0 10px">${d}</p>
      ${lista.map(p => cartao(p, k)).join('') || '<div class="vazio painel">Nada aqui.</div>'}</div>`;
  }).join('')}</div>`;
});
async function naoChegou(ids) {
  if (!confirm('Voltar estes itens para "Em produção"? Use quando o material não chegou no dia.')) return;
  await api('mudar_status_itens', { itens: ids.split(','), status: 'em_producao', nao_chegou: true });
  toast('Itens voltaram para Em produção.'); recarregar();
}
async function moverItensPedido(ids, status) { await api('mudar_status_itens', { itens: ids.split(','), status }); toast(`${nomeStatusItem(status)}.`); recarregar(); }

