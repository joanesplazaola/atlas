// app.js — entry point: data bootstrap, view switching and event wiring.

import {
  state,
  esc,
  getSlugFromHash,
  getAuthorFromHash,
  getWorkFromHash,
  setHash,
  setAuthorHash,
  switchMobileView,
  fetchJson,
  themeList,
  searchInput,
  navTemas,
  navAutores,
  navMapa,
  setTaxonomy,
  setTimeline,
} from "./js/core.js";
import { applyFilters, switchView, renderDetail, renderList, renderAuthorList, renderSkeleton } from "./js/ui.js";
import { initMapInteraction } from "./js/map.js";
import "./js/pagefind.js";
import "./js/theme.js";

async function init() {
  renderSkeleton();
  try {
    const [lightIndex, authors, taxonomy, timeline] = await Promise.all([
      fetchJson("content/themes/index-light.json"),
      fetchJson("content/authors.json"),
      fetchJson("content/taxonomy.json"),
      fetchJson("content/timeline.json"),
    ]);

    setTaxonomy(taxonomy);
    setTimeline(timeline);

    state.authors = authors;
    state.themes = lightIndex.themes.sort((a, b) => a.title.localeCompare(b.title, "es"));

    const workId = getWorkFromHash();
    const authorId = getAuthorFromHash();
    if (workId) {
      state.selectedWorkId = workId;
      state.selectedSlug = null;
      applyFilters();
      switchView("temas");
      switchMobileView("detail");
    } else if (authorId) {
      state.selectedAuthorId = authorId;
      state.selectedWorkId = null;
      state.selectedSlug = null;
      applyFilters();
      switchView("autores");
      switchMobileView("detail");
    } else {
      state.selectedWorkId = null;
      state.selectedSlug = getSlugFromHash() || null;
      if (state.selectedSlug) {
        setHash(state.selectedSlug);
        switchMobileView("detail");
      }
      applyFilters();
    }

    initMapInteraction();
  } catch (err) {
    themeList.innerHTML = `<div class="empty-state">Error al cargar el contenido: ${esc(err.message)}</div>`;
  }
}

/* ─── Event listeners ──────────────────────────────────────────── */

searchInput.addEventListener("input", (e) => {
  state.query = /** @type {HTMLInputElement} */ (e.target).value;
  applyFilters();
});

navTemas.addEventListener("click", () => {
  state.selectedWorkId = null;
  if (state.selectedSlug) setHash(state.selectedSlug);
  else window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
  switchView("temas");
  renderDetail();
});
navAutores.addEventListener("click", () => {
  state.selectedWorkId = null;
  if (state.selectedAuthorId) setAuthorHash(state.selectedAuthorId);
  else window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
  switchView("autores");
  renderDetail();
});
navMapa.addEventListener("click", () => {
  state.selectedWorkId = null;
  switchView("mapa");
});

window.addEventListener("hashchange", () => {
  const workId = getWorkFromHash();
  if (workId) {
    state.selectedWorkId = workId;
    state.activeTab = "overview";
    if (state.view !== "temas") switchView("temas");
    else renderDetail();
    switchMobileView("detail");
    return;
  }

  const authorId = getAuthorFromHash();
  if (authorId) {
    if (authorId === state.selectedAuthorId && state.view === "autores") return;
    state.selectedWorkId = null;
    state.selectedAuthorId = authorId;
    if (state.view !== "autores") switchView("autores");
    else {
      renderAuthorList();
      renderDetail();
    }
    switchMobileView("detail");
    return;
  }

  const slug = getSlugFromHash();
  if (!slug) {
    state.selectedWorkId = null;
    switchMobileView("list");
    return;
  }
  if (slug === state.selectedSlug && !state.selectedWorkId) return;
  state.selectedWorkId = null;
  state.selectedSlug = slug;
  state.activeTab = "overview";
  if (state.view !== "temas") switchView("temas");
  renderList();
  renderDetail();
  switchMobileView("detail");
});

init();
