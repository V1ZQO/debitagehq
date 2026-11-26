'use strict';
{
  const t = document.getElementById('t');
  if (window.qgBanner) {
    window.qgBanner.onText(s => { t.textContent = String(s || '').slice(0, 80) });
    document.getElementById('stop').addEventListener('click', () => window.qgBanner.stop());
  }
}
