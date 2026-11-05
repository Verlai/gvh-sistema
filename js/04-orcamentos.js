/* ---------- NOVO PEDIDO ---------- */
rota('novo', async (_p, el) => {
  if (!pode('cria_pedidos')) throw new Error('Seu perfil não cria pedidos.');
  const rep = S.cache.repetir || null; S.cache.repetir = null;
  definirTopoEm(el, rep ? `Novo pedido (repetindo o ${rep.numero})` : 'Novo pedido', `<a class="btn" href="#/pedidos">Voltar</a>`);
  const gestor = ['diretor','administrador'].includes(S.usuario.perfil);
  let cliente = null, pegarItens, coletarPagamento;
  el.innerHTML = `
    ${rep ? `<div class="alerta" style="margin-bottom:12px">Repetindo o pedido <b>${esc(rep.numero)}</b>: cliente, itens, valores, entrega e observações foram copiados. <b>Confira os valores</b> e preencha a previsão de entrega e a forma de pagamento.</div>` : ''}
    <div class="painel" style="padding:12px 16px"><label class="check"><input type="checkbox" id="np-orc"> <b>Salvar como orçamento</b> <span class="muted small">(aceita nome do cliente sem cadastro; não exige previsão de entrega)</span></label></div>
    <div class="painel"><div class="painel-cab"><h2>Cliente</h2></div>
      <div class="linha-form">
        <label class="campo busca-box" style="flex:3">Buscar cliente<input type="search" id="busca-cli" placeholder="Nome, fantasia, CPF/CNPJ ou WhatsApp" autocomplete="off"></label>
        ${pode('cadastra_clientes') ? '<button type="button" class="btn" id="novo-cli" style="flex:0">Novo cliente</button>' : ''}
      </div>
      <label class="campo hidden" id="np-cli-nome-box" style="margin-top:10px">Ou apenas o nome do cliente (sem cadastro)<input type="text" id="np-cli-nome" placeholder="Ex.: Padaria do Zé"></label>
      <div id="cli-escolhido" style="margin-top:10px"></div>
    </div>
    <div class="painel"><div class="painel-cab"><h2>Itens</h2><span class="small muted">Escreva o produto: a categoria é escolhida pelo que você digitar (dá para trocar).</span></div>
      <div id="editor-itens"></div>
      <div class="grade g4" style="margin-top:14px">
        ${htmlDesconto('np-desc', rep || {})}
        <label class="campo">Frete (R$)<input type="number" step="0.01" min="0" id="np-frete" value="${esc(rep ? Number(rep.frete || 0) : 0)}"></label>
        <label class="check hidden" id="np-pix-box" style="align-self:end;padding-bottom:9px;white-space:normal"><input type="checkbox" id="np-pix"> Oferecer ${PIX_PCT}% de desconto no Pix à vista</label>
        <div class="totais" style="margin:0"><span class="muted small">Total do pedido</span><b class="num" id="np-total">R$ 0,00</b><span class="small muted" id="np-total-pix"></span></div>
      </div>
    </div>
    <div class="painel" id="np-ent-painel"><div class="painel-cab"><h2>Entrega</h2></div>
      <form id="f-np" class="grade g3">
        ${gestor ? `<label class="campo">Vendedor<select name="vendedor_id">${S.base.vendedores.map(v => `<option value="${v.id}" ${v.id === S.usuario.id ? 'selected' : ''}>${esc(v.nome)}</option>`).join('')}</select></label>` : ''}
        <label class="campo">Número do pedido<input type="text" name="numero" placeholder="Automático"></label>
        <label class="campo" id="np-prev-box">Previsão de entrega *<input type="date" name="data_prevista_entrega" id="np-prev" required></label>
        <label class="campo hidden" id="np-val-box">Validade do orçamento<input type="date" id="np-validade"></label>
        <label class="campo hidden" id="np-prazo-box">Prazo (dias úteis) <span class="muted small">— opcional</span><input type="number" min="1" max="365" id="np-prazo" placeholder="Ex.: 5"></label>
        ${htmlEntrega(rep || {})}
        <label class="campo" style="grid-column:1/-1">Observações da entrega<textarea name="observacoes">${esc(rep?.observacoes || '')}</textarea></label>
      </form>
    </div>
    <div class="painel" id="np-parc-painel"><div class="painel-cab"><h2>Forma de Pagamento *</h2><span class="small muted">Como ficou combinado com o cliente. Comprovante e link podem ser enviados agora ou depois, na tela do pedido.</span></div>
      <div id="np-pag"></div>
    </div>
    <div class="painel"><label class="campo">Observação geral <span class="muted small">(aparece para o cliente)</span><textarea id="np-obs-geral">${esc(rep?.observacao_geral || '')}</textarea></label></div>
    <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:16px">
      <button class="btn" type="button" id="np-descartar">Descartar pedido</button><button class="btn prim" id="np-salvar">Criar pedido</button>
    </div>`;

  let descNP;
  const somaItens = () => (pegarItens ? pegarItens() : []).reduce((s, i) => s + Number(i.valor_total || 0), 0);
  const total = () => somaItens() - (descNP ? descNP.valor() : 0) + Number($('#np-frete').value || 0);
  const atualizarTotal = () => {
    $('#np-total').textContent = brl(total());
    if (descNP) descNP.atualizar();
    $('#np-total-pix').textContent = $('#np-orc').checked && $('#np-pix').checked ? `ou ${brl(total() - valorPix(somaItens(), descNP ? descNP.valor() : 0))} no Pix à vista` : '';
    coletarPagamento && coletarPagamento.atualizar();
  };
  pegarItens = editorItens($('#editor-itens'), rep ? rep.itens : [], { comStatus: true, aoMudar: atualizarTotal, comDigital: true });
  $('#np-frete').oninput = atualizarTotal;
  descNP = ligarDesconto(el, 'np-desc', somaItens, atualizarTotal);
  $('#np-pix').onchange = atualizarTotal;

  const escolher = c => {
    cliente = c;
    $('#cli-escolhido').innerHTML = `<div class="alerta" style="background:var(--verde-bg);color:var(--grafite);display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap"><span><b>${esc(c.nome_fantasia || c.nome)}</b>
      <span class="muted">${esc(fmtDoc(c.cpf_cnpj))} ${esc(fmtTel(c.whatsapp || c.telefone))}</span></span>
      <button type="button" class="btn peq" id="np-ped-antigos">Ver pedidos antigos</button></div>
      ${c.observacoes ? `<div class="alerta" style="margin-top:6px"><b>Observação do cliente:</b> ${esc(c.observacoes)}</div>` : ''}`;
    $('#busca-cli').value = ''; $('#np-cli-nome').value = ''; $('#np-cli-nome-box').classList.add('hidden');
    $('#np-ped-antigos').onclick = () => modalPedidosCliente(c);
    entrega.definirCliente(c);
  };
  const entrega = ligarEntrega($('#f-np'));
  ligarBuscaCliente($('#busca-cli'), escolher);
  if ($('#novo-cli')) $('#novo-cli').onclick = () => modalCliente(null, escolher);
  if (rep && rep.cliente) escolher(rep.cliente);
  $('#np-pag').innerHTML = htmlFormaPagamento({ autorizar: true });
  coletarPagamento = ligarFormaPagamento($('#np-pag'), total, () => $('#np-prev').value);
  // 1º boleto e restante acompanham a previsão de entrega
  $('#np-prev').onchange = () => coletarPagamento.atualizar();
  atualizarTotal();   // pedido repetido já chega com itens: calcula o total na abertura

  $('#np-validade').value = somaDias(hoje(), 7);
  const modoOrc = () => $('#np-orc').checked;
  $('#np-orc').onchange = () => {
    const o = modoOrc();
    definirTopoEm(el, o ? 'Novo orçamento' : 'Novo pedido', `<a class="btn" href="#/pedidos">Voltar</a>`);
    $('#np-cli-nome-box').classList.toggle('hidden', !o || !!cliente);
    $('#np-prev-box').classList.toggle('hidden', o);
    ['#np-val-box', '#np-prazo-box', '#np-pix-box'].forEach(s => $(s).classList.toggle('hidden', !o));
    $$('#f-np [name=numero], #f-np [name=vendedor_id]').forEach(i => i.closest('label').classList.toggle('hidden', o));
    $('#np-parc-painel h2').textContent = o ? 'Forma de Pagamento' : 'Forma de Pagamento *';
    $('#np-pag').innerHTML = htmlFormaPagamento(o ? { orcamento: true } : { autorizar: true });
    coletarPagamento = ligarFormaPagamento($('#np-pag'), total, () => $('#np-prev').value);
    pegarItens.definirStatus(!o);
    $('#np-salvar').textContent = o ? 'Salvar orçamento' : 'Criar pedido';
    atualizarTotal();
  };
  $('#np-descartar').onclick = async () => {
    if (!await confirmar('Descartar este pedido? Tudo o que foi preenchido será apagado.', 'Descartar', true)) return;
    descartarVista('novo'); location.hash = '#/pedidos';
  };
  $('#np-salvar').onclick = async () => {
    const itens = pegarItens();
    if (pegarItens.incompletos()) return toast('Há item sem categoria, produto, quantidade ou total. Complete ou remova a linha.', true);
    if (!itens.length) return toast('Inclua ao menos um item.', true);
    try { descNP.validar(); } catch (e) { return toast(e.message, true); }
    if (descNP.valor() > somaItens() + 0.009) return toast('O desconto não pode ser maior que o valor dos itens.', true);
    if (modoOrc()) {
      const nomeCli = $('#np-cli-nome').value.trim();
      if (!cliente && !nomeCli) return toast('Escolha um cliente ou informe o nome dele.', true);
      const f = formDados($('#f-np'));
      let pag; try { pag = await coletarPagamento(); } catch (e) { return toast(e.message, true); }
      const d = { cliente_id: cliente?.id || '', cliente_nome: cliente ? '' : nomeCli, itens, ...descNP.dados(), desconto_pix: $('#np-pix').checked, frete: $('#np-frete').value,
        validade: $('#np-validade').value, observacoes: $('#np-obs-geral').value, observacoes_entrega: f.observacoes, forma_entrega: f.forma_entrega, endereco_entrega: f.endereco_entrega,
        prazo_dias_uteis: $('#np-prazo').value, forma_pagamento: pag?.forma_pagamento || '', forma_pagamento_obs: pag?.forma_pagamento_obs || '',
        pagamento_detalhe: pag?.pagamento_detalhe || null, condicoes_pagamento: pag ? pag.resumo : '' };
      $('#np-salvar').disabled = true;
      try { const r = await api('salvar_orcamento', d); toast(`Orçamento ${r.numero} salvo.`); descartarVista('novo'); location.hash = '#/orcamentos'; }
      finally { $('#np-salvar').disabled = false; }
      return;
    }
    if (!cliente) return toast('Pedido exige cliente cadastrado. Escolha ou cadastre o cliente.', true);
    if (!$('#np-prev').value) { $('#np-prev').focus(); return toast('Informe a previsão de entrega.', true); }
    $('#np-salvar').disabled = true;
    let pag; try { pag = await coletarPagamento(); } catch (e) { $('#np-salvar').disabled = false; if (e.message === 'upload' || e.message === 'tamanho') return; $('#np-parc-painel').scrollIntoView({ behavior: 'smooth', block: 'center' }); return toast(e.message, true); }
    const d = { ...formDados($('#f-np')), observacao_geral: $('#np-obs-geral').value, cliente_id: cliente.id, itens, ...descNP.dados(), frete: $('#np-frete').value,
      recebimentos: pag.recebimentos, forma_pagamento: pag.forma_pagamento, forma_pagamento_obs: pag.forma_pagamento_obs,
      autoriza_sem_pagamento: pag.autoriza_sem_pagamento, condicoes_pagamento: pag.resumo };
    try { const r = await api('criar_pedido', d); await anexarComprovantes(pag, r); toast(`Pedido ${r.numero} criado.`);
      if (rep) S.cache.trazerArtes = { pedido_id: r.id, numero: rep.numero };
      descartarVista('novo'); location.hash = '#/pedido/' + r.id; }
    finally { $('#np-salvar').disabled = false; }
  };
});

/* ---------- ORÇAMENTOS ---------- */
const ORC_NOMES = { aberto:['Em elaboração','b-cinza'], enviado:['Enviado','b-azul'], aceito:['Aprovado pelo cliente','b-verde'], aprovado:['Virou pedido','b-azul'], recusado:['Recusado','b-vermelho'], expirado:['Expirado','b-ambar'] };
const podeExcluirOrc = o => o && o.criado_por === S.usuario.id && !o.pedido_id;

// ações usadas na lista e na tela do orçamento (sempre com os dados salvos no banco)
async function linkOrcamento(id) { const o = (await api('obter_orcamento', { id })).orcamento; if (!o) return toast('Orçamento não encontrado.', true); modalLinkOrcamento(o, o.cliente); }
async function imprimirOrcamentoId(id) { const o = (await api('obter_orcamento', { id })).orcamento; if (!o) return toast('Orçamento não encontrado.', true); imprimirOrcamento(o); }
async function excluirOrcamento(id, numero) {
  if (!await confirmar(`Excluir o orçamento ${numero}? Ele some das listas e o link do cliente deixa de funcionar. O número não é reaproveitado.`, 'Excluir orçamento', true)) return false;
  await api('excluir_orcamento', { id }); toast(`Orçamento ${numero} excluído.`);
  descartarVista('orcamento/' + id);
  return true;
}
async function converterOrcamento(id) {
  const o = (await api('obter_orcamento', { id })).orcamento;
  if (!o) return toast('Orçamento não encontrado.', true);
  if (o.pedido_id) return toast('Este orçamento já virou pedido.', true);
  if (o.cliente_id) return modalConversao(o, o.cliente);
  if (!pode('cadastra_clientes')) return toast('Pedido exige cliente cadastrado. Peça a quem cadastra clientes.', true);
  if (o.cadastro_pendente) {
    if (await confirmar('O cliente já enviou o cadastro pelo link do orçamento. Confira e aprove o cadastro; depois é só transformar em pedido.', 'Conferir cadastro')) abrirConferenciaCadastro(o.cadastro_pendente);
    return;
  }
  if (!await confirmar('Pedido exige cliente cadastrado. Vamos cadastrar este cliente agora e depois criar o pedido.', 'Cadastrar cliente')) return;
  modalCliente(null, c => modalConversao(o, c), o.cliente_nome || '');
}
function modalConversao(o, cliente) {
  const itens = o.itens || [];
  let coletar, ent;
  const pixAtivo = () => { const c = document.querySelector('#conv-pix'); return !!(c && c.checked && !c.disabled && coletar && coletar.forma() === 'pix'); };
  const prev0 = o.prazo_dias_uteis ? somaDiasUteis(hoje(), Number(o.prazo_dias_uteis)) : '';
  const m = abrirModal({ titulo: `Transformar o orçamento ${o.numero} em pedido`, largo: true, corpo: `
    <p style="margin:0 0 12px">Cliente: <b>${esc(cliente.nome_fantasia || cliente.nome)}</b> · Total: <b id="conv-total">${brl(o.valor_total)}</b></p>
    <h3 style="margin:0 0 8px">Status inicial de cada item</h3>
    <div class="tabela-wrap"><table><thead><tr><th>Produto</th><th class="dir">Qtd.</th><th class="dir">Total</th><th style="min-width:170px">Status inicial</th></tr></thead><tbody>
      ${itens.map((i, k) => `<tr><td><b>${esc(i.descricao || '')}</b>${i.observacao ? `<div class="small muted">${esc(i.observacao)}</div>` : ''}</td><td class="dir num">${num(i.quantidade)}</td><td class="dir num">${brl(i.valor_total)}</td>
        <td><select data-st="${k}">${opcoesStatusInicial('arte_a_fazer')}</select></td></tr>`).join('')}</tbody></table></div>
    <div class="small muted" style="margin-top:4px">Item que já começa na Pré-impressão precisa de pagamento, de forma Boleto / Paga na retirada ou da autorização "produzir sem pagamento".</div>
    <div class="grade g2" style="margin-top:14px">
      <label class="campo">Previsão de entrega *<input type="date" id="conv-prev" required value="${prev0}">
        ${o.prazo_dias_uteis ? `<span class="small muted">Prazo do orçamento: ${esc(textoPrazo(o.prazo_dias_uteis))}. Confira a data.</span>` : ''}</label>
    </div>
    <div class="grade g2" style="margin-top:8px" id="conv-ent">${htmlEntrega({ forma_entrega: o.forma_entrega, endereco_entrega: o.endereco_entrega })}</div>
    ${o.observacoes_entrega ? `<div class="small" style="margin-top:6px"><span class="muted">Observações da entrega:</span> ${esc(o.observacoes_entrega)}</div>` : ''}
    ${o.observacoes ? `<div class="small" style="margin-top:4px"><span class="muted">Observação geral:</span> ${esc(o.observacoes)}</div>` : ''}
    <h3 style="margin:16px 0 8px">Forma de Pagamento *</h3><div id="conv-pag">${htmlFormaPagamento({ autorizar: true })}</div>
    ${o.desconto_pix ? `<label class="check" style="margin-top:14px;white-space:normal"><input type="checkbox" id="conv-pix" disabled> Cliente vai pagar à vista no Pix com ${PIX_PCT}% de desconto (total ${brl(o.valor_pix)})</label>
      <div class="small muted" id="conv-pix-dica" style="margin-top:4px">O orçamento ofereceu o desconto no Pix. Escolha a forma Pix para usar.</div>` : ''}`,
    rodape: `<button class="btn" data-v>Voltar</button><button class="btn escuro" data-s>Criar pedido</button>`,
    aoAbrir: el => {
      const inicial = o.forma_pagamento ? { forma: o.forma_pagamento, obs: o.forma_pagamento_obs, detalhe: o.pagamento_detalhe } : null;
      coletar = ligarFormaPagamento(el.querySelector('#conv-pag'), () => pixAtivo() ? Number(o.valor_pix || 0) : Number(o.valor_total || 0), () => el.querySelector('#conv-prev').value, inicial);
      el.querySelector('#conv-prev').onchange = () => coletar.atualizar();
      const cx = el.querySelector('#conv-pix');
      if (cx) {
        let jaMarcou = false;
        const ajustarPix = () => { const ehPix = coletar.forma() === 'pix'; cx.disabled = !ehPix;
          if (ehPix && !jaMarcou) { cx.checked = true; jaMarcou = true; }
          el.querySelector('#conv-pix-dica').textContent = ehPix ? 'Desmarque se o cliente não vai pagar à vista.' : 'O orçamento ofereceu o desconto no Pix. Escolha a forma Pix para usar.';
          el.querySelector('#conv-total').textContent = brl(pixAtivo() ? o.valor_pix : o.valor_total); coletar.atualizar(); };
        el.querySelector('[data-fp-raiz]').addEventListener('fp-forma', ajustarPix);
        cx.onchange = ajustarPix; ajustarPix();
      }
      ent = ligarEntrega(el.querySelector('#conv-ent'));
      if (!o.forma_entrega) ent.definirCliente(cliente);
    } });
  m.el.querySelector('[data-v]').onclick = m.fechar;
  const bt = m.el.querySelector('[data-s]');
  bt.onclick = async () => {
    const prev = $('#conv-prev', m.el).value; if (!prev) return toast('Informe a previsão de entrega.', true);
    let pag; try { pag = await coletar(); } catch (e) { if (e.message !== 'upload' && e.message !== 'tamanho') toast(e.message, true); return; }
    const status_itens = itens.map((_, k) => m.el.querySelector(`[data-st="${k}"]`).value);
    bt.disabled = true;
    try {
      const r = await api('converter_orcamento', { id: o.id, cliente_id: o.cliente_id ? undefined : cliente.id, status_itens,
        data_prevista_entrega: prev, forma_entrega: ent.forma(), endereco_entrega: ent.endereco(), recebimentos: pag.recebimentos,
        forma_pagamento: pag.forma_pagamento, forma_pagamento_obs: pag.forma_pagamento_obs, desconto_pix: pixAtivo(),
        autoriza_sem_pagamento: pag.autoriza_sem_pagamento, condicoes_pagamento: pag.resumo });
      m.fechar(); await anexarComprovantes(pag, r); toast(`Pedido ${r.numero} criado.`); descartarVista('orcamento/' + o.id); location.hash = '#/pedido/' + r.id;
    } finally { bt.disabled = false; }
  };
}

rota('orcamentos', async (_p, el) => {
  definirTopoEm(el, 'Orçamentos', `<a class="btn prim" href="#/orcamento/novo">Novo orçamento</a>`);
  el.innerHTML = `<div class="painel filtros"><div class="linha-form">
      <label class="campo" style="flex:2">Buscar<input type="search" id="o-busca" placeholder="Número ou cliente"></label>
      <label class="campo">Situação<select id="o-status"><option value="">Em andamento</option><option value="todos">Todas</option><option value="aberto">Em elaboração</option><option value="enviado">Enviado</option><option value="aceito">Aprovado pelo cliente</option><option value="aprovado">Virou pedido</option><option value="recusado">Recusado</option><option value="expirado">Expirado</option></select></label>
      <label class="campo">Vendedor<select id="o-vend"><option value="">Todos</option>${S.base.vendedores.map(v => `<option value="${v.id}">${esc(v.nome)}</option>`).join('')}</select></label>
    </div><div class="small muted" style="margin-top:6px">Em andamento = em elaboração, enviados e aprovados pelo cliente. A busca procura em todos.</div></div><div class="painel" id="o-lista"></div>`;
  const lista = {};
  const botoes = o => o.pedido_id
    ? `<a class="btn peq" href="#/pedido/${o.pedido_id}">Ver pedido${o.pedido_numero ? ' ' + esc(o.pedido_numero) : ''}</a> <button class="btn peq" data-acao="imprimir" data-id="${o.id}">Imprimir</button>`
    : `<button class="btn peq" data-acao="link" data-id="${o.id}">Link para o cliente</button>
       <button class="btn peq" data-acao="imprimir" data-id="${o.id}">Imprimir</button>
       <button class="btn peq escuro" data-acao="converter" data-id="${o.id}">Transformar em pedido</button>
       ${podeExcluirOrc(o) ? `<button class="btn peq perigo" data-acao="excluir" data-id="${o.id}">Excluir</button>` : ''}`;
  const buscar = async () => {
    const r = await api('listar_orcamentos', { busca: $('#o-busca', el).value, status: $('#o-status', el).value, vendedor_id: $('#o-vend', el).value, limite: limLista('orcamentos') });
    r.orcamentos.forEach(o => lista[o.id] = o);
    $('#o-lista', el).innerHTML = r.orcamentos.length ? `<div class="tabela-wrap"><table><thead><tr><th>Orçamento</th><th>Cliente</th><th>Vendedor</th><th>Validade</th><th>Situação</th><th class="dir">Total</th><th>Ações</th></tr></thead><tbody>
      ${r.orcamentos.map(o => `<tr class="clicavel" data-abrir="${o.id}"><td><b>${esc(o.numero)}</b><div class="small muted">${data(o.created_at)}</div></td>
        <td>${esc(o.cliente_nome || '—')}${o.cliente_generico ? ' ' + badge('Sem cadastro', 'b-ambar') : ''}</td><td>${esc(o.vendedor_nome || '')}</td><td>${data(o.validade)}${o.vencido ? ' ' + badge('Vencido', 'b-vermelho') : o.validade === hoje() && ['aberto','enviado'].includes(o.status) ? ' ' + badge('Vence hoje', 'b-ambar') : ''}</td>
        <td>${badge(...(ORC_NOMES[o.status] || [o.status, 'b-cinza']))}</td><td class="dir num">${brl(o.valor_total)}</td>
        <td><div style="display:flex;gap:4px;flex-wrap:wrap;min-width:230px">${botoes(o)}</div></td></tr>`).join('')}</tbody></table></div>`
      : '<div class="vazio">Nenhum orçamento encontrado.</div>';
    $('#o-lista', el).insertAdjacentHTML('beforeend', rodapeLista('orcamentos', r.orcamentos.length, r.total, 'orçamento(s)'));
    ligarMais($('#o-lista', el), 'orcamentos', buscar);
    $('#o-lista', el).querySelectorAll('[data-abrir]').forEach(tr => tr.onclick = e => { if (!e.target.closest('button,a')) location.hash = '#/orcamento/' + tr.dataset.abrir; });
    $('#o-lista', el).querySelectorAll('[data-acao]').forEach(b => b.onclick = async e => {
      e.stopPropagation();
      const o = lista[b.dataset.id];
      b.disabled = true;
      try {
        if (b.dataset.acao === 'link') await linkOrcamento(o.id);
        else if (b.dataset.acao === 'imprimir') await imprimirOrcamentoId(o.id);
        else if (b.dataset.acao === 'converter') await converterOrcamento(o.id);
        else if (b.dataset.acao === 'excluir' && await excluirOrcamento(o.id, o.numero)) buscar();
      } catch {} finally { b.disabled = false; }
    });
  };
  const filtrar = () => { zerarLista('orcamentos'); buscar(); };
  let t; $('#o-busca', el).oninput = () => { clearTimeout(t); t = setTimeout(filtrar, 350); }; $('#o-status', el).onchange = $('#o-vend', el).onchange = filtrar;
  await buscar();
});

rota('orcamento', async (id, el) => {
  const novo = id === 'novo';
  const o = novo ? { itens: [], desconto: 0, frete: 0, status: 'aberto', validade: somaDias(hoje(), 7) } : (await api('obter_orcamento', { id })).orcamento;
  if (!o) throw new Error('Orçamento não encontrado (pode ter sido excluído).');
  const convertido = o.status === 'aprovado';
  const aceito = o.status === 'aceito';
  const liberado = aceito && (S.cache.editarAceito || {})[o.id];
  const travado = convertido || (aceito && !liberado);
  definirTopoEm(el, novo ? 'Novo orçamento' : `Orçamento ${o.numero}`, `<a class="btn" href="#/orcamentos">Voltar</a>
    ${!novo && !convertido ? `<button class="btn" id="o-link">Link para o cliente</button>` : ''}
    ${!novo ? `<button class="btn" id="o-imprimir">Imprimir orçamento</button>` : ''}
    ${!novo && podeExcluirOrc(o) ? `<button class="btn perigo" id="o-excluir">Excluir orçamento</button>` : ''}
    ${!novo && !convertido ? `<button class="btn escuro" id="o-converter">Transformar em pedido</button>` : ''}
    ${o.pedido_id ? `<a class="btn" href="#/pedido/${o.pedido_id}">Ver pedido</a>` : ''}`);
  let cliente = o.cliente || null, pegarItens;
  el.innerHTML = `
    ${convertido ? '<div class="alerta" style="margin-bottom:16px">Este orçamento já virou pedido e não pode mais ser alterado.</div>' : ''}
    ${aceito ? `<div class="alerta" style="margin-bottom:16px;background:var(--verde-bg);color:var(--grafite)">
        <b>Aprovado pelo cliente</b> · ${esc(o.aprovado_cliente_nome || '')} em ${dataHoraLonga(o.aprovado_cliente_em)}
        ${o.aprovado_cliente_comentario ? `<div style="margin-top:4px"><span class="muted">Comentário do cliente:</span> ${esc(o.aprovado_cliente_comentario)}</div>` : ''}
        ${o.cadastro_pendente ? `<div style="margin-top:8px"><b>O cliente enviou o cadastro pelo link.</b> Confira e aprove o cadastro para transformar em pedido.
          ${pode('cadastra_clientes') ? ' <button type="button" class="btn peq prim" id="o-conf-cad">Conferir cadastro</button>' : ''}</div>` : ''}
        ${!liberado ? `<div style="margin-top:8px"><button type="button" class="btn peq" id="o-editar-aceito">Editar orçamento</button> <span class="small muted">Se for alterado, o cliente precisa aprovar de novo.</span></div>` : '<div class="small" style="margin-top:6px"><b>Ao salvar, a aprovação do cliente será desfeita.</b></div>'}</div>` : ''}
    <div class="painel"><div class="painel-cab"><h2>Cliente</h2></div>
      <label class="campo busca-box">Buscar cliente<input type="search" id="o-cli" placeholder="Nome, fantasia, CPF/CNPJ" autocomplete="off" ${travado ? 'disabled' : ''}></label>
      <label class="campo" id="o-cli-nome-box" style="margin-top:10px">Ou apenas o nome do cliente (sem cadastro)<input type="text" id="o-cli-nome" value="${esc(o.cliente_nome || '')}" ${travado ? 'disabled' : ''}></label>
      <div id="o-cli-esc" style="margin-top:10px"></div></div>
    <div class="painel"><div class="painel-cab"><h2>Itens</h2></div><div id="o-itens"></div>
      <div class="grade g4" style="margin-top:14px">
        ${htmlDesconto('o-desc', o)}
        <label class="campo">Frete (R$)<input type="number" step="0.01" id="o-frete" value="${esc(o.frete)}"></label>
        <label class="check" style="align-self:end;padding-bottom:9px;white-space:normal"><input type="checkbox" id="o-pix" ${o.desconto_pix ? 'checked' : ''}> Oferecer ${PIX_PCT}% de desconto no Pix à vista</label>
        <div class="totais" style="margin:0"><span class="muted small">Total</span><b class="num" id="o-total"></b><span class="small muted" id="o-total-pix"></span></div></div></div>
    <div class="painel"><form id="f-orc" class="grade g3">
      <label class="campo">Validade<input type="date" name="validade" value="${esc(o.validade || '')}"></label>
      <label class="campo">Situação<select name="status" ${travado ? 'disabled' : ''}>${[['aberto','Em elaboração'],['enviado','Enviado ao cliente'],['recusado','Recusado'],['expirado','Expirado']].map(([v, n]) => `<option value="${v}" ${o.status === v ? 'selected' : ''}>${n}</option>`).join('')}${convertido ? '<option value="aprovado" selected>Virou pedido</option>' : ''}${aceito && !liberado ? '<option value="aceito" selected>Aprovado pelo cliente</option>' : ''}</select></label>
      <label class="campo">Prazo (dias úteis) <span class="muted small">— opcional</span><input type="number" min="1" max="365" name="prazo_dias_uteis" value="${esc(o.prazo_dias_uteis || '')}" placeholder="Ex.: 5"></label>
      <div class="small muted" style="grid-column:1/-1;margin-top:4px"><b>Entrega</b></div>
      ${htmlEntrega(o)}
      <label class="campo" style="grid-column:1/-1">Observações da entrega <span class="muted">(aparecem no orçamento do cliente)</span><textarea name="observacoes_entrega">${esc(o.observacoes_entrega || '')}</textarea></label>
    </form></div>
    <div class="painel"><div class="painel-cab"><h2>Forma de Pagamento</h2><span class="small muted">Opcional no orçamento${o.condicoes_pagamento && !o.forma_pagamento ? ` · antes: ${esc(o.condicoes_pagamento)}` : ''}</span></div>
      <div id="o-pag">${htmlFormaPagamento({ orcamento: true })}</div></div>
    <div class="painel"><label class="campo">Observação geral <span class="muted small">(aparece para o cliente)</span><textarea id="o-obs-geral" ${travado ? 'disabled' : ''}>${esc(o.observacoes || '')}</textarea></label></div>
    ${!travado ? `<div style="display:flex;justify-content:flex-end;margin-top:16px"><button class="btn prim" id="o-salvar">Salvar orçamento</button></div>` : ''}`;
  const entOrc = ligarEntrega($('#f-orc', el));
  const mostrarCli = c => { cliente = c; if (c && !travado) entOrc.definirCliente(c); $('#o-cli-esc', el).innerHTML = c ? `<b>${esc(c.nome_fantasia || c.nome)}</b> <span class="muted">${esc(fmtDoc(c.cpf_cnpj))}</span>${!travado ? ' <button type="button" class="btn link peq" id="o-cli-limpar">Trocar</button>' : ''}${c.observacoes ? `<div class="alerta" style="margin-top:6px"><b>Observação do cliente:</b> ${esc(c.observacoes)}</div>` : ''}` : '<span class="muted small">Nenhum cliente cadastrado escolhido.</span>'; $('#o-cli', el).value = '';
    $('#o-cli-nome-box', el).classList.toggle('hidden', !!c); if (c) $('#o-cli-nome', el).value = '';
    const lp = $('#o-cli-limpar', el); if (lp) lp.onclick = () => mostrarCli(null); };
  mostrarCli(cliente); ligarBuscaCliente($('#o-cli', el), mostrarCli);
  let descO;
  const somaO = () => (pegarItens ? pegarItens() : o.itens).reduce((s, i) => s + Number(i.valor_total || 0), 0);
  const totOrc = () => somaO() - (descO ? descO.valor() : 0) + Number($('#o-frete', el).value || 0);
  const tot = () => { $('#o-total', el).textContent = brl(totOrc()); if (descO) descO.atualizar();
    $('#o-total-pix', el).textContent = $('#o-pix', el).checked ? `ou ${brl(totOrc() - valorPix(somaO(), descO ? descO.valor() : 0))} no Pix à vista` : ''; };
  pegarItens = editorItens($('#o-itens', el), o.itens, { aoMudar: tot });
  const pagOrc = ligarFormaPagamento($('#o-pag', el), totOrc, () => '', { forma: o.forma_pagamento, obs: o.forma_pagamento_obs, detalhe: o.pagamento_detalhe });
  if (travado) $$('#o-itens input, #o-itens select, #o-itens button, #f-orc input, #f-orc textarea, #f-orc button, #o-pag input, #o-pag button, #o-desc, #o-frete, #o-pix, [data-desc-tipo] button, #o-cli, #o-cli-nome', el).forEach(e => e.disabled = true);
  if ($('#o-editar-aceito', el)) $('#o-editar-aceito', el).onclick = () => { (S.cache.editarAceito ||= {})[o.id] = true; renderVista(S.vistaAtual); };
  $('#o-frete', el).oninput = tot;
  descO = ligarDesconto(el, 'o-desc', somaO, tot);
  $('#o-pix', el).onchange = tot; tot();
  if ($('#o-conf-cad', el)) $('#o-conf-cad', el).onclick = () => abrirConferenciaCadastro(o.cadastro_pendente);
  const salvar = async () => {
    if (pegarItens.incompletos()) { toast('Há item sem categoria, produto, quantidade ou total. Complete ou remova a linha.', true); throw new Error('itens'); }
    try { descO.validar(); } catch (e) { toast(e.message, true); throw e; }
    if (descO.valor() > somaO() + 0.009) { toast('O desconto não pode ser maior que o valor dos itens.', true); throw new Error('desconto'); }
    let pag; try { pag = await pagOrc(); } catch (e) { toast(e.message, true); throw e; }
    const d = { ...formDados($('#f-orc', el)), observacoes: $('#o-obs-geral', el).value, cliente_id: cliente?.id || '', cliente_nome: cliente ? '' : $('#o-cli-nome', el).value.trim(), itens: pegarItens(), ...descO.dados(), desconto_pix: $('#o-pix', el).checked, frete: $('#o-frete', el).value,
      forma_pagamento: pag?.forma_pagamento || '', forma_pagamento_obs: pag?.forma_pagamento_obs || '', pagamento_detalhe: pag?.pagamento_detalhe || null,
      condicoes_pagamento: pag ? pag.resumo : '' };
    if (!d.cliente_id && !d.cliente_nome) { toast('Escolha um cliente ou informe o nome dele.', true); throw new Error('cliente'); }
    if (!novo) d.id = o.id;
    if (d.status === 'aceito') d.status = 'aberto';
    const r = await api('salvar_orcamento', d); toast(`Orçamento ${r.numero} salvo.`);
    if (S.cache.editarAceito) delete S.cache.editarAceito[o.id];
    return r;
  };
  // botão do topo: liga pelo próprio elemento guardado no topo (funciona mesmo depois de sair e voltar para a tela)
  const noTopo = sel => (vistaDoEl(el).topo?.nos || []).find(n => n.matches && n.matches(sel));
  const acao = (sel, fn) => { const b = noTopo(sel); if (b) b.onclick = async () => { b.disabled = true; try { await fn(); } catch {} finally { b.disabled = false; } }; };
  const salvarSeEditavel = async () => { if (!travado) await salvar(); };
  if ($('#o-salvar', el)) $('#o-salvar', el).onclick = async () => {
    const b = $('#o-salvar', el); b.disabled = true;
    try { await salvar(); descartarVista(chaveDe(vistaDoEl(el)) || chaveRota()); location.hash = '#/orcamentos'; } catch {} finally { b.disabled = false; }
  };
  acao('#o-link', async () => { await salvarSeEditavel(); await linkOrcamento(o.id); });
  acao('#o-imprimir', async () => { await salvarSeEditavel(); await imprimirOrcamentoId(o.id); });
  acao('#o-converter', async () => { await salvarSeEditavel(); await converterOrcamento(o.id); });
  acao('#o-excluir', async () => { if (await excluirOrcamento(o.id, o.numero)) location.hash = '#/orcamentos'; });
});

const dataHoraLonga = v => v ? new Date(v).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }).replace(',', ' às') : '—';
const linkPublicoOrc = chave => location.origin + location.pathname + '#/o/' + chave;
function modalLinkOrcamento(o, cliente) {
  const link = linkPublicoOrc(o.chave);
  const tel = cliente ? String(cliente.whatsapp || (cliente.telefone_whatsapp ? cliente.telefone : '') || '').replace(/\D/g, '') : '';
  const nome = cliente ? (cliente.nome_fantasia || cliente.nome) : (o.cliente_nome || '');
  const texto = `Olá${nome ? ', ' + nome.split(' ')[0] : ''}! Segue o orçamento nº ${o.numero} da Gráfica Venda Hoje. Você pode conferir e aprovar por este link: ${link}`;
  const m = abrirModal({ titulo: `Link do orçamento ${o.numero}`, corpo: `
    <p style="margin:0 0 10px">O cliente abre o orçamento sem precisar de login.${o.cliente_id ? ' Ele aprova informando o nome.' : ' Como ainda não tem cadastro, ele preenche o cadastro para aprovar (a GVH confere o cadastro antes de virar pedido).'} A aprovação (quem, data e hora) aparece aqui no orçamento e no Início.</p>
    <div style="display:flex;gap:6px"><input type="text" readonly value="${esc(link)}" id="lk-url" style="flex:1"><button class="btn" id="lk-copiar">Copiar</button></div>
    ${o.validade ? `<p class="small muted" style="margin:8px 0 0">Válido até ${data(o.validade)}. Depois disso o cliente não consegue mais aprovar.</p>` : ''}`,
    rodape: `<button class="btn" data-v>Fechar</button><a class="btn prim" target="_blank" rel="noopener" href="https://wa.me/${tel}?text=${encodeURIComponent(texto)}">Enviar pelo WhatsApp</a>` });
  m.el.querySelector('[data-v]').onclick = m.fechar;
  m.el.querySelector('#lk-copiar').onclick = async () => { try { await navigator.clipboard.writeText(link); toast('Link copiado.'); } catch { $('#lk-url', m.el).select(); } };
}

/* ---------- DOCUMENTO DO ORÇAMENTO (PDF) ---------- */
// Dados da GVH que saem no cabeçalho e no rodapé do orçamento
const EMPRESA = {
  nome: 'Gráfica Venda Hoje',
  cnpj: '52.570.432/0001-31',
  endereco: 'Av. General Pedro Pinho, 438 · Pestana · Osasco/SP · CEP 06180-180',
  telefone: '(11) 98456-6956',
  email: 'diretoria@gvh.com.br',
  site: 'gvh.com.br',
  condicoes_gerais: 'Valores válidos até a data de validade. A produção começa após a aprovação da arte e a confirmação do pagamento combinado. Prazos contados em dias úteis a partir da entrada em produção.'
};
// V24: resumo do pedido para mostrar ao cliente (sem custos, fornecedor ou observações internas)
const ETAPA_CLIENTE = { arte_a_fazer: 'Criação da arte', arte_em_alteracao: 'Ajustes na arte', arte_em_aprovacao: 'Arte com você para aprovação',
  pre_impressao: 'Preparando para produção', em_producao: 'Em produção', despachado: 'Em produção', expedicao: 'Pronto',
  em_transporte: 'Saiu para entrega', aguardando_retirada: 'Pronto para retirada', entregue: 'Entregue' };
function imprimirResumoPedido() {
  const p = S.vistaAtual.dados, c = p.cliente || {};
  const din = v => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const dataBR = iso => iso ? new Date(String(iso).slice(0, 10) + 'T12:00:00').toLocaleDateString('pt-BR') : '';
  const valores = pode('ve_valores');
  const itens = (p.itens || []).filter(i => i.status !== 'cancelado');
  const nomeCli = c.nome_fantasia || c.nome || '';
  const linhasCli = [c.nome_fantasia ? c.nome : '', c.cpf_cnpj ? `${c.tipo_pessoa === 'PF' ? 'CPF' : 'CNPJ'} ${fmtDoc(c.cpf_cnpj)}` : '',
    [c.telefone ? fmtTel(c.telefone) : '', c.email].filter(Boolean).join(' · ')].filter(Boolean);
  const empresaLinhas = [EMPRESA.cnpj && 'CNPJ ' + EMPRESA.cnpj, EMPRESA.endereco, [EMPRESA.telefone, p.vendedor_email || EMPRESA.email].filter(Boolean).join(' · '), EMPRESA.site].filter(Boolean);
  const ent = p.forma_entrega === 'entrega' ? `Entrega no endereço: ${p.endereco_entrega || 'a combinar'}` : `Retirada no balcão: ${EMPRESA.endereco}`;
  const pago = Number(p.valor_pago || 0), aberto = Number(p.valor_em_aberto || 0);
  const logo = $('#logo-gvh', document)?.src || '';
  const titulo = `Pedido ${p.numero} - ${nomeCli}`.replace(/[\\/:*?"<>|]/g, '');
  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>${esc(titulo)}</title>
<link href="https://fonts.googleapis.com/css2?family=Sora:wght@300;400;600;700&display=swap" rel="stylesheet">
<style>
  @page { size: A4; margin: 14mm 14mm 16mm; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font-family: Sora, Arial, sans-serif; color: #1d262d; font-size: 10.5pt; margin: 0; }
  .topo { display: flex; justify-content: space-between; align-items: flex-start; gap: 20px; padding-bottom: 14px; border-bottom: 3px solid #00a986; }
  .topo img { height: 58px; } .emp { text-align: right; font-size: 8.5pt; color: #5a6770; line-height: 1.5; } .emp b { color: #1d262d; font-size: 10pt; }
  .titulo { display: flex; justify-content: space-between; align-items: flex-end; margin: 18px 0 14px; }
  .titulo h1 { margin: 0; font-size: 20pt; font-weight: 700; letter-spacing: .5px; } .titulo h1 span { color: #00a986; }
  .datas { text-align: right; font-size: 9pt; color: #5a6770; line-height: 1.6; } .datas b { color: #1d262d; }
  .caixa { background: #f6f6f6; border-radius: 8px; padding: 12px 14px; margin-bottom: 16px; }
  .rot { font-size: 7.5pt; text-transform: uppercase; letter-spacing: 1px; color: #8a959c; margin-bottom: 4px; font-weight: 600; }
  .cli b { font-size: 11.5pt; } .cli div { font-size: 9pt; color: #5a6770; margin-top: 2px; }
  table { width: 100%; border-collapse: collapse; } thead { display: table-header-group; }
  th { background: #1d262d; color: #fff; font-size: 8pt; text-transform: uppercase; letter-spacing: .6px; text-align: left; padding: 8px 10px; font-weight: 600; }
  th.n, td.n { text-align: right; white-space: nowrap; } td { padding: 9px 10px; border-bottom: 1px solid #e2e6e8; vertical-align: top; } tr { page-break-inside: avoid; }
  .etapa { display: inline-block; font-size: 8.5pt; padding: 2px 8px; border-radius: 10px; background: #e3f6f1; color: #00795f; font-weight: 600; white-space: nowrap; }
  .totais { margin: 12px 0 0 auto; width: 300px; font-size: 10pt; } .totais div { display: flex; justify-content: space-between; padding: 4px 10px; }
  .totais .final { background: #00a986; color: #fff; border-radius: 6px; font-size: 13pt; font-weight: 700; padding: 9px 10px; margin-top: 6px; }
  .grade { display: flex; gap: 16px; margin-top: 18px; } .grade > div { flex: 1; }
  .bloco { margin-top: 18px; page-break-inside: avoid; } .bloco p { margin: 0; font-size: 9.5pt; white-space: pre-wrap; }
  .rodape { margin-top: 26px; padding-top: 10px; border-top: 1px solid #e2e6e8; font-size: 8pt; color: #8a959c; display: flex; justify-content: space-between; }
</style></head><body>
  <div class="topo">${logo ? `<img src="${logo}" alt="GVH">` : `<b>${esc(EMPRESA.nome)}</b>`}
    <div class="emp"><b>${esc(EMPRESA.nome)}</b>${empresaLinhas.map(l => `<br>${esc(l)}`).join('')}</div></div>
  <div class="titulo"><h1>PEDIDO <span>Nº ${esc(p.numero)}</span></h1>
    <div class="datas">Feito em <b>${dataBR(p.created_at)}</b>${p.data_prevista_entrega ? `<br>Previsão de entrega <b>${dataBR(p.data_prevista_entrega)}</b>` : ''}${p.vendedor_nome ? `<br>Atendimento: <b>${esc(p.vendedor_nome)}</b>` : ''}<br>Resumo emitido em ${new Date().toLocaleDateString('pt-BR')}</div></div>
  <div class="caixa cli"><div class="rot">Cliente</div><b>${esc(nomeCli)}</b>${linhasCli.map(l => `<div>${esc(l)}</div>`).join('')}</div>
  <table><thead><tr><th style="width:28px">#</th><th>Descrição</th><th class="n" style="width:70px">Qtd.</th>${valores ? '<th class="n" style="width:100px">Unitário</th><th class="n" style="width:110px">Total</th>' : ''}<th style="width:150px">Andamento</th></tr></thead>
    <tbody>${itens.map((i, k) => `<tr><td>${k + 1}</td><td><b>${esc(i.descricao)}</b></td><td class="n">${num(i.quantidade)}</td>
      ${valores ? `<td class="n">${unitario(i.valor_total, i.quantidade)}</td><td class="n">${din(i.valor_total)}</td>` : ''}
      <td><span class="etapa">${esc(ETAPA_CLIENTE[i.status] || nomeStatusItem(i.status))}</span></td></tr>`).join('')}</tbody></table>
  ${valores ? `<div class="totais">
    ${Number(p.desconto) || Number(p.frete) || Number(p.desconto_pix_valor) ? `<div><span>Subtotal</span><span>${din(p.valor_itens)}</span></div>` : ''}
    ${Number(p.desconto) ? `<div><span>${rotDesconto(p)}</span><span>- ${din(p.desconto)}</span></div>` : ''}
    ${Number(p.desconto_pix_valor) ? `<div><span>Pix à vista (${PIX_PCT}%)</span><span>- ${din(p.desconto_pix_valor)}</span></div>` : ''}
    ${Number(p.frete) ? `<div><span>Frete</span><span>${din(p.frete)}</span></div>` : ''}
    <div class="final"><span>Total</span><span>${din(p.valor_total)}</span></div>
    ${p.valor_pago != null ? `<div><span>Pago</span><span>${din(pago)}</span></div><div><b>Em aberto</b><b>${din(aberto)}</b></div>` : ''}</div>` : ''}
  <div class="grade">
    <div class="bloco"><div class="rot">Entrega</div><p>${esc(ent)}</p>${p.observacoes ? `<p style="margin-top:4px">${esc(p.observacoes)}</p>` : ''}</div>
    ${p.forma_pagamento || p.condicoes_pagamento ? `<div class="bloco"><div class="rot">Forma de pagamento</div><p>${esc(p.condicoes_pagamento || FORMAS_COMB[p.forma_pagamento] || '')}</p></div>` : ''}
  </div>
  ${p.observacao_geral ? `<div class="bloco"><div class="rot">Observações</div><p>${esc(p.observacao_geral)}</p></div>` : ''}
  <div class="bloco"><div class="rot">Importante</div><p>A produção começa após a aprovação da arte e a confirmação do pagamento combinado. A previsão de entrega pode mudar se a arte ou o pagamento atrasarem.</p></div>
  <div class="rodape"><span>${esc(EMPRESA.nome)}${EMPRESA.site ? ' · ' + esc(EMPRESA.site) : ''}</span><span>Pedido nº ${esc(p.numero)}</span></div>
</body></html>`;
  abrirImpressao(html, titulo);
}
function imprimirOrcamento(o) {
  const c = o.cliente;
  const dataBR = iso => iso ? new Date(String(iso).slice(0, 10) + 'T12:00:00').toLocaleDateString('pt-BR') : '';
  const din = v => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const unit = (t, q) => Number(q) > 0 ? (Number(t) / Number(q)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 4 }) : '';
  const nomeProd = id => S.base.produtos.find(p => p.id === id)?.nome || '';
  const vendedor = o.vendedor_nome || S.base.vendedores.find(v => v.id === o.vendedor_id)?.nome || '';
  const nomeCli = c ? (c.nome_fantasia || c.nome) : (o.cliente_nome || '');
  const linhasCli = c ? [
      c.nome_fantasia ? c.nome : '',
      c.cpf_cnpj ? `${c.tipo_pessoa === 'PF' ? 'CPF' : 'CNPJ'} ${fmtDoc(c.cpf_cnpj)}` : '',
      [c.telefone ? fmtTel(c.telefone) : '', c.email].filter(Boolean).join(' · '),
      enderecoCliente(c)
    ].filter(Boolean) : [];
  const empresaLinhas = [EMPRESA.cnpj && 'CNPJ ' + EMPRESA.cnpj, EMPRESA.endereco, [EMPRESA.telefone, o.vendedor_email || EMPRESA.email].filter(Boolean).join(' · '), EMPRESA.site].filter(Boolean);
  const logo = $('#logo-gvh', document)?.src || '';
  const titulo = `Orçamento ${o.numero} - ${nomeCli}`.replace(/[\\/:*?"<>|]/g, '');
  const itens = o.itens || [];
  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>${esc(titulo)}</title>
<link href="https://fonts.googleapis.com/css2?family=Sora:wght@300;400;600;700&display=swap" rel="stylesheet">
<style>
  @page { size: A4; margin: 14mm 14mm 16mm; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font-family: Sora, Arial, sans-serif; color: #1d262d; font-size: 10.5pt; margin: 0; }
  .topo { display: flex; justify-content: space-between; align-items: flex-start; gap: 20px; padding-bottom: 14px; border-bottom: 3px solid #00a986; }
  .topo img { height: 58px; }
  .emp { text-align: right; font-size: 8.5pt; color: #5a6770; line-height: 1.5; }
  .emp b { color: #1d262d; font-size: 10pt; }
  .titulo { display: flex; justify-content: space-between; align-items: flex-end; margin: 18px 0 14px; }
  .titulo h1 { margin: 0; font-size: 20pt; font-weight: 700; letter-spacing: .5px; }
  .titulo h1 span { color: #00a986; }
  .datas { text-align: right; font-size: 9pt; color: #5a6770; line-height: 1.6; }
  .datas b { color: #1d262d; }
  .caixa { background: #f6f6f6; border-radius: 8px; padding: 12px 14px; margin-bottom: 16px; }
  .rot { font-size: 7.5pt; text-transform: uppercase; letter-spacing: 1px; color: #8a959c; margin-bottom: 4px; font-weight: 600; }
  .cli b { font-size: 11.5pt; } .cli div { font-size: 9pt; color: #5a6770; margin-top: 2px; }
  table { width: 100%; border-collapse: collapse; }
  thead { display: table-header-group; }
  th { background: #1d262d; color: #fff; font-size: 8pt; text-transform: uppercase; letter-spacing: .6px; text-align: left; padding: 8px 10px; font-weight: 600; }
  th.n, td.n { text-align: right; white-space: nowrap; }
  td { padding: 9px 10px; border-bottom: 1px solid #e2e6e8; vertical-align: top; }
  tr { page-break-inside: avoid; }
  td .prod { font-weight: 600; } td .desc { font-size: 9pt; color: #5a6770; margin-top: 2px; }
  .totais { margin: 12px 0 0 auto; width: 280px; font-size: 10pt; }
  .totais div { display: flex; justify-content: space-between; padding: 4px 10px; }
  .totais .final { background: #00a986; color: #fff; border-radius: 6px; font-size: 13pt; font-weight: 700; padding: 9px 10px; margin-top: 6px; }
  .bloco { margin-top: 18px; page-break-inside: avoid; } .bloco p { margin: 0; font-size: 9.5pt; white-space: pre-wrap; }
  .rodape { margin-top: 26px; padding-top: 10px; border-top: 1px solid #e2e6e8; font-size: 8pt; color: #8a959c; display: flex; justify-content: space-between; }
</style></head><body>
  <div class="topo">
    ${logo ? `<img src="${logo}" alt="GVH">` : `<b>${esc(EMPRESA.nome)}</b>`}
    <div class="emp"><b>${esc(EMPRESA.nome)}</b>${empresaLinhas.map(l => `<br>${esc(l)}`).join('')}</div>
  </div>
  <div class="titulo">
    <h1>ORÇAMENTO <span>Nº ${esc(o.numero)}</span></h1>
    <div class="datas">Emitido em <b>${dataBR(o.updated_at || o.created_at)}</b>${o.validade ? `<br>Válido até <b>${dataBR(o.validade)}</b>` : ''}${vendedor ? `<br>Atendimento: <b>${esc(vendedor)}</b>` : ''}</div>
  </div>
  <div class="caixa cli"><div class="rot">Cliente</div><b>${esc(nomeCli)}</b>${linhasCli.map(l => `<div>${esc(l)}</div>`).join('')}</div>
  <table>
    <thead><tr><th style="width:28px">#</th><th>Descrição</th><th class="n" style="width:70px">Qtd.</th><th class="n" style="width:100px">Unitário</th><th class="n" style="width:110px">Total</th></tr></thead>
    <tbody>${itens.map((i, k) => {
      return `<tr><td>${k + 1}</td><td><div class="prod">${esc(i.descricao || nomeProd(i.produto_id))}</div></td>
        <td class="n">${num(i.quantidade)}</td><td class="n">${unit(i.valor_total, i.quantidade)}</td><td class="n">${din(i.valor_total)}</td></tr>`;
    }).join('')}</tbody>
  </table>
  <div class="totais">
    ${Number(o.desconto) || Number(o.frete) ? `<div><span>Subtotal</span><span>${din(o.valor_itens)}</span></div>` : ''}
    ${Number(o.desconto) ? `<div><span>${rotDesconto(o)}</span><span>- ${din(o.desconto)}</span></div>` : ''}
    ${Number(o.frete) ? `<div><span>Frete</span><span>${din(o.frete)}</span></div>` : ''}
    <div class="final"><span>Total</span><span>${din(o.valor_total)}</span></div>
    ${o.desconto_pix && o.valor_pix != null ? `<div style="color:#00795f;font-weight:700;margin-top:4px"><span>À vista no Pix (${PIX_PCT}% off)</span><span>${din(o.valor_pix)}</span></div>` : ''}
  </div>
  ${freteGratis(o) ? `<div style="text-align:right">${SELO_FRETE}</div>` : ''}
  ${blocosProposta(o)}
  ${o.condicoes_pagamento ? `<div class="bloco"><div class="rot">Forma de pagamento</div><p>${esc(o.condicoes_pagamento)}</p></div>` : ''}
  ${o.observacoes ? `<div class="bloco"><div class="rot">Observações</div><p>${esc(o.observacoes)}</p></div>` : ''}
  ${EMPRESA.condicoes_gerais ? `<div class="bloco"><div class="rot">Condições gerais</div><p>${esc(EMPRESA.condicoes_gerais)}</p></div>` : ''}
  <div class="rodape"><span>${esc(EMPRESA.nome)}${EMPRESA.site ? ' · ' + esc(EMPRESA.site) : ''}</span><span>Orçamento nº ${esc(o.numero)}</span></div>
</body></html>`;
  abrirImpressao(html, titulo);
}
function abrirImpressao(html, titulo) {
  document.getElementById('frame-impressao')?.remove();
  const fr = document.createElement('iframe'); fr.id = 'frame-impressao';
  fr.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
  document.body.appendChild(fr);
  fr.onload = async () => {
    const w = fr.contentWindow;
    try { await w.document.fonts.ready; } catch {}
    const tituloOriginal = document.title; document.title = titulo;
    setTimeout(() => { w.focus(); w.print(); setTimeout(() => { document.title = tituloOriginal; }, 1000); }, 150);
  };
  fr.srcdoc = html;
}

