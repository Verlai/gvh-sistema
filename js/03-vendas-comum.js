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

/* acabamento do item */

const infoAcabamento = i => !i.precisa_acabamento ? '' : `<div class="small" style="margin-top:4px">${badge(i.acabamento_iniciado_em ? 'Em acabamento' : 'Precisa de acabamento', i.acabamento_iniciado_em ? 'b-ambar' : 'b-azul')} ${esc(i.acabamento_por || '')}</div>`;
const camposAcabamento = i => `<label class="check" style="grid-column:1/-1"><input type="checkbox" name="precisa_acabamento" data-acab ${i.precisa_acabamento ? 'checked' : ''}> Precisa de acabamento depois que chegar do fornecedor?</label>
  <label class="campo ${i.precisa_acabamento ? '' : 'hidden'}" style="grid-column:1/-1" data-acab-box>Quem vai fazer o acabamento *<input type="text" name="acabamento_por" value="${esc(i.acabamento_por || '')}" placeholder="Ex.: Interno — dobrar e grampear"></label>`;
function ligarAcabamento(form) {
  const ck = form.querySelector('[data-acab]'); if (!ck) return;
  ck.onchange = () => form.querySelector('[data-acab-box]').classList.toggle('hidden', !ck.checked);
}
function lerAcabamento(form, d) {
  const ck = form.querySelector('[data-acab]'); if (!ck) return true;
  d.precisa_acabamento = ck.checked;
  if (!ck.checked) delete d.acabamento_por;
  else if (!String(d.acabamento_por || '').trim()) { toast('Informe quem vai fazer o acabamento.', true); return false; }
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
        <label class="campo" style="grid-column:span 2">Produto * <span class="muted">(vai para o cliente)</span><input type="text" name="descricao" list="dl-sugestoes" autocomplete="off" value="${esc(i.descricao || '')}" placeholder="Digite ou escolha: Folheto 10x14…"><div class="small muted" id="it-mat">${textoMaterialSugerido(i.descricao)}</div><div class="small muted" id="it-conf"></div></label>
        <label class="campo">Categoria *<select name="categoria_id">${opcoesCategoria(i.categoria_id, podeNovaCategoria())}</select><span class="small muted" id="it-sug"></span></label>
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
        $('#it-sug', el).innerHTML = l.length > 1 ? 'Também pode ser: ' + l.slice(1).map(c => `<a href="#" data-cat="${c.id}">${esc(c.nome)}</a>`).join(' · ') : '';
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
          f.categoria_id.innerHTML = opcoesCategoria(id, podeNovaCategoria()); f.categoria_id.value = id; }); }
      };
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
    const itens = pegar();
    if (pegar.incompletos()) return toast('Há item sem categoria, produto, quantidade ou total. Complete ou remova a linha.', true);
    if (!itens.length) return toast('Escreva o produto do item.', true);
    bs.disabled = true; let ok = 0;
    try {
      for (const it of itens) { await api('salvar_item', { ...it, pedido_id: p.id }); ok++; }
      m.fechar(); toast(ok > 1 ? `${ok} itens adicionados.` : 'Item adicionado.'); recarregar();
    } catch (e) {
      bs.disabled = false;
      if (ok) { toast(`${ok} de ${itens.length} itens foram adicionados; o próximo deu erro. Confira o pedido.`, true); m.fechar(); recarregar(); }
    }
  };
}
function opcoesStatusInicial(sel = 'arte_a_fazer') {
  const lista = ['arte_a_fazer', ...(S.perm.status_item_permitidos || []).filter(s => ['arte_a_fazer','arte_em_aprovacao','pre_impressao'].includes(s))];
  return [...new Set(lista)].map(s => `<option value="${s}" ${s === sel ? 'selected' : ''}>${esc(nomeStatusItem(s))}</option>`).join('');
}

const unitario = (total, qtd) => Number(qtd) > 0 ? (Number(total || 0) / Number(qtd)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 4 }) : '—';
async function sugerirTotal(produtoId, qtd) {
  if (!produtoId || !(Number(qtd) > 0)) return null;
  const r = await api('calcular_preco', { produto_id: produtoId, quantidade: qtd }, true).catch(() => null);
  return r && r.total != null ? Number(r.total) : null;
}
function modalProdutoRapido(aoSalvar) {
  const m = abrirModal({ titulo: 'Cadastrar produto', corpo: `<form id="f-prod-r" class="grade g2">
      <label class="campo" style="grid-column:1/-1">Nome do produto *<input type="text" name="nome" required></label>
      <label class="campo">Categoria<input type="text" name="categoria"></label>
      <label class="campo">Unidade<input type="text" name="unidade" value="un"></label>
      <label class="campo">Preço base (R$/un)<input type="number" step="0.0001" min="0" name="preco_base"></label>
    </form><p class="small muted" style="margin:0">Faixas de preço, fornecedor padrão e dados fiscais podem ser completados depois em Cadastros › Produtos.</p>`,
    rodape: `<button class="btn" data-v>Voltar</button><button class="btn prim" data-s>Cadastrar</button>` });
  m.el.querySelector('[data-v]').onclick = m.fechar;
  setTimeout(() => $('#f-prod-r', m.el).nome.focus(), 50);
  m.el.querySelector('[data-s]').onclick = async () => {
    const d = formDados($('#f-prod-r', m.el)); d.ativo = true;
    const r = await api('salvar_produto', d); await carregarBase(); m.fechar(); toast('Produto cadastrado.'); aoSalvar && aoSalvar(r.id);
  };
}


/* ---------- PARCELAS ---------- */
const TIPOS_PARC = { sinal:'Sinal', restante:'Restante', boleto:'Boleto', a_vista:'À vista', parcela:'Parcela' };
const FORMAS = { pix:'Pix', dinheiro:'Dinheiro', cartao_credito:'Cartão de crédito', cartao_debito:'Cartão de débito', boleto:'Boleto', transferencia:'Transferência', outro:'Outro' };
const opcoesForma = (sel = '') => `<option value="">—</option>` + Object.entries(FORMAS).map(([k, v]) => `<option value="${k}" ${k === sel ? 'selected' : ''}>${v}</option>`).join('');
function badgeParcela(r) {
  if (r.situacao === 'pago') return r.conferencia === 'pendente'
    ? badge('Pago em ' + data(r.pago_em) + ' · a conferir', 'b-ambar')
    : badge('Pago em ' + data(r.pago_em), 'b-verde');
  if (r.situacao === 'cancelado') return badge('Cancelada', 'b-cinza');
  if (r.atrasado) return badge('Atrasada', 'b-vermelho');
  if (r.dias_para_vencer === 0) return badge('Vence hoje', 'b-ambar');
  return badge('Em aberto', 'b-cinza');
}
function detalheParcela(r) {
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
  const conferir = fin && (comPedido || S.usuario.perfil === 'financeiro');
  return `<div class="tabela-wrap"><table>
    <thead><tr>${comPedido ? '<th>Pedido</th><th>Cliente</th>' : ''}<th>Parcela</th><th>Vencimento</th><th class="dir">Valor</th><th>Forma</th><th>Situação</th>${acoes ? '<th></th>' : ''}</tr></thead>
    <tbody>${lista.map(r => `<tr>
      ${comPedido ? `<td><a href="#/pedido/${r.pedido_id}"><b>${esc(r.pedido_numero)}</b></a></td><td>${esc(r.cliente_nome)}</td>` : ''}
      <td>${esc(TIPOS_PARC[r.tipo] || r.tipo)}${r.parcela_num ? ` ${r.parcela_num}${r.parcelas_total ? '/' + r.parcelas_total : ''}` : ''}${r.observacao ? `<div class="small muted">${esc(r.observacao)}</div>` : ''}</td>
      <td class="num">${data(r.vencimento)}</td>
      <td class="dir num">${brl(r.valor)}</td>
      <td>${esc(FORMAS[r.forma_pagamento] || '—')}${urlSegura(r.link_pagamento) ? `<div><a class="small" href="${esc(urlSegura(r.link_pagamento))}" target="_blank" rel="noopener">Link de pagamento</a></div>` : ''}
        ${r.tem_comprovante ? `<div><button class="btn link peq" onclick="verComprovante('${r.id}')">Ver comprovante</button></div>` : ''}</td>
      <td>${badgeParcela(r)}${detalheParcela(r)}</td>
      ${acoes ? `<td class="dir" style="white-space:nowrap">
        ${r.situacao === 'aberto' ? `<button class="btn prim peq" onclick="modalBaixa('${r.id}', ${conferir})">${fin ? 'Dar baixa' : 'Marcar como pago'}</button>
             ${fin ? `<button class="btn link peq" onclick="excluirParcela('${r.id}')">Excluir</button>` : ''}` : ''}
        ${r.situacao === 'aberto' && r.forma_pagamento === 'cartao_credito' ? `<button class="btn link peq" onclick="modalLinkPagamento('${r.id}')">${r.link_pagamento ? 'Trocar link' : 'Colar link'}</button>` : ''}
        ${r.situacao === 'pago' && r.tem_comprovante && (fin || r.conferencia === 'pendente') ? `<button class="btn link peq" onclick="trocarComprovante('${r.id}')">Trocar comprovante</button>` : ''}
        ${r.situacao === 'pago' && (fin || r.conferencia === 'pendente') ? `<button class="btn link peq" onclick="desfazerBaixa('${r.id}')">Desfazer</button>` : ''}
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
  if (!await confirmar('Desfazer este pagamento? A comissão ligada a ele também será estornada.', 'Desfazer', true)) return;
  await api('baixar_recebimento', { id, desfazer: true }); toast('Pagamento desfeito.'); recarregar();
}
async function excluirParcela(id) {
  if (!await confirmar('Excluir esta parcela em aberto?', 'Excluir', true)) return;
  await api('excluir_recebimento', { id }); toast('Parcela excluída.'); recarregar();
}

/* gerador de parcelas (usado no pedido e no novo pedido) */
function htmlGeradorParcelas(total, venc1) {
  return `<div class="grade g4" id="gerador">
    <label class="campo">Sinal (R$)<input type="number" step="0.01" min="0" data-g="sinal" value="0"></label>
    <label class="campo">Vencimento do sinal<input type="date" data-g="venc_sinal" value="${hoje()}"></label>
    <label class="campo">Restante em<select data-g="modo"><option value="restante">1 pagamento (na entrega)</option><option value="boleto">Boletos</option><option value="parcela">Parcelas</option></select></label>
    <label class="campo">Quantidade<input type="number" min="1" max="24" data-g="qtd" value="1"></label>
    <label class="campo">1º vencimento<input type="date" data-g="venc1" value="${venc1 || somaDias(hoje(), 30)}"></label>
    <label class="campo">Forma<select data-g="forma">${opcoesForma('boleto')}</select></label>
    <label class="campo">Valor a parcelar (R$)<input type="number" step="0.01" min="0" data-g="total" value="${Number(total || 0).toFixed(2)}"></label>
    <div style="align-self:end"><button type="button" class="btn" data-g-gerar>Gerar parcelas</button></div>
  </div>
  <div id="preview-parcelas" style="margin-top:12px"></div>`;
}
function ligarGerador(el, onChange) {
  let parcelas = [];
  const g = k => el.querySelector(`[data-g="${k}"]`).value;
  const desenhar = () => {
    const alvo = el.querySelector('#preview-parcelas');
    alvo.innerHTML = parcelas.length ? `<table><thead><tr><th>Parcela</th><th>Vencimento</th><th class="dir">Valor</th><th>Forma</th><th></th></tr></thead><tbody>
      ${parcelas.map((p, k) => `<tr><td>${esc(TIPOS_PARC[p.tipo])}${p.parcela_num ? ' ' + p.parcela_num + '/' + p.parcelas_total : ''}</td>
        <td><input type="date" value="${p.vencimento}" data-k="${k}" data-c="vencimento"></td>
        <td class="dir"><input type="number" step="0.01" value="${p.valor}" data-k="${k}" data-c="valor" style="max-width:130px;text-align:right"></td>
        <td>${esc(FORMAS[p.forma_pagamento] || '—')}</td>
        <td><button type="button" class="btn link peq" data-rm="${k}">Remover</button></td></tr>`).join('')}</tbody></table>
      <p class="small muted">Soma: <b>${brl(parcelas.reduce((s, p) => s + Number(p.valor), 0))}</b></p>` : '<p class="small muted">Nenhuma parcela gerada. Preencha acima e clique em "Gerar parcelas".</p>';
    alvo.querySelectorAll('[data-c]').forEach(inp => inp.onchange = () => { parcelas[inp.dataset.k][inp.dataset.c] = inp.value; desenhar(); });
    alvo.querySelectorAll('[data-rm]').forEach(b => b.onclick = () => { parcelas.splice(b.dataset.rm, 1); desenhar(); });
    onChange && onChange(parcelas);
  };
  el.querySelector('[data-g-gerar]').onclick = () => {
    parcelas = [];
    const sinal = Number(g('sinal') || 0), total = Number(g('total') || 0), qtd = Math.max(1, Number(g('qtd') || 1)), modo = g('modo');
    if (sinal > 0) parcelas.push({ tipo: 'sinal', valor: sinal.toFixed(2), vencimento: g('venc_sinal'), forma_pagamento: 'pix' });
    const resto = Math.round((total - sinal) * 100);
    if (resto > 0) {
      const n = modo === 'restante' ? 1 : qtd; const base = Math.floor(resto / n);
      for (let k = 0; k < n; k++) {
        const cent = k === n - 1 ? resto - base * (n - 1) : base;
        parcelas.push({ tipo: modo === 'restante' ? 'restante' : modo, parcela_num: n > 1 ? k + 1 : null, parcelas_total: n > 1 ? n : null,
          valor: (cent / 100).toFixed(2), vencimento: somaMeses(g('venc1'), k), forma_pagamento: g('forma') || null });
      }
    }
    desenhar();
  };
  desenhar();
  return () => parcelas;
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
async function verComprovante(id) { const r = await api('comprovante_arquivo', { op: 'download', id }); window.open(r.url, '_blank', 'noopener'); }
function htmlFormaPagamento(op = {}) {
  return `<div class="forma-pag" data-fp-raiz ${op.autorizar ? 'data-fp-autorizar' : ''} ${op.orcamento ? 'data-fp-orc' : ''}>
    <div class="chips" data-fp="forma">${Object.entries(FORMAS_COMB).map(([k, v]) => `<button type="button" class="chip" data-v="${k}">${v}</button>`).join('')}</div>
    <div data-fp-corpo></div>
  </div>`;
}
/* Componente que evolui conforme os cliques. Devolve coletar() assíncrono → { forma_pagamento, forma_pagamento_obs, recebimentos, resumo, autoriza_sem_pagamento }.
   coletar.atualizar() recalcula boletos e sugestão do sinal quando o total ou a previsão mudam. */
function ligarFormaPagamento(el, total, prev, inicial) {
  const raiz = el.matches('[data-fp-raiz]') ? el : el.querySelector('[data-fp-raiz]');
  const podeAutorizar = raiz.hasAttribute('data-fp-autorizar');
  const orc = raiz.hasAttribute('data-fp-orc');   // orçamento: só o combinado, sem "já pagou", comprovante ou link
  const corpo = raiz.querySelector('[data-fp-corpo]');
  const st = { forma: '', pago: null, comp: null, link: '', qtd: 1, outraQtd: false, parcelas: [], parcManual: false,
               sinal: '', sinalManual: false, sinalPago: null, formaSinal: 'pix', compSinal: null, restante: 'pix', linkRest: '', obs: '', autoriza: null };
  const enviados = new Map();
  const t2 = () => Math.round(total() * 100) / 100;
  const brlTxt = v => brl(v).replace(/\s/g, ' ');
  const chips = (grupo, opcoes, valor) => `<div class="chips" data-g="${grupo}">${opcoes.map(([v, r]) => `<button type="button" class="chip ${String(valor) === String(v) ? 'ativo' : ''}" data-v="${v}">${r}</button>`).join('')}</div>`;
  const pergunta = (txt, html) => `<div style="margin-top:12px"><div class="small" style="margin-bottom:6px">${txt}</div>${html}</div>`;
  const campo = (rot, k, tipo = 'text', extra = '') => `<label class="campo" style="margin-top:12px;max-width:420px">${rot}<input type="${tipo}" data-k="${k}" value="${esc(st[k])}" ${extra}></label>`;
  const arquivo = (k, rot) => `<div style="margin-top:12px;display:flex;align-items:center;gap:10px;flex-wrap:wrap"><button type="button" class="btn peq" data-arq="${k}">${st[k] ? 'Trocar arquivo' : rot}</button>
    ${st[k] ? `<span class="small">${esc(st[k].name)} ✓</span>` : '<span class="small muted">PDF ou imagem</span>'}</div>`;
  const simNao = (k, txt) => pergunta(txt, chips(k, [['true', 'Sim'], ['false', 'Ainda não']], st[k]));
  const gerarParc = () => {
    const qtd = Math.min(24, Math.max(1, Number(st.qtd) || 1)), v1 = prev() || somaDias(hoje(), 30);
    const cents = Math.round(t2() * 100), base = Math.floor(cents / qtd);
    st.parcelas = Array.from({ length: qtd }, (_, k) => ({ tipo: 'boleto', forma_pagamento: 'boleto',
      parcela_num: qtd > 1 ? k + 1 : null, parcelas_total: qtd > 1 ? qtd : null, vencimento: somaDias(v1, 30 * k),
      valor: ((k === qtd - 1 ? cents - base * (qtd - 1) : base) / 100).toFixed(2) }));
    st.parcManual = false;
  };
  const sugerirSinal = () => { if (!st.sinalManual) { const s = Math.round(t2() * 50) / 100; st.sinal = s > 0 ? s.toFixed(2) : ''; } };
  const nadaPago = () => (st.forma === 'sinal_restante' ? st.sinalPago === false : st.pago === false);
  const mostraAut = () => !orc && podeAutorizar && st.forma && !FORMAS_LIBERAM.includes(st.forma) && nadaPago();
  const resumo = () => {
    const f = st.forma, pg = st.pago === true ? ' (pago)' : '';
    if (f === 'pix' || f === 'transferencia' || f === 'cartao_credito') return FORMAS_COMB[f] + pg;
    if (f === 'boleto') return st.parcelas.length > 1 ? `Boleto em ${st.parcelas.length}x` : 'Boleto';
    if (f === 'retirada') return 'Paga na retirada';
    if (f === 'sinal_restante') return `Sinal de ${brlTxt(Number(st.sinal || 0))}${st.sinalPago === true ? ' (pago)' : ''} + restante na entrega (${FORMAS_COMB[st.restante]})`;
    if (f === 'outros') return 'Outros' + (st.obs ? ': ' + st.obs : '') + pg;
    return '';
  };
  const render = () => {
    raiz.querySelectorAll('[data-fp="forma"] .chip').forEach(b => b.classList.toggle('ativo', b.dataset.v === st.forma));
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
      if (st.pago === true) h += arquivo('comp', 'Anexar comprovante');
    } else if (f === 'cartao_credito') {
      h += campo('Link de pagamento (Cielo) <span class="muted small">— opcional</span>', 'link', 'url', 'placeholder="https://"');
      h += simNao('pago', 'O cliente já pagou?');
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
      if (st.sinalPago === true) {
        h += pergunta('Pago em', chips('formaSinal', [['pix', 'Pix'], ['transferencia', 'Transferência']], st.formaSinal));
        h += arquivo('compSinal', 'Anexar comprovante do sinal');
      }
      h += pergunta('Restante, depois da entrega, em', chips('restante', [['pix', 'Pix'], ['cartao_credito', 'Cartão de crédito']], st.restante));
      if (st.restante === 'cartao_credito') h += campo('Link do restante (Cielo) <span class="muted small">— opcional</span>', 'linkRest', 'url', 'placeholder="https://"');
    } else if (f === 'outros') {
      h += campo('Como será o pagamento? *', 'obs', 'text', 'placeholder="Ex.: permuta, crédito do cliente, a combinar"');
      h += simNao('pago', 'Já foi pago?');
    }
    if (mostraAut()) h += pergunta('Pode ir para a produção antes do pagamento?', chips('autoriza', [['true', 'Sim, autorizo'], ['false', 'Não']], st.autoriza ?? 'false'));
    if (f) h += `<div class="small muted" style="margin-top:14px;padding-top:10px;border-top:1px solid var(--borda, #e5e5e5)" data-fp-resumo>Resumo: <b>${esc(resumo())}</b></div>`;
    corpo.innerHTML = h;
    ligar();
  };
  const atualizarResumo = () => { const r = corpo.querySelector('[data-fp-resumo] b'); if (r) r.textContent = resumo(); };
  const ligar = () => {
    corpo.querySelectorAll('[data-g]').forEach(g => g.querySelectorAll('.chip').forEach(b => b.onclick = () => {
      const k = g.dataset.g, v = b.dataset.v;
      if (k === 'qtd') { if (v === 'outro') { st.outraQtd = true; } else { st.outraQtd = false; st.qtd = Number(v); gerarParc(); } }
      else st[k] = v === 'true' ? true : v === 'false' ? false : v;
      render();
    }));
    corpo.querySelectorAll('[data-k]').forEach(i => i.oninput = () => {
      st[i.dataset.k] = i.value;
      if (i.dataset.k === 'sinal') st.sinalManual = true;
      if (i.dataset.k === 'qtd') { gerarParc(); render(); const n = corpo.querySelector('[data-k=qtd]'); n.focus(); return; }
      atualizarResumo();
    });
    corpo.querySelectorAll('[data-pc]').forEach(i => i.onchange = () => { st.parcelas[i.dataset.pk][i.dataset.pc] = i.value; st.parcManual = true; });
    corpo.querySelectorAll('[data-arq]').forEach(b => b.onclick = () => {
      const inp = document.createElement('input'); inp.type = 'file'; inp.accept = EXT_COMP;
      inp.onchange = () => { if (inp.files[0]) { st[b.dataset.arq] = inp.files[0]; render(); } };
      inp.click();
    });
  };
  raiz.querySelectorAll('[data-fp="forma"] .chip').forEach(b => b.onclick = () => {
    st.forma = b.dataset.v; st.pago = null;
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
      if (st.pago && !st.comp) throw new Error('Anexe o comprovante ou marque "Ainda não".');
      rec = [{ tipo: 'a_vista', valor: t.toFixed(2), vencimento: hoje(), forma_pagamento: f, _arq: st.pago ? st.comp : null }];
    } else if (f === 'cartao_credito') {
      if (st.link && !urlSegura(st.link)) throw new Error('O link de pagamento precisa começar com https://');
      if (st.pago === null) throw new Error('Informe se o cliente já pagou.');
      rec = [{ tipo: 'a_vista', valor: t.toFixed(2), vencimento: hoje(), forma_pagamento: 'cartao_credito', link_pagamento: st.link.trim() || null, pago: st.pago }];
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
      if (st.sinalPago && !st.compSinal) throw new Error('Anexe o comprovante do sinal ou marque "Ainda não".');
      const linkR = st.restante === 'cartao_credito' ? st.linkRest.trim() : '';
      if (linkR && !urlSegura(linkR)) throw new Error('O link de pagamento precisa começar com https://');
      rec = [{ tipo: 'sinal', valor: sinal.toFixed(2), vencimento: hoje(), forma_pagamento: st.formaSinal, _arq: st.sinalPago ? st.compSinal : null },
             { tipo: 'restante', valor: (Math.round((t - sinal) * 100) / 100).toFixed(2), vencimento: p || hoje(), forma_pagamento: st.restante, link_pagamento: linkR || null }];
    } else {
      obs = st.obs.trim();
      if (!obs) throw new Error('Descreva como será o pagamento em "Outros".');
      if (st.pago === null) throw new Error('Informe se já foi pago.');
      rec = [{ tipo: 'a_vista', valor: t.toFixed(2), vencimento: hoje(), forma_pagamento: 'outro', observacao: obs, pago: st.pago }];
    }
    const comprovantes = {};
    rec.forEach((r, k) => { r._chave = 'c' + k;
      if (r._arq) { if (r._arq.size > 10 * 1024 * 1024) throw new Error('O comprovante passa de 10 MB.'); comprovantes[r._chave] = r._arq; r.pago = true; }
      delete r._arq; });
    return { forma_pagamento: f, forma_pagamento_obs: obs, recebimentos: rec, comprovantes, resumo: resumo(),
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
    aoAbrir: el => { coletar = ligarFormaPagamento(el, () => falta, () => p.data_prevista_entrega); } });
  m.el.querySelector('[data-v]').onclick = m.fechar;
  m.el.querySelector('[data-s]').onclick = async () => {
    let r; try { r = await coletar(); } catch (e) { if (e.message !== 'upload' && e.message !== 'tamanho') toast(e.message, true); return; }
    const resp = await api('salvar_recebimentos', { pedido_id: p.id, parcelas: r.recebimentos }); m.fechar();
    await anexarComprovantes(r, resp); toast('Pagamento lançado.'); recarregar();
  };
}
function modalTrocarForma() {
  const p = S.vistaAtual.dados;
  let coletar;
  const m = abrirModal({ titulo: 'Trocar forma de pagamento', largo: true, corpo: `<p class="small muted" style="margin:0 0 12px">Forma atual: <b>${esc(FORMAS_COMB[p.forma_pagamento] || '—')}</b>. Os pagamentos em aberto são substituídos pela nova forma, sobre o total de <b>${brl(p.valor_total)}</b>. A troca fica no histórico do pedido.</p>${htmlFormaPagamento()}`,
    rodape: `<button class="btn" data-v>Voltar</button><button class="btn prim" data-s>Trocar forma</button>`,
    aoAbrir: el => { coletar = ligarFormaPagamento(el, () => Number(p.valor_total), () => p.data_prevista_entrega); } });
  m.el.querySelector('[data-v]').onclick = m.fechar;
  m.el.querySelector('[data-s]').onclick = async () => {
    let r; try { r = await coletar(); } catch (e) { if (e.message !== 'upload' && e.message !== 'tamanho') toast(e.message, true); return; }
    const resp = await api('trocar_forma_pagamento', { pedido_id: p.id, forma_pagamento: r.forma_pagamento, forma_pagamento_obs: r.forma_pagamento_obs,
      recebimentos: r.recebimentos, condicoes_pagamento: r.resumo });
    m.fechar(); await anexarComprovantes(r, resp); toast('Forma de pagamento trocada.'); recarregar();
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
function editorItens(alvo, itensIniciais, { comStatus = false, aoMudar, comDigital = false } = {}) {
  if (!S.cache.gabaritos) carregarGabaritos().then(() => itens.forEach((it, k) => { const b = $(`[data-mat="${k}"]`, alvo); if (b) b.innerHTML = textoMaterialSugerido(it.descricao); })).catch(() => {});
  const novo = () => ({ quantidade: 1, valor_total: '', status: 'arte_a_fazer' });
  let itens = itensIniciais.length ? itensIniciais.map(x => ({ ...x, _catManual: true })) : [novo()];
  const podeCad = podeNovaCategoria();
  const timers = {};
  const desenhar = () => {
    alvo.innerHTML = `<div class="tabela-wrap"><table class="itens-editor"><thead><tr>
        <th style="min-width:220px">Produto * <span class="muted">(vai para o cliente)</span></th><th style="min-width:190px">Categoria *</th>
        <th style="min-width:170px">Observação <span class="muted">(interna)</span></th><th style="width:90px">Qtd. *</th>
        <th style="width:130px">Total (R$) *</th><th data-col="status" style="min-width:160px">Status inicial</th><th></th></tr></thead>
      <tbody>${itens.map((it, k) => `<tr>
        <td><input type="text" list="dl-sugestoes" autocomplete="off" placeholder="Digite ou escolha: Folheto 10x14…" value="${esc(it.descricao || '')}" data-k="${k}" data-f="descricao"><div class="small muted" data-mat="${k}">${it._conf ? htmlConferencia(it._conf, it.descricao) : textoMaterialSugerido(it.descricao)}</div>
          ${comDigital ? `<div class="small" data-dig="${k}">${htmlDigitalEditor(it, k)}</div>` : ''}</td>
        <td><select data-k="${k}" data-f="categoria_id">${opcoesCategoria(it.categoria_id, podeCad)}</select><div class="small muted" data-sug="${k}"></div></td>
        <td><input type="text" placeholder="Só a equipe vê" value="${esc(it.observacao || '')}" data-k="${k}" data-f="observacao"></td>
        <td><input type="number" step="any" min="0" value="${esc(it.quantidade)}" data-k="${k}" data-f="quantidade"></td>
        <td><input type="number" step="0.01" min="0" value="${esc(it.valor_total)}" data-k="${k}" data-f="valor_total"><div class="unit-calc" data-u="${k}">Unit. ${unitario(it.valor_total, it.quantidade)}</div></td>
        <td data-col="status">${comStatus ? `<select data-k="${k}" data-f="status">${opcoesStatusInicial(it.status)}</select>` : ''}</td>
        <td>${itens.length > 1 ? `<button type="button" class="btn link peq" data-rm="${k}">Remover</button>` : ''}</td></tr>`).join('')}
      </tbody></table></div>
      <button type="button" class="btn peq" id="add-item" style="margin-top:8px">Adicionar outro item</button>`;
    alvo.classList.toggle('ocultar-status', !comStatus);
    const atualizarUnit = k => { const u = $(`[data-u="${k}"]`, alvo); if (u) u.textContent = 'Unit. ' + unitario(itens[k].valor_total, itens[k].quantidade); };
    const sugerirCat = k => {
      const it = itens[k]; const l = sugerirCategorias(it.descricao);
      if (!it._catManual && l[0] && it.categoria_id !== l[0].id) { it.categoria_id = l[0].id; const sel = $(`[data-k="${k}"][data-f=categoria_id]`, alvo); if (sel) sel.value = l[0].id; }
      const box = $(`[data-sug="${k}"]`, alvo); if (!box) return;
      box.innerHTML = l.length > 1 ? 'Também: ' + l.slice(1).map(c => `<a href="#" data-k2="${k}" data-cat="${c.id}">${esc(c.nome)}</a>`).join(' · ') : '';
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
    $('#add-item', alvo).onclick = () => { itens.push({ ...novo(), status: itens[itens.length - 1]?.status || 'arte_a_fazer' }); desenhar(); };
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
  const pegar = () => itens.filter(usado).map(i => ({ categoria_id: i.categoria_id, descricao: (i.descricao || '').trim(), observacao: i.observacao || '',
    especificacao: i.especificacao || '', quantidade: i.quantidade, valor_total: i.valor_total, status: i.status,
    ...(comDigital && i.digital_manual != null ? { digital_manual: i.digital_manual } : {}) }));
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
    <div class="chips" data-ent-forma><button type="button" class="chip" data-v="retirada">Retira no balcão</button><button type="button" class="chip" data-v="entrega">Entregar no cliente</button></div>
    <div data-ent-corpo style="margin-top:10px"></div></div>`;
}
function ligarEntrega(el) {
  const raiz = el.querySelector('[data-ent]');
  const hForma = raiz.querySelector('[name=forma_entrega]'), hEnd = raiz.querySelector('[name=endereco_entrega]');
  const corpo = raiz.querySelector('[data-ent-corpo]');
  let endEntrega = hForma.value === 'entrega' ? hEnd.value : '', manual = !!endEntrega, cepInfo = null;
  const render = () => {
    const f = hForma.value;
    raiz.querySelectorAll('[data-ent-forma] .chip').forEach(b => b.classList.toggle('ativo', b.dataset.v === f));
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
  raiz.querySelectorAll('[data-ent-forma] .chip').forEach(b => b.onclick = () => { hForma.value = b.dataset.v; render(); });
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

