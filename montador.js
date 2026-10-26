/* =====================================================================
   MONTADOR DE PROVAS (AR3c) — Gráfica Venda Hoje
   Carregado só quando alguém clica em "Montar prova" (index.html → montarProva).
   Tudo roda no navegador: lê o PDF/imagem da arte, confere com o gabarito do item,
   mostra as linhas de corte e segurança (só para a equipe) e gera a PROVA do cliente:
   um PDF só (frente, verso, faca… em páginas), sem sangria, com marca d'água "PROVA — não use para impressão"
   e o logo da GVH. A prova sobe para o Drive do pedido (tipo "prova") e fica registrada na arte (versão).
   (14/10) A designer escolhe se está mandando só a prova ou já a ARTE PRONTA PARA IMPRESSÃO: nesse caso o
   arquivo original sobe junto (tipo "producao") e, quando o cliente aprovar, a arte já fica pronta.
   (15/10) Páginas com papel: Faca (a linha de corte aparece sobre a frente e, espelhada, sobre o verso) e
   Verniz da frente/verso (a área do verniz aparece com brilho). As máscaras de verniz vão no fim do PDF da prova
   e os papéis de cada página ficam gravados na prova, para a página do cliente animar o brilho e o 3D refletir.
   (16/10) Linhas de dobra (gabaritos.dobras): tracejado azul na conferência e na prova do cliente, frente e verso
   com as posições de cada lado. Gabaritos com aceita_girar (folheto sem dobra) aceitam a arte deitada ou em pé;
   frente e verso em sentidos diferentes geram aviso de "pé com pé".
   (19/10) Papéis "Máscara de branco da frente/verso" (adesivos 5 cores, resinado, transparente): ficam fora da prova.
   (19/10) Gabarito "cabe na área" (regras.modo = area: impressão digital A4/SRA3 — o arquivo precisa caber na área útil,
   em pé ou deitado); avisos de tamanho máximo e resolução recomendada no tamanho livre (lona, faixa e banner);
   item com selo Digital: na arte pronta para impressão, a designer anexa a FOLHA MONTADA (A4 22×32 ou SRA3 32×45),
   que vai como arquivo de impressão; a prova do cliente continua sendo a peça.
   (20/10) Tamanho errado: a arte NÃO é ajustada — entra na escala real, no centro da área pedida (sobra branco ou sai cortada).
   (20/10) Tamanho livre: a largura e a altura finais (cm) são obrigatórias; o arquivo é conferido com essa medida
   (com a sangria do gabarito), e os avisos de lado máximo/resolução usam o tamanho digitado.
   (23/10) AR3b: conferência do arquivo para impressão (window.conferirArquivosParaImpressao, no fim deste arquivo):
   roda no "Arte pronta para impressão" daqui e no "Enviar arquivo para impressão" do index.html; só avisa e registra.
   Usa as funções globais do index.html: abrirModal, api, enviarArquivoDrive, toast, esc,
   fmtMm, badge, recarregar.
   ===================================================================== */
(function () {
  const PDFJS = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js';
  const PDFJS_WORKER = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
  const JSPDF = 'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js';
  let carregandoJsPdf = null;
  function carregarJsPdf() {
    if (window.jspdf && window.jspdf.jsPDF) return Promise.resolve();
    if (carregandoJsPdf) return carregandoJsPdf;
    carregandoJsPdf = new Promise((ok, falha) => {
      const s = document.createElement('script'); s.src = JSPDF; s.onload = ok;
      s.onerror = () => { carregandoJsPdf = null; falha(new Error('Não foi possível carregar o gerador de PDF. Confira a internet e tente de novo.')); };
      document.head.appendChild(s);
    });
    return carregandoJsPdf;
  }
  // Junta as páginas da prova (canvas) num PDF só; cada página no tamanho final em mm (ou 150 dpi quando não há medida)
  async function montarPdf(itens) {
    await carregarJsPdf();
    const { jsPDF } = window.jspdf;
    let doc = null;
    for (const { c, wmm, hmm } of itens) {
      const w = wmm || c.width * 25.4 / 150, h = hmm || c.height * 25.4 / 150;
      const ori = w >= h ? 'l' : 'p';
      if (!doc) doc = new jsPDF({ unit: 'mm', format: [w, h], orientation: ori, compress: true });
      else doc.addPage([w, h], ori);
      doc.addImage(c.toDataURL('image/jpeg', 0.84), 'JPEG', 0, 0, w, h);
    }
    return doc.output('blob');
  }
  const TOL = 1.5;            // mm de folga na comparação de tamanhos
  const LADO_PROVA_PADRAO = 1600;    // px do lado maior da prova do cliente
  const LADO_CONF = 560;      // px do lado maior da conferência na tela
  const PT_MM = 25.4 / 72;
  let carregandoPdf = null;

  function carregarPdfJs() {
    if (window.pdfjsLib) return Promise.resolve();
    if (carregandoPdf) return carregandoPdf;
    carregandoPdf = new Promise((ok, falha) => {
      const s = document.createElement('script');
      s.src = PDFJS;
      s.onload = () => { window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER; ok(); };
      s.onerror = () => { carregandoPdf = null; falha(new Error('Não foi possível carregar o leitor de PDF. Confira a internet e tente de novo.')); };
      document.head.appendChild(s);
    });
    return carregandoPdf;
  }

  const PAPEIS = [['', 'Não usar'], ['frente', 'Frente'], ['verso', 'Verso'], ['faca', 'Faca (linha de corte)'],
                  ['verniz_frente', 'Verniz da frente'], ['verniz_verso', 'Verniz do verso'],
                  ['branco_frente', 'Máscara de branco da frente'], ['branco_verso', 'Máscara de branco do verso'], ['extra', 'Outra página']];
  // máscara de branco (19/10): página de produção — não vai para a prova do cliente (como a faca)
  const UNICOS = ['frente', 'verso', 'faca', 'verniz_frente', 'verniz_verso', 'branco_frente', 'branco_verso'];
  const perto = (a, b) => Math.abs(a - b) <= TOL;
  const mm = v => fmtMm(Math.round(v * 10) / 10);
  const num = v => (v === '' || v == null) ? null : Number(String(v).replace(',', '.'));

  /* ---------- leitura dos arquivos ---------- */
  async function lerArquivos(files) {
    const paginas = [];
    for (const file of files) {
      const ehPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
      if (ehPdf) {
        await carregarPdfJs();
        const doc = await window.pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
        for (let p = 1; p <= doc.numPages; p++) {
          const pg = await doc.getPage(p);
          const vp = pg.getViewport({ scale: 1 });
          paginas.push({ fonte: 'pdf', file, doc, pagina: p, w: vp.width * PT_MM, h: vp.height * PT_MM,
                         nome: file.name + (doc.numPages > 1 ? ` — pág. ${p}` : ''), papel: '' });
        }
      } else if (/^image\//.test(file.type) || /\.(jpe?g|png|webp)$/i.test(file.name)) {
        const img = await carregarImagem(URL.createObjectURL(file));
        paginas.push({ fonte: 'img', file, img, w: null, h: null, pxw: img.naturalWidth, pxh: img.naturalHeight, nome: file.name, papel: '' });
      } else {
        toast(`"${file.name}" não é PDF nem imagem: ficou de fora. CDR precisa ser exportado em PDF para montar a prova.`, true);
      }
    }
    return paginas;
  }
  function carregarImagem(src) {
    return new Promise((ok, falha) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => falha(new Error('Imagem inválida.')); i.src = src; });
  }
  // Desenha a página inteira (do arquivo) num canvas com "k" pixels por mm
  async function rasterizar(p, k) {
    const c = document.createElement('canvas');
    if (p.fonte === 'pdf') {
      const pg = await p.doc.getPage(p.pagina);
      const vp = pg.getViewport({ scale: (k * PT_MM) });
      c.width = Math.max(1, Math.round(vp.width)); c.height = Math.max(1, Math.round(vp.height));
      const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
      await pg.render({ canvasContext: ctx, viewport: vp }).promise;
    } else {
      c.width = p.pxw; c.height = p.pxh;
      c.getContext('2d').drawImage(p.img, 0, 0);
    }
    return c;
  }

  /* ---------- regra: o que o gabarito pede × o que veio ---------- */
  // Devolve { fw, fh (tamanho final em mm), s (sangria no arquivo, mm), seg, encaixe: 'corte'|'conter'|'cobrir'|'inteiro', avisos[] }
  function analisar(p, g) {
    const av = [];
    if (g.modo === 'area') {
      const W = g.w, H = g.h, nome = g.nomeArea || 'área útil';
      if (p.fonte === 'img') {
        av.push({ nivel: 'amarelo', txt: `Imagem não traz medida: confira se cabe na ${nome} (${mm(W)} × ${mm(H)} mm). Para conferir, envie em PDF.` });
        return { fw: null, fh: null, s: 0, seg: 0, encaixe: 'inteiro', avisos: av };
      }
      const cabe = (p.w <= W + TOL && p.h <= H + TOL), cabeGirado = (p.w <= H + TOL && p.h <= W + TOL);
      if (cabe || cabeGirado) av.push({ nivel: 'verde', txt: `Cabe na ${nome} (${mm(W)} × ${mm(H)} mm)${cabe ? '' : ', com a folha deitada'}: o arquivo tem ${mm(p.w)} × ${mm(p.h)} mm.` });
      else av.push({ nivel: 'vermelho', txt: `Não cabe na ${nome}: o arquivo tem ${mm(p.w)} × ${mm(p.h)} mm e a área útil é ${mm(W)} × ${mm(H)} mm (em pé ou deitada).` });
      return { fw: p.w, fh: p.h, s: 0, seg: 0, encaixe: 'corte', avisos: av, tamanhoErrado: !(cabe || cabeGirado), area: true };
    }
    if (g.modo === 'definido' && g.regras) {
      const r = analisar(p, { ...g, regras: null });
      if (!r.tamanhoErrado) avisosRegras(r, g.regras);
      return r;
    }
    if (g.modo === 'fixo' || g.modo === 'definido') {
      const W = g.w, H = g.h, s = g.s;
      if (p.fonte === 'img') {
        av.push({ nivel: 'amarelo', txt: 'Imagem não traz medida: foi encaixada no tamanho final do gabarito (sem conferir sangria).' });
        return { fw: W, fh: H, s: 0, seg: g.seg, encaixe: 'cobrir', avisos: av };
      }
      if (perto(p.w, W + 2 * s) && perto(p.h, H + 2 * s)) return { fw: W, fh: H, s, seg: g.seg, encaixe: 'corte', avisos: av };
      if (s > 0 && perto(p.w, W) && perto(p.h, H)) {
        av.push({ nivel: 'amarelo', txt: `Arquivo sem sangria: veio no tamanho final (${mm(W)} × ${mm(H)} mm). Falta ${mm(s)} mm de cada lado.` });
        return { fw: W, fh: H, s: 0, seg: g.seg, encaixe: 'corte', avisos: av };
      }
      if (g.gira && perto(p.w, H + 2 * s) && perto(p.h, W + 2 * s)) {
        av.push({ nivel: 'verde', txt: `Arte ${H > W ? 'deitada' : 'em pé'} (${mm(H)} × ${mm(W)} mm): este material aceita os dois sentidos.` });
        return { fw: H, fh: W, s, seg: g.seg, encaixe: 'corte', avisos: av, girada: true };
      }
      if (g.gira && s > 0 && perto(p.w, H) && perto(p.h, W)) {
        av.push({ nivel: 'amarelo', txt: `Arquivo sem sangria: veio no tamanho final (${mm(H)} × ${mm(W)} mm). Falta ${mm(s)} mm de cada lado.` });
        return { fw: H, fh: W, s: 0, seg: g.seg, encaixe: 'corte', avisos: av, girada: true };
      }
      if ((perto(p.w, H + 2 * s) && perto(p.h, W + 2 * s)) || (perto(p.w, H) && perto(p.h, W))) {
        av.push({ nivel: 'vermelho', txt: `A arte está girada em relação ${g.modo === 'definido' ? 'ao tamanho informado' : 'ao gabarito'} (veio ${mm(p.w)} × ${mm(p.h)} mm; ${g.modo === 'definido' ? 'o tamanho informado' : 'o gabarito'} é ${mm(W)} × ${mm(H)} mm).` });
      } else {
        const ped = s > 0 ? `${mm(W + 2 * s)} × ${mm(H + 2 * s)} mm (com sangria) ou ${mm(W)} × ${mm(H)} mm (final)` : `${mm(W)} × ${mm(H)} mm`;
        av.push({ nivel: 'vermelho', txt: g.modo === 'definido' ? `Tamanho diferente do informado: o arquivo tem ${mm(p.w)} × ${mm(p.h)} mm; a arte deve ter ${ped}.`
                                                                : `Tamanho diferente do gabarito: o arquivo tem ${mm(p.w)} × ${mm(p.h)} mm; o gabarito pede ${ped}.` });
      }
      return { fw: W, fh: H, s: 0, seg: g.seg, encaixe: 'conter', avisos: av, tamanhoErrado: true };
    }
    // tamanho livre (gabarito) ou tamanho do próprio arquivo (sem gabarito)
    if (p.fonte === 'img') {
      av.push({ nivel: 'amarelo', txt: 'Imagem não traz medida: para conferir o tamanho, envie em PDF.' });
      return { fw: null, fh: null, s: 0, seg: 0, encaixe: 'inteiro', avisos: av };
    }
    const s = g.s || 0;
    let r;
    if (s && (p.w <= 2 * s || p.h <= 2 * s)) r = { fw: p.w, fh: p.h, s: 0, seg: g.seg, encaixe: 'corte', avisos: av };
    else r = { fw: p.w - 2 * s, fh: p.h - 2 * s, s, seg: g.seg, encaixe: 'corte', avisos: av };
    avisosRegras(r, g.regras);
    return r;
  }
  // Tamanho livre com regras (lona, faixa e banner): lado menor máximo, emenda e resolução recomendada (só avisos)
  function avisosRegras(r, rg) {
    if (!rg || !r.fw) return;
    const menor = Math.min(r.fw, r.fh), maior = Math.max(r.fw, r.fh), cm = v => fmtMm(Math.round(v) / 10);
    if (rg.lado_menor_emenda_mm && menor > rg.lado_menor_emenda_mm + TOL)
      r.avisos.push({ nivel: 'amarelo', txt: `Lado menor de ${cm(menor)} cm: passa de ${cm(rg.lado_menor_emenda_mm)} cm, a lona vai com emenda.` });
    else if (rg.lado_menor_max_mm && menor > rg.lado_menor_max_mm + TOL)
      r.avisos.push({ nivel: 'amarelo', txt: `Lado menor de ${cm(menor)} cm: passa do máximo de banner e faixa (${cm(rg.lado_menor_max_mm)} cm). Só em lona (sem emenda até ${cm(rg.lado_menor_emenda_mm || 3000)} cm).` });
    if (Array.isArray(rg.dpi_recomendado) && rg.dpi_recomendado.length) {
      const f = rg.dpi_recomendado.find(x => !x.ate_mm || maior <= x.ate_mm + TOL);
      if (f) r.avisos.push({ nivel: 'verde', txt: `Resolução recomendada para ${cm(maior)} cm no lado maior: ${f.dpi} dpi (só recomendação; a designer decide se serve).` });
    }
  }
  // Folhas da máquina digital (Konica): a folha montada pela designer tem de ter um destes tamanhos (em pé ou deitada)
  const FOLHAS_DIGITAL = [['A4 (formato 9)', 220, 320], ['SRA3', 320, 450]];
  function folhaDigital(w, h) {
    return FOLHAS_DIGITAL.find(([, a, b]) => (perto(w, a) && perto(h, b)) || (perto(w, b) && perto(h, a))) || null;
  }
  // Mede um arquivo (1ª página do PDF) em mm: usado também pelo index.html ao fechar a arte
  window.medirArquivoMm = async function (file) {
    if (!(file.type === 'application/pdf' || /\.pdf$/i.test(file.name))) return null;
    await carregarPdfJs();
    const doc = await window.pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
    const vp = (await doc.getPage(1)).getViewport({ scale: 1 });
    return { w: vp.width * PT_MM, h: vp.height * PT_MM, paginas: doc.numPages };
  };
  window.folhaDigitalMm = (w, h) => { const f = folhaDigital(w, h); return f ? f[0] : null; };

  /* ---------- imagens ---------- */
  // Conferência (equipe): arquivo inteiro + sangria sombreada + corte (vermelho) + segurança (verde)
  async function desenharConferencia(p, a) {
    const k0 = p.fonte === 'pdf' ? LADO_CONF / Math.max(p.w, p.h) : null;
    const base = await rasterizar(p, k0 || 1);
    const c = document.createElement('canvas');
    if (a.encaixe === 'conter') {
      // tamanho errado: a área pedida com a arte na escala real, no centro (menor = sobra branco; maior = sai cortada)
      const k = LADO_CONF / Math.max(a.fw, a.fh);
      c.width = Math.round(a.fw * k); c.height = Math.round(a.fh * k);
      const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
      const real = await rasterizar(p, k);
      const x = (c.width - real.width) / 2, y = (c.height - real.height) / 2;
      ctx.drawImage(real, x, y);
      if (real.width < c.width || real.height < c.height) {   // contorno da arte quando ela é menor
        ctx.save(); ctx.strokeStyle = '#E07B00'; ctx.lineWidth = Math.max(1.5, c.width / 400); ctx.setLineDash([6, 4]);
        ctx.strokeRect(Math.max(0, x), Math.max(0, y), Math.min(c.width, real.width), Math.min(c.height, real.height)); ctx.restore();
      }
      linhas(ctx, k, 0, a.seg, c.width, c.height);
      linhasDobra(ctx, k, 0, a.dob, c.width, c.height);
      return c;
    }
    if (a.encaixe === 'cobrir') {
      const k = LADO_CONF / Math.max(a.fw, a.fh);
      c.width = Math.round(a.fw * k); c.height = Math.round(a.fh * k);
      cobrir(c.getContext('2d'), base, c.width, c.height);
      linhas(c.getContext('2d'), k, 0, a.seg, c.width, c.height);
      linhasDobra(c.getContext('2d'), k, 0, a.dob, c.width, c.height);
      return c;
    }
    c.width = base.width; c.height = base.height;
    const ctx = c.getContext('2d'); ctx.drawImage(base, 0, 0);
    if (a.encaixe === 'inteiro') return c;
    const k = base.width / p.w;
    linhas(ctx, k, a.s, a.seg, c.width, c.height);
    linhasDobra(ctx, k, a.s, a.dob, c.width, c.height);
    return c;
  }
  // Linhas de dobra: posições em mm a partir do corte (esquerda / topo), tracejado azul com contorno branco
  function linhasDobra(ctx, k, s, dob, W, H) {
    if (!dob || (!(dob.v || []).length && !(dob.h || []).length)) return;
    const lw = Math.max(1.5, Math.max(W, H) / 450), o = s * k;
    ctx.save(); ctx.setLineDash([lw * 5, lw * 3]);
    for (const [cor, larg] of [['rgba(255,255,255,.9)', lw * 2.6], ['#0096D6', lw]]) {
      ctx.strokeStyle = cor; ctx.lineWidth = larg; ctx.beginPath();
      for (const x of dob.v || []) { ctx.moveTo(o + x * k, 0); ctx.lineTo(o + x * k, H); }
      for (const y of dob.h || []) { ctx.moveTo(0, o + y * k); ctx.lineTo(W, o + y * k); }
      ctx.stroke();
    }
    ctx.restore();
  }
  function linhas(ctx, k, s, seg, W, H) {
    const lw = Math.max(1.5, W / 400);
    if (s > 0) {           // sangria: faixa sombreada fora do corte
      ctx.save(); ctx.fillStyle = 'rgba(214,69,69,.18)';
      const sp = s * k;
      ctx.fillRect(0, 0, W, sp); ctx.fillRect(0, H - sp, W, sp); ctx.fillRect(0, sp, sp, H - 2 * sp); ctx.fillRect(W - sp, sp, sp, H - 2 * sp);
      ctx.restore();
    }
    ctx.save(); ctx.lineWidth = lw;
    ctx.strokeStyle = 'rgba(214,69,69,.95)'; ctx.setLineDash([lw * 4, lw * 3]);
    ctx.strokeRect(s * k, s * k, W - 2 * s * k, H - 2 * s * k);
    if (seg > 0) {
      ctx.strokeStyle = 'rgba(20,150,90,.95)'; ctx.setLineDash([]);
      const i = (s + seg) * k; ctx.strokeRect(i, i, W - 2 * i, H - 2 * i);
    }
    ctx.restore();
  }
  function cobrir(ctx, src, W, H) {
    const e = Math.max(W / src.width, H / src.height);
    const w = src.width * e, h = src.height * e;
    ctx.drawImage(src, (W - w) / 2, (H - h) / 2, w, h);
  }
  // Área final (sem sangria) de uma página, lado maior = "lado" px, sem marca d'água
  async function areaFinal(p, a, comFaixa, lado) {
    const LADO_PROVA = lado || LADO_PROVA_PADRAO;
    const c = document.createElement('canvas');
    if (a.encaixe === 'inteiro') {
      const e = Math.min(1, LADO_PROVA / Math.max(p.pxw, p.pxh));
      c.width = Math.round(p.pxw * e); c.height = Math.round(p.pxh * e);
      c.getContext('2d').drawImage(p.img, 0, 0, c.width, c.height);
    } else {
      const k = LADO_PROVA / Math.max(a.fw, a.fh);
      c.width = Math.round(a.fw * k); c.height = Math.round(a.fh * k);
      const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
      if (a.encaixe === 'corte') {
        const base = await rasterizar(p, k);
        ctx.drawImage(base, -a.s * k, -a.s * k);
      } else if (a.encaixe === 'cobrir') {
        cobrir(ctx, await rasterizar(p, 1), c.width, c.height);
      } else { // conter: tamanho errado — arte na escala real, no centro, sem ajustar (menor = branco; maior = cortada)
        const base = await rasterizar(p, k);
        ctx.drawImage(base, (c.width - base.width) / 2, (c.height - base.height) / 2);
        if (comFaixa) faixaAviso(ctx, c.width, c.height, `ATENÇÃO: a arte enviada (${mm(p.w)} × ${mm(p.h)} mm) não está no tamanho pedido (${mm(a.fw)} × ${mm(a.fh)} mm)`);
      }
    }
    return c;
  }
  // Prova do cliente: área final + faca + brilho do verniz + legenda + marca d'água
  // extra = { faca: {p, an}, verniz: {p, an}, espelharFaca }
  async function desenharProva(p, a, comFaixa, extra, lado) {
    const c = await areaFinal(p, a, comFaixa, lado);
    const leg = [];
    if (extra && extra.verniz) { aplicarBrilho(c, mascaraVerniz(await areaFinal(extra.verniz.p, extra.verniz.an, false, lado))); leg.push('✦ brilho = verniz localizado'); }
    if (extra && extra.faca) { aplicarFaca(c, linhaFaca(await areaFinal(extra.faca.p, extra.faca.an, false, lado)), extra.espelharFaca); leg.push('linha magenta = corte (faca)'); }
    if (a.dob && a.fw && a.encaixe !== 'inteiro' && ((a.dob.v || []).length || (a.dob.h || []).length)) {
      linhasDobra(c.getContext('2d'), c.width / a.fw, 0, a.dob, c.width, c.height); leg.push('tracejado azul = dobra');
    }
    if (leg.length) legenda(c, leg);
    await marcaDagua(c);
    return c;
  }
  // Máscara de verniz para ir no PDF (sem marca d'água: a página do cliente usa para animar o brilho)
  async function desenharMascara(p, a, lado) {
    const c = await areaFinal(p, a, false, lado);
    const m = mascaraVerniz(c), out = document.createElement('canvas');
    out.width = c.width; out.height = c.height;
    const ctx = out.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, out.width, out.height);
    ctx.drawImage(pintar(m, '#000'), 0, 0);
    return out;
  }
  // Pixels escuros da máscara (preto K100) viram área opaca
  function mascaraVerniz(c) {
    const W = c.width, H = c.height, src = c.getContext('2d').getImageData(0, 0, W, H).data;
    const m = document.createElement('canvas'); m.width = W; m.height = H;
    const mc = m.getContext('2d'), out = mc.createImageData(W, H), d = out.data;
    for (let i = 0; i < src.length; i += 4) {
      const lum = 0.299 * src[i] + 0.587 * src[i + 1] + 0.114 * src[i + 2];
      if (lum < 110) { d[i] = d[i + 1] = d[i + 2] = 255; d[i + 3] = 255; }
    }
    mc.putImageData(out, 0, 0); return m;
  }
  // Linha da faca: pixels magenta ou pretos da página da faca
  function linhaFaca(c) {
    const W = c.width, H = c.height, src = c.getContext('2d').getImageData(0, 0, W, H).data;
    const m = document.createElement('canvas'); m.width = W; m.height = H;
    const mc = m.getContext('2d'), out = mc.createImageData(W, H), d = out.data;
    for (let i = 0; i < src.length; i += 4) {
      const r = src[i], g = src[i + 1], b = src[i + 2];
      const magenta = r > 140 && g < 120 && b > 80 && r - g > 70;
      const preto = r < 90 && g < 90 && b < 90;
      if (magenta || preto) { d[i] = d[i + 1] = d[i + 2] = 255; d[i + 3] = 255; }
    }
    mc.putImageData(out, 0, 0); return m;
  }
  function pintar(m, cor) {
    const t = document.createElement('canvas'); t.width = m.width; t.height = m.height;
    const tc = t.getContext('2d'); tc.drawImage(m, 0, 0);
    tc.globalCompositeOperation = 'source-in'; tc.fillStyle = cor; tc.fillRect(0, 0, t.width, t.height);
    return t;
  }
  function aplicarBrilho(c, m) {
    const W = c.width, H = c.height, g = document.createElement('canvas'); g.width = W; g.height = H;
    const gc = g.getContext('2d'), lg = gc.createLinearGradient(0, 0, W, H);
    lg.addColorStop(0, 'rgba(255,255,255,.18)'); lg.addColorStop(0.35, 'rgba(255,255,255,.75)');
    lg.addColorStop(0.5, 'rgba(255,255,255,.25)'); lg.addColorStop(0.7, 'rgba(255,255,255,.7)'); lg.addColorStop(1, 'rgba(255,255,255,.2)');
    gc.fillStyle = lg; gc.fillRect(0, 0, W, H);
    gc.globalCompositeOperation = 'destination-in'; gc.drawImage(m, 0, 0);
    const ctx = c.getContext('2d'); ctx.save(); ctx.globalAlpha = 0.6; ctx.drawImage(g, 0, 0); ctx.restore();
  }
  function aplicarFaca(c, m, espelhar) {
    const ctx = c.getContext('2d'), t = Math.max(1, Math.round(Math.max(c.width, c.height) / 500));
    const branco = pintar(m, '#fff'), mag = pintar(m, '#E6007E');
    ctx.save();
    if (espelhar) { ctx.translate(c.width, 0); ctx.scale(-1, 1); }
    for (let dx = -t - 1; dx <= t + 1; dx++) for (let dy = -t - 1; dy <= t + 1; dy++) ctx.drawImage(branco, dx, dy);
    for (let dx = -t; dx <= t; dx++) for (let dy = -t; dy <= t; dy++) ctx.drawImage(mag, dx, dy);
    ctx.restore();
  }
  function legenda(c, linhas) {
    const ctx = c.getContext('2d'), fs = Math.max(11, Math.round(Math.min(c.width, c.height) * 0.04)), pad = Math.round(fs * 0.5);
    ctx.save(); ctx.font = `600 ${fs}px Arial, sans-serif`;
    const w = Math.max(...linhas.map(l => ctx.measureText(l).width)) + pad * 2, h = linhas.length * fs * 1.3 + pad;
    ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.fillRect(pad, c.height - h - pad, w, h);
    ctx.fillStyle = '#132A32'; ctx.textBaseline = 'top';
    linhas.forEach((l, i) => ctx.fillText(l, pad * 2, c.height - h - pad + pad / 2 + i * fs * 1.3));
    ctx.restore();
  }
  function faixaAviso(ctx, W, H, texto) {
    const h = Math.max(Math.round(H * 0.08), 30);
    ctx.save(); ctx.fillStyle = '#7A0000'; ctx.fillRect(0, H - h, W, h);
    ctx.fillStyle = '#fff'; ctx.font = `bold ${Math.round(h * 0.38)}px Arial, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(texto, W / 2, H - h / 2, W * 0.96); ctx.restore();
  }
  let logoCache = null;
  async function marcaDagua(c) {
    const ctx = c.getContext('2d'), W = c.width, H = c.height;
    const fs = Math.max(14, Math.round(Math.max(W, H) * 0.032));
    const texto = 'PROVA — NÃO USE PARA IMPRESSÃO';
    ctx.save();
    ctx.translate(W / 2, H / 2); ctx.rotate(-Math.atan2(H, W));
    ctx.font = `700 ${fs}px Arial, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(19,42,50,.16)'; ctx.strokeStyle = 'rgba(255,255,255,.22)'; ctx.lineWidth = Math.max(1, fs / 14);
    const diag = Math.sqrt(W * W + H * H), passoY = fs * 3.2, larg = ctx.measureText(texto).width + fs * 3;
    for (let y = -diag / 2; y <= diag / 2; y += passoY) {
      const desl = (Math.round(y / passoY) % 2) * larg / 2;
      for (let x = -diag / 2 - larg; x <= diag / 2 + larg; x += larg) { ctx.strokeText(texto, x + desl, y); ctx.fillText(texto, x + desl, y); }
    }
    ctx.restore();
    // logo GVH no canto de cima
    try {
      if (!logoCache) { const el = document.getElementById('logo-gvh'); if (el && el.src) logoCache = await carregarImagem(el.src); }
      if (logoCache) {
        const lh = Math.max(18, Math.round(Math.min(W, H) * 0.075)), lw = logoCache.naturalWidth * lh / logoCache.naturalHeight;
        const pad = Math.round(lh * 0.35), x = W - lw - pad * 2 - pad, y = pad;
        ctx.save(); ctx.fillStyle = 'rgba(255,255,255,.85)';
        ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, lw + pad * 2, lh + pad * 2, pad) : ctx.rect(x, y, lw + pad * 2, lh + pad * 2); ctx.fill();
        ctx.drawImage(logoCache, x + pad, y + pad, lw, lh); ctx.restore();
      }
    } catch (e) { /* sem logo, segue só com o texto */ }
  }
  const paraBlob = c => new Promise(ok => c.toBlob(ok, 'image/jpeg', 0.84));

  /* ---------- tela ---------- */
  // opts.teste = só testar o arquivo do cliente contra o gabarito (não sobe nada, não gera link)
  window.abrirMontador = async function (arteId, opts) {
    const teste = !!(opts && opts.teste), direto = teste ? opts.direto || null : null;
    let a;
    if (teste) a = opts.item;
    else { try { a = (await api('obter_arte', { id: arteId })).arte; } catch (e) { return; } }
    const u = a.urgencia || {};
    const gm = u.gabarito_medidas;
    // gabarito: fixo (com medidas) | livre (tamanho livre) | sem (sem gabarito com medidas)
    let g;
    if (gm && !gm.medidas_pendentes && !gm.tamanho_livre) g = { modo: 'fixo', w: +gm.corte_largura_mm, h: +gm.corte_altura_mm, s: +gm.sangria_mm || 0, seg: +gm.seguranca_mm || 0, faca: !!gm.ultima_pagina_faca };
    else if (gm && !gm.medidas_pendentes && gm.tamanho_livre) g = { modo: 'livre', s: +gm.sangria_mm || 0, seg: +gm.seguranca_mm || 0, faca: !!gm.ultima_pagina_faca };
    else g = { modo: 'arquivo', s: 0, seg: 3, faca: false };
    g.regras = (gm && gm.regras && typeof gm.regras === 'object') ? gm.regras : null;
    if (g.modo === 'fixo' && g.regras && g.regras.modo === 'area') { g.modo = 'area'; g.nomeArea = `área útil do ${u.gabarito_nome || 'gabarito'}`; }
    const digital = !!(u.digital && u.digital.digital) && g.modo !== 'area';
    // ordem das páginas do gabarito (frente, verso, verniz_frente, verniz_verso, hot_stamping, metalizado, calco_branco, faca)
    g.ordem = (gm && Array.isArray(gm.paginas_ordem) && gm.paginas_ordem.length) ? gm.paginas_ordem : null;
    if (g.ordem && g.ordem.includes('faca')) g.faca = true;
    g.dobras = (gm && gm.dobras && typeof gm.dobras === 'object') ? gm.dobras : null;
    g.gira = !!(gm && gm.aceita_girar);
    const nomeGab = u.gabarito_nome ? `${esc(u.grupo_nome || '')}${u.grupo_nome ? ' — ' : ''}${esc(u.gabarito_nome)}` : '';
    const linhaGab = g.modo === 'area'
      ? `<b>${nomeGab}</b> · o arquivo precisa caber na área útil de ${mm(g.w)} × ${mm(g.h)} mm (em pé ou deitado)${g.regras.folha_mm ? ` · folha ${mm(g.regras.folha_mm[0])} × ${mm(g.regras.folha_mm[1])} mm` : ''}`
      : g.modo === 'fixo'
      ? `<b>${nomeGab}</b> · final ${mm(g.w)} × ${mm(g.h)} mm · sangria ${mm(g.s)} · segurança ${mm(g.seg)} mm`
      : g.modo === 'livre' ? `<b>${nomeGab}</b> · tamanho livre: escreva abaixo o tamanho final da arte · sangria ${mm(g.s)} · segurança ${mm(g.seg)} mm`
      : `<span class="muted">Sem gabarito com medidas neste item.</span>`;
    const ehCartao = /cart[ãa]o/i.test(u.grupo_nome || '') || (g.modo === 'fixo' && Math.max(g.w, g.h) <= 100);
    let paginas = [], analise = {}, enviando = false;

    const m = abrirModal({ titulo: `${teste ? 'Testar arquivo do cliente' : 'Montar prova'} · ${a.item_descricao || ''}`, largo: true, corpo: `
      <style>
        .mt-drop{border:2px dashed var(--linha);border-radius:12px;padding:18px;text-align:center;color:var(--texto-2);cursor:pointer;font-size:13px}
        .mt-drop.sobre{border-color:var(--verde);background:var(--verde-bg)}
        .mt-pags{display:flex;gap:10px;flex-wrap:wrap;margin-top:12px}
        .mt-pag{width:140px;font-size:11px;border:1px solid var(--linha);border-radius:8px;padding:6px;background:#fff}
        .mt-pag canvas,.mt-pag img{width:100%;height:96px;object-fit:contain;background:var(--linha-2);display:block;border-radius:4px}
        .mt-pag select{width:100%;margin-top:4px;font-size:12px;padding:3px}
        .mt-conf{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px;margin-top:12px}
        .mt-conf figure{margin:0}.mt-conf canvas{width:100%;height:auto;border:1px solid var(--linha);border-radius:6px;background:#fff}
        .mt-conf figcaption{font-size:12px;color:var(--texto-2);margin-bottom:4px}
        .mt-av{font-size:13px;padding:6px 10px;border-radius:8px;margin-top:6px}
        .mt-av.vermelho{background:var(--vermelho-bg);color:var(--vermelho)}.mt-av.amarelo{background:var(--ambar-bg);color:#7d520d}.mt-av.verde{background:var(--verde-bg);color:#007a61}
      </style>
      <div class="small" style="margin-bottom:8px">Gabarito: ${linhaGab}</div>
      ${teste ? `<div class="mt-av amarelo" style="margin:0 0 10px">O arquivo é conferido aqui na tela, contra o gabarito do item. <b>Nada é salvo nem enviado ao cliente${direto && direto.arte ? ', a não ser que você clique em "Usar este arquivo e enviar para a pré-impressão"' : ''}.</b></div>` : ''}
      <div class="campo" style="margin-bottom:10px;${teste ? 'display:none' : ''}">O que você está enviando ao cliente?
        <label class="caixa-linha" style="margin-top:6px"><input type="radio" name="mt-tipo" value="prova" checked>
          <span><b>Só a prova</b><br><span class="small muted">Depois que o cliente aprovar, você fecha o arquivo para impressão.</span></span></label>
        <label class="caixa-linha" style="margin-top:6px"><input type="radio" name="mt-tipo" value="final">
          <span><b>Arte pronta para impressão</b><br><span class="small muted">O arquivo que você escolher aqui já é o final. Quando o cliente aprovar, a arte fica pronta e o item segue para a pré-impressão se o pedido tiver pagamento (ou autorização).</span></span></label>
      </div>
      ${digital && !teste ? `<div class="mt-av amarelo" id="mt-dig" style="margin:0 0 10px;display:none"><b>Item na impressão digital</b>${u.digital.motivo ? ` (${esc(u.digital.motivo)})` : ''}. Monte a folha (A4 22 × 32 cm ou SRA3 32 × 45 cm) e anexe aqui: ela vai como <b>arquivo para impressão</b>. O cliente vê só a prova da peça.
        <label class="campo" style="margin:8px 0 0">Folha montada (PDF)<input type="file" id="mt-folha" accept=".pdf,application/pdf"></label><div id="mt-folha-st" class="small" style="margin-top:4px"></div></div>` : ''}
      ${g.modo === 'livre' ? `<div class="grade g3" style="margin-bottom:8px">
        <div class="small" style="grid-column:1/-1">Tamanho final da arte * <span class="muted">(sem a sangria; o montador confere o arquivo com esta medida)</span>
          ${a.item_descricao ? `<br><span class="muted">No pedido:</span> ${esc(a.item_descricao)}${a.quantidade ? ` · ${esc(String(a.quantidade))} un` : ''}` : ''}</div>
        <label class="campo">Largura (cm) *<input type="text" inputmode="decimal" id="mt-lw" placeholder="Ex.: 60"></label>
        <label class="campo">Altura (cm) *<input type="text" inputmode="decimal" id="mt-lh" placeholder="Ex.: 90"></label>
        <div class="small muted" id="mt-larq" style="align-self:end;padding-bottom:10px"></div>
      </div>` : ''}
      ${g.modo === 'arquivo' ? `<div class="grade g3" style="margin-bottom:8px">
        <label class="campo" style="grid-column:1/-1;margin:0"><span>Tamanho final</span>
          <select id="mt-tam"><option value="arquivo">Usar o tamanho do arquivo (PDF)</option><option value="definido">Definir o tamanho</option></select></label>
        <label class="campo mt-def" style="display:none">Largura final (mm)<input type="text" inputmode="decimal" id="mt-w"></label>
        <label class="campo mt-def" style="display:none">Altura final (mm)<input type="text" inputmode="decimal" id="mt-h"></label>
      </div>` : ''}
      <div class="mt-drop" id="mt-drop">Arraste aqui o <b>PDF</b> ou as <b>imagens</b> da arte (frente e verso), ou clique para escolher.
        <input type="file" id="mt-arq" multiple accept=".pdf,application/pdf,image/jpeg,image/png,image/webp" style="display:none"></div>
      <div class="mt-pags" id="mt-pags"></div>
      <div id="mt-res"></div>`,
      rodape: `<button class="btn" data-v style="margin-right:auto">Fechar</button>${teste ? (direto && direto.arte ? '<span class="small muted" id="mt-dst"></span><button class="btn prim" data-direto disabled>Usar este arquivo e enviar para a pré-impressão</button>' : '') : '<button class="btn prim" data-enviar disabled>Enviar prova ao cliente</button>'}` });
    const $m = sel => m.el.querySelector(sel);
    $m('[data-v]').onclick = m.fechar;
    // item na digital: a folha montada só aparece quando a designer manda a arte pronta para impressão
    let folha = null;
    if ($m('#mt-dig')) {
      const mostrarDig = () => { $m('#mt-dig').style.display = (m.el.querySelector('[name=mt-tipo]:checked') || {}).value === 'final' ? '' : 'none'; };
      m.el.querySelectorAll('[name=mt-tipo]').forEach(r => r.addEventListener('change', mostrarDig));
      $m('#mt-folha').onchange = async () => {
        const f = $m('#mt-folha').files[0], st = $m('#mt-folha-st'); folha = null; st.innerHTML = '';
        if (!f) return;
        try {
          const md = await window.medirArquivoMm(f);
          if (!md) { st.innerHTML = '<span style="color:var(--vermelho)">A folha montada precisa ser PDF.</span>'; return; }
          const nome = folhaDigital(md.w, md.h);
          folha = { file: f, ok: !!nome };
          st.innerHTML = nome ? `<span style="color:#007a61">✓ Folha ${nome[0]}: ${mm(md.w)} × ${mm(md.h)} mm${md.paginas > 1 ? ` · ${md.paginas} páginas` : ''}.</span>`
            : `<span style="color:var(--vermelho)">A folha tem ${mm(md.w)} × ${mm(md.h)} mm: não é A4 (220 × 320) nem SRA3 (320 × 450). Confira antes de enviar.</span>`;
        } catch (e) { st.innerHTML = '<span style="color:var(--vermelho)">Não foi possível ler a folha. Exporte de novo em PDF.</span>'; }
      };
    }
    m.el.querySelectorAll('[name=mt-tipo]').forEach(r => r.addEventListener('change', () => { if (paginas.length) montar(); }));
    const drop = $m('#mt-drop'), inp = $m('#mt-arq');
    drop.onclick = e => { if (e.target !== inp) inp.click(); };
    ['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('sobre'); }));
    ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('sobre'); }));
    drop.addEventListener('drop', e => { if (e.dataTransfer.files.length) receber([...e.dataTransfer.files]); });
    inp.onchange = () => { if (inp.files.length) receber([...inp.files]); };
    if ($m('#mt-lw')) {
      ['#mt-lw', '#mt-lh'].forEach(s => $m(s).oninput = () => { mostrarArqLivre(); clearTimeout(montar.t); montar.t = setTimeout(montar, 400); });
    }
    function tamanhoLivre() {
      const w = num($m('#mt-lw') && $m('#mt-lw').value), h = num($m('#mt-lh') && $m('#mt-lh').value);
      return w > 0 && h > 0 ? { w: w * 10, h: h * 10 } : null;
    }
    function mostrarArqLivre() {
      const box = $m('#mt-larq'); if (!box) return; const t = tamanhoLivre();
      box.textContent = t && g.s ? `Arquivo com sangria: ${mm(t.w + 2 * g.s)} × ${mm(t.h + 2 * g.s)} mm` : t ? `Arquivo: ${mm(t.w)} × ${mm(t.h)} mm` : '';
    }
    if ($m('#mt-tam')) {
      $m('#mt-tam').onchange = () => { m.el.querySelectorAll('.mt-def').forEach(x => x.style.display = $m('#mt-tam').value === 'definido' ? '' : 'none'); montar(); };
      ['#mt-w', '#mt-h'].forEach(s => $m(s).oninput = () => { clearTimeout(montar.t); montar.t = setTimeout(montar, 400); });
    }

    async function receber(files) {
      drop.innerHTML = 'Lendo arquivos…';
      try { paginas = await lerArquivos(files); }
      catch (e) { toast(e.message || 'Não foi possível ler o arquivo.', true); paginas = []; }
      drop.innerHTML = 'Trocar arquivos: arraste aqui ou clique.';
      drop.appendChild(inp);
      // sugestão: pela ordem do gabarito (frente, verso, máscaras…); com faca, a última página é a faca
      const ehFaca = i => g.faca && paginas.length > 1 && i === paginas.length - 1;
      const usaveis = paginas.filter((p, i) => !ehFaca(i));
      const ordem = (g.ordem || ['frente', 'verso']).filter(x => x !== 'faca');
      const PAPEL_DA_ORDEM = { frente: 'frente', verso: 'verso', verniz_frente: 'verniz_frente', verniz_verso: 'verniz_verso', branco_frente: 'branco_frente', branco_verso: 'branco_verso' };
      usaveis.forEach((p, i) => { p.papel = PAPEL_DA_ORDEM[ordem[i]] || 'extra'; });
      paginas.forEach((p, i) => { if (ehFaca(i)) p.papel = 'faca'; });
      paginas.forEach(p => { if (!p.papel) p.papel = 'extra'; });
      const box = $m('#mt-pags'); box.innerHTML = '';
      for (const [i, p] of paginas.entries()) {
        const d = document.createElement('div'); d.className = 'mt-pag';
        const th = await rasterizar(p, p.fonte === 'pdf' ? 140 / Math.max(p.w, p.h) : 1);
        d.innerHTML = `<div title="${esc(p.nome)}" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(p.nome)}</div>`;
        d.appendChild(th);
        d.insertAdjacentHTML('beforeend', `<div class="muted">${p.w ? `${mm(p.w)} × ${mm(p.h)} mm` : `${p.pxw} × ${p.pxh} px`}</div>
          <select data-i="${i}">${PAPEIS.map(([v, n]) => `<option value="${v}" ${p.papel === v ? 'selected' : ''}>${n}</option>`).join('')}</select>`);
        box.appendChild(d);
      }
      box.querySelectorAll('select[data-i]').forEach(s => s.onchange = () => {
        const p = paginas[+s.dataset.i];
        if (s.value && UNICOS.includes(s.value)) paginas.forEach((o, j) => { if (j !== +s.dataset.i && o.papel === s.value) { o.papel = ''; const x = box.querySelector(`select[data-i="${j}"]`); if (x) x.value = ''; } });
        p.papel = s.value; montar();
      });
      montar();
    }

    function gabaritoEfetivo() {
      if (g.modo === 'livre') { const t = tamanhoLivre(); return t ? { ...g, modo: 'definido', w: t.w, h: t.h } : null; }
      if (g.modo !== 'arquivo') return g;
      if ($m('#mt-tam') && $m('#mt-tam').value === 'definido') {
        const w = num($m('#mt-w').value), h = num($m('#mt-h').value);
        if (w > 0 && h > 0) return { modo: 'definido', w, h, s: 0, seg: 3 };
      }
      return { modo: 'arquivo', s: 0, seg: 3 };
    }

    // faca e verniz para a frente ou o verso
    function extrasDe(lado) {
      const pFaca = paginas.find(p => p.papel === 'faca'), pV = paginas.find(p => p.papel === (lado === 'frente' ? 'verniz_frente' : 'verniz_verso'));
      const an = lado === 'frente' ? analise.vf : analise.vv;
      return { faca: pFaca && analise.faca ? { p: pFaca, an: analise.faca } : null, espelharFaca: lado === 'verso',
               verniz: pV && an ? { p: pV, an } : null };
    }
    async function montar() {
      const res = $m('#mt-res'), bt = $m('[data-enviar]') || document.createElement('button');
      const fr = paginas.find(p => p.papel === 'frente'), ve = paginas.find(p => p.papel === 'verso');
      const extras = paginas.filter(p => p.papel === 'extra');
      const pFaca = paginas.find(p => p.papel === 'faca'), pVF = paginas.find(p => p.papel === 'verniz_frente'), pVV = paginas.find(p => p.papel === 'verniz_verso');
      bt.disabled = true; analise = {}; const bd = $m('[data-direto]'); if (bd) bd.disabled = true;
      if (!fr) { res.innerHTML = paginas.length ? '<p class="small muted" style="margin-top:10px">Escolha qual página é a frente.</p>' : ''; return; }
      const ge = gabaritoEfetivo();
      if (!ge) { res.innerHTML = '<div class="mt-av amarelo" style="margin-top:10px">Escreva a <b>largura</b> e a <b>altura</b> finais da arte (em cm) para o montador conferir o arquivo.</div>'; return; }
      res.innerHTML = '<p class="small muted" style="margin-top:10px">Montando…</p>';
      try {
        analise.frente = analisar(fr, ge); if (ve) analise.verso = analisar(ve, ge);
        // linhas de dobra de cada lado (só com a arte no sentido do gabarito)
        if (ge.dobras) {
          if (!analise.frente.girada && !analise.frente.tamanhoErrado) analise.frente.dob = ge.dobras.frente || null;
          if (ve && !analise.verso.girada && !analise.verso.tamanhoErrado) analise.verso.dob = ge.dobras.verso || ge.dobras.frente || null;
        }
        // pé com pé: frente e verso no mesmo sentido
        if (ge.gira && ve && analise.frente.fw && analise.verso.fw && (analise.frente.fw > analise.frente.fh) !== (analise.verso.fw > analise.verso.fh)) {
          analise.verso.avisos.push({ nivel: 'amarelo', txt: 'Frente e verso em sentidos diferentes (um em pé, outro deitado). A arte deve ir "pé com pé": confira o tombo antes de imprimir.' });
        }
        analise.extras = extras.map(p => analisar(p, ge));
        if (pFaca) analise.faca = analisar(pFaca, ge);
        if (pVF) analise.vf = analisar(pVF, ge);
        if (pVV) analise.vv = analisar(pVV, ge);
        const especiais = [pFaca && 'faca', (pVF || pVV) && 'verniz', (analise.frente.dob || (analise.verso && analise.verso.dob)) && 'dobra'].filter(Boolean);
        const confF = await desenharConferencia(fr, analise.frente), confV = ve ? await desenharConferencia(ve, analise.verso) : null;
        const avisos = [...analise.frente.avisos.map(x => ({ ...x, txt: (ve ? 'Frente: ' : '') + x.txt })), ...(ve ? analise.verso.avisos.map(x => ({ ...x, txt: 'Verso: ' + x.txt })) : [])];
        const fw = analise.frente.fw, fh = analise.frente.fh;
        const tamErrado = analise.frente.tamanhoErrado || (analise.verso && analise.verso.tamanhoErrado);
        res.innerHTML = `
          <div class="mt-conf"><figure><figcaption>Frente — conferência da equipe</figcaption></figure>${ve ? '<figure><figcaption>Verso — conferência da equipe</figcaption></figure>' : ''}</div>
          <p class="small muted" style="margin:6px 0 0">Vermelho tracejado = corte · área sombreada = sangria · verde = margem de segurança${ge.dobras ? ' · azul tracejado = dobra (esta vai também para o cliente)' : ''}. <b>Corte, sangria e segurança não vão para o cliente.</b></p>
          ${avisos.length ? avisos.map(x => `<div class="mt-av ${x.nivel}">${esc(x.txt)}</div>`).join('') : '<div class="mt-av verde">Tamanho confere com o gabarito.</div>'}
          <div style="display:flex;gap:16px;flex-wrap:wrap;margin-top:10px">
            ${ve && !teste ? `<label class="check" style="margin:0"><input type="checkbox" id="mt-3d" ${ehCartao ? 'checked' : ''}> Mostrar ao cliente em 3D (gira frente e verso)</label>` : ''}
            ${tamErrado && !teste && !analise.frente.area ? '<label class="check" style="margin:0"><input type="checkbox" id="mt-faixa" checked> Avisar o cliente na prova que o tamanho não confere</label>' : ''}
          </div>
          ${fw ? `<p class="small" style="margin:8px 0 0">A prova do cliente mostra só a área final: <b>${mm(fw)} × ${mm(fh)} mm</b>, com a marca d'água da GVH.</p>` : ''}
          ${especiais.length ? `<div class="mt-conf mt-cliente"><figure><figcaption>Frente — como o cliente vai ver</figcaption></figure>${ve ? '<figure><figcaption>Verso — como o cliente vai ver</figcaption></figure>' : ''}</div>
            <p class="small muted" style="margin:6px 0 0">${pFaca ? 'Linha magenta = faca (no verso, espelhada). ' : ''}${pVF || pVV ? 'Área com brilho = verniz localizado; no link o brilho fica animado. ' : ''}${especiais.includes('dobra') ? 'Tracejado azul = dobra.' : ''}</p>` : ''}
          ${paginas.some(p => /^branco_/.test(p.papel)) ? '<div class="mt-av verde">Máscara de branco: fica no arquivo de impressão e não aparece na prova do cliente.</div>' : ''}
          ${(g.ordem || []).includes('faca') && !pFaca ? '<div class="mt-av amarelo">Este gabarito tem faca, mas nenhuma página foi marcada como <b>Faca</b>: o cliente não vai ver a linha de corte.</div>' : ''}
          ${(g.ordem || []).some(x => x.startsWith('verniz')) && !pVF && !pVV ? '<div class="mt-av amarelo">Este gabarito tem verniz, mas nenhuma página foi marcada como <b>Verniz</b>: o cliente não vai ver onde vai o verniz.</div>' : ''}
          ${teste ? `<p class="small" style="margin:8px 0 0">${tamErrado ? `<b>O arquivo não está no tamanho ${g.modo === 'livre' ? 'informado' : 'do gabarito'}.</b>`+' Peça um novo arquivo ao cliente ou passe para a designer ajustar.' : avisos.length ? 'Confira os avisos acima antes de liberar.' : '<b>O arquivo está dentro do gabarito.</b>'}${!tamErrado && direto && direto.arte ? ' Se estiver tudo certo, use <b>"Usar este arquivo e enviar para a pré-impressão"</b>: a arte fica resolvida pelo vendedor, sem passar pela designer.' : ''}</p>
            ${direto && !direto.arte && direto.motivo ? `<div class="mt-av amarelo">${esc(direto.motivo)}</div>` : ''}` : `<p class="small" style="margin:6px 0 0">A prova vai num <b>PDF só</b> com ${1 + (ve ? 1 : 0) + extras.length} ${1 + (ve ? 1 : 0) + extras.length === 1 ? 'página' : 'páginas'}: frente${ve ? ', verso' : ''}${extras.length ? ` e ${extras.length} ${extras.length === 1 ? 'outra página' : 'outras páginas'}` : ''}${pVF || pVV ? ', mais a máscara de verniz no fim (vira o brilho no link)' : ''}.</p>`}`;
        const figs = res.querySelectorAll('.mt-conf figure');
        figs[0].appendChild(confF); if (confV) figs[1].appendChild(confV);
        if (especiais.length) {
          const cli = res.querySelectorAll('.mt-cliente figure');
          cli[0].appendChild(await desenharProva(fr, analise.frente, false, extrasDe('frente'), 700));
          if (ve && cli[1]) cli[1].appendChild(await desenharProva(ve, analise.verso, false, extrasDe('verso'), 700));
        }
        bt.disabled = false;
        if (bd) bd.disabled = !!tamErrado || enviando;
        // AR3b: arte pronta para impressão (ou teste do arquivo do cliente) mostra aqui a conferência completa
        const finalSel = teste || (m.el.querySelector('[name=mt-tipo]:checked') || {}).value === 'final';
        if (finalSel && window.conferirAvisosArquivos) {
          const vez = (montar.vez = (montar.vez || 0) + 1);
          const box = document.createElement('div'); box.style.marginTop = '12px';
          box.innerHTML = '<div class="small"><b>Conferência do arquivo para impressão</b> <span class="muted">· conferindo resolução, fontes, cor, sangria, QR Code…</span></div>';
          res.appendChild(box);
          const arqs = [...new Set(paginas.filter(p => p.papel).map(p => p.file))];
          const papeisConf = arqs.length === 1 ? paginas.filter(p => p.file === arqs[0]).sort((x, y) => (x.pagina || 0) - (y.pagina || 0)).map(p => p.papel || 'extra') : null;
          window.conferirAvisosArquivos({ files: arqs, urgencia: u, papeis: papeisConf, prova: { largura_mm: fw, altura_mm: fh } }).then(cf => {
            if (vez !== montar.vez || !box.isConnected) return;
            const ext = cf.itens.filter(i => !['tamanho_ok', 'tamanho', 'pag_tamanho'].includes(i.codigo));
            const nv = ext.filter(i => i.nivel === 'vermelho').length, na = ext.filter(i => i.nivel === 'amarelo').length;
            box.innerHTML = `<div class="small"><b>Conferência do arquivo para impressão</b> <span class="muted">· ${nv ? `${nv} ${nv === 1 ? 'problema' : 'problemas'}` : ''}${nv && na ? ' e ' : ''}${na ? `${na} ${na === 1 ? 'alerta' : 'alertas'}` : ''}${!nv && !na ? 'sem alertas' : ''}${teste ? '' : ' (a prévia com as marcações abre ao enviar)'}</span></div>`
              + ext.filter(i => i.nivel !== 'verde' || i.codigo === 'dpi').map(i => `<div class="mt-av ${i.nivel === 'info' ? 'verde' : i.nivel}">${esc(i.texto)}${i.link ? ` <a href="${esc(i.link)}" target="_blank" rel="noopener">abrir</a>` : ''}</div>`).join('');
          }).catch(() => { if (box.isConnected) box.remove(); });
        }
      } catch (e) {
        console.error(e);
        res.innerHTML = '<div class="mt-av vermelho">Não foi possível montar a prova com esse arquivo. Tente exportar de novo em PDF.</div>';
      }
    }

    // AR4 caminho direto: o arquivo testado vira o arquivo para impressão (conferência antes de subir)
    if (teste && direto && direto.arte) $m('[data-direto]').onclick = async () => {
      if (enviando || !analise.frente) return;
      const arqs = [...new Set(paginas.filter(p => p.papel).map(p => p.file))];
      if (!arqs.length) return;
      const papeisConf = arqs.length === 1 ? paginas.filter(p => p.file === arqs[0]).sort((x, y) => (x.pagina || 0) - (y.pagina || 0)).map(p => p.papel || 'extra') : null;
      const conf = await window.conferirArquivosParaImpressao({ files: arqs, urgencia: u, papeis: papeisConf,
        prova: { largura_mm: analise.frente.fw, altura_mm: analise.frente.fh }, titulo: 'Conferência do arquivo do cliente',
        limiteMb: (typeof S !== 'undefined' && S.cache.gabaritos && S.cache.gabaritos.dados && S.cache.gabaritos.dados.limite_mb) || 100 });
      if (!conf) return;
      const bd = $m('[data-direto]'), st = $m('#mt-dst');
      enviando = true; bd.disabled = true; bd.textContent = 'Enviando…';
      try {
        const r = await opts.aoUsar(direto.arte, arqs, conf, t => { if (st) st.textContent = t; });
        if (r) { m.fechar(); return; }
      } catch (e) { toast(e.message || 'Não foi possível enviar o arquivo.', true); }
      enviando = false; bd.disabled = false; bd.textContent = 'Usar este arquivo e enviar para a pré-impressão'; if (st) st.textContent = '';
    };
    if (!teste) $m('[data-enviar]').onclick = async () => {
      if (enviando) return;
      const fr = paginas.find(p => p.papel === 'frente'), ve = paginas.find(p => p.papel === 'verso');
      const extras = paginas.filter(p => p.papel === 'extra');
      if (!fr || !analise.frente) return;
      const final = (m.el.querySelector('[name=mt-tipo]:checked') || {}).value === 'final';
      if (final && digital && !folha && !(await confirmar('Este item vai para a impressão digital e você não anexou a folha montada. Enviar mesmo assim, com o arquivo da peça como arquivo para impressão?', 'Enviar assim'))) return;
      if (final && digital && folha && !folha.ok && !(await confirmar('A folha montada não tem o tamanho da A4 (220 × 320 mm) nem da SRA3 (320 × 450 mm). Enviar mesmo assim?', 'Enviar assim'))) return;
      // AR3b: arte pronta para impressão passa pela conferência do arquivo antes de subir
      let conf = null;
      if (final) {
        const comFolha = !!(digital && folha);
        const arqsConf = comFolha ? [folha.file] : [...new Set(paginas.filter(p => p.papel).map(p => p.file))];
        const papeisConf = !comFolha && arqsConf.length === 1
          ? paginas.filter(p => p.file === arqsConf[0]).sort((x, y) => (x.pagina || 0) - (y.pagina || 0)).map(p => p.papel || 'extra') : null;
        conf = await window.conferirArquivosParaImpressao({ files: arqsConf, urgencia: u, folha: comFolha, papeis: papeisConf,
          prova: { largura_mm: analise.frente.fw, altura_mm: analise.frente.fh }, titulo: 'Conferência da arte pronta para impressão',
          limiteMb: (typeof S !== 'undefined' && S.cache.gabaritos && S.cache.gabaritos.dados && S.cache.gabaritos.dados.limite_mb) || 100 });
        if (!conf) return;
      }
      const bt = $m('[data-enviar]'); enviando = true; bt.disabled = true; bt.textContent = 'Gerando a prova…';
      try {
        const faixa = !!($m('#mt-faixa') && $m('#mt-faixa').checked);
        const lista = [{ p: fr, an: analise.frente, papel: 'frente' }].concat(ve ? [{ p: ve, an: analise.verso, papel: 'verso' }] : [], extras.map((p, i) => ({ p, an: analise.extras[i], papel: 'extra' })));
        const canv = [], papeis = [];
        for (const x of lista) {
          canv.push({ c: await desenharProva(x.p, x.an, faixa, x.papel === 'extra' ? null : extrasDe(x.papel)), wmm: x.an.fw, hmm: x.an.fh });
          papeis.push(x.papel);
        }
        // máscaras de verniz no fim do PDF (a página do cliente usa para o brilho animado e o 3D)
        for (const [papel, an] of [['verniz_frente', analise.vf], ['verniz_verso', analise.vv]]) {
          const pm = paginas.find(p => p.papel === papel);
          if (pm && an && (papel === 'verniz_frente' || ve)) { canv.push({ c: await desenharMascara(pm, an), wmm: an.fw, hmm: an.fh }); papeis.push(papel); }
        }
        const usadas = paginas.filter(p => p.papel);
        const base = String(a.item_descricao || 'arte').replace(/[\\/:*?"<>|]+/g, ' ').slice(0, 80).trim();
        const pdf = await montarPdf(canv);
        bt.textContent = 'Enviando ao Drive…';
        const idP = await enviarArquivoDrive(a.pedido_id, new File([pdf], `Prova - ${base}.pdf`, { type: 'application/pdf' }),
                                             'prova', a.item_id, 'Prova', null, null, { arte_id: a.id });
        // arte pronta para impressão: o(s) arquivo(s) original(is) sobem como arte final, ligados a esta arte
        const producao = [];
        if (final && digital && folha) {
          bt.textContent = `Enviando a folha montada: ${folha.file.name}…`;
          producao.push(await enviarArquivoDrive(a.pedido_id, folha.file, 'producao', a.item_id, 'Folha montada', null, null, { arte_id: a.id }));
        } else if (final) {
          const arqs = [...new Set(usadas.map(p => p.file))];
          const NOME_PAPEL = { frente: 'Frente', verso: 'Verso', faca: 'Faca', verniz_frente: 'Verniz frente', verniz_verso: 'Verniz verso', branco_frente: 'Branco frente', branco_verso: 'Branco verso', extra: 'Outra página' };
          for (const f of arqs) { bt.textContent = `Enviando a arte final: ${f.name}…`;
            // o sistema renomeia para "<material> - <identificação>": a identificação diz o que tem no arquivo
            const nomes = [...new Set(usadas.filter(p => p.file === f).map(p => NOME_PAPEL[p.papel] || ''))].filter(Boolean);
            const rot = arqs.length === 1 && nomes.length > 1 ? 'Arte final' : nomes.join(' e ') || 'Arte final';
            producao.push(await enviarArquivoDrive(a.pedido_id, f, 'producao', a.item_id, rot, null, null, { arte_id: a.id })); }
        }
        const avisos = [...analise.frente.avisos, ...(analise.verso ? analise.verso.avisos : []), ...analise.extras.flatMap(x => x.avisos)].map(x => x.txt);
        const r = await api('prova_registrar', { arte_id: a.id, frente_id: idP, verso_id: null, formato: 'pdf', paginas: canv.length, tem_verso: !!ve, papeis,
          modo: ($m('#mt-3d') && $m('#mt-3d').checked) ? '3d' : 'imagem', final, producao_ids: producao,
          largura_mm: analise.frente.fw, altura_mm: analise.frente.fh, avisos });
        if (conf) {
          try { await api('conferencia_registrar', { arte_id: a.id, arquivo_ids: producao, origem: 'arte_pronta', ...conf }, true); }
          catch (e) { toast('A prova foi enviada, mas a conferência do arquivo não ficou registrada: ' + e.message, true); }
        }
        r.final = final; r.pdfUrl = URL.createObjectURL(pdf);
        mostrarLink(r, canv[0].c);
      } catch (e) {
        console.error(e);
        if (e && e.message) toast(e.message, true);
        bt.disabled = false; bt.textContent = 'Enviar prova ao cliente'; enviando = false;
      }
    };

    function mostrarLink(r, cF) {
      const link = location.origin + location.pathname + '#/prova/' + r.chave;
      const nome = (a.cliente_nome || '').split(' ')[0];
      const msg = `Olá${nome ? ', ' + nome : ''}! Segue a prova do seu pedido ${a.pedido_numero} (${a.item_descricao}) para conferir e aprovar:\n${link}\n\nÉ só abrir o link, conferir com calma e clicar em Aprovar (ou pedir alteração).`;
      const zap = a.cliente_whatsapp ? `https://wa.me/${String(a.cliente_whatsapp).replace(/\D/g, '')}?text=${encodeURIComponent(msg)}` : '';
      const corpo = $m('.modal-corpo');
      corpo.innerHTML = $m('.modal-corpo style').outerHTML + `
        <div class="mt-av verde" style="margin-bottom:12px">Prova v${r.versao} enviada. A arte passou para <b>Em aprovação</b>.${r.final ? ' Como é a <b>arte pronta para impressão</b>, quando o cliente aprovar ela já fica pronta e o item segue para a pré-impressão se o pedido tiver pagamento.' : ' Depois da aprovação, feche o arquivo para impressão.'}</div>
        <label class="campo">Link de aprovação do pedido ${esc(a.pedido_numero)} <span class="muted">(sempre o mesmo para o pedido)</span>
          <input type="text" readonly value="${esc(link)}" id="mt-link"></label>
        <label class="campo" style="margin-top:10px">Mensagem para o cliente<textarea rows="4" id="mt-msg">${esc(msg)}</textarea></label>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">
          <button class="btn prim" id="mt-copiar">Copiar mensagem</button>
          ${zap ? `<a class="btn" href="${esc(zap)}" target="_blank" rel="noopener">Abrir no WhatsApp</a>` : '<span class="small muted" style="align-self:center">Cliente sem WhatsApp no cadastro.</span>'}
          <a class="btn" id="mt-baixar" download="prova.pdf">Baixar a prova (PDF)</a>
        </div>`;
      $m('#mt-baixar').href = r.pdfUrl || cF.toDataURL('image/jpeg', 0.84);
      $m('#mt-copiar').onclick = async () => {
        const t = $m('#mt-msg').value;
        try { await navigator.clipboard.writeText(t); } catch (e) { $m('#mt-msg').select(); document.execCommand('copy'); }
        toast('Mensagem copiada.');
      };
      const bt = $m('[data-enviar]'); if (bt) bt.remove();
      $m('[data-v]').onclick = () => { m.fechar(); recarregar(); };
    }
  };

  /* =====================================================================
     AR3b (23/10) — CONFERÊNCIA DO ARQUIVO PARA IMPRESSÃO
     Roda no "Enviar arquivo para impressão" (fechar a arte) e no "Arte pronta para impressão" do montador.
     Só avisa e registra: nada trava. Vermelho pede "Enviar mesmo assim" com motivo.
     Confere no PDF: tamanho (com o gabarito do item), sangria e filete branco no corte, conteúdo na margem de
     segurança, resolução das imagens, páginas, fontes não convertidas, indício de RGB e QR Code (link para conferir).
     Arquivo que o navegador não lê (CDR, AI, ZIP…), acima do limite ou item sem gabarito com medidas: checklist curto.
     ===================================================================== */
  const JSQR = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js';
  const MAX_PAG_CONF = 8;        // páginas conferidas por arquivo
  const LADO_ANALISE = 1800;     // px do lado maior para ler os pixels
  let carregandoQr = null;
  function carregarJsQr() {
    if (window.jsQR) return Promise.resolve(true);
    carregandoQr = carregandoQr || new Promise(ok => {
      const s = document.createElement('script'); s.src = JSQR;
      s.onload = () => ok(true); s.onerror = () => { carregandoQr = null; ok(false); };
      document.head.appendChild(s);
    });
    return carregandoQr;
  }
  const LADOS = { topo: 'de cima', base: 'de baixo', esq: 'da esquerda', dir: 'da direita' };

  // Gabarito do item no formato da conferência (null = sem gabarito com medidas)
  function gabaritoConferencia(u, prova) {
    const gm = u && u.gabarito_medidas;
    if (!gm || gm.medidas_pendentes) return null;
    const g = { nome: [u.grupo_nome, u.gabarito_nome].filter(Boolean).join(' — '), s: +gm.sangria_mm || 0, seg: +gm.seguranca_mm || 0,
                gira: !!gm.aceita_girar, faca: !!gm.ultima_pagina_faca, paginas: gm.paginas || null, dpi: gm.dpi_min ? +gm.dpi_min : null,
                ordem: Array.isArray(gm.paginas_ordem) && gm.paginas_ordem.length ? gm.paginas_ordem : null,
                regras: gm.regras && typeof gm.regras === 'object' ? gm.regras : null };
    if (g.ordem && g.ordem.includes('faca')) g.faca = true;
    if (!gm.tamanho_livre) {
      Object.assign(g, { modo: 'fixo', w: +gm.corte_largura_mm, h: +gm.corte_altura_mm });
      if (g.regras && g.regras.modo === 'area') Object.assign(g, { modo: 'area', nomeArea: `área útil do ${u.gabarito_nome || 'gabarito'}` });
    } else if (prova && prova.largura_mm && prova.altura_mm) {
      Object.assign(g, { modo: 'definido', w: +prova.largura_mm, h: +prova.altura_mm, medidaDaProva: true });
    } else g.modo = 'livre';
    return g;
  }
  // Quais páginas são arte (frente/verso) e quais são faca/máscara
  function papeisDasPaginas(n, g, papeis) {
    if (Array.isArray(papeis) && papeis.length === n) return papeis.map(p => p || 'extra');
    if (g && g.ordem && g.ordem.length === n) return g.ordem.slice();
    return Array.from({ length: n }, (_, i) => g && g.faca && n > 1 && i === n - 1 ? 'faca' : (i === 0 ? 'frente' : i === 1 ? 'verso' : 'extra'));
  }
  const ehArte = p => p === 'frente' || p === 'verso' || p === 'extra';

  // Perfil de branco por profundidade a partir de uma borda: fração de pixels brancos em cada linha paralela à borda
  function perfilBorda(px, W, H, lado, ate, ini, fim) {
    const out = [], passo = Math.max(1, Math.floor((fim - ini) / 500));
    for (let d = 0; d < ate; d++) {
      let b = 0, t = 0;
      for (let q = ini; q < fim; q += passo) {
        const x = lado === 'esq' ? d : lado === 'dir' ? W - 1 - d : q;
        const y = lado === 'topo' ? d : lado === 'base' ? H - 1 - d : q;
        const i = (y * W + x) * 4;
        if (px[i] > 238 && px[i + 1] > 238 && px[i + 2] > 238) b++;
        t++;
      }
      out.push(t ? b / t : 1);
    }
    return out;
  }
  // "Detalhe" de uma faixa: fração de pixels que fogem da cor mediana (texto, logo, foto)
  function detalheFaixa(px, W, H, lado, d0, d1, ini, fim) {
    const lum = [], passo = Math.max(1, Math.floor((fim - ini) / 400));
    for (let d = d0; d < d1; d++) for (let q = ini; q < fim; q += passo) {
      const x = lado === 'esq' ? d : lado === 'dir' ? W - 1 - d : q;
      const y = lado === 'topo' ? d : lado === 'base' ? H - 1 - d : q;
      const i = (y * W + x) * 4;
      lum.push(0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]);
    }
    if (lum.length < 20) return 0;
    const ord = lum.slice().sort((a, b) => a - b), med = ord[ord.length >> 1];
    return lum.filter(v => Math.abs(v - med) > 45).length / lum.length;
  }
  const media = (a, i0, i1) => { const s = a.slice(Math.max(0, i0), Math.max(i0 + 1, i1)); return s.length ? s.reduce((x, y) => x + y, 0) / s.length : 1; };
  // retângulo (px) de uma faixa junto a um lado
  function caixaFaixa(lado, d0, d1, W, H) {
    return lado === 'topo' ? [0, d0, W, d1 - d0] : lado === 'base' ? [0, H - d1, W, d1 - d0]
         : lado === 'esq' ? [d0, 0, d1 - d0, H] : [W - d1, 0, d1 - d0, H];
  }

  // Sangria, filete branco e conteúdo na margem de segurança (pixels da página)
  function conferirBordas(c, k, s, seg, add) {
    const W = c.width, H = c.height, px = c.getContext('2d').getImageData(0, 0, W, H).data;
    const sp = Math.round(s * k), mm1 = Math.max(2, Math.round(k)), segp = Math.round((s + seg) * k), semSang = [];
    for (const lado of Object.keys(LADOS)) {
      const comp = lado === 'topo' || lado === 'base' ? W : H;
      const ini = Math.max(sp, 1) + mm1, fim = comp - Math.max(sp, 1) - mm1;
      if (fim - ini < 10) continue;
      const fundo = Math.min(Math.max(segp, sp + 2 * mm1), lado === 'topo' || lado === 'base' ? H >> 1 : W >> 1);
      const pf = perfilBorda(px, W, H, lado, fundo, ini, fim);
      if (s > 0 && sp >= 2) {
        const sang = media(pf, 1, sp - 1), dentro = media(pf, sp + 1, sp + 1 + Math.round(1.5 * k));
        if (dentro < 0.7 && sang > 0.85) { semSang.push([lado, caixaFaixa(lado, 0, sp + 1, W, H)]); continue; }
        // filete branco: linha branca perto do corte com cor dos dois lados
        const j0 = Math.max(1, sp - mm1), j1 = Math.min(pf.length - 1, sp + mm1);
        let achou = -1;
        for (let d = j0; d <= j1 && achou < 0; d++) {
          if (pf[d] < 0.85) continue;
          const antes = pf.slice(1, d).some(v => v < 0.5), depois = pf.slice(d + 1, Math.min(pf.length, d + 2 * mm1)).some(v => v < 0.5);
          if (antes && depois) achou = d;
        }
        if (achou >= 0) { add('vermelho', 'filete', `Lado ${LADOS[lado]}: filete branco perto do corte (a ${String(Math.abs(achou - sp) / k).slice(0, 3).replace('.', ',')} mm da linha). No refile ele pode aparecer.`, caixaFaixa(lado, Math.max(0, achou - 2), achou + 3, W, H)); continue; }
      }
      // conteúdo na margem de segurança: faixa entre o corte e a linha verde com detalhe, e a sangria lisa
      if (seg > 0 && segp - sp > 3) {
        const det = detalheFaixa(px, W, H, lado, sp + 1, segp, ini, fim);
        const fora = sp >= 3 ? detalheFaixa(px, W, H, lado, 1, sp, ini, fim) : detalheFaixa(px, W, H, lado, 1, Math.min(segp, mm1 + 1), ini, fim);
        if (det > 0.06 && fora < 0.03) add('amarelo', 'seguranca', `Lado ${LADOS[lado]}: tem conteúdo entre o corte e a margem de segurança (${String(seg).replace('.', ',')} mm). Confira se não é texto ou logo.`, caixaFaixa(lado, sp, segp, W, H));
      }
    }
    if (semSang.length) {
      const lados = semSang.map(x => LADOS[x[0]]), txt = semSang.length === 4 ? 'Nenhum lado tem sangria' : (semSang.length === 1 ? 'Lado ' : 'Lados ') + lados.join(', ').replace(/, ([^,]*)$/, ' e $1') + (semSang.length === 1 ? ' sem sangria' : ' sem sangria');
      add('vermelho', 'sem_sangria', `${txt}: a arte para na linha de corte. Estique o fundo ${String(s).replace('.', ',')} mm para fora do corte.`, semSang.map(x => x[1]));
    }
  }

  // Resolução das imagens: percorre os comandos de desenho da página
  async function imagensDaPagina(pg, vp) {
    const lib = window.pdfjsLib, O = lib.OPS, T = lib.Util.transform;
    const ops = await pg.getOperatorList();
    let ctm = [1, 0, 0, 1, 0, 0]; const pilha = [], imgs = [];
    for (let i = 0; i < ops.fnArray.length; i++) {
      const f = ops.fnArray[i], a = ops.argsArray[i];
      if (f === O.save) pilha.push(ctm);
      else if (f === O.restore) ctm = pilha.pop() || ctm;
      else if (f === O.transform) ctm = T(ctm, a);
      else if (f === O.paintFormXObjectBegin) { pilha.push(ctm); if (Array.isArray(a[0]) && a[0].length === 6) ctm = T(ctm, a[0]); }
      else if (f === O.paintFormXObjectEnd) ctm = pilha.pop() || ctm;
      else if (f === O.paintImageXObject || f === O.paintInlineImageXObject) {
        const wpx = f === O.paintImageXObject ? a[1] : a[0] && a[0].width, hpx = f === O.paintImageXObject ? a[2] : a[0] && a[0].height;
        if (!wpx || !hpx) continue;
        const wpt = Math.hypot(ctm[0], ctm[1]), hpt = Math.hypot(ctm[2], ctm[3]);
        if (wpt * PT_MM < 3 || hpt * PT_MM < 3) continue;
        const dpi = Math.min(wpx / (wpt / 72), hpx / (hpt / 72));
        const cs = [[0, 0], [1, 0], [0, 1], [1, 1]].map(([x, y]) => vp.convertToViewportPoint(ctm[0] * x + ctm[2] * y + ctm[4], ctm[1] * x + ctm[3] * y + ctm[5]));
        const xs = cs.map(p => p[0]), ys = cs.map(p => p[1]);
        imgs.push({ dpi: Math.round(dpi), wmm: wpt * PT_MM, hmm: hpt * PT_MM, caixa: [Math.min(...xs), Math.min(...ys), Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)] });
      }
    }
    return imgs;
  }
  // Textos com fonte viva (não convertidos em curvas)
  async function textosDaPagina(pg, vp) {
    const tc = await pg.getTextContent(), T = window.pdfjsLib.Util.transform, out = [];
    for (const it of tc.items) {
      if (!it.str || !it.str.trim()) continue;
      const tx = T(vp.transform, it.transform), alt = Math.hypot(tx[2], tx[3]);
      out.push({ texto: it.str.trim(), caixa: [tx[4], tx[5] - alt, Math.max(4, it.width * vp.scale), alt] });
    }
    return out;
  }
  // Indício de RGB: procura citações de espaço de cor RGB no arquivo (fora do grupo de transparência)
  async function indicioRgb(file) {
    if (file.size > 60 * 1024 * 1024) return null;
    const buf = new Uint8Array(await file.arrayBuffer()), dec = new TextDecoder('latin1');
    let rgb = 0, cmyk = 0;
    for (let i = 0; i < buf.length; i += 4 * 1024 * 1024) {
      const t = dec.decode(buf.subarray(Math.max(0, i - 16), Math.min(buf.length, i + 4 * 1024 * 1024)));
      rgb += (t.match(/\/(DeviceRGB|CalRGB)/g) || []).length - (t.match(/\/CS\s*\/(DeviceRGB|CalRGB)/g) || []).length;
      cmyk += (t.match(/\/DeviceCMYK/g) || []).length;
    }
    return { rgb: Math.max(0, rgb), cmyk };
  }
  function dpiMinimo(g, fw, fh) {
    if (g && g.dpi) return { min: g.dpi, so_recomendacao: false };
    const rg = g && g.regras && g.regras.dpi_recomendado;
    if (Array.isArray(rg) && rg.length && fw) {
      const maior = Math.max(fw, fh), f = rg.find(x => !x.ate_mm || maior <= x.ate_mm + TOL);
      if (f) return { min: f.dpi, so_recomendacao: true };
    }
    return null;
  }

  // Confere um arquivo. Devolve { nome, lido, itens[], paginas: [{ rotulo, canvas, k, an, marcas[] }] }
  async function conferirArquivo(file, g, opts) {
    const r = { nome: file.name, lido: true, itens: [], paginas: [], nMarcas: 0 };
    const add = (nivel, codigo, texto, pagina, caixa) => {
      const it = { nivel, codigo, texto, arquivo: file.name, pagina: pagina || null };
      r.itens.push(it);
      if (caixa && pagina && r.paginas[pagina - 1]) {
        it.marca = ++r.nMarcas;
        (Array.isArray(caixa[0]) ? caixa : [caixa]).forEach(cx => r.paginas[pagina - 1].marcas.push({ nivel, caixa: cx, n: it.marca }));
      }
      return it;
    };
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    const ehPdf = file.type === 'application/pdf' || ext === 'pdf', ehImg = /^(jpe?g|png|webp)$/.test(ext);
    if (opts.limiteMb && file.size > opts.limiteMb * 1024 * 1024) {
      r.lido = false; add('amarelo', 'grande', `Arquivo com ${(file.size / 1048576).toFixed(0)} MB: passa de ${opts.limiteMb} MB e não foi conferido automaticamente. Use o checklist.`); return r;
    }
    if (!ehPdf && !ehImg) {
      r.lido = false;
      add('amarelo', 'nao_lido', ext === 'cdr' ? 'Arquivo CorelDRAW (.cdr): a conferência automática ainda não lê CDR. Use o checklist (ou exporte em PDF para conferir).'
                                              : `Arquivo .${ext}: a conferência automática só lê PDF e imagem. Use o checklist.`);
      return r;
    }
    if (ehImg) {
      const img = await carregarImagem(URL.createObjectURL(file));
      const c = document.createElement('canvas'), e = Math.min(1, LADO_ANALISE / Math.max(img.naturalWidth, img.naturalHeight));
      c.width = Math.round(img.naturalWidth * e); c.height = Math.round(img.naturalHeight * e); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      r.paginas.push({ rotulo: 'imagem', canvas: c, an: null, k: null, marcas: [] });
      if (g && g.w && g.h) {
        const W = g.w + 2 * g.s, H = g.h + 2 * g.s, dm = dpiMinimo(g, g.w, g.h);
        const dpi = Math.round(Math.min(img.naturalWidth / (W / 25.4), img.naturalHeight / (H / 25.4)));
        const pi = img.naturalWidth / img.naturalHeight, pg0 = W / H;
        const mesma = Math.abs(pi / pg0 - 1) <= 0.03, girada = Math.abs(pi * pg0 - 1) <= 0.03;
        if (!mesma && !(girada && g.gira)) add('vermelho', 'tamanho', girada ? `A imagem está girada em relação ao gabarito (${mm(W)} × ${mm(H)} mm com sangria).`
                                                                              : `A imagem não tem a proporção do gabarito (${mm(W)} × ${mm(H)} mm com sangria).`, 1);
        if (dm && dpi < dm.min * 0.95) add(dpi < dm.min * 0.6 && !dm.so_recomendacao ? 'vermelho' : 'amarelo', 'dpi', `Imagem com ${dpi} dpi no tamanho final (${dm.so_recomendacao ? 'recomendado' : 'mínimo'} ${dm.min} dpi).`, 1);
        else add('verde', 'dpi', `Imagem com ${dpi} dpi no tamanho final.`, 1);
      }
      add('amarelo', 'imagem', 'Arquivo em imagem (JPG/PNG): confira se as cores estão em CMYK; o PDF é o formato mais seguro para a gráfica.');
      return r;
    }
    await carregarPdfJs();
    let doc;
    try { doc = await window.pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise; }
    catch (e) { r.lido = false; add('vermelho', 'pdf_invalido', 'O PDF não abriu (arquivo corrompido ou protegido). Exporte de novo.'); return r; }
    const n = doc.numPages, papeis = papeisDasPaginas(n, g, opts.papeis);
    if (!opts.folha && g && g.paginas && n !== g.paginas) add('amarelo', 'paginas', `O arquivo tem ${n} ${n === 1 ? 'página' : 'páginas'}; o gabarito pede ${g.paginas}.`);
    if (n > MAX_PAG_CONF) add('amarelo', 'paginas_demais', `Foram conferidas as ${MAX_PAG_CONF} primeiras de ${n} páginas.`);
    const qrOk = await carregarJsQr();
    let w0 = null, h0 = null, nTextos = 0, exTexto = '', menorDpi = null;
    const dm0 = [];
    for (let p = 1; p <= Math.min(n, MAX_PAG_CONF); p++) {
      const pg = await doc.getPage(p), vp1 = pg.getViewport({ scale: 1 });
      const wmm = vp1.width * PT_MM, hmm = vp1.height * PT_MM, papel = papeis[p - 1], arte = ehArte(papel);
      const k = LADO_ANALISE / Math.max(wmm, hmm), vp = pg.getViewport({ scale: k * PT_MM });
      const c = document.createElement('canvas'); c.width = Math.round(vp.width); c.height = Math.round(vp.height);
      const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
      await pg.render({ canvasContext: ctx, viewport: vp }).promise;
      const rot = { frente: 'Frente', verso: 'Verso', faca: 'Faca', verniz_frente: 'Verniz da frente', verniz_verso: 'Verniz do verso', branco_frente: 'Branco da frente', branco_verso: 'Branco do verso' }[papel] || `Página ${p}`;
      const pag = { rotulo: n === 1 ? 'Arte' : `${rot} (pág. ${p})`, canvas: c, k, an: null, marcas: [] };
      r.paginas.push(pag);
      if (w0 == null) { w0 = wmm; h0 = hmm; }
      else if (!perto(wmm, w0) || !perto(hmm, h0)) {
        if (!(perto(wmm, h0) && perto(hmm, w0) && g && g.gira)) add('amarelo', 'pag_tamanho', `A página ${p} tem ${mm(wmm)} × ${mm(hmm)} mm, diferente da 1ª página (${mm(w0)} × ${mm(h0)} mm).`, p);
      }
      if (opts.folha) {
        if (p === 1) {
          const f = folhaDigital(wmm, hmm);
          if (f) add('verde', 'folha', `Folha ${f[0]}: ${mm(wmm)} × ${mm(hmm)} mm.`, 1);
          else add('vermelho', 'folha', `A folha tem ${mm(wmm)} × ${mm(hmm)} mm: não é A4 (220 × 320) nem SRA3 (320 × 450).`, 1);
        }
      } else if (g && g.modo !== 'livre' && arte) {
        const an = analisar({ fonte: 'pdf', w: wmm, h: hmm }, g);
        pag.an = an;
        an.avisos.forEach(a => add(a.nivel, a.nivel === 'verde' ? 'tamanho_ok' : 'tamanho', (n > 1 ? `${rot}: ` : '') + a.txt, p));
        if (!an.avisos.some(a => a.nivel !== 'verde') && !an.area) add('verde', 'tamanho_ok', `${n > 1 ? rot + ': ' : ''}Tamanho confere (${mm(an.fw)} × ${mm(an.fh)} mm final${an.s ? `, sangria ${String(an.s).replace('.', ',')} mm` : ''}).`, p);
        if (an.encaixe === 'corte' && !an.area) conferirBordas(c, k, an.s, an.seg || 0, (nv, cod, txt, cx) => add(nv, cod, (n > 1 ? `${rot}: ` : '') + txt, p, cx));
      }
      // fontes vivas
      const txs = await textosDaPagina(pg, vp);
      if (txs.length) {
        nTextos += txs.length; if (!exTexto) exTexto = txs.map(t => t.texto).join(' ').slice(0, 60);
        txs.slice(0, 40).forEach(t => pag.marcas.push({ nivel: 'texto', caixa: t.caixa }));
      }
      // resolução
      const dmPag = dpiMinimo(g, pag.an ? pag.an.fw : null, pag.an ? pag.an.fh : null);
      for (const im of await imagensDaPagina(pg, vp)) {
        if (menorDpi == null || im.dpi < menorDpi) menorDpi = im.dpi;
        if (!dmPag) continue;
        const ruim = im.dpi < dmPag.min * 0.6 && !dmPag.so_recomendacao, baixo = im.dpi < dmPag.min * 0.95;
        if (ruim || baixo) dm0.push({ p, im, nivel: ruim ? 'vermelho' : 'amarelo', min: dmPag.min, rec: dmPag.so_recomendacao });
      }
      // QR Code
      if (qrOk && window.jsQR && arte) {
        try {
          // o leitor acerta melhor em tamanhos médios: tenta reduzido (900 px) e depois no tamanho da análise
          let q = null, esc2 = 1;
          for (const lado of [900, LADO_ANALISE]) {
            const e = Math.min(1, lado / Math.max(c.width, c.height)), t = document.createElement('canvas');
            t.width = Math.round(c.width * e); t.height = Math.round(c.height * e); t.getContext('2d').drawImage(c, 0, 0, t.width, t.height);
            const d = t.getContext('2d').getImageData(0, 0, t.width, t.height);
            q = window.jsQR(d.data, t.width, t.height, { inversionAttempts: 'attemptBoth' });
            if (q && q.data) { esc2 = 1 / e; break; }
          }
          if (q && q.data) {
            const L = q.location, xs = [L.topLeftCorner.x, L.topRightCorner.x, L.bottomLeftCorner.x, L.bottomRightCorner.x].map(v => v * esc2), ys = [L.topLeftCorner.y, L.topRightCorner.y, L.bottomLeftCorner.y, L.bottomRightCorner.y].map(v => v * esc2);
            const it = add('info', 'qr', `QR Code ${n > 1 ? `(${rot}) ` : ''}leva para: ${q.data.slice(0, 200)} — abra e confira se é o certo.`, p,
                           [Math.min(...xs), Math.min(...ys), Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)]);
            it.link = /^https?:\/\//i.test(q.data) ? q.data : null;
            pag.marcas[pag.marcas.length - 1].nivel = 'qr';
          }
        } catch (e) { /* QR é só ajuda */ }
      }
    }
    // resolução: um aviso por página com a pior imagem
    const porPag = {};
    dm0.forEach(x => { if (!porPag[x.p] || x.im.dpi < porPag[x.p].im.dpi) porPag[x.p] = x; });
    Object.values(porPag).forEach(x => {
      const qtd = dm0.filter(y => y.p === x.p).length;
      add(x.nivel, 'dpi', `${n > 1 ? `Pág. ${x.p}: ` : ''}${qtd > 1 ? `${qtd} imagens abaixo de ${x.min} dpi; a pior` : 'Imagem'} com ${x.im.dpi} dpi (${x.rec ? 'recomendado' : 'mínimo'} ${x.min} dpi), ${mm(x.im.wmm)} × ${mm(x.im.hmm)} mm.`, x.p, x.im.caixa);
    });
    if (!dm0.length && menorDpi != null) add('verde', 'dpi', `Resolução das imagens: a menor tem ${menorDpi} dpi.`);
    if (nTextos) add('amarelo', 'fontes', `Texto com fonte não convertida em curvas (${nTextos} ${nTextos === 1 ? 'trecho' : 'trechos'}), ex.: "${exTexto}". Converta em curvas para não trocar a fonte na gráfica. (Os textos estão marcados em azul.)`);
    const rgb = await indicioRgb(file).catch(() => null);
    if (rgb && rgb.rgb > 0) add('amarelo', 'rgb', `Indício de cor RGB: o arquivo cita RGB ${rgb.rgb} ${rgb.rgb === 1 ? 'vez' : 'vezes'}${rgb.cmyk ? ` (e CMYK ${rgb.cmyk})` : ''}. Confira se a arte foi exportada em CMYK.`);
    return r;
  }

  // Desenha a página com corte (vermelho), sangria sombreada, segurança (verde) e as caixas numeradas dos avisos
  function desenharMarcas(pag, foco) {
    const b = pag.canvas, c = document.createElement('canvas'); c.width = b.width; c.height = b.height;
    const ctx = c.getContext('2d'); ctx.drawImage(b, 0, 0);
    if (pag.an && pag.an.encaixe === 'corte' && !pag.an.area && pag.k) linhas(ctx, pag.k, pag.an.s, pag.an.seg || 0, c.width, c.height);
    const lw = Math.max(2, Math.max(c.width, c.height) / 220);
    for (const mk of pag.marcas) {
      const [x, y, w, h] = mk.caixa, cor = mk.nivel === 'vermelho' ? '#D0302A' : mk.nivel === 'amarelo' ? '#E08A00' : mk.nivel === 'qr' ? '#2F6F9F' : 'rgba(47,111,159,.75)';
      ctx.save(); ctx.strokeStyle = cor; ctx.lineWidth = mk.n && mk.n === foco ? lw * 2.5 : mk.nivel === 'texto' ? lw * 0.6 : lw;
      if (mk.nivel === 'texto') ctx.setLineDash([lw * 2, lw * 1.5]);
      ctx.strokeRect(x, y, w, h);
      if (mk.n) {
        const r = Math.max(14, Math.max(c.width, c.height) / 30), cx = Math.min(c.width - r, Math.max(r, x + w / 2)), cy = Math.min(c.height - r, Math.max(r, y + h / 2));
        ctx.setLineDash([]); ctx.fillStyle = cor; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.font = `bold ${Math.round(r * 1.2)}px Arial`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(mk.n), cx, cy + 1);
      }
      ctx.restore();
    }
    return c;
  }

  /* Tela da conferência. Devolve null (voltar) ou { resultado, itens, checklist, motivo }.
     opts: { files, urgencia, prova, papeis, folha, titulo, limiteMb } */
  // Só os avisos (sem janela): usado dentro do montador quando é arte pronta para impressão ou teste do arquivo do cliente
  window.conferirAvisosArquivos = async function (opts) {
    const g = gabaritoConferencia(opts.urgencia || {}, opts.prova), itens = [];
    for (const f of opts.files) {
      try { (await conferirArquivo(f, g, { papeis: opts.papeis, limiteMb: opts.limiteMb || 100 })).itens.forEach(i => itens.push(i)); }
      catch (e) { itens.push({ nivel: 'amarelo', codigo: 'falha', texto: `${f.name}: não foi possível conferir automaticamente.`, arquivo: f.name }); }
    }
    return { itens, semGabarito: !g };
  };
  window.conferirArquivosParaImpressao = async function (opts) {
    const u = opts.urgencia || {}, g = opts.folha ? null : gabaritoConferencia(u, opts.prova);
    const m = abrirModal({ titulo: opts.titulo || 'Conferência do arquivo para impressão', largo: true, corpo: '<p class="small muted" style="margin:0">Conferindo o arquivo… (pode levar alguns segundos)</p>',
      rodape: '<button class="btn" data-v>Voltar</button>' });
    let fechado = false; m.el.querySelector('[data-v]').onclick = () => { fechado = true; m.fechar(); };
    const res = [];
    for (const f of opts.files) {
      if (fechado) return null;
      try { res.push(await conferirArquivo(f, g, { papeis: opts.papeis, folha: opts.folha, limiteMb: opts.limiteMb || 100 })); }
      catch (e) { console.error(e); res.push({ nome: f.name, lido: false, paginas: [], itens: [{ nivel: 'amarelo', codigo: 'falha', texto: 'Não foi possível conferir este arquivo automaticamente. Use o checklist.', arquivo: f.name }] }); }
    }
    if (fechado || !m.el.isConnected) return null;
    const todos = res.flatMap(r => r.itens);
    const nV = todos.filter(i => i.nivel === 'vermelho').length, nA = todos.filter(i => i.nivel === 'amarelo').length;
    const semGab = !g && !opts.folha, naoLido = res.some(r => !r.lido), precisaChecklist = semGab || naoLido;
    const resultado = nV ? 'erro' : precisaChecklist ? 'checklist' : nA ? 'alerta' : 'ok';
    const icone = { vermelho: '✖', amarelo: '!', verde: '✓', info: 'i' };
    const corpoArq = r => `
      <div class="painel" style="padding:12px 14px;margin:0 0 10px">
        <div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap"><b>${esc(r.nome)}</b>
          <span class="small muted">${r.paginas.length ? `${r.paginas.length} ${r.paginas.length === 1 ? 'página conferida' : 'páginas conferidas'}` : 'não lido'}</span></div>
        <div style="margin-top:8px">${r.itens.map(it => { const num = todos.indexOf(it) + 1; return `
          <div class="mt-av ${it.nivel === 'info' ? 'verde' : it.nivel}" data-it="${num}" style="cursor:${it.marca ? 'pointer' : 'default'};display:flex;gap:8px">
            <b style="min-width:22px">${it.marca || icone[it.nivel] || ''}</b>
            <span>${esc(it.texto)}${it.link ? ` <a href="${esc(it.link)}" target="_blank" rel="noopener">abrir</a>` : ''}</span></div>`; }).join('')}</div>
        ${r.paginas.length ? `<div class="mt-conf" data-figs="${esc(r.nome)}"></div>` : ''}
      </div>`;
    const corpo = m.el.querySelector('.modal-corpo');
    corpo.innerHTML = `
      <style>.mt-conf{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;margin-top:10px}
        .mt-conf figure{margin:0}.mt-conf canvas{width:100%;height:auto;border:1px solid var(--linha);border-radius:6px;background:#fff}
        .mt-conf figcaption{font-size:12px;color:var(--texto-2);margin-bottom:4px}
        .mt-av{font-size:13px;padding:6px 10px;border-radius:8px;margin-top:6px}
        .mt-av.vermelho{background:var(--vermelho-bg);color:var(--vermelho)}.mt-av.amarelo{background:var(--ambar-bg);color:#7d520d}.mt-av.verde{background:var(--verde-bg);color:#007a61}</style>
      <div class="small">${opts.folha ? 'Folha montada para a impressão digital.' : g ? `Gabarito: <b>${esc(g.nome)}</b>${g.medidaDaProva ? ` · tamanho informado na prova: ${mm(g.w)} × ${mm(g.h)} mm` : ''}` : '<b>Item sem gabarito com medidas:</b> confira pelo checklist abaixo.'}</div>
      <div class="mt-av ${nV ? 'vermelho' : nA || precisaChecklist ? 'amarelo' : 'verde'}" style="font-size:14px">
        ${nV ? `<b>${nV} ${nV === 1 ? 'problema' : 'problemas'}</b>${nA ? ` e ${nA} ${nA === 1 ? 'alerta' : 'alertas'}` : ''}. Confira antes de enviar.`
          : nA ? `<b>${nA} ${nA === 1 ? 'alerta' : 'alertas'}</b> para conferir.` : precisaChecklist ? 'Conferência manual: use o checklist.' : '<b>Tudo certo</b> no que o sistema consegue conferir.'}</div>
      ${res.map(corpoArq).join('')}
      <p class="small muted" style="margin:0">Vermelho tracejado = corte · área sombreada = sangria · verde = margem de segurança · números = avisos · azul tracejado = texto com fonte viva. A conferência só avisa: ela não confere ortografia, cores nem se a arte é a do pedido.</p>
      ${precisaChecklist ? `<div class="campo"><b>Checklist</b>
        <label class="check" style="white-space:normal"><input type="checkbox" data-ck="tamanho"> Conferi o tamanho final com o pedido</label>
        <label class="check" style="white-space:normal"><input type="checkbox" data-ck="sangria"> A arte tem sangria (ou o material não precisa)</label>
        <label class="check" style="white-space:normal"><input type="checkbox" data-ck="seguranca"> Textos e logos estão longe do corte</label></div>` : ''}
      ${nV ? `<label class="campo">Motivo para enviar mesmo assim *<input type="text" data-motivo maxlength="300" placeholder="Ex.: o cliente pediu assim / o fornecedor ajusta"></label>` : ''}`;
    res.forEach(r => {
      const box = corpo.querySelector(`[data-figs="${CSS.escape(r.nome)}"]`); if (!box) return;
      r.paginas.forEach((pg, i) => {
        const f = document.createElement('figure'); f.dataset.pag = r.nome + '|' + (i + 1);
        f.innerHTML = `<figcaption>${esc(pg.rotulo)}</figcaption>`; f.appendChild(desenharMarcas(pg)); box.appendChild(f);
      });
    });
    // lista clicável: destaca a caixa do aviso na página
    corpo.querySelectorAll('[data-it]').forEach(el => el.onclick = () => {
      const it = todos[+el.dataset.it - 1]; if (!it || !it.marca) return;
      const r = res.find(x => x.nome === it.arquivo), pg = r && r.paginas[it.pagina - 1], fig = corpo.querySelector(`[data-pag="${CSS.escape(it.arquivo + '|' + it.pagina)}"]`);
      if (!pg || !fig) return;
      fig.querySelector('canvas').replaceWith(desenharMarcas(pg, it.marca));
      fig.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    return new Promise(ok => {
      const rod = m.el.querySelector('.modal-rodape');
      rod.innerHTML = `<button class="btn" data-v>Voltar e trocar o arquivo</button><button class="btn ${nV ? 'perigo' : 'prim'}" data-e>${nV ? 'Enviar mesmo assim' : 'Enviar'}</button>`;
      rod.querySelector('[data-v]').onclick = () => { m.fechar(); ok(null); };
      rod.querySelector('[data-e]').onclick = () => {
        let checklist = null;
        if (precisaChecklist) {
          const cks = [...corpo.querySelectorAll('[data-ck]')];
          if (cks.some(c => !c.checked)) return toast('Marque os itens do checklist.', true);
          checklist = Object.fromEntries(cks.map(c => [c.dataset.ck, true]));
        }
        const motivo = nV ? (corpo.querySelector('[data-motivo]').value || '').trim() : null;
        if (nV && !motivo) return toast('Escreva o motivo para enviar mesmo assim.', true);
        m.fechar();
        ok({ resultado, motivo, checklist,
             itens: todos.filter(i => i.nivel !== 'verde').map(i => ({ nivel: i.nivel, codigo: i.codigo, texto: i.texto.slice(0, 300), arquivo: i.arquivo, pagina: i.pagina })) });
      };
    });
  };

})();
