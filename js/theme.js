// theme.js — visual theme switcher with persistence.

/* ─── Theme switcher ─────────────────────────────────────────────── */

const THEMES = ["oscuro", "editorial", "constructivista"];

// Non-default themes load their display font on demand, so the initial page
// only pays for the default theme's fonts (Lora + Inter, in index.html).
const THEME_FONTS = {
  editorial: "https://fonts.googleapis.com/css2?family=IM+Fell+English:ital@0;1&display=swap",
  constructivista: "https://fonts.googleapis.com/css2?family=Oswald:wght@400;600;700&display=swap",
};
const loadedFonts = new Set();

function loadThemeFont(name) {
  const href = THEME_FONTS[name];
  if (!href || loadedFonts.has(name)) return;
  loadedFonts.add(name);
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  document.head.appendChild(link);
}

function applyTheme(name) {
  if (!THEMES.includes(name)) name = "oscuro";
  document.documentElement.setAttribute("data-theme", name);
  loadThemeFont(name);

  // Keep the browser UI (address bar) in sync with the active theme background.
  const bg = getComputedStyle(document.documentElement).getPropertyValue("--bg").trim();
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta && bg) meta.setAttribute("content", bg);

  /** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll("[data-theme-btn]")).forEach((btn) => {
    btn.classList.toggle("theme-btn--active", btn.dataset.themeBtn === name);
  });
  try {
    localStorage.setItem("atlas-theme", name);
  } catch {
    // storage may be unavailable (private mode); ignore
  }
}

function initTheme() {
  let saved = "oscuro";
  try {
    saved = localStorage.getItem("atlas-theme") || "oscuro";
  } catch {
    // storage may be unavailable (private mode); ignore
  }
  applyTheme(saved);
}

/** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll("[data-theme-btn]")).forEach((btn) => {
  btn.addEventListener("click", () => applyTheme(btn.dataset.themeBtn));
});

initTheme();
