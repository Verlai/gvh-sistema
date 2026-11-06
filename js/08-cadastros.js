/* ---------- conferência dos cadastros recebidos pelo link ---------- */
async function modalCadastrosLink() {
  const r = await api('listar_cadastros_link', {});
  S.cadLink = {}; r.solicitacoes.forEach(x => S.cadLink[x.id] = x);
  const m = abrirModal({ titulo: `Cadastros pelo link (${r.pendentes})`, largo: true, corpo: r.solicitacoes.length ? `
    <p class="small muted" style="margin:0 0 10px">Confira os dados enviados pelo cliente. Aprovando, o cadastro entra no sistema (ou atualiza o cliente que já existe, sem mexer em revenda, observação fixa e contatos).</p>
    <div class="tabela-wrap"><table><thead><tr><th>Enviado em</th><th>Cliente</th><th>Documento</th><th>Contato</th><th></th></tr></thead><tbody>
    ${r.solicitacoes.map(x => `<tr><td class="num">${dataHora(x.updated_at)}</td>
      <td><b>${esc(x.nome)}</b>${x.existente ? `<div>${badge('Já é cliente: ' + x.existente.nome, 'b-ambar')}</div>` : ''}${x.orcamento_numero ? `<div>${badge('Aprovou o orçamento ' + x.orcamento_numero, 'b-verde')}</div>` : ''}</td>
      <td class="num">${esc(fmtDoc(x.cpf_cnpj))}</td><td class="small">${esc(fmtTel(x.dados.telefone))}<br>${esc(x.dados.email || '')}</td>
      <td class="dir"><button class="btn prim peq" onclick="conferirCadastroLink('${x.id}')">Conferir</button></td></tr>`).join('')}
    </tbody></table></div>` : '<div class="vazio">Nenhum cadastro aguardando conferência.</div>',
    rodape: `<button class="btn" data-v>Fechar</button><button class="btn" id="cl-link">Link de cadastro</button>` });
  m.el.querySelector('[data-v]').onclick = m.fechar;
  m.el.querySelector('#cl-link').onclick = () => { m.fechar(); modalLinkCadastro(); };
}
async function abrirConferenciaCadastro(id) {
  const r = await api('listar_cadastros_link', {});
  S.cadLink = {}; r.solicitacoes.forEach(x => S.cadLink[x.id] = x);
  if (!S.cadLink[id]) { toast('Este cadastro já foi conferido. Atualize a tela.', true); return recarregar(); }
  conferirCadastroLink(id);
}
function conferirCadastroLink(id) {
  document.querySelector('.fundo-modal')?.remove();
  const x = S.cadLink[id], d = x.dados;
  const lin = (rot, v) => v ? `<div><div class="small muted">${rot}</div>${esc(v)}</div>` : '';
  const end = [d.logradouro && `${d.logradouro}, ${d.numero}`, d.complemento, d.bairro, d.cidade && `${d.cidade}/${d.uf}`, d.cep && 'CEP ' + d.cep.replace(/^(\d{5})(\d{3})$/, '$1-$2')].filter(Boolean).join(' · ');
  const m = abrirModal({ titulo: `Conferir cadastro · ${x.nome}`, largo: true, corpo: `
    ${x.existente ? `<div class="alerta" style="margin-bottom:12px"><b>Este documento já é do cliente ${esc(x.existente.nome)}.</b> Ao aprovar, nome, telefone, e-mail e endereço desse cadastro serão atualizados com os dados abaixo. Revenda, observação fixa e contatos continuam como estão.</div>` : ''}
    <div class="grade g3">
      ${lin(x.tipo_pessoa === 'PJ' ? 'CNPJ' : 'CPF', fmtDoc(x.cpf_cnpj))}${lin(x.tipo_pessoa === 'PJ' ? 'Razão social' : 'Nome completo', d.nome)}
      ${lin('Nome fantasia', d.nome_fantasia)}${lin('Ramo de atividade', d.segmento)}${lin('Inscrição estadual', d.inscricao_estadual)}${lin('Responsável', d.responsavel)}
      ${d.aniversario_dia ? lin('Aniversário', String(d.aniversario_dia).padStart(2, '0') + '/' + String(d.aniversario_mes).padStart(2, '0')) : ''}
      ${lin('Telefone', fmtTel(d.telefone) + (d.telefone_whatsapp ? ' (WhatsApp)' : ''))}${lin('E-mail', d.email)}${lin('Instagram', d.instagram && '@' + d.instagram)}
      <div style="grid-column:1/-1">${lin('Endereço', end)}</div>
      <div style="grid-column:1/-1" class="small muted">Enviado em ${dataHora(x.updated_at)} · aceite LGPD em ${dataHora(x.lgpd_aceite_em)}</div>
    </div>`,
    rodape: `<button class="btn" data-v>Voltar</button><button class="btn perigo" data-r>Recusar</button><button class="btn prim" data-a>${x.existente ? 'Aprovar e atualizar cliente' : 'Aprovar cadastro'}</button>` });
  m.el.querySelector('[data-v]').onclick = () => { m.fechar(); modalCadastrosLink(); };
  m.el.querySelector('[data-a]').onclick = async () => {
    const r = await api('revisar_cadastro_link', { id, acao: 'aprovar' }); m.fechar();
    toast(r.orcamento_numero ? `Cadastro aprovado. O orçamento ${r.orcamento_numero} já está ligado ao cliente e pode virar pedido.` : 'Cadastro aprovado.');
    if (VISTAS.get('clientes')) VISTAS.get('clientes').sujo = true;
    if (r.orcamento_id) { const v = VISTAS.get('orcamento/' + r.orcamento_id); if (v) v.sujo = true; }
    if (await confirmar('Cadastro aprovado. Quer abrir o cliente para completar dados internos (revenda, observação fixa)?', 'Abrir cliente')) modalCliente(r.cliente_id, recarregar);
    else recarregar();
  };
  m.el.querySelector('[data-r]').onclick = async () => {
    const motivo = prompt('Motivo da recusa (uso interno):'); if (!motivo || !motivo.trim()) return;
    await api('revisar_cadastro_link', { id, acao: 'recusar', motivo: motivo.trim() }); m.fechar(); toast('Cadastro recusado.'); modalCadastrosLink();
  };
}

/* ---------- CLIENTES ---------- */
rota('clientes', async (_p, el) => {
  definirTopoEm(el, 'Clientes', pode('cadastra_clientes') ? `<button class="btn" onclick="modalLinkCadastro()">Link de cadastro</button><button class="btn" onclick="modalCadastrosLink()">Cadastros pelo link</button><button class="btn prim" onclick="modalCliente(null, recarregar)">Novo cliente</button>` : '');
  const pend = pode('cadastra_clientes') ? (await api('listar_cadastros_link', { limite: 1 }).catch(() => ({ pendentes: 0 }))).pendentes : 0;
  el.innerHTML = `${pend ? `<a class="alerta" href="javascript:void(0)" onclick="modalCadastrosLink()" style="display:block;margin-bottom:16px;text-decoration:none;color:inherit"><b>${pend} ${pend > 1 ? 'cadastros enviados' : 'cadastro enviado'} pelo link</b> aguardando conferência. Clique para conferir.</a>` : ''}<div class="painel filtros"><label class="campo">Buscar<input type="search" id="cl-busca" placeholder="Nome, fantasia, CPF/CNPJ ou WhatsApp"></label></div><div class="painel" id="cl-lista"></div>`;
  const buscar = async () => {
    const r = await api('buscar_clientes', { busca: $('#cl-busca').value, limite: limLista('clientes'), incluir_inativos: true });
    $('#cl-lista').innerHTML = r.clientes.length ? `<div class="tabela-wrap"><table><thead><tr><th>Cliente</th><th>CPF / CNPJ</th><th>Contato</th><th>Cidade</th><th></th></tr></thead><tbody>
      ${r.clientes.map(c => `<tr class="clicavel" onclick="modalCliente('${c.id}', recarregar)"><td><b>${esc(c.nome_fantasia || c.nome)}</b>${c.nome_fantasia ? `<div class="small muted">${esc(c.nome)}</div>` : ''}</td>
        <td class="num">${esc(fmtDoc(c.cpf_cnpj) || '—')}</td><td>${esc(fmtTel(c.whatsapp || c.telefone))}<div class="small muted">${esc(c.email || '')}</div></td><td>${esc(c.cidade || '')}</td>
        <td>${c.revenda ? badge('Revenda', 'b-azul') : ''} ${c.ativo ? '' : badge('Inativo', 'b-cinza')}</td></tr>`).join('')}</tbody></table></div>` : '<div class="vazio">Nenhum cliente encontrado.</div>';
    $('#cl-lista').insertAdjacentHTML('beforeend', rodapeLista('clientes', r.clientes.length, r.total, 'cliente(s)'));
    ligarMais($('#cl-lista'), 'clientes', buscar);
  };
  let t; $('#cl-busca').oninput = () => { clearTimeout(t); t = setTimeout(() => { zerarLista('clientes'); buscar(); }, 350); };
  await buscar();
});

/* ---------- CATEGORIAS ---------- */
rota('categorias', async (_p, el) => {
  definirTopoEm(el, 'Categorias', `<button class="btn prim" onclick="modalCategoria(null)">Nova categoria</button>`);
  await carregarBase();
  const f = S.cache.filtroCat || '';
  const sug = f ? sugerirCategorias(f, 999) : [];
  const lista = (S.base.categorias || []).filter(c => !f || sug.includes(c) || normTxt(c.nome + ' ' + (c.ncm || '') + (c.servico ? ' servico' : '')).includes(normTxt(f)));
  el.innerHTML = `<div class="painel">
    <div class="linha-form" style="margin-bottom:12px"><label class="campo" style="max-width:360px">Buscar (nome, NCM ou apelido)<input type="search" id="f-cat" value="${esc(f)}"></label>
      <span class="small muted" style="padding-bottom:9px">A categoria define o NCM da nota. Os apelidos são o que o vendedor costuma escrever.</span></div>
    <div class="tabela-wrap"><table><thead><tr><th>Categoria</th><th>NCM</th><th>Apelidos</th><th></th></tr></thead><tbody>
    ${lista.map(c => `<tr class="clicavel" onclick="modalCategoria('${c.id}')"><td><b>${esc(c.nome)}</b></td><td class="num">${c.servico ? badge('Serviço · sem NCM', 'b-azul') : esc(c.ncm)}</td>
      <td class="small muted">${esc((c.apelidos || []).slice(0, 8).join(', '))}${(c.apelidos || []).length > 8 ? ` +${c.apelidos.length - 8}` : ''}</td>
      <td>${c.ativo ? '' : badge('Inativa', 'b-cinza')}</td></tr>`).join('') || '<tr><td colspan="4" class="vazio">Nenhuma categoria encontrada.</td></tr>'}
    </tbody></table></div></div>`;
  const b = $('#f-cat'); b.onchange = () => { S.cache.filtroCat = b.value; recarregar(); };
});
function modalCategoria(id, aoSalvar) {
  const c = id ? S.base.categorias.find(x => x.id === id) : { ativo: true, apelidos: [] };
  const ger = pode('gerencia_cadastros');
  const m = abrirModal({ titulo: id ? c.nome : 'Nova categoria', largo: true, corpo: `<form id="f-cat-m" class="grade g2">
      <label class="campo">Nome da categoria *<input type="text" name="nome" value="${esc(c.nome || '')}" placeholder="Ex.: Impressos publicitários"></label>
      <label class="campo" id="ncm-box">NCM * <span class="muted">(8 dígitos)</span><input type="text" name="ncm" value="${esc(c.ncm || '')}" placeholder="0000.00.00" inputmode="numeric"></label>
      <label class="check" style="grid-column:1/-1"><input type="checkbox" name="servico" value="true" ${c.servico ? 'checked' : ''}> <b>É serviço</b> <span class="muted small">(ex.: instalação — não tem NCM; a nota de serviço fica para o módulo de Nota fiscal)</span></label>
      <div class="small" id="ncm-info" style="grid-column:1/-1"></div>
      <label class="campo" style="grid-column:1/-1">Apelidos <span class="muted">(o que o vendedor pode escrever; um por linha ou separados por vírgula)</span>
        <textarea name="apelidos" rows="6">${esc((c.apelidos || []).join('\n'))}</textarea></label>
      ${id && ger ? `<label class="check" style="grid-column:1/-1"><input type="checkbox" name="ativo" ${c.ativo ? 'checked' : ''}> Categoria ativa</label>` : ''}
    </form>`,
    rodape: `<button class="btn" data-v>Voltar</button>${!id || ger ? '<button class="btn prim" data-s>Salvar categoria</button>' : ''}` });
  const f = $('#f-cat-m', m.el); let tmr, capIncomum = '';
  // capítulos que a GVH já usa (categorias ativas, com o NCM salvo); fora deles, só avisa
  const capsUsados = new Set((S.base.categorias || []).filter(x => x.ativo && x.ncm).map(x => String(x.ncm).slice(0, 2)));
  const ajustarServico = () => { const sv = f.elements.servico.checked; $('#ncm-box', m.el).classList.toggle('hidden', sv); if (sv) { $('#ncm-info', m.el).innerHTML = ''; capIncomum = ''; } };
  const consultar = () => { clearTimeout(tmr); tmr = setTimeout(async () => {
    const d = f.elements.ncm.value.replace(/\D/g, ''); const box = $('#ncm-info', m.el); capIncomum = '';
    if (d.length !== 8) { box.innerHTML = '<span class="muted">Digite os 8 dígitos do NCM.</span>'; return; }
    const r = await api('ncm_consultar', { ncm: d }, true).catch(() => null); if (!r) return;
    f.elements.ncm.value = r.codigo;
    const outras = (r.categorias || []).filter(n => n !== c.nome);
    box.innerHTML = (!r.tabela_carregada ? '<span class="muted">A tabela oficial de NCM ainda não foi carregada; o código não pôde ser conferido.</span>'
      : r.valido ? `<span style="color:var(--verde)">✓ ${esc(r.descricao || 'Código vigente')}</span>` : '<span style="color:var(--vermelho)">Este NCM não existe na tabela oficial vigente.</span>')
      + (outras.length ? `<div class="muted">Já usado em: ${esc(outras.join(', '))}</div>` : '');
    if (capsUsados.size && !capsUsados.has(d.slice(0, 2)) && (!r.tabela_carregada || r.valido)) {
      capIncomum = (r.descricao || '').split(' › ')[0] || `capítulo ${d.slice(0, 2)}`;
      box.innerHTML += `<div class="alerta small" style="margin-top:6px">Este NCM é de um capítulo que a gráfica não costuma usar: <b>${esc(capIncomum)}</b>. Confira se o código não foi digitado trocado.</div>`;
    }
  }, 400); };
  f.elements.ncm.oninput = consultar; if (c.ncm) consultar();
  f.elements.servico.onchange = () => { ajustarServico(); if (!f.elements.servico.checked && f.elements.ncm.value) consultar(); }; ajustarServico();
  m.el.querySelector('[data-v]').onclick = m.fechar;
  const bs = m.el.querySelector('[data-s]');
  if (bs) bs.onclick = async () => {
    if (capIncomum && !confirm(`O NCM é do capítulo "${capIncomum}", que a gráfica não costuma usar. Salvar mesmo assim?`)) return;
    const d = formDados(f); if (id) d.id = id;
    d.servico = f.elements.servico.checked; if (d.servico) d.ncm = '';
    if (id && ger) d.ativo = !!f.elements.ativo?.checked; else delete d.ativo;
    const r = await api('salvar_categoria', d); await carregarBase(); m.fechar(); toast('Categoria salva.');
    if (aoSalvar) aoSalvar(r.id); else recarregar();
  };
}

/* ---------- FORNECEDORES ---------- */
const CAT_FORN = { offset: 'Offset', digital: 'Digital', digital_cv: 'Digital e comunicação visual', comunicacao_visual: 'Comunicação visual' };
const podeCadastrarFornecedor = () => pode('gerencia_cadastros') || podeStatus('em_producao');
function opcoesFornecedor(sel) {
  const lista = (S.base.fornecedores || []).filter(f => f.ativo || f.id === sel);
  const grupo = cat => lista.filter(f => (f.categoria || '') === cat);
  const ops = l => l.map(f => `<option value="${f.id}" ${f.id === sel ? 'selected' : ''}>${esc(f.nome)}</option>`).join('');
  const sem = grupo('');
  return `<option value="">Selecione</option>`
    + Object.entries(CAT_FORN).map(([k, n]) => grupo(k).length ? `<optgroup label="${n}">${ops(grupo(k))}</optgroup>` : '').join('')
    + (sem.length ? `<optgroup label="Sem categoria">${ops(sem)}</optgroup>` : '');
}
function linkAcessoFornecedor(id) {
  const f = id && (S.base.fornecedores || []).find(x => x.id === id);
  if (!f || (!f.site && !f.login_site && !f.tem_senha)) return '';
  return `<button type="button" class="btn link peq" onclick="modalAcessoFornecedor('${f.id}')">Acesso ao site</button>`;
}
async function modalAcessoFornecedor(id) {
  const f = S.base.fornecedores.find(x => x.id === id); if (!f) return;
  const r = f.tem_senha ? await api('fornecedor_senha', { id }) : { senha: null };
  const site = f.site ? (/^https?:\/\//i.test(f.site) ? f.site : 'https://' + f.site) : '';
  const linha = (rot, val, k) => `<div class="campo"><span>${rot}</span><div style="display:flex;gap:6px;align-items:center">
      <input type="${k === 'senha' ? 'password' : 'text'}" readonly value="${esc(val || '')}" data-ac="${k}" style="flex:1">
      ${k === 'senha' && val ? `<button type="button" class="btn peq" data-ver>Mostrar</button>` : ''}
      ${val ? `<button type="button" class="btn peq" data-copiar="${k}">Copiar</button>` : ''}</div></div>`;
  const m = abrirModal({ titulo: `Acesso · ${f.nome}`, corpo: `
    ${site ? `<p style="margin:0 0 12px"><a href="${esc(site)}" target="_blank" rel="noopener">Abrir o site do fornecedor ↗</a></p>` : ''}
    ${linha('Login', f.login_site, 'login')}${linha('Senha', r.senha, 'senha')}
    ${!f.login_site && !r.senha ? '<p class="small muted">Nenhum login cadastrado.</p>' : ''}`,
    rodape: `<button class="btn" data-v>Fechar</button>` });
  m.el.querySelector('[data-v]').onclick = m.fechar;
  const vb = m.el.querySelector('[data-ver]');
  if (vb) vb.onclick = () => { const i = m.el.querySelector('[data-ac="senha"]'); const ver = i.type === 'password'; i.type = ver ? 'text' : 'password'; vb.textContent = ver ? 'Ocultar' : 'Mostrar'; };
  m.el.querySelectorAll('[data-copiar]').forEach(b => b.onclick = async () => {
    const v = m.el.querySelector(`[data-ac="${b.dataset.copiar}"]`).value;
    try { await navigator.clipboard.writeText(v); toast('Copiado.'); } catch { toast('Não foi possível copiar.', true); } });
}
rota('fornecedores', async (_p, el) => {
  definirTopoEm(el, 'Fornecedores', `<button class="btn prim" onclick="modalFornecedor(null, recarregar)">Novo fornecedor</button>`);
  await carregarBase();
  const l = S.base.fornecedores;
  el.innerHTML = `<div class="painel">${l.length ? `<div class="tabela-wrap"><table><thead><tr><th>Fornecedor</th><th>Categoria</th><th>Site</th><th>Login</th><th></th></tr></thead><tbody>
    ${l.map(f => `<tr class="clicavel" onclick="modalFornecedor('${f.id}', recarregar)"><td><b>${esc(f.nome)}</b></td>
      <td>${f.categoria ? esc(CAT_FORN[f.categoria]) : '<span class="muted">—</span>'}</td>
      <td class="small">${esc(f.site || '—')}</td>
      <td class="small">${esc(f.login_site || '—')}${f.tem_senha ? ' · senha cadastrada' : ''}</td>
      <td>${f.ativo ? '' : badge('Inativo', 'b-cinza')}</td></tr>`).join('')}
    </tbody></table></div>` : '<div class="vazio">Cadastre as gráficas parceiras para usar na pré-impressão.</div>'}</div>`;
});
function modalFornecedor(id, aoSalvar) {
  const f = id ? S.base.fornecedores.find(x => x.id === id) : { ativo: true };
  const m = abrirModal({ titulo: id ? f.nome : 'Novo fornecedor', corpo: `<form id="f-forn" class="grade g2">
    <label class="campo" style="grid-column:1/-1">Nome *<input type="text" name="nome" value="${esc(f.nome || '')}" required></label>
    <label class="campo" style="grid-column:1/-1">Categoria *<select name="categoria"><option value="">Selecione</option>${Object.entries(CAT_FORN).map(([k, n]) => `<option value="${k}" ${f.categoria === k ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
    <label class="campo" style="grid-column:1/-1">Site<input type="text" name="site" value="${esc(f.site || '')}" placeholder="Ex.: www.fornecedor.com.br"></label>
    <label class="campo">Login do site<input type="text" name="login_site" value="${esc(f.login_site || '')}" autocomplete="off"></label>
    <label class="campo">Senha do site<input type="password" name="senha_site" autocomplete="new-password" placeholder="${f.tem_senha ? 'Deixe em branco para manter' : ''}"></label>
    ${id ? `<label class="check" style="grid-column:1/-1"><input type="checkbox" name="ativo" value="true" ${f.ativo ? 'checked' : ''}> Ativo</label>` : ''}
    <p class="small muted" style="grid-column:1/-1;margin:0">A senha fica criptografada no banco e só aparece para quem cuida da pré-impressão e da produção.</p></form>`,
    rodape: `<button class="btn" data-v>Voltar</button><button class="btn prim" data-s>Salvar fornecedor</button>` });
  m.el.querySelector('[data-v]').onclick = m.fechar;
  m.el.querySelector('[data-s]').onclick = async () => {
    const d = formDados($('#f-forn', m.el));
    if (!d.nome.trim()) return toast('Informe o nome do fornecedor.', true);
    if (!d.categoria) return toast('Escolha a categoria do fornecedor.', true);
    if (!d.senha_site) delete d.senha_site;
    if (id) { d.id = id; d.ativo = !!d.ativo; } else d.ativo = true;
    const r = await api('salvar_fornecedor', d); m.fechar(); toast('Fornecedor salvo.');
    await carregarBase();
    if (aoSalvar) aoSalvar(r.id);
  };
}
/* cadastra o fornecedor sem sair da pré-impressão e já escolhe na linha (não recarrega a tela, para não perder o que foi digitado) */
function novoFornecedorNaLinha(itemId) {
  modalFornecedor(null, novoId => {
    $$('select[data-c="fornecedor_id"]').forEach(sel => { const atual = sel.value; sel.innerHTML = opcoesFornecedor(atual); });
    const tr = $(`[data-form-item="${itemId}"]`); const sel = tr && tr.querySelector('select[data-c="fornecedor_id"]');
    if (sel) { sel.value = novoId; sel.dispatchEvent(new Event('change')); }
  });
}

/* ---------- FERIADOS ---------- */
rota('sugestoes', async (_p, el) => {
  definirTopoEm(el, 'Produtos sugeridos', `<button class="btn prim" onclick="modalSugestao(null)">Novo produto sugerido</button>`);
  await carregarBase(); await carregarGabaritos().catch(() => {});
  const mat = id => id ? ((gruposGabarito().find(g => g.id === id) || {}).nome || '—') : '<span class="muted">—</span>';
  const cat = id => S.base.categorias.find(c => c.id === id)?.nome || '—';
  const lista = S.base.sugestoes || [];
  el.innerHTML = `<div class="painel">
    <p class="small muted" style="margin-top:0">Ao digitar no Produto (Novo pedido e orçamento), estes textos aparecem como sugestão e a categoria vem junto. <b>Quantidade e total continuam digitados à mão.</b> Use "…" no lugar da medida para modelos (ex.: "Painel em lona …cm"): o vendedor completa e o sistema não deixa salvar com o "…".</p>
    <div class="tabela-wrap"><table><thead><tr><th style="width:70px">Ordem</th><th>Produto</th><th>Categoria</th><th>Material do gabarito</th><th></th></tr></thead><tbody>
    ${lista.map(x => `<tr class="clicavel" data-sg="${x.id}"><td class="num">${x.ordem}</td><td><b>${esc(x.texto)}</b></td><td class="small">${esc(cat(x.categoria_id))}</td><td class="small">${x.gabarito_grupo_id ? esc(mat(x.gabarito_grupo_id)) : mat(null)}</td><td>${x.ativo ? '' : badge('Inativo', 'b-cinza')}</td></tr>`).join('') || '<tr><td colspan="5" class="vazio">Nenhum produto sugerido.</td></tr>'}
    </tbody></table></div></div>`;
  el.querySelectorAll('[data-sg]').forEach(tr => tr.onclick = () => modalSugestao(tr.dataset.sg));
});
function modalSugestao(id) {
  const x = id ? S.base.sugestoes.find(s => s.id === id) : { ativo: true, ordem: 100 };
  const m = abrirModal({ titulo: id ? 'Produto sugerido' : 'Novo produto sugerido', largo: true, corpo: `<form id="f-sg" class="grade g2">
      <label class="campo" style="grid-column:1/-1">Produto * <span class="muted">(texto que vai para o pedido; use "…" no lugar da medida em modelos)</span><input type="text" name="texto" value="${esc(x.texto || '')}" placeholder="Ex.: Folheto 10x14cm couchê 90g 4x0"></label>
      <label class="campo">Categoria *<select name="categoria_id">${opcoesCategoria(x.categoria_id, false)}</select></label>
      <label class="campo">Ordem <span class="muted">(menor aparece primeiro)</span><input type="number" name="ordem" value="${esc(x.ordem)}"></label>
      <label class="campo" style="grid-column:1/-1">Material do gabarito <span class="muted">(o item já vem com ele e o sistema sugere o gabarito; dá para trocar no pedido)</span>
        <select name="gabarito_grupo_id"><option value="">Nenhum</option>${gruposGabarito().map(g => `<option value="${g.id}" ${g.id === x.gabarito_grupo_id ? 'selected' : ''}>${esc(g.nome)}</option>`).join('')}</select></label>
      ${id ? `<label class="check" style="grid-column:1/-1"><input type="checkbox" name="ativo" ${x.ativo ? 'checked' : ''}> Ativo (aparece como sugestão)</label>` : ''}
    </form>`,
    rodape: `${id ? '<button class="btn perigo" data-x style="margin-right:auto">Excluir</button>' : ''}<button class="btn" data-v>Voltar</button><button class="btn prim" data-s>Salvar</button>` });
  const f = $('#f-sg', m.el).elements;
  m.el.querySelector('[data-v]').onclick = m.fechar;
  const bx = m.el.querySelector('[data-x]');
  if (bx) bx.onclick = async () => { if (!await confirmar(`Excluir "${x.texto}" das sugestões? Pedidos já feitos não mudam.`, 'Excluir', true)) return;
    await api('salvar_sugestao', { id, excluir: true }); await carregarBase(); m.fechar(); toast('Produto sugerido excluído.'); recarregar(); };
  m.el.querySelector('[data-s]').onclick = async () => {
    const d = { texto: f.texto.value, categoria_id: f.categoria_id.value, ordem: f.ordem.value, gabarito_grupo_id: f.gabarito_grupo_id.value || null }; if (id) { d.id = id; d.ativo = f.ativo.checked; }
    await api('salvar_sugestao', d); await carregarBase(); m.fechar(); toast('Produto sugerido salvo.'); recarregar();
  };
}

rota('feriados', async (_p, el) => {
  definirTopoEm(el, 'Feriados', '');
  const r = await api('feriados');
  r.feriados.forEach(f => S.feriados[f.data] = f);
  const TIPO = { nacional:'Nacional', estadual:'Estadual', municipal:'Municipal (Osasco)', facultativo:'Ponto facultativo', emenda:'Emenda' };
  el.innerHTML = `<div class="painel"><p class="small muted" style="margin-top:0">Usado para calcular o 5º dia útil do repasse de comissões. Marque "conta como feriado" nos dias em que a GVH não abre.</p>
    <form id="f-fer" class="linha-form" style="margin-bottom:16px">
      <label class="campo">Data<input type="date" name="data" required></label><label class="campo" style="flex:2">Nome<input type="text" name="nome" required></label>
      <label class="campo">Tipo<select name="tipo">${Object.entries(TIPO).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></label>
      <label class="check" style="flex:0;min-width:auto;padding-bottom:9px"><input type="checkbox" name="conta_como_feriado" value="true" checked> Conta como feriado</label>
      <button class="btn prim" style="flex:0">Salvar</button></form>
    <div class="tabela-wrap"><table><thead><tr><th>Data</th><th>Nome</th><th>Tipo</th><th>Conta como feriado</th><th></th></tr></thead><tbody>
    ${r.feriados.map(f => `<tr><td class="num">${data(f.data)}</td><td>${esc(f.nome)}</td><td>${esc(TIPO[f.tipo] || f.tipo)}</td>
      <td><button class="btn link peq" onclick="alternarFeriado('${f.data}')">${f.conta_como_feriado ? 'Sim' : 'Não'}</button></td>
      <td class="dir"><button class="btn link peq" onclick="excluirFeriado('${f.data}')">Excluir</button></td></tr>`).join('')}</tbody></table></div></div>`;
  $('#f-fer').onsubmit = async e => { e.preventDefault(); const d = formDados(e.target); d.conta_como_feriado = !!d.conta_como_feriado; await api('feriados', { salvar: d }); toast('Feriado salvo.'); recarregar(); };
});
async function alternarFeriado(dt) { const f = S.feriados[dt]; await api('feriados', { salvar: { ...f, conta_como_feriado: !f.conta_como_feriado } }); recarregar(); }
async function excluirFeriado(d) { if (!await confirmar('Excluir este feriado?', 'Excluir', true)) return; await api('feriados', { excluir: d }); recarregar(); }

/* ---------- USUÁRIOS (diretor) ---------- */
rota('usuarios', async (_p, el) => {
  definirTopoEm(el, 'Usuários', `<button class="btn prim" onclick="modalUsuario(null)">Novo usuário</button>`);
  const r = await api('listar_usuarios'); vistaDoEl(el).dados = r;
  el.innerHTML = `<div class="painel"><div class="tabela-wrap"><table><thead><tr><th>Nome</th><th>E-mail</th><th>Perfil</th><th>Comissão</th><th>Gabaritos</th><th></th></tr></thead><tbody>
    ${r.usuarios.map(u => `<tr class="clicavel" onclick="modalUsuario('${u.id}')"><td>${tagPessoa(u.nome, u.cor)}</td><td>${esc(u.email)}</td><td>${esc(u.perfil_nome)}</td>
      <td>${u.recebe_comissao ? num(u.percentual_comissao) + '%' : 'Não recebe (economizada)'}</td><td>${u.pode_gabaritos ? 'Pode alterar' : '<span class="muted">Só consulta</span>'}</td><td>${u.ativo ? '' : badge('Inativo', 'b-cinza')}</td></tr>`).join('')}
    </tbody></table></div></div>`;
});
function modalUsuario(id) {
  const u = id ? S.vistaAtual.dados.usuarios.find(x => x.id === id) : { ativo: true, recebe_comissao: true, percentual_comissao: 5, perfil: 'vendedor' };
  const m = abrirModal({ titulo: id ? u.nome : 'Novo usuário', corpo: `<form id="f-usu" class="grade g2">
    <label class="campo">Nome<input type="text" name="nome" value="${esc(u.nome || '')}"></label>
    <label class="campo">E-mail<input type="email" name="email" value="${esc(u.email || '')}"></label>
    <label class="campo">Perfil<select name="perfil">${S.vistaAtual.dados.perfis.map(p => `<option value="${esc(p.codigo)}" ${p.codigo === u.perfil ? 'selected' : ''}>${esc(p.nome)}</option>`).join('')}</select></label>
    <label class="campo">${id ? 'Nova senha (deixe em branco para manter)' : 'Senha'}<input type="text" name="senha" autocomplete="off"></label>
    <label class="campo">Comissão (%)<input type="number" step="0.01" name="percentual_comissao" value="${esc(u.percentual_comissao)}"></label>
    <div class="campo" style="grid-column:1/-1">
      <span>Cor nas etiquetas <span class="muted">(aparece nas telas de arte)</span></span>
      <input type="hidden" name="cor" id="u-cor" value="${esc(u.cor || '')}">
      <div class="cores" id="u-cores"></div>
      <div id="u-cor-previa" style="margin-top:8px"></div>
    </div>
    <label class="check"><input type="checkbox" name="recebe_comissao" value="true" ${u.recebe_comissao ? 'checked' : ''}> Recebe comissão</label>
    <label class="check"><input type="checkbox" name="ativo" value="true" ${u.ativo ? 'checked' : ''}> Ativo</label>
    <label class="check" style="grid-column:1/-1"><input type="checkbox" name="pode_gabaritos" value="true" ${u.pode_gabaritos ? 'checked' : ''}> Pode incluir, editar e excluir gabaritos</label></form>
    <p class="small muted" style="margin:0">Quem não recebe comissão tem o valor registrado como "comissão economizada". Trocar a senha encerra as sessões abertas desse usuário.</p>`,
    rodape: `<button class="btn" data-v>Voltar</button><button class="btn prim" data-s>Salvar usuário</button>` });
  // paleta: as cinco primeiras são as cores combinadas da equipe; as demais ficam para quem entrar depois
  const paleta = S.vistaAtual.dados.paleta || [];
  const usadas = new Map((S.vistaAtual.dados.usuarios || []).filter(x => x.cor && x.id !== id).map(x => [x.cor.toUpperCase(), x.nome]));
  const hCor = $('#u-cor', m.el);
  const desenharCores = () => {
    $('#u-cores', m.el).innerHTML = paleta.map(c => {
      const dono = usadas.get(c.toUpperCase());
      return `<button type="button" data-cor="${c}" class="${(hCor.value || '').toUpperCase() === c.toUpperCase() ? 'ativo' : ''}"
        style="background:${c}" title="${dono ? 'Já é a cor de ' + esc(dono) : 'Cor livre'}"></button>`;
    }).join('');
    const nome = $('#f-usu', m.el).elements.nome.value || 'Nome da pessoa';
    const dono = usadas.get((hCor.value || '').toUpperCase());
    $('#u-cor-previa', m.el).innerHTML = (hCor.value ? tagPessoa(nome, hCor.value) : '<span class="small muted">Sem cor escolhida: o sistema escolhe uma ao salvar.</span>')
      + (dono ? `<div class="small" style="color:var(--ambar, #9a6410);margin-top:6px">Atenção: essa cor já é de ${esc(dono)}.</div>` : '');
    $('#u-cores', m.el).querySelectorAll('[data-cor]').forEach(b => b.onclick = () => {
      hCor.value = (hCor.value || '').toUpperCase() === b.dataset.cor.toUpperCase() ? '' : b.dataset.cor;
      desenharCores();
    });
  };
  desenharCores();
  $('#f-usu', m.el).elements.nome.addEventListener('input', desenharCores);
  m.el.querySelector('[data-v]').onclick = m.fechar;
  m.el.querySelector('[data-s]').onclick = async () => {
    const d = formDados($('#f-usu', m.el)); d.ativo = !!d.ativo; d.recebe_comissao = !!d.recebe_comissao; d.pode_gabaritos = !!d.pode_gabaritos; if (id) d.id = id;
    await api('salvar_usuario', d); m.fechar(); toast('Usuário salvo.'); await carregarBase(); recarregar();
  };
}
