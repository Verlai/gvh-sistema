/* ---------- CONTAS A RECEBER ---------- */
rota('financeiro', async (filtroInicial, el) => {
  if (!pode('ve_financeiro')) throw new Error('Seu perfil não acessa o financeiro.');
  definirTopoEm(el, 'Contas a receber', `<button class="btn" onclick="recarregar()">Atualizar</button>`);
  const f = S.cache.filtroFin || (S.cache.filtroFin = { filtro: 'abertos', busca: '', de: '', ate: '' });
  if (filtroInicial && !vistaDoEl(el).filtroAplicado) { f.filtro = filtroInicial; vistaDoEl(el).filtroAplicado = true; }
  const abas = [['hoje','Vencem hoje'],['atrasados','Atrasadas'],['abertos','Em aberto'],['pagos','Pagas'],['todos','Todas']];
  const r = await api('listar_recebimentos', { ...f, limite: limLista('receber') });
  const rs = r.resumo;
  el.innerHTML = `
    <div class="grade g4">
      <div class="cartao-num"><span class="n num">${brl(rs.vence_hoje)}</span><span class="muted small">Vence hoje</span></div>
      <div class="cartao-num ${Number(rs.atrasado) ? 'alerta-num' : ''}"><span class="n num">${brl(rs.atrasado)}</span><span class="muted small">Em atraso</span></div>
      <div class="cartao-num"><span class="n num">${brl(rs.a_vencer_7d)}</span><span class="muted small">Vence nos próximos 7 dias</span></div>
      <div class="cartao-num"><span class="n num" style="color:var(--verde)">${brl(rs.recebido_mes)}</span><span class="muted small">Recebido no mês</span></div>
    </div>
    <div class="painel filtros" style="margin-top:16px">
      <div class="chips" style="margin-bottom:12px">${abas.map(([k, n]) => `<button class="chip ${f.filtro === k ? 'ativo' : ''}" data-f="${k}">${n}</button>`).join('')}</div>
      <div class="linha-form" style="margin-bottom:12px">
        <label class="campo" style="flex:2">Buscar<input type="search" id="fin-busca" value="${esc(f.busca)}" placeholder="Pedido ou cliente"></label>
        <label class="campo">De<input type="date" id="fin-de" value="${esc(f.de)}"></label>
        <label class="campo">Até<input type="date" id="fin-ate" value="${esc(f.ate)}"></label>
      </div>
      <p class="small muted" style="margin:0 0 10px">Parcelas pagas são filtradas pela data do pagamento; as demais, pelo vencimento.</p>
      ${tabelaParcelas(r.recebimentos, true)}
      ${rodapeLista('receber', r.recebimentos.length, r.total, 'parcela(s)', `Total filtrado: ${brl(r.valor_total)}`)}
    </div>`;
  ligarMais(el, 'receber', recarregar);
  const filtrar = () => { zerarLista('receber'); recarregar(); };
  $$('[data-f]').forEach(b => b.onclick = () => { f.filtro = b.dataset.f; filtrar(); });
  let t; $('#fin-busca').oninput = e => { f.busca = e.target.value; clearTimeout(t); t = setTimeout(filtrar, 450); };
  $('#fin-de').onchange = e => { f.de = e.target.value; filtrar(); };
  $('#fin-ate').onchange = e => { f.ate = e.target.value; filtrar(); };
});

/* ---------- CONCILIAÇÃO (Financeiro confere o que foi marcado como pago) ---------- */
rota('conciliacao', async (_p, el) => {
  if (!pode('edita_financeiro')) throw new Error('Seu perfil não faz a conciliação.');
  definirTopoEm(el, 'Conciliação de pagamentos', `<button class="btn" onclick="recarregar()">Atualizar</button>`);
  const f = S.cache.filtroConc || (S.cache.filtroConc = { filtro: 'pendentes' });
  const ext = f.filtro === 'extrato';
  const r = await api('listar_conciliacao', ext ? { filtro: 'pendentes', limite: 1 } : { ...f, limite: limLista('conc') });
  const lista = r.recebimentos; lista.forEach(x => S.parcelas[x.id] = x);
  const pend = f.filtro === 'pendentes';
  const abas = [['pendentes', `A conferir (${r.pendentes})`], ['devolvidos', 'Devolvidos · 30 dias'], ['conferidos', 'Conferidos · 30 dias'], ['extrato', 'Extrato do Inter']];
  const chips = `<div class="chips" style="margin-bottom:12px">${abas.map(([k, n]) => `<button class="chip ${f.filtro === k ? 'ativo' : ''}" data-f="${k}">${n}</button>`).join('')}</div>`;
  const ligarAbas = () => $$('[data-f]').forEach(b => b.onclick = () => { f.filtro = b.dataset.f; zerarLista('conc'); recarregar(); });
  if (ext) { await extratoInter(el, chips); ligarAbas(); return; }
  el.innerHTML = `
    <div class="painel filtros">
      ${chips}
      ${pend ? '<p class="small muted" style="margin:0 0 10px">Pagamentos marcados como pagos pelo vendedor ou no pedido. Confira no extrato/maquininha e confirme; se o dinheiro não entrou, devolva com o motivo (a parcela volta a ficar em aberto e a comissão é estornada).</p>' : ''}
      ${!lista.length ? `<div class="vazio">${pend ? 'Nada para conferir. Tudo em dia.' : 'Nenhum registro nos últimos 30 dias.'}</div>` : `
      <div class="tabela-wrap"><table>
        <thead><tr>${pend ? '<th><input type="checkbox" id="conc-todos" aria-label="Selecionar todos"></th>' : ''}<th>Pedido</th><th>Cliente</th><th>Vendedor</th><th>Parcela</th><th>${pend ? 'Pago em' : 'Data'}</th><th>Forma</th><th class="dir">Valor</th><th>${pend ? 'Marcado por' : 'Situação'}</th>${pend ? '<th></th>' : ''}</tr></thead>
        <tbody>${lista.map(x => `<tr>
          ${pend ? `<td><input type="checkbox" class="sel-conc" value="${x.id}"></td>` : ''}
          <td><a href="#/pedido/${x.pedido_id}"><b>${esc(x.pedido_numero)}</b></a></td>
          <td>${esc(x.cliente_nome)}</td>
          <td>${esc(x.vendedor_nome || '—')}</td>
          <td>${esc(TIPOS_PARC[x.tipo] || x.tipo)}${x.parcela_num ? ` ${x.parcela_num}${x.parcelas_total ? '/' + x.parcelas_total : ''}` : ''}</td>
          <td class="num">${data(pend ? x.pago_em : (x.conferido_em || '').slice(0, 10))}</td>
          <td>${esc(FORMAS[x.forma_pagamento] || '—')}${x.tem_comprovante ? `<div><button class="btn link peq" onclick="verComprovante('${x.id}')">Ver comprovante</button></div>` : ''}</td>
          <td class="dir num">${brl(x.valor)}</td>
          <td>${pend ? esc(x.baixado_por_nome || '—')
              : f.filtro === 'devolvidos' ? `${badge('Devolvido', 'b-vermelho')}<div class="small muted">${esc(x.motivo_devolucao || '')} · ${esc(x.conferido_por_nome || '')}</div>`
              : `${badge('Conferido', 'b-verde')}<div class="small muted">${esc(x.conferido_por_nome || '')}</div>`}</td>
          ${pend ? `<td class="dir" style="white-space:nowrap"><button class="btn prim peq" data-ok="${x.id}">Confirmar</button> <button class="btn link peq" data-dev="${x.id}">Devolver</button></td>` : ''}
        </tr>`).join('')}</tbody></table></div>
      ${pend ? `<div class="barra-acao"><span id="conc-cont">Nenhum selecionado</span>
        <button class="btn prim" id="conc-ok" disabled>Confirmar selecionados</button>
        <button class="btn" id="conc-dev" disabled>Devolver selecionados</button></div>` : ''}`}
      ${rodapeLista('conc', lista.length, r.total, 'pagamento(s)', `Total: ${brl(r.valor_total)}`)}
    </div>`;
  ligarMais(el, 'conc', recarregar);
  ligarAbas();
  if (!pend || !lista.length) return;
  const selecionados = () => $$('.sel-conc:checked').map(c => c.value);
  const atualizar = () => {
    const ids = selecionados(), soma = ids.reduce((s, id) => s + Number(S.parcelas[id].valor), 0);
    $('#conc-cont').textContent = ids.length ? `${ids.length} selecionado(s) · ${brl(soma)}` : 'Nenhum selecionado';
    $('#conc-ok').disabled = $('#conc-dev').disabled = !ids.length;
  };
  $$('.sel-conc').forEach(c => c.onchange = atualizar);
  $('#conc-todos').onchange = e => { $$('.sel-conc').forEach(c => c.checked = e.target.checked); atualizar(); };
  const confirmarIds = async ids => { const x = await api('conferir_recebimentos', { ids }); toast(`${x.quantidade} pagamento(s) conferido(s).`); recarregar(); };
  $$('[data-ok]').forEach(b => b.onclick = () => confirmarIds([b.dataset.ok]));
  $$('[data-dev]').forEach(b => b.onclick = () => devolverPagamentos([b.dataset.dev]));
  $('#conc-ok').onclick = () => confirmarIds(selecionados());
  $('#conc-dev').onclick = () => devolverPagamentos(selecionados());
});
function devolverPagamentos(ids) {
  const soma = ids.reduce((s, id) => s + Number(S.parcelas[id]?.valor || 0), 0);
  const m = abrirModal({ titulo: 'Devolver pagamento', corpo: `
    <p style="margin:0 0 12px">${ids.length > 1 ? `${ids.length} pagamentos` : '1 pagamento'} · <b>${brl(soma)}</b>. A parcela volta a ficar em aberto, a comissão é estornada e o motivo aparece para o vendedor no pedido.</p>
    <label class="campo">Motivo *<textarea id="dev-motivo" placeholder="Ex.: Pix não entrou na conta; valor diferente do extrato"></textarea></label>`,
    rodape: `<button class="btn" data-v>Voltar</button><button class="btn perigo" data-s>Devolver</button>` });
  m.el.querySelector('[data-v]').onclick = m.fechar;
  m.el.querySelector('[data-s]').onclick = async () => {
    const motivo = $('#dev-motivo', m.el).value.trim();
    if (!motivo) return toast('Informe o motivo da devolução.', true);
    const x = await api('conferir_recebimentos', { ids, devolver: true, motivo }); m.fechar(); toast(`${x.quantidade} pagamento(s) devolvido(s).`); recarregar();
  };
}

/* ---------- EXTRATO DO INTER (aba da Conciliação; lido pelo fluxo [GVH] Inter) ---------- */
const TIPOS_MOV = { PIX: 'Pix', TRANSFERENCIA: 'Transferência', BOLETO_COBRANCA: 'Boleto', PAGAMENTO: 'Pagamento', INVESTIMENTO: 'Investimento', ESTORNO: 'Estorno', CAMBIO: 'Câmbio', OUTROS: 'Outros' };
async function extratoInter(el, chips) {
  const g = S.cache.filtroExt || (S.cache.filtroExt = { operacao: 'C', busca: '', de: '', ate: '', sem_pedido: false });
  const r = await api('banco_movimentos', { ...g, operacao: g.sem_pedido ? 'C' : g.operacao, limite: limLista('ext') });
  const u = r.ultima_leitura;
  const leitura = !u ? '<span class="muted">O extrato ainda não foi lido.</span>'
    : u.situacao === 'erro' ? `<span style="color:var(--vermelho)">Última leitura com erro (${esc(dataHora(u.concluida_em || u.criada_em))}): ${esc(u.erro || '')}</span>${r.ultima_ok ? ` · <span class="muted">última leitura certa: ${esc(dataHora(r.ultima_ok))}</span>` : ''}`
    : u.situacao === 'lendo' ? '<span class="muted">Lendo o extrato agora…</span>'
    : `<span class="muted">Última leitura: ${esc(dataHora(u.concluida_em))}${u.novos ? ` · ${esc(u.novos)} movimento(s) novo(s)` : ''}</span>`;
  const ops = [['C', 'Entradas'], ['D', 'Saídas'], ['T', 'Todas']];
  const mov = r.movimentos;
  el.innerHTML = `
    <div class="painel filtros">
      ${chips}
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:12px">
        <button class="btn prim" id="ext-ler">Atualizar extrato</button><span class="small">${leitura}</span>
      </div>
      <div class="chips" style="margin-bottom:12px">${ops.map(([k, n]) => `<button class="chip ${!g.sem_pedido && g.operacao === k ? 'ativo' : ''}" data-op="${k}">${n}</button>`).join('')}
        <button class="chip ${g.sem_pedido ? 'ativo' : ''}" data-sp title="Entradas que ainda não foram usadas em nenhum pagamento">Sem pedido</button></div>
      <div class="linha-form" style="margin-bottom:12px">
        <label class="campo" style="flex:2">Buscar<input type="search" id="ext-busca" value="${esc(g.busca)}" placeholder="Nome, descrição ou valor (ex.: 150,00)"></label>
        <label class="campo">De<input type="date" id="ext-de" value="${esc(g.de)}"></label>
        <label class="campo">Até<input type="date" id="ext-ate" value="${esc(g.ate)}"></label>
      </div>
      ${blocoExp('ext-como', 'Como funciona', '<p class="small muted" style="margin:0">O sistema lê o extrato do Inter sozinho de 15 em 15 minutos (das 7h às 20h) e quando alguém clica em "Atualizar extrato" ou "Confirmar pagamento". Sem datas, mostra os últimos 30 dias. O CPF de quem pagou aparece só em parte. Cada movimento é guardado uma vez só. Boleto pago com o número do pedido no "Seu número" dá baixa sozinho; se algo não bate, vira tarefa do financeiro. "Sem pedido" mostra as entradas que ainda não pagaram nenhuma parcela.</p>', false, 'leve')}
      ${!mov.length ? '<div class="vazio">Nenhum movimento neste filtro.</div>' : `
      <div class="tabela-wrap"><table>
        <thead><tr><th>Data</th><th>De / para</th><th>CPF/CNPJ</th><th>Tipo</th><th>Pedido</th><th class="dir">Valor</th></tr></thead>
        <tbody>${mov.map(m => `<tr>
          <td class="num">${data(m.data)}</td>
          <td>${esc(m.nome || m.titulo || '—')}${m.categoria === 'cielo' ? ' ' + badge('Repasse da Cielo', 'b-azul') : m.categoria === 'devolucao' ? ' ' + badge('Devolvido', 'b-cinza') : ''}
            <div class="small muted">${esc([m.nome ? m.titulo : '', m.descricao_pix || m.descricao, m.instituicao].filter(Boolean).join(' · '))}</div></td>
          <td class="num small">${esc(m.documento && m.documento.length === 14 ? fmtDoc(m.documento) : (m.documento || '—'))}</td>
          <td>${esc(TIPOS_MOV[m.tipo] || m.tipo || '—')}</td>
          <td>${usoMovimento(m)}</td>
          <td class="dir num" style="color:var(${m.operacao === 'C' ? '--verde' : '--vermelho'})">${m.operacao === 'D' ? '− ' : ''}${brl(m.valor)}</td>
        </tr>`).join('')}</tbody></table></div>`}
      ${rodapeLista('ext', mov.length, r.total, 'movimento(s)', g.operacao === 'T' ? `Entradas − saídas: ${brl(r.saldo_periodo)}` : `Total: ${brl(Math.abs(Number(r.saldo_periodo)))}`)}
    </div>`;
  ligarMais(el, 'ext', recarregar);
  const filtrar = () => { zerarLista('ext'); recarregar(); };
  $$('[data-op]').forEach(b => b.onclick = () => { g.operacao = b.dataset.op; g.sem_pedido = false; filtrar(); });
  $('[data-sp]').onclick = () => { g.sem_pedido = !g.sem_pedido; filtrar(); };
  let t; $('#ext-busca').oninput = e => { g.busca = e.target.value; clearTimeout(t); t = setTimeout(filtrar, 450); };
  $('#ext-de').onchange = e => { g.de = e.target.value; filtrar(); };
  $('#ext-ate').onchange = e => { g.ate = e.target.value; filtrar(); };
  $('#ext-ler').onclick = e => atualizarExtratoInter(e.currentTarget);
}
// coluna "Pedido" do extrato: onde a entrada foi usada (e quanto sobra)
function usoMovimento(m) {
  const usos = (m.usos || []).map(u => `<a href="#/pedido/${esc(u.pedido_id)}">#${esc(u.numero)}</a>${(m.usos.length > 1 || Number(u.valor) !== Number(m.valor)) ? ` <span class="small muted">${brl(u.valor)}</span>` : ''}${u.origem === 'automatico' ? ' <span class="small muted">(automático)</span>' : ''}`);
  const sobra = m.pode_usar && Number(m.saldo) > 0;
  return usos.join('<br>') + (sobra ? `${usos.length ? `<div class="small muted">sobra ${brl(m.saldo)}</div>` : badge('Sem pedido', 'b-ambar')}` : '') || '—';
}
async function atualizarExtratoInter(btn) {
  let x; try { x = await ocupado(btn, () => api('inter_extrato_atualizar')); } catch { recarregar(); return; }
  toast(x.recente ? 'O extrato acabou de ser lido. Tente de novo em 1 minuto.' : `Extrato atualizado: ${x.novos || 0} movimento(s) novo(s).`);
  recarregar();
}

/* ---------- CONFIRMAR PAGAMENTO PELO EXTRATO DO INTER (Módulo 6, Fase 2 Parte B; D148, D154, D158) ----------
   O banco escolhe as entradas que servem (até 5) e confere tudo de novo na hora de confirmar. */
const esperar = ms => new Promise(r => setTimeout(r, ms));
// lê o Inter antes de buscar (no máximo 1 leitura por minuto no sistema inteiro); se outra pessoa está lendo, espera terminar
async function lerExtratoAgora(id) {
  let aviso = '';
  try {
    const x = await api('inter_extrato_atualizar', {}, true, true);
    if (x.recente && x.situacao === 'lendo') {
      for (let i = 0; i < 8; i++) {
        await esperar(2500);
        const c = await api('buscar_pix_extrato', { id }, true, true);
        if (!c.ultima_leitura || c.ultima_leitura.situacao !== 'lendo') return { cab: c, aviso };
      }
      aviso = 'O extrato ainda está sendo lido; a lista pode não ter os últimos minutos.';
    }
  } catch { aviso = 'Não deu para ler o Inter agora; a lista usa a última leitura.'; }
  return { cab: await api('buscar_pix_extrato', { id }), aviso };
}
async function confirmarPagamentoExtrato(id) {
  const m = abrirModal({ titulo: 'Confirmar pagamento', corpo: '<div id="cp-corpo" class="cp-corpo"><p class="small muted" style="margin:0"><span class="roda"></span> Lendo o extrato do Inter…</p></div>',
    rodape: '<button class="btn" data-v>Voltar</button><button class="btn prim" data-s disabled>Confirmar</button>' });
  m.el.querySelector('.modal').classList.add('estreito');
  const corpo = $('#cp-corpo', m.el), btnOk = m.el.querySelector('[data-s]');
  m.el.querySelector('[data-v]').onclick = m.fechar;
  let cab, aviso;
  try { ({ cab, aviso } = await lerExtratoAgora(id)); } catch (e) { corpo.innerHTML = `<div class="vazio">${esc(e.message)}</div>`; return; }
  if (!document.body.contains(m.el)) return;   // fechou enquanto lia
  if (!cab.aberta) { corpo.innerHTML = '<div class="vazio">Esta parcela não está mais em aberto. Atualize a tela.</div>'; return; }

  const st = { escolha: 'parcela', valor: Number(cab.parcela), mov: null, entradas: [], manual: false };
  const opcoes = [['parcela', 'Esta parcela', cab.parcela]];
  if (Number(cab.em_aberto) !== Number(cab.parcela)) opcoes.push(['tudo', 'Tudo em aberto', cab.em_aberto]);
  if (![Number(cab.parcela), Number(cab.em_aberto)].includes(Number(cab.metade))) opcoes.push(['metade', 'Metade (sinal)', cab.metade]);
  opcoes.push(['outro', 'Outro valor', null]);
  const ultima = cab.ultima_ok ? `Extrato lido em ${esc(dataHora(cab.ultima_ok))}` : 'O extrato ainda não foi lido';
  corpo.innerHTML = `
    <p class="small" style="margin:0">Pedido <b>#${esc(cab.pedido_numero)}</b> · ${esc(cab.cliente)} · falta pagar <b>${brl(cab.em_aberto)}</b></p>
    <div><div class="small muted" style="margin-bottom:6px">Quanto o cliente pagou?</div>
      <div class="chips">${opcoes.map(([k, n, v]) => `<button class="chip ${k === st.escolha ? 'ativo' : ''}" data-val="${k}">${esc(n)}${v !== null ? ' · ' + brl(v) : ''}</button>`).join('')}</div>
      <label class="campo hidden" id="cp-outro" style="margin-top:8px;max-width:200px">Valor (R$)<input type="number" step="0.01" min="0.01" max="${esc(cab.em_aberto)}"></label></div>
    <div id="cp-lista"></div>
    <div id="cp-nota" class="small muted"></div>
    ${blocoExp('cp-manual', 'Não é nenhuma destas? Buscar manualmente', `
      <div class="linha-form" style="flex-wrap:wrap">
        <label class="campo">Valor (R$)<input type="number" step="0.01" min="0.01" data-m="valor"></label>
        <label class="campo" style="flex:2">Nome<input type="search" data-m="nome" placeholder="Nome de quem pagou"></label>
        <label class="campo">De<input type="date" data-m="de"></label>
        <label class="campo">Até<input type="date" data-m="ate"></label>
      </div><div><button class="btn peq" id="cp-buscar">Buscar</button></div>`, false, 'leve')}
    <p class="small muted" style="margin:0">${aviso ? `<span style="color:var(--vermelho)">${esc(aviso)}</span> · ` : ''}${ultima} · <button class="btn link peq" id="cp-ler">Ler de novo</button></p>`;

  const lista = $('#cp-lista', m.el), nota = $('#cp-nota', m.el), outro = $('#cp-outro', m.el);
  const valorFinal = () => st.mov ? Math.min(st.valor, Number(st.mov.saldo)) : st.valor;
  const atualizarBotao = () => {
    const v = valorFinal(), ok = st.mov && v > 0;
    btnOk.disabled = !ok; btnOk.textContent = ok ? `Confirmar ${brl(v)}` : 'Confirmar';
    if (!ok) { nota.textContent = ''; return; }
    const s = Number(st.mov.saldo), partes = [];
    if (s < st.valor) partes.push(`A entrada é menor: confirma ${brl(s)} e o resto (${brl(st.valor - s)}) continua em aberto.`);
    if (s > st.valor) partes.push(`Sobram ${brl(s - st.valor)} desta entrada no extrato, para outro pagamento.`);
    if (v > Number(cab.parcela)) partes.push('Paga esta parcela e as próximas em aberto do pedido.');
    nota.textContent = partes.join(' ');
  };
  const desenhar = (r, manual) => {
    st.entradas = r.entradas; st.mov = null;
    lista.innerHTML = !r.entradas.length
      ? `<div class="vazio">${manual ? 'Nada encontrado com estes filtros.' : 'Nenhuma entrada do extrato com este valor ou com o nome do cliente.'} ${manual ? '' : 'Use a busca manual abaixo.'}</div>`
      : `<div class="cp-lista">${r.entradas.map(e => `
        <label class="cp-opcao"><input type="radio" name="cp-mov" value="${esc(e.id)}">
          <div><b>${esc(e.nome || '—')}</b>${e.motivo ? ' ' + badge(e.motivo, e.motivo === 'Valor e nome batem' ? 'b-verde' : 'b-cinza') : ''}
            <div class="small muted">${data(e.data)} · ${esc(TIPO_ENTRADA[e.tipo] || e.tipo)}${e.documento ? ' · ' + esc(e.documento.length === 14 ? fmtDoc(e.documento) : e.documento) : ''}${e.descricao ? ' · ' + esc(e.descricao) : ''}</div></div>
          <div class="dir num"><b>${brl(e.valor)}</b>${Number(e.saldo) < Number(e.valor) ? `<div class="small muted">sobra ${brl(e.saldo)}</div>` : ''}</div>
        </label>`).join('')}</div>${r.total > r.entradas.length ? `<p class="small muted" style="margin:6px 0 0">Há mais ${r.total - r.entradas.length}. Refine a busca.</p>` : ''}`;
    lista.querySelectorAll('[name=cp-mov]').forEach(i => i.onchange = () => { st.mov = st.entradas.find(e => e.id === i.value); atualizarBotao(); });
    atualizarBotao();
  };
  const buscar = async () => {
    if (!(st.valor > 0)) { lista.innerHTML = ''; st.mov = null; atualizarBotao(); return; }
    st.manual = false;
    try { desenhar(await api('buscar_pix_extrato', { id, valor: st.valor }, false, true), false); } catch { /* erro já avisado */ }
  };
  const buscarManual = async () => {
    const f = {}; m.el.querySelectorAll('[data-m]').forEach(i => { if (i.value.trim()) f[i.dataset.m] = i.value.trim(); });
    if (!Object.keys(f).length) return toast('Informe o valor, o nome ou a data para buscar.', true);
    st.manual = true;
    try { desenhar(await ocupado($('#cp-buscar', m.el), () => api('buscar_pix_extrato', { id, manual: true, ...f })), true); } catch { /* erro já avisado */ }
  };
  m.el.querySelectorAll('[data-val]').forEach(b => b.onclick = () => {
    m.el.querySelectorAll('[data-val]').forEach(x => x.classList.toggle('ativo', x === b));
    st.escolha = b.dataset.val; outro.classList.toggle('hidden', st.escolha !== 'outro');
    const o = opcoes.find(x => x[0] === st.escolha);
    if (st.escolha === 'outro') { st.valor = Number(outro.querySelector('input').value) || 0; outro.querySelector('input').focus(); }
    else st.valor = Number(o[2]);
    if (st.manual) atualizarBotao(); else buscar();
  });
  let t; outro.querySelector('input').oninput = e => {
    st.valor = Math.round(Number(e.target.value) * 100) / 100 || 0;
    clearTimeout(t); t = setTimeout(() => { if (st.manual) atualizarBotao(); else buscar(); }, 450);
  };
  $('#cp-buscar', m.el).onclick = buscarManual;
  m.el.querySelectorAll('[data-m]').forEach(i => i.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); buscarManual(); } });
  $('#cp-ler', m.el).onclick = async e => {
    try { await ocupado(e.currentTarget, () => api('inter_extrato_atualizar', {}, true)); } catch { toast('Não deu para ler o Inter agora.', true); }
    st.manual ? buscarManual() : buscar();
  };
  btnOk.onclick = async () => {
    const v = valorFinal();
    if (!st.mov || !(v > 0)) return;
    try { await ocupado(btnOk, () => api('confirmar_pagamento_extrato', { id, movimento_id: st.mov.id, valor: v.toFixed(2) })); }
    catch { buscar(); return; }
    m.fechar(); toast(`Pagamento de ${brl(v)} confirmado.`); recarregar();
  };
  buscar();
}

/* ---------- COMISSÕES ---------- */
rota('comissoes', async (_p, el) => {
  definirTopoEm(el, 'Comissões', `<button class="btn" onclick="recarregar()">Atualizar</button>`);
  const visao = S.cache.visaoComissao || 'mes';
  const abasVisao = `<div class="chips" style="margin-bottom:14px"><button class="chip ${visao === 'mes' ? 'ativo' : ''}" data-visao="mes">Por mês</button><button class="chip ${visao === 'pedidos' ? 'ativo' : ''}" data-visao="pedidos">Por pedido</button></div>`;
  const ligarVisao = () => $$('[data-visao]').forEach(b => b.onclick = () => { S.cache.visaoComissao = b.dataset.visao; recarregar(); });
  if (visao === 'pedidos') { await comissoesPorPedido(el, abasVisao); ligarVisao(); return; }
  const comp = S.cache.compComissao || hoje().slice(0, 7);
  const r = await api('listar_comissoes', { competencia: comp + '-01' });
  const nomeMes = iso => new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  const doMes = r.fechamentos.filter(x => x.competencia === r.competencia);
  const devidos = doMes.filter(x => x.recebe_comissao);
  const economizado = doMes.reduce((s, x) => s + Number(x.valor_economizado || 0), 0);
  const SIT = { aberto: ['Mês em andamento', 'b-cinza'], fechado: ['Aguardando repasse', 'b-ambar'], pago: ['Repassado', 'b-verde'] };
  el.innerHTML = `${abasVisao}
    <div class="painel filtros"><div class="linha-form">
      <label class="campo" style="max-width:220px">Mês dos pagamentos<input type="month" id="c-mes" value="${comp}"></label>
      <p class="small muted" style="flex:3;margin:0 0 9px">A comissão é de 5% sobre cada valor pago pelo cliente, contada no mês em que o pagamento entrou. O repasse acontece no 5º dia útil do mês seguinte.</p>
    </div></div>
    <div class="grade g3" style="margin-top:16px">
      ${devidos.map(x => `<div class="cartao-num"><span class="n num">${brl(x.valor_devido)}</span><span class="muted small">${esc(x.vendedor_nome)} · repasse ${data(x.data_repasse_prevista)}</span>
        <div style="margin-top:8px;display:flex;gap:8px;align-items:center;flex-wrap:wrap">${badge(...SIT[x.situacao])}
        ${pode('gerencia_comissoes') && x.situacao === 'fechado' ? `<button class="btn prim peq" onclick="pagarComissao('${x.id}')">Marcar repasse feito</button>` : ''}
        ${pode('gerencia_comissoes') && x.situacao === 'pago' ? `<button class="btn link peq" onclick="pagarComissao('${x.id}',true)">Desfazer</button>` : ''}</div></div>`).join('')}
      ${economizado > 0 ? `<div class="cartao-num" style="border-color:var(--verde)"><span class="n num" style="color:var(--verde)">${brl(economizado)}</span><span class="muted small">Comissão economizada em vendas da diretoria</span></div>` : ''}
      ${!doMes.length ? `<div class="vazio painel" style="grid-column:1/-1">Nenhum pagamento de cliente gerou comissão em ${nomeMes(r.competencia)}.</div>` : ''}
    </div>
    ${r.lancamentos.length ? `<div class="painel" style="margin-top:16px"><div class="painel-cab"><h2>Pagamentos que geraram comissão em ${nomeMes(r.competencia)}</h2></div>
      <div class="tabela-wrap"><table><thead><tr><th>Data</th><th>Pedido</th><th>Cliente</th><th>Vendedor</th><th class="dir">Valor pago</th><th class="dir">Comissão</th><th>Repasse</th></tr></thead><tbody>
      ${r.lancamentos.map(l => `<tr><td class="num">${data(l.pago_em || l.created_at)}</td><td>${l.pedido_id ? `<a href="#/pedido/${l.pedido_id}">${esc(l.pedido_numero)}</a>` : '—'}</td>
        <td>${esc(l.cliente_nome || '')}</td><td>${esc(l.vendedor_nome)}</td><td class="dir num">${brl(l.valor_base)}</td>
        <td class="dir num" style="${l.valor_comissao < 0 ? 'color:var(--vermelho)' : ''}">${brl(l.valor_comissao)}</td>
        <td>${situacaoLancamento(l)}</td></tr>`).join('')}
      </tbody></table></div></div>` : ''}
    ${r.fechamentos.length ? `<div class="painel" style="margin-top:16px"><div class="painel-cab"><h2>Últimos 12 meses</h2></div>
      <div class="tabela-wrap"><table><thead><tr><th>Mês</th><th>Vendedor</th><th class="dir">Devido</th><th class="dir">Economizado</th><th>Repasse</th><th>Situação</th></tr></thead><tbody>
      ${r.fechamentos.map(x => `<tr><td>${nomeMes(x.competencia)}</td><td>${esc(x.vendedor_nome)}</td><td class="dir num">${brl(x.valor_devido)}</td>
        <td class="dir num">${Number(x.valor_economizado) ? brl(x.valor_economizado) : '—'}</td><td class="num">${x.pago_em ? 'Feito em ' + data(x.pago_em) : data(x.data_repasse_prevista)}</td><td>${badge(...SIT[x.situacao])}</td></tr>`).join('')}
      </tbody></table></div></div>` : ''}`;
  $('#c-mes').onchange = e => { S.cache.compComissao = e.target.value; recarregar(); };
  ligarVisao();
});
function situacaoLancamento(l) {
  if (!l.devida) return badge('Economizada', 'b-verde');
  if (l.tipo === 'estorno') return `${badge(l.repasse_feito_em ? 'Descontado em ' + data(l.repasse_feito_em) : 'Desconto no repasse de ' + data(l.repasse_previsto), 'b-vermelho')}<div class="small muted">${esc(l.motivo || '')}</div>`;
  if (l.estornado) return `${badge('Repassada e estornada', 'b-cinza')}<div class="small muted">${esc(l.motivo || '')}</div>`;
  return l.repasse_feito_em ? badge('Repassada em ' + data(l.repasse_feito_em), 'b-verde') : badge('A repassar em ' + data(l.repasse_previsto), 'b-ambar');
}
async function comissoesPorPedido(el, abasVisao) {
  const f = S.cache.filtroComPed || (S.cache.filtroComPed = { filtro: 'todos', busca: '', vendedor_id: '' });
  const r = await api('listar_comissoes', { visao: 'pedidos', ...f, limite: limLista('comped') });
  const todas = pode('ve_todas_comissoes');
  const abas = [['todos', 'Todos'], ['a_repassar', 'A repassar / descontar'], ['cancelados', 'Pedidos cancelados']];
  el.innerHTML = `${abasVisao}
    <div class="painel filtros">
      <div class="chips" style="margin-bottom:12px">${abas.map(([k, n]) => `<button class="chip ${f.filtro === k ? 'ativo' : ''}" data-fc="${k}">${n}</button>`).join('')}</div>
      <div class="linha-form" style="margin-bottom:12px">
        <label class="campo" style="flex:2">Buscar<input type="search" id="cp-busca" value="${esc(f.busca)}" placeholder="Pedido ou cliente"></label>
        ${todas ? `<label class="campo">Vendedor<select id="cp-vend"><option value="">Todos</option>${S.base.vendedores.map(v => `<option value="${v.id}" ${v.id === f.vendedor_id ? 'selected' : ''}>${esc(v.nome)}</option>`).join('')}</select></label>` : ''}
      </div>
      <p class="small muted" style="margin:0 0 10px">Cada pedido que já teve pagamento do cliente, com a comissão gerada e quanto já foi repassado. Se um pedido com comissão repassada for cancelado, o valor é descontado do vendedor no próximo repasse.</p>
      ${r.pedidos.length ? `<div class="tabela-wrap"><table><thead><tr><th>Pedido</th><th>Cliente</th><th>Vendedor</th><th class="dir">Pago pelo cliente</th><th class="dir">Comissão</th><th class="dir">Repassada</th><th class="dir">A repassar</th><th>Situação</th></tr></thead><tbody>
      ${r.pedidos.map(p => { const ar = Number(p.a_repassar || 0); return `<tr>
        <td><a href="#/pedido/${p.pedido_id}"><b>${esc(p.pedido_numero)}</b></a></td><td>${esc(p.cliente_nome)}</td><td>${esc(p.vendedor_nome)}</td>
        <td class="dir num">${brl(p.pago_cliente)}</td>
        <td class="dir num">${p.devida ? brl(p.comissao_liquida) : `<span class="muted">${brl(p.comissao_liquida)}</span>`}</td>
        <td class="dir num">${brl(p.repassada)}</td>
        <td class="dir num" style="${ar < 0 ? 'color:var(--vermelho)' : ''}">${ar < 0 ? 'Descontar ' + brl(-ar) : brl(ar)}</td>
        <td>${p.pedido_status === 'cancelado' ? `${badge('Pedido cancelado', 'b-vermelho')}<div class="small muted">${esc(p.motivo_cancelamento || '')}</div>`
             : !p.devida ? badge('Economizada (diretoria)', 'b-verde')
             : ar === 0 ? badge('Repassada', 'b-verde') : badge('A repassar', 'b-ambar')}</td></tr>`; }).join('')}
      </tbody></table></div>` : '<div class="vazio">Nenhum pedido com comissão neste filtro.</div>'}
      ${rodapeLista('comped', r.pedidos.length, r.total, 'pedido(s)')}
    </div>`;
  ligarMais(el, 'comped', recarregar);
  const filtrar = () => { zerarLista('comped'); recarregar(); };
  $$('[data-fc]').forEach(b => b.onclick = () => { f.filtro = b.dataset.fc; filtrar(); });
  let t; $('#cp-busca').oninput = e => { f.busca = e.target.value; clearTimeout(t); t = setTimeout(filtrar, 450); };
  if ($('#cp-vend')) $('#cp-vend').onchange = e => { f.vendedor_id = e.target.value; filtrar(); };
}
async function pagarComissao(id, desfazer = false) {
  if (!await confirmar(desfazer ? 'Desfazer o registro deste repasse?' : 'Confirmar que o repasse desta comissão foi feito hoje?', desfazer ? 'Desfazer' : 'Confirmar repasse')) return;
  await api('pagar_comissao', { id, desfazer }); toast(desfazer ? 'Registro desfeito.' : 'Repasse registrado.'); recarregar();
}

