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
   (19/10) Gabarito "cabe na área" (regras.modo = area: impressão digital A4/SRA3 — o arquivo precisa caber na área útil,
   em pé ou deitado); avisos de tamanho máximo e resolução recomendada no tamanho livre (lona, faixa e banner);
   item com selo Digital: na arte pronta para impressão, a designer anexa a FOLHA MONTADA (A4 22×32 ou SRA3 32×45),
   que vai como arquivo de impressão; a prova do cliente continua sendo a peça.
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
                  ['verniz_frente', 'Verniz da frente'], ['verniz_verso', 'Verniz do verso'], ['extra', 'Outra página']];
  const UNICOS = ['frente', 'verso', 'faca', 'verniz_frente', 'verniz_verso'];
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
        av.push({ nivel: 'vermelho', txt: `A arte está girada em relação ao gabarito (veio ${mm(p.w)} × ${mm(p.h)} mm; o gabarito é ${mm(W)} × ${mm(H)} mm).` });
      } else {
        av.push({ nivel: 'vermelho', txt: `Tamanho diferente do gabarito: o arquivo tem ${mm(p.w)} × ${mm(p.h)} mm; o gabarito pede ${mm(W + 2 * s)} × ${mm(H + 2 * s)} mm (com sangria) ou ${mm(W)} × ${mm(H)} mm (final).` });
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
      // mostra a área do gabarito com a arte encaixada no meio
      const k = LADO_CONF / Math.max(a.fw, a.fh);
      c.width = Math.round(a.fw * k); c.height = Math.round(a.fh * k);
      const ctx = c.getContext('2d'); ctx.fillStyle = '#f1f3f4'; ctx.fillRect(0, 0, c.width, c.height);
      const esc_ = Math.min(c.width / base.width, c.height / base.height);
      const w = base.width * esc_, h = base.height * esc_;
      ctx.drawImage(base, (c.width - w) / 2, (c.height - h) / 2, w, h);
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
      } else { // conter
        const base = await rasterizar(p, p.fonte === 'pdf' ? k : 1);
        const e = Math.min(c.width / base.width, c.height / base.height);
        ctx.drawImage(base, (c.width - base.width * e) / 2, (c.height - base.height * e) / 2, base.width * e, base.height * e);
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
    const teste = !!(opts && opts.teste);
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
      : g.modo === 'livre' ? `<b>${nomeGab}</b> · tamanho livre (vem do arquivo) · sangria ${mm(g.s)} · segurança ${mm(g.seg)} mm`
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
      ${teste ? `<div class="mt-av amarelo" style="margin:0 0 10px">Só um teste: o arquivo é conferido aqui na tela, contra o gabarito do item. <b>Nada é salvo nem enviado ao cliente.</b></div>` : ''}
      <div class="campo" style="margin-bottom:10px;${teste ? 'display:none' : ''}">O que você está enviando ao cliente?
        <label class="caixa-linha" style="margin-top:6px"><input type="radio" name="mt-tipo" value="prova" checked>
          <span><b>Só a prova</b><br><span class="small muted">Depois que o cliente aprovar, você fecha o arquivo para impressão.</span></span></label>
        <label class="caixa-linha" style="margin-top:6px"><input type="radio" name="mt-tipo" value="final">
          <span><b>Arte pronta para impressão</b><br><span class="small muted">O arquivo que você escolher aqui já é o final. Quando o cliente aprovar, a arte fica pronta e o item segue para a pré-impressão se o pedido tiver pagamento (ou autorização).</span></span></label>
      </div>
      ${digital && !teste ? `<div class="mt-av amarelo" id="mt-dig" style="margin:0 0 10px;display:none"><b>Item na impressão digital</b>${u.digital.motivo ? ` (${esc(u.digital.motivo)})` : ''}. Monte a folha (A4 22 × 32 cm ou SRA3 32 × 45 cm) e anexe aqui: ela vai como <b>arquivo para impressão</b>. O cliente vê só a prova da peça.
        <label class="campo" style="margin:8px 0 0">Folha montada (PDF)<input type="file" id="mt-folha" accept=".pdf,application/pdf"></label><div id="mt-folha-st" class="small" style="margin-top:4px"></div></div>` : ''}
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
      rodape: `<button class="btn" data-v style="margin-right:auto">Fechar</button>${teste ? '' : '<button class="btn prim" data-enviar disabled>Enviar prova ao cliente</button>'}` });
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
    const drop = $m('#mt-drop'), inp = $m('#mt-arq');
    drop.onclick = e => { if (e.target !== inp) inp.click(); };
    ['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('sobre'); }));
    ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('sobre'); }));
    drop.addEventListener('drop', e => { if (e.dataTransfer.files.length) receber([...e.dataTransfer.files]); });
    inp.onchange = () => { if (inp.files.length) receber([...inp.files]); };
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
      const PAPEL_DA_ORDEM = { frente: 'frente', verso: 'verso', verniz_frente: 'verniz_frente', verniz_verso: 'verniz_verso' };
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
      bt.disabled = true; analise = {};
      if (!fr) { res.innerHTML = paginas.length ? '<p class="small muted" style="margin-top:10px">Escolha qual página é a frente.</p>' : ''; return; }
      res.innerHTML = '<p class="small muted" style="margin-top:10px">Montando…</p>';
      const ge = gabaritoEfetivo();
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
          ${(g.ordem || []).includes('faca') && !pFaca ? '<div class="mt-av amarelo">Este gabarito tem faca, mas nenhuma página foi marcada como <b>Faca</b>: o cliente não vai ver a linha de corte.</div>' : ''}
          ${(g.ordem || []).some(x => x.startsWith('verniz')) && !pVF && !pVV ? '<div class="mt-av amarelo">Este gabarito tem verniz, mas nenhuma página foi marcada como <b>Verniz</b>: o cliente não vai ver onde vai o verniz.</div>' : ''}
          ${teste ? `<p class="small" style="margin:8px 0 0">${tamErrado ? '<b>O arquivo não está no tamanho do gabarito.</b> Peça um novo arquivo ao cliente ou passe para a designer ajustar.' : avisos.length ? 'Confira os avisos acima antes de liberar.' : '<b>O arquivo está dentro do gabarito.</b>'}</p>` : `<p class="small" style="margin:6px 0 0">A prova vai num <b>PDF só</b> com ${1 + (ve ? 1 : 0) + extras.length} ${1 + (ve ? 1 : 0) + extras.length === 1 ? 'página' : 'páginas'}: frente${ve ? ', verso' : ''}${extras.length ? ` e ${extras.length} ${extras.length === 1 ? 'outra página' : 'outras páginas'}` : ''}${pVF || pVV ? ', mais a máscara de verniz no fim (vira o brilho no link)' : ''}.</p>`}`;
        const figs = res.querySelectorAll('.mt-conf figure');
        figs[0].appendChild(confF); if (confV) figs[1].appendChild(confV);
        if (especiais.length) {
          const cli = res.querySelectorAll('.mt-cliente figure');
          cli[0].appendChild(await desenharProva(fr, analise.frente, false, extrasDe('frente'), 700));
          if (ve && cli[1]) cli[1].appendChild(await desenharProva(ve, analise.verso, false, extrasDe('verso'), 700));
        }
        bt.disabled = false;
      } catch (e) {
        console.error(e);
        res.innerHTML = '<div class="mt-av vermelho">Não foi possível montar a prova com esse arquivo. Tente exportar de novo em PDF.</div>';
      }
    }

    if (!teste) $m('[data-enviar]').onclick = async () => {
      if (enviando) return;
      const fr = paginas.find(p => p.papel === 'frente'), ve = paginas.find(p => p.papel === 'verso');
      const extras = paginas.filter(p => p.papel === 'extra');
      if (!fr || !analise.frente) return;
      const final = (m.el.querySelector('[name=mt-tipo]:checked') || {}).value === 'final';
      if (final && digital && !folha && !(await confirmar('Este item vai para a impressão digital e você não anexou a folha montada. Enviar mesmo assim, com o arquivo da peça como arquivo para impressão?', 'Enviar assim'))) return;
      if (final && digital && folha && !folha.ok && !(await confirmar('A folha montada não tem o tamanho da A4 (220 × 320 mm) nem da SRA3 (320 × 450 mm). Enviar mesmo assim?', 'Enviar assim'))) return;
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
          const NOME_PAPEL = { frente: 'Frente', verso: 'Verso', faca: 'Faca', verniz_frente: 'Verniz frente', verniz_verso: 'Verniz verso', extra: 'Outra página' };
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
})();
