// pagefind.js — works-search modal (Pagefind UI), lazy-loaded.

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
        import("../pagefind/pagefind-ui.js"),
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
    link.href = "../pagefind/pagefind-ui.css";
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
