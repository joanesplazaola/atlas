// core.js — shared state, DOM handles, pure helpers and content config.

const state = {
  manifest: null,
  beginnerTrack: null, // cross-theme "Primeros pasos" track (content/beginner-track.json)
  themes: [], // light theme objects from index-light.json (fast sidebar)
  authors: [], // canonical authors registry
  filteredThemes: [],
  selectedSlug: null,
  selectedWorkId: null,
  selectedAuthorId: null, // author detail panel
  activeTab: "overview",
  query: "",
  activeConcept: null,
  activeAuthor: null, // author filter from author index view
  activeCategory: null, // category filter (politica|economia|historia|social|filosofia)
  view: "temas", // "temas" | "autores" | "mapa"
  themeCache: new Map(), // slug → full theme JSON (loaded on demand)
  worksCache: new Map(), // work_id → canonical work JSON (loaded on demand)
};

const appEl = /** @type {HTMLElement} */ (document.querySelector(".app"));
const themeList = /** @type {HTMLElement} */ (document.querySelector("#theme-grid"));
const detailEmpty = /** @type {HTMLElement} */ (document.querySelector("#detail-empty"));
const detailContent = /** @type {HTMLElement} */ (document.querySelector("#detail-content"));
const stats = /** @type {HTMLElement} */ (document.querySelector("#stats"));
const searchInput = /** @type {HTMLInputElement} */ (document.querySelector("#search-input"));
const activeFilter = /** @type {HTMLElement} */ (document.querySelector("#active-filter"));
const navTemas = /** @type {HTMLElement} */ (document.querySelector("#nav-temas"));
const navAutores = /** @type {HTMLElement} */ (document.querySelector("#nav-autores"));
const navMapa = /** @type {HTMLElement} */ (document.querySelector("#nav-mapa"));
const navEmpezar = /** @type {HTMLElement} */ (document.querySelector("#nav-empezar"));
const mapViewEl = /** @type {HTMLElement} */ (document.querySelector("#map-view"));
/* ─── Helpers ──────────────────────────────────────────────────── */

function getSlugFromHash() {
  const match = window.location.hash.match(/^#tema\/([a-z0-9-]+)/);
  return match ? match[1] : null;
}

function getAuthorFromHash() {
  const match = window.location.hash.match(/^#autor\/([a-z0-9-]+)/);
  return match ? match[1] : null;
}

function getWorkFromHash() {
  const match = window.location.hash.match(/^#obra\/([a-z0-9-]+)/);
  return match ? match[1] : null;
}

function setHash(slug) {
  const next = `#tema/${slug}`;
  if (window.location.hash !== next) window.location.hash = next;
}

function setAuthorHash(id) {
  const next = `#autor/${id}`;
  if (window.location.hash !== next) window.location.hash = next;
}

function setWorkHash(id) {
  const next = `#obra/${id}`;
  if (window.location.hash !== next) window.location.hash = next;
}

function esc(v) {
  return String(v)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function norm(v) {
  return v
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

// Author names live only in the canonical registry (content/authors.json).
function authorName(id) {
  return state.authors.find((a) => a.id === id)?.name ?? id;
}

function keyAuthorNames(theme) {
  return theme.key_author_names ?? (theme.key_authors ?? []).map((a) => authorName(a.id));
}
const levelLabel = { introductory: "Introductorio", intermediate: "Intermedio", advanced: "Avanzado" };
const levelBadge = { introductory: "badge--intro", intermediate: "badge--inter", advanced: "badge--advanced" };
const effortLabel = { short: "corto", medium: "medio", long: "largo" };
const kindLabel = {
  article: "artículo",
  chapter: "capítulo",
  book: "libro",
  pamphlet: "folleto",
  speech: "discurso",
  letter: "carta",
};
const routeAccent = { introductory: "var(--green)", intermediate: "var(--yellow)", advanced: "var(--red)" };
function buildSearchText(t) {
  const authorText = (t.key_authors ?? []).map((a) => `${authorName(a.id)} ${a.role ?? ""} ${a.why_relevant ?? ""}`);
  return norm(
    [
      t.title,
      t.summary,
      ...(authorText.length ? authorText : keyAuthorNames(t)),
      ...(t.concept_labels ?? t.connected_concepts?.map((c) => `${c.label} ${c.relation}`) ?? []),
    ].join(" "),
  );
}

function parseYearRange(years) {
  if (!years) return {};
  const nums = String(years).match(/\d{4}/g)?.map(Number) ?? [];
  return { start: nums[0] ?? null, end: nums[1] ?? nums[0] ?? null };
}
function workDetailLink(work, className, text = work?.title) {
  if (!work?.id) return `<span class="${className}">${esc(text || "")}</span>`;
  return `<a class="${className}" href="#obra/${work.id}">${esc(text || work.title)}</a>`;
}
function switchMobileView(view) {
  appEl.setAttribute("data-view", view);
}
/* ─── Data loading ─────────────────────────────────────────────── */

async function fetchJson(path) {
  const r = await fetch(path, { cache: "no-cache" });
  if (!r.ok) throw new Error(`No se pudo cargar ${path}`);
  return r.json();
}

// ── Content config (loaded from content/taxonomy.json & timeline.json) ──
export let HISTORICAL_CONTEXT_EVENTS = [];
export let CATEGORY_ORDER = [];
export let THEME_CATEGORIES = {};
export let CATEGORY_COLORS = {};
export let CATEGORY_LABELS = {};

export function getCategoryForTheme(slug) {
  return THEME_CATEGORIES[slug] || "politica";
}

export function setTaxonomy(taxonomy) {
  CATEGORY_ORDER = taxonomy.categories.order;
  CATEGORY_LABELS = taxonomy.categories.labels;
  CATEGORY_COLORS = taxonomy.categories.colors;
  THEME_CATEGORIES = taxonomy.themes;
}

export function setTimeline(timeline) {
  HISTORICAL_CONTEXT_EVENTS = timeline.events;
}

export {
  state,
  appEl,
  themeList,
  detailEmpty,
  detailContent,
  stats,
  searchInput,
  activeFilter,
  navTemas,
  navAutores,
  navMapa,
  navEmpezar,
  mapViewEl,
  getSlugFromHash,
  getAuthorFromHash,
  getWorkFromHash,
  setHash,
  setAuthorHash,
  setWorkHash,
  esc,
  norm,
  authorName,
  keyAuthorNames,
  levelLabel,
  levelBadge,
  effortLabel,
  kindLabel,
  routeAccent,
  buildSearchText,
  parseYearRange,
  workDetailLink,
  switchMobileView,
  fetchJson,
};
