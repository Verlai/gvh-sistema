/* ---------- CATEGORIAS (sugestão pelo que o vendedor escreve) ---------- */
const normTxt = t => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const catsAtivas = () => (S.base.categorias || []).filter(c => c.ativo);
function sugerirCategorias(texto, max = 3) {
  const t = normTxt(texto); if (t.length < 3) return [];
  const tt = ' ' + t + ' ';
  const res = [];
  for (const c of catsAtivas()) {
    let melhor = 0;
    for (const a0 of [c.nome, ...(c.apelidos || [])]) {
      const a = normTxt(a0); if (!a) continue;
      let sc = 0;
      if (a === t) sc = 1000;
      else if (tt.includes(' ' + a + ' ')) sc = 100 + a.length;   // o apelido aparece no texto ("folder 3 dobras")
      else if (a.startsWith(t)) sc = 20 + t.length;             // o texto é o começo do apelido ("panf")
      if (sc > melhor) melhor = sc;
    }
    if (melhor) res.push({ c, sc: melhor });
  }
  return res.sort((x, y) => y.sc - x.sc).slice(0, max).map(x => x.c);
}
const opcoesCategoria = (sel, podeNova) => `<option value="">Selecione a categoria</option>` +
  (S.base.categorias || []).filter(c => c.ativo || c.id === sel).map(c => `<option value="${c.id}" ${c.id === sel ? 'selected' : ''}>${esc(c.nome)}${c.servico && !/servi[cç]o/i.test(c.nome) ? ' (serviço)' : ''}</option>`).join('') +
  (podeNova ? '<option value="__nova">+ Cadastrar nova categoria</option>' : '');
const podeNovaCategoria = () => pode('cadastra_produtos') || pode('gerencia_cadastros');
// Categoria compacta (17/11): uma linha pequena em cima do produto; a lista só abre no "trocar".
// O <select> continua no formulário (mesmo nome/atributos), só fica escondido.
const htmlCatLinha = (sel, sugAttr) => `<div class="small muted" data-catl style="margin-bottom:3px">Categoria: <b data-catn style="font-weight:600"></b>
  · <a href="#" data-cat-trocar>trocar</a> <span ${sugAttr}></span><div data-cat-box class="hidden" style="margin-top:4px">${sel}</div></div>`;
function atualizarCatLinhas(raiz) {
  raiz.querySelectorAll('[data-catl]').forEach(l => {
    const s = l.querySelector('select'); if (!s) return;
    const c = (S.base.categorias || []).find(x => x.id === s.value);
    const d = l.closest('td, form'); const desc = d && d.querySelector('[data-f=descricao], [name=descricao]');
    const n = l.querySelector('[data-catn]');
    n.textContent = c ? catCurta(c.nome) : 'escolher'; n.title = c ? c.nome : '';
    n.style.color = !c && desc && desc.value.trim() ? 'var(--vermelho)' : '';
  });
}
function ligarCatLinhas(raiz) {
  if (!raiz || raiz._catLigado) return; raiz._catLigado = true;
  raiz.addEventListener('click', e => {
    const a = e.target.closest && e.target.closest('[data-cat-trocar]'); if (!a) return;
    e.preventDefault(); const b = a.closest('[data-catl]').querySelector('[data-cat-box]');
    b.classList.toggle('hidden'); if (!b.classList.contains('hidden')) b.querySelector('select').focus();
  });
  const atu = e => setTimeout(() => {
    atualizarCatLinhas(raiz);
    const s = e.type === 'change' && e.target.closest && e.target.closest('[data-cat-box] select');
    if (s && s.value && s.value !== '__nova') s.closest('[data-cat-box]').classList.add('hidden');
  }, 0);
  ['input', 'change', 'click'].forEach(t => raiz.addEventListener(t, atu));
  atualizarCatLinhas(raiz);
}

/* acabamento do item */

const infoAcabamento = i => !i.precisa_acabamento ? '' : `<div class="small" style="margin-top:4px">${badge(i.acabamento_iniciado_em ? 'Em acabamento' : '✂️ Precisa de acabamento', i.acabamento_iniciado_em ? 'b-ambar' : 'b-azul')} ${esc(i.acabamento_por || '')}</div>`;
// (23/11) quem vê fornecedor escolhe quem faz o acabamento (fornecedor ou interno) e qual é; os demais escrevem em texto livre
const quemAcabamento = i => i.acabamento_fornecedor_nome || (i.acabamento_tipo ? 'Interno' : '');
function opcoesAcabamento(sel) {
  const lista = (S.base.fornecedores || []).filter(f => f.ativo || f.id === sel);
  return `<option value="" ${!sel ? 'selected' : ''}>Interno (GVH)</option>` + lista.map(f => `<option value="${esc(f.id)}" ${f.id === sel ? 'selected' : ''}>${esc(f.nome)}</option>`).join('');
}
const camposAcabamento = i => `<label class="check" style="grid-column:1/-1"><input type="checkbox" name="precisa_acabamento" data-acab ${i.precisa_acabamento ? 'checked' : ''}> Precisa de acabamento depois que chegar do fornecedor?</label>
  ${veFornecedor()
    ? `<div class="grade g2 ${i.precisa_acabamento ? '' : 'hidden'}" style="grid-column:1/-1;gap:10px" data-acab-box>
        <label class="campo">Quem faz o acabamento *<select name="acabamento_fornecedor_id">${opcoesAcabamento(i.acabamento_fornecedor_id)}</select></label>
        <label class="campo">Qual acabamento *<input type="text" name="acabamento_tipo" maxlength="120" value="${esc(i.acabamento_tipo || (i.acabamento_fornecedor_id ? '' : i.acabamento_por) || '')}" placeholder="Ex.: laminação fosca, dobra e grampo"></label></div>`
    : `<label class="campo ${i.precisa_acabamento ? '' : 'hidden'}" style="grid-column:1/-1" data-acab-box>Quem vai fazer o acabamento *<input type="text" name="acabamento_por" value="${esc(i.acabamento_por || '')}" placeholder="Ex.: Interno — dobrar e grampear"></label>`}`;
function ligarAcabamento(form) {
  const ck = form.querySelector('[data-acab]'); if (!ck) return;
  ck.onchange = () => form.querySelector('[data-acab-box]').classList.toggle('hidden', !ck.checked);
}
function lerAcabamento(form, d) {
  const ck = form.querySelector('[data-acab]'); if (!ck) return true;
  d.precisa_acabamento = ck.checked;
  const comForn = !!form.querySelector('[name=acabamento_tipo]');
  if (!ck.checked) { delete d.acabamento_por; delete d.acabamento_tipo; delete d.acabamento_fornecedor_id; return true; }
  if (comForn) {
    d.acabamento_tipo = String(d.acabamento_tipo || '').trim();
    if (!d.acabamento_tipo) { toast('Informe qual é o acabamento.', true); return false; }
    // item novo ainda grava só o texto (o banco monta o mesmo texto ao salvar um item que já existe)
    const sel = form.querySelector('[name=acabamento_fornecedor_id]');
    d.acabamento_por = (sel && sel.value ? sel.selectedOptions[0].textContent : 'Interno (GVH)') + ' — ' + d.acabamento_tipo;
  } else if (!String(d.acabamento_por || '').trim()) { toast('Informe quem vai fazer o acabamento.', true); return false; }
  return true;
}

/* item: novo ou edição (campos conforme perfil) */
function modalItem(itemId) {
  if (!itemId && pode('cria_pedidos')) return modalNovosItens();
  const p = S.vistaAtual.dados; const i = itemId ? p.itens.find(x => x.id === itemId) : {};
  const cria = pode('cria_pedidos'); const prod = podeStatus('em_producao') || podeStatus('despachado') || cria; const arte = podeStatus('arte_em_aprovacao') || cria;
  const opcoesForn = `<option value="">Selecione</option>` + S.base.fornecedores.filter(f => f.ativo || f.id === i.fornecedor_id)
     .map(f => `<option value="${f.id}" ${f.id === i.fornecedor_id ? 'selected' : ''}>${esc(f.nome)}</option>`).join('');
  const m = abrirModal({ titulo: itemId ? 'Editar item' : 'Adicionar item', largo: true, corpo: `
    <form id="f-item" class="grade g3">
      ${cria ? `
        <div style="grid-column:1/-1">${htmlCatLinha(`<select name="categoria_id" style="font-size:12px;padding:3px 6px;max-width:320px">${opcoesCategoria(i.categoria_id, podeNovaCategoria())}</select>`, 'id="it-sug"')}
        <label class="campo" style="margin:0">Produto * <span class="muted">(vai para o cliente)</span><input type="text" name="descricao" list="dl-sugestoes" autocomplete="off" value="${esc(i.descricao || '')}" placeholder="Digite ou escolha: Folheto 10x14…"><div class="small muted" id="it-mat">${textoMaterialSugerido(i.descricao)}</div><div class="small muted" id="it-conf"></div></label></div>
        ${i.especificacao ? `<div class="small muted" style="grid-column:1/-1">Especificação (campo antigo): ${esc(i.especificacao)}</div>` : ''}
        <label class="campo">Quantidade *<input type="number" step="any" min="0" name="quantidade" value="${esc(i.quantidade ?? 1)}"></label>
        <label class="campo">Valor total (R$) *<input type="number" step="0.01" min="0" name="valor_total" value="${esc(i.valor_total ?? '')}"><span class="unit-calc" id="it-unit"></span></label>
        ${!itemId ? `<label class="campo">Status inicial<select name="status">${opcoesStatusInicial()}</select></label>` : ''}
      ` : `<div style="grid-column:1/-1"><b>${esc(i.descricao)}</b> <span class="muted">· ${num(i.quantidade)} un</span></div>`}
      ${prod ? `
        ${veFornecedor() ? `<label class="campo">Fornecedor<select name="fornecedor_id">${opcoesForn}</select></label>` : ''}
        <label class="campo">Previsão de produção<input type="date" name="prazo_producao" value="${esc(i.prazo_producao || '')}"></label>
        <label class="campo">Código do fornecedor<input type="text" name="codigo_producao" value="${esc(i.codigo_producao || '')}"></label>
        ${camposAcabamento(i)}` : ''}
      ${pode('ve_custo') ? `<label class="campo">Custo de produção (R$)<input type="number" step="0.01" min="0" name="custo" value="${esc(i.custo ?? '')}"></label>` : ''}
      ${arte ? `
        <label class="campo" style="grid-column:span 2">Link da prova / aprovação<input type="text" name="arte_url" value="${esc(i.arte_url || '')}"></label>
        <label class="campo" style="grid-column:1/-1">Link da arte no Drive<input type="text" name="arte_drive_url" value="${esc(i.arte_drive_url || '')}"></label>` : ''}
      <label class="campo" style="grid-column:1/-1">Observação do item <span class="muted">(interna — não vai para o cliente)</span><input type="text" name="observacao" value="${esc(i.observacao || '')}"></label>
      ${arte && itemId ? `<div class="small muted" style="grid-column:1/-1">Arquivos de arte (material do cliente e arte final) são enviados no bloco <b>Arquivos de arte</b> do pedido.</div>` : ''}
    </form>`,
    rodape: `<button class="btn" data-v>Voltar</button><button class="btn prim" data-s>${itemId ? 'Salvar item' : 'Adicionar item'}</button>`,
    aoAbrir: el => {
      const f = $('#f-item', el); ligarAcabamento(f); if (!f.quantidade) return;
      let catManual = !!itemId;
      const unit = () => { $('#it-unit', el).textContent = 'Unit. ' + unitario(f.valor_total.value, f.quantidade.value); };
      const conf = () => agendarConferencia(el, 'item', f.descricao.value, f.quantidade.value, r => { const b = $('#it-conf', el); if (b) b.innerHTML = r ? htmlConferencia(r, f.descricao.value) : ''; });
      f.quantidade.oninput = () => { unit(); conf(); }; f.valor_total.oninput = unit; unit();
      const sug = () => {
        const l = sugerirCategorias(f.descricao.value);
        if (!catManual && l[0]) f.categoria_id.value = l[0].id;
        $('#it-sug', el).innerHTML = l.length > 1 ? '· também: ' + l.slice(1).map(c => `<a href="#" data-cat="${c.id}" title="${esc(c.nome)}">${esc(catCurta(c.nome))}</a>`).join(' · ') : '';
        $$('[data-cat]', el).forEach(a => a.onclick = e => { e.preventDefault(); f.categoria_id.value = a.dataset.cat; catManual = true; });
      };
      f.descricao.oninput = () => {
        const bm = $('#it-mat', el); if (bm) bm.innerHTML = textoMaterialSugerido(f.descricao.value);
        const sg = sugestaoPorTexto(f.descricao.value);
        if (sg) { f.categoria_id.value = sg.categoria_id; catManual = true; $('#it-sug', el).innerHTML = '';
          const k = f.descricao.value.indexOf('…'); if (k >= 0) setTimeout(() => { try { f.descricao.setSelectionRange(k, k + 1); } catch {} }, 0); }
        else sug();
        conf();
      };
      if (!S.cache.gabaritos) carregarGabaritos().then(() => { const bm = $('#it-mat', el); if (bm) bm.innerHTML = textoMaterialSugerido(f.descricao.value); }).catch(() => {});
      f.categoria_id.onchange = () => {
        catManual = true;
        if (f.categoria_id.value === '__nova') { f.categoria_id.value = ''; modalCategoria(null, id => {
          f.categoria_id.innerHTML = opcoesCategoria(id, podeNovaCategoria()); f.categoria_id.value = id; atualizarCatLinhas(f); }); }
      };
      ligarCatLinhas(f);
    } });
  m.el.querySelector('[data-v]').onclick = m.fechar;
  m.el.querySelector('[data-s]').onclick = async () => {
    const d = formDados($('#f-item', m.el));
    if (!lerAcabamento($('#f-item', m.el), d)) return;
    if (d.descricao !== undefined && !String(d.descricao).trim()) return toast('Escreva o produto do item.', true);
    if (d.categoria_id !== undefined && !d.categoria_id) return toast('Escolha a categoria do item.', true);
    if (d.valor_total === '') return toast('Informe o valor total do item.', true);
    if (!pode('ve_custo')) delete d.custo; else if (d.custo === '' && i.custo == null) delete d.custo;
    if (itemId) d.id = itemId; else d.pedido_id = p.id;
    await api('salvar_item', d);
    m.fechar(); toast(itemId ? 'Item atualizado.' : 'Item adicionado.'); recarregar();
  };
}
// Adicionar item(ns) num pedido já criado: o mesmo editor do novo pedido (produto, categoria, gabarito sugerido, conferência e Digital)
function modalNovosItens() {
  const p = S.vistaAtual.dados;
  const m = abrirModal({ titulo: `Adicionar item · Pedido ${p.numero}`, largo: true,
    corpo: `<div id="ni-itens"></div><p class="small muted" style="margin:8px 0 0">O gabarito do item é escolhido pelo produto (dá para trocar depois no bloco Artes).</p>`,
    rodape: `<button class="btn" data-v>Voltar</button><button class="btn prim" data-s>Adicionar</button>` });
  const pegar = editorItens(m.el.querySelector('#ni-itens'), [], { comStatus: true, comDigital: true });
  m.el.querySelector('[data-v]').onclick = m.fechar;
  const bs = m.el.querySelector('[data-s]');
  bs.onclick = async () => {
    const itensTela = pegar(), itens = pegar.semTela(itensTela);
    if (pegar.incompletos()) return toast('Há item sem categoria, produto, quantidade ou total. Complete ou remova a linha.', true);
    if (!itens.length) return toast('Escreva o produto do item.', true);
    bs.disabled = true; let ok = 0; const testar = [];
    // itens com "Arte do cliente (testar agora)": o teste abre quando a tela do pedido recarregar (filaArteCliente)
    const fila = () => { if (testar.length) S.cache.testarArte = { pedido_id: p.id, itens: testar }; };
    try {
      for (const [k, it] of itens.entries()) { const r = await api('salvar_item', { ...it, pedido_id: p.id }); ok++; if (itensTela[k]._testar && r.id) testar.push(r.id); }
      fila(); m.fechar(); toast(ok > 1 ? `${ok} itens adicionados.` : 'Item adicionado.'); recarregar();
    } catch (e) {
      bs.disabled = false;
      if (ok) { fila(); toast(`${ok} de ${itens.length} itens foram adicionados; o próximo deu erro. Confira o pedido.`, true); m.fechar(); recarregar(); }
    }
  };
}
// extras (só no editor de itens, 23/11): "__copiar" = arte final do pedido repetido; "__cliente" = testar a arte do cliente logo depois de criar
function opcoesStatusInicial(sel = 'arte_a_fazer', { origNum = null, cliente = false } = {}) {
  const lista = ['arte_a_fazer', ...(S.perm.status_item_permitidos || []).filter(s => ['arte_a_fazer','arte_em_aprovacao','pre_impressao'].includes(s))];
  const op = (v, n) => `<option value="${v}" ${v === sel ? 'selected' : ''}>${esc(n)}</option>`;
  return (origNum ? op('__copiar', `Arte do pedido ${origNum}`) : '')
    + [...new Set(lista)].map(s => op(s, nomeStatusItem(s))).join('')
    + (cliente ? op('__cliente', 'Arte do cliente (testar agora)') : '');
}
const STATUS_ARTE_PRONTA = ['__copiar', '__cliente'];   // item com 1 modelo só (a arte já existe)

const unitario = (total, qtd) => Number(qtd) > 0 ? (Number(total || 0) / Number(qtd)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 4 }) : '—';

/* ---------- PARCELAS ---------- */
const TIPOS_PARC = { sinal:'Sinal', restante:'Restante', boleto:'Boleto', a_vista:'À vista', parcela:'Parcela' };
const FORMAS = { pix:'Pix', dinheiro:'Dinheiro', cartao_credito:'Cartão de crédito', cartao_debito:'Cartão de débito', boleto:'Boleto', transferencia:'Transferência', outro:'Outro', maquininha:'Maquininha', credito_cliente:'Crédito do cliente' };
// "Crédito do cliente" não entra na baixa manual: só pelo botão "Usar crédito" (o banco confere o saldo)
const opcoesForma = (sel = '') => `<option value="">—</option>` + Object.entries(FORMAS).filter(([k]) => k !== 'credito_cliente').map(([k, v]) => `<option value="${k}" ${k === sel ? 'selected' : ''}>${v}</option>`).join('');
// pagamento que pode ser confirmado pelo extrato do Inter (Módulo 6, Fase 2 Parte B)
const TIPO_ENTRADA = { PIX: 'Pix', TRANSFERENCIA: 'Transferência', BOLETO_COBRANCA: 'Boleto' };
const formaDoExtrato = r => !r.forma_pagamento || ['pix', 'transferencia', 'boleto'].includes(r.forma_pagamento);
function badgeParcela(r) {
  if (r.situacao === 'pago' && r.cielo_situacao === 'pago') return badge('Pago no cartão em ' + data(r.pago_em) + ' · aguardando repasse', 'b-verde');
  if (r.situacao === 'pago' && r.extrato_origem) return badge('Pago em ' + data(r.pago_em) + ' · confirmado no extrato', 'b-verde');
  if (r.situacao === 'pago' && r.forma_pagamento === 'credito_cliente') return badge('Pago em ' + data(r.pago_em) + ' · crédito do cliente', 'b-verde');
  if (r.situacao === 'pago') return r.conferencia === 'pendente'
    ? badge('Pago em ' + data(r.pago_em) + ' · a conferir', 'b-ambar')
    : badge('Pago em ' + data(r.pago_em), 'b-verde');
  if (r.situacao === 'cancelado') return badge('Cancelada', 'b-cinza');
  if (r.atrasado) return badge('Atrasada', 'b-vermelho');
  if (r.dias_para_vencer === 0) return badge('Vence hoje', 'b-ambar');
  return badge('Em aberto', 'b-cinza');
}
function detalheParcela(r) {
  if (r.situacao === 'pago' && r.cielo_situacao === 'pago') return `<div class="small muted">Pelo link da Cielo${r.cielo_bandeira ? ' · ' + esc(r.cielo_bandeira) : ''}${r.cielo_parcelas ? ' · ' + esc(r.cielo_parcelas) + 'x' : ''}</div>`;
  if (r.situacao === 'pago' && r.extrato_origem) return `<div class="small muted">${esc(TIPO_ENTRADA[r.extrato_tipo] || 'Entrada')}${r.extrato_nome ? ' de ' + esc(r.extrato_nome) : ''}
    · ${r.extrato_origem === 'automatico' ? 'baixa automática' : 'confirmado por ' + esc(r.baixado_por_nome || '—')}</div>`;
  if (r.situacao === 'pago' && r.baixado_por_nome) return `<div class="small muted">Marcado por ${esc(r.baixado_por_nome)}${r.conferencia === 'conferido' && r.conferido_por_nome ? ` · conferido por ${esc(r.conferido_por_nome)}` : ''}</div>`;
  if (r.situacao === 'aberto' && r.conferencia === 'devolvido') return `<div class="small" style="color:var(--vermelho)">Devolvido pelo financeiro: ${esc(r.motivo_devolucao || '')}</div>`;
  return '';
}
function tabelaParcelas(lista, comPedido) {
  lista.forEach(r => S.parcelas[r.id] = r);
  if (!lista.length) return `<div class="vazio">Nenhum pagamento lançado.</div>`;
  const fin = pode('edita_financeiro');
  const vend = !fin && pode('cria_pedidos') && !comPedido;   // vendedor, na tela do pedido
  const acoes = fin || vend;
  const linkCielo = pode('ve_financeiro');   // link da Cielo: qualquer pessoa que vê o financeiro (decisão do dono, 24/11)
  const extrato = pode('ve_financeiro');     // "Confirmar pagamento" pelo extrato do Inter: todos menos o Designer (D158)
  const coluna = acoes || linkCielo;
  const conferir = fin && (comPedido || S.usuario.perfil === 'financeiro');
  return `<div class="tabela-wrap"><table>
    <thead><tr>${comPedido ? '<th>Pedido</th><th>Cliente</th>' : ''}<th>Parcela</th><th>Vencimento</th><th class="dir">Valor</th><th>Forma</th><th>Situação</th>${coluna ? '<th></th>' : ''}</tr></thead>
    <tbody>${lista.map(r => `<tr>
      ${comPedido ? `<td><a href="#/pedido/${r.pedido_id}"><b>${esc(r.pedido_numero)}</b></a></td><td>${esc(r.cliente_nome)}</td>` : ''}
      <td>${esc(TIPOS_PARC[r.tipo] || r.tipo)}${r.parcela_num ? ` ${r.parcela_num}${r.parcelas_total ? '/' + r.parcelas_total : ''}` : ''}${r.observacao ? `<div class="small muted">${esc(r.observacao)}</div>` : ''}</td>
      <td class="num">${data(r.vencimento)}</td>
      <td class="dir num">${brl(r.valor)}</td>
      <td>${esc(r.forma_pagamento ? (FORMAS[r.forma_pagamento] || '—') : (r.situacao === 'aberto' ? 'A combinar' : '—'))}${htmlLinkPagamento(r)}
        ${r.tem_comprovante ? `<div><button class="btn link peq" onclick="verComprovante('${r.id}')">Ver comprovante</button></div>` : ''}</td>
      <td>${badgeParcela(r)}${detalheParcela(r)}</td>
      ${coluna ? `<td class="dir" style="white-space:nowrap">
        ${extrato && r.situacao === 'aberto' && formaDoExtrato(r) ? `<button class="btn prim peq" onclick="confirmarPagamentoExtrato('${r.id}')">Confirmar pagamento</button>` : ''}
        ${extrato && !comPedido && r.situacao === 'aberto' ? `<button class="btn peq hidden" data-usar-credito="${r.id}">Usar crédito</button>` : ''}
        ${acoes && r.situacao === 'aberto' ? `<button class="btn ${extrato && formaDoExtrato(r) ? 'link' : 'prim'} peq" onclick="modalBaixa('${r.id}', ${conferir})"${extrato && formaDoExtrato(r) && !fin ? ' title="Só se o dinheiro não caiu no Inter: vai para a conferência do financeiro"' : ''}>${fin ? 'Dar baixa' : 'Marcar como pago'}</button>
             ${fin ? `<button class="btn link peq" onclick="excluirParcela('${r.id}')">Excluir</button>` : ''}` : ''}
        ${linkCielo && r.situacao === 'aberto' && (r.forma_pagamento === 'cartao_credito' || !r.forma_pagamento) ? botoesLinkCielo(r, acoes) : ''}
        ${acoes && r.situacao === 'pago' && r.tem_comprovante && (fin || r.conferencia === 'pendente') ? `<button class="btn link peq" onclick="trocarComprovante('${r.id}')">Trocar comprovante</button>` : ''}
        ${acoes && r.situacao === 'pago' && (fin || r.conferencia === 'pendente') ? `<button class="btn link peq" onclick="desfazerBaixa('${r.id}')" title="Volta a ficar em aberto; não devolve dinheiro">Desconciliar</button>` : ''}
      </td>` : ''}
    </tr>`).join('')}</tbody></table></div>`;
}
function modalBaixa(id, conferir) {
  const p0 = S.parcelas[id]; const r = { id, valor: p0.valor, forma: p0.forma_pagamento || '' };
  const m = abrirModal({ titulo: 'Registrar pagamento', corpo: `
    <form id="f-baixa" class="grade g3">
      <label class="campo">Data do pagamento<input type="date" name="pago_em" value="${hoje()}" required></label>
      <label class="campo">Forma *<select name="forma_pagamento">${opcoesForma(r.forma)}</select></label>
      <label class="campo">Valor recebido (R$)<input type="number" step="0.01" min="0.01" name="valor" value="${r.valor}"></label>
      <label class="campo" style="grid-column:1/-1">Comprovante <span class="muted small">(Pix e transferência; opcional)</span><input type="file" id="baixa-comp" accept="${EXT_COMP}"></label>
    </form><p class="small muted" style="margin:0">A comissão do vendedor é calculada automaticamente sobre o valor recebido, no mês do pagamento.
    ${conferir ? '' : '<br><b>O pagamento vai para a conferência do financeiro.</b>'}</p>`,
    rodape: `<button class="btn" data-v>Voltar</button><button class="btn prim" data-s>Confirmar pagamento</button>` });
  m.el.querySelector('[data-v]').onclick = m.fechar;
  m.el.querySelector('[data-s]').onclick = async () => {
    const f = formDados($('#f-baixa', m.el));
    if (!f.forma_pagamento) return toast('Informe a forma de pagamento.', true);
    const a = $('#baixa-comp', m.el).files[0];
    try {
      await ocupado(m.el.querySelector('[data-s]'), async () => {
        if (a) f.comprovante_path = await enviarComprovante(a, r.id);
        await api('baixar_recebimento', { id: r.id, ...f, conferir: !!conferir });
      });
    } catch { return; }
    m.fechar(); toast('Pagamento registrado.'); recarregar();
  };
}
async function desfazerBaixa(id) {
  if (!await confirmar('Desconciliar este pagamento? Ele volta a ficar em aberto no pedido e deixa de estar ligado ao que foi recebido (extrato, crédito do cliente ou link). Nenhum dinheiro é devolvido ao cliente. A comissão ligada a ele também será estornada.', 'Desconciliar', true)) return;
  await api('baixar_recebimento', { id, desfazer: true }); toast('Pagamento desconciliado.'); recarregar();
}
// link da Cielo ainda ativo: ao excluir o pagamento ele deixa de valer no sistema, mas ainda abre na Cielo até vencer
const avisoLinkCielo = lista => {
  const l = (lista || []).filter(r => r.situacao === 'aberto' && r.cielo_situacao === 'ativo');
  return l.length ? ` Este pagamento tem um link da Cielo, que ainda abre até ${dataHora(l[0].cielo_expira_em)}: avise o cliente para não usar. Se ele pagar mesmo assim, o financeiro recebe uma tarefa.` : '';
};
async function excluirParcela(id) {
  if (!await confirmar('Excluir esta parcela em aberto?' + avisoLinkCielo([S.parcelas[id]]), 'Excluir', true)) return;
  await api('excluir_recebimento', { id }); toast('Parcela excluída.'); recarregar();
}

/* ---------- FORMA DE PAGAMENTO (V4) — novo pedido, conversão de orçamento, troca de forma e lançamento ---------- */
const FORMAS_COMB = { pix:'Pix', transferencia:'Transferência', cartao_credito:'Cartão de crédito', boleto:'Boleto', retirada:'Paga na retirada', sinal_restante:'Sinal + restante', outros:'Outros' };
const FORMAS_LIBERAM = ['boleto', 'retirada'];   // liberam a pré-impressão sem pagamento (V11)
const EXT_COMP = '.pdf,.png,.jpg,.jpeg,.webp,.heic,.heif';
const urlSegura = u => /^https?:\/\//i.test(String(u || '').trim()) ? String(u).trim() : '';
// comprovante vai para a pasta Financeiro do pedido no Drive, sempre preso a um pagamento já criado
async function enviarComprovante(arquivo, recebimentoId) {
  if (arquivo.size > 10 * 1024 * 1024) { toast('O comprovante passa de 10 MB.', true); throw new Error('tamanho'); }
  try { return 'drive:' + await enviarArquivoDrive(null, arquivo, 'comprovante', null, null, null, recebimentoId); }
  catch (e) { toast('Falha ao enviar o comprovante: ' + e.message, true); throw new Error('upload'); }
}
// depois de criar os pagamentos, sobe os comprovantes escolhidos e anexa cada um ao seu pagamento
async function anexarComprovantes(pag, resp) {
  const pend = Object.entries((pag && pag.comprovantes) || {}); if (!pend.length) return;
  const ids = (resp && resp.recebimentos_ids) || {}; let falhas = 0;
  await aguarde(pend.length > 1 ? 'Anexando comprovantes…' : 'Anexando comprovante…', async () => {
    for (const [chave, arq] of pend) {
      const rid = ids[chave]; if (!rid) { falhas++; continue; }
      try { const path = await enviarComprovante(arq, rid); await api('receb_anexo', { id: rid, comprovante_path: path }, true); }
      catch { falhas++; }
    }
  });
  if (falhas) toast(`${falhas > 1 ? falhas + ' comprovantes não foram anexados' : 'Um comprovante não foi anexado'}. Anexe pelo pagamento, no bloco Financeiro do pedido.`, true);
}
// depois de criar o pedido (ou trocar a forma / lançar a diferença): confirma pelo extrato o que já foi pago e cria o link da Cielo
async function finalizarPagamento(pag, resp) {
  await anexarComprovantes(pag, resp);
  const ids = (resp && resp.recebimentos_ids) || {};
  for (const e of (pag && pag.extrato) || []) {
    try {
      await aguarde('Confirmando o pagamento no extrato…', () => api('confirmar_pagamento_extrato', { id: ids[e.chave], movimento_id: e.movimento_id, valor: e.valor, sobra: e.sobra || null }, true));
      if (e.sobra) toast(textoSobra(e.sobra).trim());
    }
    catch (err) { toast(`O pagamento não foi confirmado pelo extrato (${err.message}). Confirme depois pelo botão "Confirmar pagamento" no pedido.`, true); }
  }
  for (const chave of (pag && pag.creditos) || []) {
    try { await aguarde('Usando o crédito do cliente…', () => api('usar_credito_cliente', { id: ids[chave] }, true)); }
    catch (err) { toast(`O crédito do cliente não foi usado (${err.message}). Use depois pelo botão "Usar crédito" no pedido.`, true); }
  }
  for (const chave of (pag && pag.links) || []) {
    try { const r = await aguarde('Criando o link na Cielo…', () => api('cielo_link', { id: ids[chave] }, true)); mostrarLinkCielo(r.url, r.expira_em); }
    catch (err) { toast(`O link da Cielo não foi criado (${err.message}). Crie no pedido, em "Criar link de pagamento".`, true); }
  }
}
async function verComprovante(id) { const r = await api('comprovante_arquivo', { op: 'download', id }); window.open(r.url, '_blank', 'noopener'); }
function htmlFormaPagamento(op = {}) {
  return `<div class="forma-pag" data-fp-raiz ${op.autorizar ? 'data-fp-autorizar' : ''} ${op.orcamento ? 'data-fp-orc' : ''}>
    <div class="chips" data-fp="forma">${Object.entries(FORMAS_COMB).map(([k, v]) => `<button type="button" class="chip" data-forma="${k}">${v}</button>`).join('')}</div>
    <div data-fp-corpo></div>
  </div>`;
}
/* Componente que evolui conforme os cliques. Devolve coletar() assíncrono → { forma_pagamento, forma_pagamento_obs, recebimentos, resumo, autoriza_sem_pagamento }.
   coletar.atualizar() recalcula boletos e sugestão do sinal quando o total ou a previsão mudam. */
/* Pagamento já feito (Pix, transferência, sinal) é escolhido no extrato do Inter e confirmado logo depois de criar (finalizarPagamento);
   cartão: o link da Cielo é criado logo depois de criar. clienteId() diz de quem buscar no extrato (Módulo 6, 26/11). */
function ligarFormaPagamento(el, total, prev, inicial, clienteId = () => null) {
  const raiz = el.matches('[data-fp-raiz]') ? el : el.querySelector('[data-fp-raiz]');
  const podeAutorizar = raiz.hasAttribute('data-fp-autorizar');
  const orc = raiz.hasAttribute('data-fp-orc');   // orçamento: só o combinado, sem "já pagou", extrato ou link
  const corpo = raiz.querySelector('[data-fp-corpo]');
  const st = { forma: '', pago: null, mov: null, naoAchou: false, gerarLink: true, qtd: 1, outraQtd: false, parcelas: [], parcManual: false,
               sinal: '', sinalManual: false, sinalPago: null, movSinal: null, naoAchouSinal: false, restante: 'pix', obs: '', autoriza: null,
               credito: 0, creditoCli: null, usarCredito: false };   // crédito do cliente em "Outros" (Parte C1)
  const enviados = new Map();
  const t2 = () => Math.round(total() * 100) / 100;
  const brlTxt = v => brl(v).replace(/\s/g, ' ');
  // os botões usam data-forma / data-op (e não data-v): data-v é o "Voltar" das janelas, procurado pelo primeiro [data-v]
  const chips = (grupo, opcoes, valor) => `<div class="chips" data-g="${grupo}">${opcoes.map(([v, r]) => `<button type="button" class="chip ${String(valor) === String(v) ? 'ativo' : ''}" data-op="${v}">${r}</button>`).join('')}</div>`;
  const pergunta = (txt, html) => `<div style="margin-top:12px"><div class="small" style="margin-bottom:6px">${txt}</div>${html}</div>`;
  const campo = (rot, k, tipo = 'text', extra = '') => `<label class="campo" style="margin-top:12px;max-width:420px">${rot}<input type="${tipo}" data-k="${k}" value="${esc(st[k])}" ${extra}></label>`;
  const simNao = (k, txt) => pergunta(txt, chips(k, [['true', 'Sim'], ['false', 'Ainda não']], st[k]));
  // entrada do extrato escolhida (k = 'mov' ou 'movSinal'); "não achei" = cria em aberto e confirma depois
  const extrato = (k, nao) => `<div style="margin-top:12px">${st[k]
    ? `<div class="alerta" style="background:var(--verde-bg);color:var(--grafite);display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap">
        <span class="small">✓ ${esc(TIPO_ENTRADA[st[k].tipo] || 'Entrada')} de <b>${esc(st[k].nome || '—')}</b> · ${data(st[k].data)} · ${brl(st[k].saldo)}</span>
        <button type="button" class="btn link peq" data-ext="${k}">Trocar</button></div>`
    : st[nao] ? `<div class="alerta small" style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap"><span>Não achei o pagamento no extrato. O pedido será criado com o pagamento em aberto; confirme depois pelo botão <b>Confirmar pagamento</b>.</span>
        <button type="button" class="btn link peq" data-ext="${k}">Buscar de novo</button></div>`
    : `<button type="button" class="btn peq" data-ext="${k}">Buscar o pagamento no extrato</button>`}</div>`;
  const buscarExtrato = async k => {
    const nao = k === 'mov' ? 'naoAchou' : 'naoAchouSinal', valor = k === 'mov' ? t2() : Math.round(Number(st.sinal || 0) * 100) / 100;
    if (!clienteId()) { toast('Escolha o cliente antes de buscar o pagamento no extrato.', true); return; }
    if (!(valor > 0)) { toast(k === 'mov' ? 'O total precisa ser maior que zero.' : 'Informe o valor do sinal.', true); return; }
    const r = await escolherEntradaExtrato(clienteId(), valor);
    if (r === undefined) return;               // fechou a janela sem escolher: fica como estava
    st[k] = r; st[nao] = r === null; render();
  };
  const gerarParc = () => {
    const qtd = Math.min(24, Math.max(1, Number(st.qtd) || 1)), v1 = prev() || somaDias(hoje(), 30);
    const cents = Math.round(t2() * 100), base = Math.floor(cents / qtd);
    st.parcelas = Array.from({ length: qtd }, (_, k) => ({ tipo: 'boleto', forma_pagamento: 'boleto',
      parcela_num: qtd > 1 ? k + 1 : null, parcelas_total: qtd > 1 ? qtd : null, vencimento: somaDias(v1, 30 * k),
      valor: ((k === qtd - 1 ? cents - base * (qtd - 1) : base) / 100).toFixed(2) }));
    st.parcManual = false;
  };
  const sugerirSinal = () => { if (!st.sinalManual) { const s = Math.round(t2() * 50) / 100; st.sinal = s > 0 ? s.toFixed(2) : ''; } };
  // saldo de crédito do cliente escolhido (lido uma vez por cliente; o banco confere de novo ao usar)
  const carregarCredito = () => {
    const c = clienteId(); if (!c || st.creditoCli === c) return;
    st.creditoCli = c; st.credito = 0; st.usarCredito = false;
    api('buscar_credito_cliente', { cliente_id: c }, true, true)
      .then(r => { if (st.creditoCli !== c) return; st.credito = Number(r.saldo) || 0; if (st.forma === 'outros') render(); })
      .catch(() => {});
  };
  const creditoUsado = () => st.usarCredito && st.credito > 0 ? Math.min(st.credito, t2()) : 0;
  // nada confirmado no extrato na criação: cartão (link depois), "Ainda não" ou "não achei"
  const nadaPago = () => st.forma === 'cartao_credito' ? true
    : st.forma === 'outros' && st.usarCredito ? creditoUsado() < t2()
    : st.forma === 'sinal_restante' ? (st.sinalPago === false || (st.sinalPago === true && !st.movSinal))
    : (st.pago === false || (st.pago === true && ['pix', 'transferencia'].includes(st.forma) && !st.mov));
  const mostraAut = () => !orc && podeAutorizar && st.forma && !FORMAS_LIBERAM.includes(st.forma) && nadaPago();
  const resumo = () => {
    const f = st.forma, pg = st.pago === true ? ' (pago)' : '';
    if (orc && f === 'sinal_restante') return `Sinal de ${brlTxt(Number(st.sinal || 0))} + restante na entrega (${FORMAS_COMB[st.restante]})`;
    if (f === 'pix' || f === 'transferencia') return FORMAS_COMB[f] + (st.pago === true && st.mov ? ' (pago)' : '');
    if (f === 'cartao_credito') return FORMAS_COMB[f] + (!orc && st.gerarLink ? ' (link da Cielo)' : '');
    if (f === 'boleto') return st.parcelas.length > 1 ? `Boleto em ${st.parcelas.length}x` : 'Boleto';
    if (f === 'retirada') return 'Paga na retirada';
    if (f === 'sinal_restante') return `Sinal de ${brlTxt(Number(st.sinal || 0))}${st.sinalPago === true && st.movSinal ? ' (pago)' : ''} + restante a combinar`;
    if (f === 'outros' && !orc && st.usarCredito && creditoUsado() > 0) {
      const c = creditoUsado();
      return `Crédito do cliente (${brlTxt(c)})` + (c < t2() ? ` + ${brlTxt(Math.round((t2() - c) * 100) / 100)} a combinar` : '');
    }
    if (f === 'outros') return 'Outros' + (st.obs ? ': ' + st.obs : '') + pg;
    return '';
  };
  const render = () => {
    raiz.querySelectorAll('[data-fp="forma"] .chip').forEach(b => b.classList.toggle('ativo', b.dataset.forma === st.forma));
    const f = st.forma; let h = '';
    if (orc && f === 'boleto') {
      h += pergunta('Quantos boletos?', chips('qtd', [1, 2, 3, 4, 5, 6].map(n => [n, n + 'x']).concat([['outro', 'Outro']]), st.outraQtd ? 'outro' : st.qtd));
      if (st.outraQtd) h += campo('Quantidade de boletos', 'qtd', 'number', 'min="1" max="24" style="max-width:120px"');
    } else if (orc && f === 'sinal_restante') {
      h += campo(`Valor do sinal (R$) <span class="muted small">— sugestão: 50%</span>`, 'sinal', 'number', 'step="0.01" min="0.01" style="max-width:160px"');
      h += pergunta('Restante, depois da entrega, em', chips('restante', [['pix', 'Pix'], ['cartao_credito', 'Cartão de crédito']], st.restante));
    } else if (orc && f === 'outros') {
      h += campo('Como será o pagamento? *', 'obs', 'text', 'placeholder="Ex.: permuta, crédito do cliente, a combinar"');
    } else if (orc) {
      // pix, transferência, cartão e retirada: no orçamento basta a forma
    } else if (f === 'pix' || f === 'transferencia') {
      h += simNao('pago', 'O cliente já pagou?');
      if (st.pago === true) h += extrato('mov', 'naoAchou');
    } else if (f === 'cartao_credito') {
      h += `<label class="check" style="margin-top:12px;white-space:normal"><input type="checkbox" data-link ${st.gerarLink ? 'checked' : ''}> Criar o link de pagamento da Cielo agora (crédito, até 3x sem juros)</label>
        <div class="small muted" style="margin-top:4px">${st.gerarLink ? 'Logo depois de salvar, o link aparece para copiar e mandar ao cliente.' : 'Crie depois, no pedido, com "Criar link de pagamento" (ou "Colar link manual" para parcelado com juros).'}</div>`;
    } else if (f === 'boleto') {
      h += pergunta('Quantos boletos?', chips('qtd', [1, 2, 3, 4, 5, 6].map(n => [n, n + 'x']).concat([['outro', 'Outro']]), st.outraQtd ? 'outro' : st.qtd));
      if (st.outraQtd) h += campo('Quantidade de boletos', 'qtd', 'number', 'min="1" max="24" style="max-width:120px"');
      h += `<div style="margin-top:10px">${st.parcelas.map((p, k) => `<div style="display:flex;gap:8px;align-items:center;margin-top:6px">
          <span class="small muted" style="min-width:42px">${p.parcela_num ? p.parcela_num + '/' + p.parcelas_total : 'Único'}</span>
          <input type="date" value="${p.vencimento}" data-pk="${k}" data-pc="vencimento" style="max-width:170px">
          <input type="number" step="0.01" value="${p.valor}" data-pk="${k}" data-pc="valor" style="max-width:130px;text-align:right"></div>`).join('')}</div>`;
    } else if (f === 'sinal_restante') {
      h += campo(`Valor do sinal (R$) <span class="muted small">— sugestão: 50%</span>`, 'sinal', 'number', 'step="0.01" min="0.01" style="max-width:160px"');
      h += simNao('sinalPago', 'O sinal já foi pago?');
      if (st.sinalPago === true) h += extrato('movSinal', 'naoAchouSinal');
      h += '<div class="small muted" style="margin-top:10px">O restante fica "a combinar": no pedido, use "Confirmar pagamento" (Pix) ou "Criar link de pagamento" (cartão).</div>';
    } else if (f === 'outros') {
      carregarCredito();
      if (st.credito > 0) h += `<label class="check" style="margin-top:12px;white-space:normal"><input type="checkbox" data-cred ${st.usarCredito ? 'checked' : ''}> Usar o crédito do cliente (saldo <b>${brl(st.credito)}</b>)</label>
        ${st.usarCredito ? `<div class="small muted" style="margin-top:4px">Logo depois de salvar, ${brl(creditoUsado())} entram pagos com o crédito${creditoUsado() < t2() ? `; o resto (${brl(Math.round((t2() - creditoUsado()) * 100) / 100)}) fica "a combinar" no pedido` : ''}.</div>` : ''}`;
      if (!st.usarCredito) {
        h += campo('Como será o pagamento? *', 'obs', 'text', 'placeholder="Ex.: permuta, a combinar"');
        h += simNao('pago', 'Já foi pago?');
      }
    }
    if (mostraAut()) h += pergunta('Pode ir para a produção antes do pagamento?', chips('autoriza', [['true', 'Sim, autorizo'], ['false', 'Não']], st.autoriza ?? 'false'));
    if (f) h += `<div class="small muted" style="margin-top:14px;padding-top:10px;border-top:1px solid var(--borda, #e5e5e5)" data-fp-resumo>Resumo: <b>${esc(resumo())}</b></div>`;
    corpo.innerHTML = h;
    ligar();
  };
  const atualizarResumo = () => { const r = corpo.querySelector('[data-fp-resumo] b'); if (r) r.textContent = resumo(); };
  const ligar = () => {
    corpo.querySelectorAll('[data-g]').forEach(g => g.querySelectorAll('.chip').forEach(b => b.onclick = () => {
      const k = g.dataset.g, v = b.dataset.op;
      if (k === 'qtd') { if (v === 'outro') { st.outraQtd = true; } else { st.outraQtd = false; st.qtd = Number(v); gerarParc(); } }
      else st[k] = v === 'true' ? true : v === 'false' ? false : v;
      if (k === 'pago' && st.pago !== true) { st.mov = null; st.naoAchou = false; }
      if (k === 'sinalPago' && st.sinalPago !== true) { st.movSinal = null; st.naoAchouSinal = false; }
      render();
      // "Sim, já pagou": abre direto a busca no extrato
      if (k === 'pago' && st.pago === true && ['pix', 'transferencia'].includes(st.forma) && !st.mov) buscarExtrato('mov');
      if (k === 'sinalPago' && st.sinalPago === true && !st.movSinal) buscarExtrato('movSinal');
    }));
    corpo.querySelectorAll('[data-ext]').forEach(b => b.onclick = () => buscarExtrato(b.dataset.ext));
    const lk = corpo.querySelector('[data-link]'); if (lk) lk.onchange = () => { st.gerarLink = lk.checked; render(); };
    const cr = corpo.querySelector('[data-cred]'); if (cr) cr.onchange = () => { st.usarCredito = cr.checked; st.pago = null; render(); };
    corpo.querySelectorAll('[data-k]').forEach(i => i.oninput = () => {
      st[i.dataset.k] = i.value;
      if (i.dataset.k === 'sinal') st.sinalManual = true;
      if (i.dataset.k === 'qtd') { gerarParc(); render(); const n = corpo.querySelector('[data-k=qtd]'); n.focus(); return; }
      atualizarResumo();
    });
    corpo.querySelectorAll('[data-pc]').forEach(i => i.onchange = () => { st.parcelas[i.dataset.pk][i.dataset.pc] = i.value; st.parcManual = true; });
  };
  raiz.querySelectorAll('[data-fp="forma"] .chip').forEach(b => b.onclick = () => {
    st.forma = b.dataset.forma; st.pago = null; st.mov = null; st.naoAchou = false;
    if (st.forma === 'boleto' && !st.parcelas.length) gerarParc();
    if (st.forma === 'sinal_restante') sugerirSinal();
    render();
    raiz.dispatchEvent(new CustomEvent('fp-forma'));
  });
  const subir = async a => { if (!enviados.has(a)) enviados.set(a, await enviarComprovante(a)); return enviados.get(a); };
  const coletarOrc = () => {
    const f = st.forma; if (!f) return null;
    let obs = null;
    if (f === 'sinal_restante') {
      const sinal = Math.round(Number(st.sinal || 0) * 100) / 100;
      if (!(sinal > 0)) throw new Error('Informe o valor do sinal.');
      if (t2() > 0 && sinal >= t2()) throw new Error('O sinal precisa ser menor que o total.');
    }
    if (f === 'outros') { obs = st.obs.trim(); if (!obs) throw new Error('Descreva como será o pagamento em "Outros".'); }
    return { forma_pagamento: f, forma_pagamento_obs: obs, resumo: resumo(),
             pagamento_detalhe: f === 'boleto' ? { qtd: Number(st.qtd) || 1 } : f === 'sinal_restante' ? { sinal: Number(st.sinal), restante: st.restante } : null };
  };
  const coletar = async () => {
    if (orc) return coletarOrc();
    const t = t2(), p = prev(), f = st.forma;
    if (!(t > 0)) throw new Error('O total precisa ser maior que zero.');
    if (!f) throw new Error('Escolha a forma de pagamento.');
    let rec = [], obs = null;
    if (f === 'pix' || f === 'transferencia') {
      if (st.pago === null) throw new Error('Informe se o cliente já pagou.');
      if (st.pago && !st.mov && !st.naoAchou) throw new Error('Escolha o pagamento no extrato (ou "Não achei") ou marque "Ainda não".');
      rec = [{ tipo: 'a_vista', valor: t.toFixed(2), vencimento: hoje(), forma_pagamento: f, _mov: st.pago ? st.mov : null }];
    } else if (f === 'cartao_credito') {
      rec = [{ tipo: 'a_vista', valor: t.toFixed(2), vencimento: hoje(), forma_pagamento: 'cartao_credito', _link: st.gerarLink }];
    } else if (f === 'boleto') {
      if (!st.parcelas.length) gerarParc();
      const soma = st.parcelas.reduce((s, x) => s + Number(x.valor), 0);
      if (Math.abs(soma - t) > 0.01) throw new Error(`A soma dos boletos (${brlTxt(soma)}) precisa ser igual ao total (${brlTxt(t)}).`);
      if (st.parcelas.some(x => !x.vencimento)) throw new Error('Informe o vencimento de cada boleto.');
      rec = st.parcelas.map(x => ({ ...x }));
    } else if (f === 'retirada') {
      rec = [{ tipo: 'restante', valor: t.toFixed(2), vencimento: p || hoje(), forma_pagamento: null }];
    } else if (f === 'sinal_restante') {
      const sinal = Math.round(Number(st.sinal || 0) * 100) / 100;
      if (!(sinal > 0)) throw new Error('Informe o valor do sinal.');
      if (sinal >= t) throw new Error('O sinal precisa ser menor que o total. Se o cliente pagou tudo, escolha Pix ou Transferência.');
      if (st.sinalPago === null) throw new Error('Informe se o sinal já foi pago.');
      if (st.sinalPago && !st.movSinal && !st.naoAchouSinal) throw new Error('Escolha o sinal no extrato (ou "Não achei") ou marque "Ainda não".');
      // o restante fica "a combinar" (sem forma): no pedido aceita "Confirmar pagamento" ou "Criar link de pagamento"
      rec = [{ tipo: 'sinal', valor: sinal.toFixed(2), vencimento: hoje(), forma_pagamento: 'pix', _mov: st.sinalPago ? st.movSinal : null },
             { tipo: 'restante', valor: (Math.round((t - sinal) * 100) / 100).toFixed(2), vencimento: p || hoje(), forma_pagamento: null }];
    } else if (st.usarCredito && creditoUsado() > 0) {
      // crédito do cliente: a parte coberta é paga logo depois de criar ("usar_credito_cliente"); o resto fica a combinar
      const c = Math.round(creditoUsado() * 100) / 100, resto = Math.round((t - c) * 100) / 100;
      obs = 'Crédito do cliente';
      rec = [{ tipo: 'a_vista', valor: c.toFixed(2), vencimento: hoje(), forma_pagamento: 'credito_cliente', _credito: true }];
      if (resto > 0) rec.push({ tipo: 'restante', valor: resto.toFixed(2), vencimento: p || hoje(), forma_pagamento: null });
    } else {
      obs = st.obs.trim();
      if (!obs) throw new Error('Descreva como será o pagamento em "Outros".');
      if (st.pago === null) throw new Error('Informe se já foi pago.');
      rec = [{ tipo: 'a_vista', valor: t.toFixed(2), vencimento: hoje(), forma_pagamento: 'outro', observacao: obs, pago: st.pago }];
    }
    // o que fazer depois de criar: confirmar pelo extrato (valor = o menor entre a parcela e o que sobra na entrada) e criar o link
    const extratoUsar = [], links = [], creditos = [];
    rec.forEach((r, k) => { r._chave = 'c' + k;
      if (r._mov) extratoUsar.push({ chave: r._chave, movimento_id: r._mov.id, valor: Math.min(Number(r.valor), Number(r._mov.saldo)).toFixed(2), sobra: r._mov.sobra || null });
      if (r._link) links.push(r._chave);
      if (r._credito) creditos.push(r._chave);
      delete r._mov; delete r._link; delete r._credito; });
    return { forma_pagamento: f, forma_pagamento_obs: obs, recebimentos: rec, comprovantes: {}, extrato: extratoUsar, links, creditos, resumo: resumo(),
             autoriza_sem_pagamento: !!(mostraAut() && st.autoriza === true) };
  };
  coletar.forma = () => st.forma;
  coletar.atualizar = () => {
    if (st.forma === 'boleto' && !st.parcManual) gerarParc();
    if (st.forma === 'sinal_restante') sugerirSinal();
    if (st.forma) render();
  };
  // estado inicial (orçamento salvo ou orçamento sendo transformado em pedido)
  if (inicial && inicial.forma) {
    const det = inicial.detalhe || {};
    st.forma = inicial.forma; st.obs = inicial.obs || '';
    if (det.qtd) { st.qtd = Number(det.qtd); st.outraQtd = ![1, 2, 3, 4, 5, 6].includes(st.qtd); }
    if (det.sinal) { st.sinal = Number(det.sinal).toFixed(2); st.sinalManual = true; }
    if (det.restante) st.restante = det.restante;
    if (st.forma === 'boleto') gerarParc();
    if (st.forma === 'sinal_restante') sugerirSinal();
    render();
  }
  return coletar;
}
function modalParcelas() {
  const p = S.vistaAtual.dados;
  const lancado = (p.recebimentos || []).filter(r => r.situacao !== 'cancelado').reduce((s, r) => s + Number(r.valor), 0);
  const falta = Math.round((Number(p.valor_total) - lancado) * 100) / 100;
  if (falta <= 0) return toast('Todo o valor do pedido já tem pagamento lançado.', true);
  let coletar;
  const m = abrirModal({ titulo: 'Lançar pagamento da diferença', largo: true, corpo: `<p class="small muted" style="margin:0 0 12px">Valor ainda sem pagamento lançado: <b>${brl(falta)}</b> (por exemplo, quando o pedido aumentou depois de criado).</p>${htmlFormaPagamento()}`,
    rodape: `<button class="btn" data-v>Voltar</button><button class="btn prim" data-s>Salvar pagamento</button>`,
    aoAbrir: el => { coletar = ligarFormaPagamento(el, () => falta, () => p.data_prevista_entrega, null, () => p.cliente_id || p.cliente?.id); } });
  m.el.querySelector('[data-v]').onclick = m.fechar;
  m.el.querySelector('[data-s]').onclick = async () => {
    let r; try { r = await coletar(); } catch (e) { if (e.message !== 'upload' && e.message !== 'tamanho') toast(e.message, true); return; }
    const resp = await api('salvar_recebimentos', { pedido_id: p.id, parcelas: r.recebimentos }); m.fechar();
    await finalizarPagamento(r, resp); toast('Pagamento lançado.'); recarregar();
  };
}
function modalTrocarForma() {
  const p = S.vistaAtual.dados;
  let coletar;
  const m = abrirModal({ titulo: 'Trocar forma de pagamento', largo: true, corpo: `<p class="small muted" style="margin:0 0 12px">Forma atual: <b>${esc(FORMAS_COMB[p.forma_pagamento] || '—')}</b>. Os pagamentos em aberto são substituídos pela nova forma, sobre o total de <b>${brl(p.valor_total)}</b>. A troca fica no histórico do pedido.</p>${avisoLinkCielo(p.recebimentos) ? `<p class="small" style="margin:0 0 12px;color:var(--vermelho)">${esc(avisoLinkCielo(p.recebimentos).trim())}</p>` : ''}${htmlFormaPagamento()}`,
    rodape: `<button class="btn" data-v>Voltar</button><button class="btn prim" data-s>Trocar forma</button>`,
    aoAbrir: el => { coletar = ligarFormaPagamento(el, () => Number(p.valor_total), () => p.data_prevista_entrega, null, () => p.cliente_id || p.cliente?.id); } });
  m.el.querySelector('[data-v]').onclick = m.fechar;
  m.el.querySelector('[data-s]').onclick = async () => {
    let r; try { r = await coletar(); } catch (e) { if (e.message !== 'upload' && e.message !== 'tamanho') toast(e.message, true); return; }
    const resp = await api('trocar_forma_pagamento', { pedido_id: p.id, forma_pagamento: r.forma_pagamento, forma_pagamento_obs: r.forma_pagamento_obs,
      recebimentos: r.recebimentos, condicoes_pagamento: r.resumo });
    m.fechar(); await finalizarPagamento(r, resp); toast('Forma de pagamento trocada.'); recarregar();
  };
}
async function autorizarSemPagamento(autorizar) {
  const p = S.vistaAtual.dados;
  const msg = autorizar ? 'Autorizar produzir sem pagamento? A arte deste pedido poderá ir para a pré-impressão antes do pagamento, com a etiqueta "Falta pagamento".'
                        : 'Retirar a autorização? Itens que ainda estão na arte só vão para a pré-impressão depois do pagamento.';
  if (!await confirmar(msg, autorizar ? 'Autorizar' : 'Retirar autorização')) return;
  await api('autorizar_sem_pagamento', { pedido_id: p.id, autorizar }); toast(autorizar ? 'Autorizado produzir sem pagamento.' : 'Autorização retirada.'); recarregar();
}
function alertaPagamentoPedido(p, cancelado) {
  if (cancelado || !p.forma_pagamento || !p.sem_pagamento) return '';
  const meu = ['diretor','administrador'].includes(S.usuario.perfil) || (pode('cria_pedidos') && (p.vendedor_id === S.usuario.id || p.criado_por === S.usuario.id));
  if (FORMAS_LIBERAM.includes(p.forma_pagamento)) return `<div class="alerta" style="margin-bottom:12px">Ainda sem pagamento. Como a forma é <b>${esc(FORMAS_COMB[p.forma_pagamento])}</b>, os itens podem seguir para a pré-impressão (com a etiqueta "Falta pagamento").</div>`;
  if (p.autoriza_sem_pagamento) return `<div class="alerta" style="margin-bottom:12px"><b>Autorizado produzir sem pagamento</b>${p.autorizado_por_nome ? ' por ' + esc(p.autorizado_por_nome) : ''}${p.autorizado_em ? ' em ' + dataHora(p.autorizado_em) : ''}.
    ${meu && !(p.itens || []).some(i => ordemStatus(i.status) >= 3 && i.status !== 'cancelado') ? `<button class="btn link peq" onclick="autorizarSemPagamento(false)">Retirar autorização</button>` : ''}</div>`;
  return `<div class="alerta erro" style="margin-bottom:12px"><b>Sem pagamento:</b> a arte só vai para a pré-impressão depois do pagamento ou com autorização do vendedor.
    ${meu ? `<button class="btn peq" style="margin-left:8px" onclick="autorizarSemPagamento(true)">Autorizar produzir sem pagamento</button>` : ''}</div>`;
}
function trocarComprovante(id) {
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = EXT_COMP;
  inp.onchange = async () => {
    const a = inp.files[0]; if (!a) return;
    let r;
    try { r = await aguarde('Trocando comprovante…', async () => api('receb_anexo', { id, comprovante_path: await enviarComprovante(a, id) })); }
    catch { return; }
    toast(r && r.drive_ok === false ? 'Comprovante trocado, mas o Drive não respondeu ao tirar o anterior. Confira a pasta do pedido.' : 'Comprovante trocado.', r && r.drive_ok === false);
    recarregar();
  };
  inp.click();
}
function modalLinkPagamento(id) {
  const r = S.parcelas[id];
  const m = abrirModal({ titulo: 'Link de pagamento', corpo: `<label class="campo">Link (Cielo)<input type="url" id="lk-url" value="${esc(r.link_pagamento || '')}" placeholder="https://"></label>`,
    rodape: `<button class="btn" data-v>Voltar</button><button class="btn prim" data-s>Salvar link</button>` });
  m.el.querySelector('[data-v]').onclick = m.fechar;
  m.el.querySelector('[data-s]').onclick = async () => {
    const v = $('#lk-url', m.el).value.trim();
    if (v && !urlSegura(v)) return toast('O link precisa começar com https://', true);
    await api('receb_anexo', { id, link_pagamento: v }); m.fechar(); toast('Link salvo.'); recarregar();
  };
}
/* ---------- LINK DE PAGAMENTO DA CIELO (Módulo 6, Fase 3) — criado pelo n8n ([GVH] Cielo); o valor vem do banco ---------- */
// coluna Forma: link da Cielo (com validade) ou link colado à mão
function htmlLinkPagamento(r) {
  const u = urlSegura(r.link_pagamento);
  if (r.situacao === 'aberto' && r.cielo_situacao === 'ativo' && u) return `<div class="small"><a href="${esc(u)}" target="_blank" rel="noopener">Link da Cielo</a>
    · até ${esc(r.cielo_parcelas_max || 3)}x · vale até ${esc(dataHora(r.cielo_expira_em))}
    <button class="btn link peq" onclick="copiarLinkPagamento('${r.id}')">Copiar</button></div>`;
  if (r.situacao === 'aberto' && r.cielo_situacao === 'vencido') return `<div>${badge('Link da Cielo vencido', 'b-ambar')}</div>`;
  if (r.situacao === 'pago' && r.cielo_situacao === 'pago') return '';
  return u ? `<div><a class="small" href="${esc(u)}" target="_blank" rel="noopener">Link de pagamento</a></div>` : '';
}
// botões do pagamento em cartão em aberto (o link manual continua só para o vendedor do pedido e o financeiro)
function botoesLinkCielo(r, manual) {
  const ativo = r.cielo_situacao === 'ativo';
  return (ativo ? `<button class="btn link peq" onclick="criarLinkCielo('${r.id}', true)">Trocar link</button>`
               : `<button class="btn peq" onclick="criarLinkCielo('${r.id}', ${r.cielo_situacao === 'vencido'})">${r.cielo_situacao === 'vencido' ? 'Criar outro link' : 'Criar link de pagamento'}</button>`)
    + (ativo || !manual ? '' : `<button class="btn link peq" onclick="modalLinkPagamento('${r.id}')" title="Para parcelado com juros, gerado no site da Cielo">${r.link_pagamento ? 'Trocar link manual' : 'Colar link manual'}</button>`);
}
async function criarLinkCielo(id, trocar) {
  if (trocar && !await confirmar('Criar um link novo? O link atual deixa de funcionar na Cielo e o cliente precisa usar o novo.', 'Criar link novo')) return;
  let r;
  try { r = await aguarde('Criando o link na Cielo…', () => api('cielo_link', { id, trocar: !!trocar })); }
  catch { return; }
  recarregar();
  mostrarLinkCielo(r.url, r.expira_em);
}
function mostrarLinkCielo(url, expira) {
  const u = urlSegura(url); if (!u) return toast('Link criado. Ele aparece no pagamento.');
  const m = abrirModal({ titulo: 'Link de pagamento criado', corpo: `
    <p class="small" style="margin:0 0 10px">Mande este link ao cliente. Ele aceita cartão de crédito sem juros e vale até <b>${esc(dataHora(expira))}</b>. Quando o cliente pagar, o pagamento é marcado sozinho (em poucos minutos; no máximo em meia hora).</p>
    <input type="text" readonly value="${esc(u)}" data-lk style="width:100%">`,
    rodape: `<button class="btn" data-v>Fechar</button><button class="btn prim" data-c>Copiar link</button>` });
  m.el.querySelector('[data-v]').onclick = m.fechar;
  m.el.querySelector('[data-lk]').onfocus = e => e.target.select();
  m.el.querySelector('[data-c]').onclick = async () => { if (await copiarTexto(u)) { toast('Link copiado.'); m.fechar(); } };
}
async function copiarTexto(t) {
  try { await navigator.clipboard.writeText(t); return true; }
  catch { toast('Não deu para copiar sozinho. Selecione o link e copie com Ctrl+C.', true); return false; }
}
async function copiarLinkPagamento(id) {
  const u = urlSegura((S.parcelas[id] || {}).link_pagamento); if (u && await copiarTexto(u)) toast('Link copiado.');
}

const etqPag = i => i.pedido_sem_pagamento ? ' ' + badge('Falta pagamento', 'b-vermelho') : '';

/* ---------- CLIENTE (seletor + cadastro rápido) ---------- */
function ligarBuscaCliente(input, aoEscolher) {
  const box = input.parentElement; let t;
  const res = document.createElement('div'); res.className = 'busca-res hidden'; box.appendChild(res);
  input.addEventListener('input', () => {
    clearTimeout(t); const q = input.value.trim();
    if (q.length < 2) { res.classList.add('hidden'); return; }
    t = setTimeout(async () => {
      const r = await api('buscar_clientes', { busca: q, limite: 12 }, true).catch(() => ({ clientes: [] }));
      res.innerHTML = r.clientes.map(c => `<div data-id="${c.id}"><b>${esc(c.nome_fantasia || c.nome)}</b><div class="small muted">${esc(c.nome_fantasia ? c.nome : '')} ${esc(fmtDoc(c.cpf_cnpj))} ${esc(fmtTel(c.whatsapp || c.telefone))}</div></div>`).join('')
        + (pode('cadastra_clientes') ? `<div data-novo><b style="color:var(--verde)">Cadastrar novo cliente</b></div>` : '');
      res.classList.remove('hidden');
      res.querySelectorAll('[data-id]').forEach(d => d.onclick = () => { const c = r.clientes.find(x => x.id === d.dataset.id); res.classList.add('hidden'); aoEscolher(c); });
      const nv = res.querySelector('[data-novo]'); if (nv) nv.onclick = () => { res.classList.add('hidden'); modalCliente(null, c => aoEscolher(c), q); };
    }, 300);
  });
  document.addEventListener('click', e => { if (!box.contains(e.target)) res.classList.add('hidden'); });
}
function enderecoCliente(c) {
  return [c.logradouro && `${c.logradouro}${c.numero ? ', ' + c.numero : ''}`, c.complemento, c.bairro, c.cidade && `${c.cidade}${c.uf ? '/' + c.uf : ''}`, c.cep].filter(Boolean).join(' · ');
}
async function modalCliente(id, aoSalvar, nomeInicial = '') {
  const ehDoc = /^[\d.\-\/\s]+$/.test(nomeInicial) && [11, 14].includes(soDoc(nomeInicial).length);
  let c = { contatos: [], nome: ehDoc ? '' : nomeInicial, cpf_cnpj: ehDoc ? soDoc(nomeInicial) : '', telefone_whatsapp: true };
  if (id) c = (await api('obter_cliente', { id })).cliente;
  const podeEditar = pode('cadastra_clientes'); const dis = podeEditar ? '' : 'disabled';
  const campo = (n, rot, extra = '', attrs = '') => `<label class="campo" ${attrs}>${rot}<input type="text" name="${n}" value="${esc(c[n] ?? '')}" ${extra} ${dis}></label>`;
  const aniv = c.aniversario_dia ? `${String(c.aniversario_dia).padStart(2, '0')}/${String(c.aniversario_mes).padStart(2, '0')}` : '';
  const m = abrirModal({ titulo: id ? (c.nome_fantasia || c.nome) : 'Novo cliente', largo: true, corpo: `
    <form id="f-cli" class="grade g3" autocomplete="off">
      <label class="campo">CPF / CNPJ<input type="text" name="cpf_cnpj" value="${esc(fmtDoc(c.cpf_cnpj))}" maxlength="18" style="text-transform:uppercase" placeholder="Digite primeiro o documento" ${dis}></label>
      <div id="doc-info" class="small muted" style="grid-column:span 2;align-self:end;padding-bottom:10px"></div>
      <div id="doc-dup" class="alerta erro hidden" style="grid-column:1/-1"></div>
      <div id="cli-resto" class="grade g3 hidden" style="grid-column:1/-1">
        <label class="campo" style="grid-column:span 2"><span id="rot-nome">Nome</span><input type="text" name="nome" value="${esc(c.nome || '')}" ${dis}></label>
        ${campo('nome_fantasia', 'Nome fantasia', '', 'data-tipo="PJ"')}
        ${campo('inscricao_estadual', 'Inscrição estadual', '', 'data-tipo="PJ"')}
        ${campo('segmento', 'Segmento', 'list="dl-seg" placeholder="Ex.: Restaurante"', 'data-tipo="PJ"')}
        ${campo('aniversario', 'Aniversário (dia/mês)', `placeholder="DD/MM" maxlength="5" value="${aniv}"`, 'data-tipo="PF"').replace(`value="" placeholder`, 'placeholder')}
        <label class="campo">Telefone<input type="text" name="telefone" value="${esc(fmtTel(c.telefone))}" placeholder="(11) 99999-9999" ${dis}></label>
        <label class="check" style="align-self:end;padding-bottom:9px"><input type="checkbox" name="telefone_whatsapp" ${c.telefone_whatsapp ? 'checked' : ''} ${dis}> É WhatsApp</label>
        <label class="check" style="align-self:end;padding-bottom:9px"><input type="checkbox" name="revenda" ${c.revenda ? 'checked' : ''} ${dis}> Revenda</label>
        ${campo('email', 'E-mail')}${campo('instagram', 'Instagram', 'placeholder="@perfil"')}
        ${campo('cep', 'CEP')}${campo('logradouro', 'Endereço')}${campo('numero', 'Número')}
        ${campo('complemento', 'Complemento')}${campo('bairro', 'Bairro')}${campo('cidade', 'Cidade')}
        ${campo('uf', 'UF', 'maxlength="2"')}
        <label class="campo" style="grid-column:1/-1">Observação fixa do cliente <span class="muted">(uso interno — aparece em destaque em todos os pedidos deste cliente)</span><textarea name="observacoes" ${dis}>${esc(c.observacoes || '')}</textarea></label>
      </div>
      <datalist id="dl-seg">${(S.base?.segmentos || []).map(s => `<option value="${esc(s)}">`).join('')}</datalist>
    </form>
    <div id="cli-contatos" class="hidden"><div class="painel-cab" style="margin-bottom:6px"><h3>Contatos</h3>${podeEditar ? '<button type="button" class="btn peq" id="add-contato">Adicionar contato</button>' : ''}</div>
      <div id="contatos"></div></div>
    ${id ? '<div data-cli-gab></div>' : ''}
    ${c.pedidos && c.pedidos.length ? `<div><h3 style="margin-bottom:6px">Últimos pedidos</h3><table><tbody>${c.pedidos.map(p => `<tr class="clicavel" onclick="location.hash='#/pedido/${p.id}';document.querySelector('.fundo-modal')?.remove()"><td><b>${esc(p.numero)}</b></td><td>${data(p.created_at)}</td><td>${esc(p.status_nome)}</td>${pode('ve_valores') ? `<td class="dir num">${brl(p.valor_total)}</td>` : ''}</tr>`).join('')}</tbody></table></div>` : ''}`,
    rodape: podeEditar ? `<button class="btn" data-v>Voltar</button><button class="btn prim" data-s>Salvar cliente</button>` : `<button class="btn" data-v>Fechar</button>` });
  const f = $('#f-cli', m.el); const s = m.el.querySelector('[data-s]');
  if (id) carregarGabaritos().then(() => {
    const box = m.el.querySelector('[data-cli-gab]'); if (!box) return;
    const lista = gruposGabarito().flatMap(gr => gr.gabaritos.filter(g => g.cliente_id === id && g.ativo).map(g => ({ gr, g })));
    if (!lista.length) return;
    box.innerHTML = blocoExp('cli-gab-' + id, `<b>Gabaritos deste cliente</b> <span class="small muted">(${lista.length})</span>`,
      lista.map(({ gr, g }) => `<div class="small" style="padding:4px 0">${esc(gr.nome)} › <b>${esc(g.nome)}</b> · ${textoMedidas(g)} · ${esc(textoCondicao(g))}${g.arquivo_url ? ` · <a href="${esc(g.arquivo_url)}" target="_blank" rel="noopener">Abrir</a>` : ''}</div>`).join(''), false);
  }).catch(() => {});
  let tipo = id && c.cpf_cnpj ? c.tipo_pessoa : null;
  const info = (txt, erro = false) => { const e = $('#doc-info', m.el); e.textContent = txt; e.style.color = erro ? 'var(--vermelho)' : ''; };
  const aplicarTipo = () => {
    $('#cli-resto', m.el).classList.toggle('hidden', !tipo); $('#cli-contatos', m.el).classList.toggle('hidden', !tipo);
    $$('[data-tipo]', m.el).forEach(e => e.classList.toggle('hidden', e.dataset.tipo !== tipo));
    $('#rot-nome', m.el).textContent = tipo === 'PJ' ? 'Razão social' : 'Nome';
    if (s) s.disabled = !tipo;
  };
  if (tipo) info(tipo === 'PJ' ? 'Pessoa jurídica' : 'Pessoa física'); else info('Digite o CPF (11 números) ou o CNPJ (14 caracteres).');
  aplicarTipo();

  // o que veio da Receita fica marcado; se o documento mudar, sai (o que a pessoa digitou à mão fica)
  const auto = {}; let cnpjBuscado = null;
  const preencher = (n, v) => { if (v && f[n] && (!f[n].value.trim() || f[n].value === auto[n])) { f[n].value = v; auto[n] = v; } };
  const limparAuto = () => { Object.entries(auto).forEach(([n, v]) => { if (f[n] && f[n].value === v) f[n].value = ''; delete auto[n]; }); cnpjBuscado = null; };
  const buscarCnpj = async cnpj => {
    try {
      cnpjBuscado = cnpj;
      const r = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`); if (!r.ok || cnpjBuscado !== cnpj) return; const j = await r.json();
      if (cnpjBuscado !== cnpj) return;
      preencher('nome', j.razao_social); preencher('nome_fantasia', j.nome_fantasia); preencher('cep', j.cep);
      preencher('logradouro', [j.descricao_tipo_de_logradouro, j.logradouro].filter(Boolean).join(' '));
      preencher('numero', j.numero); preencher('complemento', j.complemento); preencher('bairro', j.bairro);
      preencher('cidade', j.municipio); preencher('uf', j.uf); preencher('email', (j.email || '').toLowerCase());
      if (j.ddd_telefone_1) preencher('telefone', fmtTel('55' + j.ddd_telefone_1.replace(/\D/g, '')));
      toast('Dados preenchidos pela Receita. Confira antes de salvar.');
    } catch {}
  };
  let tmr;
  f.cpf_cnpj.oninput = () => {
    const d = soDoc(f.cpf_cnpj.value); $('#doc-dup', m.el).classList.add('hidden'); clearTimeout(tmr);
    if (cnpjBuscado && d !== cnpjBuscado) limparAuto();
    if (d.length !== 11 && d.length !== 14) { info('Digite o CPF (11 números) ou o CNPJ (14 caracteres).'); if (s) s.disabled = true; return; }
    tmr = setTimeout(async () => {
      const r = await api('verificar_documento', { cpf_cnpj: d, id }, true).catch(() => null); if (!r) return;
      if (!r.tipo) { info('CPF/CNPJ inválido. Confira o que foi digitado.', true); if (s) s.disabled = true; return; }
      f.cpf_cnpj.value = fmtDoc(d);
      if (r.existente) {
        const dup = $('#doc-dup', m.el);
        dup.innerHTML = `Já existe um cliente com este documento: <b>${esc(r.existente.nome)}</b>. <button type="button" class="btn peq" style="margin-left:8px">Abrir cadastro</button>`;
        dup.classList.remove('hidden'); info(''); if (s) s.disabled = true;
        dup.querySelector('button').onclick = () => { m.fechar(); modalCliente(r.existente.id, aoSalvar); };
        return;
      }
      const eraSemTipo = !tipo; tipo = r.tipo; info(tipo === 'PJ' ? 'Pessoa jurídica' : 'Pessoa física'); aplicarTipo();
      if (tipo === 'PJ' && /^\d{14}$/.test(d)) buscarCnpj(d);
      if (eraSemTipo) f.nome.focus();
    }, 250);
  };
  f.cep.onblur = async () => {
    const cep = f.cep.value.replace(/\D/g, ''); if (cep.length !== 8) return;
    try { const r = await fetch(`https://brasilapi.com.br/api/cep/v2/${cep}`); if (!r.ok) return; const j = await r.json();
      preencher('logradouro', j.street); preencher('bairro', j.neighborhood); preencher('cidade', j.city); preencher('uf', j.state); } catch {}
  };
  if (!id) setTimeout(() => { f.cpf_cnpj.focus(); if (ehDoc) f.cpf_cnpj.oninput(); }, 50);

  let contatos = (c.contatos || []).map(x => ({ ...x, whatsapp: fmtTel(x.whatsapp) }));
  const desenharCont = () => {
    $('#contatos', m.el).innerHTML = contatos.length ? contatos.map((ct, k) => `<div class="linha-form" style="margin-bottom:8px">
      ${['nome','cargo','whatsapp','email'].map(fl => `<input type="text" placeholder="${{ nome:'Nome', cargo:'Cargo', whatsapp:'WhatsApp', email:'E-mail' }[fl]}" value="${esc(ct[fl] || '')}" data-k="${k}" data-f="${fl}" ${dis}>`).join('')}
      ${podeEditar ? `<button type="button" class="btn link peq" data-rm="${k}" style="flex:0">Remover</button>` : ''}</div>`).join('') : '<p class="small muted" style="margin:0">Nenhum contato adicional.</p>';
    $$('#contatos [data-f]', m.el).forEach(i => i.oninput = () => contatos[i.dataset.k][i.dataset.f] = i.value);
    $$('#contatos [data-rm]', m.el).forEach(b => b.onclick = () => { contatos.splice(b.dataset.rm, 1); desenharCont(); });
  };
  desenharCont();
  if ($('#add-contato', m.el)) $('#add-contato', m.el).onclick = () => { contatos.push({}); desenharCont(); };
  m.el.querySelector('[data-v]').onclick = m.fechar;
  if (s) s.onclick = async () => {
    const d = formDados(f); d.contatos = contatos; if (id) d.id = id;
    d.telefone_whatsapp = f.telefone_whatsapp.checked; d.revenda = f.revenda.checked;
    const r = await api('salvar_cliente', d); m.fechar(); toast('Cliente salvo.');
    if (d.segmento && S.base?.segmentos && !S.base.segmentos.some(x => x.toLowerCase() === d.segmento.trim().toLowerCase())) S.base.segmentos.push(d.segmento.trim());
    if (aoSalvar) aoSalvar({ ...d, id: r.id, cpf_cnpj: soDoc(d.cpf_cnpj), tipo_pessoa: tipo });
  };
}

/* ---------- CONFERÊNCIA COM O FORNECEDOR (16/10) ----------
   Só enquanto o vendedor lança o produto (pedido, orçamento ou item avulso): lê o texto, indica material/gabarito
   e avisa o que não existe no offset. Nada fica gravado nem aparece depois.
   (21/10) Quando a quantidade não sai no offset, sugere até 3 opções que saem (outro papel no mesmo tamanho, formato um pouco
   maior com refile para o tamanho exato, ou tamanho bem próximo). "Usar" troca a descrição e a conferência roda de novo. */
function htmlConferencia(r, descricao) {
  if (!r) return textoMaterialSugerido(descricao);
  const gab = r.material_nome ? `Gabarito: <b>${esc(r.material_nome)}${r.gabarito_nome ? ' › ' + esc(r.gabarito_nome) : ''}</b> <span class="muted">(sugerido; dá para trocar no pedido)</span>` : textoMaterialSugerido(descricao);
  const alt = (r.alternativas || []).length ? `<div class="alt-forn"><b>Dá para fazer no offset</b> (qualidade melhor que a digital):<ul>${r.alternativas.map(a =>
      `<li>${esc(a.texto)}${a.descricao && a.descricao !== descricao ? `<button type="button" data-usar-desc="${esc(a.descricao)}" title="Trocar a descrição para: ${esc(a.descricao)}">Usar</button>` : ''}</li>`).join('')}</ul></div>` : '';
  return gab + (r.avisos || []).map(t => `<div class="aviso-forn">⚠ ${esc(t)}</div>`).join('') + alt
             + (r.infos || []).map(t => `<div class="info-forn">${esc(t)}</div>`).join('');
}
// "Usar" numa alternativa do offset: troca a descrição do item e dispara a conferência de novo
document.addEventListener('click', e => {
  const b = e.target.closest && e.target.closest('[data-usar-desc]'); if (!b) return;
  e.preventDefault();
  const mat = b.closest('[data-mat]'), conf = b.closest('#it-conf');
  const inp = mat ? mat.parentElement.querySelector('[data-f="descricao"]') : conf ? (conf.closest('form') || document).querySelector('[name="descricao"]') : null;
  if (!inp) return;
  inp.value = b.dataset.usarDesc;
  inp.dispatchEvent(new Event('input', { bubbles: true }));
  toast('Descrição trocada. Confira com o cliente antes de fechar.');
});
function agendarConferencia(alvo, chave, descricao, quantidade, aoChegar) {
  if (!pode('cria_pedidos')) return;
  alvo._confT = alvo._confT || {}; clearTimeout(alvo._confT[chave]);
  const d = String(descricao || '').trim();
  if (d.length < 6) { aoChegar(null); return; }
  alvo._confT[chave] = setTimeout(async () => {
    const r = await api('conferir_produto', { descricao: d, quantidade: Number(quantidade) || null }, true).catch(() => null);
    aoChegar(r);
  }, 600);
}

/* ---------- EDITOR DE ITENS (novo pedido / orçamento) ---------- */
// Material de gabarito indicado pelo produto sugerido (mesma regra do banco: "…" vale qualquer coisa; o texto mais longo ganha)
function materialPorDescricao(t) {
  const d = String(t || '').trim().toLowerCase(); if (!d) return null;
  const escRe = x => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const c = (S.base?.sugestoes || []).filter(x => x.ativo && x.gabarito_grupo_id).filter(x => {
    try { return new RegExp('^' + x.texto.trim().toLowerCase().split(/…|\.\.\./).map(escRe).join('.*') + '$').test(d); } catch (e) { return false; }
  }).sort((a, b) => b.texto.length - a.texto.length)[0];
  return c ? gruposGabarito().find(g => g.id === c.gabarito_grupo_id) || null : null;
}
const textoMaterialSugerido = t => { const g = materialPorDescricao(t); return g ? `Gabarito: <b>${esc(g.nome)}</b> <span class="muted">(sugerido; dá para trocar no pedido)</span>` : ''; };
// Selo Digital no lançamento do item (pedido): sugerido pela conferência; o vendedor pode marcar ou desmarcar
function htmlDigitalEditor(it, k) {
  const regra = !!(it._conf && it._conf.digital && it._conf.digital.digital);
  if (it._conf && it._conf.digital && it._conf.digital.motivo_nao) { it.digital_manual = null; return `<span class="muted">Só offset: não vai para a digital.</span>`; }
  const marcado = it.digital_manual != null ? it.digital_manual : regra;
  if (!marcado && !regra && it.digital_manual == null && !(it.descricao || '').trim()) return '';
  return `<label class="check" style="margin:4px 0 0;display:inline-flex;gap:6px;align-items:center" title="Máquina digital (Konica): quantidades pequenas e mesmo dia">
      <input type="checkbox" data-digk="${k}" ${marcado ? 'checked' : ''}> <span class="badge ${marcado ? 'b-digital' : 'b-cinza'}">Digital</span></label>
    <span class="muted">${it.digital_manual != null ? (it.digital_manual ? 'marcado por você' : 'desmarcado por você') : regra ? esc(it._conf.digital.motivo || 'pela regra') : 'muito urgente também vai sozinho'}</span>`;
}
// "para 2 modelos" → 2 (de 1 a 20; o banco usa a mesma regra em fn_qtd_modelos_texto)
function qtdModelosTexto(t) {
  const m = String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().match(/(?:^|\D)(\d{1,2})\s*modelos?\b/);
  const n = m ? parseInt(m[1], 10) : 0; return n >= 1 && n <= 20 ? n : 0;
}
function editorItens(alvo, itensIniciais, { comStatus = false, aoMudar, comDigital = false } = {}) {
  if (!S.cache.gabaritos) carregarGabaritos().then(() => itens.forEach((it, k) => { const b = $(`[data-mat="${k}"]`, alvo); if (b) b.innerHTML = textoMaterialSugerido(it.descricao); })).catch(() => {});
  const novo = () => ({ quantidade: 1, valor_total: '', status: 'arte_a_fazer' });
  let itens = itensIniciais.length ? itensIniciais.map(x => ({ ...x, qtd_artes: x.qtd_artes || qtdModelosTexto(x.descricao) || 1, _catManual: true })) : [novo()];
  const podeCad = podeNovaCategoria();
  const timers = {};
  const desenhar = () => {
    alvo.innerHTML = `<div class="tabela-wrap"><table class="itens-editor"><thead><tr>
        <th style="min-width:260px">Produto * <span class="muted">(vai para o cliente)</span></th>
        <th style="min-width:170px">Observação <span class="muted">(interna)</span></th><th style="width:90px">Qtd. *</th>
        <th style="width:130px">Total (R$) *</th><th data-col="status" style="width:80px" title="Quantos modelos (artes diferentes) o item tem">Modelos</th><th data-col="status" style="min-width:160px">Status inicial</th><th></th></tr></thead>
      <tbody>${itens.map((it, k) => `<tr>
        <td>${htmlCatLinha(`<select data-k="${k}" data-f="categoria_id" style="font-size:12px;padding:3px 6px;max-width:320px">${opcoesCategoria(it.categoria_id, podeCad)}</select>`, `data-sug="${k}"`)}
          <input type="text" list="dl-sugestoes" autocomplete="off" placeholder="Digite ou escolha: Folheto 10x14…" value="${esc(it.descricao || '')}" data-k="${k}" data-f="descricao"><div class="small muted" data-mat="${k}">${it._conf ? htmlConferencia(it._conf, it.descricao) : textoMaterialSugerido(it.descricao)}</div>
          ${comDigital ? `<div class="small" data-dig="${k}">${htmlDigitalEditor(it, k)}</div>` : ''}</td>
        <td><input type="text" placeholder="Só a equipe vê" value="${esc(it.observacao || '')}" data-k="${k}" data-f="observacao"></td>
        <td><input type="number" step="any" min="0" value="${esc(it.quantidade)}" data-k="${k}" data-f="quantidade"></td>
        <td><input type="number" step="0.01" min="0" value="${esc(it.valor_total)}" data-k="${k}" data-f="valor_total"><div class="unit-calc" data-u="${k}">Unit. ${unitario(it.valor_total, it.quantidade)}</div></td>
        <td data-col="status">${comStatus ? `<input type="number" min="1" max="20" step="1" value="${esc(STATUS_ARTE_PRONTA.includes(it.status) ? 1 : it.qtd_artes || 1)}" data-k="${k}" data-f="qtd_artes" title="Ex.: cartão com 2 modelos de 200 cada = 2" ${STATUS_ARTE_PRONTA.includes(it.status) ? 'disabled' : ''}>` : ''}</td>
        <td data-col="status">${comStatus ? `<select data-k="${k}" data-f="status">${opcoesStatusInicial(it.status, { origNum: it._orig ? it._origNum : null, cliente: !pode('so_painel_arte') })}</select>` : ''}</td>
        <td>${itens.length > 1 ? `<button type="button" class="btn link peq" data-rm="${k}">Remover</button>` : ''}</td></tr>`).join('')}
      </tbody></table></div>
      <button type="button" class="btn peq" id="add-item" style="margin-top:8px">Adicionar outro item</button>`;
    alvo.classList.toggle('ocultar-status', !comStatus);
    const atualizarUnit = k => { const u = $(`[data-u="${k}"]`, alvo); if (u) u.textContent = 'Unit. ' + unitario(itens[k].valor_total, itens[k].quantidade); };
    const sugerirCat = k => {
      const it = itens[k]; const l = sugerirCategorias(it.descricao);
      if (!it._catManual && l[0] && it.categoria_id !== l[0].id) { it.categoria_id = l[0].id; const sel = $(`[data-k="${k}"][data-f=categoria_id]`, alvo); if (sel) sel.value = l[0].id; }
      const box = $(`[data-sug="${k}"]`, alvo); if (!box) return;
      box.innerHTML = l.length > 1 ? '· também: ' + l.slice(1).map(c => `<a href="#" data-k2="${k}" data-cat="${c.id}" title="${esc(c.nome)}">${esc(catCurta(c.nome))}</a>`).join(' · ') : '';
      $$(`[data-k2="${k}"]`, box).forEach(a => a.onclick = e => { e.preventDefault(); it.categoria_id = a.dataset.cat; it._catManual = true;
        const sel = $(`[data-k="${k}"][data-f=categoria_id]`, alvo); if (sel) sel.value = it.categoria_id; });
    };
    $$('[data-f]', alvo).forEach(el => el.onchange = el.oninput = e => {
      const k = Number(el.dataset.k); const it = itens[k]; const f = el.dataset.f;
      if (f === 'categoria_id') {
        if (e.type === 'input') return;
        if (el.value === '__nova') { el.value = it.categoria_id || ''; modalCategoria(null, id => { it.categoria_id = id; it._catManual = true; desenhar(); }); return; }
        it.categoria_id = el.value; it._catManual = true; aoMudar && aoMudar(itens); return;
      }
      it[f] = el.value;
      if (f === 'qtd_artes') { it._modManual = true; aoMudar && aoMudar(itens); return; }
      if (f === 'status') {   // arte que já existe (pedido repetido ou arquivo do cliente) = 1 modelo
        const cm = $(`[data-k="${k}"][data-f=qtd_artes]`, alvo), fixo = STATUS_ARTE_PRONTA.includes(el.value);
        if (cm) { cm.disabled = fixo; cm.value = fixo ? 1 : it.qtd_artes || 1; }
        aoMudar && aoMudar(itens); return;
      }
      // "2 modelos" no texto já preenche a coluna Modelos (o vendedor pode corrigir)
      if (f === 'descricao' && !it._modManual) {
        const n = qtdModelosTexto(el.value); it.qtd_artes = n || 1;
        const cm = $(`[data-k="${k}"][data-f=qtd_artes]`, alvo); if (cm) cm.value = it.qtd_artes;
      }
      if (f === 'descricao') { const bm = $(`[data-mat="${k}"]`, alvo); if (bm) bm.innerHTML = it._conf ? htmlConferencia(it._conf, el.value) : textoMaterialSugerido(el.value); }
      if (f === 'descricao' || f === 'quantidade') {
        it._ck = it._ck || ('c' + Math.random().toString(36).slice(2));
        agendarConferencia(alvo, it._ck, it.descricao, it.quantidade, r => {
          it._conf = r; const j = itens.indexOf(it); const bm = j >= 0 && $(`[data-mat="${j}"]`, alvo);
          if (bm) bm.innerHTML = htmlConferencia(r, it.descricao);
          desenharDigital(j);
        });
      }
      if (f === 'descricao') {
        const sg = sugestaoPorTexto(el.value);
        if (sg) {
          // escolheu um produto sugerido: categoria vem junto; com "…", seleciona para o vendedor digitar a medida
          it.categoria_id = sg.categoria_id; it._catManual = true;
          const sel = $(`[data-k="${k}"][data-f=categoria_id]`, alvo); if (sel) sel.value = sg.categoria_id;
          const box = $(`[data-sug="${k}"]`, alvo); if (box) box.innerHTML = '';
          const i = el.value.indexOf('…'); if (i >= 0) setTimeout(() => { try { el.focus(); el.setSelectionRange(i, i + 1); } catch {} }, 0);
        } else sugerirCat(k);
      }
      if (f === 'quantidade' || f === 'valor_total') atualizarUnit(k);
      aoMudar && aoMudar(itens);
    });
    $$('[data-rm]', alvo).forEach(b => b.onclick = () => { itens.splice(b.dataset.rm, 1); desenhar(); });
    itens.forEach((_, k) => ligarDigital(k));
    $('#add-item', alvo).onclick = () => { const ult = itens[itens.length - 1]?.status;
      itens.push({ ...novo(), status: ult && ult !== '__copiar' ? ult : 'arte_a_fazer' }); desenhar(); };
    ligarCatLinhas(alvo); atualizarCatLinhas(alvo);
    aoMudar && aoMudar(itens);
  };
  function ligarDigital(k) {
    const cb = $(`[data-digk="${k}"]`, alvo); if (!cb) return;
    cb.onchange = () => { const it = itens[k]; const regra = !!(it._conf && it._conf.digital && it._conf.digital.digital);
      it.digital_manual = cb.checked === regra ? null : cb.checked; desenharDigital(k); };
  }
  function desenharDigital(k) {
    const box = k >= 0 && $(`[data-dig="${k}"]`, alvo); if (!box) return;
    box.innerHTML = htmlDigitalEditor(itens[k], k); ligarDigital(k);
  }
  desenhar();
  const usado = i => (i.descricao || '').trim() || i.categoria_id || Number(i.valor_total);
  // _orig / _testar são só da tela (quem chama tira antes de mandar ao banco)
  const pegar = () => itens.filter(usado).map(i => {
    const esp = !comStatus ? {} : i.status === '__copiar' && i._orig ? { _orig: i._orig } : i.status === '__cliente' ? { _testar: true } : {};
    const fixo = STATUS_ARTE_PRONTA.includes(i.status);
    return { categoria_id: i.categoria_id, descricao: (i.descricao || '').trim(), observacao: i.observacao || '',
      especificacao: i.especificacao || '', quantidade: i.quantidade, valor_total: i.valor_total, status: fixo ? 'arte_a_fazer' : i.status,
      ...(comStatus ? { qtd_artes: fixo ? 1 : Math.min(20, Math.max(1, parseInt(i.qtd_artes, 10) || 1)) } : {}),
      ...(comDigital && i.digital_manual != null ? { digital_manual: i.digital_manual } : {}), ...esp };
  });
  pegar.semTela = l => l.map(({ _orig, _testar, ...x }) => x);
  pegar.definirStatus = v => { comStatus = v; alvo.classList.toggle('ocultar-status', !v); };
  pegar.incompletos = () => itens.filter(usado).filter(i => !(i.descricao || '').trim() || !i.categoria_id
    || !(Number(i.quantidade) > 0) || i.valor_total === '' || i.valor_total == null).length;
  return pegar;
}

/* ---------- ENTREGA (V3) — novo pedido, editar pedido, alterar entrega e conversão de orçamento ---------- */
function htmlEntrega(v = {}) {
  const forma = v.forma_entrega || 'retirada';
  return `<div data-ent style="grid-column:1/-1">
    <input type="hidden" name="forma_entrega" value="${forma}"><input type="hidden" name="endereco_entrega" value="${esc(v.endereco_entrega || '')}">
    <div class="chips" data-ent-forma><button type="button" class="chip" data-ent="retirada">Retira no balcão</button><button type="button" class="chip" data-ent="entrega">Entregar no cliente</button></div>
    <div data-ent-corpo style="margin-top:10px"></div></div>`;
}
function ligarEntrega(el) {
  const raiz = el.querySelector('[data-ent]');
  const hForma = raiz.querySelector('[name=forma_entrega]'), hEnd = raiz.querySelector('[name=endereco_entrega]');
  const corpo = raiz.querySelector('[data-ent-corpo]');
  let endEntrega = hForma.value === 'entrega' ? hEnd.value : '', manual = !!endEntrega, cepInfo = null;
  const render = () => {
    const f = hForma.value;
    raiz.querySelectorAll('[data-ent-forma] .chip').forEach(b => b.classList.toggle('ativo', b.dataset.ent === f));
    if (f === 'retirada') { hEnd.value = EMPRESA.endereco; corpo.innerHTML = `<div class="small">Balcão: ${esc(EMPRESA.endereco)}</div>`; return; }
    hEnd.value = endEntrega;
    corpo.innerHTML = `<div class="grade g4">
        <label class="campo">CEP<input type="text" data-e="cep" maxlength="9" inputmode="numeric" placeholder="Buscar endereço"></label>
        <label class="campo">Número<input type="text" data-e="num"></label>
        <label class="campo" style="grid-column:span 2">Complemento<input type="text" data-e="comp"></label></div>
      <label class="campo" style="margin-top:8px">Endereço de entrega<input type="text" data-e="end" value="${esc(endEntrega)}"></label>
      <div class="small muted" data-e="dica" style="margin-top:4px">${endEntrega ? '' : 'Digite o CEP ou escreva o endereço completo.'}</div>`;
    const q = k => corpo.querySelector(`[data-e="${k}"]`);
    const montar = () => {
      if (!cepInfo) return;
      const c = cepInfo, num = q('num').value.trim(), comp = q('comp').value.trim();
      endEntrega = [`${c.street || ''}${num ? ', ' + num : ''}`.trim(), comp, c.neighborhood, c.city && `${c.city}/${c.state}`, 'CEP ' + c.cep].filter(Boolean).join(' · ');
      q('end').value = endEntrega; hEnd.value = endEntrega; manual = true;
    };
    q('end').oninput = () => { endEntrega = q('end').value; hEnd.value = endEntrega; manual = true; };
    q('num').oninput = q('comp').oninput = montar;
    q('cep').oninput = async () => {
      const cep = q('cep').value.replace(/\D/g, ''); if (cep.length !== 8) return;
      const fmt = cep.replace(/^(\d{5})(\d{3})$/, '$1-$2'); q('cep').value = fmt; q('dica').textContent = 'Buscando…';
      try {
        const r = await fetch(`https://brasilapi.com.br/api/cep/v2/${cep}`); if (!r.ok) throw new Error();
        cepInfo = { ...(await r.json()), cep: fmt }; montar(); q('dica').textContent = 'Confira o número e o complemento.'; q('num').focus();
      } catch { cepInfo = null; q('dica').textContent = 'CEP não encontrado. Escreva o endereço completo.'; }
    };
  };
  raiz.querySelectorAll('[data-ent-forma] .chip').forEach(b => b.onclick = () => { hForma.value = b.dataset.ent; render(); });
  render();
  return {
    forma: () => hForma.value,
    endereco: () => hEnd.value,
    definirCliente: c => { if (manual) return; endEntrega = c ? enderecoCliente(c) : ''; cepInfo = null; render(); }
  };
}
const somaDiasUteis = (d, n) => { const x = new Date(d + 'T12:00:00'); let k = 0; while (k < n) { x.setDate(x.getDate() + 1); if (x.getDay() % 6) k++; } return x.toISOString().slice(0, 10); };
const textoPrazo = n => n ? `${n} ${Number(n) === 1 ? 'dia útil' : 'dias úteis'} após entrar em produção` : '';
/* V14: desconto em R$ ou % (no %, o banco recalcula o valor quando os itens mudam) */
function htmlDesconto(id, v = {}) {
  const pct = Number(v.desconto_percentual) > 0;
  return `<div class="campo"><span>Desconto <span class="desc-tipo" data-desc-tipo="${id}"><button type="button" data-t="rs" class="${pct ? '' : 'ativo'}">R$</button><button type="button" data-t="pc" class="${pct ? 'ativo' : ''}">%</button></span></span>
    <input type="number" step="0.01" min="0" ${pct ? 'max="100"' : ''} id="${id}" data-pct="${pct ? 1 : 0}" value="${esc(pct ? Number(v.desconto_percentual) : Number(v.desconto || 0))}"><span class="unit-calc" id="${id}-calc"></span></div>`;
}
const descPct = inp => inp.dataset.pct === '1';
const descontoValor = (inp, base) => { const v = Number(inp.value || 0); return descPct(inp) ? Math.round(base * v) / 100 : v; };
const descontoDados = inp => descPct(inp) ? { desconto: '', desconto_percentual: inp.value || '' } : { desconto: inp.value || 0, desconto_percentual: '' };
function ligarDesconto(raiz, id, base, aoMudar) {
  const inp = raiz.querySelector('#' + id), box = raiz.querySelector(`[data-desc-tipo="${id}"]`), calc = raiz.querySelector('#' + id + '-calc');
  const mostrar = () => { calc.textContent = descPct(inp) && Number(inp.value) ? '= ' + brl(descontoValor(inp, base())) : ''; };
  box.querySelectorAll('button').forEach(b => b.onclick = () => {
    const pc = b.dataset.t === 'pc'; if (pc === descPct(inp)) return;
    const b0 = base(), v = Number(inp.value || 0);
    const nv = !v ? 0 : pc ? (b0 > 0 ? Math.round(v / b0 * 10000) / 100 : 0) : descontoValor(inp, b0).toFixed(2);
    inp.dataset.pct = pc ? '1' : '0'; inp.value = nv; if (pc) inp.max = 100; else inp.removeAttribute('max');
    box.querySelectorAll('button').forEach(x => x.classList.toggle('ativo', x === b));
    mostrar(); if (aoMudar) aoMudar();
  });
  inp.addEventListener('input', () => { mostrar(); if (aoMudar) aoMudar(); });
  mostrar();
  return { atualizar: mostrar, valor: () => descontoValor(inp, base()), dados: () => descontoDados(inp),
           validar: () => { if (descPct(inp) && Number(inp.value) > 100) throw new Error('O desconto em porcentagem vai até 100%.'); } };
}
/* V19: 5% de desconto no Pix à vista (fixo), sobre itens menos desconto; frete não entra */
const PIX_PCT = 5;
const valorPix = (itens, desc) => Math.round(Math.max(Number(itens) - Number(desc), 0) * PIX_PCT) / 100;
const rotDesconto = o => `Desconto${Number(o.desconto_percentual) > 0 ? ` (${num(o.desconto_percentual)}%)` : ''}`;
const freteGratis = o => o.frete_gratis ?? (o.forma_entrega === 'entrega' && !Number(o.frete));
const SELO_FRETE = `<div style="display:inline-block;margin-top:10px;padding:6px 16px;border:2px solid #00a986;color:#00a986;border-radius:6px;font-weight:700;letter-spacing:1.5px;font-size:12pt;transform:rotate(-2deg)">FRETE GRÁTIS</div>`;
function blocosProposta(o) {
  const ent = o.forma_entrega === 'entrega' ? `Entrega no endereço: ${o.endereco_entrega || 'a combinar'}`
            : o.forma_entrega === 'retirada' ? `Retirada no balcão: ${EMPRESA.endereco}` : '';
  return `${o.prazo_dias_uteis ? `<div class="bloco"><div class="rot">Prazo</div><p>${esc(textoPrazo(o.prazo_dias_uteis))}</p></div>` : ''}
    ${ent || o.observacoes_entrega ? `<div class="bloco"><div class="rot">Entrega</div>${ent ? `<p>${esc(ent)}</p>` : ''}${o.observacoes_entrega ? `<p style="margin-top:4px">${esc(o.observacoes_entrega)}</p>` : ''}</div>` : ''}`;
}
const saiuParaEntrega = p => (p.itens || []).some(i => ['em_transporte', 'entregue'].includes(i.status));
function modalAlterarEntrega() {
  const p = S.vistaAtual.dados;
  if (saiuParaEntrega(p)) return toast('O pedido já saiu para entrega. O endereço não pode mais ser alterado.', true);
  const m = abrirModal({ titulo: `Entrega do pedido ${p.numero}`, corpo: `<form id="f-ent" class="grade g2">${htmlEntrega(p)}</form>`,
    rodape: `<button class="btn" data-v>Voltar</button><button class="btn prim" data-s>Salvar entrega</button>`,
    aoAbrir: el => ligarEntrega(el) });
  m.el.querySelector('[data-v]').onclick = m.fechar;
  m.el.querySelector('[data-s]').onclick = async () => {
    await api('editar_pedido', { id: p.id, ...formDados($('#f-ent', m.el)) }); m.fechar(); toast('Entrega atualizada.'); recarregar();
  };
}
