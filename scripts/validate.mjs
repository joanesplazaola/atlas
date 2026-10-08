/**
 * validate.mjs — Atlas Marxista content validator
 *
 * Two layers of checks:
 *   1. Structural  — JSON Schema validation (Ajv) for every ficha and obra.
 *   2. Referential — every cross-reference resolves, and every id is unique.
 *
 * Run: npm run validate
 */

import Ajv from "ajv";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { readFileSync } from "fs";
import { join, basename } from "path";

const ROOT = process.cwd();
const read = (p) => JSON.parse(readFileSync(join(ROOT, p), "utf8"));

const errors = [];
const warnings = [];
const error = (msg) => errors.push(msg);
const warn = (msg) => warnings.push(msg);

/* ── Load schemas ──────────────────────────────────────────────── */

const ajvWork = new Ajv({ allErrors: true, strict: false });
addFormats(ajvWork);
const validateWork = ajvWork.compile(read("schema/work.schema.json"));

const ajvTheme = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajvTheme);
const validateTheme = ajvTheme.compile(read("schema/theme-entry.schema.json"));

const formatAjvErrors = (errs) => (errs ?? []).map((e) => `    ${e.instancePath || "/"} ${e.message}`).join("\n");

/* ── Load content ──────────────────────────────────────────────── */

const authors = read("content/authors.json");
const workFiles = read("content/works/index.json").work_files;
const themeFiles = read("content/themes/index.json").theme_files;

const works = workFiles.map((p) => ({ path: p, data: read(p) }));
const themes = themeFiles.map((p) => ({ path: p, data: read(p) }));

const authorIds = new Set(authors.map((a) => a.id));
const workIds = new Set(works.map((w) => w.data.id));
const themeSlugs = new Set(themes.map((t) => t.data.slug));

/* ── 1. Structural validation ──────────────────────────────────── */

for (const { path, data } of themes) {
  if (!validateTheme(data)) error(`${path}\n${formatAjvErrors(validateTheme.errors)}`);
}

for (const { path, data } of works) {
  if (!validateWork(data)) error(`${path}\n${formatAjvErrors(validateWork.errors)}`);
}

/* ── 2. Uniqueness ─────────────────────────────────────────────── */

const seenAuthorIds = new Set();
for (const a of authors) {
  if (seenAuthorIds.has(a.id)) error(`content/authors.json: duplicate author id "${a.id}"`);
  seenAuthorIds.add(a.id);
}

const seenWorkIds = new Set();
for (const { path, data } of works) {
  if (seenWorkIds.has(data.id)) error(`${path}: duplicate work id "${data.id}"`);
  seenWorkIds.add(data.id);
  if (basename(path, ".json") !== data.id) {
    error(`${path}: file name does not match id "${data.id}"`);
  }
}

const seenSlugs = new Set();
for (const { path, data } of themes) {
  if (seenSlugs.has(data.slug)) error(`${path}: duplicate theme slug "${data.slug}"`);
  seenSlugs.add(data.slug);
  if (basename(path, ".json") !== data.slug) {
    error(`${path}: file name does not match slug "${data.slug}"`);
  }
}

/* ── 3. Referential integrity ──────────────────────────────────── */

const checkWork = (file, where, id) => {
  if (id && !workIds.has(id)) error(`${file}: ${where} references unknown work "${id}"`);
};
const checkAuthor = (file, where, id) => {
  if (id && !authorIds.has(id)) error(`${file}: ${where} references unknown author "${id}"`);
};
const checkTheme = (file, where, slug) => {
  if (slug && !themeSlugs.has(slug)) error(`${file}: ${where} references unknown theme "${slug}"`);
};

for (const a of authors) {
  for (const slug of a.themes ?? []) checkTheme("content/authors.json", `author "${a.id}"`, slug);
}

for (const { path, data } of works) {
  for (const id of data.author_ids ?? []) checkAuthor(path, "author_ids", id);
}

for (const { path, data } of themes) {
  for (const a of data.key_authors ?? []) checkAuthor(path, "key_authors", a.id);

  for (const ref of data.essential_works ?? []) checkWork(path, "essential_works", ref.work_id);

  for (const c of data.connected_concepts ?? []) {
    if (c.id === data.slug) warn(`${path}: concept "${c.id}" shadows the theme slug`);
  }

  for (const slug of data.related_themes ?? []) checkTheme(path, "related_themes", slug);

  const debateIds = new Set();
  for (const d of data.historical_debates ?? []) {
    if (debateIds.has(d.id)) error(`${path}: duplicate debate id "${d.id}"`);
    debateIds.add(d.id);
    for (const id of d.participant_author_ids ?? []) checkAuthor(path, `debate "${d.id}"`, id);
    for (const id of d.related_work_ids ?? []) checkWork(path, `debate "${d.id}"`, id);
    for (const p of d.positions ?? []) {
      checkAuthor(path, `debate "${d.id}" position`, p.author_id);
      checkWork(path, `debate "${d.id}" position`, p.work_id);
    }
  }

  for (const rp of data.reading_paths ?? []) {
    if (rp.id === undefined) error(`${path}: reading path without id`);
    for (const step of rp.steps ?? []) checkWork(path, `reading path "${rp.id}"`, step.work_id);
  }

  const g = data.study_guidance;
  if (g) {
    checkWork(path, "study_guidance.start_here", g.start_here?.work_id);
    checkWork(path, "study_guidance.after_this", g.after_this?.work_id);
    const debate = g.debate_to_watch?.debate_id;
    if (debate && !debateIds.has(debate)) {
      error(`${path}: study_guidance.debate_to_watch references unknown debate "${debate}"`);
    }
  }
}

/* ── 4. Taxonomy & timeline ────────────────────────────────────── */

const taxonomy = read("content/taxonomy.json");
const timeline = read("content/timeline.json");

const categoryIds = new Set(taxonomy.categories.order);
if (categoryIds.size !== taxonomy.categories.order.length) {
  error("content/taxonomy.json: duplicate category in categories.order");
}
for (const [cat, label] of Object.entries(taxonomy.categories.labels)) {
  if (!categoryIds.has(cat)) error(`content/taxonomy.json: label for unknown category "${cat}"`);
  if (!label) error(`content/taxonomy.json: empty label for category "${cat}"`);
}
for (const [cat, color] of Object.entries(taxonomy.categories.colors)) {
  if (!categoryIds.has(cat)) error(`content/taxonomy.json: color for unknown category "${cat}"`);
  if (!color) error(`content/taxonomy.json: empty color for category "${cat}"`);
}
for (const [slug, cat] of Object.entries(taxonomy.themes)) {
  if (!themeSlugs.has(slug)) error(`content/taxonomy.json: unknown theme "${slug}"`);
  if (!categoryIds.has(cat)) error(`content/taxonomy.json: theme "${slug}" has unknown category "${cat}"`);
}
for (const { data } of themes) {
  if (!(data.slug in taxonomy.themes)) warn(`${data.slug}: sin categoría en taxonomy.json`);
}

for (const ev of timeline.events) {
  if (!Number.isInteger(ev.year)) error(`content/timeline.json: event "${ev.label}" has non-integer year`);
  for (const tag of ev.tags ?? []) checkTheme("content/timeline.json", `event "${ev.label}"`, tag);
}

/* ── 4b. Beginner track ────────────────────────────────────────── */

const track = read("content/beginner-track.json");
if (!track.id) error("content/beginner-track.json: missing id");
if (!track.title) error("content/beginner-track.json: missing title");
if (!Array.isArray(track.steps) || !track.steps.length) {
  error("content/beginner-track.json: steps must be a non-empty array");
}
const themeBySlug = new Map(themes.map((t) => [t.data.slug, t.data]));
(track.steps ?? []).forEach((step, i) => {
  const where = `content/beginner-track.json: step ${i + 1}`;
  if (step.position !== i + 1) error(`${where}: position should be ${i + 1}`);
  checkWork(where, "work_id", step.work_id);
  checkTheme(where, "theme_slug", step.theme_slug);
  if (!Number.isInteger(step.minutes) || step.minutes <= 0) error(`${where}: minutes must be a positive integer`);
  const theme = themeBySlug.get(step.theme_slug);
  if (theme && !(theme.essential_works ?? []).some((ref) => ref.work_id === step.work_id)) {
    warn(`${where}: "${step.work_id}" is not an essential work of theme "${step.theme_slug}"`);
  }
});

/* ── 5. Warnings ───────────────────────────────────────────────── */

const referencedWorks = new Set();
for (const { data } of themes) {
  for (const ref of data.essential_works ?? []) referencedWorks.add(ref.work_id);
  for (const rp of data.reading_paths ?? []) {
    for (const step of rp.steps ?? []) referencedWorks.add(step.work_id);
  }
  for (const d of data.historical_debates ?? []) {
    for (const id of d.related_work_ids ?? []) referencedWorks.add(id);
    for (const p of d.positions ?? []) if (p.work_id) referencedWorks.add(p.work_id);
  }
  const g = data.study_guidance;
  if (g?.start_here?.work_id) referencedWorks.add(g.start_here.work_id);
  if (g?.after_this?.work_id) referencedWorks.add(g.after_this.work_id);
}
for (const { data } of works) {
  if (!referencedWorks.has(data.id)) {
    warn(`${data.id}: obra no incluida en ninguna ficha (orphan)`);
  }
}

/* ── Report ────────────────────────────────────────────────────── */

for (const w of warnings) console.warn(`  ! ${w}`);

if (errors.length) {
  console.error(`\n✗ Validación fallida — ${errors.length} error(es):\n`);
  for (const e of errors) console.error(`  ✗ ${e}`);
  process.exit(1);
}

console.log(
  `✓ ${themes.length} fichas + ${works.length} obras + ${authors.length} autores validados` +
    (warnings.length ? ` (${warnings.length} aviso(s))` : ""),
);
