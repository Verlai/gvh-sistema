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
  const outraAba = ['extrato', 'creditos'].includes(f.filtro);
  const r = await api('listar_conciliacao', outraAba ? { filtro: 'pendentes', limite: 1 } : { ...f, limite: limLista('conc') });
  const lista = r.recebimentos; lista.forEach(x => S.parcelas[x.id] = x);
  const pend = f.filtro === 'pendentes';
  const abas = [['pendentes', `A conferir (${r.pendentes})`], ['devolvidos', 'Devolvidos · 30 dias'], ['conferidos', 'Conferidos · 30 dias'], ['extrato', 'Extrato do Inter'], ['creditos', 'Créditos de clientes']];
  const chips = `<div class="chips" style="margin-bottom:12px">${abas.map(([k, n]) => `<button class="chip ${f.filtro === k ? 'ativo' : ''}" data-f="${k}">${n}</button>`).join('')}</div>`;
  const ligarAbas = () => $$('[data-f]').forEach(b => b.onclick = () => { f.filtro = b.dataset.f; zerarLista('conc'); recarregar(); });
  if (f.filtro === 'extrato') { await extratoInter(el, chips); ligarAbas(); return; }
  if (f.filtro === 'creditos') { await creditosClientes(el, chips); ligarAbas(); return; }
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
      ${blocoExp('ext-como', 'Como funciona', '<p class="small muted" style="margin:0">O sistema lê o extrato do Inter sozinho de 15 em 15 minutos (das 7h às 20h) e quando alguém clica em "Atualizar extrato" ou "Confirmar pagamento". Sem datas, mostra os últimos 30 dias. O CPF de quem pagou aparece só em parte. Cada movimento é guardado uma vez só. Boleto pago com o número do pedido no "Seu número" dá baixa sozinho; se algo não bate, vira tarefa do financeiro. "Sem pedido" mostra as entradas que ainda não pagaram nenhuma parcela. Devolução de Pix feita no app do Inter: o sistema acha o Pix que entrou (mesmo CPF/CNPJ, até 90 dias), tira o valor do saldo dele e abre uma tarefa para o financeiro conferir o pedido.</p>', false, 'leve')}
      ${!mov.length ? '<div class="vazio">Nenhum movimento neste filtro.</div>' : `
      <div class="tabela-wrap"><table>
        <thead><tr><th>Data</th><th>De / para</th><th>CPF/CNPJ</th><th>Tipo</th><th>Pedido</th><th class="dir">Valor</th></tr></thead>
        <tbody>${mov.map(m => `<tr>
          <td class="num">${data(m.data)}</td>
          <td>${esc(m.nome || m.titulo || '—')}${m.categoria === 'cielo' ? ' ' + badge('Repasse da Cielo', 'b-azul') : m.categoria === 'devolucao' ? ' ' + badge('Devolvido', 'b-cinza') : m.e_devolucao ? ' ' + badge('Devolução ao cliente', 'b-cinza') : ''}
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
// coluna "Pedido" do extrato: onde a entrada foi usada (e quanto sobra); na devolução, o Pix que voltou ao cliente
function usoMovimento(m) {
  if (m.e_devolucao) {
    const d = m.devolucao;
    if (!d) return '<span class="small muted">Pix de origem não achado</span>';
    const peds = (d.pedidos || []).map(p => `<a href="#/pedido/${esc(p.pedido_id)}">#${esc(p.numero)}</a>`).join(', ');
    return `<span class="small">Devolve o Pix de ${data(d.data)} (${brl(d.valor)})</span>${peds ? '<br>' + peds : ''}`;
  }
  const dev = Number(m.devolvido) > 0 ? `<div class="small" style="color:var(--vermelho)">devolvido ${brl(m.devolvido)}</div>` : '';
  const usos = (m.usos || []).map(u => `<a href="#/pedido/${esc(u.pedido_id)}">#${esc(u.numero)}</a>${u.credito ? ' <span class="small muted">→ crédito do cliente</span>' : ''}${(m.usos.length > 1 || Number(u.valor) !== Number(m.valor)) ? ` <span class="small muted">${brl(u.valor)}</span>` : ''}${u.origem === 'automatico' ? ' <span class="small muted">(automático)</span>' : ''}`);
  const sobra = m.pode_usar && Number(m.saldo) > 0;
  return usos.join('<br>') + (sobra ? `${usos.length ? `<div class="small muted">sobra ${brl(m.saldo)}</div>` : badge('Sem pedido', 'b-ambar')}` : '') + dev || '—';
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
async function lerExtratoAgora(params) {
  let aviso = '';
  try {
    const x = await api('inter_extrato_atualizar', {}, true, true);
    if (x.recente && x.situacao === 'lendo') {
      for (let i = 0; i < 8; i++) {
        await esperar(2500);
        const c = await api('buscar_pix_extrato', params, true, true);
        if (!c.ultima_leitura || c.ultima_leitura.situacao !== 'lendo') return { cab: c, aviso };
      }
      aviso = 'O extrato ainda está sendo lido; a lista pode não ter os últimos minutos.';
    }
  } catch { aviso = 'Não deu para ler o Inter agora; a lista usa a última leitura.'; }
  return { cab: await api('buscar_pix_extrato', params), aviso };
}
function confirmarPagamentoExtrato(id) { return janelaExtrato({ id }); }
// na criação do pedido (ainda sem parcela): só escolhe a entrada. Devolve a entrada, null ("Não achei") ou undefined (fechou)
function escolherEntradaExtrato(cliente_id, valor) { return new Promise(res => janelaExtrato({ cliente_id, valor: Number(valor), aoEscolher: res })); }
async function janelaExtrato(o) {
  const escolher = !!o.aoEscolher, id = o.id;
  const base = escolher ? { cliente_id: o.cliente_id, valor_pedido: o.valor } : { id };
  let devolvido = false; const devolver = x => { if (escolher && !devolvido) { devolvido = true; o.aoEscolher(x); } };
  const m = abrirModal({ titulo: escolher ? 'Buscar o pagamento no extrato' : 'Confirmar pagamento', corpo: '<div id="cp-corpo" class="cp-corpo"><p class="small muted" style="margin:0"><span class="roda"></span> Lendo o extrato do Inter…</p></div>',
    rodape: `<button class="btn" data-v>Voltar</button>${escolher ? '<button class="btn" data-nao>Não achei</button>' : ''}<button class="btn prim" data-s disabled>${escolher ? 'Usar esta entrada' : 'Confirmar'}</button>` });
  m.el.querySelector('.modal').classList.add('estreito');
  const corpo = $('#cp-corpo', m.el), btnOk = m.el.querySelector('[data-s]');
  m.el.querySelector('[data-v]').onclick = m.fechar;
  if (escolher) {
    m.el.querySelector('[data-nao]').onclick = () => { devolver(null); m.fechar(); };
    // fechou pelo ×, Esc ou clique fora: nada escolhido
    const obs = new MutationObserver(() => { if (!document.body.contains(m.el)) { obs.disconnect(); devolver(undefined); } });
    obs.observe($('#modais'), { childList: true });
  }
  let cab, aviso;
  try { ({ cab, aviso } = await lerExtratoAgora(escolher ? { ...base, valor: o.valor } : base)); } catch (e) { corpo.innerHTML = `<div class="vazio">${esc(e.message)}</div>`; return; }
  if (!document.body.contains(m.el)) return;   // fechou enquanto lia
  if (!cab.aberta) { corpo.innerHTML = '<div class="vazio">Esta parcela não está mais em aberto. Atualize a tela.</div>'; return; }

  const st = { escolha: 'parcela', valor: Number(cab.parcela), mov: null, entradas: [], manual: false,
               sobra: { destino: null, valor: '', numero: '', info: null } };   // pagou a mais: o que fazer com a sobra (D156)
  const opcoes = [['parcela', escolher ? 'Valor' : 'Esta parcela', cab.parcela]];
  if (!escolher && Number(cab.em_aberto) !== Number(cab.parcela)) opcoes.push(['tudo', 'Tudo em aberto', cab.em_aberto]);
  if (!escolher && ![Number(cab.parcela), Number(cab.em_aberto)].includes(Number(cab.metade))) opcoes.push(['metade', 'Metade (sinal)', cab.metade]);
  if (!escolher) opcoes.push(['outro', 'Outro valor', null]);
  const ultima = cab.ultima_ok ? `Extrato lido em ${esc(dataHora(cab.ultima_ok))}` : 'O extrato ainda não foi lido';
  corpo.innerHTML = `
    <p class="small" style="margin:0">${escolher ? `Novo pagamento · ${esc(cab.cliente)} · <b>${brl(cab.parcela)}</b>` : `Pedido <b>#${esc(cab.pedido_numero)}</b> · ${esc(cab.cliente)} · falta pagar <b>${brl(cab.em_aberto)}</b>`}</p>
    <div class="${escolher ? 'hidden' : ''}"><div class="small muted" style="margin-bottom:6px">Quanto o cliente pagou?</div>
      <div class="chips">${opcoes.map(([k, n, v]) => `<button class="chip ${k === st.escolha ? 'ativo' : ''}" data-val="${k}">${esc(n)}${v !== null ? ' · ' + brl(v) : ''}</button>`).join('')}</div>
      <label class="campo hidden" id="cp-outro" style="margin-top:8px;max-width:200px">Valor (R$)<input type="number" step="0.01" min="0.01" max="${esc(cab.em_aberto)}"></label></div>
    <div id="cp-lista"></div>
    <div id="cp-nota" class="small muted"></div>
    <div id="cp-sobra" class="cp-sobra hidden"></div>
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
  // pagou a mais (D156): a entrada é maior que tudo o que falta pagar e o valor escolhido paga tudo → escolher o destino da sobra
  const caixaSobra = $('#cp-sobra', m.el), so = st.sobra;
  const pedidoId = escolher ? null : (S.parcelas[id] && S.parcelas[id].pedido_id) || null;
  const limite = Number(escolher ? cab.parcela : cab.em_aberto);
  const cent = x => Math.round(Number(x) * 100);
  const sobraAtual = () => { if (!st.mov) return 0; const s = cent(st.mov.saldo), v = cent(valorFinal()); return v >= cent(limite) && s > v ? (s - v) / 100 : 0; };
  const sobraPronta = () => {
    if (!so.destino) return false;
    if (so.destino !== 'pedido') return true;
    const v = cent(so.valor);
    return !!so.info && !so.info.cancelado && !so.info.mesmo_pedido && v > 0 && v <= cent(sobraAtual()) && v <= cent(so.info.em_aberto);
  };
  const desenharSobra = () => {
    const sob = sobraAtual();
    caixaSobra.classList.toggle('hidden', !sob);
    if (!sob) return;
    if (so.destino === 'pedido' && !so.valor) so.valor = sob.toFixed(2);
    const i = so.info;
    const infoPed = !i ? '' : i.cancelado ? '<span style="color:var(--vermelho)">Este pedido está cancelado.</span>'
      : i.mesmo_pedido ? '<span style="color:var(--vermelho)">Escolha outro pedido.</span>'
      : `Pedido <b>#${esc(i.numero)}</b> · ${esc(i.cliente || '—')} · vendedor ${esc(i.vendedor || '—')} · falta pagar <b>${brl(i.em_aberto)}</b>${!Number(i.em_aberto) ? ' · <span style="color:var(--vermelho)">nada em aberto</span>' : (!i.mesmo_cliente || !i.mesmo_vendedor) ? ' · <span style="color:var(--vermelho)">outro cliente ou vendedor: vai pedir confirmação</span>' : ''}`;
    caixaSobra.innerHTML = `<div class="small" style="margin-bottom:6px"><b>O cliente pagou ${brl(sob)} a mais.</b> O que fazer com a sobra?</div>
      <div class="chips">${[['credito', 'Crédito do cliente'], ['pedido', 'Outro pedido'], ['fatima', 'Deixar para a Fátima']].map(([k, n]) => `<button type="button" class="chip ${so.destino === k ? 'ativo' : ''}" data-sob="${k}">${n}</button>`).join('')}</div>
      ${so.destino === 'credito' ? `<p class="small muted" style="margin:6px 0 0">${brl(sob)} ficam de crédito para o cliente usar num próximo pedido (em "Outros" ou no botão "Usar crédito").</p>` : ''}
      ${so.destino === 'fatima' ? '<p class="small muted" style="margin:6px 0 0">A sobra continua no extrato ("Sem pedido") e a Fátima recebe uma tarefa para decidir.</p>' : ''}
      ${so.destino === 'pedido' ? `<div class="linha-form" style="margin-top:8px">
          <label class="campo" style="max-width:140px">Nº do pedido<input type="text" data-sobc="numero" value="${esc(so.numero)}" inputmode="numeric"></label>
          <label class="campo" style="max-width:160px">Valor (R$)<input type="number" step="0.01" min="0.01" max="${sob.toFixed(2)}" data-sobc="valor" value="${esc(so.valor)}"></label>
          <div style="align-self:flex-end"><button type="button" class="btn peq" data-sob-buscar>Conferir</button></div></div>
        ${infoPed ? `<p class="small" style="margin:6px 0 0">${infoPed}</p>` : ''}` : ''}`;
    caixaSobra.querySelectorAll('[data-sob]').forEach(b => b.onclick = () => { so.destino = b.dataset.sob; desenharSobra(); atualizarBotao(); });
    const num = caixaSobra.querySelector('[data-sobc=numero]');
    if (!num) return;
    const conferirPedido = async () => {
      so.numero = num.value.trim().replace(/^#/, ''); so.info = null;
      if (so.numero) { try { so.info = await api('buscar_pedido_sobra', { numero: so.numero, pedido_id: pedidoId }, false, true); } catch { /* erro já avisado */ } }
      desenharSobra(); atualizarBotao();
    };
    num.onchange = conferirPedido;
    num.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); conferirPedido(); } };
    caixaSobra.querySelector('[data-sob-buscar]').onclick = conferirPedido;
    caixaSobra.querySelector('[data-sobc=valor]').oninput = e => { so.valor = e.target.value; atualizarBotao(); };
  };
  let ultimaSobra = 0;
  const atualizarBotao = () => {
    const v = valorFinal(), tem = st.mov && v > 0, sob = sobraAtual();
    if (sob !== ultimaSobra) { ultimaSobra = sob; desenharSobra(); }
    btnOk.disabled = !tem || (sob > 0 && !sobraPronta());
    btnOk.textContent = escolher ? 'Usar esta entrada' : tem ? `Confirmar ${brl(v)}` : 'Confirmar';
    if (!tem) { nota.textContent = ''; return; }
    const s = Number(st.mov.saldo), partes = [];
    if (s < st.valor) partes.push(`A entrada é menor: ${escolher ? 'vai confirmar' : 'confirma'} ${brl(s)} e o resto (${brl(st.valor - s)}) continua em aberto.`);
    if (s > st.valor && !sob) partes.push(cent(s) > cent(limite)
      ? `A entrada (${brl(s)}) é maior que tudo o que falta pagar: escolha "Tudo em aberto" para resolver a sobra.`
      : `Sobram ${brl(s - st.valor)} desta entrada no extrato, para outro pagamento.`);
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
    try { desenhar(await api('buscar_pix_extrato', { ...base, valor: st.valor }, false, true), false); } catch { /* erro já avisado */ }
  };
  const buscarManual = async () => {
    const f = {}; m.el.querySelectorAll('[data-m]').forEach(i => { if (i.value.trim()) f[i.dataset.m] = i.value.trim(); });
    if (!Object.keys(f).length) return toast('Informe o valor, o nome ou a data para buscar.', true);
    st.manual = true;
    try { desenhar(await ocupado($('#cp-buscar', m.el), () => api('buscar_pix_extrato', { ...base, manual: true, ...f })), true); } catch { /* erro já avisado */ }
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
    const sob = sobraAtual(); let sobra = null;
    if (sob) {
      if (!sobraPronta()) return;
      sobra = { destino: so.destino };
      if (so.destino === 'credito') sobra.valor = sob.toFixed(2);
      if (so.destino === 'pedido') {
        sobra.valor = Number(so.valor).toFixed(2); sobra.pedido_numero = so.info.numero;
        // outro cliente ou outro vendedor (ou pedido ainda sendo criado): segunda confirmação
        if (escolher || !so.info.mesmo_cliente || !so.info.mesmo_vendedor) {
          if (!await confirmar(`Mandar ${brl(Number(sobra.valor))} da sobra para o pedido #${so.info.numero} (${so.info.cliente || '—'}, vendedor ${so.info.vendedor || '—'})?`, 'Mandar para este pedido')) return;
          sobra.confirmado = true;
        }
      }
    }
    if (escolher) { devolver({ ...st.mov, sobra }); m.fechar(); return; }
    try { await ocupado(btnOk, () => api('confirmar_pagamento_extrato', { id, movimento_id: st.mov.id, valor: v.toFixed(2), sobra })); }
    catch { buscar(); return; }
    m.fechar(); toast(`Pagamento de ${brl(v)} confirmado.${textoSobra(sobra)}`); recarregar();
  };
  buscar();
}
const textoSobra = s => !s ? '' : s.destino === 'credito' ? ` A sobra (${brl(Number(s.valor))}) virou crédito do cliente.`
  : s.destino === 'pedido' ? ` A sobra foi para o pedido #${s.pedido_numero}.` : ' A sobra ficou para a Fátima resolver.';

/* ---------- CRÉDITO DO CLIENTE (Módulo 6, Parte C1; D156) ----------
   Nasce da sobra de um pagamento; é usado em "Outros" ao criar o pedido ou no botão "Usar crédito" da parcela.
   O banco confere o saldo; só o financeiro ajusta (com motivo). */
const TIPOS_CRED = { sobra: 'Sobra de pagamento', uso: 'Usado', uso_desfeito: 'Uso desfeito', ajuste: 'Ajuste', devolucao: 'Pix devolvido', cancelamento: 'Pedido cancelado', cancelamento_desfeito: 'Cancelamento desfeito' };
// no pedido: se o cliente tem crédito, mostra "Usar crédito" nas parcelas em aberto
async function creditoNoPedido(p, el) {
  if (!pode('ve_financeiro') || p.status === 'cancelado') return;
  const bts = [...el.querySelectorAll('[data-usar-credito]')]; if (!bts.length) return;
  let r; try { r = await api('buscar_credito_cliente', { pedido_id: p.id }, true, true); } catch { return; }
  const saldo = Number(r.saldo) || 0; if (saldo <= 0) return;
  bts.forEach(b => { b.classList.remove('hidden'); b.textContent = `Usar crédito (${brl(saldo)})`; b.onclick = () => usarCredito(b.dataset.usarCredito, saldo); });
}
async function usarCredito(id, saldo) {
  const r = S.parcelas[id]; if (!r) return;
  const v = Math.min(Number(r.valor), saldo);
  const msg = `Usar o crédito do cliente nesta parcela? Saldo: ${brl(saldo)}. Vai pagar ${brl(v)}${v < Number(r.valor) ? ` e o resto (${brl(Number(r.valor) - v)}) continua em aberto` : ''}. Entra pago e conferido.`;
  if (!await confirmar(msg, 'Usar crédito')) return;
  const x = await api('usar_credito_cliente', { id }); toast(`Pago com o crédito do cliente: ${brl(x.valor)}.`); recarregar();
}
// aba "Créditos de clientes" da Conciliação (só o financeiro)
async function creditosClientes(el, chips) {
  const g = S.cache.filtroCred || (S.cache.filtroCred = { busca: '', todos: false });
  const r = await api('listar_creditos_clientes', { ...g, limite: limLista('cred') });
  el.innerHTML = `
    <div class="painel filtros">
      ${chips}
      <div class="linha-form" style="margin-bottom:12px;align-items:flex-end">
        <label class="campo" style="flex:2">Buscar<input type="search" id="cred-busca" value="${esc(g.busca)}" placeholder="Nome do cliente"></label>
        <label class="check" style="white-space:normal"><input type="checkbox" id="cred-todos" ${g.todos ? 'checked' : ''}> Mostrar também quem já usou tudo</label>
      </div>
      ${blocoExp('cred-como', 'Como funciona', '<p class="small muted" style="margin:0">O crédito nasce quando o cliente paga a mais e quem confirma o pagamento escolhe "Crédito do cliente". Ele é usado em "Outros", ao criar o pedido, ou no botão "Usar crédito" da parcela em aberto (entra pago e conferido). Desfazer ou excluir esse pagamento devolve o valor ao crédito. Se o dinheiro for devolvido ao cliente, ou para corrigir um erro, use "Ajustar o saldo" no histórico do cliente: o motivo fica registrado.</p>', false, 'leve')}
      ${!r.clientes.length ? '<div class="vazio">Nenhum cliente com crédito.</div>' : `
      <div class="tabela-wrap"><table>
        <thead><tr><th>Cliente</th><th>Último movimento</th><th class="dir">Saldo</th><th></th></tr></thead>
        <tbody>${r.clientes.map(c => `<tr>
          <td>${esc(c.nome)}</td>
          <td class="num">${esc(dataHora(c.ultimo))}</td>
          <td class="dir num"><b>${brl(c.saldo)}</b></td>
          <td class="dir"><button class="btn link peq" data-cred="${esc(c.cliente_id)}">Ver histórico</button></td>
        </tr>`).join('')}</tbody></table></div>`}
      ${rodapeLista('cred', r.clientes.length, r.total, 'cliente(s)', `Saldo total: ${brl(r.saldo_total)}`)}
    </div>`;
  ligarMais(el, 'cred', recarregar);
  const filtrar = () => { zerarLista('cred'); recarregar(); };
  let t; $('#cred-busca').oninput = e => { g.busca = e.target.value; clearTimeout(t); t = setTimeout(filtrar, 450); };
  $('#cred-todos').onchange = e => { g.todos = e.target.checked; filtrar(); };
  $$('[data-cred]').forEach(b => b.onclick = () => historicoCredito(b.dataset.cred, (r.clientes.find(c => c.cliente_id === b.dataset.cred) || {}).nome));
}
async function historicoCredito(cliente_id, nome) {
  const r = await api('listar_creditos_clientes', { cliente_id, todos: true, limite: 1 });
  const h = r.historico || [];
  const m = abrirModal({ titulo: 'Crédito de ' + (nome || 'cliente'), largo: true, corpo: `
    <p style="margin:0 0 12px">Saldo: <b>${brl(r.saldo_cliente)}</b></p>
    ${!h.length ? '<div class="vazio">Sem movimentos.</div>' : `<div class="tabela-wrap"><table>
      <thead><tr><th>Data</th><th>O quê</th><th>Pedido</th><th>Por</th><th class="dir">Valor</th></tr></thead>
      <tbody>${h.map(x => `<tr>
        <td class="num">${esc(dataHora(x.criado_em))}</td>
        <td>${esc(TIPOS_CRED[x.tipo] || x.tipo)}${x.observacao ? `<div class="small muted">${esc(x.observacao)}</div>` : ''}</td>
        <td>${x.pedido_id ? `<a href="#/pedido/${esc(x.pedido_id)}">#${esc(x.pedido_numero)}</a>` : '—'}</td>
        <td>${esc(x.usuario || 'Sistema')}</td>
        <td class="dir num" style="color:var(${Number(x.valor) >= 0 ? '--verde' : '--vermelho'})">${Number(x.valor) < 0 ? '− ' : '+ '}${brl(Math.abs(Number(x.valor)))}</td>
      </tr>`).join('')}</tbody></table></div>`}
    ${blocoExp('cred-ajuste', 'Ajustar o saldo', `
      <div class="linha-form" style="flex-wrap:wrap">
        <label class="campo" style="max-width:190px">O que fazer<select id="aj-sinal"><option value="-1">Tirar do saldo</option><option value="1">Acrescentar ao saldo</option></select></label>
        <label class="campo" style="max-width:150px">Valor (R$)<input type="number" step="0.01" min="0.01" id="aj-valor"></label>
        <label class="campo" style="flex:2">Motivo *<input type="text" id="aj-motivo" maxlength="400" placeholder="Ex.: devolvido ao cliente por Pix em 27/11"></label>
      </div>
      <button class="btn peq" id="aj-salvar">Salvar ajuste</button>`, false, 'leve')}`,
    rodape: '<button class="btn" data-v>Fechar</button>' });
  m.el.querySelector('[data-v]').onclick = m.fechar;
  $('#aj-salvar', m.el).onclick = async e => {
    const v = Math.round(Number($('#aj-valor', m.el).value) * 100) / 100, motivo = $('#aj-motivo', m.el).value.trim();
    if (!(v > 0)) return toast('Informe o valor do ajuste.', true);
    if (!motivo) return toast('Informe o motivo do ajuste.', true);
    let x; try { x = await ocupado(e.currentTarget, () => api('ajustar_credito_cliente', { cliente_id, valor: (v * Number($('#aj-sinal', m.el).value)).toFixed(2), motivo })); }
    catch { return; }
    m.fechar(); toast(`Ajuste salvo. Saldo: ${brl(x.saldo)}.`); recarregar();
  };
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
/* ---------- Boleto emitido pelo sistema no Inter (Módulo 6, Fase 4A) ----------
   O banco confere permissão (vendedor do pedido ou financeiro), parcela e cadastro do cliente;
   o [GVH] Inter emite, guarda o PDF na pasta Financeiro do pedido e registra. */
function htmlBoleto(r) {
  if (!r.boleto_id) return '';
  const s = r.boleto_situacao;
  if (s === 'emitindo') return `<div>${badge('Boleto sendo emitido…', 'b-ambar')}</div>`;
  if (s === 'falhou' && r.situacao === 'aberto') return `<div class="small" style="color:var(--vermelho)">Boleto não emitido: ${esc(r.boleto_erro || 'o Inter recusou')}</div>`;
  if (s === 'cancelado' && r.situacao === 'aberto') return `<div class="small muted">Boleto cancelado${r.boleto_cancelado_no_inter_em ? '' : ' · cancelando no Inter…'}</div>`;
  if (s !== 'ativo' && s !== 'pago') return '';
  const pdf = urlSegura(r.boleto_pdf_url);
  return `<div class="small">${s === 'pago' ? 'Boleto pago' : 'Boleto vence ' + esc(data(r.boleto_vencimento))}
    ${pdf ? ` · <a href="${esc(pdf)}" target="_blank" rel="noopener">Ver PDF</a>` : (s === 'ativo' ? ' · <span class="muted">PDF chegando…</span>' : '')}
    ${s === 'ativo' && r.boleto_linha ? `<button class="btn link peq" onclick="copiarBoleto('${r.id}', 'linha')">Copiar linha</button>` : ''}
    ${s === 'ativo' && r.boleto_pix ? `<button class="btn link peq" onclick="copiarBoleto('${r.id}', 'pix')">Copiar Pix</button>` : ''}</div>`;
}
function botoesBoleto(r) {
  if (r.boleto_situacao === 'ativo' || r.boleto_situacao === 'emitindo')
    return `<button class="btn link peq" onclick="cancelarBoleto('${r.id}')" title="Cancela o boleto no Inter; o cliente não consegue mais pagar">Cancelar boleto</button>`;
  return `<button class="btn peq" onclick="emitirBoleto('${r.id}')">Emitir boleto</button>`;
}
async function copiarBoleto(id, qual) {
  const r = S.parcelas[id] || {};
  const t = qual === 'pix' ? r.boleto_pix : r.boleto_linha;
  if (t && await copiarTexto(t)) toast(qual === 'pix' ? 'Pix copia e cola copiado.' : 'Linha digitável copiada.');
}
function emitirBoleto(id) {
  const r = S.parcelas[id]; if (!r) return;
  const venc = r.vencimento && r.vencimento >= hoje() ? r.vencimento : hoje();
  const m = abrirModal({ titulo: 'Emitir boleto no Inter', corpo: `
    <p class="small" style="margin:0 0 10px">Boleto de <b>${brl(r.valor)}</b>${r.parcela_num ? ` (parcela ${esc(r.parcela_num)}${r.parcelas_total ? '/' + esc(r.parcelas_total) : ''})` : ''}
      no nome do cliente do pedido, com o número do pedido. Sai com código de barras e Pix, multa e juros por atraso.</p>
    <label class="campo" style="max-width:220px">Vencimento<input type="date" data-venc value="${esc(venc)}" min="${esc(hoje())}"></label>
    <p class="small muted" style="margin:8px 0 0">O PDF fica na pasta Financeiro do pedido. Se o pagamento mudar (valor, vencimento, forma) ou for excluído, o boleto é cancelado no Inter sozinho.</p>`,
    rodape: `<button class="btn" data-v>Voltar</button><button class="btn prim" data-s>Emitir boleto</button>` });
  m.el.querySelector('[data-v]').onclick = m.fechar;
  m.el.querySelector('[data-s]').onclick = async () => {
    const vencimento = m.el.querySelector('[data-venc]').value;
    if (!vencimento) return toast('Escolha o vencimento.', true);
    let res;
    try { res = await aguarde('Emitindo o boleto no Inter… (leva alguns segundos)', () => api('inter_boleto_emitir', { id, vencimento })); }
    catch { recarregar(); return; }
    m.fechar(); recarregar();
    mostrarBoletoEmitido(res);
  };
}
function mostrarBoletoEmitido(res) {
  if (!res.linha) return toast('Boleto emitido. A linha digitável e o PDF aparecem no pagamento em alguns minutos.');
  const m = abrirModal({ titulo: 'Boleto emitido', corpo: `
    <p class="small" style="margin:0 0 10px">Mande ao cliente o PDF (fica na pasta Financeiro do pedido${res.pdf ? '' : '; chega em alguns minutos'}) ou a linha digitável. Quando ele pagar, a baixa é feita pelo extrato do Inter.</p>
    <label class="campo">Linha digitável<input type="text" readonly value="${esc(res.linha)}" data-lin style="width:100%"></label>
    ${res.pix ? `<label class="campo" style="margin-top:8px">Pix copia e cola<input type="text" readonly value="${esc(res.pix)}" data-pix style="width:100%"></label>` : ''}`,
    rodape: `<button class="btn" data-v>Fechar</button>${res.pix ? '<button class="btn" data-cp>Copiar Pix</button>' : ''}<button class="btn prim" data-cl>Copiar linha</button>` });
  m.el.querySelector('[data-v]').onclick = m.fechar;
  m.el.querySelectorAll('input[readonly]').forEach(i => i.onfocus = e => e.target.select());
  m.el.querySelector('[data-cl]').onclick = async () => { if (await copiarTexto(res.linha)) toast('Linha digitável copiada.'); };
  const cp = m.el.querySelector('[data-cp]'); if (cp) cp.onclick = async () => { if (await copiarTexto(res.pix)) toast('Pix copia e cola copiado.'); };
}
async function cancelarBoleto(id) {
  if (!await confirmar('Cancelar este boleto? Ele é cancelado no Inter em até 30 minutos e o cliente não consegue mais pagar. O pagamento continua em aberto.', 'Cancelar boleto', true)) return;
  try { await api('inter_boleto_cancelar', { id }); } catch { return; }
  toast('Boleto cancelado. Ele sai do Inter em até 30 minutos.'); recarregar();
}

async function pagarComissao(id, desfazer = false) {
  if (!await confirmar(desfazer ? 'Desfazer o registro deste repasse?' : 'Confirmar que o repasse desta comissão foi feito hoje?', desfazer ? 'Desfazer' : 'Confirmar repasse')) return;
  await api('pagar_comissao', { id, desfazer }); toast(desfazer ? 'Registro desfeito.' : 'Repasse registrado.'); recarregar();
}

