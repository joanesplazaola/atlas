// theme.js — visual theme switcher with persistence.

/* ─── Theme switcher ─────────────────────────────────────────────── */

const THEMES = ["oscuro", "editorial", "constructivista"];

function applyTheme(name) {
  if (!THEMES.includes(name)) name = "oscuro";
  document.documentElement.setAttribute("data-theme", name);
  document.querySelectorAll("[data-theme-btn]").forEach(btn => {
    btn.classList.toggle("theme-btn--active", btn.dataset.themeBtn === name);
  });
  try { localStorage.setItem("atlas-theme", name); } catch (_) {}
}

function initTheme() {
  let saved = "oscuro";
  try { saved = localStorage.getItem("atlas-theme") || "oscuro"; } catch (_) {}
  applyTheme(saved);
}

document.querySelectorAll("[data-theme-btn]").forEach(btn => {
  btn.addEventListener("click", () => applyTheme(btn.dataset.themeBtn));
});

initTheme();
