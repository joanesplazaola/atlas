const state = {
  manifest: null,
  themes: [],           // light theme objects from index-light.json (fast sidebar)
  authors: [],          // canonical authors registry
  filteredThemes: [],
  selectedSlug: null,
  selectedAuthorId: null, // author detail panel
  activeTab: "overview",
  query: "",
  activeConcept: null,
  activeAuthor: null,   // author filter from author index view
  view: "temas",        // "temas" | "autores" | "mapa"
  themeCache: new Map(),  // slug → full theme JSON (loaded on demand)
  worksCache: new Map(),  // work_id → canonical work JSON (loaded on demand)
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
const navMapa      = document.querySelector("#nav-mapa");
const mapViewEl    = document.querySelector("#map-view");

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
    t.title, t.summary,
    ...(t.key_author_names ?? t.key_authors?.map(a => `${a.name} ${a.role} ${a.why_relevant}`) ?? []),
    ...(t.concept_labels   ?? t.connected_concepts?.map(c => `${c.label} ${c.relation}`) ?? []),
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
    const mC  = !ac || (t.concept_labels ?? t.connected_concepts?.map(c => c.label) ?? []).some(l => norm(l) === ac);
    const mA  = !aa || (t.key_author_names ?? t.key_authors?.map(a => a.name) ?? []).some(n => norm(n) === aa);
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
  const works   = state.themes.reduce((n, t) => n + (t.work_count ?? t.essential_works?.length ?? 0), 0);
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
    const conceptsToShow = t.concept_labels ?? t.connected_concepts?.map(c => c.label) ?? [];
    conceptsToShow.slice(0, 4).forEach(label => chips.appendChild(conceptChip(label)));

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
  // Build theme-count map from fichas (support both light and full theme shape)
  const themesByAuthor = new Map();
  state.themes.forEach(t => {
    const authorIds = t.key_author_ids ?? t.key_authors?.map(a => a.id) ?? [];
    authorIds.forEach(id => {
      if (!themesByAuthor.has(id)) themesByAuthor.set(id, []);
      themesByAuthor.get(id).push(t.slug);
    });
  });

  // Use canonical registry; fall back to inline data for unknown IDs
  const canonicalIds = new Set(state.authors.map(a => a.id));
  const result = state.authors.map(a => ({
    ...a,
    themes: themesByAuthor.get(a.id) || [],
  })).filter(a => a.themes.length > 0);

  // Include any authors present in fichas but not in registry (shouldn't happen, but safe)
  themesByAuthor.forEach((themes, id) => {
    if (!canonicalIds.has(id)) {
      const inline = state.themes.flatMap(t => t.key_authors).find(a => a.id === id);
      if (inline) result.push({ ...inline, themes });
    }
  });

  return result.sort((a, b) => a.name.localeCompare(b.name, "es"));
}

function renderAuthorList() {
  const authors = getAllAuthors();
  const q = norm(state.query.trim());

  const filtered = q
    ? authors.filter(a =>
        norm(a.name).includes(q) ||
        norm(a.short_bio || a.role || "").includes(q) ||
        norm(a.nationality || "").includes(q)
      )
    : authors;

  if (!filtered.length) {
    themeList.innerHTML = `<div class="empty-state">Sin resultados para esta búsqueda.</div>`;
    return;
  }

  themeList.innerHTML = "";
  filtered.forEach(a => {
    const isActive = state.selectedAuthorId === a.id;
    const el = document.createElement("article");
    el.className = `author-list-card${isActive ? " author-list-card--active" : ""}`;
    el.setAttribute("role", "button");
    el.tabIndex = 0;
    el.setAttribute("aria-pressed", String(isActive));
    el.innerHTML =
      `<div>
         <div class="author-list-card__name">${esc(a.name)}</div>
         ${a.years ? `<div class="author-list-card__years">${esc(a.years)}</div>` : ""}
       </div>
       <div class="author-list-card__count">${a.themes.length} tema${a.themes.length !== 1 ? "s" : ""}</div>`;

    const select = () => {
      state.selectedAuthorId = a.id;
      renderAuthorList();
      renderDetail();
      switchMobileView("detail");
    };

    el.addEventListener("click", select);
    el.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); select(); } });
    themeList.appendChild(el);
  });
}

/* ─── Detail panel ─────────────────────────────────────────────── */

async function renderDetail() {
  if (state.view === "autores") {
    await renderAuthorDetail();
    return;
  }

  if (!state.selectedSlug) {
    detailEmpty.hidden = false;
    detailContent.hidden = true;
    detailContent.innerHTML = "";
    return;
  }

  detailEmpty.hidden = true;
  detailContent.hidden = false;

  // Show spinner while loading
  detailContent.innerHTML = `
    <div class="detail-loading" aria-live="polite">
      <div class="detail-loading__spinner" aria-label="Cargando tema…"></div>
    </div>`;

  try {
    // ── Lazy-load full theme ─────────────────────────────────────
    let theme = state.themeCache.get(state.selectedSlug);
    if (!theme) {
      theme = await fetchJson(`content/themes/${state.selectedSlug}.json`);
      state.themeCache.set(state.selectedSlug, theme);
    }

    // ── Lazy-load canonical works for this theme ─────────────────
    const workRefs = theme.essential_works; // [{work_id, level, estimated_effort, reason_to_read}]
    const missing  = workRefs.filter(r => !state.worksCache.has(r.work_id));
    if (missing.length) {
      const loaded = await Promise.all(
        missing.map(r => fetchJson(`content/works/${r.work_id}.json`))
      );
      loaded.forEach(w => state.worksCache.set(w.id, w));
    }

    // Merge canonical work data with theme-specific ref overlay
    const mergedWorks = workRefs.map(ref => ({
      ...state.worksCache.get(ref.work_id),
      ...ref,
      id: ref.work_id,
    }));

    // ── Build lookup maps ────────────────────────────────────────
    // Prefer canonical registry, fall back to theme key_authors (has role/why_relevant)
    const authorById = new Map([
      ...state.authors.map(a => [a.id, a]),
      ...theme.key_authors.map(a => [a.id, a]),
    ]);
    const workById = new Map(mergedWorks.map(w => [w.id, w]));

    const tabs = [
      { id: "overview",  label: "Presentación" },
      { id: "works",     label: `Obras (${mergedWorks.length})` },
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
              <span class="detail__stat-num">${mergedWorks.length}</span>
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
      const canonical = state.authors.find(ca => ca.id === a.id);
      const c = document.createElement("article");
      c.className = "author-card";
      c.innerHTML =
        `<div class="author-card__header">
           <div>
             <div class="author-card__name">${esc(a.name)}</div>
             ${canonical?.years ? `<div class="author-card__years">${esc(canonical.years)}</div>` : ""}
           </div>
           ${canonical?.marxists_org_url ? `<a class="author-card__link" href="${esc(canonical.marxists_org_url)}" target="_blank" rel="noreferrer" title="Marxists.org">
             <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="M2 7h10M7 2l5 5-5 5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
           </a>` : ""}
         </div>
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

    mergedWorks.forEach(w => {
      const authors = (w.author_ids ?? []).map(id => authorById.get(id)?.name).filter(Boolean).join(", ");
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
         <a class="work-card__link" href="${esc(w.source?.url ?? "#")}" target="_blank" rel="noreferrer">
           Leer en ${esc(w.source?.provider ?? "fuente")}
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

  } catch (err) {
    detailContent.innerHTML = `<div class="empty-state">Error al cargar el tema: ${esc(err.message)}</div>`;
  }
}

/* ─── Author detail panel ──────────────────────────────────────── */

async function renderAuthorDetail() {
  if (!state.selectedAuthorId) {
    // Show a useful autores landing panel instead of blank state
    detailEmpty.hidden = true;
    detailContent.hidden = false;
    const authors = getAllAuthors();
    detailContent.innerHTML = `
      <div class="author-landing">
        <div class="author-landing__hero">
          <h2 class="author-landing__title">Autores</h2>
          <p class="author-landing__subtitle">Selecciona un autor para ver su perfil, sus obras en la biblioteca y su relación con otros autores y temas.</p>
        </div>
        <div class="author-landing__grid" id="author-landing-grid"></div>
      </div>`;
    const grid = detailContent.querySelector("#author-landing-grid");
    authors.forEach(a => {
      const card = document.createElement("div");
      card.className = "author-landing__card";
      card.setAttribute("role", "button");
      card.tabIndex = 0;
      card.innerHTML = `
        <div class="author-landing__card-name">${esc(a.name)}</div>
        ${a.years ? `<div class="author-landing__card-years">${esc(a.years)}</div>` : ""}
        <div class="author-landing__card-count">${a.themes.length} tema${a.themes.length !== 1 ? "s" : ""}</div>`;
      const go = () => {
        state.selectedAuthorId = a.id;
        renderAuthorList();
        renderDetail();
        switchMobileView("detail");
      };
      card.addEventListener("click", go);
      card.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); } });
      grid.appendChild(card);
    });
    return;
  }

  const author = state.authors.find(a => a.id === state.selectedAuthorId);
  if (!author) {
    detailEmpty.hidden = false;
    detailContent.hidden = true;
    return;
  }

  detailEmpty.hidden = true;
  detailContent.hidden = false;

  detailContent.innerHTML = `
    <div class="detail-loading" aria-live="polite">
      <div class="detail-loading__spinner" aria-label="Cargando perfil del autor…"></div>
    </div>`;

  try {
    // Themes this author appears in (using light index)
    const authorThemes = state.themes.filter(t =>
      (t.key_author_ids ?? []).includes(author.id)
    );

    // Lazy-load full theme JSONs to collect work refs
    await Promise.all(authorThemes.map(async t => {
      if (!state.themeCache.has(t.slug)) {
        const full = await fetchJson(`content/themes/${t.slug}.json`);
        state.themeCache.set(t.slug, full);
      }
    }));

    // Collect deduplicated work refs from these themes
    const seenWorkIds = new Set();
    const allWorkRefs = [];
    authorThemes.forEach(t => {
      const full = state.themeCache.get(t.slug);
      if (!full) return;
      (full.essential_works || []).forEach(ref => {
        if (!seenWorkIds.has(ref.work_id)) {
          seenWorkIds.add(ref.work_id);
          allWorkRefs.push(ref);
        }
      });
    });

    // Lazy-load canonical work data for missing works
    const missing = allWorkRefs.map(r => r.work_id).filter(id => !state.worksCache.has(id));
    if (missing.length) {
      const loaded = await Promise.all(missing.map(id => fetchJson(`content/works/${id}.json`)));
      loaded.forEach(w => state.worksCache.set(w.id, w));
    }

    // Filter to works by this author
    const authorWorks = allWorkRefs
      .filter(ref => {
        const w = state.worksCache.get(ref.work_id);
        return w && (w.author_ids || []).includes(author.id);
      })
      .map(ref => ({ ...state.worksCache.get(ref.work_id), ...ref, id: ref.work_id }));

    // Related authors: others that share themes with this author
    const relatedIds = new Set();
    authorThemes.forEach(t => {
      (t.key_author_ids ?? []).forEach(id => { if (id !== author.id) relatedIds.add(id); });
    });
    const relatedAuthors = state.authors.filter(a => relatedIds.has(a.id));

    // ── Build DOM ──────────────────────────────────────────────────
    detailContent.innerHTML = "";

    // Header
    const header = document.createElement("header");
    header.className = "author-detail__header";
    header.innerHTML = `
      <button class="detail__back" id="author-detail-back" aria-label="Volver a la lista">
        <svg viewBox="0 0 16 16" fill="none" width="16" height="16" aria-hidden="true">
          <path d="M10 3L5 8l5 5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        Autores
      </button>
      <div class="author-detail__top">
        <div class="author-detail__identity">
          <h2 id="detail-title" class="author-detail__name">${esc(author.name)}</h2>
          <div class="author-detail__meta">
            ${author.years ? `<span>${esc(author.years)}</span>` : ""}
            ${author.nationality ? `<span class="author-detail__sep">·</span><span>${esc(author.nationality)}</span>` : ""}
          </div>
        </div>
        ${author.marxists_org_url
          ? `<a href="${esc(author.marxists_org_url)}" target="_blank" rel="noopener noreferrer" class="author-detail__ext-link">
               Marxists.org
               <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                 <path d="M7 1h4v4M11 1 5.5 6.5M2 3H1v8h8V9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
               </svg>
             </a>`
          : ""}
      </div>`;
    detailContent.appendChild(header);
    header.querySelector("#author-detail-back").addEventListener("click", () => switchMobileView("list"));

    // Bio
    if (author.short_bio) {
      const bioSection = document.createElement("div");
      bioSection.className = "author-detail__bio-section";
      bioSection.innerHTML = `<p class="author-detail__bio">${esc(author.short_bio)}</p>`;
      detailContent.appendChild(bioSection);
    }

    // Themes section
    if (authorThemes.length) {
      const themesSection = document.createElement("div");
      themesSection.className = "author-detail__section";
      const h3 = document.createElement("h3");
      h3.className = "author-detail__section-title";
      h3.textContent = "Aparece en";
      themesSection.appendChild(h3);

      const chips = document.createElement("div");
      chips.className = "author-detail__theme-chips";
      authorThemes.forEach(t => {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "chip chip--theme";
        chip.textContent = t.title;
        chip.addEventListener("click", () => {
          state.selectedSlug = t.slug;
          state.activeTab = "overview";
          setHash(t.slug);
          switchView("temas");
          applyFilters();
        });
        chips.appendChild(chip);
      });
      themesSection.appendChild(chips);

      const filterBtn = document.createElement("button");
      filterBtn.type = "button";
      filterBtn.className = "author-detail__filter-btn";
      filterBtn.textContent = `Ver todos los temas con ${author.name} →`;
      filterBtn.addEventListener("click", () => {
        state.activeAuthor = author.name;
        switchView("temas");
        applyFilters();
      });
      themesSection.appendChild(filterBtn);
      detailContent.appendChild(themesSection);
    }

    // Works section
    if (authorWorks.length) {
      const worksSection = document.createElement("div");
      worksSection.className = "author-detail__section";
      const h3 = document.createElement("h3");
      h3.className = "author-detail__section-title";
      h3.textContent = `Obras en esta biblioteca (${authorWorks.length})`;
      worksSection.appendChild(h3);

      const grid = document.createElement("div");
      grid.className = "works-grid";
      authorWorks.forEach(w => {
        const card = document.createElement("article");
        card.className = "work-card";
        card.innerHTML = `
          <div>
            <div class="work-card__title">${esc(w.title)}</div>
            <div class="work-card__author">${esc(String(w.year || ""))}</div>
          </div>
          <div class="work-card__meta">
            ${w.level    ? `<span class="badge ${levelBadge[w.level] || ""}">${esc(levelLabel[w.level] || w.level)}</span>` : ""}
            ${w.kind     ? `<span class="badge badge--kind">${esc(kindLabel[w.kind] || w.kind)}</span>` : ""}
            ${w.estimated_effort ? `<span class="badge badge--effort">Lectura ${esc(effortLabel[w.estimated_effort] || w.estimated_effort)}</span>` : ""}
          </div>
          ${w.reason_to_read ? `<p class="work-card__reason">${esc(w.reason_to_read)}</p>` : ""}
          ${w.source?.url
            ? `<a class="work-card__link" href="${esc(w.source.url)}" target="_blank" rel="noopener noreferrer">
                 Leer en ${esc(w.source.provider ?? "fuente")}
                 <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                   <path d="M2 7h10M7 2l5 5-5 5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
                 </svg>
               </a>`
            : ""}`;
        grid.appendChild(card);
      });
      worksSection.appendChild(grid);
      detailContent.appendChild(worksSection);
    }

    // Related authors section
    if (relatedAuthors.length) {
      const relSection = document.createElement("div");
      relSection.className = "author-detail__section";
      const h3 = document.createElement("h3");
      h3.className = "author-detail__section-title";
      h3.textContent = "Autores relacionados";
      relSection.appendChild(h3);

      const relGrid = document.createElement("div");
      relGrid.className = "author-detail__related";
      relatedAuthors.forEach(rel => {
        const card = document.createElement("div");
        card.className = "author-detail__related-card";
        card.setAttribute("role", "button");
        card.tabIndex = 0;
        card.innerHTML = `
          <div class="author-detail__related-name">${esc(rel.name)}</div>
          ${rel.years ? `<div class="author-detail__related-years">${esc(rel.years)}</div>` : ""}`;
        const goToAuthor = () => {
          state.selectedAuthorId = rel.id;
          renderAuthorList();
          renderDetail();
          switchMobileView("detail");
        };
        card.addEventListener("click", goToAuthor);
        card.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); goToAuthor(); } });
        relGrid.appendChild(card);
      });
      relSection.appendChild(relGrid);
      detailContent.appendChild(relSection);
    }

  } catch (err) {
    detailContent.innerHTML = `<div class="empty-state">Error al cargar el perfil: ${esc(err.message)}</div>`;
  }
}

/* ─── View switching ────────────────────────────────────────────── */

function switchView(view) {
  state.view = view;
  navTemas.classList.toggle("topbar__nav-btn--active",   view === "temas");
  navAutores.classList.toggle("topbar__nav-btn--active", view === "autores");
  navMapa.classList.toggle("topbar__nav-btn--active",    view === "mapa");

  // Show/hide main app vs map view
  appEl.hidden    = (view === "mapa");
  mapViewEl.hidden = (view !== "mapa");

  searchInput.placeholder = view === "autores" ? "Buscar autor…" : "Tema, autor, concepto…";
  renderStats();
  if (view === "mapa") {
    requestAnimationFrame(renderMap);
  } else if (view === "autores") {
    renderAuthorList();
    renderDetail();
  } else {
    renderList();
  }
}

/* ─── Map: category metadata ─────────────────────────────────────── */

const THEME_CATEGORIES = {
  "estado":             "politica",
  "partido":            "politica",
  "reforma-revolucion": "politica",
  "revolucion":         "politica",
  "fascismo":           "historia",
  "cuestion-nacional":  "historia",
  "imperialismo":       "economia",
  "teoria-del-valor":   "economia",
  "alienacion":         "economia",
  "vivienda":           "social",
  "movimiento-obrero":  "social",
  "dialectica":         "filosofia",
};

const CATEGORY_COLORS = {
  politica:  "#4f9cf9",
  historia:  "#f97316",
  economia:  "#22c55e",
  social:    "#06b6d4",
  filosofia: "#a78bfa",
};

const CATEGORY_LABELS = {
  politica:  "Política y Estado",
  historia:  "Historia",
  economia:  "Economía política",
  social:    "Cuestión social",
  filosofia: "Filosofía",
};

function getCategoryForTheme(slug) {
  return THEME_CATEGORIES[slug] || "politica";
}

/* ─── Map: force-directed layout (Fruchterman-Reingold) ─────────── */

function forceLayout(nodes, edges, width, height) {
  const n = nodes.length;
  if (n === 0) return;
  const cx = width / 2, cy = height / 2;
  const R  = Math.min(width, height) * 0.33;

  // Circular init
  nodes.forEach((node, i) => {
    const angle = (2 * Math.PI * i) / n - Math.PI / 2;
    node.x = cx + R * Math.cos(angle);
    node.y = cy + R * Math.sin(angle);
  });

  const k = Math.sqrt((width * height) / n) * 0.5;
  let temp = Math.min(width, height) * 0.1;

  for (let iter = 0; iter < 200; iter++) {
    const fx = new Float64Array(n);
    const fy = new Float64Array(n);

    // Repulsion between all pairs
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i === j) continue;
        const ddx = nodes[i].x - nodes[j].x;
        const ddy = nodes[i].y - nodes[j].y;
        const dist = Math.max(Math.hypot(ddx, ddy), 1);
        const f = (k * k) / dist;
        fx[i] += (ddx / dist) * f;
        fy[i] += (ddy / dist) * f;
      }
    }

    // Attraction along edges
    edges.forEach(([a, b]) => {
      const ddx = nodes[b].x - nodes[a].x;
      const ddy = nodes[b].y - nodes[a].y;
      const dist = Math.max(Math.hypot(ddx, ddy), 1);
      const f = (dist * dist) / k;
      fx[a] += (ddx / dist) * f;
      fy[a] += (ddy / dist) * f;
      fx[b] -= (ddx / dist) * f;
      fy[b] -= (ddy / dist) * f;
    });

    // Gentle gravity toward center
    nodes.forEach((node, i) => {
      fx[i] += (cx - node.x) * 0.025;
      fy[i] += (cy - node.y) * 0.025;
    });

    // Apply with temperature cooling
    nodes.forEach((node, i) => {
      const mag  = Math.hypot(fx[i], fy[i]) || 1;
      const step = Math.min(mag, temp);
      node.x += (fx[i] / mag) * step;
      node.y += (fy[i] / mag) * step;
      // Keep inside padded bounds
      const px = 105, py = 75;
      node.x = Math.max(px, Math.min(width  - px, node.x));
      node.y = Math.max(py, Math.min(height - py, node.y));
    });

    temp *= 0.97;
  }
}

/* ─── Map: render ───────────────────────────────────────────────── */

function renderMapLegend() {
  const legendEl = document.getElementById("map-legend");
  if (!legendEl) return;
  const categories = [...new Set(state.themes.map(t => getCategoryForTheme(t.slug)))];
  legendEl.innerHTML = categories.map(cat =>
    `<span class="map-legend-item">
       <span class="map-legend-dot" style="background:${CATEGORY_COLORS[cat] || "#999"}"></span>
       ${esc(CATEGORY_LABELS[cat] || cat)}
     </span>`
  ).join("");
}

function renderMap() {
  const canvas = document.getElementById("map-canvas");
  const svg    = document.getElementById("map-svg");
  if (!canvas || !svg || !state.themes.length) return;

  const { width, height } = canvas.getBoundingClientRect();
  if (width < 100 || height < 100) return;

  // Build node list
  const slugIndex = new Map(state.themes.map((t, i) => [t.slug, i]));
  const nodes = state.themes.map(t => ({
    slug:      t.slug,
    title:     t.title,
    count:     t.work_count ?? 0,
    authors:   (t.key_author_names ?? []).slice(0, 2),
    category:  getCategoryForTheme(t.slug),
    neighbors: t.related_themes ?? [],
    x: 0, y: 0,
  }));

  // Build deduplicated edge list
  const edgeSet = new Set();
  const edgeList = [];
  state.themes.forEach(t => {
    (t.related_themes || []).forEach(relSlug => {
      const a = slugIndex.get(t.slug), b = slugIndex.get(relSlug);
      if (a == null || b == null) return;
      const key = [Math.min(a, b), Math.max(a, b)].join("-");
      if (!edgeSet.has(key)) { edgeSet.add(key); edgeList.push([a, b]); }
    });
  });

  forceLayout(nodes, edgeList, width, height);

  // Compute node degrees for variable sizing
  const nodeDegree = new Array(nodes.length).fill(0);
  edgeList.forEach(([a, b]) => { nodeDegree[a]++; nodeDegree[b]++; });
  const maxDeg = Math.max(...nodeDegree, 1);
  const cx = width / 2, cy = height / 2;

  // Render SVG edges as curved bezier paths
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.innerHTML = "";
  edgeList.forEach(([a, b]) => {
    const na = nodes[a], nb = nodes[b];
    const mx = (na.x + nb.x) / 2;
    const my = (na.y + nb.y) / 2;
    // Control point: midpoint offset away from canvas center
    const dx = mx - cx, dy = my - cy;
    const dist = Math.hypot(dx, dy) || 1;
    const edgeLen = Math.hypot(nb.x - na.x, nb.y - na.y);
    const curve = edgeLen * 0.18;
    const cpx = mx + (dx / dist) * curve;
    const cpy = my + (dy / dist) * curve;
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", `M ${na.x} ${na.y} Q ${cpx} ${cpy} ${nb.x} ${nb.y}`);
    path.setAttribute("class", "map-edge");
    path.setAttribute("fill", "none");
    path.dataset.a = na.slug;
    path.dataset.b = nb.slug;
    svg.appendChild(path);
  });

  // Remove old nodes then render new HTML nodes
  canvas.querySelectorAll(".map-node").forEach(el => el.remove());

  nodes.forEach((node, i) => {
    const color = CATEGORY_COLORS[node.category] || "#999";
    const degree = nodeDegree[i];
    const nodeWidth = 148 + Math.round((degree / maxDeg) * 24); // 148–172px
    const el = document.createElement("div");
    el.className = "map-node";
    el.style.cssText = `left:${node.x}px; top:${node.y}px; --cat-color:${color}; --node-w:${nodeWidth}px;`;
    el.setAttribute("tabindex", "0");
    el.setAttribute("role", "button");
    el.setAttribute("aria-label", `Ver tema: ${node.title}`);
    el.dataset.slug = node.slug;

    el.innerHTML = `
      <div class="map-node__inner">
        <div class="map-node__header">
          <span class="map-node__dot"></span>
          <span class="map-node__title">${esc(node.title)}</span>
        </div>
        <div class="map-node__count">${node.count} obra${node.count !== 1 ? "s" : ""}</div>
        <div class="map-node__authors">${node.authors.map(esc).join(" · ")}</div>
      </div>`;

    const navigate = () => {
      switchView("temas");
      state.selectedSlug = node.slug;
      state.activeTab = "overview";
      setHash(node.slug);
      applyFilters();
    };

    el.addEventListener("click", navigate);
    el.addEventListener("keydown", e => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); navigate(); }
    });

    // Hover: highlight connected nodes + edges
    el.addEventListener("mouseenter", () => {
      const neighbors = new Set(node.neighbors);
      canvas.querySelectorAll(".map-node").forEach(n => {
        n.classList.toggle("map-node--dim",
          n.dataset.slug !== node.slug && !neighbors.has(n.dataset.slug));
      });
      svg.querySelectorAll(".map-edge").forEach(e => {
        const connected = e.dataset.a === node.slug || e.dataset.b === node.slug;
        e.classList.toggle("map-edge--active", connected);
        e.classList.toggle("map-edge--dim", !connected);
      });
    });

    el.addEventListener("mouseleave", () => {
      canvas.querySelectorAll(".map-node").forEach(n => n.classList.remove("map-node--dim"));
      svg.querySelectorAll(".map-edge").forEach(e =>
        e.classList.remove("map-edge--active", "map-edge--dim"));
    });

    canvas.appendChild(el);
  });

  renderMapLegend();
}

// Re-render map on canvas resize
const _mapCanvas = document.getElementById("map-canvas");
if (_mapCanvas && "ResizeObserver" in window) {
  new ResizeObserver(() => { if (state.view === "mapa") renderMap(); }).observe(_mapCanvas);
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
    const [lightIndex, authors] = await Promise.all([
      fetchJson("content/themes/index-light.json"),
      fetchJson("content/authors.json"),
    ]);

    state.authors = authors;
    state.themes  = lightIndex.themes.sort((a, b) => a.title.localeCompare(b.title, "es"));
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
navMapa.addEventListener("click",    () => switchView("mapa"));

window.addEventListener("hashchange", () => {
  const slug = getSlugFromHash();
  if (!slug || slug === state.selectedSlug) return;
  state.selectedSlug = slug;
  state.activeTab = "overview";
  if (state.view !== "temas") switchView("temas");
  renderList();
  renderDetail();
});

/* ─── Works search modal (Pagefind) ─────────────────────────────── */

const worksModal    = document.querySelector("#works-search-modal");
const openWorksBtn  = document.querySelector("#open-works-search");
const closeWorksBtn = document.querySelector("#close-works-search");
const modalOverlay  = document.querySelector("#works-modal-overlay");
let pagefindLoaded  = false;

async function openWorksSearch() {
  worksModal.hidden = false;
  document.body.classList.add("modal-open");

  if (!pagefindLoaded) {
    pagefindLoaded = true;
    try {
      const [{ PagefindUI }, _css] = await Promise.all([
        import("./pagefind/pagefind-ui.js"),
        loadPagefindCSS(),
      ]);
      new PagefindUI({
        element: "#pagefind-search-ui",
        showImages: false,
        showEmptyFilters: false,
        resetStyles: false,
        translations: {
          placeholder: "Buscar obra, autor, concepto…",
          zero_results: "Sin resultados para [SEARCH_TERM]",
          many_results: "[COUNT] resultados para [SEARCH_TERM]",
          one_result: "1 resultado para [SEARCH_TERM]",
          load_more: "Más resultados",
          search_label: "Buscar en obras",
          filters_label: "Filtros",
        },
      });
      // Auto-focus search input
      const pfInput = worksModal.querySelector("input[type=text]");
      if (pfInput) pfInput.focus();
    } catch (err) {
      document.querySelector("#pagefind-search-ui").innerHTML =
        `<p class="empty-state">No se pudo cargar la búsqueda de obras. Asegúrate de ejecutar <code>npm run build</code> primero.</p>`;
    }
  } else {
    const pfInput = worksModal.querySelector("input[type=text]");
    if (pfInput) pfInput.focus();
  }
}

function loadPagefindCSS() {
  if (document.querySelector('link[href*="pagefind-ui"]')) return Promise.resolve();
  return new Promise(resolve => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "./pagefind/pagefind-ui.css";
    link.onload = resolve;
    link.onerror = resolve;
    document.head.appendChild(link);
  });
}

function closeWorksSearch() {
  worksModal.hidden = true;
  document.body.classList.remove("modal-open");
  openWorksBtn.focus();
}

openWorksBtn.addEventListener("click", openWorksSearch);
closeWorksBtn.addEventListener("click", closeWorksSearch);
modalOverlay.addEventListener("click", closeWorksSearch);
worksModal.addEventListener("keydown", e => { if (e.key === "Escape") closeWorksSearch(); });

init();
