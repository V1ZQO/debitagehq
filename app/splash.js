'use strict';
{
  const bar = document.getElementById('bar'), status = document.getElementById('status');
  let shown = 6;
  const set = (pct, text) => {
    pct = Math.max(shown, Math.min(100, Number(pct) || 0)); shown = pct;
    bar.style.width = pct + '%';
    if (text) status.textContent = String(text).slice(0, 60);
  };
  // petite progression d'attente tant que l'appli ne répond pas
  const idle = setInterval(() => { if (shown < 28) set(shown + 4) }, 250);
  if (window.qgSplash) {
    window.qgSplash.version().then(v => { document.getElementById('ver').textContent = 'v' + v }).catch(() => {});
    window.qgSplash.onProgress((p) => { if (p && p.pct > 28) clearInterval(idle); set(p && p.pct, p && p.text) });
  }
}
