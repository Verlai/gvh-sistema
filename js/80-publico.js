/* ---------- PÁGINAS PÚBLICAS (cliente, sem login) ---------- */
function aplicarEstiloPublico() {
  if (document.getElementById('estilo-pub')) return;
  const est = document.createElement('style'); est.id = 'estilo-pub';
  est.textContent = `
    #pub { min-height: 100vh; background: #eef1f2; padding: 24px 12px 48px; font-family: Sora, Arial, sans-serif; color: #1d262d; }
    #pub .folha { max-width: 820px; margin: 0 auto; background: #fff; border-radius: 14px; box-shadow: 0 6px 30px rgba(29,38,45,.08); overflow: hidden; }
    #pub .cab { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; padding: 22px 26px 16px; border-bottom: 4px solid #00a986; flex-wrap: wrap; }
    #pub .cab img { height: 54px; }
    #pub .emp { text-align: right; font-size: 12px; color: #5a6770; line-height: 1.55; }
    #pub .emp b { color: #1d262d; font-size: 13px; }
    #pub .corpo { padding: 20px 26px 26px; }
    #pub h1 { margin: 0; font-size: 26px; letter-spacing: .4px; } #pub h1 span { color: #00a986; }
    #pub .linha-tit { display: flex; justify-content: space-between; align-items: flex-end; gap: 12px; flex-wrap: wrap; margin-bottom: 16px; }
    #pub .datas { font-size: 12.5px; color: #5a6770; text-align: right; line-height: 1.6; } #pub .datas b { color: #1d262d; }
    #pub .caixa { background: #f6f6f6; border-radius: 10px; padding: 12px 14px; margin-bottom: 16px; }
    #pub .rot { font-size: 10.5px; text-transform: uppercase; letter-spacing: 1.2px; color: #8a959c; font-weight: 600; margin-bottom: 4px; }
    #pub table { width: 100%; border-collapse: collapse; font-size: 13.5px; }
    #pub th { background: #1d262d; color: #fff; font-size: 10.5px; text-transform: uppercase; letter-spacing: .7px; text-align: left; padding: 9px 10px; font-weight: 600; }
    #pub td { padding: 10px; border-bottom: 1px solid #e2e6e8; vertical-align: top; }
    #pub .n { text-align: right; white-space: nowrap; }
    #pub .tot { margin: 14px 0 0 auto; max-width: 300px; font-size: 14px; }
    #pub .tot div { display: flex; justify-content: space-between; padding: 4px 10px; }
    #pub .tot .final { background: #00a986; color: #fff; border-radius: 8px; font-size: 18px; font-weight: 700; padding: 10px 12px; margin-top: 6px; }
    #pub .bloco { margin-top: 18px; } #pub .bloco p { margin: 0; font-size: 13.5px; white-space: pre-wrap; }
    #pub .aprovar { margin-top: 26px; border: 2px solid #00a986; border-radius: 12px; padding: 18px; }
    #pub .aprovar h2 { margin: 0 0 4px; font-size: 18px; }
    #pub .aprovar label { display: block; font-size: 12.5px; color: #5a6770; margin-top: 12px; }
    #pub .aprovar input, #pub .aprovar textarea { width: 100%; box-sizing: border-box; font: inherit; font-size: 15px; padding: 10px 12px; border: 1px solid #cfd6da; border-radius: 8px; margin-top: 4px; }
    #pub .aprovar textarea { min-height: 70px; resize: vertical; }
    #pub .bt { display: inline-block; border: 0; border-radius: 10px; padding: 13px 22px; font: inherit; font-weight: 600; font-size: 15px; cursor: pointer; text-decoration: none; }
    #pub .bt.prim { background: #00a986; color: #fff; } #pub .bt.prim:disabled { opacity: .6; cursor: default; }
    #pub .bt.sec { background: #fff; color: #1d262d; border: 1px solid #cfd6da; }
    #pub .ok { background: #e3f6f1; border-radius: 12px; padding: 16px 18px; margin-top: 26px; }
    #pub .ok b { color: #00795f; font-size: 17px; }
    #pub .aviso { background: #fdf3e1; border-radius: 12px; padding: 14px 18px; margin-top: 26px; }
    #pub .erro { color: #c0453b; font-size: 13px; margin-top: 8px; min-height: 1em; }
    #pub .acoes { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 14px; }
    #pub .rod { max-width: 820px; margin: 14px auto 0; text-align: center; font-size: 11.5px; color: #8a959c; }
    @media (max-width: 560px) { #pub .corpo, #pub .cab { padding-left: 14px; padding-right: 14px; } #pub h1 { font-size: 21px; } #pub .emp { text-align: left; }
      #pub .col-unit { display: none; } }
    @media print { #pub { background: #fff; padding: 0; } #pub .folha { box-shadow: none; } #pub .aprovar, #pub .acoes, #pub .rod { display: none; } }`;
  document.head.appendChild(est);
}

/* ---------- PÁGINA PÚBLICA DO ORÇAMENTO ---------- */
async function paginaPublicaOrcamento(chave) {
  document.title = 'Orçamento · Gráfica Venda Hoje';
  const logo = $('#logo-gvh', document)?.src || '';
  const raiz = document.createElement('div'); raiz.id = 'pub'; document.body.appendChild(raiz);
  aplicarEstiloPublico();
  const din = v => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const unit = (t, q) => Number(q) > 0 ? (Number(t) / Number(q)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 4 }) : '';
  const desenhar = (o, msgErro) => {
    const empresaLinhas = [EMPRESA.cnpj && 'CNPJ ' + EMPRESA.cnpj, EMPRESA.endereco, [EMPRESA.telefone, o.vendedor_email || EMPRESA.email].filter(Boolean).join(' · '), EMPRESA.site].filter(Boolean);
    const rodapeAprov = o.situacao === 'aprovado'
      ? `<div class="ok"><b>Orçamento aprovado ✓</b><div style="margin-top:4px">Aprovado por <b style="font-size:inherit;color:inherit">${esc(o.aprovado_por || '')}</b>${o.aprovado_em ? ' em ' + dataHoraLonga(o.aprovado_em) : ''}. ${o.cadastro_em_conferencia ? 'Recebemos também o seu cadastro. ' : ''}A equipe da Gráfica Venda Hoje já foi avisada e vai seguir com o seu pedido.</div></div>`
      : o.situacao === 'vencido' ? `<div class="aviso"><b>Este orçamento venceu em ${data(o.validade)}.</b> Fale com a Gráfica Venda Hoje para atualizar os valores.</div>`
      : o.situacao === 'indisponivel' ? `<div class="aviso"><b>Este orçamento não está mais disponível para aprovação.</b> Fale com a Gráfica Venda Hoje.</div>`
      : o.precisa_cadastro ? `<div style="margin-top:26px;border:2px solid #00a986;border-radius:12px;padding:18px"><h2 style="margin:0 0 4px;font-size:18px">Aprovar este orçamento</h2>
          <div style="font-size:13px;color:#5a6770">Confira os itens e os valores. Para aprovar, preencha o seu cadastro abaixo: precisamos dele para abrir o pedido, fazer a entrega e emitir a nota fiscal. Ao aprovar, a Gráfica Venda Hoje recebe a sua confirmação com o seu nome, a data e a hora.</div>
          <div id="pub-cad"></div></div>`
      : `<div class="aprovar"><h2>Aprovar este orçamento</h2><div style="font-size:13px;color:#5a6770">Confira os itens e os valores. Ao aprovar, a Gráfica Venda Hoje recebe a sua confirmação com o seu nome, a data e a hora.</div>
          <label>Seu nome *<input type="text" id="pub-nome" maxlength="120" autocomplete="name"></label>
          <label>Comentário (opcional)<textarea id="pub-com" maxlength="1000" placeholder="Algum ajuste ou recado para a equipe?"></textarea></label>
          <div class="erro" id="pub-erro">${esc(msgErro || '')}</div>
          <div class="acoes"><button class="bt prim" id="pub-aprovar">Aprovar orçamento</button></div></div>`;
    raiz.innerHTML = `<div class="folha">
      <div class="cab">${logo ? `<img src="${logo}" alt="Gráfica Venda Hoje">` : `<b>${esc(EMPRESA.nome)}</b>`}
        <div class="emp"><b>${esc(EMPRESA.nome)}</b>${empresaLinhas.map(l => `<br>${esc(l)}`).join('')}</div></div>
      <div class="corpo">
        <div class="linha-tit"><h1>ORÇAMENTO <span>Nº ${esc(o.numero)}</span></h1>
          <div class="datas">Emitido em <b>${data(o.emissao)}</b>${o.validade ? `<br>Válido até <b>${data(o.validade)}</b>` : ''}${o.vendedor ? `<br>Atendimento: <b>${esc(o.vendedor)}</b>` : ''}</div></div>
        <div class="caixa"><div class="rot">Cliente</div><b>${esc(o.cliente || '')}</b></div>
        <div style="overflow-x:auto"><table><thead><tr><th>Descrição</th><th class="n">Qtd.</th><th class="n col-unit">Unitário</th><th class="n">Total</th></tr></thead>
          <tbody>${(o.itens || []).map(i => `<tr><td><b>${esc(i.descricao || '')}</b></td><td class="n">${num(i.quantidade)}</td><td class="n col-unit">${unit(i.valor_total, i.quantidade)}</td><td class="n">${din(i.valor_total)}</td></tr>`).join('')}</tbody></table></div>
        <div class="tot">
          ${Number(o.desconto) || Number(o.frete) ? `<div><span>Subtotal</span><span>${din(o.valor_itens)}</span></div>` : ''}
          ${Number(o.desconto) ? `<div><span>${rotDesconto(o)}</span><span>- ${din(o.desconto)}</span></div>` : ''}
          ${Number(o.frete) ? `<div><span>Frete</span><span>${din(o.frete)}</span></div>` : ''}
          <div class="final"><span>Total</span><span>${din(o.valor_total)}</span></div>
          ${o.desconto_pix && o.valor_pix != null ? `<div style="color:#00795f;font-weight:700;margin-top:4px"><span>À vista no Pix (${PIX_PCT}% off)</span><span>${din(o.valor_pix)}</span></div>` : ''}</div>
        ${freteGratis(o) ? `<div style="text-align:right">${SELO_FRETE}</div>` : ''}
        ${blocosProposta(o)}
        ${o.condicoes_pagamento ? `<div class="bloco"><div class="rot">Forma de pagamento</div><p>${esc(o.condicoes_pagamento)}</p></div>` : ''}
        ${o.observacoes ? `<div class="bloco"><div class="rot">Observações</div><p>${esc(o.observacoes)}</p></div>` : ''}
        ${EMPRESA.condicoes_gerais ? `<div class="bloco"><div class="rot">Condições gerais</div><p>${esc(EMPRESA.condicoes_gerais)}</p></div>` : ''}
        ${rodapeAprov}
        <div class="acoes"><button class="bt sec" onclick="window.print()">Imprimir / salvar PDF</button></div>
      </div></div>
      <div class="rod">${esc(EMPRESA.nome)}${EMPRESA.site ? ' · ' + esc(EMPRESA.site) : ''}</div>`;
    const caixaCad = $('#pub-cad', raiz);
    if (caixaCad) formularioCadastro(caixaCad, { textoBotao: 'Cadastrar e aprovar orçamento',
      extraHtml: `<label>Comentário (opcional)<textarea name="comentario" maxlength="1000" placeholder="Algum ajuste ou recado para a equipe?"></textarea></label>`,
      aoEnviar: async dados => { const r = await api('orc_publico_aprovar', { chave, cadastro: dados, comentario: dados.comentario || '' }, true);
        desenhar(r.orcamento); window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }); } });
    const b = $('#pub-aprovar', raiz);
    if (b) b.onclick = async () => {
      const nome = $('#pub-nome', raiz).value.trim();
      if (nome.length < 3) { $('#pub-erro', raiz).textContent = 'Informe o seu nome para aprovar.'; $('#pub-nome', raiz).focus(); return; }
      b.disabled = true; b.textContent = 'Enviando…';
      try { const r = await api('orc_publico_aprovar', { chave, nome, comentario: $('#pub-com', raiz).value }, true); desenhar(r.orcamento); window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }); }
      catch (e) { b.disabled = false; b.textContent = 'Aprovar orçamento'; $('#pub-erro', raiz).textContent = e.message === 'Failed to fetch' ? 'Sem conexão. Tente de novo.' : e.message; }
    };
  };
  try { const r = await api('orc_publico', { chave }, true); desenhar(r.orcamento); }
  catch (e) { raiz.innerHTML = `<div class="folha"><div class="corpo"><h1 style="font-size:20px">Não foi possível abrir o orçamento</h1><p>${esc(e.message === 'Failed to fetch' ? 'Sem conexão com o servidor. Tente de novo em instantes.' : e.message)}</p></div></div>`; }
}

/* ---------- AR3d: PÁGINA PÚBLICA DE APROVAÇÃO DAS PROVAS (um link por pedido) ---------- */
const CONDICOES_PROVA = [
  'Confira com atenção: tamanho, layout, textos e todas as informações antes de aprovar.',
  'Após a aprovação da arte, não nos responsabilizamos por tamanhos ou informações incorretas, erros de grafia ou qualquer detalhe que não tenha sido pedido como alteração antes da aprovação.',
  'Os tons das cores podem variar até 5% (mais claro ou mais escuro) na impressão final.',
  'Os textos foram redigitados pela nossa equipe para garantir a qualidade na impressão — confira de novo com atenção.',
  'Não refazemos nem aceitamos devolução de materiais aprovados com erro.'
];
async function paginaPublicaProva(chave) {
  document.title = 'Prova para aprovação · Gráfica Venda Hoje';
  const logo = $('#logo-gvh', document)?.src || '';
  const raiz = document.createElement('div'); raiz.id = 'pub'; document.body.appendChild(raiz);
  aplicarEstiloPublico();
  if (!document.getElementById('estilo-prova')) {
    const st = document.createElement('style'); st.id = 'estilo-prova';
    st.textContent = `
      #pub .item { border: 1px solid #e2e6e8; border-radius: 12px; margin-top: 16px; overflow: hidden; }
      #pub .item-cab { padding: 12px 16px; background: #f6f6f6; display: flex; justify-content: space-between; gap: 10px; flex-wrap: wrap; align-items: center; }
      #pub .arte { padding: 14px 16px; border-top: 1px solid #eef1f2; }
      #pub .selo { display: inline-block; border-radius: 20px; padding: 4px 12px; font-size: 12.5px; font-weight: 600; }
      #pub .selo.aguardando { background: #fdf3e1; color: #9a6410; } #pub .selo.aprovada { background: #e3f6f1; color: #00795f; }
      #pub .selo.alteracao { background: #fde8e6; color: #c0453b; } #pub .selo.indisponivel { background: #eef1f2; color: #5a6770; }
      #pub .imgs { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 12px; margin-top: 10px; }
      #pub .imgs figure { margin: 0; } #pub .imgs figcaption { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #8a959c; margin-bottom: 4px; }
      #pub .imgs img { width: 100%; height: auto; display: block; border-radius: 8px; box-shadow: 0 2px 12px rgba(29,38,45,.12); background: #fff; }
      #pub .carregando { height: 160px; border-radius: 8px; background: linear-gradient(90deg,#eef1f2,#f7f8f9,#eef1f2); background-size: 200% 100%; animation: pubcar 1.2s infinite; display: flex; align-items: center; justify-content: center; color: #8a959c; font-size: 12px; }
      @keyframes pubcar { to { background-position: -200% 0; } }
      #pub .cond { font-size: 13px; color: #5a6770; margin: 12px 0 0; padding-left: 18px; } #pub .cond li { margin-bottom: 4px; }
      #pub .chk { display: flex; gap: 8px; align-items: flex-start; font-size: 14px; font-weight: 600; margin-top: 12px; cursor: pointer; }
      #pub .chk input { width: 18px; height: 18px; margin-top: 2px; accent-color: #00a986; }
      #pub .bt.alt { background: #fff; color: #c0453b; border: 1px solid #e8b4ae; }
      #pub details.vista3d > summary { cursor: pointer; color: #00795f; font-size: 13.5px; font-weight: 600; margin-top: 10px; }
      #pub .brilho-wrap { position: relative; }
      #pub .brilho { position: absolute; inset: 0; pointer-events: none; border-radius: 8px;
        background: linear-gradient(115deg, rgba(255,255,255,0) 35%, rgba(255,255,255,.95) 48%, rgba(255,255,255,.35) 53%, rgba(255,255,255,0) 62%);
        background-size: 300% 100%; animation: pubbrilho 2.6s ease-in-out infinite;
        -webkit-mask-size: 100% 100%; mask-size: 100% 100%; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; }
      @keyframes pubbrilho { from { background-position: 120% 0; } to { background-position: -20% 0; } }
      @media (prefers-reduced-motion: reduce) { #pub .brilho { animation: none; background: rgba(255,255,255,.45); } }
      #pub .leg-brilho { font-size: 12px; color: #5a6770; margin-top: 4px; }
      #pub .palco3d { width: 100%; height: 340px; border-radius: 10px; overflow: hidden; background: #1d262d; margin-top: 8px; touch-action: none; }`;
    document.head.appendChild(st);
  }
  const imagens = {}; // prova_id+lado → data URI
  const SIT = { aguardando: 'Aguardando a sua aprovação', aprovada: 'Aprovada', alteracao: 'Alteração pedida', indisponivel: 'Em revisão pela gráfica' };
  const tam = x => x.largura_mm && x.altura_mm ? `${String(Math.round(x.largura_mm) / 10).replace('.', ',')} × ${String(Math.round(x.altura_mm) / 10).replace('.', ',')} cm` : '';
  const desenhar = (p, aviso) => {
    const pend = [], resto = [];
    (p.itens || []).forEach(i => (i.artes.some(x => x.situacao === 'aguardando') ? pend : resto).push(i));
    const nPend = pend.reduce((n, i) => n + i.artes.filter(x => x.situacao === 'aguardando').length, 0);
    const arteHtml = (i, x) => `<div class="arte" data-prova="${x.prova_id}">
        <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:center">
          <div>${x.total > 1 ? `<b>Arte ${x.numero} de ${x.total}</b> · ` : ''}<span class="selo ${esc(x.situacao)}">${esc(SIT[x.situacao] || x.situacao)}</span></div>
          <div style="font-size:12px;color:#8a959c">Versão ${x.versao}${tam(x) ? ' · tamanho final ' + tam(x) : ''}</div></div>
        ${(() => { const imgs = x.formato === 'pdf'
             ? `<div class="imgs" data-pdf="${x.prova_id}" data-verso="${x.tem_verso ? 1 : 0}" data-papeis="${esc(JSON.stringify(x.papeis || null))}"><div class="carregando">carregando a prova…</div></div>`
             : `<div class="imgs">${['frente'].concat(x.tem_verso ? ['verso'] : []).map(l => `<figure><figcaption>${x.tem_verso ? l : 'arte'}</figcaption><div class="carregando" data-img="${x.prova_id}|${l}">carregando a prova…</div></figure>`).join('')}</div>`;
           return x.situacao === 'aguardando' ? imgs : `<details class="vista3d"><summary>Ver a arte</summary>${imgs}</details>`; })()}
        ${x.modo === '3d' && x.tem_verso && x.situacao === 'aguardando' ? `<details class="vista3d" data-3d="${x.prova_id}"><summary>Ver em 3D (girar frente e verso)</summary><div class="palco3d"></div></details>` : ''}
        ${x.situacao === 'aprovada' ? `<div class="ok" style="margin-top:12px"><b>Aprovada ✓</b> por ${esc(x.decidido_nome || '')}${x.decidido_em ? ' em ' + dataHoraLonga(x.decidido_em) : ''}.</div>` : ''}
        ${x.situacao === 'alteracao' ? `<div class="aviso" style="margin-top:12px"><b>Alteração pedida</b> por ${esc(x.decidido_nome || '')}${x.decidido_em ? ' em ' + dataHoraLonga(x.decidido_em) : ''}: ${esc(x.texto_alteracao || '')}<br><span style="font-size:12.5px;color:#5a6770">A nova versão aparece aqui neste mesmo link.</span></div>` : ''}
        ${x.situacao === 'aguardando' ? `<div class="aprovar">
            <h2>Confira antes de aprovar</h2>
            <ul class="cond">${CONDICOES_PROVA.map(c => `<li>${esc(c)}</li>`).join('')}</ul>
            <label class="chk"><input type="checkbox" data-aceite> Li e estou de acordo com as condições acima</label>
            <label>Seu nome *<input type="text" data-nome maxlength="120" autocomplete="name"></label>
            <div class="erro" data-erro></div>
            <div class="acoes"><button class="bt prim" data-aprovar>Aprovar esta arte</button><button class="bt alt" data-abrir-alt>Pedir alteração</button></div>
            <div data-caixa-alt style="display:none"><label>O que precisa mudar? *<textarea data-texto maxlength="2000" placeholder="Ex.: trocar o telefone, aumentar o logo…"></textarea></label>
              <div class="acoes"><button class="bt sec" data-enviar-alt>Enviar pedido de alteração</button></div></div>
          </div>` : ''}
      </div>`;
    const itemHtml = i => `<div class="item"><div class="item-cab"><b>${esc(i.descricao)}</b><span style="font-size:12.5px;color:#5a6770">${num(i.quantidade)} un</span></div>
        ${i.artes.map(x => arteHtml(i, x)).join('')}</div>`;
    raiz.innerHTML = `<div class="folha">
      <div class="cab">${logo ? `<img src="${logo}" alt="Gráfica Venda Hoje">` : `<b>${esc(EMPRESA.nome)}</b>`}
        <div class="emp"><b>${esc(EMPRESA.nome)}</b><br>${esc(EMPRESA.telefone)}<br>${esc(EMPRESA.site)}</div></div>
      <div class="corpo">
        <div class="linha-tit"><h1>PROVA <span>· Pedido Nº ${esc(p.numero)}</span></h1>
          <div class="datas">${p.cliente ? `Cliente: <b>${esc(p.cliente)}</b>` : ''}${p.vendedor ? `<br>Atendimento: <b>${esc(p.vendedor)}</b>` : ''}</div></div>
        ${aviso ? `<div class="ok" style="margin-top:0">${aviso}</div>` : ''}
        ${nPend ? `<div class="caixa"><b>${nPend === 1 ? '1 arte aguardando' : nPend + ' artes aguardando'} a sua aprovação.</b> Confira cada uma com calma e aprove (ou peça alteração) logo abaixo da imagem.</div>`
          : `<div class="caixa">Nenhuma arte aguardando aprovação agora. Quando a gráfica enviar uma nova prova, ela aparece neste mesmo link.</div>`}
        ${pend.map(itemHtml).join('')}
        ${resto.length ? `<h2 style="font-size:15px;margin:26px 0 0">${pend.length ? 'Outros itens do pedido' : 'Itens do pedido'}</h2>${resto.map(itemHtml).join('')}` : ''}
        <p style="font-size:12px;color:#8a959c;margin-top:22px">As imagens são uma prova digital com marca d'água: servem só para conferência e não podem ser usadas para impressão.</p>
      </div></div>
      <div class="rod">${esc(EMPRESA.nome)}${EMPRESA.site ? ' · ' + esc(EMPRESA.site) : ''}</div>`;
    // imagens (uma por vez, pelo sistema — o Drive da gráfica não fica público)
    (async () => {
      for (const box of raiz.querySelectorAll('[data-img]')) {
        const [pid, lado] = box.dataset.img.split('|');
        try {
          if (!imagens[box.dataset.img]) imagens[box.dataset.img] = (await api('prova_publica_imagem', { chave, prova_id: pid, lado }, true)).imagem;
          if (!box.isConnected) continue;
          const img = document.createElement('img'); img.alt = 'Prova ' + lado; img.src = imagens[box.dataset.img];
          box.replaceWith(img);
        } catch (e) { if (box.isConnected) box.textContent = 'Não foi possível carregar a imagem. Atualize a página.'; }
      }
      for (const box of raiz.querySelectorAll('[data-pdf]')) {
        try {
          const pags = await paginasProvaPdf(chave, box.dataset.pdf, imagens);
          if (!box.isConnected) continue;
          const verso = box.dataset.verso === '1';
          let papeis = null; try { papeis = JSON.parse(box.dataset.papeis || 'null'); } catch (e) {}
          if (Array.isArray(papeis) && papeis.length === pags.length) {
            // prova com papéis (15/10): as máscaras de verniz não aparecem como página; viram brilho animado sobre a frente/verso
            const vis = papeis.map((r, i) => [r, i]).filter(([r]) => !String(r).startsWith('verniz'));
            box.innerHTML = vis.map(([r, i]) => {
              const cap = vis.length === 1 ? 'arte' : r === 'frente' ? (verso ? 'frente' : 'arte') : r === 'verso' ? 'verso' : 'página ' + (i + 1);
              const m = r === 'frente' ? papeis.indexOf('verniz_frente') : r === 'verso' ? papeis.indexOf('verniz_verso') : -1;
              return `<figure><figcaption>${cap}</figcaption><div class="brilho-wrap"><img alt="Prova ${cap}" src="${pags[i]}">${m >= 0 ? `<div class="brilho" data-mask="${m}"></div>` : ''}</div>
                ${m >= 0 ? '<div class="leg-brilho">✦ O brilho mostra onde vai o verniz localizado.</div>' : ''}</figure>`;
            }).join('');
            for (const b of box.querySelectorAll('[data-mask]')) {
              const url = await mascaraAlfa(pags[+b.dataset.mask], imagens);
              b.style.webkitMaskImage = b.style.maskImage = `url(${url})`;
            }
          } else
          box.innerHTML = pags.map((src, i) => `<figure><figcaption>${pags.length === 1 ? 'arte' : i === 0 ? (verso ? 'frente' : 'página 1') : (i === 1 && verso ? 'verso' : 'página ' + (i + 1))}</figcaption><img alt="Prova página ${i + 1}" src="${src}"></figure>`).join('');
        } catch (e) { if (box.isConnected) box.innerHTML = '<div class="carregando">Não foi possível abrir a prova. Atualize a página.</div>'; }
      }
    })();
    raiz.querySelectorAll('[data-3d]').forEach(det => det.addEventListener('toggle', () => { if (det.open && !det.dataset.ok) { det.dataset.ok = 1; vista3dProva(det.querySelector('.palco3d'), chave, det.dataset['3d'], imagens); } }));
    raiz.querySelectorAll('.arte[data-prova]').forEach(bx => {
      const pid = bx.dataset.prova, err = bx.querySelector('[data-erro]');
      const nome = () => (bx.querySelector('[data-nome]') || {}).value?.trim() || '';
      const falha = e => { if (err) err.textContent = e.message === 'Failed to fetch' ? 'Sem conexão. Tente de novo.' : e.message; };
      const ap = bx.querySelector('[data-aprovar]');
      if (ap) ap.onclick = async () => {
        if (!bx.querySelector('[data-aceite]').checked) return falha(new Error('Marque que leu e concorda com as condições.'));
        if (nome().length < 3) { bx.querySelector('[data-nome]').focus(); return falha(new Error('Informe o seu nome para aprovar.')); }
        ap.disabled = true; ap.textContent = 'Enviando…';
        try { const r = await api('prova_publica_aprovar', { chave, prova_id: pid, nome: nome(), aceite: true }, true); desenhar(r.pedido, '<b>Arte aprovada ✓</b> Obrigado! A gráfica já recebeu a sua aprovação.'); window.scrollTo({ top: 0, behavior: 'smooth' }); }
        catch (e) { ap.disabled = false; ap.textContent = 'Aprovar esta arte'; falha(e); }
      };
      const ab = bx.querySelector('[data-abrir-alt]');
      if (ab) ab.onclick = () => { const c = bx.querySelector('[data-caixa-alt]'); c.style.display = c.style.display === 'none' ? '' : 'none'; if (c.style.display === '') c.querySelector('textarea').focus(); };
      const ea = bx.querySelector('[data-enviar-alt]');
      if (ea) ea.onclick = async () => {
        const texto = bx.querySelector('[data-texto]').value.trim();
        if (!texto) return falha(new Error('Escreva o que precisa mudar.'));
        if (nome().length < 3) { bx.querySelector('[data-nome]').focus(); return falha(new Error('Informe o seu nome.')); }
        ea.disabled = true; ea.textContent = 'Enviando…';
        try { const r = await api('prova_publica_alterar', { chave, prova_id: pid, nome: nome(), texto }, true); desenhar(r.pedido, '<b>Pedido de alteração enviado.</b> A gráfica vai ajustar e a nova versão aparece neste mesmo link.'); window.scrollTo({ top: 0, behavior: 'smooth' }); }
        catch (e) { ea.disabled = false; ea.textContent = 'Enviar pedido de alteração'; falha(e); }
      };
    });
  };
  try { const r = await api('prova_publica', { chave }, true); desenhar(r.pedido); }
  catch (e) { raiz.innerHTML = `<div class="folha"><div class="corpo"><h1 style="font-size:20px">Não foi possível abrir a prova</h1><p>${esc(e.message === 'Failed to fetch' ? 'Sem conexão com o servidor. Tente de novo em instantes.' : e.message)}</p></div></div>`; }
}
// Cartão em 3D (frente e verso), igual ao Visualizador antigo
// Prova em PDF: lê o arquivo pelo sistema e desenha cada página como imagem (o Drive continua privado)
let carregandoPdfPub = null;
function carregarPdfJsPub() {
  if (window.pdfjsLib) return Promise.resolve();
  return carregandoPdfPub || (carregandoPdfPub = new Promise((ok, falha) => {
    const sc = document.createElement('script'); sc.src = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js';
    sc.onload = () => { window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js'; ok(); };
    sc.onerror = () => { carregandoPdfPub = null; falha(new Error('Não foi possível abrir o leitor de PDF.')); };
    document.head.appendChild(sc);
  }));
}
async function mascaraAlfa(src, cache) {
  const k = 'alfa|' + src.length + '|' + src.slice(-40);
  if (cache[k]) return cache[k];
  const img = await new Promise((ok, falha) => { const i = new Image(); i.onload = () => ok(i); i.onerror = falha; i.src = src; });
  const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
  const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0);
  const d = ctx.getImageData(0, 0, c.width, c.height), px = d.data;
  for (let i = 0; i < px.length; i += 4) {
    const lum = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
    px[i] = px[i + 1] = px[i + 2] = 255; px[i + 3] = lum < 128 ? 255 : 0;
  }
  ctx.putImageData(d, 0, 0);
  return (cache[k] = c.toDataURL('image/png'));
}
async function paginasProvaPdf(chave, pid, cache) {
  if (cache[pid + '|pdf']) return cache[pid + '|pdf'];
  const uri = (await api('prova_publica_imagem', { chave, prova_id: pid, lado: 'frente' }, true)).imagem;
  await carregarPdfJsPub();
  const bin = atob(uri.slice(uri.indexOf(',') + 1)), dados = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) dados[i] = bin.charCodeAt(i);
  const doc = await window.pdfjsLib.getDocument({ data: dados }).promise, pags = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const pg = await doc.getPage(n), v0 = pg.getViewport({ scale: 1 });
    const vp = pg.getViewport({ scale: 1600 / Math.max(v0.width, v0.height) });
    const c = document.createElement('canvas'); c.width = Math.round(vp.width); c.height = Math.round(vp.height);
    await pg.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
    pags.push(c.toDataURL('image/jpeg', 0.9));
  }
  return (cache[pid + '|pdf'] = pags);
}
async function vista3dProva(palco, chave, pid, imagens) {
  palco.innerHTML = '<div class="carregando" style="height:100%">carregando o 3D…</div>';
  try {
    if (!window.THREE) await new Promise((ok, falha) => { const s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.min.js'; s.onload = ok; s.onerror = falha; document.head.appendChild(s); });
    const pega = async lado => imagens[pid + '|' + lado] || (imagens[pid + '|' + lado] = (await api('prova_publica_imagem', { chave, prova_id: pid, lado }, true)).imagem);
    let srcF, srcV;
    let srcVF = null, srcVV = null;
    const boxPdf = palco.closest('.arte') && palco.closest('.arte').querySelector('[data-pdf]');
    if (boxPdf) {
      const pg = await paginasProvaPdf(chave, pid, imagens);
      let pp = null; try { pp = JSON.parse(boxPdf.dataset.papeis || 'null'); } catch (e) {}
      if (Array.isArray(pp) && pp.length === pg.length) {
        const ix = r => pp.indexOf(r);
        srcF = pg[Math.max(0, ix('frente'))]; srcV = ix('verso') >= 0 ? pg[ix('verso')] : srcF;
        if (ix('verniz_frente') >= 0) srcVF = pg[ix('verniz_frente')];
        if (ix('verniz_verso') >= 0) srcVV = pg[ix('verniz_verso')];
      } else { srcF = pg[0]; srcV = pg[1] || pg[0]; }
    }
    else [srcF, srcV] = await Promise.all([pega('frente'), pega('verso')]);
    palco.innerHTML = '';
    const T = window.THREE, W = palco.clientWidth, H = palco.clientHeight;
    const cena = new T.Scene(); cena.background = new T.Color(0x1d262d);
    const cam = new T.PerspectiveCamera(35, W / H, 0.1, 100); cam.position.set(0, 0, 4.2);
    const rend = new T.WebGLRenderer({ antialias: true }); rend.setPixelRatio(Math.min(window.devicePixelRatio, 2)); rend.setSize(W, H); palco.appendChild(rend.domElement);
    cena.add(new T.AmbientLight(0xffffff, 0.75));
    const l1 = new T.DirectionalLight(0xffffff, 0.6); l1.position.set(2, 3, 4); cena.add(l1);
    const l2 = new T.DirectionalLight(0xffffff, 0.3); l2.position.set(-3, -2, -3); cena.add(l2);
    const tex = src => new Promise(ok => new T.TextureLoader().load(src, ok, undefined, () => ok(null)));
    const [tf, tv, rf, rv] = await Promise.all([tex(srcF), tex(srcV), srcVF ? tex(srcVF) : null, srcVV ? tex(srcVV) : null]);
    const asp = tf && tf.image ? tf.image.width / tf.image.height : 1.8;
    const larg = asp >= 1 ? 2.2 : 2.2 * asp, alt = larg / asp;
    const borda = new T.MeshStandardMaterial({ color: 0xe7edef, roughness: 0.6 });
    // verniz: a máscara (preto = verniz) vira mapa de aspereza — o preto fica liso e reflete a luz quando o cartão gira
    const mF = new T.MeshStandardMaterial(rf ? { map: tf, roughness: 0.85, roughnessMap: rf } : { map: tf, roughness: 0.35 }),
          mV = new T.MeshStandardMaterial(rv ? { map: tv || tf, roughness: 0.85, roughnessMap: rv } : { map: tv || tf, roughness: 0.35 });
    if (rf || rv) { const luz = new T.PointLight(0xffffff, 0.5, 12); luz.position.set(1.2, 1.5, 3); cena.add(luz); }
    const peca = new T.Mesh(new T.BoxGeometry(larg, alt, 0.035), [borda, borda, borda, borda, mF, mV]); cena.add(peca);
    let ry = -0.35, rx = 0.12, arr = false, auto = true, ux = 0, uy = 0;
    rend.domElement.addEventListener('pointerdown', e => { arr = true; auto = false; ux = e.clientX; uy = e.clientY; });
    window.addEventListener('pointermove', e => { if (!arr) return; ry += (e.clientX - ux) * 0.008; rx = Math.max(-1.1, Math.min(1.1, rx + (e.clientY - uy) * 0.008)); ux = e.clientX; uy = e.clientY; });
    window.addEventListener('pointerup', () => { arr = false; });
    (function anima() { if (!palco.isConnected) return; requestAnimationFrame(anima); if (auto) ry += 0.0035;
      peca.rotation.y += (ry - peca.rotation.y) * 0.15; peca.rotation.x += (rx - peca.rotation.x) * 0.15; rend.render(cena, cam); })();
  } catch (e) { palco.innerHTML = '<div class="carregando" style="height:100%">Não foi possível abrir o 3D neste aparelho. As imagens acima mostram a frente e o verso.</div>'; }
}

/* validação de CPF / CNPJ (inclusive CNPJ alfanumérico) no navegador — o banco valida de novo */
function docValido(v) {
  const d = String(v || '').toUpperCase().replace(/[^0-9A-Z]/g, '');
  const dv = (base, pesos) => { const s = base.split('').reduce((t, ch, k) => t + (ch.charCodeAt(0) - 48) * pesos[k], 0); const r = s % 11; return r < 2 ? 0 : 11 - r; };
  if (/^\d{11}$/.test(d)) {
    if (/^(\d)\1{10}$/.test(d)) return null;
    const c = (n) => { let s = 0; for (let k = 0; k < n; k++) s += Number(d[k]) * (n + 1 - k); const r = (s * 10) % 11; return r === 10 ? 0 : r; };
    return c(9) === Number(d[9]) && c(10) === Number(d[10]) ? 'PF' : null;
  }
  if (/^[0-9A-Z]{12}\d{2}$/.test(d)) {
    if (/^(\d)\1{13}$/.test(d)) return null;
    const p1 = [5,4,3,2,9,8,7,6,5,4,3,2], p2 = [6,5,4,3,2,9,8,7,6,5,4,3,2];
    return dv(d.slice(0, 12), p1) === Number(d[12]) && dv(d.slice(0, 13), p2) === Number(d[13]) ? 'PJ' : null;
  }
  return null;
}
const linkCadastroPublico = () => location.origin + location.pathname + '#/cadastro';
function modalLinkCadastro() {
  const link = linkCadastroPublico();
  const texto = `Olá! Para agilizar seus pedidos na Gráfica Venda Hoje, faça seu cadastro por este link (leva 2 minutos): ${link}`;
  const m = abrirModal({ titulo: 'Link de cadastro para o cliente', corpo: `
    <p style="margin:0 0 10px">O cliente preenche os próprios dados, sem login. O cadastro só entra no sistema depois que alguém da GVH conferir e aprovar (aviso no Início e aqui em Clientes).</p>
    <div style="display:flex;gap:6px"><input type="text" readonly value="${esc(link)}" id="lc-url" style="flex:1"><button class="btn" id="lc-copiar">Copiar</button></div>`,
    rodape: `<button class="btn" data-v>Fechar</button><a class="btn prim" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(texto)}">Enviar pelo WhatsApp</a>` });
  m.el.querySelector('[data-v]').onclick = m.fechar;
  m.el.querySelector('#lc-copiar').onclick = async () => { try { await navigator.clipboard.writeText(link); toast('Link copiado.'); } catch { $('#lc-url', m.el).select(); } };
}
function aplicarEstiloCadastro() {
  if (document.getElementById('estilo-cad')) return;
  const est = document.createElement('style'); est.id = 'estilo-cad';
  est.textContent = `
    #pub .gr { display: grid; grid-template-columns: repeat(6, 1fr); gap: 4px 12px; }
    #pub .gr label { grid-column: span 6; display: block; font-size: 12.5px; color: #5a6770; margin-top: 10px; }
    #pub .gr .c2 { grid-column: span 2; } #pub .gr .c3 { grid-column: span 3; } #pub .gr .c4 { grid-column: span 4; } #pub .gr .c1 { grid-column: span 1; }
    #pub .gr input:not([type=checkbox]), #pub .gr textarea { width: 100%; box-sizing: border-box; font: inherit; font-size: 15px; padding: 10px 12px; border: 1px solid #cfd6da; border-radius: 8px; margin-top: 4px; background: #fff; }
    #pub .gr textarea { min-height: 70px; resize: vertical; }
    #pub .gr input:focus, #pub .gr textarea:focus { outline: 2px solid #00a986; border-color: #00a986; }
    #pub .sec { grid-column: span 6; margin: 22px 0 2px; font-size: 11px; text-transform: uppercase; letter-spacing: 1.3px; color: #00a986; font-weight: 700; border-bottom: 1px solid #e2e6e8; padding-bottom: 6px; }
    #pub .chk { display: flex !important; gap: 8px; align-items: flex-start; color: #1d262d !important; font-size: 13.5px !important; }
    #pub .chk input { margin-top: 3px; width: 18px; height: 18px; accent-color: #00a986; }
    #pub .dica { font-size: 12px; color: #8a959c; margin-top: 4px; min-height: 1em; } #pub .dica.err { color: #c0453b; }
    #pub .obr { color: #c0453b; }
    #pub .hp { position: absolute; left: -5000px; width: 1px; height: 1px; overflow: hidden; }
    @media (max-width: 560px) { #pub .gr .c2, #pub .gr .c3, #pub .gr .c4 { grid-column: span 6; } #pub .gr .c1 { grid-column: span 2; } }`;
  document.head.appendChild(est);
}
/* Formulário de cadastro do cliente (sem login). aoEnviar(dados) chama o banco; se der erro, a mensagem aparece no formulário. */
function formularioCadastro(alvo, { textoBotao = 'Enviar cadastro', extraHtml = '', aoEnviar }) {
  aplicarEstiloCadastro();
  const ob = '<span class="obr">*</span>';
  alvo.innerHTML = `<form class="gr" data-cad novalidate autocomplete="on">
        <div class="hp" aria-hidden="true"><label>Site<input type="text" name="site_url" tabindex="-1" autocomplete="off"></label></div>
        <div class="sec">Documento</div>
        <label class="c3">CPF ou CNPJ ${ob}<input type="text" name="cpf_cnpj" maxlength="18" inputmode="text" style="text-transform:uppercase" placeholder="Digite o CPF ou o CNPJ"><div class="dica" data-dica="doc">Pessoa física: CPF · Empresa: CNPJ</div></label>
        <div data-resto style="display:none;grid-column:span 6"><div class="gr">
          <div class="sec" data-sec-dados>Seus dados</div>
          <label class="c4"><span data-rot-nome>Nome completo</span> ${ob}<input type="text" name="nome" autocomplete="name"></label>
          <label class="c2" data-t="PF">Data de aniversário (dia/mês) ${ob}<input type="text" name="aniversario" maxlength="5" placeholder="DD/MM" inputmode="numeric"></label>
          <label class="c3" data-t="PJ">Nome fantasia<input type="text" name="nome_fantasia"></label>
          <label class="c3" data-t="PJ">Ramo de atividade ${ob}<input type="text" name="segmento" placeholder="Ex.: Restaurante, Clínica, Loja de roupas"></label>
          <label class="c3" data-t="PJ">Inscrição estadual<input type="text" name="inscricao_estadual"></label>
          <label class="c3" data-t="PJ">Nome completo do responsável ${ob}<input type="text" name="responsavel" autocomplete="name"></label>
          <div class="sec">Contato</div>
          <label class="c3">Telefone com DDD ${ob}<input type="tel" name="telefone" placeholder="(11) 99999-9999" autocomplete="tel"></label>
          <label class="c3 chk" style="align-self:end;padding-bottom:10px"><input type="checkbox" name="telefone_whatsapp" checked> Este número é WhatsApp</label>
          <label class="c3">E-mail ${ob}<input type="email" name="email" autocomplete="email"></label>
          <label class="c3">Instagram<input type="text" name="instagram" placeholder="@perfil"></label>
          <div class="sec">Endereço</div>
          <label class="c2">CEP ${ob}<input type="text" name="cep" maxlength="9" inputmode="numeric" autocomplete="postal-code"><div class="dica" data-dica="cep"></div></label>
          <label class="c4">Endereço (rua, avenida) ${ob}<input type="text" name="logradouro" autocomplete="address-line1"></label>
          <label class="c1">Número ${ob}<input type="text" name="numero"></label>
          <label class="c2">Complemento<input type="text" name="complemento" autocomplete="address-line2"></label>
          <label class="c3">Bairro ${ob}<input type="text" name="bairro"></label>
          <label class="c4">Cidade ${ob}<input type="text" name="cidade" autocomplete="address-level2"></label>
          <label class="c2">UF ${ob}<input type="text" name="uf" maxlength="2" style="text-transform:uppercase" autocomplete="address-level1"></label>
          ${extraHtml}
          <label class="chk" style="margin-top:22px"><input type="checkbox" name="lgpd"> <span>Autorizo a Gráfica Venda Hoje a usar estes dados para orçamentos, pedidos, entregas, emissão de nota fiscal e contato comercial, conforme a Lei Geral de Proteção de Dados (LGPD). ${ob}</span></label>
          <div class="erro" data-erro style="grid-column:span 6"></div>
          <div class="acoes" style="grid-column:span 6"><button type="submit" class="bt prim" data-enviar>${esc(textoBotao)}</button></div>
        </div></div>
      </form>`;
  const f = alvo.querySelector('[data-cad]'); const F = new Proxy({}, { get: (_, n) => f.elements.namedItem(n) }); let tipo = null;
  const dica = (k, t, err) => { const e = alvo.querySelector(`[data-dica="${k}"]`); e.textContent = t; e.classList.toggle('err', !!err); };
  const auto = {}; let cnpjBuscado = null;
  const preencher = (n, v) => { if (v && F[n] && (!F[n].value.trim() || F[n].value === auto[n])) { F[n].value = v; auto[n] = v; } };
  const limparAuto = () => { Object.entries(auto).forEach(([n, v]) => { if (F[n] && F[n].value === v) F[n].value = ''; delete auto[n]; }); cnpjBuscado = null; };
  const mostrarTipo = () => {
    alvo.querySelector('[data-resto]').style.display = tipo ? '' : 'none';
    alvo.querySelectorAll('[data-t]').forEach(e => e.style.display = e.dataset.t === tipo ? '' : 'none');
    alvo.querySelector('[data-rot-nome]').textContent = tipo === 'PJ' ? 'Razão social' : 'Nome completo';
    alvo.querySelector('[data-sec-dados]').textContent = tipo === 'PJ' ? 'Dados da empresa' : 'Seus dados';
  };
  F.cpf_cnpj.oninput = async () => {
    const d = F.cpf_cnpj.value.toUpperCase().replace(/[^0-9A-Z]/g, '');
    if (cnpjBuscado && d !== cnpjBuscado) limparAuto();
    if (d.length !== 11 && d.length !== 14) { tipo = null; mostrarTipo(); dica('doc', 'Pessoa física: CPF · Empresa: CNPJ'); return; }
    const t = docValido(d);
    if (!t) { tipo = null; mostrarTipo(); dica('doc', 'CPF/CNPJ inválido. Confira o que foi digitado.', true); return; }
    F.cpf_cnpj.value = fmtDoc(d); const novo = t !== tipo; tipo = t; mostrarTipo();
    dica('doc', tipo === 'PJ' ? 'Empresa (CNPJ)' : 'Pessoa física (CPF)');
    if (novo) F.nome.focus();
    if (tipo === 'PJ' && /^\d{14}$/.test(d)) {
      cnpjBuscado = d;
      try { const r = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${d}`); if (r.ok && cnpjBuscado === d) { const j = await r.json(); if (cnpjBuscado !== d) return;
        preencher('nome', j.razao_social); preencher('nome_fantasia', j.nome_fantasia); preencher('cep', j.cep);
        preencher('logradouro', [j.descricao_tipo_de_logradouro, j.logradouro].filter(Boolean).join(' ')); preencher('numero', j.numero);
        preencher('complemento', j.complemento); preencher('bairro', j.bairro); preencher('cidade', j.municipio); preencher('uf', j.uf);
        dica('doc', 'Empresa (CNPJ) · dados da Receita preenchidos, confira abaixo'); } } catch {}
    }
  };
  F.cep.onblur = async () => {
    const cep = F.cep.value.replace(/\D/g, ''); if (cep.length !== 8) { if (cep) dica('cep', 'CEP com 8 números', true); return; }
    F.cep.value = cep.replace(/^(\d{5})(\d{3})$/, '$1-$2'); dica('cep', '');
    try { const r = await fetch(`https://brasilapi.com.br/api/cep/v2/${cep}`); if (!r.ok) return dica('cep', 'CEP não encontrado, preencha o endereço', true); const j = await r.json();
      preencher('logradouro', j.street); preencher('bairro', j.neighborhood); preencher('cidade', j.city); preencher('uf', j.state);
      if (!F.numero.value) F.numero.focus(); } catch {}
  };
  F.aniversario.oninput = () => { let v = F.aniversario.value.replace(/\D/g, '').slice(0, 4); if (v.length > 2) v = v.slice(0, 2) + '/' + v.slice(2); F.aniversario.value = v; };
  F.telefone.onblur = () => { const d = F.telefone.value.replace(/\D/g, ''); if (d.length === 10 || d.length === 11) F.telefone.value = fmtTel('55' + d); };
  f.onsubmit = async e => {
    e.preventDefault();
    const dados = formDados(f); dados.telefone_whatsapp = F.telefone_whatsapp.checked; dados.lgpd = F.lgpd.checked;
    const err = msg => { alvo.querySelector('[data-erro]').textContent = msg; return false; };
    const falta = [['nome', tipo === 'PJ' ? 'a razão social' : 'o nome completo'], ...(tipo === 'PJ' ? [['segmento', 'o ramo de atividade'], ['responsavel', 'o nome do responsável']] : [['aniversario', 'a data de aniversário']]),
      ['telefone', 'o telefone'], ['email', 'o e-mail'], ['cep', 'o CEP'], ['logradouro', 'o endereço'], ['numero', 'o número'], ['bairro', 'o bairro'], ['cidade', 'a cidade'], ['uf', 'a UF']]
      .find(([n]) => !String(dados[n] || '').trim());
    if (falta) { F[falta[0]].focus(); return err(`Informe ${falta[1]}.`); }
    if (!dados.lgpd) return err('Marque a autorização de uso dos dados (LGPD) para enviar.');
    const b = alvo.querySelector('[data-enviar]'); b.disabled = true; b.textContent = 'Enviando…'; err('');
    try { await aoEnviar(dados); }
    catch (ex) { b.disabled = false; b.textContent = textoBotao; err(ex.message === 'Failed to fetch' ? 'Sem conexão. Tente de novo.' : ex.message); }
  };
  return { focar: () => F.cpf_cnpj.focus() };
}
async function paginaPublicaCadastro() {
  document.title = 'Cadastro · Gráfica Venda Hoje';
  aplicarEstiloPublico();
  const logo = $('#logo-gvh', document)?.src || '';
  const raiz = document.createElement('div'); raiz.id = 'pub'; document.body.appendChild(raiz);
  raiz.innerHTML = `<div class="folha">
    <div class="cab">${logo ? `<img src="${logo}" alt="Gráfica Venda Hoje">` : `<b>${esc(EMPRESA.nome)}</b>`}
      <div class="emp"><b>${esc(EMPRESA.nome)}</b><br>${esc(EMPRESA.telefone)} · ${esc(EMPRESA.email)}</div></div>
    <div class="corpo" id="cad-corpo">
      <h1 style="font-size:24px">Cadastro de cliente</h1>
      <p style="color:#5a6770;margin:6px 0 0;font-size:14px">Preencha seus dados para agilizar orçamentos, pedidos, entregas e notas fiscais. Campos com <span class="obr">*</span> são obrigatórios.</p>
      <div id="cad-alvo"></div>
    </div></div>
    <div class="rod">${esc(EMPRESA.nome)}${EMPRESA.site ? ' · ' + esc(EMPRESA.site) : ''}</div>`;
  const fc = formularioCadastro($('#cad-alvo', raiz), { textoBotao: 'Enviar cadastro', aoEnviar: async dados => {
    await api('cadastro_publico', dados, true);
    $('#cad-corpo', raiz).innerHTML = `<div class="ok" style="margin-top:0"><b>Cadastro enviado ✓</b>
      <div style="margin-top:6px">Obrigado! A equipe da Gráfica Venda Hoje vai conferir os seus dados. Se precisar alterar alguma informação, é só preencher de novo ou falar com o seu atendente pelo ${esc(EMPRESA.telefone)}.</div></div>`;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } });
  setTimeout(() => fc.focar(), 50);
}

