/* ---------- INÍCIO ---------- */
rota('inicio', async (_p, el) => {
  definirTopoEm(el, `Olá, ${S.usuario.nome.split(' ')[0]}`, `<button class="btn" onclick="recarregar()">Atualizar</button>`);
  const r = await api('resumo');
  const ps = r.por_status || {};
  const qtd = k => k === 'saida' ? (ps.em_transporte || 0) + (ps.aguardando_retirada || 0) : (ps[k] || 0);
  const fin = r.financeiro;
  el.innerHTML = `
    <div class="painel-cab"><h2>Pedidos em andamento, por etapa</h2><a href="#/pedidos">Ver todos</a></div>
    <div class="etapas">${ETAPAS.map(([k, n]) => `
      <button class="${qtd(k) ? 'tem' : ''}" onclick="irPedidos('${k}')"><span class="n num">${qtd(k)}</span><span class="t">${esc(n)}</span></button>`).join('')}
    </div>
    ${(r.artes_pausadas || []).map(x => `<a class="alerta erro" href="#/pedido/${x.pedido_id}" style="display:block;margin-top:16px;text-decoration:none"><b>Arte pausada · pedido ${esc(x.pedido_numero)}</b> · ${esc(x.item || '')} — ${esc(x.texto || 'o cliente pediu alteração no material')}. Ajuste o pedido e devolva para a designer.</a>`).join('')}
    ${(r.orcamentos_aceitos || []).map(o => `<a class="alerta" href="#/orcamento/${o.id}" style="display:block;margin-top:16px;text-decoration:none;color:var(--grafite);background:var(--verde-bg)"><b>Orçamento ${esc(o.numero)} aprovado pelo cliente</b> · ${esc(o.cliente || '')} — aprovado por ${esc(o.aprovado_por || '')} em ${dataHoraLonga(o.aprovado_em)}${o.vendedor ? ` · vendedor ${esc(o.vendedor)}` : ''}. ${o.cadastro_pendente ? 'O cliente enviou o cadastro: confira o cadastro e depois transforme em pedido.' : 'Abra para transformar em pedido.'}</a>`).join('')}
    ${(r.pendencias_producao || []).map(x => `<a class="alerta" href="#/pedido/${x.pedido_id}" style="display:block;margin-top:16px;text-decoration:none;color:inherit"><b>${x.tipo === 'cancelamento' ? 'Pedido de cancelamento de item' : 'Troca de arte para confirmar'}</b> · pedido ${esc(x.pedido_numero)} · ${esc(x.item || '')} — pedido por ${esc(x.quem || '')}. Abra o pedido para confirmar ou recusar.</a>`).join('')}
    ${r.cadastros_link ? `<a class="alerta" href="#/clientes" style="display:block;margin-top:16px;text-decoration:none;color:inherit"><b>Cadastros pelo link:</b> ${r.cadastros_link} ${r.cadastros_link > 1 ? 'clientes enviaram' : 'cliente enviou'} o cadastro e ${r.cadastros_link > 1 ? 'aguardam' : 'aguarda'} conferência em Clientes.</a>` : ''}
    ${fin && fin.a_conferir && pode('edita_financeiro') ? `<a class="alerta" href="#/conciliacao" style="display:block;margin-top:16px;text-decoration:none;color:inherit"><b>Conciliação:</b> ${fin.a_conferir} ${fin.a_conferir > 1 ? 'pagamentos marcados como pagos aguardam' : 'pagamento marcado como pago aguarda'} conferência.</a>` : ''}
    ${r.acabamento_chegou && veFornecedor() ? `<a class="alerta" href="#/producao" onclick="S.cache.abaProd='em_producao'" style="display:block;margin-top:16px;text-decoration:none;color:inherit"><b>Chegou para acabamento:</b> ${r.acabamento_chegou} ${r.acabamento_chegou > 1 ? 'itens voltaram' : 'item voltou'} para a produção. Veja em Pré-impressão e produção.</a>` : ''}
    <div class="grade g4" style="margin-top:16px">
      <div class="cartao-num ${r.producao_atrasada ? 'alerta-num' : ''}"><span class="n num">${r.producao_atrasada}</span><span class="muted small">Itens com previsão de produção vencida</span></div>
      <div class="cartao-num"><span class="n num">${r.itens_em_pre_impressao}</span><span class="muted small">Itens aguardando pré-impressão</span></div>
      <div class="cartao-num ${r.parados_3_dias ? 'alerta-num' : ''}"><span class="n num">${r.parados_3_dias}</span><span class="muted small">Pedidos parados há 3 dias ou mais</span></div>
      ${fin ? `<div class="cartao-num"><span class="n num">${brl(fin.recebido_hoje)}</span><span class="muted small">Recebido hoje</span></div>` : ''}
    </div>
    ${fin ? `<div class="grade g2" style="margin-top:16px">
      <a class="cartao-num" href="#/financeiro/hoje" style="text-decoration:none;color:inherit"><span class="n num">${fin.vence_hoje}</span><span class="muted small">Parcelas vencendo hoje</span></a>
      <a class="cartao-num ${fin.atrasados ? 'alerta-num' : ''}" href="#/financeiro/atrasados" style="text-decoration:none;color:inherit"><span class="n num">${fin.atrasados} · ${brl(fin.valor_atrasado)}</span><span class="muted small">Parcelas em atraso</span></a>
    </div>` : ''}`;
});
function irPedidos(etapa) { zerarLista('pedidos'); S.cache.filtroPedidos = { ...(S.cache.filtroPedidos || {}), etapa }; const v = VISTAS.get('pedidos'); if (v) v.sujo = true; location.hash = '#/pedidos'; }

/* ---------- LISTA DE PEDIDOS ---------- */
rota('pedidos', async (_p, el) => {
  definirTopoEm(el, 'Pedidos', `${pode('cria_pedidos') ? '<a class="btn prim" href="#/novo">Novo pedido</a>' : ''}<button class="btn" onclick="recarregar()">Atualizar</button>`);
  const f = S.cache.filtroPedidos || (S.cache.filtroPedidos = { etapa: '', busca: '', fin: '', vendedor: '', finalizados: false });
  el.innerHTML = `
    <div class="painel filtros">
      <div class="linha-form">
        <label class="campo" style="flex:2">Buscar<input type="search" id="f-busca" placeholder="Número do pedido ou cliente (procura também nos concluídos)" value="${esc(f.busca)}"></label>
        ${pode('ve_financeiro') ? `<label class="campo">Financeiro<select id="f-fin"><option value="">Todos</option>
          ${[['aguardando_pagamento','Aguardando pagamento'],['sinal_pago','Sinal pago'],['boleto','Boleto'],['atrasado','Pagamento atrasado'],['pago','Pago']]
            .map(([v,n]) => `<option value="${v}" ${f.fin === v ? 'selected' : ''}>${n}</option>`).join('')}</select></label>` : ''}
        <label class="campo">Vendedor<select id="f-vend"><option value="">Todos</option>
          ${S.base.vendedores.map(v => `<option value="${v.id}" ${f.vendedor === v.id ? 'selected' : ''}>${esc(v.nome)}</option>`).join('')}</select></label>
        <label class="check" style="flex:0;min-width:auto;padding-bottom:9px"><input type="checkbox" id="f-final" ${f.finalizados ? 'checked' : ''}> Mostrar concluídos e cancelados</label>
        ${podeStatus('cancelado') ? `<label class="check" style="flex:0;min-width:auto;padding-bottom:9px"><input type="checkbox" id="f-excl" ${f.excluidos ? 'checked' : ''}> Só excluídos</label>` : ''}
      </div>
      <div class="chips" style="margin-top:14px" id="f-etapas">
        <button class="chip ${!f.etapa ? 'ativo' : ''}" data-e="">Todas as etapas</button>
        ${ETAPAS.map(([k, n]) => `<button class="chip ${f.etapa === k ? 'ativo' : ''}" data-e="${k}">${esc(n)}</button>`).join('')}
      </div>
    </div>
    <div class="painel"><div id="lista-pedidos"><div class="vazio">Carregando…</div></div></div>`;

  let t;
  const buscar = async () => {
    const dados = { busca: f.busca, incluir_finalizados: f.finalizados || f.excluidos, excluidos: !!f.excluidos, limite: limLista('pedidos') };
    if (f.etapa) dados.status = f.etapa === 'saida' ? ['em_transporte','aguardando_retirada'] : [f.etapa];
    if (f.fin) dados.status_financeiro = f.fin;
    if (f.vendedor) dados.vendedor_id = f.vendedor;
    const r = await api('listar_pedidos', dados);
    desenharListaPedidos(r.pedidos, r.total);
    ligarMais($('#lista-pedidos'), 'pedidos', buscar);
  };
  const filtrar = () => { zerarLista('pedidos'); buscar(); };
  $('#f-busca').oninput = e => { f.busca = e.target.value; clearTimeout(t); t = setTimeout(filtrar, 350); };
  if ($('#f-fin')) $('#f-fin').onchange = e => { f.fin = e.target.value; filtrar(); };
  $('#f-vend').onchange = e => { f.vendedor = e.target.value; filtrar(); };
  $('#f-final').onchange = e => { f.finalizados = e.target.checked; filtrar(); };
  if ($('#f-excl')) $('#f-excl').onchange = e => { f.excluidos = e.target.checked; filtrar(); };
  $$('#f-etapas .chip').forEach(b => b.onclick = () => {
    f.etapa = b.dataset.e; $$('#f-etapas .chip').forEach(x => x.classList.toggle('ativo', x === b)); filtrar();
  });
  await buscar();
});

function desenharListaPedidos(lista, total = lista.length) {
  const el = $('#lista-pedidos');
  if (!lista.length) { el.innerHTML = `<div class="vazio">Nenhum pedido encontrado com esses filtros.${pode('cria_pedidos') ? ' <a href="#/novo">Lançar um pedido</a>' : ''}</div>`; return; }
  el.innerHTML = `<div class="tabela-wrap"><table>
    <thead><tr><th>Pedido</th><th>Cliente</th><th style="min-width:200px">Andamento</th><th>Status</th>
      ${pode('ve_financeiro') ? '<th>Financeiro</th>' : ''}${pode('ve_valores') ? '<th class="dir">Total</th>' : ''}<th>Parado há</th></tr></thead>
    <tbody>${lista.map(p => `
      <tr class="clicavel" onclick="location.hash='#/pedido/${p.id}'">
        <td><b>${esc(p.numero)}</b><div class="small muted">${data(p.created_at)} · ${esc(p.vendedor_nome)}</div></td>
        <td>${esc(p.cliente_fantasia || p.cliente_nome)}<div class="small muted">${p.itens_ativos} ${p.itens_ativos == 1 ? 'item' : 'itens'} · ${p.forma_entrega === 'entrega' ? 'Entrega' : 'Retirada'}</div></td>
        <td style="padding-top:22px">${trilho(p)}</td>
        <td>${badgePed(p.status, p.status_nome)}${(p.itens || []).some(i => i.status === 'arte_aprovada') ? ' ' + badge('Arquivo pronto', 'b-verde') : ''}${(p.itens || []).some(i => i.status === 'arte_pausada') ? ' ' + badge('Arte pausada', 'b-vermelho') : ''}${p.itens_adiantados > 0 && !['concluido','cancelado','entregue'].includes(p.status) ? `<div class="small muted" style="margin-top:4px">${p.itens_adiantados} de ${p.itens_ativos} já adiante</div>` : ''}</td>
        ${pode('ve_financeiro') ? `<td>${badgeFin(p.status_financeiro, p.status_financeiro_nome)}</td>` : ''}
        ${pode('ve_valores') ? `<td class="dir num">${brl(p.valor_total)}</td>` : ''}
        <td class="num ${p.dias_no_status >= 3 && !['concluido','cancelado'].includes(p.status) ? '' : 'muted'}" style="${p.dias_no_status >= 3 && !['concluido','cancelado'].includes(p.status) ? 'color:var(--vermelho);font-weight:500' : ''}">${p.dias_no_status} ${p.dias_no_status == 1 ? 'dia' : 'dias'}</td>
      </tr>`).join('')}</tbody></table></div>
    ${rodapeLista('pedidos', lista.length, total, total > 1 ? 'pedidos' : 'pedido', 'Os números acima do trilho mostram quantos itens estão em cada etapa.')}`;
}

/* ---------- DETALHE DO PEDIDO ---------- */
rota('pedido', async (id, el) => {
  const r = await api('obter_pedido', { id });
  const p = r.pedido; vistaDoEl(el).dados = p;
  const cancelado = p.status === 'cancelado';
  const excluido = !!p.excluido_em;
  definirTopoEm(el, `Pedido ${p.numero}${excluido ? ' (excluído)' : ''}`, `
    <a class="btn" href="#/pedidos">Voltar</a>
    ${!excluido ? `<button class="btn" onclick="imprimirResumoPedido()">Imprimir resumo</button>` : ''}
    ${pode('cria_pedidos') ? `<button class="btn" onclick="repetirPedido()">Repetir pedido</button>` : ''}
    ${pode('cria_pedidos') && !cancelado ? `<button class="btn" onclick="modalEditarPedido()">Editar dados</button>` : ''}
    ${!pode('cria_pedidos') && pode('edita_financeiro') && !cancelado && !saiuParaEntrega(p) ? `<button class="btn" onclick="modalAlterarEntrega()">Alterar entrega</button>` : ''}
    ${podeStatus('cancelado') && !excluido ? (cancelado
        ? `${p.cancelado_em ? `<button class="btn" onclick="reativarPedido()">Reativar pedido</button><button class="btn perigo" onclick="cancelarPedido(true)">Excluir pedido</button>` : ''}`
        : `<button class="btn perigo" onclick="cancelarPedido()">Cancelar pedido</button>`) : ''}
    <button class="btn" onclick="recarregar()">Atualizar</button>`);

  const cli = p.cliente || {};
  const podeMover = S.perm.status_item_permitidos || [];
  el.innerHTML = `
    <div class="painel">
      <div class="painel-cab" style="margin-bottom:18px">
        <div>
          <h2 style="font-size:20px">${esc(cli.nome_fantasia || cli.nome)}</h2>
          <div class="muted small">${esc(cli.nome_fantasia ? cli.nome : '')} ${cli.cpf_cnpj ? '· ' + esc(fmtDoc(cli.cpf_cnpj)) : ''} ${cli.whatsapp ? '· WhatsApp ' + esc(fmtTel(cli.whatsapp)) : cli.telefone ? '· ' + esc(fmtTel(cli.telefone)) : ''} ${cli.revenda ? badge('Revenda', 'b-azul') : ''}</div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">${badgePed(p.status, p.status_nome)} ${badgeFin(p.status_financeiro, p.status_financeiro_nome)}</div>
      </div>
      ${cli.observacoes ? `<div class="alerta" style="margin-bottom:14px"><b>Observação do cliente:</b> ${esc(cli.observacoes)}</div>` : ''}
      ${excluido ? `<div class="alerta erro" style="margin-bottom:8px"><b>Pedido excluído</b> em ${dataHora(p.excluido_em)}${p.excluido_por_nome ? ' por ' + esc(p.excluido_por_nome) : ''}. Motivo: ${esc(p.motivo_exclusao || '—')}. Ele não aparece mais nas listas; o histórico e os registros financeiros ficam guardados.</div>` : ''}
      ${cancelado ? `<div class="alerta erro" style="margin-bottom:14px">${p.cancelado_em ? `Cancelado em ${dataHora(p.cancelado_em)}. Motivo: ${esc(p.motivo_cancelamento || '—')}. Todos os itens foram parados.` : 'Todos os itens deste pedido foram cancelados.'}</div>` : trilhoGrande(p)}
      <div class="grade g4" style="margin-top:18px">
        <div><div class="small muted">Vendedor</div>${esc(p.vendedor_nome)}</div>
        <div><div class="small muted">Entrega</div>${p.forma_entrega === 'entrega' ? 'Entregar no cliente' : 'Cliente retira no balcão'}${p.endereco_entrega ? `<div class="small muted">${esc(p.endereco_entrega)}</div>` : ''}</div>
        <div><div class="small muted">Previsão para o cliente</div>${data(p.data_prevista_entrega)}
          <div class="small muted">Entrega leva ${p.dias_entrega_efetivo ?? '—'} ${Number(p.dias_entrega_efetivo) === 1 ? 'dia útil' : 'dias úteis'}${p.dias_entrega == null ? ' (padrão)' : ''}
            ${p.pode_urgencia && !cancelado ? `<button class="btn link peq" onclick="modalDiasEntrega()">alterar</button>` : ''}</div></div>
        <div><div class="small muted">Criado em</div>${dataHora(p.created_at)}</div>
      </div>
      ${p.forma_pagamento || p.condicoes_pagamento ? `<div style="margin-top:12px"><span class="small muted">Forma de pagamento:</span> ${esc(FORMAS_COMB[p.forma_pagamento] || '')}${p.condicoes_pagamento && p.condicoes_pagamento !== FORMAS_COMB[p.forma_pagamento] ? `${p.forma_pagamento ? ' · ' : ''}${esc(p.condicoes_pagamento)}` : ''}</div>` : ''}
      ${p.observacoes ? `<div style="margin-top:6px"><span class="small muted">Observações da entrega:</span> ${esc(p.observacoes)}</div>` : ''}
      ${p.observacao_geral ? `<div style="margin-top:6px"><span class="small muted">Observação geral (cliente):</span> ${esc(p.observacao_geral)}</div>` : ''}
    </div>

    <div class="painel">
      <div class="painel-cab"><h2>Itens</h2>
        ${pode('cria_pedidos') && !cancelado ? `<button class="btn" onclick="modalItem(null)">Adicionar item</button>` : ''}</div>
      ${(() => { const pr = p.itens.filter(i => i.status === 'arte_aprovada'); if (!pr.length || cancelado || !podeStatus('pre_impressao')) return '';
        return `<div class="alerta" style="background:var(--verde-bg);color:var(--grafite);margin-bottom:12px;display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:center">
          <span><b>Arquivo pronto para impressão</b> em ${pr.length === 1 ? esc(pr[0].descricao) : pr.length + ' itens'}. Confira e envie para a pré-impressão.</span>
          <button class="btn prim peq" onclick="enviarPreImpressao('${pr.map(i => i.id).join(',')}')">${pr.length > 1 ? `Enviar os ${pr.length} para pré-impressão` : 'Enviar para pré-impressão'}</button></div>`; })()}

      <div class="tabela-wrap"><table>
        <thead><tr><th style="width:28px"><input type="checkbox" id="sel-todos" aria-label="Selecionar todos"></th>
          <th>Item</th><th>Status</th><th>Produção</th><th>Arte</th>
          ${pode('ve_valores') ? '<th class="dir">Valor</th>' : ''}${pode('ve_custo') ? '<th class="dir">Custo</th>' : ''}<th></th></tr></thead>
        <tbody>${p.itens.map(i => `
          <tr>
            <td><input type="checkbox" class="sel-item" value="${i.id}" ${i.status === 'cancelado' ? 'disabled' : ''} aria-label="Selecionar item"></td>
            <td><b>${esc(i.descricao)}</b><div class="small muted">${num(i.quantidade)} un${i.especificacao ? ' · ' + esc(i.especificacao) : ''}${i.categoria_nome ? ' · <span title="' + esc(i.categoria_nome) + '">' + esc(catCurta(i.categoria_nome)) + '</span>' : ''}</div>
                ${i.observacao ? `<div class="small" style="margin-top:4px"><span class="muted">Obs. interna:</span> ${esc(i.observacao)}</div>` : ''}${infoAcabamento(i)}
                ${i.status === 'cancelado' && i.cancel_motivo ? `<div class="small" style="margin-top:4px;color:var(--vermelho)">Cancelado: ${esc(i.cancel_motivo)}</div>` : ''}
                ${i.cancel_solicitado_em && i.status !== 'cancelado' ? `<div class="alerta small" style="margin-top:6px;padding:6px 10px"><b>Pedido de cancelamento</b> por ${esc(i.cancel_solicitado_por_nome || '')}: ${esc(i.cancel_motivo || '')}
                  ${p.confirma_producao ? `<div style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap"><button class="btn peq perigo" onclick="decidirCancelItem('${i.id}',true)">Confirmar cancelamento</button><button class="btn peq" onclick="decidirCancelItem('${i.id}',false)">Recusar</button></div>` : '<div class="muted">Aguardando a confirmação da pré-impressão.</div>'}</div>` : ''}
                ${i.troca_arte_pendente ? `<div style="margin-top:4px">${badge('Troca de arte aguardando a pré-impressão', 'b-ambar')}</div>` : ''}</td>
            <td>${badgeItem(i.status)}<div class="small muted" style="margin-top:4px">há ${i.dias_no_status} ${i.dias_no_status == 1 ? 'dia' : 'dias'}</div>
                ${i.urgencia && i.urgencia.conferencia && i.status !== 'cancelado' ? `<div style="margin-top:4px">${seloConferencia(i.urgencia.conferencia, i.status)}</div>` : ''}
                ${i.urgencia && i.status !== 'cancelado' && ordemStatus(i.status) < 8 ? `<div style="margin-top:4px">${badgeUrgencia(i.urgencia)}
                  ${p.pode_urgencia && !cancelado ? `<button class="btn link peq" onclick="modalUrgenciaItem('${i.id}')">${urgenteProducao(i.urgencia) ? 'Urgência' : 'Subir urgência'}</button>
                  <button class="btn link peq" onclick="modalDigitalItem('${i.id}')">Digital</button>` : ''}</div>` : ''}</td>
            <td class="small">${veFornecedor() ? (i.fornecedor_nome ? esc(i.fornecedor_nome) : '<span class="muted">Sem fornecedor</span>') : ''}
                ${i.codigo_producao ? `<div>Cód. fornecedor ${esc(i.codigo_producao)}</div>` : ''}
                ${i.prazo_producao ? `<div style="${i.producao_atrasada ? 'color:var(--vermelho);font-weight:500' : ''}">Prev. produção ${data(i.prazo_producao)}</div>` : ''}</td>
            <td class="small">${i.arte_url ? `<a href="${esc(i.arte_url)}" target="_blank" rel="noopener">Prova</a><br>` : ''}
                ${i.arte_drive_url ? `<a href="${esc(i.arte_drive_url)}" target="_blank" rel="noopener">Drive</a><br>` : ''}
                ${!i.arte_url && !i.arte_drive_url ? '<span class="muted">—</span>' : ''}</td>
            ${pode('ve_valores') ? `<td class="dir num">${brl(i.valor_total)}<div class="small muted">${unitario(i.valor_total, i.quantidade)} un</div></td>` : ''}
            ${pode('ve_custo') ? `<td class="dir num">${i.custo != null ? brl(i.custo) : '<span class="muted">—</span>'}</td>` : ''}
            <td class="dir" style="white-space:nowrap">${i.status !== 'cancelado' ? `<button class="btn peq" onclick="modalItem('${i.id}')">Editar</button>` : ''}
              ${podeCancelarItem(p, i) ? `<button class="btn peq perigo" onclick="modalCancelarItem('${i.id}')">Cancelar item</button>` : ''}
              ${i.status === 'cancelado' && p.status !== 'cancelado' && (pode('cria_pedidos') || p.confirma_producao) ? `<button class="btn peq" onclick="excluirItemCancelado('${i.id}')">Excluir</button>` : ''}</td>
          </tr>`).join('')}</tbody></table></div>
      ${!cancelado && podeMover.length ? `
      <div class="barra-acao">
        <span id="sel-cont">Nenhum item selecionado</span>
        <select id="novo-status" aria-label="Novo status"><option value="">Mover para…</option>
          ${podeMover.filter(s => s !== 'cancelado').map(s => `<option value="${s}">${esc(nomeStatusItem(s))}</option>`).join('')}
        </select>
        <button class="btn prim" onclick="moverSelecionados()">Mover itens</button>
      </div>` : ''}
      ${pode('ve_valores') ? `<div class="totais">
        <span class="muted">Itens ${brl(p.valor_itens)}${Number(p.desconto) ? ` · ${rotDesconto(p)} ${brl(p.desconto)}` : ''}${Number(p.desconto_pix_valor) ? ` · Pix à vista (${PIX_PCT}%) ${brl(p.desconto_pix_valor)}` : ''}${Number(p.frete) ? ` · Frete ${brl(p.frete)}` : ''}</span>
        <b class="num">${brl(p.valor_total)}</b>
        ${pode('ve_custo') && p.custo_total != null ? `<span class="small muted">Custo ${brl(p.custo_total)} · Margem ${brl(p.valor_total - p.custo_total)}${p.valor_total > 0 ? ` (${Math.round((p.valor_total - p.custo_total) / p.valor_total * 100)}%)` : ''}</span>` : ''}
      </div>` : ''}
    </div>

    <div class="painel" data-artes-pedido><div class="painel-cab"><h2>Artes</h2></div><p class="small muted" style="margin:0">Carregando artes…</p></div>

    <div class="painel" id="arquivos-pedido"><div class="painel-cab"><h2>Arquivos de arte</h2></div><p class="small muted" style="margin:0">Carregando arquivos…</p></div>

    ${pode('ve_financeiro') ? `
    <div class="painel">
      <div class="painel-cab"><h2>Financeiro</h2>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
        ${(pode('edita_financeiro') || pode('cria_pedidos')) && !cancelado && !(p.recebimentos || []).some(r => r.situacao === 'pago') ? `<button class="btn" onclick="modalTrocarForma()">Trocar forma de pagamento</button>` : ''}
        ${(pode('edita_financeiro') || pode('cria_pedidos')) && !cancelado && (p.recebimentos || []).filter(r => r.situacao !== 'cancelado').reduce((s, r) => s + Number(r.valor), 0) < Number(p.valor_total) - 0.009 ? `<button class="btn" onclick="modalParcelas()">Lançar pagamento da diferença</button>` : ''}</div></div>
      ${alertaPagamentoPedido(p, cancelado)}
      <div class="grade g3" style="margin-bottom:14px">
        <div><div class="small muted">Total do pedido</div><b class="num">${brl(p.valor_total)}</b></div>
        <div><div class="small muted">Recebido</div><b class="num" style="color:var(--verde)">${brl(p.valor_pago)}</b></div>
        <div><div class="small muted">Em aberto</div><b class="num">${brl(p.valor_em_aberto)}</b></div>
      </div>
      ${tabelaParcelas(p.recebimentos || [], false)}
      <div id="docs-financeiro"></div>
    </div>` : ''}

    <div class="grade g2" style="margin-top:16px">
      <div class="painel" style="margin:0">
        <div class="painel-cab"><h2>Observações</h2></div>
        <form id="form-obs" class="linha-form" style="margin-bottom:14px">
          <input type="text" name="texto" placeholder="Escreva uma observação para a equipe" required style="flex:3">
          <button class="btn" style="flex:0">Adicionar</button>
        </form>
        <div class="tempo">${listaComMais('obs-' + p.id, (p.observacoes_lista || []).map(o => `<div class="obs">${esc(o.texto)}<small>${esc(o.usuario_nome || '')} · ${dataHora(o.created_at)}</small></div>`), 3, 'observações') || '<span class="muted small">Nenhuma observação.</span>'}</div>
      </div>
      <div class="painel" style="margin:0">
        <div class="painel-cab"><h2>Histórico</h2></div>
        <div class="tempo">${listaComMais('hist-' + p.id, (p.historico || []).map(h => `<div>${descHistorico(h)}<small>${esc(h.usuario_nome || 'Automático')} · ${dataHora(h.created_at)}</small></div>`), 5, 'registros')}</div>
      </div>
    </div>`;

  const atualizarSel = () => { const n = $$('.sel-item:checked').length; if ($('#sel-cont')) $('#sel-cont').textContent = n ? `${n} ${n > 1 ? 'itens selecionados' : 'item selecionado'}` : 'Nenhum item selecionado'; };
  $$('.sel-item').forEach(c => c.onchange = atualizarSel);
  $('#sel-todos').onchange = e => { $$('.sel-item:not(:disabled)').forEach(c => c.checked = e.target.checked); atualizarSel(); };
  $('#form-obs').onsubmit = async e => { e.preventDefault(); await api('adicionar_observacao', { pedido_id: p.id, texto: e.target.texto.value }); toast('Observação adicionada.'); recarregar(); };
  preencherArtesPedido(el, p);
  carregarArquivosPedido(p, el);
});

/* ---------- AR0: arquivos do pedido no Google Drive ---------- */
const TIPOS_ARQ = { arte:'Material do cliente', prova:'Prova', producao:'Arte final (produção)', orcamento:'Orçamento aprovado', comprovante:'Comprovante de pagamento',
  nota_fiscal:'Nota fiscal', entrega:'Entrega', outro:'Outro' };
const fmtTam = b => !b ? '' : b < 1024 * 1024 ? Math.max(1, Math.round(b / 1024)) + ' KB' : (b / 1024 / 1024).toFixed(1).replace('.', ',') + ' MB';
const GRUPO_ARQ = t => ['arte', 'prova', 'producao'].includes(t) ? 'artes' : ['orcamento', 'comprovante', 'nota_fiscal'].includes(t) ? 'financeiro' : 'outros';
async function carregarArquivosPedido(p, el) {
  const alvo = el.querySelector('#arquivos-pedido'); if (!alvo) return;
  const docs = el.querySelector('#docs-financeiro');
  let r;
  try { r = await api('listar_arquivos', { pedido_id: p.id }, true); }
  catch (e) { alvo.innerHTML = `<div class="painel-cab"><h2>Arquivos de arte</h2></div><p class="small" style="color:var(--vermelho);margin:0">Não foi possível carregar os arquivos: ${esc(e.message)}</p>`; return; }
  if (!alvo.isConnected) return;
  const pe = r.pode_enviar || {};
  const todos = r.arquivos || [];
  const linhaArq = (a, comTipo = true) => `<tr>${comTipo ? `<td>${esc(TIPOS_ARQ[a.tipo] || a.tipo)}</td>` : ''}
        <td>${a.rotulo ? `<b>${esc(a.rotulo)}</b> · ` : ''}<a href="${esc(a.url)}" target="_blank" rel="noopener">${esc(a.nome)}</a><div class="small muted">${fmtTam(a.tamanho)}${a.origem ? `${a.tamanho ? ' · ' : ''}copiado do ${esc(a.origem)}` : ''}</div>
          ${a.troca_pendente ? `<div style="margin-top:4px">${badge('Troca pendente · aguardando a pré-impressão', 'b-ambar')}${a.troca_substitui_nome ? ` <span class="small muted">no lugar de ${esc(a.troca_substitui_nome)}</span>` : ''}</div>` : ''}</td>
        <td class="small">${esc(a.criado_por_nome || '')}<div class="muted">${dataHora(a.created_at)}</div></td>
        <td class="dir" style="white-space:nowrap">${acoesArq(a)}</td></tr>`;
  const acoesArq = a => {
    if (a.em_uso) return `<button class="btn peq" onclick="trocarComprovante('${a.recebimento_id}')" title="Troca o comprovante deste pagamento">Trocar</button>`;
    if (a.troca_pendente) return `${r.decide_troca ? `<button class="btn peq prim" data-troca-dec="${a.id}" data-aceitar="1">Aceitar troca</button> <button class="btn peq" data-troca-dec="${a.id}" data-aceitar="0">Recusar</button>` : ''}
      ${a.criado_por === S.usuario.id ? ` <button class="btn peq" data-excluir-arq="${a.id}" title="Retira o pedido de troca">Desistir</button>` : ''}`;
    if (!pe[a.tipo]) return '';
    if (a.travado && !r.decide_troca) return `<button class="btn peq" data-trocar-arq="${a.id}" title="O item já está na pré-impressão/produção: o arquivo novo vai para a confirmação da pré-impressão">Pedir troca</button>`;
    return `<button class="btn peq" data-trocar-arq="${a.id}" title="Envia um arquivo novo no lugar deste">Trocar</button> <button class="btn peq" data-excluir-arq="${a.id}">Excluir</button>`;
  };

  // bloco "Arquivos de arte": só material do cliente, provas e artes finais
  const arqs = todos.filter(a => GRUPO_ARQ(a.tipo) === 'artes');
  const tiposArte = ['producao', 'arte'].filter(t => pe[t]);
  const grupos = [...(p.itens || []).map(i => ({ titulo: i.descricao, lista: arqs.filter(a => a.item_id === i.id) })),
                  { titulo: 'Pedido inteiro', lista: arqs.filter(a => !a.item_id || !(p.itens || []).some(i => i.id === a.item_id)) }]
                 .filter(g => g.lista.length);
  alvo.innerHTML = `<div class="painel-cab"><h2>Arquivos de arte</h2>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        ${r.pasta_url ? `<a class="btn" href="${esc(r.pasta_url)}" target="_blank" rel="noopener">Pasta no Drive</a>` : ''}
        ${pe.producao && (p.itens || []).length ? `<button class="btn" data-trazer-arte>Trazer arte de outro pedido</button>` : ''}
        ${tiposArte.length ? `<button class="btn" data-enviar-arq>Enviar arquivo</button>` : ''}</div></div>
    ${grupos.length ? grupos.map(g => `<h3 style="font-size:14px;margin:14px 0 6px">${esc(g.titulo)}</h3>
      <div class="tabela-wrap"><table><thead><tr><th style="width:190px">Tipo</th><th>Arquivo</th><th style="width:170px">Enviado por</th><th style="width:150px"></th></tr></thead>
      <tbody>${g.lista.map(a => linhaArq(a)).join('')}</tbody></table></div>`).join('')
      : `<p class="small muted" style="margin:0">Nenhum arquivo de arte ainda. A pasta do pedido no Drive é criada sozinha quando o primeiro arquivo for enviado.</p>`}`;

  // documentos do bloco Financeiro: orçamento aprovado (automático), comprovantes e notas fiscais guardados no Drive
  if (docs) {
    const fin = todos.filter(a => GRUPO_ARQ(a.tipo) === 'financeiro');
    docs.innerHTML = !fin.length && !pe.nota_fiscal ? '' : `
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin:18px 0 6px">
        <h3 style="font-size:14px;margin:0">Documentos</h3>
        ${pe.nota_fiscal ? `<button class="btn peq" data-enviar-nf>Enviar nota fiscal</button>` : ''}</div>
      ${fin.length ? `<div class="tabela-wrap"><table><thead><tr><th style="width:190px">Tipo</th><th>Arquivo</th><th style="width:170px">Enviado por</th><th style="width:90px"></th></tr></thead>
        <tbody>${fin.map(a => linhaArq(a)).join('')}</tbody></table></div>`
        : `<p class="small muted" style="margin:0">Nenhuma nota fiscal enviada.</p>`}`;
    const bnf = docs.querySelector('[data-enviar-nf]'); if (bnf) bnf.onclick = () => modalEnviarArquivo(p, ['nota_fiscal']);
  }

  const b = alvo.querySelector('[data-enviar-arq]');
  if (b) b.onclick = () => modalEnviarArquivo(p, tiposArte);
  el.querySelectorAll('[data-excluir-arq]').forEach(bx => bx.onclick = () => modalExcluirArquivo(todos.find(a => a.id === bx.dataset.excluirArq)));
  el.querySelectorAll('[data-trocar-arq]').forEach(bx => bx.onclick = () => trocarArquivo(p, todos.find(a => a.id === bx.dataset.trocarArq)));
  el.querySelectorAll('[data-troca-dec]').forEach(bx => bx.onclick = () => decidirTrocaArte(todos.find(a => a.id === bx.dataset.trocaDec), bx.dataset.aceitar === '1'));
  const bt = alvo.querySelector('[data-trazer-arte]'); if (bt) bt.onclick = () => modalTrazerArte(p);
  // pedido recém-criado pelo "Repetir pedido": oferece trazer as artes finais do pedido original
  const rp = S.cache.trazerArtes;
  if (rp && rp.pedido_id === p.id && bt) {
    S.cache.trazerArtes = null;
    try { const o = await api('listar_artes_pedido', { numero: rp.numero }, true); if ((o.arquivos || []).length) modalTrazerArte(p, o); } catch {}
  }
}
// AR0: copia artes finais de outro pedido (ou de um link do Drive) para a pasta deste pedido
function modalTrazerArte(p, origemPronta = null) {
  const itens = (p.itens || []).filter(i => i.status !== 'cancelado');
  const norm = t => String(t || '').trim().toLowerCase();
  const opItens = (sel = '') => `<option value="">Escolha o material…</option>${itens.map(i => `<option value="${i.id}" ${i.id === sel ? 'selected' : ''}>${esc(i.descricao)}</option>`).join('')}`;
  const sugerir = desc => (itens.find(i => norm(i.descricao) === norm(desc)) || (itens.length === 1 ? itens[0] : {})).id || '';
  const m = abrirModal({ titulo: 'Trazer arte de outro pedido', largo: true, corpo: `
    <div class="chips" style="margin-bottom:12px">
      <button type="button" class="chip ativo" data-modo="pedido">Pedido do sistema</button>
      <button type="button" class="chip" data-modo="link">Link do Drive (pedido antigo)</button></div>
    <div data-bloco="pedido">
      <div class="linha-form"><label class="campo" style="max-width:220px">Número do pedido<input type="text" id="ta-num" value="${esc(origemPronta ? origemPronta.numero : '')}"></label>
        <button type="button" class="btn" id="ta-buscar" style="flex:0">Buscar</button></div>
      <div id="ta-lista" style="margin-top:12px"></div></div>
    <div data-bloco="link" class="hidden">
      <p class="small muted" style="margin-top:0">Abra o arquivo no Drive (pasta 01_CLIENTES, JOB-Nuvem…), copie o link do <b>arquivo</b> e cole aqui. O sistema faz uma cópia na pasta deste pedido.</p>
      <div class="grade g2">
        <label class="campo" style="grid-column:1/-1">Link do arquivo *<input type="url" id="ta-link" placeholder="https://drive.google.com/file/d/…"></label>
        <label class="campo">Material (item) *<select id="ta-link-item">${opItens(itens.length === 1 ? itens[0].id : '')}</select></label>
        <label class="campo">Identificação <span class="muted">(opcional)</span><input type="text" id="ta-link-rot" maxlength="40" placeholder="Ex.: Frente"></label></div></div>
    <div id="ta-prog" class="small muted" style="margin-top:10px"></div>`,
    rodape: `<button class="btn" data-v>Cancelar</button><button class="btn prim" data-c>Trazer para este pedido</button>` });
  let modo = 'pedido', origem = null;
  m.el.querySelector('[data-v]').onclick = m.fechar;
  m.el.querySelectorAll('[data-modo]').forEach(c => c.onclick = () => { modo = c.dataset.modo;
    m.el.querySelectorAll('[data-modo]').forEach(x => x.classList.toggle('ativo', x === c));
    m.el.querySelectorAll('[data-bloco]').forEach(x => x.classList.toggle('hidden', x.dataset.bloco !== modo)); });
  const lista = m.el.querySelector('#ta-lista');
  const mostrar = o => { origem = o;
    lista.innerHTML = !(o.arquivos || []).length
      ? `<p class="small muted">O pedido ${esc(o.numero)} não tem arte final cadastrada no sistema. Se a arte estiver na pasta dele, use a opção de colar o link do Drive.</p>`
      : `<p class="small" style="margin:0 0 8px">Pedido <b>${esc(o.numero)}</b>${o.cliente ? ' · ' + esc(o.cliente) : ''}. Marque as artes e escolha em qual material deste pedido cada uma entra.</p>
        <div class="tabela-wrap"><table><thead><tr><th style="width:28px"></th><th>Arte final do pedido ${esc(o.numero)}</th><th>Vai para o material</th></tr></thead><tbody>
        ${o.arquivos.map(a => `<tr><td><input type="checkbox" data-ta="${a.id}" checked aria-label="Trazer"></td>
          <td>${a.rotulo ? `<b>${esc(a.rotulo)}</b> · ` : ''}<a href="${esc(a.url)}" target="_blank" rel="noopener">${esc(a.nome)}</a><div class="small muted">${esc(a.item_descricao || '')}</div></td>
          <td><select data-ta-item="${a.id}">${opItens(sugerir(a.item_descricao))}</select></td></tr>`).join('')}</tbody></table></div>`; };
  m.el.querySelector('#ta-buscar').onclick = async () => {
    const n = m.el.querySelector('#ta-num').value.trim(); if (!n) return toast('Informe o número do pedido.', true);
    lista.innerHTML = '<p class="small muted">Buscando…</p>';
    try { mostrar(await api('listar_artes_pedido', { numero: n }, true)); } catch (e) { lista.innerHTML = `<p class="small" style="color:var(--vermelho)">${esc(e.message)}</p>`; }
  };
  m.el.querySelector('#ta-num').onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); m.el.querySelector('#ta-buscar').click(); } };
  if (origemPronta) mostrar(origemPronta);
  const bt = m.el.querySelector('[data-c]'), prog = m.el.querySelector('#ta-prog');
  bt.onclick = async () => {
    let pedidos = [];
    if (modo === 'link') {
      const link = m.el.querySelector('#ta-link').value.trim(), item = m.el.querySelector('#ta-link-item').value;
      if (!link) return toast('Cole o link do arquivo.', true);
      if (!item) return toast('Escolha o material que vai receber a arte.', true);
      pedidos = [{ pedido_id: p.id, item_id: item, link, rotulo: m.el.querySelector('#ta-link-rot').value.trim() || null, _nome: 'arquivo do link' }];
    } else {
      if (!origem) return toast('Busque o pedido de origem.', true);
      const marcados = [...m.el.querySelectorAll('[data-ta]:checked')].map(c => c.dataset.ta);
      if (!marcados.length) return toast('Marque pelo menos uma arte.', true);
      for (const id of marcados) {
        const item = m.el.querySelector(`[data-ta-item="${id}"]`).value;
        if (!item) return toast('Escolha o material de cada arte marcada.', true);
        pedidos.push({ pedido_id: p.id, item_id: item, arquivo_id: id, _nome: (origem.arquivos.find(a => a.id === id) || {}).nome });
      }
    }
    bt.disabled = true; bt.classList.add('ocupado'); let ok = 0, pend = 0;
    for (const [n, d] of pedidos.entries()) {
      prog.textContent = `Copiando ${n + 1} de ${pedidos.length}: ${d._nome || ''}…`;
      const { _nome, ...dados } = d;
      try { const rc = await api('arquivo_copiar', dados, true); ok++; if (rc.troca_pendente) pend++; } catch (e) { toast(`${_nome || 'Arquivo'}: ${e.message}`, true); }
    }
    bt.disabled = false; bt.classList.remove('ocupado'); prog.textContent = '';
    if (ok) { toast((ok > 1 ? `${ok} artes copiadas para este pedido.` : 'Arte copiada para este pedido.') + (pend ? ' Material já na pré-impressão/produção: a arte vai para a confirmação da pré-impressão.' : '')); m.fechar(); recarregar(); }
  };
}
// troca: envia o arquivo novo com o mesmo tipo, material e identificação, e tira o antigo da pasta
// V17: arte final de item já na pré-impressão/produção vira pedido de troca (a antiga continua valendo até a pré-impressão aceitar)
function trocarArquivo(p, a) {
  const inp = document.createElement('input'); inp.type = 'file';
  inp.onchange = async () => {
    const novo = inp.files[0]; if (!novo) return;
    let r;
    try {
      r = await aguarde(`Trocando arquivo: ${novo.name}…`, async () => {
        const info = {};
        await enviarArquivoDrive(p.id, novo, a.tipo, a.item_id, a.rotulo, null, null, { substitui_id: a.id, info });
        if (info.troca_pendente) return { pendente: true };
        return api('arquivo_excluir', { id: a.id, motivo: 'Substituído por ' + novo.name }).catch(() => null);
      });
    } catch (e) { return toast(`Não foi possível trocar: ${e.message}`, true); }
    if (r && r.pendente) toast('Arte enviada. A troca vai para a confirmação da pré-impressão; até lá, a arte atual continua valendo.');
    else if (!r) toast('O arquivo novo foi enviado, mas o antigo não saiu da pasta. Exclua o antigo pela lista.', true);
    else if (r.drive_ok === false) toast('Arquivo trocado no sistema, mas o Drive não respondeu ao tirar o antigo. Confira a pasta do pedido.', true);
    else toast('Arquivo trocado.');
    recarregar();
  };
  inp.click();
}
async function decidirTrocaArte(a, aceitar) {
  let motivo = null;
  if (aceitar) { if (!await confirmar(`Aceitar a troca? ${a.nome} passa a ser a arte final do item${a.troca_substitui_nome ? ` e ${a.troca_substitui_nome} vai para a lixeira do Drive` : ''}. Se o item já está com o fornecedor, avise o fornecedor.`, 'Aceitar troca')) return; }
  else { motivo = prompt('Por que a troca foi recusada? (aparece no histórico do pedido)'); if (!motivo || !motivo.trim()) return; }
  const r = await api('decidir_troca_arte', { id: a.id, aceitar, motivo: motivo && motivo.trim() });
  if (r.drive_ok === false) toast('Decisão registrada, mas o Drive não respondeu ao tirar o arquivo. Confira a pasta do pedido.', true);
  else toast(aceitar ? 'Troca aceita: a arte nova já vale para a produção.' : 'Troca recusada.');
  recarregar();
}
function modalExcluirArquivo(a) {
  const fin = ['orcamento', 'comprovante', 'nota_fiscal'].includes(a.tipo);
  const nomeTipo = (TIPOS_ARQ[a.tipo] || 'arquivo').toLowerCase();
  const m = abrirModal({ titulo: 'Excluir arquivo', corpo: `
    <p style="margin:0 0 10px"><b>${esc(a.nome)}</b> (${esc(TIPOS_ARQ[a.tipo] || a.tipo)})</p>
    <p class="small muted" style="margin:0 0 12px">${fin
      ? `O ${esc(nomeTipo)} será excluído. Informe o motivo para confirmar.`
      : 'O arquivo vai para a lixeira do Drive compartilhado e pode ser recuperado por lá durante 30 dias. A exclusão fica registrada no histórico do pedido.'}</p>
    <label class="campo">Motivo${fin ? ' *' : ''}<input type="text" id="motivo-arq" placeholder="Ex.: arquivo errado, versão antiga"></label>`,
    rodape: `<button class="btn" data-v>Voltar</button><button class="btn perigo" data-c>Excluir arquivo</button>` });
  m.el.querySelector('[data-v]').onclick = m.fechar;
  const bc = m.el.querySelector('[data-c]');
  bc.onclick = async () => {
    const motivo = m.el.querySelector('#motivo-arq').value.trim();
    if (fin && !motivo) return toast('Informe o motivo da exclusão.', true);
    const r = await ocupado(bc, () => api('arquivo_excluir', { id: a.id, motivo: motivo || null }));
    m.fechar();
    if (r.drive_ok === false) toast('Arquivo retirado do sistema, mas o Drive não respondeu. Confira a pasta do pedido.', true);
    else toast('Arquivo excluído.');
    recarregar();
  };
}
function modalEnviarArquivo(p, podeTipos) {
  const itens = (p.itens || []).filter(i => i.status !== 'cancelado');
  const soNF = podeTipos.length === 1 && podeTipos[0] === 'nota_fiscal';
  const m = abrirModal({ titulo: soNF ? 'Enviar nota fiscal' : 'Enviar arquivo de arte', corpo: `
    <form id="f-arq" class="grade">
      <label class="campo ${soNF ? 'hidden' : ''}">Tipo *<select name="tipo" required>${podeTipos.map(t => `<option value="${t}">${esc(TIPOS_ARQ[t])}</option>`).join('')}</select></label>
      <label class="campo ${soNF ? 'hidden' : ''}"><span id="rot-item">Material (item)</span><select name="item_id"><option value="">Pedido inteiro</option>${itens.map(i => `<option value="${i.id}">${esc(i.descricao)}</option>`).join('')}</select></label>
      <label class="campo" style="grid-column:1/-1">Identificação <span class="muted">(opcional — ${soNF ? 'ex.: NF 1234' : 'ex.: Frente, Verso, Faca'})</span><input type="text" name="rotulo" maxlength="40"></label>
      <label class="campo" style="grid-column:1/-1">Arquivos *<input type="file" name="arquivos" multiple required></label>
      <div id="arq-prog" class="small muted" style="grid-column:1/-1"></div>
    </form>`,
    rodape: `<button class="btn" data-v>Cancelar</button><button class="btn prim" data-c>Enviar</button>` });
  m.el.querySelector('[data-v]').onclick = m.fechar;
  const fa = m.el.querySelector('#f-arq');
  const ajustarItem = () => { m.el.querySelector('#rot-item').textContent = fa.elements.tipo.value === 'producao' ? 'Material (item) *' : 'Material (item)'; };
  fa.elements.tipo.onchange = ajustarItem; ajustarItem();
  const bt = m.el.querySelector('[data-c]');
  bt.onclick = async () => {
    const f = m.el.querySelector('#f-arq'); const arqs = [...f.elements.arquivos.files];
    if (!arqs.length) return toast('Escolha pelo menos um arquivo.', true);
    if (f.elements.tipo.value === 'producao' && !f.elements.item_id.value) return toast('Escolha o material (item) desta arte final.', true);
    bt.disabled = true; bt.classList.add('ocupado'); const prog = m.el.querySelector('#arq-prog'); let ok = 0, pend = 0;
    for (const [n, arq] of arqs.entries()) {
      try {
        const info = {};
        await enviarArquivoDrive(p.id, arq, f.elements.tipo.value, f.elements.item_id.value, f.elements.rotulo.value.trim(), frac =>
          prog.textContent = `Enviando ${n + 1} de ${arqs.length}: ${arq.name} — ${Math.round(frac * 100)}%`, null, { info });
        ok++; if (info.troca_pendente) pend++;
      } catch (e) { toast(`${arq.name}: ${e.message}`, true); }
    }
    bt.disabled = false; bt.classList.remove('ocupado');
    if (ok) { toast((ok > 1 ? `${ok} arquivos enviados ao Drive.` : 'Arquivo enviado ao Drive.') + (pend ? ' O item já está na pré-impressão/produção: a arte nova vai para a confirmação da pré-impressão.' : '')); m.fechar(); recarregar(); }
  };
}
async function enviarArquivoDrive(pedidoId, arquivo, tipo, itemId, rotulo, aoProgresso, recebimentoId, opts = {}) {
  const mime = arquivo.type || 'application/octet-stream';
  const r = await api('arquivo_enviar', { pedido_id: pedidoId, item_id: itemId || null, recebimento_id: recebimentoId || null, tipo, rotulo: rotulo || null, nome_arquivo: arquivo.name, mime, tamanho: arquivo.size, substitui_id: opts.substitui_id || null, arte_id: opts.arte_id || null }, true);
  if (opts.info) opts.info.troca_pendente = !!r.troca_pendente;
  if (!r.upload_url) throw new Error('O Drive não devolveu o endereço de envio.');
  const resp = await new Promise((ok, falha) => {
    const x = new XMLHttpRequest();
    x.open('PUT', r.upload_url);
    x.setRequestHeader('Content-Type', mime);
    x.upload.onprogress = e => { if (e.lengthComputable && aoProgresso) aoProgresso(e.loaded / e.total); };
    x.onload = () => { if (x.status >= 200 && x.status < 300) { try { ok(JSON.parse(x.responseText || '{}')); } catch { falha(new Error('Resposta inválida do Drive.')); } }
                       else falha(new Error(`O Drive recusou o envio (${x.status}).`)); };
    x.onerror = () => falha(new Error('Falha de conexão ao enviar para o Drive.'));
    x.send(arquivo);
  });
  if (!resp.id) throw new Error('O Drive não confirmou o arquivo.');
  await api('arquivo_confirmar', { id: r.arquivo_id, drive_file_id: resp.id }, true);
  return r.arquivo_id;
}

function descHistorico(h) {
  if (h.tipo === 'status_item') return h.de ? `${esc(h.descricao)}: ${esc(nomeStatusItem(h.de))} → <b>${esc(nomeStatusItem(h.para))}</b>` : `${esc(h.descricao)} (${esc(nomeStatusItem(h.para))})`;
  if (h.tipo === 'status_pedido') return `Pedido passou para <b>${esc(nomeStatusPed(h.para))}</b>`;
  return esc(h.descricao);
}

async function moverSelecionados() {
  const itens = $$('.sel-item:checked').map(c => c.value);
  if (!itens.length) return toast('Selecione os itens que deseja mover.', true);
  const status = $('#novo-status').value;
  if (!status) return toast('Escolha para qual status mover.', true);
  await api('mudar_status_itens', { itens, status });
  toast('Itens atualizados.'); recarregar();
}

async function cancelarPedido(excluir = false) {
  const p = S.vistaAtual.dados;
  const r = await api('previa_cancelamento', { id: p.id, excluir });
  const avisos = r.avisos || [];
  const acao = excluir ? 'Excluir' : 'Cancelar';
  const m = abrirModal({ titulo: `${acao} pedido ${p.numero}`, corpo: `
    ${excluir
      ? '<p style="margin:0 0 12px">O pedido sai de todas as listas e não pode mais ser reativado. O histórico, os pagamentos e as comissões continuam registrados.</p>'
      : '<p style="margin:0 0 12px">Todos os itens param na hora: saem da arte, da pré-impressão, da produção e da expedição. Parcelas em aberto são canceladas. Se reativar depois, cada item volta para onde estava.</p>'}
    ${avisos.length ? `<div style="margin-bottom:12px"><b>Confirme cada ponto antes de continuar:</b>
      ${avisos.map(a => `<label class="check" style="align-items:flex-start;margin-top:10px;padding:10px 12px;border:1px solid var(--vermelho);border-radius:8px;background:var(--vermelho-bg)">
        <input type="checkbox" data-conf="${esc(a.codigo)}" style="margin-top:3px">
        <span><b>${esc(a.titulo)}</b><br><span class="small">${esc(a.texto)}</span></span></label>`).join('')}</div>`
      : '<p class="small muted" style="margin:0 0 12px">Nenhum pagamento, produção ou repasse de comissão ligado a este pedido.</p>'}
    <label class="campo">Motivo ${excluir ? 'da exclusão' : 'do cancelamento'} *<textarea id="motivo" required></textarea></label>`,
    rodape: `<button class="btn" data-v>Voltar</button><button class="btn perigo" data-c>${acao} pedido</button>` });
  m.el.querySelector('[data-v]').onclick = m.fechar;
  m.el.querySelector('[data-c]').onclick = async () => {
    const motivo = $('#motivo', m.el).value.trim();
    const confirmados = [...m.el.querySelectorAll('[data-conf]:checked')].map(c => c.dataset.conf);
    if (confirmados.length < avisos.length) return toast('Marque todos os avisos para confirmar.', true);
    if (!motivo) return toast(`Informe o motivo ${excluir ? 'da exclusão' : 'do cancelamento'}.`, true);
    await api(excluir ? 'excluir_pedido' : 'cancelar_pedido', { id: p.id, motivo, confirmados });
    m.fechar();
    if (excluir) { toast('Pedido excluído.'); descartarVista(chaveRota()); location.hash = '#/pedidos'; }
    else { toast('Pedido cancelado. Os itens foram parados.'); recarregar(); }
  };
}
/* V16: cancelar item (em arte: na hora; na pré-impressão/produção: com a confirmação da pré-impressão; depois disso: não cancela) */
const podeCancelarItem = (p, i) => p.status !== 'cancelado' && !p.excluido_em && i.status !== 'cancelado' && !i.cancel_solicitado_em
  && ordemStatus(i.status) < 5 && (pode('cria_pedidos') || p.confirma_producao);
function modalCancelarItem(id) {
  const p = S.vistaAtual.dados; const i = p.itens.find(x => x.id === id);
  if (p.itens.filter(x => x.status !== 'cancelado').length <= 1) return toast('Este é o único item ativo do pedido. Para cancelar tudo, use "Cancelar pedido".', true);
  const direto = ordemStatus(i.status) <= 2 || p.confirma_producao;
  const m = abrirModal({ titulo: 'Cancelar item', corpo: `
    <p style="margin:0 0 8px"><b>${esc(i.descricao)}</b> · ${badgeItem(i.status)}${pode('ve_valores') ? ' · ' + brl(i.valor_total) : ''}</p>
    <p class="small muted" style="margin:0 0 12px">${direto
      ? 'O item sai do pedido e o total é recalculado. Tudo fica no histórico.'
      : 'O item já está na pré-impressão/produção: o cancelamento vai para a confirmação da pré-impressão. Até a decisão, o item não avança.'}</p>
    <label class="campo">Motivo *<input type="text" id="ci-motivo" maxlength="300" placeholder="Ex.: cliente desistiu deste material"></label>`,
    rodape: `<button class="btn" data-v>Voltar</button><button class="btn perigo" data-c>${direto ? 'Cancelar item' : 'Pedir cancelamento'}</button>` });
  m.el.querySelector('[data-v]').onclick = m.fechar;
  const bc = m.el.querySelector('[data-c]');
  bc.onclick = async () => {
    const motivo = m.el.querySelector('#ci-motivo').value.trim(); if (!motivo) return toast('Informe o motivo.', true);
    const r = await ocupado(bc, () => api('cancelar_item', { id, motivo })); m.fechar(); resultadoCancelItem(r);
  };
}
async function excluirItemCancelado(id) {
  const i = S.vistaAtual.dados.itens.find(x => x.id === id);
  if (!await confirmar(`Excluir o item cancelado <b>${esc(i.descricao)}</b>? Ele some da lista do pedido; o cancelamento e o motivo continuam no histórico. Arquivos dele ficam em "Pedido inteiro".`, 'Excluir item', true, { html: true })) return;
  await api('excluir_item', { id }); toast('Item excluído.'); recarregar();
}
async function decidirCancelItem(id, aceitar) {
  let motivo = null;
  if (aceitar) { if (!await confirmar('Confirmar o cancelamento deste item? Ele sai do pedido e o total é recalculado. Se já foi enviado ao fornecedor, avise o fornecedor.', 'Confirmar cancelamento', true)) return; }
  else { motivo = prompt('Por que o cancelamento foi recusado? (o vendedor vê no histórico)'); if (!motivo || !motivo.trim()) return; }
  resultadoCancelItem(await api('decidir_cancelamento_item', { id, aceitar, motivo: motivo && motivo.trim() }), aceitar);
}
function resultadoCancelItem(r, decidiu = true) {
  if (r.pendente) toast('Pedido de cancelamento enviado para a pré-impressão.');
  else if (r.cancelado) toast('Item cancelado.');
  else if (!decidiu) toast('Cancelamento recusado.');
  if (r.aviso_financeiro) { const a = abrirModal({ titulo: 'Atenção: pagamento do pedido', corpo: `<div class="alerta">${esc(r.aviso_financeiro)}</div>`, rodape: '<button class="btn prim" data-v>Entendi</button>' });
    a.el.querySelector('[data-v]').onclick = a.fechar; }
  recarregar();
}

async function reativarPedido() {
  if (!await confirmar('Reativar este pedido? Cada item volta para a etapa em que estava quando o pedido foi cancelado, e as parcelas canceladas junto com ele voltam a ficar em aberto.', 'Reativar')) return;
  await api('cancelar_pedido', { id: S.vistaAtual.dados.id, reativar: true }); toast('Pedido reativado.'); recarregar();
}

// V10: abre o Novo pedido já preenchido (sem previsão e sem forma de pagamento, que o vendedor confere)
function repetirPedido(pedido) {
  const p = pedido || S.vistaAtual.dados;
  S.cache.repetir = { numero: p.numero, cliente: p.cliente, forma_entrega: p.forma_entrega, endereco_entrega: p.endereco_entrega,
    observacoes: p.observacoes, observacao_geral: p.observacao_geral, desconto: p.desconto, desconto_percentual: p.desconto_percentual, frete: p.frete,
    itens: (p.itens || []).filter(i => i.status !== 'cancelado').map(i => ({ descricao: i.descricao, categoria_id: i.categoria_id, observacao: i.observacao, quantidade: i.quantidade,
      valor_total: i.valor_total, status: 'arte_a_fazer', precisa_acabamento: i.precisa_acabamento, acabamento_por: i.acabamento_por })) };
  descartarVista('novo');
  if (chaveRota() === 'novo') rotear(); else location.hash = '#/novo';
}
// V22: pedidos antigos do cliente escolhido no Novo pedido (com Repetir pedido)
async function modalPedidosCliente(c) {
  const m = abrirModal({ titulo: `Pedidos de ${c.nome_fantasia || c.nome}`, largo: true, corpo: '<p class="small muted">Carregando…</p>',
    rodape: '<button class="btn" data-v>Fechar</button>' });
  m.el.querySelector('[data-v]').onclick = m.fechar;
  let r; try { r = await api('listar_pedidos', { cliente_id: c.id, incluir_finalizados: true, limite: 30 }, true); }
  catch (e) { m.el.querySelector('.modal-corpo').innerHTML = `<p style="color:var(--vermelho)">${esc(e.message)}</p>`; return; }
  const lista = r.pedidos || [];
  m.el.querySelector('.modal-corpo').innerHTML = !lista.length ? '<div class="vazio">Este cliente ainda não tem pedidos no sistema.</div>' : `
    <p class="small muted" style="margin:0 0 10px">${r.total > lista.length ? `Mostrando os ${lista.length} mais recentes de ${r.total}.` : `${lista.length} pedido(s).`} "Repetir" troca o pedido que está sendo montado por uma cópia do escolhido.</p>
    <div class="tabela-wrap"><table><thead><tr><th>Pedido</th><th>Itens</th>${pode('ve_valores') ? '<th class="dir">Valor</th>' : ''}<th>Situação</th><th></th></tr></thead><tbody>
    ${lista.map(p => `<tr><td><b>${esc(p.numero)}</b><div class="small muted">${data(p.created_at)}</div>${(p.itens || []).some(i => i.status === 'cancelado') && (p.itens || []).some(i => i.status !== 'cancelado') ? '<div class="small muted">itens cancelados não aparecem</div>' : ''}</td>
      <td class="small">${(p.itens || []).filter(i => i.status !== 'cancelado').map(i => `${esc(i.descricao)} <span class="muted">· ${num(i.quantidade)} un${pode('ve_valores') && i.valor_total != null ? ' · ' + brl(i.valor_total) : ''}</span>`).join('<br>') || '<span class="muted">—</span>'}</td>
      ${pode('ve_valores') ? `<td class="dir num">${brl(p.valor_total)}</td>` : ''}
      <td>${badgePed(p.status, p.status_nome)}</td>
      <td class="dir" style="white-space:nowrap"><a class="btn peq" href="#/pedido/${p.id}" target="_blank" rel="noopener">Abrir</a>${(p.itens || []).some(i => i.status !== 'cancelado') ? ` <button class="btn peq prim" data-rep="${p.id}">Repetir</button>` : ''}</td></tr>`).join('')}
    </tbody></table></div>`;
  m.el.querySelectorAll('[data-rep]').forEach(b => b.onclick = async () => {
    if (!await confirmar('Repetir este pedido? O que já foi preenchido no Novo pedido será substituído.', 'Repetir pedido')) return;
    const p = (await ocupado(b, () => api('obter_pedido', { id: b.dataset.rep }))).pedido;
    m.fechar(); repetirPedido(p);
  });
}
function modalEditarPedido() {
  let descEP;
  const p = S.vistaAtual.dados; const gestor = ['diretor','administrador'].includes(S.usuario.perfil);
  const m = abrirModal({ titulo: `Editar pedido ${p.numero}`, corpo: `
    <form id="f-ped" class="grade g2">
      <label class="campo">Número do pedido<input type="text" name="numero" value="${esc(p.numero)}"></label>
      ${gestor ? `<label class="campo">Vendedor<select name="vendedor_id">${S.base.vendedores.map(v => `<option value="${v.id}" ${v.id === p.vendedor_id ? 'selected' : ''}>${esc(v.nome)}</option>`).join('')}</select></label>` : '<span></span>'}
      <label class="campo">Previsão de entrega *<input type="date" name="data_prevista_entrega" value="${esc(p.data_prevista_entrega || '')}" required></label>
      ${saiuParaEntrega(p) ? `<div class="small muted" style="grid-column:1/-1">Entrega: ${p.forma_entrega === 'entrega' ? 'Entregar no cliente' : 'Retira no balcão'}${p.endereco_entrega ? ' · ' + esc(p.endereco_entrega) : ''} <i>(já saiu para entrega, não pode mais ser alterada)</i></div>` : htmlEntrega(p)}
      ${htmlDesconto('ep-desc', p)}
      <label class="campo">Frete (R$)<input type="number" step="0.01" min="0" name="frete" value="${esc(p.frete)}"></label>
      <label class="campo" style="grid-column:1/-1">Observações da entrega<textarea name="observacoes">${esc(p.observacoes || '')}</textarea></label>
      <label class="campo" style="grid-column:1/-1">Observação geral <span class="muted">(aparece para o cliente)</span><textarea name="observacao_geral">${esc(p.observacao_geral || '')}</textarea></label>
    </form>`, rodape: `<button class="btn" data-v>Voltar</button><button class="btn prim" data-s>Salvar alterações</button>`,
    aoAbrir: el => { descEP = ligarDesconto(el, 'ep-desc', () => Number(p.valor_itens || 0));
      if (!saiuParaEntrega(p)) { const e = ligarEntrega(el); if (p.forma_entrega !== 'entrega' && p.cliente) e.definirCliente(p.cliente); } } });
  m.el.querySelector('[data-v]').onclick = m.fechar;
  m.el.querySelector('[data-s]').onclick = async () => {
    try { descEP.validar(); } catch (e) { return toast(e.message, true); }
    await api('editar_pedido', { id: p.id, ...formDados($('#f-ped', m.el)), ...descEP.dados() }); m.fechar(); toast('Pedido atualizado.'); recarregar();
  };
}

