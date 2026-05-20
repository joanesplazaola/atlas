const state = {
  manifest: null,
  themes: [],
  filteredThemes: [],
  selectedSlug: null,
  activeTab: "overview",
  query: "",
  activeConcept: null,
  activeAuthor: null,   // author filter from author index view
  view: "temas",        // "temas" | "autores"
};

const appEl        = document.querySelector(".app");
const themeList    = document.querySelector("#theme-grid");
const detailEmpty  = document.querySelector("#detail-empty");
const detailContent = document.querySelector("#detail-content");
const stats        = document.querySelector("#stats");
const searchInput  = document.querySelector("#search-input");
const activeFilter = document.querySelector("#active-filter");
const navTemas     = document.querySelector("#nav-temas");
const navAutores   = document.querySelector("#nav-autores");

/* ─── Helpers ──────────────────────────────────────────────────── */

function getSlugFromHash() {
  const match = window.location.hash.match(/^#tema\/([a-z0-9-]+)/);
  return match ? match[1] : null;
}

function setHash(slug) {
  const next = `#tema/${slug}`;
  if (window.location.hash !== next) window.location.hash = next;
}

function esc(v) {
  return String(v)
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;").replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function norm(v) {
  return v.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

const levelLabel = { introductory: "Introductorio", intermediate: "Intermedio", advanced: "Avanzado" };
const levelBadge = { introductory: "badge--intro",  intermediate: "badge--inter",  advanced: "badge--advanced" };
const effortLabel = { short: "corto", medium: "medio", long: "largo" };
const kindLabel   = { article: "artículo", chapter: "capítulo", book: "libro", pamphlet: "folleto", speech: "discurso", letter: "carta" };

function buildSearchText(t) {
  return norm([
    t.title, t.summary, t.editorial_intent,
    ...t.key_authors.map(a => `${a.name} ${a.role} ${a.why_relevant}`),
    ...t.connected_concepts.map(c => `${c.label} ${c.relation}`),
    ...t.historical_debates.map(d => `${d.label} ${d.description}`),
    ...t.essential_works.map(w => `${w.title} ${w.reason_to_read}`)
  ].join(" "));
}

/* ─── Concept chip factory ─────────────────────────────────────── */

function conceptChip(label) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = `chip${state.activeConcept === label ? " chip--selected" : ""}`;
  btn.textContent = label;
  btn.addEventListener("click", e => {
    e.stopPropagation();
    state.activeConcept = state.activeConcept === label ? null : label;
    applyFilters();
  });
  return btn;
}

/* ─── Related theme chip ────────────────────────────────────────── */

function relatedThemeChip(slug) {
  const theme = state.themes.find(t => t.slug === slug);
  if (!theme) return null;
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "chip chip--theme";
  btn.textContent = theme.title;
  btn.title = theme.summary;
  btn.addEventListener("click", () => {
    state.selectedSlug = slug;
    state.activeTab = "overview";
    setHash(slug);
    renderList();
    renderDetail();
    switchMobileView("detail");
  });
  return btn;
}

/* ─── Mobile view switching ─────────────────────────────────────── */

function switchMobileView(view) {
  appEl.setAttribute("data-view", view);
}

/* ─── Filter & render pipeline ─────────────────────────────────── */

function applyFilters() {
  const q  = norm(state.query.trim());
  const ac = state.activeConcept ? norm(state.activeConcept) : null;
  const aa = state.activeAuthor  ? norm(state.activeAuthor)  : null;

  state.filteredThemes = state.themes.filter(t => {
    const mQ  = !q  || buildSearchText(t).includes(q);
    const mC  = !ac || t.connected_concepts.some(c => norm(c.label) === ac);
    const mA  = !aa || t.key_authors.some(a => norm(a.name) === aa);
    return mQ && mC && mA;
  });

  if (!state.filteredThemes.some(t => t.slug === state.selectedSlug)) {
    state.selectedSlug = state.filteredThemes[0]?.slug || null;
  }

  renderStats();
  renderFilterBar();
  if (state.view === "autores") {
    renderAuthorList();
  } else {
    renderList();
  }
  renderDetail();
}

function renderStats() {
  const works   = state.themes.reduce((n, t) => n + t.essential_works.length, 0);
  const authors = getAllAuthors().length;
  if (state.view === "autores") {
    stats.innerHTML =
      `<span class="stat-pill">${authors} autores</span>` +
      `<span class="stat-pill">${state.themes.length} temas</span>`;
  } else {
    stats.innerHTML =
      `<span class="stat-pill">${state.filteredThemes.length} temas</span>` +
      `<span class="stat-pill">${works} obras</span>` +
      `<span class="stat-pill">${authors} autores</span>`;
  }
}

function renderFilterBar() {
  const filters = [];
  if (state.activeConcept) filters.push({ key: "concept", label: `Concepto: ${state.activeConcept}`, clear: () => { state.activeConcept = null; applyFilters(); } });
  if (state.activeAuthor)  filters.push({ key: "author",  label: `Autor: ${state.activeAuthor}`,     clear: () => { state.activeAuthor = null;  applyFilters(); } });

  if (!filters.length) { activeFilter.hidden = true; activeFilter.innerHTML = ""; return; }
  activeFilter.hidden = false;
  activeFilter.innerHTML = filters.map(f =>
    `<span class="filter-pill" data-key="${f.key}">
       <strong>${esc(f.label)}</strong>
       <button type="button" aria-label="Quitar filtro">×</button>
     </span>`
  ).join("");
  filters.forEach(f => {
    activeFilter.querySelector(`[data-key="${f.key}"] button`).addEventListener("click", f.clear);
  });
}

/* ─── Theme list (sidebar temas) ────────────────────────────────── */

function renderSkeleton() {
  themeList.innerHTML = Array.from({ length: 3 }, () =>
    `<div class="theme-card theme-card--skeleton" aria-hidden="true">
       <div class="skeleton-line skeleton-line--title"></div>
       <div class="skeleton-line"></div>
       <div class="skeleton-line skeleton-line--short"></div>
     </div>`
  ).join("");
}

function renderList() {
  if (!state.filteredThemes.length) {
    themeList.innerHTML = `<div class="empty-state">Sin resultados para esta búsqueda.</div>`;
    return;
  }

  themeList.innerHTML = "";
  state.filteredThemes.forEach(t => {
    const el = document.createElement("article");
    el.className = `theme-card${t.slug === state.selectedSlug ? " theme-card--active" : ""}`;
    el.setAttribute("role", "button");
    el.tabIndex = 0;
    el.setAttribute("aria-pressed", String(t.slug === state.selectedSlug));

    el.innerHTML =
      `<div class="theme-card__title">${esc(t.title)}</div>
       <p class="theme-card__summary">${esc(t.summary)}</p>
       <div class="theme-card__chips"></div>`;

    const chips = el.querySelector(".theme-card__chips");
    t.connected_concepts.slice(0, 4).forEach(c => chips.appendChild(conceptChip(c.label)));

    const select = () => {
      state.selectedSlug = t.slug;
      state.activeTab = "overview";
      setHash(t.slug);
      renderList();
      renderDetail();
      switchMobileView("detail");
    };

    el.addEventListener("click", e => { if (!e.target.closest(".chip")) select(); });
    el.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); select(); } });

    themeList.appendChild(el);
  });
}

/* ─── Author index (sidebar autores) ────────────────────────────── */

function getAllAuthors() {
  const seen = new Map();
  state.themes.forEach(t => {
    t.key_authors.forEach(a => {
      if (!seen.has(a.id)) {
        seen.set(a.id, { ...a, themes: [] });
      }
      seen.get(a.id).themes.push(t.slug);
    });
  });
  return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name, "es"));
}

function renderAuthorList() {
  const authors = getAllAuthors();
  const q = norm(state.query.trim());

  const filtered = q
    ? authors.filter(a => norm(a.name).includes(q) || norm(a.role).includes(q))
    : authors;

  if (!filtered.length) {
    themeList.innerHTML = `<div class="empty-state">Sin resultados para esta búsqueda.</div>`;
    return;
  }

  themeList.innerHTML = "";
  filtered.forEach(a => {
    const isActive = state.activeAuthor === a.name;
    const el = document.createElement("article");
    el.className = `author-list-card${isActive ? " author-list-card--active" : ""}`;
    el.setAttribute("role", "button");
    el.tabIndex = 0;
    el.innerHTML =
      `<div class="author-list-card__name">${esc(a.name)}</div>
       <div class="author-list-card__count">${a.themes.length} tema${a.themes.length !== 1 ? "s" : ""}</div>`;

    const select = () => {
      state.activeAuthor = isActive ? null : a.name;
      state.view = "temas";
      navTemas.classList.add("topbar__nav-btn--active");
      navAutores.classList.remove("topbar__nav-btn--active");
      searchInput.placeholder = "Tema, autor, concepto…";
      applyFilters();
    };

    el.addEventListener("click", select);
    el.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); select(); } });
    themeList.appendChild(el);
  });
}

/* ─── Detail panel ─────────────────────────────────────────────── */

function renderDetail() {
  const theme = state.themes.find(t => t.slug === state.selectedSlug);
  if (!theme) {
    detailEmpty.hidden = false;
    detailContent.hidden = true;
    detailContent.innerHTML = "";
    return;
  }

  detailEmpty.hidden = true;
  detailContent.hidden = false;

  const authorById = new Map(theme.key_authors.map(a => [a.id, a]));
  const workById   = new Map(theme.essential_works.map(w => [w.id, w]));

  const tabs = [
    { id: "overview",  label: "Presentación" },
    { id: "works",     label: `Obras (${theme.essential_works.length})` },
    { id: "routes",    label: `Rutas (${theme.reading_paths.length})` },
    { id: "debates",   label: "Debates" }
  ];

  detailContent.innerHTML = `
    <header class="detail__header">
      <button class="detail__back" id="detail-back" aria-label="Volver a la lista">
        <svg viewBox="0 0 16 16" fill="none" width="16" height="16" aria-hidden="true">
          <path d="M10 3L5 8l5 5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        Temas
      </button>
      <div class="detail__header-top">
        <div>
          <p class="detail__eyebrow">Tema</p>
          <h2 id="detail-title">${esc(theme.title)}</h2>
        </div>
        <div class="detail__stats">
          <div class="detail__stat">
            <span class="detail__stat-num">${theme.key_authors.length}</span>
            <span class="detail__stat-label">autores</span>
          </div>
          <div class="detail__stat">
            <span class="detail__stat-num">${theme.essential_works.length}</span>
            <span class="detail__stat-label">obras</span>
          </div>
          <div class="detail__stat">
            <span class="detail__stat-num">${theme.reading_paths.length}</span>
            <span class="detail__stat-label">rutas</span>
          </div>
        </div>
      </div>
      <p class="detail__summary">${esc(theme.summary)}</p>
      <nav class="tabs" role="tablist" aria-label="Secciones del tema"></nav>
    </header>

    <div class="tab-panels">
      <div id="tab-overview" class="tab-panel" role="tabpanel"></div>
      <div id="tab-works"    class="tab-panel" role="tabpanel"></div>
      <div id="tab-routes"   class="tab-panel" role="tabpanel"></div>
      <div id="tab-debates"  class="tab-panel" role="tabpanel"></div>
    </div>
  `;

  /* back button (mobile) */
  detailContent.querySelector("#detail-back").addEventListener("click", () => {
    switchMobileView("list");
  });

  /* tabs nav */
  const tabsNav = detailContent.querySelector(".tabs");
  tabs.forEach(({ id, label }) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `tab-btn${state.activeTab === id ? " tab-btn--active" : ""}`;
    btn.textContent = label;
    btn.setAttribute("role", "tab");
    btn.setAttribute("aria-selected", String(state.activeTab === id));
    btn.addEventListener("click", () => {
      state.activeTab = id;
      tabsNav.querySelectorAll(".tab-btn").forEach(b => {
        b.classList.toggle("tab-btn--active", b === btn);
        b.setAttribute("aria-selected", String(b === btn));
      });
      detailContent.querySelectorAll(".tab-panel").forEach(p => {
        p.classList.toggle("tab-panel--active", p.id === `tab-${id}`);
      });
    });
    tabsNav.appendChild(btn);
  });

  /* activate current tab panel */
  const currentPanel = detailContent.querySelector(`#tab-${state.activeTab}`);
  if (currentPanel) currentPanel.classList.add("tab-panel--active");

  /* ── Overview tab ── */
  const overviewEl = detailContent.querySelector("#tab-overview");

  if (theme.editorial_intent) {
    overviewEl.innerHTML += `
      <div class="editorial-note">
        <div class="editorial-note__label">Nota editorial</div>
        ${esc(theme.editorial_intent)}
      </div>`;
  }

  if (theme.entry_points?.length) {
    overviewEl.innerHTML += `<p class="section-title">Puntos de entrada</p><div class="overview-grid" id="ov-entry"></div>`;
    const ovEntry = overviewEl.querySelector("#ov-entry");
    theme.entry_points.forEach(ep => {
      const c = document.createElement("div");
      c.className = "entry-card";
      c.innerHTML = `<h3>${esc(ep.label)}</h3><p>${esc(ep.description)}</p>`;
      ovEntry.appendChild(c);
    });
  }

  overviewEl.innerHTML += `<p class="section-title">Autores clave</p><div class="authors-grid" id="ov-authors"></div>`;
  const ovAuthors = overviewEl.querySelector("#ov-authors");
  theme.key_authors.forEach(a => {
    const c = document.createElement("article");
    c.className = "author-card";
    c.innerHTML =
      `<div class="author-card__name">${esc(a.name)}</div>
       <div class="author-card__role">${esc(a.role)}</div>
       <p class="author-card__why">${esc(a.why_relevant)}</p>`;
    ovAuthors.appendChild(c);
  });

  if (theme.connected_concepts?.length) {
    overviewEl.innerHTML += `<p class="section-title">Conceptos relacionados</p><div class="concepts-cloud" id="ov-concepts"></div>`;
    const ovConcepts = overviewEl.querySelector("#ov-concepts");
    theme.connected_concepts.forEach(c => ovConcepts.appendChild(conceptChip(c.label)));
  }

  if (theme.related_themes?.length) {
    const existingRelated = theme.related_themes.filter(slug => state.themes.some(t => t.slug === slug));
    if (existingRelated.length) {
      overviewEl.innerHTML += `<p class="section-title">Temas relacionados</p><div class="related-themes-cloud" id="ov-related"></div>`;
      const ovRelated = overviewEl.querySelector("#ov-related");
      existingRelated.forEach(slug => {
        const chip = relatedThemeChip(slug);
        if (chip) ovRelated.appendChild(chip);
      });
    }
  }

  /* ── Works tab ── */
  const worksEl = detailContent.querySelector("#tab-works");
  worksEl.innerHTML = `<div class="works-grid" id="works-inner"></div>`;
  const worksInner = worksEl.querySelector("#works-inner");

  theme.essential_works.forEach(w => {
    const authors = w.author_ids.map(id => authorById.get(id)?.name).filter(Boolean).join(", ");
    const c = document.createElement("article");
    c.className = "work-card";
    c.innerHTML =
      `<div>
         <div class="work-card__title">${esc(w.title)}</div>
         <div class="work-card__author">${esc(authors)} · ${esc(String(w.year))}</div>
       </div>
       <div class="work-card__meta">
         <span class="badge ${levelBadge[w.level] || ""}">${levelLabel[w.level] || w.level}</span>
         <span class="badge badge--kind">${esc(kindLabel[w.kind] || w.kind)}</span>
         <span class="badge badge--effort">Lectura ${esc(effortLabel[w.estimated_effort] || w.estimated_effort)}</span>
       </div>
       <p class="work-card__reason">${esc(w.reason_to_read)}</p>
       <a class="work-card__link" href="${esc(w.source.url)}" target="_blank" rel="noreferrer">
         Leer en ${esc(w.source.provider)}
         <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
           <path d="M2 7h10M7 2l5 5-5 5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
         </svg>
       </a>`;
    worksInner.appendChild(c);
  });

  /* ── Routes tab ── */
  const routesEl = detailContent.querySelector("#tab-routes");
  routesEl.innerHTML = `<div class="routes-grid" id="routes-inner"></div>`;
  const routesInner = routesEl.querySelector("#routes-inner");

  theme.reading_paths.forEach(rp => {
    const c = document.createElement("article");
    c.className = "route-card";
    const stepsHtml = rp.steps.map(s => {
      const w = workById.get(s.work_id);
      return `
        <div class="route-step">
          <span class="route-step__num">${s.position}</span>
          <div class="route-step__body">
            <div class="route-step__title">${esc(w?.title || s.work_id)}</div>
            <div class="route-step__note">${esc(s.note)}</div>
          </div>
        </div>`;
    }).join("");
    c.innerHTML =
      `<div class="route-card__level" style="color:${rp.level === "introductory" ? "var(--green)" : rp.level === "advanced" ? "var(--red)" : "var(--yellow)"}">${levelLabel[rp.level] || rp.level}</div>
       <div class="route-card__title">${esc(rp.label)}</div>
       <p class="route-card__goal">${esc(rp.goal)}</p>
       <div class="route-steps">${stepsHtml}</div>`;
    routesInner.appendChild(c);
  });

  /* ── Debates tab ── */
  const debatesEl = detailContent.querySelector("#tab-debates");
  debatesEl.innerHTML = `<div class="debates-grid" id="debates-inner"></div>`;
  const debatesInner = debatesEl.querySelector("#debates-inner");

  theme.historical_debates.forEach(d => {
    const participants = d.participant_author_ids.map(id => authorById.get(id)?.name).filter(Boolean).join(", ");
    const works = d.related_work_ids.map(id => workById.get(id)?.title).filter(Boolean).join("; ");
    const c = document.createElement("div");
    c.className = "debate-card";
    c.innerHTML =
      `<div class="debate-card__title">${esc(d.label)}</div>
       <p class="debate-card__desc">${esc(d.description)}</p>
       <div class="debate-card__meta">
         <div class="debate-card__meta-row">
           <span class="debate-card__meta-label">Autores:</span>
           <span class="debate-card__meta-value">${esc(participants)}</span>
         </div>
         <div class="debate-card__meta-row">
           <span class="debate-card__meta-label">Obras:</span>
           <span class="debate-card__meta-value">${esc(works)}</span>
         </div>
       </div>`;
    debatesInner.appendChild(c);
  });
}

/* ─── View switching ────────────────────────────────────────────── */

function switchView(view) {
  state.view = view;
  navTemas.classList.toggle("topbar__nav-btn--active", view === "temas");
  navAutores.classList.toggle("topbar__nav-btn--active", view === "autores");
  searchInput.placeholder = view === "autores" ? "Buscar autor…" : "Tema, autor, concepto…";
  renderStats();
  if (view === "autores") {
    renderAuthorList();
  } else {
    renderList();
  }
}

/* ─── Data loading ─────────────────────────────────────────────── */

async function fetchJson(path) {
  const r = await fetch(path);
  if (!r.ok) throw new Error(`No se pudo cargar ${path}`);
  return r.json();
}

async function init() {
  renderSkeleton();
  try {
    const manifest = await fetchJson("content/themes/index.json");
    const themes   = await Promise.all(manifest.theme_files.map(p => fetchJson(p)));

    state.manifest = manifest;
    state.themes   = themes.sort((a, b) => a.title.localeCompare(b.title, "es"));
    state.selectedSlug = getSlugFromHash() || state.themes[0]?.slug || null;

    if (state.selectedSlug) setHash(state.selectedSlug);
    applyFilters();
  } catch (err) {
    themeList.innerHTML = `<div class="empty-state">Error al cargar el contenido: ${esc(err.message)}</div>`;
  }
}

/* ─── Event listeners ──────────────────────────────────────────── */

searchInput.addEventListener("input", e => { state.query = e.target.value; applyFilters(); });

navTemas.addEventListener("click",   () => switchView("temas"));
navAutores.addEventListener("click", () => switchView("autores"));

window.addEventListener("hashchange", () => {
  const slug = getSlugFromHash();
  if (!slug || slug === state.selectedSlug) return;
  state.selectedSlug = slug;
  state.activeTab = "overview";
  if (state.view !== "temas") switchView("temas");
  renderList();
  renderDetail();
});

init();

