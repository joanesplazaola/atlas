// data.js — canonical data loading and author aggregation.

import { state, fetchJson } from "./core.js";

async function ensureWorksLoaded(ids) {
  const missing = ids.filter(Boolean).filter(id => !state.worksCache.has(id));
  if (!missing.length) return;
  const loaded = await Promise.all(missing.map(id => fetchJson(`content/works/${id}.json`)));
  loaded.forEach(work => state.worksCache.set(work.id, work));
}

async function ensureAllThemesLoaded() {
  const missing = state.themes
    .map(theme => theme.slug)
    .filter(slug => !state.themeCache.has(slug));
  if (missing.length) {
    const loaded = await Promise.all(missing.map(slug => fetchJson(`content/themes/${slug}.json`)));
    loaded.forEach(theme => state.themeCache.set(theme.slug, theme));
  }
  return state.themes.map(theme => state.themeCache.get(theme.slug)).filter(Boolean);
}
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

  // Canonical registry is the source of truth for author identity.
  const result = state.authors.map(a => ({
    ...a,
    themes: themesByAuthor.get(a.id) || [],
  })).filter(a => a.themes.length > 0);

  return result.sort((a, b) => a.name.localeCompare(b.name, "es"));
}

export { ensureWorksLoaded, ensureAllThemesLoaded, getAllAuthors };
