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
  const r = await api('listar_conciliacao', { ...f, limite: limLista('conc') });
  const lista = r.recebimentos; lista.forEach(x => S.parcelas[x.id] = x);
  const pend = f.filtro === 'pendentes';
  const abas = [['pendentes', `A conferir (${r.pendentes})`], ['devolvidos', 'Devolvidos · 30 dias'], ['conferidos', 'Conferidos · 30 dias']];
  el.innerHTML = `
    <div class="painel filtros">
      <div class="chips" style="margin-bottom:12px">${abas.map(([k, n]) => `<button class="chip ${f.filtro === k ? 'ativo' : ''}" data-f="${k}">${n}</button>`).join('')}</div>
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
  $$('[data-f]').forEach(b => b.onclick = () => { f.filtro = b.dataset.f; zerarLista('conc'); recarregar(); });
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

