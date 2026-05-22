/**
 * build.js — Atlas Marxista build pipeline
 *
 * 1. Reads all works from content/works/*.json
 * 2. Reads all themes from content/themes/index.json + individual fichas
 * 3. Builds a Pagefind search index using the programmatic Node.js API
 * 4. Writes the index to pagefind/ (served statically by GitHub Pages)
 *
 * Run: node build.js
 */

import { createIndex } from 'pagefind';
import { readFileSync, readdirSync, writeFileSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();

function readJson(path) {
  return JSON.parse(readFileSync(join(ROOT, path), 'utf8'));
}

async function main() {
  console.log('📖 Atlas Marxista — build');

  // ── Load data ────────────────────────────────────────────────────
  const authors = readJson('content/authors.json');
  const authorMap = new Map(authors.map(a => [a.id, a]));

  // Load all works
  const worksIndex = readJson('content/works/index.json');
  const works = worksIndex.work_files.map(p => readJson(p));
  const workMap = new Map(works.map(w => [w.id, w]));
  console.log(`  Loaded ${works.length} works`);

  // Load themes (full fichas for Pagefind indexing)
  const themesIndex = readJson('content/themes/index.json');
  const themes = themesIndex.theme_files.map(p => readJson(p));
  console.log(`  Loaded ${themes.length} themes`);

  // ── Build Pagefind index ─────────────────────────────────────────
  console.log('🔍 Building Pagefind search index…');
  const { index } = await createIndex({
    rootSelector: 'html',
    verbose: false,
  });

  let indexed = 0;

  // Index each work as an individual searchable record
  for (const work of works) {
    const authorNames = work.author_ids
      .map(id => authorMap.get(id)?.name ?? id)
      .join(', ');

    // Find which themes reference this work and what reason_to_read they give
    const themeRefs = themes
      .filter(t => t.essential_works.some(r => r.work_id === work.id))
      .map(t => {
        const ref = t.essential_works.find(r => r.work_id === work.id);
        return `[${t.title}] ${ref.reason_to_read}`;
      });

    const content = [
      work.title,
      authorNames,
      String(work.year),
      work.kind,
      ...themeRefs,
    ].join(' — ');

    await index.addCustomRecord({
      url: `/#obra/${work.id}`,
      content,
      meta: {
        title: work.title,
        author: authorNames,
        year: String(work.year),
        kind: work.kind,
        work_id: work.id,
        source_url: work.source.url,
      },
      language: 'es',
      filters: {
        kind: [work.kind],
        author: work.author_ids.map(id => authorMap.get(id)?.name ?? id),
        year_range: [yearRange(work.year)],
      },
    });
    indexed++;
  }

  // Index each theme as a record too
  for (const theme of themes) {
    const authorNames = theme.key_authors.map(a => a.name).join(', ');
    const concepts = theme.connected_concepts?.map(c => c.label).join(', ') ?? '';

    const content = [
      theme.title,
      theme.summary,
      theme.editorial_intent,
      authorNames,
      concepts,
      ...theme.historical_debates.map(d => d.label + ' ' + d.description),
    ].join(' — ');

    await index.addCustomRecord({
      url: `/#tema/${theme.slug}`,
      content,
      meta: {
        title: theme.title,
        type: 'theme',
        theme_slug: theme.slug,
      },
      language: 'es',
      filters: {
        type: ['theme'],
        author: theme.key_authors.map(a => a.name),
      },
    });
    indexed++;
  }

  console.log(`  Indexed ${indexed} records (${works.length} obras + ${themes.length} temas)`);

  // ── Write Pagefind index ─────────────────────────────────────────
  const { errors } = await index.writeFiles({
    outputPath: join(ROOT, 'pagefind'),
  });

  if (errors.length) {
    console.error('Pagefind errors:', errors);
    process.exit(1);
  }

  console.log('  ✓ Pagefind index written to pagefind/');

  // ── Regenerate index-light.json ──────────────────────────────────
  const lightEntries = themes.map(d => ({
    slug: d.slug,
    title: d.title,
    summary: d.summary,
    key_author_ids:   d.key_authors.map(a => a.id),
    key_author_names: d.key_authors.map(a => a.name),
    concept_labels:   (d.connected_concepts ?? []).map(c => c.label),
    concept_ids:      (d.connected_concepts ?? []).map(c => c.id),
    related_themes:   d.related_themes ?? [],
    work_count:       d.essential_works.length,
  }));

  writeFileSync(
    join(ROOT, 'content/themes/index-light.json'),
    JSON.stringify({ generated_at: new Date().toISOString().slice(0, 10), themes: lightEntries }, null, 2)
  );
  console.log('  ✓ content/themes/index-light.json updated');

  console.log('✅ Build complete');
}

function yearRange(year) {
  if (year < 1850) return 'antes de 1850';
  if (year < 1900) return '1850–1899';
  if (year < 1930) return '1900–1929';
  if (year < 1960) return '1930–1959';
  return '1960+';
}

main().catch(err => { console.error(err); process.exit(1); });
