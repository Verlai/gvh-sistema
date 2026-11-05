/* ---------- AR3a: GABARITOS e URGÊNCIA DA PRODUÇÃO ---------- */
// Lista de materiais e gabaritos (o banco é a fonte). Guardada por 5 minutos; salvar força recarregar.
async function carregarGabaritos(forcar) {
  const c = S.cache.gabaritos;
  if (!forcar && c && Date.now() - c.em < 5 * 60 * 1000) return c.dados;
  const r = await api('gabaritos', {}, true);
  S.cache.gabaritos = { em: Date.now(), dados: r };
  return r;
}
const gruposGabarito = () => (S.cache.gabaritos?.dados?.grupos || []);
const PAGINA_NOME = { frente: 'Frente', verso: 'Verso', verniz_frente: 'Verniz da frente', verniz_verso: 'Verniz do verso', branco_frente: 'Branco da frente',
  branco_verso: 'Branco do verso', hot_stamping: 'Hot stamping', metalizado: 'Metalizado', calco_branco: 'Calço branco', faca: 'Faca', extra: 'Outra página' };
const URG_NOME = { normal: 'Prazo normal', urgente: 'URGENTE', muito_urgente: 'MUITO URGENTE' };
const fmtMm = v => v == null || v === '' ? '' : String(Number(v)).replace('.', ',');
// Texto curto da conta, para o "title" e para a linha de detalhe
function textoUrgencia(u) {
  if (!u || u.dias_producao == null) return 'Sem previsão de entrega: o sistema não consegue calcular a urgência.';
  const d = Number(u.dias_producao);
  const base = d < 0 ? `Previsão já passou (${-d} ${-d === 1 ? 'dia útil' : 'dias úteis'} a menos que o necessário)`
             : `${d} ${d === 1 ? 'dia útil' : 'dias úteis'} de produção`;
  return `${base}, já descontado${Number(u.dias_entrega) === 1 ? '' : 's'} ${u.dias_entrega} ${Number(u.dias_entrega) === 1 ? 'dia' : 'dias'} de entrega · `
    + (u.definitiva ? 'contando da entrada na pré-impressão' : 'provável: contando de hoje até entrar na pré-impressão');
}
// Selo da urgência da produção. Prazo normal não mostra nada (para não poluir).
// Selo "Digital" (19/10): item vai para a máquina digital (Konica) — pela regra do sistema ou marcado pelo vendedor
function seloDigital(dg) {
  if (!dg || !dg.digital) return '';
  const tit = dg.manual === true ? `Marcado pelo vendedor${dg.manual_por_nome ? ' (' + dg.manual_por_nome + ')' : ''}` : (dg.motivo || 'Pela regra do sistema');
  return ` <span class="badge b-digital" title="${esc('Impressão digital · ' + tit)}">Digital${dg.manual === true ? ' ✋' : ''}</span>`;
}
// AR3b: selo da conferência do arquivo para impressão (clicar abre o detalhe)
function seloConferencia(c, itemStatus) {
  if (!c) return '';
  S.confs = S.confs || {}; S.confs[c.id] = { ...c, item_status: itemStatus || (S.confs[c.id] || {}).item_status };
  const sel = (txt, cls, tit) => ` <span class="badge ${cls}" style="cursor:pointer" title="${esc(tit)}" onclick="event.stopPropagation();verConferencia('${c.id}')">${esc(txt)}</span>`;
  let h = '';
  if (c.resultado === 'erro') h += sel('Enviada com alerta', 'b-vermelho', 'O arquivo para impressão foi enviado mesmo com problemas: ' + (c.motivo || ''));
  else if (c.checklist) h += sel('Enviada sem gabarito', 'b-cinza', 'Conferido pelo checklist (sem gabarito com medidas ou arquivo que o sistema não lê).');
  else if (c.resultado === 'alerta') h += sel('Conferência com alerta', 'b-ambar', 'A conferência do arquivo deu alertas. Clique para ver.');
  if (c.devolvida) h += sel('Devolvida à designer', 'b-ambar', 'A arte voltou para a designer refazer o arquivo para impressão.');
  else {
    if (c.digital_mudou) h += sel(c.digital_atual ? 'Mudou para digital' : 'Saiu da digital', 'b-vermelho', c.digital_atual ? 'O arquivo foi fechado para o offset, mas agora o item vai para a impressão digital.' : 'O arquivo foi fechado para a digital (folha), mas agora o item vai para o offset.');
    if (c.gabarito_mudou) h += sel('Gabarito mudou', 'b-vermelho', `Conferido com "${c.gabarito_nome}"; agora vale "${c.gabarito_atual_nome}".`);
  }
  return h;
}
function verConferencia(id) {
  const c = (S.confs || {})[id]; if (!c) return;
  const podeDevolver = c.item_id && c.item_status === 'pre_impressao' && !c.devolvida && (podeStatus('em_producao') || gerenciaArtes());
  const cor = { vermelho: 'erro', amarelo: '', info: '' };
  const m = abrirModal({ titulo: 'Conferência do arquivo para impressão', corpo: `
    <p class="small" style="margin:0">${c.origem === 'arte_pronta' ? 'Arte pronta para impressão (junto com a prova)' : 'Arquivo enviado para impressão'} por <b>${esc(c.por_nome || '—')}</b> em ${dataHora(c.em)}.
      ${c.gabarito_nome ? `<br>Gabarito usado: <b>${esc(c.gabarito_nome)}</b>${c.urgencia_nivel ? ` (urgência ${esc((URG_NOME[c.urgencia_nivel] || c.urgencia_nivel).toLowerCase())}${c.urgencia_definitiva ? '' : ', provável'})` : ''}.` : '<br>Sem gabarito com medidas.'}</p>
    ${c.digital_mudou && !c.devolvida ? `<div class="alerta erro"><b>${c.digital_atual ? 'O item passou para a impressão digital.' : 'O item saiu da impressão digital.'}</b> ${c.digital_atual ? 'O arquivo para impressão foi fechado no gabarito do offset; na digital a designer precisa montar a cartela na folha (SRA3 ou A4).' : 'O arquivo para impressão foi fechado como folha da digital; no offset precisa do arquivo no gabarito do offset.'}</div>` : ''}
    ${c.devolvida ? '<div class="alerta">A arte já foi devolvida para a designer refazer o arquivo para impressão.</div>' : ''}
    ${c.gabarito_mudou && !c.devolvida ? `<div class="alerta erro"><b>O gabarito mudou.</b> O arquivo foi conferido com "${esc(c.gabarito_nome)}", mas com a urgência de agora o gabarito é <b>"${esc(c.gabarito_atual_nome)}"</b>. Devolva para a designer ou combine com o cliente antes de produzir.</div>` : ''}
    ${c.resultado === 'erro' ? `<div class="alerta erro"><b>Enviado mesmo assim.</b> Motivo: ${esc(c.motivo || '')}</div>` : ''}
    ${c.checklist ? `<div class="alerta">Conferido pelo checklist: ${Object.keys(c.checklist).map(k => ({ tamanho: 'tamanho', sangria: 'sangria', seguranca: 'segurança' })[k] || k).join(', ')}.</div>` : ''}
    ${(c.itens || []).length ? (c.itens || []).map(i => `<div class="alerta ${cor[i.nivel] || ''}" style="margin-top:6px;${i.nivel === 'info' ? 'background:var(--verde-bg);color:#007a61' : ''}">${esc(i.texto)}</div>`).join('')
      : '<div class="alerta" style="background:var(--verde-bg);color:#007a61">Nenhum alerta.</div>'}`,
    rodape: `${podeDevolver ? '<button class="btn perigo" data-dev style="margin-right:auto">Devolver para a designer</button>' : ''}<button class="btn prim" data-v>Fechar</button>` });
  m.el.querySelector('[data-v]').onclick = m.fechar;
  const bd = m.el.querySelector('[data-dev]');
  if (bd) bd.onclick = () => { m.fechar(); devolverArtePreImpressao(c); };
}
// Botão da linha da pré-impressão: devolve a arte de qualquer item (arquivo errado), com ou sem selo
function devolverItemPre(itemId) {
  const i = ((S.vistaAtual && S.vistaAtual.dados) || []).find(x => x.id === itemId);
  if (!i) return toast('Item não encontrado. Atualize a tela.', true);
  devolverArtePreImpressao({ ...(i.conferencia || {}), item_id: i.id, arte_id: i.conferencia && !i.conferencia.devolvida ? i.conferencia.arte_id : null });
}
// Pré-impressão devolve a arte para a designer refazer o arquivo (gabarito mudou, mudou para digital ou saiu dela)
function devolverArtePreImpressao(c) {
  const sug = c.digital_mudou ? (c.digital_atual ? 'O item passou para a impressão digital: monte a cartela na folha SRA3 (ou A4) e feche o arquivo para impressão de novo.'
                                                 : 'O item saiu da digital e vai para o offset: feche o arquivo no gabarito do offset.')
            : c.gabarito_mudou ? `O gabarito mudou de "${c.gabarito_nome}" para "${c.gabarito_atual_nome}": ajuste o arquivo e feche de novo.` : '';
  const m = abrirModal({ titulo: 'Devolver a arte para a designer', corpo: `
    <p class="small" style="margin:0 0 8px">O item volta para a etapa de arte (<b>Aprovado pelo cliente · falta fechar o arquivo</b>). A designer recebe o aviso e envia o arquivo para impressão de novo; o arquivo antigo fica marcado como "Antigo". Se o pedido tem pagamento, o item volta sozinho para a pré-impressão quando ela fechar.</p>
    <label class="campo">O que a designer precisa fazer *<textarea data-mot rows="3" maxlength="400">${esc(sug)}</textarea></label>`,
    rodape: '<button class="btn" data-v>Voltar</button><button class="btn perigo" data-s>Devolver</button>' });
  m.el.querySelector('[data-v]').onclick = m.fechar;
  m.el.querySelector('[data-s]').onclick = async () => {
    const motivo = m.el.querySelector('[data-mot]').value.trim();
    if (!motivo) return toast('Escreva o que a designer precisa fazer.', true);
    try { await api('arte_devolver_pre_impressao', { item_id: c.item_id, arte_id: c.arte_id, motivo }); m.fechar(); toast('Arte devolvida para a designer.'); recarregar(); } catch (e) {}
  };
}
function badgeUrgencia(u, sempre) {
  if (!u || !u.nivel) return '';
  const prazo = u.aviso_prazo ? ` <span class="badge b-vermelho" title="${esc(u.aviso_prazo)}" style="cursor:help" onclick="event.stopPropagation();toast(this.title, true)">${esc(u.aviso_prazo_curto || 'Só prazo normal')}</span>` : '';
  if (u.nivel === 'normal' && !sempre) return (badgeEntregaQuando(u) + seloDigital(u.digital) + prazo).trim();
  const cls = u.nivel === 'muito_urgente' ? 'b-vermelho' : u.nivel === 'urgente' ? 'b-ambar' : 'b-cinza';
  const txt = (URG_NOME[u.nivel] || u.nivel) + (u.nivel === 'normal' ? '' : ' · produção') + (u.definitiva ? '' : ' (provável)');
  const tit = textoUrgencia(u) + (u.manual ? ` · Marcado à mão por ${u.manual_por_nome || '—'}: ${u.manual_motivo || ''}` : '');
  return `<span class="badge ${cls}" title="${esc(tit)}">${esc(txt)}${u.manual ? ' ✋' : ''}</span>${badgeEntregaQuando(u)}${seloDigital(u.digital)}${prazo}`;
}
// "Entrega hoje / amanhã / atrasada" pela previsão para o cliente (dias corridos)
function badgeEntregaQuando(u) {
  if (!u || u.dias_para_entrega == null) return '';
  const d = Number(u.dias_para_entrega);
  if (d < 0) return ' ' + badge('Entrega atrasada', 'b-vermelho');
  if (d === 0) return ' ' + badge('Entrega hoje', 'b-vermelho');
  if (d === 1) return ' ' + badge('Entrega amanhã', 'b-ambar');
  return '';
}
const urgenteProducao = u => !!u && (u.nivel === 'urgente' || u.nivel === 'muito_urgente');

// Linha "Gabarito" do item: material → gabarito (sugerido pelo sistema ou escolhido à mão) → abrir; "+ Novo gabarito".
function htmlGabaritoItem(itemId, grupoId, u, podeEscolher) {
  const grupos = gruposGabarito();
  const gr = grupos.find(g => g.id === grupoId);
  const abrir = url => url ? ` · <a href="${esc(url)}" target="_blank" rel="noopener">${url.includes('/folders/') ? 'Abrir pasta' : 'Abrir gabarito'}</a>` : '';
  let atual;
  if (u && u.confirmar_cliente) {
    // gabarito do cliente vence o geral, mas alguém confirma antes
    atual = `<div class="alerta" style="padding:6px 10px">Este cliente tem gabarito próprio: <b>${esc(u.gabarito_sugerido_nome)}</b>${abrir(u.gabarito_sugerido_url)}
      ${podeEscolher ? `<div style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap">
        <button type="button" class="btn peq prim" data-gab-conf="${itemId}" data-gid="${u.gabarito_sugerido_id}">Usar o do cliente</button>
        ${u.gabarito_geral_id ? `<button type="button" class="btn peq" data-gab-conf="${itemId}" data-gid="${u.gabarito_geral_id}">Usar o geral (${esc(u.gabarito_geral_nome)})</button>` : ''}</div>`
      : ' <span class="muted">· aguardando confirmação</span>'}</div>`;
  } else if (u && u.gabarito_escolhido_id) {
    atual = `<b>${esc(u.gabarito_escolhido_nome)}</b>${u.gabarito_escolhido_so_item ? ' <span class="muted">(só deste item)</span>' : ''}${u.gabarito_escolhido_cliente ? ' <span class="muted">(do cliente)</span>' : ''}
      <span class="muted" title="Escolhido à mão${u.gabarito_escolhido_em ? ' em ' + dataHora(u.gabarito_escolhido_em) : ''}"> · ✋ ${esc(u.gabarito_escolhido_por_nome || '')}</span>
      ${u.gabarito_escolhido_pendente ? badge('sem medidas', 'b-ambar') : ''}${abrir(u.gabarito_escolhido_url)}`;
  } else if (u && u.gabarito_sugerido_id) {
    atual = `<span class="muted">Sugerido pelo sistema:</span> <b>${esc(u.gabarito_sugerido_nome)}</b>${abrir(u.gabarito_sugerido_url)}`;
  } else if (grupoId && gabaritoSoPendente(grupoId)) {
    atual = `<span class="muted">gabaritos deste material ainda sem medidas no sistema${gr && gr.pasta_url ? ` · <a href="${esc(gr.pasta_url)}" target="_blank" rel="noopener">Abrir pasta</a>` : ''}</span>`;
  } else if (grupoId && u && u.digital && u.digital.digital && u.gabarito_digital) {
    atual = '<span class="muted">na digital: sem gabarito de peça para esta urgência</span>';
  } else if (grupoId) {
    atual = '<span class="muted">nenhum gabarito do material vale para esta urgência/quantidade</span>';
  } else atual = '<span class="muted">sem material escolhido</span>';
  if (!podeEscolher) {
    if (!grupoId && !(u && u.gabarito_escolhido_id)) return '';
    const nomeMat = gr ? gr.nome : (u && u.grupo_nome) || '';
    return `<div class="small" style="margin-top:6px"><span class="muted">Gabarito:</span> ${nomeMat ? esc(nomeMat) + ' · ' : ''}${atual}</div>${linhaGabaritoDigital(u)}`;
  }
  const variacoes = [...(gr ? gr.gabaritos : []).filter(g => g.ativo && (!g.cliente_id || (u && g.cliente_id === u.cliente_id)))
                       .map(g => [g.id, g.nome + (g.cliente_id ? ' (do cliente)' : '') + (g.medidas_pendentes ? ' (sem medidas)' : '')]),
                     ...((u && u.gabaritos_do_item) || []).map(g => [g.id, g.nome + ' (só deste item)'])];
  const est = 'padding:4px 6px;font-size:12px;width:auto;max-width:240px';
  return `<div class="small" style="margin-top:6px;display:flex;gap:8px;align-items:center;flex-wrap:wrap">
      <span class="muted">Gabarito:</span>
      <select data-gab-item="${itemId}" style="${est}" aria-label="Material do gabarito">
        <option value="">— escolher material —</option>
        ${grupos.map(g => `<option value="${g.id}" ${g.id === grupoId ? 'selected' : ''}>${esc(g.nome)}</option>`).join('')}
        ${grupoId && !gr && u && u.grupo_nome ? `<option value="${grupoId}" selected>${esc(u.grupo_nome)} (inativo)</option>` : ''}
      </select>
      ${variacoes.length ? `<select data-gab-var="${itemId}" style="${est}" aria-label="Gabarito do item">
        <option value="">${u && u.gabarito_sugerido_id ? 'Sugestão do sistema (' + esc(u.gabarito_sugerido_nome) + ')' : 'Sugestão do sistema'}</option>
        ${variacoes.map(([id, n]) => `<option value="${id}" ${u && id === u.gabarito_escolhido_id ? 'selected' : ''}>${esc(n)}</option>`).join('')}
      </select>` : ''}
      ${podeGabaritos() ? `<button type="button" class="btn link peq" data-gab-novo="${itemId}" data-gab-gr="${grupoId || ''}" data-gab-cli="${esc((u && u.cliente_nome) || '')}">+ Novo gabarito</button>` : ''}
    </div>
    <div class="small" style="margin-top:4px">${atual}</div>${linhaGabaritoDigital(u)}`;
}
// Selo pequeno "sem gabarito" (vendedor, Diretor e arte)
const veSeloGabarito = () => pode('cria_pedidos') || gerenciaArtes() || !!S.perm.so_painel_arte || pode('gerencia_cadastros');
const seloSemGabarito = u => !u || !veSeloGabarito() ? '' : u.confirmar_cliente ? badge('confirmar gabarito do cliente', 'b-ambar') : u.sem_gabarito ? badge('sem gabarito', 'b-cinza') : '';
// Material cujos gabaritos ativos ainda estão todos com medidas pendentes (devolve o material)
function gabaritoSoPendente(grupoId) {
  const g = gruposGabarito().find(x => x.id === grupoId);
  if (!g) return null;
  const ativos = (g.gabaritos || []).filter(x => x.ativo);
  return ativos.length && ativos.every(x => x.medidas_pendentes) ? g : null;
}
// Liga os campos de gabarito de uma área da tela
function ligarSelectsGabarito(raiz) {
  raiz.querySelectorAll('[data-gab-item]').forEach(s => s.onchange = async () => {
    try { await api('item_gabarito', { item_id: s.dataset.gabItem, gabarito_grupo_id: s.value || null }); toast('Material do item atualizado.'); recarregar(); }
    catch (e) { recarregar(); }
  });
  raiz.querySelectorAll('[data-gab-var]').forEach(s => s.onchange = async () => {
    try { await api('item_gabarito', { item_id: s.dataset.gabVar, gabarito_id: s.value || null }); toast(s.value ? 'Gabarito escolhido para o item.' : 'O item volta a seguir a sugestão do sistema.'); recarregar(); }
    catch (e) { recarregar(); }
  });
  raiz.querySelectorAll('[data-gab-novo]').forEach(b => b.onclick = () => modalNovoGabaritoItem(b.dataset.gabNovo, b.dataset.gabGr || null, b.dataset.gabCli || ''));
  raiz.querySelectorAll('[data-gab-conf]').forEach(b => b.onclick = async () => {
    try { await api('item_gabarito', { item_id: b.dataset.gabConf, gabarito_id: b.dataset.gid }); toast('Gabarito do item confirmado.'); recarregar(); } catch (e) {}
  });
}
const numBr = v => v === '' || v == null ? null : Number(String(v).replace(',', '.'));
// Criar gabarito a partir do item: para o material (vale nos próximos pedidos) ou só para o item.
function modalNovoGabaritoItem(itemId, grupoId, clienteNome) {
  const grupos = gruposGabarito();
  const m = abrirModal({ titulo: 'Novo gabarito', largo: true, corpo: `<form id="f-ngi">
    <div class="grade g2">
      <label class="campo">Material
        <select name="grupo_id"><option value="">— escolher —</option>
          ${grupos.map(g => `<option value="${g.id}" ${g.id === grupoId ? 'selected' : ''}>${esc(g.nome)}</option>`).join('')}
          <option value="__novo">+ Material novo…</option></select></label>
      <label class="campo" id="ngi-novo" style="display:none">Nome do material novo *<input type="text" name="material_novo" maxlength="80" placeholder="Ex.: Tag 5×9 com furo"></label>
      <label class="campo"><span id="ngi-nome-rot">Nome do gabarito *</span><input type="text" name="nome" maxlength="80" placeholder="Ex.: 1 dobra · Prazo normal acima de 250 un"></label>
    </div>
    <div class="campo" style="margin-top:10px">Onde gravar
      <label class="check" style="margin:4px 0 0"><input type="radio" name="destino" value="material" checked> <span><b>Gravar para o material</b> — vale para os próximos pedidos de todos os clientes</span></label>
      ${clienteNome ? `<label class="check" style="margin:2px 0 0"><input type="radio" name="destino" value="cliente"> <span><b>Gravar para este cliente (${esc(clienteNome)})</b> — vale nos próximos pedidos dele neste material, antes dos gerais</span></label>` : ''}
      <label class="check" style="margin:2px 0 0"><input type="radio" name="destino" value="item"> <span><b>Só para este item</b> — não grava no cadastro de Gabaritos</span></label>
    </div>
    <h3 style="margin:14px 0 6px">Medidas (mm)</h3>
    <div class="grade g4">
      <label class="check" style="grid-column:1/-1"><input type="checkbox" name="tamanho_livre"> Tamanho livre (a medida vem do pedido, como adesivo de recorte e lona)</label>
      <label class="campo">Largura final<input type="text" inputmode="decimal" name="corte_largura_mm"></label>
      <label class="campo">Altura final<input type="text" inputmode="decimal" name="corte_altura_mm"></label>
      <label class="campo">Sangria (cada lado)<input type="text" inputmode="decimal" name="sangria_mm" value="0"></label>
      <label class="campo">Segurança <span class="muted">(para dentro)</span><input type="text" inputmode="decimal" name="seguranca_mm" value="0"></label>
    </div>
    <p class="small muted" id="ngi-arq" style="margin:4px 0 0"></p>
    <div id="ngi-regras" style="margin-top:8px">${blocoExp('ngi-regras', 'Quando usar <span class="small muted">(vazio = sempre)</span>', `
      <div class="grade g3">
        <div class="campo">Urgência da produção
          <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:4px">${['normal', 'urgente', 'muito_urgente'].map(u => `<label class="check" style="margin:0"><input type="checkbox" name="cond_urgencias" value="${u}"> ${URG_NOME[u]}</label>`).join('')}</div></div>
        <label class="campo">Quantidade de (un)<input type="number" min="0" name="cond_qtd_min"></label>
        <label class="campo">até (un)<input type="number" min="0" name="cond_qtd_max"></label>
        <label class="campo" style="grid-column:1/-1">Quando tiver urgência e quantidade
          <select name="cond_modo"><option value="e">As duas precisam valer (urgência E quantidade)</option><option value="ou">Basta uma valer (urgência OU quantidade)</option></select></label>
      </div>`, false)}</div>
    <div>${blocoExp('ngi-arte', 'Arte final e arquivo', `
      <div class="grade g3">
        <div class="campo">Formatos aceitos *
          <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:4px">${FORMATOS_ARQ.map(([v, n]) => `<label class="check" style="margin:0"><input type="checkbox" name="formatos" value="${v}" ${v !== 'imagem' ? 'checked' : ''}> ${n}</label>`).join('')}</div></div>
        <label class="campo">Páginas <span class="muted">(vazio = qualquer)</span><input type="number" min="1" max="50" name="paginas"></label>
        <label class="campo">Resolução mínima (dpi)<input type="number" min="30" max="2400" name="dpi_min"></label>
        <label class="check" style="grid-column:1/-1"><input type="checkbox" name="ultima_pagina_faca"> A última página é a faca (contorno de corte)</label>
        <div class="campo" id="ngi-faca">Cor da faca
          <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:4px">${FACA_CORES.map(([v, n]) => `<label class="check" style="margin:0"><input type="checkbox" name="faca_cores" value="${v}"> ${n}</label>`).join('')}</div></div>
      </div>
      <div class="grade g2" style="margin-top:8px">
        ${campoArquivoGabarito('')}
        <label class="campo" style="grid-column:1/-1">Instruções para a designer<textarea name="instrucoes" rows="2"></textarea></label>
      </div>`, false)}</div>
  </form>`, rodape: `<button class="btn" data-v>Voltar</button><button class="btn prim" data-s>Salvar gabarito</button>` });
  const f = $('#f-ngi', m.el), el = f.elements;
  const arqGab = ligarArquivoGabarito(m.el, () => ((grupos.find(g => g.id === el.grupo_id.value) || {}).pasta_url) || null);
  const lista = n => [...f.querySelectorAll(`[name="${n}"]:checked`)].map(c => c.value);
  const destino = () => (f.querySelector('[name=destino]:checked') || {}).value || 'material';
  const sinc = () => {
    const livre = el.tamanho_livre.checked, soItem = destino() === 'item';
    el.corte_largura_mm.disabled = livre; el.corte_altura_mm.disabled = livre;
    $('#ngi-novo', m.el).style.display = el.grupo_id.value === '__novo' ? '' : 'none';
    $('#ngi-regras', m.el).style.display = soItem ? 'none' : '';
    $('#ngi-nome-rot', m.el).textContent = soItem ? 'Nome do gabarito (opcional)' : 'Nome do gabarito *';
    $('#ngi-faca', m.el).style.display = el.ultima_pagina_faca.checked ? '' : 'none';
    const w = numBr(el.corte_largura_mm.value) || 0, h = numBr(el.corte_altura_mm.value) || 0, s2 = numBr(el.sangria_mm.value) || 0;
    $('#ngi-arq', m.el).textContent = !livre && w && h ? `Tamanho do arquivo (com sangria): ${fmtMm(+(w + 2 * s2).toFixed(2))} × ${fmtMm(+(h + 2 * s2).toFixed(2))} mm` : '';
  };
  f.querySelectorAll('input,select').forEach(x => { x.addEventListener('change', sinc); x.addEventListener('input', sinc); });
  sinc();
  const coletar = () => {
    const g = el.grupo_id.value;
    return {
      item_id: itemId, destino: destino(), grupo_id: g && g !== '__novo' ? g : null, material_novo: g === '__novo' ? el.material_novo.value : null,
      nome: el.nome.value, cond_urgencias: lista('cond_urgencias'), cond_qtd_min: el.cond_qtd_min.value, cond_qtd_max: el.cond_qtd_max.value, cond_modo: el.cond_modo.value,
      tamanho_livre: el.tamanho_livre.checked, corte_largura_mm: el.corte_largura_mm.value, corte_altura_mm: el.corte_altura_mm.value,
      sangria_mm: el.sangria_mm.value, seguranca_mm: el.seguranca_mm.value,
      formatos: lista('formatos'), paginas: el.paginas.value, dpi_min: el.dpi_min.value,
      ultima_pagina_faca: el.ultima_pagina_faca.checked, faca_cores: el.ultima_pagina_faca.checked ? lista('faca_cores') : [],
      arquivo_url: el.arquivo_url.value, instrucoes: el.instrucoes.value
    };
  };
  const enviar = async d => {
    const r = await api('criar_gabarito_item', d);
    if (r.repetido) { modalGabaritoRepetido(r, d, enviar); return r; }
    arqGab.enviado = null;
    await carregarGabaritos(true); m.fechar();
    toast(d.destino === 'item' ? 'Gabarito criado só para este item.'
      : d.destino === 'cliente' && r.acao === 'novo' ? `Gabarito gravado para o cliente ${clienteNome} e escolhido no item.`
      : r.acao === 'substituir' ? 'Gabarito do cadastro substituído e escolhido no item.'
      : r.acao === 'usar' ? 'O item ficou com o gabarito que já existia.'
      : `Gabarito gravado${r.material_criado ? ' no material novo' : ' no material'} e escolhido no item.`);
    if (d.destino !== 'item' && r.sugestao_para_item && !r.sugestao_e_o_mesmo)
      toast(`Pelas regras, o sistema sugeriria "${r.sugestao_para_item}" para este item; ele ficou com o gabarito escolhido.`);
    recarregar(); return r;
  };
  m.el.querySelector('[data-v]').onclick = () => { arqGab.cancelar && arqGab.cancelar(); m.fechar(); };
  m.el.querySelector('[data-s]').onclick = async () => {
    const d = coletar();
    if (d.destino !== 'item' && !d.grupo_id && !(d.material_novo || '').trim()) return toast('Escolha o material ou escreva o nome de um material novo.', true);
    try { await enviar(d); } catch (e) {}
  };
}
// Já existe gabarito com o mesmo nome ou as mesmas regras: compara e pergunta
function modalGabaritoRepetido(r, d, enviar) {
  const ex = r.existente;
  const nv = { ...d, corte_largura_mm: numBr(d.corte_largura_mm), corte_altura_mm: numBr(d.corte_altura_mm), sangria_mm: numBr(d.sangria_mm) || 0,
               seguranca_mm: numBr(d.seguranca_mm) || 0, cond_qtd_min: numBr(d.cond_qtd_min), cond_qtd_max: numBr(d.cond_qtd_max),
               cond_urgencias: d.cond_urgencias && d.cond_urgencias.length ? d.cond_urgencias : null, paginas: d.paginas || null, medidas_pendentes: false };
  const pend = !!ex.medidas_pendentes;
  const linhas = [['Quando usar', g => esc(textoCondicao(g)), false], ['Tamanho final', g => textoMedidas(g), false],
                  ['Sangria', g => fmtMm(g.sangria_mm || 0) + ' mm', true], ['Segurança', g => fmtMm(g.seguranca_mm || 0) + ' mm', true],
                  ['Páginas', g => (g.paginas || 'Qualquer') + (g.ultima_pagina_faca ? ' · última = faca' : ''), true], ['Arte final', g => esc(textoFormatos(g)), false]];
  const m = abrirModal({ titulo: r.mesmo_nome ? 'Já existe um gabarito com esse nome' : 'Já existe um gabarito com essas regras', largo: true, corpo: `
    <p class="small" style="margin:0 0 10px">No material <b>${esc(r.material_nome || '')}</b> já existe <b>${esc(ex.nome)}</b>${ex.cliente_nome ? ` (gabarito do cliente ${esc(ex.cliente_nome)})` : ''}${pend ? ' (ainda sem medidas)' : ''}. Compare e escolha:</p>
    <div class="tabela-wrap"><table><thead><tr><th></th><th>Já existe: ${esc(ex.nome)}</th><th>O seu${d.nome ? ': ' + esc(d.nome) : ''}</th></tr></thead><tbody>
      ${linhas.map(([n, fn, medida]) => `<tr><td class="small muted">${n}</td><td class="small">${pend && medida ? '—' : fn(ex)}</td><td class="small">${fn(nv)}</td></tr>`).join('')}
    </tbody></table></div>
    <ul class="small muted" style="margin:10px 0 0;padding-left:18px">
      <li><b>Substituir</b>: o gabarito do cadastro fica com as suas medidas e regras (os valores antigos vão para o histórico dele) e vale nos próximos pedidos.</li>
      <li><b>Usar o que já existe</b>: nada muda no cadastro; o item fica com o gabarito existente.</li>
      ${r.mesmo_nome ? '' : '<li><b>Gravar como mais um</b>: os dois ficam no material; o sistema sugere pela ordem e dá para escolher no item.</li>'}
    </ul>`,
    rodape: `<button class="btn" data-v style="margin-right:auto">Voltar</button>${r.mesmo_nome ? '' : '<button class="btn" data-a="novo">Gravar como mais um</button>'}<button class="btn" data-a="usar">Usar o que já existe</button><button class="btn prim" data-a="substituir">Substituir</button>` });
  m.el.querySelector('[data-v]').onclick = m.fechar;
  m.el.querySelectorAll('[data-a]').forEach(b => b.onclick = async () => { try { await enviar({ ...d, repetido: b.dataset.a }); m.fechar(); } catch (e) {} });
}

// Subir a urgência na mão (vendedor do pedido, Diretor/Administrador). Motivo obrigatório.
function modalUrgenciaItem(itemId) {
  const p = S.vistaAtual?.dados;
  const i = (p?.itens || []).find(x => x.id === itemId); if (!i) return;
  const u = i.urgencia || {};
  const opcoes = ['urgente', 'muito_urgente'].filter(n => ({ urgente: 2, muito_urgente: 3 })[n] > ({ normal: 1, urgente: 2, muito_urgente: 3 })[u.calculada] || !u.calculada);
  const m = abrirModal({ titulo: 'Urgência da produção', corpo: `
    <p style="margin:0 0 6px"><b>${esc(i.descricao)}</b></p>
    <p class="small muted" style="margin:0 0 12px">Pela conta do sistema: <b>${esc(URG_NOME[u.calculada] || '—')}</b>. ${esc(textoUrgencia(u))}.</p>
    ${u.manual ? `<div class="alerta" style="margin-bottom:12px">Marcado à mão como <b>${esc(URG_NOME[u.manual])}</b> por ${esc(u.manual_por_nome || '—')}: ${esc(u.manual_motivo || '')}</div>` : ''}
    ${opcoes.length ? `<form id="f-urg" class="grade g2">
      <label class="campo">Subir para<select name="nivel">${opcoes.map(n => `<option value="${n}" ${u.manual === n ? 'selected' : ''}>${URG_NOME[n]}</option>`).join('')}</select></label>
      <label class="campo" style="grid-column:1/-1">Motivo *<input type="text" name="motivo" maxlength="200" value="${esc(u.manual_motivo || '')}" placeholder="Ex.: cliente precisa para o evento de sábado"></label>
    </form>
    <p class="small muted" style="margin:8px 0 0">Na mão só dá para <b>subir</b> a urgência; para baixar, mude a previsão de entrega ou os dias de entrega.</p>`
    : '<p class="small muted" style="margin:0">O item já está como MUITO URGENTE pela conta do sistema.</p>'}`,
    rodape: `${u.manual ? '<button class="btn" data-tirar style="margin-right:auto">Tirar a marcação à mão</button>' : ''}<button class="btn" data-v>Voltar</button>${opcoes.length ? '<button class="btn prim" data-s>Salvar</button>' : ''}` });
  m.el.querySelector('[data-v]').onclick = m.fechar;
  const bt = m.el.querySelector('[data-tirar]');
  if (bt) bt.onclick = async () => { try { await api('item_urgencia', { item_id: itemId, nivel: null }); m.fechar(); toast('Vale de novo a conta do sistema.'); recarregar(); } catch (e) {} };
  const bs = m.el.querySelector('[data-s]');
  if (bs) bs.onclick = async () => {
    const d = formDados($('#f-urg', m.el));
    if (!d.motivo.trim()) return toast('Escreva o motivo da urgência.', true);
    try { await api('item_urgencia', { item_id: itemId, nivel: d.nivel, motivo: d.motivo.trim() }); m.fechar(); toast('Urgência atualizada.'); recarregar(); } catch (e) {}
  };
}
// Selo Digital do item: o vendedor segue a regra do sistema, marca ou desmarca
function modalDigitalItem(itemId) {
  const p = S.vistaAtual?.dados;
  const i = (p?.itens || []).find(x => x.id === itemId); if (!i) return;
  const dg = (i.urgencia && i.urgencia.digital) || {};
  const atual = dg.manual === true ? 'sim' : dg.manual === false ? 'nao' : 'regra';
  const m = abrirModal({ titulo: 'Impressão digital', corpo: `
    <p style="margin:0 0 6px"><b>${esc(i.descricao)}</b> · ${num(i.quantidade)} un</p>
    <p class="small muted" style="margin:0 0 12px">A digital (Konica) é para quantidades pequenas e produção no mesmo dia. Pela regra do sistema este item
      <b>${dg.regra ? 'vai para a digital' : 'não vai para a digital'}</b>${dg.regra && dg.motivo ? ` (${esc(dg.motivo)})` : ''}.
      Regra: muito urgente, abaixo da tiragem mínima do fornecedor (cartões: 100 un) ou impressão de papelaria.</p>
    ${dg.manual != null ? `<div class="alerta" style="margin-bottom:12px">${dg.manual ? 'Marcado' : 'Desmarcado'} à mão por ${esc(dg.manual_por_nome || '—')}${dg.manual_em ? ' em ' + dataHora(dg.manual_em) : ''}.</div>` : ''}
    <div class="campo">
      <label class="caixa-linha"><input type="radio" name="dig" value="regra" ${atual === 'regra' ? 'checked' : ''}><span><b>Seguir a regra do sistema</b></span></label>
      <label class="caixa-linha" style="margin-top:6px"><input type="radio" name="dig" value="sim" ${atual === 'sim' ? 'checked' : ''}><span><b>Vai para a digital</b><br><span class="small muted">A designer monta a folha (A4 ou SRA3) no arquivo para impressão.</span></span></label>
      <label class="caixa-linha" style="margin-top:6px"><input type="radio" name="dig" value="nao" ${atual === 'nao' ? 'checked' : ''}><span><b>Não vai para a digital</b></span></label></div>`,
    rodape: `<button class="btn" data-v>Voltar</button><button class="btn prim" data-s>Salvar</button>` });
  m.el.querySelector('[data-v]').onclick = m.fechar;
  const bs = m.el.querySelector('[data-s]');
  bs.onclick = async () => {
    const v = m.el.querySelector('[name=dig]:checked').value;
    try { await ocupado(bs, () => api('item_digital', { item_id: itemId, digital: v === 'regra' ? null : v === 'sim' }));
      m.fechar(); toast(v === 'regra' ? 'O selo Digital segue a regra do sistema.' : v === 'sim' ? 'Item marcado para a impressão digital.' : 'Item fora da impressão digital.'); recarregar(); } catch (e) {}
  };
}
// Dias de entrega do pedido (padrão: 1 para entrega no endereço, 0 para retirada)
function modalDiasEntrega() {
  const p = S.vistaAtual?.dados; if (!p) return;
  const padrao = p.forma_entrega === 'entrega' ? 1 : 0;
  const m = abrirModal({ titulo: 'Dias de entrega', corpo: `
    <p class="small muted" style="margin:0 0 12px">Quantos dias úteis a entrega leva até o cliente. O sistema desconta esses dias para saber quanto sobra para a produção (3 ou mais = prazo normal; 1 ou 2 = urgente; 0 = muito urgente).</p>
    <form id="f-dent" class="grade g2">
      <label class="check" style="grid-column:1/-1"><input type="checkbox" name="padrao" ${p.dias_entrega == null ? 'checked' : ''}> Usar o padrão (${padrao} ${padrao === 1 ? 'dia' : 'dias'} — ${p.forma_entrega === 'entrega' ? 'entrega no endereço' : 'retirada no balcão'})</label>
      <label class="campo">Dias úteis de entrega<input type="number" name="dias" min="0" max="30" value="${esc(p.dias_entrega ?? padrao)}"></label>
    </form>`, rodape: `<button class="btn" data-v>Voltar</button><button class="btn prim" data-s>Salvar</button>` });
  const f = $('#f-dent', m.el).elements;
  const sinc = () => { f.dias.disabled = f.padrao.checked; };
  f.padrao.onchange = sinc; sinc();
  m.el.querySelector('[data-v]').onclick = m.fechar;
  m.el.querySelector('[data-s]').onclick = async () => {
    try { await api('pedido_dias_entrega', { pedido_id: p.id, dias_entrega: f.padrao.checked ? null : f.dias.value }); m.fechar(); toast('Dias de entrega atualizados.'); recarregar(); } catch (e) {}
  };
}

// ----- tela Cadastros › Gabaritos -----
const FORMATOS_ARQ = [['pdf', 'PDF'], ['cdr', 'CorelDRAW (.cdr)'], ['imagem', 'Imagem (JPG/PNG)']];
const FACA_CORES = [['magenta', 'Magenta'], ['preto', 'Preto']];
function textoCondicao(g) {
  const urg = g.cond_urgencias && g.cond_urgencias.length ? g.cond_urgencias.map(u => URG_NOME[u] ? URG_NOME[u].toLowerCase() : u).join(' ou ') : '';
  const q = g.cond_qtd_min != null && g.cond_qtd_max != null ? `de ${num(g.cond_qtd_min)} a ${num(g.cond_qtd_max)} un`
          : g.cond_qtd_min != null ? `a partir de ${num(g.cond_qtd_min)} un` : g.cond_qtd_max != null ? `até ${num(g.cond_qtd_max)} un` : '';
  if (!urg && !q) return 'Sempre';
  if (urg && q) return `${urg} ${g.cond_modo === 'ou' ? 'OU' : 'E'} ${q}`;
  return urg || q;
}
function textoMedidas(g) {
  if (g.medidas_pendentes) return badge('Medidas pendentes', 'b-ambar');
  const tam = g.tamanho_livre ? 'Tamanho livre' : `${fmtMm(g.corte_largura_mm)} × ${fmtMm(g.corte_altura_mm)} mm`;
  const arq = !g.tamanho_livre && Number(g.sangria_mm) ? ` <span class="muted">(arquivo ${fmtMm(Number(g.corte_largura_mm) + 2 * Number(g.sangria_mm))} × ${fmtMm(Number(g.corte_altura_mm) + 2 * Number(g.sangria_mm))})</span>` : '';
  return tam + arq;
}
rota('gabaritos', async (_p, el) => {
  const r = await carregarGabaritos(true);
  const ed = !!r.pode_editar;
  const todos = ed && S.cache.gabTodos;
  const dados = todos ? await api('gabaritos', { todos: true }, true) : r;
  definirTopoEm(el, 'Gabaritos', ed ? `<label class="check" style="margin:0"><input type="checkbox" ${todos ? 'checked' : ''} onchange="S.cache.gabTodos=this.checked;recarregar()"> Mostrar inativos</label>
    <button class="btn" onclick="modalGrupoGabarito(null)">Novo material</button>
    <button class="btn prim" onclick="assistenteEnviarGabarito()">Enviar gabarito</button>` : '');
  const grupos = dados.grupos || [];
  vistaDoEl(el).gabaritos = grupos;
  const todosGab = grupos.flatMap(gr => gr.gabaritos.filter(g => g.ativo));
  const nPend = todosGab.filter(g => g.medidas_pendentes).length;
  const filtro = S.cache.gabFiltro || 'todos';
  // Fechado: nome do material, quantos gabaritos e se falta medida. Aberto: links, ações e a lista curta dos gabaritos.
  const resumoGrupo = gr => {
    const n = gr.gabaritos.length, pend = gr.gabaritos.filter(g => g.medidas_pendentes).length;
    return `<b>${esc(gr.nome)}</b> <span class="small muted">${n} ${n === 1 ? 'gabarito' : 'gabaritos'}</span>
      ${gr.ativo ? '' : badge('Inativo', 'b-cinza')}
      ${!n ? '' : pend === n ? badge('Medidas pendentes', 'b-ambar') : pend ? badge(`${pend} ${pend === 1 ? 'pendente' : 'pendentes'}`, 'b-ambar') : badge('Medidas ok', 'b-verde')}`;
  };
  const corpoGrupo = gr => `
    <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-bottom:8px">
      <span class="small muted" style="margin-right:6px">${esc(gr.categoria_nome || 'Sem categoria')}${gr.itens_usando ? ` · usado em ${gr.itens_usando} ${gr.itens_usando == 1 ? 'item' : 'itens'}` : ''}</span>
      ${gr.pasta_url ? `<a class="btn peq" href="${esc(gr.pasta_url)}" target="_blank" rel="noopener">Pasta no Drive</a>` : ''}
      ${gr.instrucoes_url ? `<a class="btn peq" href="${esc(gr.instrucoes_url)}" target="_blank" rel="noopener">Instruções</a>` : ''}
      ${ed ? `<button class="btn peq" data-gr-ed="${gr.id}">Editar material</button><button class="btn peq prim" data-gb-novo="${gr.id}">Novo gabarito</button>` : ''}
    </div>
    ${gr.observacoes ? `<div class="small" style="margin-bottom:8px">${esc(gr.observacoes)}</div>` : ''}
    ${gr.gabaritos.length ? `<div class="tabela-wrap"><table><thead><tr><th>Gabarito</th><th>Quando usar</th><th>Tamanho final</th><th></th></tr></thead><tbody>
      ${gr.gabaritos.map(g => `<tr class="clicavel" data-gab-linha data-pend="${g.medidas_pendentes ? 1 : 0}" data-txt="${esc((g.nome + ' ' + (g.cliente_nome || '')).toLowerCase())}" data-gb-ver="${g.id}" data-gb-gr="${gr.id}" style="${g.ativo ? '' : 'opacity:.55'}">
        <td><b>${esc(g.nome)}</b> ${g.cliente_nome ? badge('Cliente: ' + g.cliente_nome, 'b-azul') : ''} ${g.ativo ? '' : badge('Inativo', 'b-cinza')}${textoOrigemGabarito(g) ? `<div class="small muted">${textoOrigemGabarito(g)}</div>` : ''}</td>
        <td class="small">${esc(textoCondicao(g))}</td>
        <td class="small">${textoMedidas(g)}</td>
        <td class="small dir">${g.arquivo_url ? `<a href="${esc(g.arquivo_url)}" target="_blank" rel="noopener" onclick="event.stopPropagation()">${g.arquivo_url.includes('/folders/') ? 'Abrir pasta' : 'Abrir arquivo'}</a>` : ''}</td>
      </tr>`).join('')}</tbody></table></div>
      <p class="small muted" style="margin:6px 0 0">Clique num gabarito para ver sangria, segurança, páginas e formatos${ed ? ' e editar' : ''}.</p>`
    : '<p class="small muted" style="margin:0">Nenhum gabarito neste material ainda.</p>'}`;
  el.innerHTML = `
    <div class="painel">
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
        <input type="search" id="gab-busca" placeholder="Buscar material ou gabarito…" value="${esc(S.cache.gabBusca || '')}" style="flex:1;min-width:200px;max-width:360px">
        <select id="gab-filtro" style="width:auto">
          <option value="todos" ${filtro === 'todos' ? 'selected' : ''}>Todos</option>
          <option value="pendentes" ${filtro === 'pendentes' ? 'selected' : ''}>Com medidas pendentes</option>
          <option value="prontos" ${filtro === 'prontos' ? 'selected' : ''}>Com medidas preenchidas</option>
        </select>
        <span class="small muted" id="gab-contagem"></span>
      </div>
      <div class="small" style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap;align-items:center">
        <span><b>${num(grupos.length)}</b> materiais · <b>${num(todosGab.length)}</b> gabaritos</span>
        ${nPend ? badge(num(nPend) + ' com medidas pendentes', 'b-ambar') : badge('todos com medidas', 'b-verde')}
        ${blocoExp('gab-ajuda', 'Como funciona', `<p class="small muted" style="margin:0;max-width:760px">Cada <b>material</b> tem um ou mais <b>gabaritos</b>. O sistema sugere o gabarito pela <b>urgência da produção</b> e pela <b>quantidade</b> do item; a designer abre o arquivo pelo link. As medidas daqui são as que a conferência da arte final vai usar. Gabarito com <b>medidas pendentes</b> ainda não é sugerido. Arquivo acima de <b>${num(dados.limite_mb || 100)} MB</b> vai para o checklist.</p>`, false, 'leve')}
      </div>
    </div>
    <div class="painel" style="padding:8px 14px">
      <div class="lista-exp">${grupos.map(gr => `<div data-gab-painel data-nome="${esc(gr.nome.toLowerCase())}" style="${gr.ativo ? '' : 'opacity:.6'}">${blocoExp('gab-' + gr.id, resumoGrupo(gr), corpoGrupo(gr), false)}</div>`).join('')}</div>
      ${grupos.length ? '' : '<div class="vazio">Nenhum material cadastrado.</div>'}
    </div>`;
  // Busca e filtro sem ir ao servidor. Se a busca deixar até 3 materiais, eles abrem sozinhos.
  const aplicar = () => {
    const q = ($('#gab-busca', el).value || '').trim().toLowerCase();
    const f = $('#gab-filtro', el).value;
    S.cache.gabBusca = q; S.cache.gabFiltro = f;
    let nMat = 0, nLin = 0;
    const visiveis = [];
    el.querySelectorAll('[data-gab-painel]').forEach(pn => {
      const d = pn.querySelector('details');
      const casaMat = !!q && pn.dataset.nome.includes(q);
      const linhas = [...pn.querySelectorAll('[data-gab-linha]')];
      let vis = 0;
      linhas.forEach(tr => {
        const ok = (!q || casaMat || tr.dataset.txt.includes(q)) && (f === 'todos' || (f === 'pendentes') === (tr.dataset.pend === '1'));
        tr.style.display = ok ? '' : 'none'; if (ok) vis++;
      });
      const mostra = linhas.length ? vis > 0 : (f === 'todos' && (!q || casaMat));
      pn.style.display = mostra ? '' : 'none';
      d.open = expAberto(d.dataset.exp, false);
      if (mostra) { nMat++; nLin += vis; visiveis.push(d); }
    });
    if (q && visiveis.length <= 3) visiveis.forEach(d => d.open = true);
    $('#gab-contagem', el).textContent = q || f !== 'todos' ? `${nMat} ${nMat === 1 ? 'material' : 'materiais'}, ${nLin} ${nLin === 1 ? 'gabarito' : 'gabaritos'}` : '';
  };
  $('#gab-busca', el).oninput = aplicar; $('#gab-filtro', el).onchange = aplicar; aplicar();
  el.querySelectorAll('[data-gr-ed]').forEach(b => b.onclick = () => modalGrupoGabarito(b.dataset.grEd));
  el.querySelectorAll('[data-gb-novo]').forEach(b => b.onclick = () => modalGabarito(b.dataset.gbNovo, null));
  el.querySelectorAll('[data-gb-ver]').forEach(tr => tr.onclick = () => ed ? modalGabarito(tr.dataset.gbGr, tr.dataset.gbVer) : modalVerGabarito(tr.dataset.gbGr, tr.dataset.gbVer));
});
const textoOrigemGabarito = g => g.origem_pedido_numero ? `criado no pedido ${esc(g.origem_pedido_numero)}${g.criado_por_nome ? ' por ' + esc(g.criado_por_nome) : ''}` : '';
const textoFormatos = g => (g.formatos || []).map(f => (FORMATOS_ARQ.find(x => x[0] === f) || [, f])[1].replace(' (.cdr)', '').replace(' (JPG/PNG)', '')).join(', ');
// Detalhe do gabarito só para leitura (designer e quem não edita)
function modalVerGabarito(grupoId, id) {
  const gr = grupoDaTela(grupoId) || {}; const g = (gr.gabaritos || []).find(x => x.id === id); if (!g) return;
  const campo = (rot, val) => `<div><div class="small muted">${rot}</div>${val}</div>`;
  const pend = !!g.medidas_pendentes;
  const m = abrirModal({ titulo: `${gr.nome || 'Material'} · ${g.nome}`, corpo: `
    ${pend ? '<div class="alerta" style="margin-bottom:12px">As medidas deste gabarito ainda não foram cadastradas no sistema. Use o arquivo do Drive como referência.</div>' : ''}
    ${g.cliente_nome ? `<p class="small" style="margin:0 0 10px">Gabarito do cliente <b>${esc(g.cliente_nome)}</b>: vale só nos pedidos dele e vem antes dos gerais (o item pede confirmação).</p>` : ''}
    <div class="grade g3" style="row-gap:14px">
      ${campo('Quando usar', esc(textoCondicao(g)))}
      ${campo('Tamanho final', textoMedidas(g))}
      ${campo('Sangria (cada lado)', pend ? '—' : fmtMm(g.sangria_mm) + ' mm')}
      ${campo('Segurança', pend ? '—' : fmtMm(g.seguranca_mm) + ' mm')}
      ${campo('Páginas', (g.paginas || 'Qualquer') + (g.ultima_pagina_faca ? ` · última = faca${g.faca_cores?.length ? ' (' + g.faca_cores.join(' ou ') + ')' : ''}` : ''))}
      ${g.paginas_ordem && g.paginas_ordem.length ? campo('Ordem das páginas', esc(g.paginas_ordem.map((x, k) => `${k + 1}. ${PAGINA_NOME[x] || x}`).join(' · '))) : ''}
      ${campo('Arte final', esc(textoFormatos(g)) + (g.dpi_min ? ` · mín. ${g.dpi_min} dpi` : ''))}
    </div>
    ${g.instrucoes ? `<p class="small" style="margin:14px 0 0"><span class="muted">Instruções:</span> ${esc(g.instrucoes)}</p>` : ''}
    ${textoOrigemGabarito(g) ? `<p class="small muted" style="margin:10px 0 0">${textoOrigemGabarito(g)}.</p>` : ''}`,
    rodape: `${g.arquivo_url ? `<a class="btn" href="${esc(g.arquivo_url)}" target="_blank" rel="noopener">${g.arquivo_url.includes('/folders/') ? 'Abrir pasta' : 'Abrir arquivo'}</a>` : ''}<button class="btn prim" data-v>Fechar</button>` });
  m.el.querySelector('[data-v]').onclick = m.fechar;
}
/* ---------- (30/10) Gabaritos no Drive: escolher Offset/Digital, a pasta e enviar o arquivo pelo sistema ---------- */
const podeGabaritos = () => !!(S.perm && S.perm.pode_gabaritos);
const idDriveDoLink = u => { const m = String(u || '').match(/\/(?:file\/d|folders)\/([A-Za-z0-9_-]{10,})/) || String(u || '').match(/[?&]id=([A-Za-z0-9_-]{10,})/); return m ? m[1] : null; };
const linkArquivoDrive = id => `https://drive.google.com/file/d/${id}/view`;
const linkPastaDrive = id => `https://drive.google.com/drive/folders/${id}`;
// janela que escolhe Offset/Digital → pasta (navega, cria) → e, no modo arquivo, envia o arquivo
// resolve { tipo:'arquivo', id, nome, url, pasta } ou { tipo:'pasta', id, nome, url } ou null
function janelaDriveGabarito({ modo = 'arquivo', pastaInicial = null, nomeSugerido = '', titulo } = {}) {
  return new Promise(resolve => {
    let feito = false; const fim = v => { if (!feito) { feito = true; resolve(v); } };
    let caminho = []; // [{id, nome}]
    const pastaIni = idDriveDoLink(pastaInicial);
    const m = abrirModal({ titulo: titulo || (modo === 'arquivo' ? 'Enviar arquivo do gabarito' : 'Pasta do material no Drive'), largo: true, corpo: `
      <div data-passo1>
        <p style="margin-top:0">Onde fica este gabarito na pasta <b>Gabaritos GVH</b>?</p>
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          <button type="button" class="btn" data-raiz="offset" style="min-width:150px"><b>Offset</b></button>
          <button type="button" class="btn" data-raiz="digital" style="min-width:150px"><b>Digital</b></button>
          ${pastaIni ? `<button type="button" class="btn link" data-atual>Usar a pasta atual do material</button>` : ''}
        </div>
      </div>
      <div data-passo2 hidden>
        <div class="small" data-trilha style="margin-bottom:8px"></div>
        <div data-pastas class="gd-pastas"><span class="muted small">Carregando…</span></div>
        <div style="display:flex;gap:6px;margin-top:8px;align-items:center;flex-wrap:wrap">
          <input type="text" data-nova placeholder="Nome da pasta nova" style="flex:1;min-width:180px" value="${esc(modo === 'pasta' ? nomeSugerido : '')}">
          <button type="button" class="btn peq" data-criar>Criar pasta aqui</button>
        </div>
        ${modo === 'arquivo' ? `<div class="gd-envio">
          <label class="campo" style="margin:0">Arquivo do gabarito (.cdr, .pdf…)<input type="file" data-arq></label>
          <div class="small muted" data-prog style="margin-top:4px"></div>
        </div>` : ''}
      </div>`,
      rodape: `<button class="btn" data-v>Voltar</button>${modo === 'arquivo' ? '<button class="btn prim" data-ok disabled>Enviar para esta pasta</button>' : '<button class="btn prim" data-ok disabled>Usar esta pasta</button>'}` });
    const q = s => m.el.querySelector(s);
    const bOk = q('[data-ok]');
    const atual = () => caminho[caminho.length - 1];
    const desenharTrilha = () => {
      q('[data-trilha]').innerHTML = caminho.map((c, k) => k < caminho.length - 1 ? `<a href="#" data-volta="${k}">${esc(c.nome)}</a>` : `<b>${esc(c.nome)}</b>`).join(' › ');
      q('[data-trilha]').querySelectorAll('[data-volta]').forEach(a => a.onclick = e => { e.preventDefault(); caminho = caminho.slice(0, +a.dataset.volta + 1); abrir(); });
      bOk.disabled = modo === 'arquivo' ? !(q('[data-arq]') && q('[data-arq]').files.length) : false;
    };
    const abrir = async pre => {
      desenharTrilha();
      const box = q('[data-pastas]'); box.innerHTML = '<span class="muted small">Carregando…</span>';
      try {
        const r = pre || await api('gabarito_drive', { op: 'pastas', pasta_id: atual().id }, true);
        const l = r.pastas || [];
        box.innerHTML = l.length ? l.map(p => `<button type="button" class="gd-pasta" data-id="${esc(p.id)}" data-nome="${esc(p.name)}">📁 ${esc(p.name)}</button>`).join('')
          : '<span class="muted small">Nenhuma subpasta aqui. O arquivo fica nesta pasta, ou crie uma pasta nova.</span>';
        box.querySelectorAll('[data-id]').forEach(b => b.onclick = () => { caminho.push({ id: b.dataset.id, nome: b.dataset.nome }); abrir(); });
      } catch (e) { box.innerHTML = `<span class="small" style="color:var(--vermelho)">${esc(e.message)}</span>`; }
    };
    const comecar = (id, nome, pre) => { caminho = [{ id, nome }]; q('[data-passo1]').hidden = true; q('[data-passo2]').hidden = false; abrir(pre); };
    m.el.querySelectorAll('[data-raiz]').forEach(b => b.onclick = async () => {
      try { const r = await api('gabarito_drive', { op: 'pastas', raiz: b.dataset.raiz }, true); comecar(r.pasta_id, b.dataset.raiz === 'offset' ? 'Offset' : 'Digital', r); }
      catch (e) { toast(e.message, true); }
    });
    const ba = q('[data-atual]'); if (ba) ba.onclick = () => comecar(pastaIni, 'Pasta do material');
    q('[data-criar]').onclick = async () => {
      const nome = q('[data-nova]').value.trim(); if (!nome) return toast('Escreva o nome da pasta.', true);
      const btn = q('[data-criar]');
      await ocupado(btn, async () => {
        try { const r = await api('gabarito_drive', { op: 'criar_pasta', pasta_id: atual().id, nome }, true);
          q('[data-nova]').value = ''; caminho.push({ id: r.pasta.id, nome: r.pasta.name || nome }); toast('Pasta criada.'); abrir(); }
        catch (e) { toast(e.message, true); }
      });
    };
    const arq = q('[data-arq]'); if (arq) arq.onchange = desenharTrilha;
    q('[data-v]').onclick = () => { m.fechar(); fim(null); };
    bOk.onclick = async () => {
      const p = atual(); if (!p) return;
      if (modo === 'pasta') { m.fechar(); fim({ tipo: 'pasta', id: p.id, nome: p.nome, url: linkPastaDrive(p.id) }); return; }
      const f = arq.files[0]; if (!f) return toast('Escolha o arquivo.', true);
      await ocupado(bOk, async () => {
        try {
          const mime = f.type || 'application/octet-stream';
          const r = await api('gabarito_drive', { op: 'upload', pasta_id: p.id, nome: f.name, mime, tamanho: f.size }, true);
          if (!r.upload_url) throw new Error('O Drive não devolveu o endereço de envio.');
          const resp = await new Promise((ok, falha) => {
            const x = new XMLHttpRequest(); x.open('PUT', r.upload_url); x.setRequestHeader('Content-Type', mime);
            x.upload.onprogress = e => { if (e.lengthComputable) q('[data-prog]').textContent = `Enviando… ${Math.round(e.loaded / e.total * 100)}%`; };
            x.onload = () => { if (x.status >= 200 && x.status < 300) { try { ok(JSON.parse(x.responseText || '{}')); } catch { falha(new Error('Resposta inválida do Drive.')); } } else falha(new Error(`O Drive recusou o envio (${x.status}).`)); };
            x.onerror = () => falha(new Error('Falha de conexão ao enviar para o Drive.'));
            x.send(f);
          });
          if (!resp.id) throw new Error('O Drive não confirmou o arquivo.');
          m.fechar(); fim({ tipo: 'arquivo', id: resp.id, nome: f.name, url: linkArquivoDrive(resp.id), pasta: caminho.map(c => c.nome).join(' › ') });
        } catch (e) { q('[data-prog]').textContent = ''; toast(e.message, true); }
      });
    };
  });
}
// campo "Arquivo do gabarito": link + botão Enviar arquivo
function campoArquivoGabarito(valor) {
  return `<div class="campo" style="grid-column:1/-1" data-arq-gab>Arquivo do gabarito
    <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
      <input type="url" name="arquivo_url" value="${esc(valor || '')}" placeholder="Envie o arquivo ou cole o link do Drive" style="flex:1;min-width:220px">
      ${podeGabaritos() ? `<button type="button" class="btn peq prim" data-env-gab>${valor ? 'Trocar arquivo' : 'Enviar arquivo'}</button>` : ''}
      ${valor ? `<a class="btn peq" href="${esc(valor)}" target="_blank" rel="noopener">Abrir</a>` : ''}
    </div>
    <span class="small muted" data-env-info>${valor ? 'Ao trocar o arquivo, o anterior vai para a lixeira do Drive quando ninguém mais usar.' : ''}</span></div>`;
}
// liga o botão; pastaPadrao() devolve o link da pasta do material (ou null)
function ligarArquivoGabarito(raiz, pastaPadrao) {
  const box = raiz.querySelector('[data-arq-gab]'); if (!box) return {};
  const inp = box.querySelector('[name=arquivo_url]'), bt = box.querySelector('[data-env-gab]');
  const estado = { anterior: inp.value || '', enviado: null };
  if (bt) bt.onclick = async () => {
    const r = await janelaDriveGabarito({ modo: 'arquivo', pastaInicial: pastaPadrao ? pastaPadrao() : null });
    if (!r) return;
    estado.enviado = r.id; inp.value = r.url;
    box.querySelector('[data-env-info]').innerHTML = `Enviado para <b>${esc(r.pasta)}</b>: ${esc(r.nome)}. Salve o gabarito para valer.`;
  };
  estado.depoisDeSalvar = async () => {
    // arquivo trocado: o antigo vai para a lixeira (o banco só deixa se nenhum gabarito ou material usar mais)
    const velho = idDriveDoLink(estado.anterior), novo = idDriveDoLink(inp.value);
    if (velho && velho !== novo && /\/file\/d\//.test(estado.anterior)) { try { await api('gabarito_drive', { op: 'lixeira', file_id: velho }, true); } catch (e) {} }
  };
  estado.cancelar = async () => { // enviou e desistiu: tira o arquivo que acabou de subir
    if (estado.enviado) { try { await api('gabarito_drive', { op: 'lixeira', file_id: estado.enviado }, true); } catch (e) {} }
  };
  return estado;
}
// "Enviar gabarito": produto novo, gabarito novo de uma regra nova ou substituir um gabarito que já existe
async function assistenteEnviarGabarito() {
  if (!podeGabaritos()) return toast('Você não tem permissão para incluir gabaritos.', true);
  await carregarGabaritos();
  const grupos = gruposGabarito().filter(g => g.ativo !== false).slice().sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  const m = abrirModal({ titulo: 'Enviar gabarito', corpo: `
    <div style="display:grid;gap:6px">
      <label class="check"><input type="radio" name="tp" value="produto" checked> <span><b>Produto novo</b> <span class="muted small">— material que ainda não existe no sistema (cria a pasta dele no Drive)</span></span></label>
      <label class="check"><input type="radio" name="tp" value="novo"> <span><b>Gabarito novo</b> <span class="muted small">— outra variação ou regra de um material que já existe</span></span></label>
      <label class="check"><input type="radio" name="tp" value="trocar"> <span><b>Substituir um gabarito</b> <span class="muted small">— troca o arquivo de um gabarito que já existe</span></span></label>
    </div>
    <div data-esc-mat hidden style="margin-top:12px">
      <label class="campo">Material<select data-mat><option value="">Selecione</option>${grupos.map(g => `<option value="${g.id}">${esc(g.nome)}</option>`).join('')}</select></label>
      <label class="campo" data-esc-gab hidden>Gabarito<select data-gab></select></label>
    </div>`,
    rodape: `<button class="btn" data-v>Voltar</button><button class="btn prim" data-s>Continuar</button>` });
  const tp = () => m.el.querySelector('[name=tp]:checked').value;
  const sel = m.el.querySelector('[data-mat]'), selG = m.el.querySelector('[data-gab]');
  const sinc = () => {
    m.el.querySelector('[data-esc-mat]').hidden = tp() === 'produto';
    m.el.querySelector('[data-esc-gab]').hidden = tp() !== 'trocar';
    const gr = grupos.find(g => g.id === sel.value);
    selG.innerHTML = `<option value="">Selecione</option>` + ((gr && gr.gabaritos) || []).filter(g => g.ativo).map(g => `<option value="${g.id}">${esc(g.nome)}</option>`).join('');
  };
  m.el.querySelectorAll('[name=tp]').forEach(r => r.onchange = sinc); sel.onchange = sinc; sinc();
  m.el.querySelector('[data-v]').onclick = m.fechar;
  m.el.querySelector('[data-s]').onclick = () => {
    const t = tp();
    if (t === 'produto') { m.fechar(); modalGrupoGabarito(null, { depois: 'gabarito' }); return; }
    if (!sel.value) return toast('Escolha o material.', true);
    if (t === 'trocar' && !selG.value) return toast('Escolha o gabarito que será substituído.', true);
    m.fechar(); modalGabarito(sel.value, t === 'trocar' ? selG.value : null, { abrirEnvio: true });
  };
}
function grupoDaTela(id) { return (S.vistaAtual?.gabaritos || []).find(g => g.id === id) || gruposGabarito().find(g => g.id === id); }
async function modalGrupoGabarito(id, opts = {}) {
  await carregarBase();
  const g = id ? grupoDaTela(id) : { ativo: true, ordem: 100 };
  const m = abrirModal({ titulo: id ? 'Material' : 'Novo material', largo: true, corpo: `<form id="f-gr" class="grade g2">
      <label class="campo" style="grid-column:1/-1">Nome * <span class="muted">(ex.: Cartão de Visita UVF, Adesivo impressão e recorte)</span><input type="text" name="nome" maxlength="80" value="${esc(g.nome || '')}"></label>
      <label class="campo">Categoria<select name="categoria_id">${opcoesCategoria(g.categoria_id, false).replace('Selecione a categoria', 'Sem categoria')}</select></label>
      <label class="campo">Ordem <span class="muted">(menor aparece primeiro)</span><input type="number" name="ordem" value="${esc(g.ordem ?? 100)}"></label>
      <div class="campo" style="grid-column:1/-1">Pasta na "Gabaritos GVH"
        <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
          <input type="url" name="pasta_url" value="${esc(g.pasta_url || '')}" placeholder="Escolha ou crie a pasta (Offset ou Digital)" style="flex:1;min-width:220px">
          <button type="button" class="btn peq prim" data-pasta-gab>${g.pasta_url ? 'Trocar pasta' : 'Escolher ou criar pasta'}</button>
        </div></div>
      <label class="campo" style="grid-column:1/-1">Link das instruções (documento)<input type="url" name="instrucoes_url" value="${esc(g.instrucoes_url || '')}" placeholder="https://docs.google.com/document/…"></label>
      <label class="campo" style="grid-column:1/-1">Observações<textarea name="observacoes" rows="2">${esc(g.observacoes || '')}</textarea></label>
      ${id ? `<label class="check" style="grid-column:1/-1"><input type="checkbox" name="ativo" ${g.ativo ? 'checked' : ''}> Ativo (aparece para escolher no item)</label>` : ''}
      ${id && g.itens_usando ? `<p class="small muted" style="grid-column:1/-1;margin:0">Usado em ${g.itens_usando} ${g.itens_usando == 1 ? 'item' : 'itens'} de pedido: não dá para excluir, só desativar.</p>` : ''}
    </form>`, rodape: `${id && !g.itens_usando ? '<button class="btn perigo" data-x style="margin-right:auto">Excluir material</button>' : ''}<button class="btn" data-v>Voltar</button><button class="btn prim" data-s>Salvar</button>` });
  const f = $('#f-gr', m.el);
  m.el.querySelector('[data-pasta-gab]').onclick = async () => {
    const r = await janelaDriveGabarito({ modo: 'pasta', pastaInicial: f.elements.pasta_url.value || null, nomeSugerido: f.elements.nome.value.trim() });
    if (r) f.elements.pasta_url.value = r.url;
  };
  m.el.querySelector('[data-v]').onclick = m.fechar;
  const bx = m.el.querySelector('[data-x]');
  if (bx) bx.onclick = async () => {
    const n = (g.gabaritos || []).length;
    if (!await confirmar(`Excluir o material "${esc(g.nome)}"${n ? ` e ${n === 1 ? 'o gabarito dele' : `os ${n} gabaritos dele`}` : ''}? Não dá para desfazer. Os arquivos no Drive não são apagados.`, 'Excluir', true)) return;
    try { await api('excluir_gabarito_grupo', { id }); await carregarGabaritos(true); delete S.exp['gab-' + id]; m.fechar(); toast('Material excluído.'); recarregar(); } catch (e) {}
  };
  m.el.querySelector('[data-s]').onclick = async () => {
    const d = formDados(f); if (id) { d.id = id; d.ativo = f.elements.ativo.checked; }
    try {
      const r = await api('salvar_gabarito_grupo', d); await carregarGabaritos(true); m.fechar();
      if (!id && opts.depois === 'gabarito' && r && r.id) { toast('Material criado. Agora inclua o gabarito dele.'); modalGabarito(r.id, null, { abrirEnvio: true }); }
      else toast('Material salvo.');
      recarregar();
    } catch (e) {}
  };
}
function modalGabarito(grupoId, id, opts = {}) {
  const gr = grupoDaTela(grupoId) || {};
  const g = id ? (gr.gabaritos || []).find(x => x.id === id) : { ativo: true, formatos: ['pdf'], sangria_mm: 0, seguranca_mm: 0, cond_modo: 'e', prioridade: ((gr.gabaritos || []).length + 1) * 10 };
  const marc = (lista, v) => (lista || []).includes(v) ? 'checked' : '';
  const m = abrirModal({ titulo: `${gr.nome || 'Material'} · ${id ? 'gabarito' : 'novo gabarito'}`, largo: true, corpo: `<form id="f-gb">
    <div class="grade g3">
      <label class="campo" style="grid-column:span 2">Nome * <span class="muted">(ex.: Prazo normal acima de 250 un)</span><input type="text" name="nome" maxlength="80" value="${esc(g.nome || '')}"></label>
      <label class="campo">Ordem de teste <span class="muted">(menor primeiro)</span><input type="number" name="prioridade" value="${esc(g.prioridade ?? 100)}"></label>
    </div>
    <h3 style="margin:14px 0 6px">Quando usar</h3>
    <p class="small muted" style="margin:0 0 8px">Deixe tudo em branco para valer sempre. O sistema testa os gabaritos do material pela ordem e usa o primeiro que servir.</p>
    <div class="grade g3">
      <div class="campo">Urgência da produção
        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:4px">${['normal', 'urgente', 'muito_urgente'].map(u => `<label class="check" style="margin:0"><input type="checkbox" name="cond_urgencias" value="${u}" ${marc(g.cond_urgencias, u)}> ${URG_NOME[u]}</label>`).join('')}</div></div>
      <label class="campo">Quantidade de (un)<input type="number" min="0" name="cond_qtd_min" value="${esc(g.cond_qtd_min ?? '')}"></label>
      <label class="campo">até (un)<input type="number" min="0" name="cond_qtd_max" value="${esc(g.cond_qtd_max ?? '')}"></label>
      <label class="campo" style="grid-column:1/-1">Quando tiver urgência e quantidade
        <select name="cond_modo"><option value="e" ${g.cond_modo !== 'ou' ? 'selected' : ''}>As duas precisam valer (urgência E quantidade)</option>
          <option value="ou" ${g.cond_modo === 'ou' ? 'selected' : ''}>Basta uma valer (urgência OU quantidade)</option></select></label>
    </div>
    <h3 style="margin:14px 0 6px">Medidas (mm)</h3>
    ${g.medidas_pendentes ? `<div class="alerta" style="margin-bottom:8px">Este gabarito veio da pasta do Drive e ainda está com <b>medidas pendentes</b>: o sistema não sugere ele até alguém salvar as medidas. Ao salvar, ele deixa de ser pendente.</div>` : ''}
    <div class="grade g4">
      <label class="check" style="grid-column:1/-1"><input type="checkbox" name="tamanho_livre" ${g.tamanho_livre && !g.medidas_pendentes ? 'checked' : ''}> Tamanho livre (a medida vem do pedido, como adesivo de recorte e lona)</label>
      <label class="campo">Largura final<input type="text" inputmode="decimal" name="corte_largura_mm" value="${esc(fmtMm(g.corte_largura_mm))}"></label>
      <label class="campo">Altura final<input type="text" inputmode="decimal" name="corte_altura_mm" value="${esc(fmtMm(g.corte_altura_mm))}"></label>
      <label class="campo">Sangria (cada lado)<input type="text" inputmode="decimal" name="sangria_mm" value="${esc(fmtMm(g.sangria_mm))}"></label>
      <label class="campo">Segurança <span class="muted">(para dentro do corte)</span><input type="text" inputmode="decimal" name="seguranca_mm" value="${esc(fmtMm(g.seguranca_mm))}"></label>
    </div>
    <p class="small muted" id="gb-arq" style="margin:4px 0 0"></p>
    <h3 style="margin:14px 0 6px">Arte final</h3>
    <div class="grade g3">
      <div class="campo">Formatos aceitos *
        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:4px">${FORMATOS_ARQ.map(([v, n]) => `<label class="check" style="margin:0"><input type="checkbox" name="formatos" value="${v}" ${marc(g.formatos, v)}> ${n}</label>`).join('')}</div></div>
      <label class="campo">Páginas <span class="muted">(vazio = qualquer)</span><input type="number" min="1" max="50" name="paginas" value="${esc(g.paginas ?? '')}"></label>
      <label class="campo">Resolução mínima (dpi)<input type="number" min="30" max="2400" name="dpi_min" value="${esc(g.dpi_min ?? '')}"></label>
      <label class="check" style="grid-column:1/-1"><input type="checkbox" name="ultima_pagina_faca" ${g.ultima_pagina_faca ? 'checked' : ''}> A última página é a faca (contorno de corte)</label>
      <div class="campo" id="gb-faca">Cor da faca
        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:4px">${FACA_CORES.map(([v, n]) => `<label class="check" style="margin:0"><input type="checkbox" name="faca_cores" value="${v}" ${marc(g.faca_cores, v)}> ${n}</label>`).join('')}</div></div>
      <div class="campo" style="grid-column:1/-1">Ordem das páginas <span class="muted">(o que é cada página do arquivo, na ordem; vazio = frente e verso). A conferência e o montador usam esta ordem.</span>
        <div data-ordem style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-top:6px"></div></div>
    </div>
    <div class="grade g2" style="margin-top:10px">
      ${campoArquivoGabarito(g.arquivo_url)}
      <label class="campo" style="grid-column:1/-1">Instruções para a designer<textarea name="instrucoes" rows="3">${esc(g.instrucoes || '')}</textarea></label>
      ${id ? `<label class="check" style="grid-column:1/-1"><input type="checkbox" name="ativo" ${g.ativo ? 'checked' : ''}> Ativo</label>` : ''}
    </div>
    ${id && g.cliente_nome ? `<p class="small" style="margin:10px 0 0">Gabarito do cliente <b>${esc(g.cliente_nome)}</b>: vale só nos pedidos dele e vem antes dos gerais (o item pede confirmação).</p>` : ''}
    ${id && textoOrigemGabarito(g) ? `<p class="small muted" style="margin:10px 0 0">${textoOrigemGabarito(g)}.</p>` : ''}
    ${id && g.alteracoes ? `<div style="margin-top:8px">${blocoExp('gb-hist-' + id, `Alterações anteriores (${g.alteracoes})`, '<div data-gb-hist class="small muted">Carregando…</div>', false, 'leve')}</div>` : ''}
    </form>`,
    rodape: `${id ? '<button class="btn perigo" data-x style="margin-right:auto">Excluir gabarito</button>' : ''}<button class="btn" data-v>Voltar</button><button class="btn prim" data-s>Salvar gabarito</button>` });
  const f = $('#f-gb', m.el), el = f.elements;
  const arqGab = ligarArquivoGabarito(m.el, () => gr.pasta_url || null);
  if (opts.abrirEnvio) setTimeout(() => { const b = m.el.querySelector('[data-env-gab]'); if (b) b.click(); }, 50);
  const bx = m.el.querySelector('[data-x]');
  if (bx) bx.onclick = async () => {
    if (!await confirmar(`Excluir o gabarito "${esc(g.nome)}" de ${esc(gr.nome || 'este material')}? Não dá para desfazer. O arquivo no Drive não é apagado.`, 'Excluir', true)) return;
    try { await api('excluir_gabarito', { id }); await carregarGabaritos(true); m.fechar(); toast('Gabarito excluído.'); recarregar(); } catch (e) {}
  };
  const lista = n => [...f.querySelectorAll(`[name="${n}"]:checked`)].map(c => c.value);
  const sinc = () => {
    const livre = el.tamanho_livre.checked;
    el.corte_largura_mm.disabled = livre; el.corte_altura_mm.disabled = livre;
    $('#gb-faca', m.el).style.display = el.ultima_pagina_faca.checked ? '' : 'none';
    const n = s => Number(String(s || '').replace(',', '.')) || 0;
    const w = n(el.corte_largura_mm.value), h = n(el.corte_altura_mm.value), s = n(el.sangria_mm.value);
    $('#gb-arq', m.el).textContent = !livre && w && h ? `Tamanho do arquivo (com sangria): ${fmtMm(+(w + 2 * s).toFixed(2))} × ${fmtMm(+(h + 2 * s).toFixed(2))} mm` : '';
  };
  ['tamanho_livre', 'ultima_pagina_faca'].forEach(k => el[k].onchange = sinc);
  // ordem das páginas: lista em chips, com "+ página"
  let ordem = Array.isArray(g.paginas_ordem) ? [...g.paginas_ordem] : [];
  const boxOrd = m.el.querySelector('[data-ordem]');
  const desenharOrdem = () => {
    const usados = new Set(ordem.filter(x => x !== 'extra'));
    boxOrd.innerHTML = ordem.map((x, k) => `<span class="badge b-cinza" style="display:inline-flex;gap:6px;align-items:center;font-size:12px">${k + 1}. ${esc(PAGINA_NOME[x] || x)}
        <a href="#" data-rm="${k}" title="Tirar" style="color:inherit;text-decoration:none">×</a></span>`).join('')
      + `<select data-add style="width:auto;padding:3px 6px;font-size:12px"><option value="">+ página</option>${Object.entries(PAGINA_NOME).filter(([v]) => v === 'extra' || !usados.has(v)).map(([v, n]) => `<option value="${v}">${esc(n)}</option>`).join('')}</select>`
      + (ordem.length ? ' <a href="#" data-limpa class="small">limpar</a>' : '');
    boxOrd.querySelectorAll('[data-rm]').forEach(a => a.onclick = e => { e.preventDefault(); ordem.splice(+a.dataset.rm, 1); aplicarOrdem(); });
    boxOrd.querySelector('[data-add]').onchange = e => { if (e.target.value) { ordem.push(e.target.value); aplicarOrdem(); } };
    const lp = boxOrd.querySelector('[data-limpa]'); if (lp) lp.onclick = e => { e.preventDefault(); ordem = []; aplicarOrdem(); };
  };
  const aplicarOrdem = () => {
    if (ordem.length) { el.paginas.value = ordem.length; el.ultima_pagina_faca.checked = ordem[ordem.length - 1] === 'faca'; sinc(); }
    desenharOrdem();
  };
  desenharOrdem();
  const dh = m.el.querySelector('details[data-exp^="gb-hist-"]');
  const carregarHist = async () => {
    const box = m.el.querySelector('[data-gb-hist]'); if (!box || box.dataset.ok) return; box.dataset.ok = 1;
    try {
      const r = await api('gabarito_historico', { id }, true);
      box.innerHTML = (r.historico || []).map(h => `<div style="padding:6px 0;border-top:1px solid var(--linha-2)">
          <b>${dataHora(h.em)}</b>${h.por_nome ? ' · ' + esc(h.por_nome) : ''}${h.motivo ? ' — ' + esc(h.motivo) : ''}
          <div>Antes: ${esc(h.dados.nome)} · ${esc(textoCondicao(h.dados))} · ${textoMedidas(h.dados)}${h.dados.medidas_pendentes ? '' : ` · sangria ${fmtMm(h.dados.sangria_mm)} · segurança ${fmtMm(h.dados.seguranca_mm)} mm`}</div></div>`).join('') || 'Nenhuma alteração.';
    } catch (e) { box.textContent = 'Não foi possível carregar.'; }
  };
  if (dh) { dh.addEventListener('toggle', () => { if (dh.open) carregarHist(); }); if (dh.open) carregarHist(); }
  ['corte_largura_mm', 'corte_altura_mm', 'sangria_mm'].forEach(k => el[k].oninput = sinc);
  sinc();
  m.el.querySelector('[data-v]').onclick = m.fechar;
  m.el.querySelector('[data-s]').onclick = async () => {
    const d = {
      grupo_id: grupoId, nome: el.nome.value, prioridade: el.prioridade.value,
      cond_urgencias: lista('cond_urgencias'), cond_qtd_min: el.cond_qtd_min.value, cond_qtd_max: el.cond_qtd_max.value, cond_modo: el.cond_modo.value,
      tamanho_livre: el.tamanho_livre.checked, corte_largura_mm: el.corte_largura_mm.value, corte_altura_mm: el.corte_altura_mm.value,
      sangria_mm: el.sangria_mm.value, seguranca_mm: el.seguranca_mm.value,
      formatos: lista('formatos'), paginas: el.paginas.value, dpi_min: el.dpi_min.value,
      ultima_pagina_faca: el.ultima_pagina_faca.checked, faca_cores: el.ultima_pagina_faca.checked ? lista('faca_cores') : [],
      arquivo_url: el.arquivo_url.value, instrucoes: el.instrucoes.value, paginas_ordem: ordem
    };
    if (id) { d.id = id; d.ativo = el.ativo.checked; }
    try { await api('salvar_gabarito', d); await arqGab.depoisDeSalvar(); arqGab.enviado = null; await carregarGabaritos(true); m.fechar(); toast('Gabarito salvo.'); recarregar(); } catch (e) {}
  };
  m.el.querySelector('[data-v]').addEventListener('click', () => arqGab.cancelar && arqGab.cancelar());
}

