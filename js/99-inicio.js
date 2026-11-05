/* ---------- inicialização ---------- */
(async () => {
  if (/^#\/cadastro\/?$/.test(location.hash)) { window.removeEventListener('hashchange', rotear); return paginaPublicaCadastro(); }
  const mProva = location.hash.match(/^#\/prova\/([0-9a-fA-F]{32})$/);
  if (mProva) { window.removeEventListener('hashchange', rotear); return paginaPublicaProva(mProva[1].toLowerCase()); }
  const mPub = location.hash.match(/^#\/o\/([0-9a-fA-F]{32})$/);
  if (mPub) { window.removeEventListener('hashchange', rotear); return paginaPublicaOrcamento(mPub[1].toLowerCase()); }
  let t = null; try { t = localStorage.getItem('gvh_token'); } catch {}
  if (!t) { $('#tela-login').classList.remove('hidden'); return; }
  S.token = t;
  try { const r = await api('sessao', {}, true); salvarSessao({ ...r, token: t }); await iniciarApp(); }
  catch { sairLocal(); }
})();
