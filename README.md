# Atlas marxista de lectura

Capa de navegación y estudio sobre [Marxists Internet Archive](https://www.marxists.org/espanol/).
Organiza temas, autores, obras, debates y rutas de lectura, y **enlaza** a los textos
originales: no los reproduce ni los sustituye.

Sitio estático (HTML + ES modules + CSS), sin framework. El contenido es JSON validado
contra JSON Schema y la búsqueda usa [Pagefind](https://pagefind.app/).

## Requisitos

- Node.js 20+
- Python 3 (solo para servir el sitio en local y en los tests)

## Comandos

```bash
npm ci            # instalar dependencias
npm run validate  # validar fichas y obras (estructura + integridad referencial)
npm run build     # genera el índice de búsqueda (pagefind/) y el índice ligero
npm test          # build + suite Playwright
```

`npm run build` ejecuta la validación antes de construir (`prebuild`), y `npm test`
construye antes de lanzar los tests (`pretest`). No hace falta ejecutarlos por separado.

Para desarrollo local:

```bash
npm run build
python3 -m http.server 4175
# abre http://localhost:4175
```

## Estructura

```
content/
  authors.json            Registro canónico de autores (fuente única de identidad)
  works/                  Una obra por archivo + index.json (manifiesto)
  themes/                 Una ficha por tema + index.json (manifiesto)
  taxonomy.json           Categorías (orden, etiquetas, colores) y su asignación a temas
  timeline.json           Hitos históricos usados en las cronologías de autor
schema/                   JSON Schema de fichas y obras
scripts/validate.mjs      Validador (estructura + integridad referencial)
build.js                  Pipeline de build (Pagefind + índice ligero)
js/                       Código del cliente, en módulos ES
  core.js                 Estado, referencias al DOM, helpers y configuración de contenido
  data.js                 Carga de datos y agregación de autores
  ui.js                   Render de temas/obras/autores y pipeline de filtros
  map.js                  Mapa de conexiones (layout dirigido por fuerzas, pan/zoom)
  pagefind.js             Modal de búsqueda en obras
  theme.js                Selector de tema visual
css/                      Estilos divididos por área (tokens, layout, detalle, mapa, temas…)
app.js                    Punto de entrada: bootstrap y eventos
tests/                    Tests end-to-end (Playwright)
```

## Modelo de datos

- **`authors.json` es la única fuente de identidad de autor.** Las fichas solo guardan
  `id` + `role` + `why_relevant`; los nombres se resuelven desde el registro en build y
  en tiempo de render. Esto evita que los nombres diverjan entre fichas.
- **Las obras son canónicas.** Cada tema las referencia por `work_id` y añade una capa
  editorial (`level`, `estimated_effort`, `reason_to_read`).
- **Los manifiestos** (`content/works/index.json`, `content/themes/index.json`) listan
  los archivos; el validador comprueba que cada entrada apunte a un archivo existente y
  que el nombre del archivo coincida con su `id`/`slug`.
- **Integridad referencial**: el validador comprueba que cada `work_id`, `author_id` y
  tema relacionado existan, que los ids sean únicos y que ninguna obra quede huérfana.

### Archivos generados (no versionados)

`npm run build` genera, y `.gitignore` excluye:

- `pagefind/` — índice de búsqueda
- `content/themes/index-light.json` — proyección ligera de las fichas para el sidebar

No los edites a mano: se regeneran en cada build. El despliegue (GitHub Pages) construye
antes de publicar.

## Añadir contenido

1. **Obra nueva**: crea `content/works/<id>.json` (ver `schema/work.schema.json`) y
   añádela a `content/works/index.json`.
2. **Tema nuevo**: crea `content/themes/<slug>.json` (ver `schema/theme-entry.schema.json`),
   añádelo a `content/themes/index.json` y asígnale una categoría en `content/taxonomy.json`.
3. Ejecuta `npm run validate`: fallará si hay referencias rotas, ids duplicados o nombres
   de archivo que no coinciden. Corrige y vuelve a ejecutar.

El validador también avisa (sin fallar) de obras no incluidas en ninguna ficha.

## Tests

Los tests end-to-end de Playwright cubren carga, navegación por hash, tabs, filtros,
vista de autores, mapa y UX móvil. Requieren haber construido antes (`npm test` lo hace).

## Despliegue

GitHub Actions:

- `.github/workflows/ci.yml` — valida contenido y ejecuta los tests.
- `.github/workflows/pages.yml` — construye y publica en GitHub Pages.

## Licencia y atribución

Los textos enlazados pertenecen a sus fuentes originales (Marxists Internet Archive y
autores). Este proyecto solo ofrece orientación editorial y enlaces.
