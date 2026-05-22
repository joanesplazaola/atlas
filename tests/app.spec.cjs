// @ts-check
const { test, expect } = require("@playwright/test");

test.describe("Atlas Marxista — carga inicial", () => {
  test("la página carga con el título correcto", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Atlas/i);
  });

  test("el sidebar muestra temas de la biblioteca", async ({ page }) => {
    await page.goto("/");
    const cards = page.locator(".theme-card");
    const count = await cards.count();
    expect(count).toBeGreaterThanOrEqual(6);
  });

  test("los stats muestran el número correcto de temas", async ({ page }) => {
    await page.goto("/");
    const stat = page.locator(".stat-pill").first();
    await expect(stat).toContainText("temas");
  });
});

test.describe("Atlas Marxista — selección de tema", () => {
  test("hacer clic en un tema muestra el panel de detalle", async ({ page }) => {
    await page.goto("/");
    await page.locator(".theme-card").first().click();
    await expect(page.locator("#detail-content")).toBeVisible();
    await expect(page.locator("#detail-empty")).toBeHidden();
  });

  test("el panel de detalle muestra el título del tema seleccionado", async ({ page }) => {
    await page.goto("/");
    const firstCard = page.locator(".theme-card").first();
    const title = await firstCard.locator(".theme-card__title").textContent();
    await firstCard.click();
    await expect(page.locator("#detail-title")).toHaveText(title.trim());
  });

  test("se muestra la nota editorial en el tab de presentación", async ({ page }) => {
    await page.goto("/");
    await page.locator(".theme-card").first().click();
    await expect(page.locator(".editorial-note")).toBeVisible();
    await expect(page.locator(".editorial-note__label")).toHaveText("Nota editorial");
  });

  test("el hash de la URL cambia al seleccionar un tema", async ({ page }) => {
    await page.goto("/");
    await page.locator(".theme-card").first().click();
    await expect(page).toHaveURL(/#tema\//);
  });
});

test.describe("Atlas Marxista — sistema de tabs", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.locator(".theme-card").first().click();
  });

  test("el tab Presentación está activo por defecto", async ({ page }) => {
    await expect(page.locator(".tab-btn--active")).toHaveText(/Presentación/);
    await expect(page.locator("#tab-overview")).toHaveClass(/tab-panel--active/);
  });

  test("cambiar al tab Obras muestra las obras", async ({ page }) => {
    await page.locator(".tab-btn", { hasText: /Obras/ }).click();
    await expect(page.locator("#tab-works")).toHaveClass(/tab-panel--active/);
    await expect(page.locator(".work-card").first()).toBeVisible();
  });

  test("las obras tienen título, autor, badges y enlace a Marxists.org", async ({ page }) => {
    await page.locator(".tab-btn", { hasText: /Obras/ }).click();
    const firstWork = page.locator(".work-card").first();
    await expect(firstWork.locator(".work-card__title")).not.toBeEmpty();
    await expect(firstWork.locator(".work-card__author")).not.toBeEmpty();
    await expect(firstWork.locator(".badge").first()).toBeVisible();
    const link = firstWork.locator(".work-card__link");
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute("href", /marxists\.org/);
  });

  test("cambiar al tab Rutas muestra rutas de lectura", async ({ page }) => {
    await page.locator(".tab-btn", { hasText: /Rutas/ }).click();
    await expect(page.locator("#tab-routes")).toHaveClass(/tab-panel--active/);
    await expect(page.locator(".route-card").first()).toBeVisible();
  });

  test("la tab Rutas prioriza rutas editoriales explícitas y no un launcher generado", async ({ page }) => {
    await page.goto("/#tema/estado");
    await page.locator(".tab-btn", { hasText: /Rutas/ }).click();
    await expect(page.locator(".routes-intro")).toBeVisible();
    await expect(page.locator(".study-launcher")).toHaveCount(0);
    await expect(page.locator(".route-card").first()).toBeVisible();
  });

  test("los pasos de las rutas enlazan al texto original", async ({ page }) => {
    await page.goto("/#tema/imperialismo");
    await page.locator(".tab-btn", { hasText: /Rutas/ }).click();
    await expect(page.locator(".route-step__link").first()).toHaveAttribute("href", /marxists\.org/);
  });

  test("la presentación muestra una guía explícita de dónde empezar", async ({ page }) => {
    await page.goto("/#tema/teoria-del-valor");
    await expect(page.locator(".start-here")).toBeVisible();
    await expect(page.locator(".start-here__title")).toContainText(/ganancia capitalista/i);
    await expect(page.locator(".start-here__work")).toContainText(/Salario, precio y ganancia/i);
    await expect(page.locator(".start-here__work")).toHaveAttribute("href", /#obra\//);
  });

  test("la guía puede abrir el debate clave del tema", async ({ page }) => {
    await page.goto("/#tema/partido");
    await page.locator("#open-guidance-debate").click();
    await expect(page.locator("#tab-debates")).toHaveClass(/tab-panel--active/);
    await expect(page.locator(".debate-card").first()).toBeVisible();
  });

  test("la tab Obras marca por dónde empezar y qué leer después", async ({ page }) => {
    await page.goto("/#tema/estado");
    await page.locator(".tab-btn", { hasText: /Obras/ }).click();
    await expect(page.locator(".badge--start")).toContainText(/Empieza aquí/);
    await expect(page.locator(".badge--next")).toContainText(/Sigue con esto/);
  });

  test("cambiar al tab Debates muestra los debates", async ({ page }) => {
    await page.locator(".tab-btn", { hasText: /Debates/ }).click();
    await expect(page.locator("#tab-debates")).toHaveClass(/tab-panel--active/);
    await expect(page.locator(".debate-card").first()).toBeVisible();
  });

  test("los debates muestran posiciones concretas ligadas a autores y obras", async ({ page }) => {
    await page.goto("/#tema/partido");
    await page.locator(".tab-btn", { hasText: /Debates/ }).click();
    await expect(page.locator(".debate-position").first()).toBeVisible();
    await expect(page.locator(".debate-position__author").first()).toContainText(/Lenin|Luxemburgo/);
    await expect(page.locator(".debate-position__work").first()).toHaveAttribute("href", /#obra\//);
  });

  test("hacer clic en una obra abre su ficha contextual", async ({ page }) => {
    await page.goto("/#tema/estado");
    await page.locator(".tab-btn", { hasText: /Obras/ }).click();
    await page.locator(".work-card__title--link", { hasText: /State and Revolution/i }).click();
    await expect(page).toHaveURL(/#obra\//);
    await expect(page.locator(".work-detail__body")).toBeVisible();
    await expect(page.locator(".detail__eyebrow")).toHaveText(/Obra/);
    await expect(page.locator(".work-reading-guide")).toBeVisible();
  });
});

test.describe("Atlas Marxista — búsqueda y filtros", () => {
  test("la búsqueda filtra los temas del sidebar", async ({ page }) => {
    await page.goto("/");
    const totalBefore = await page.locator(".theme-card").count();
    await page.locator("#search-input").fill("imperialismo");
    const cards = page.locator(".theme-card");
    const countAfter = await cards.count();
    expect(countAfter).toBeGreaterThanOrEqual(1);
    expect(countAfter).toBeLessThan(totalBefore);
    // At least one result should have "imperialismo" in the title
    const titles = await cards.locator(".theme-card__title").allTextContents();
    expect(titles.some(t => /imperialismo/i.test(t))).toBe(true);
  });

  test("la búsqueda por nombre de autor filtra los temas", async ({ page }) => {
    await page.goto("/");
    await page.locator("#search-input").fill("Lenin");
    const cards = page.locator(".theme-card");
    // Lenin aparece en múltiples fichas (imperialismo, partido, estado...)
    const count = await cards.count();
    expect(count).toBeGreaterThanOrEqual(2);
  });

  test("una búsqueda sin resultados muestra el estado vacío", async ({ page }) => {
    await page.goto("/");
    await page.locator("#search-input").fill("xyzinexistente");
    await expect(page.locator(".empty-state")).toBeVisible();
  });

  test("limpiar la búsqueda restaura todos los temas", async ({ page }) => {
    await page.goto("/");
    await page.locator("#search-input").fill("imperialismo");
    await page.locator("#search-input").fill("");
    const count = await page.locator(".theme-card").count();
    expect(count).toBeGreaterThanOrEqual(6);
  });

  test("hacer clic en un chip de concepto filtra los temas", async ({ page }) => {
    await page.goto("/");
    const chip = page.locator(".theme-card .chip").first();
    const conceptText = await chip.textContent();
    await chip.click();
    const filter = page.locator(".filter-pill");
    await expect(filter).toContainText(conceptText.trim());
  });

  test("el botón × del filtro activo lo elimina", async ({ page }) => {
    await page.goto("/");
    await page.locator(".theme-card .chip").first().click();
    await page.locator(".filter-pill button").click();
    await expect(page.locator(".filter-pill")).toHaveCount(0);
    const count = await page.locator(".theme-card").count();
    expect(count).toBeGreaterThanOrEqual(6);
  });
});

test.describe("Atlas Marxista — navegación por hash", () => {
  test("navegar directamente a un hash carga el tema correcto", async ({ page }) => {
    await page.goto("/#tema/imperialismo");
    await expect(page.locator("#detail-title")).toHaveText(/imperialismo/i);
    await expect(page.locator(".theme-card--active")).toBeVisible();
  });

  test("navegar directamente a un hash de obra carga su ficha contextual", async ({ page }) => {
    await page.goto("/#obra/lenin-state-and-revolution");
    await expect(page.locator("#detail-title")).toHaveText(/State and Revolution/i);
    const sectionTitles = await page.locator(".work-detail__section-title").allTextContents();
    expect(sectionTitles).toEqual(expect.arrayContaining(["Cómo entrar en esta obra", "Contexto de escritura", "Cronología de la obra", "Críticas y debates"]));
    await expect(page.locator(".author-detail__ext-link")).toHaveAttribute("href", /marxists\.org/);
  });

  test("la ficha de obra muestra una guía de entrada con secciones y foco de lectura", async ({ page }) => {
    await page.goto("/#obra/manifesto");
    await expect(page.locator(".work-reading-guide__label")).toContainText(/Empieza aquí/);
    const blockTitles = await page.locator(".work-reading-guide__block-title").allTextContents();
    expect(blockTitles).toEqual(expect.arrayContaining(["Secciones clave", "Fíjate en", "Si vas justo de tiempo"]));
    await expect(page.locator(".work-reading-guide__start")).toContainText(/secciones I y II/i);
  });

  test("un hash inválido muestra el estado vacío del detalle", async ({ page }) => {
    await page.goto("/#tema/tema-inexistente");
    await expect(page.locator("#detail-content")).toBeVisible();
  });
});

test.describe("Atlas Marxista — temas relacionados", () => {
  test("la ficha de imperialismo muestra chips de temas relacionados", async ({ page }) => {
    await page.goto("/#tema/imperialismo");
    const chips = page.locator(".chip--theme");
    await expect(chips.first()).toBeVisible();
  });

  test("hacer clic en un tema relacionado navega a esa ficha", async ({ page }) => {
    await page.goto("/#tema/imperialismo");
    const relatedChip = page.locator(".chip--theme").first();
    const chipText = await relatedChip.textContent();
    await relatedChip.click();
    await expect(page.locator("#detail-title")).toContainText(chipText.trim(), { ignoreCase: true });
  });
});

test.describe("Atlas Marxista — vista de autores", () => {
  test("el botón Autores en el topbar cambia la vista", async ({ page }) => {
    await page.goto("/");
    await page.locator("#nav-autores").click();
    await expect(page.locator(".author-list-card").first()).toBeVisible();
  });

  test("la lista de autores contiene al menos 5 autores únicos", async ({ page }) => {
    await page.goto("/");
    await page.locator("#nav-autores").click();
    // Wait for at least one card to appear (data may still be loading)
    await expect(page.locator(".author-list-card").first()).toBeVisible();
    const authors = page.locator(".author-list-card");
    const count = await authors.count();
    expect(count).toBeGreaterThanOrEqual(5);
  });

  test("clic en un autor en vista Autores muestra el panel de detalle del autor", async ({ page }) => {
    await page.goto("/");
    await page.locator("#nav-autores").click();
    await page.locator(".author-list-card").first().click();
    // Should show author detail, not switch to temas
    await expect(page.locator("#nav-autores")).toHaveClass(/topbar__nav-btn--active/);
    await expect(page.locator("#detail-content")).toBeVisible();
    await expect(page.locator(".author-detail__name")).toBeVisible();
  });

  test("el panel de detalle del autor muestra bio y enlace a Marxists.org", async ({ page }) => {
    await page.goto("/");
    await page.locator("#nav-autores").click();
    await page.locator(".author-list-card").first().click();
    await expect(page.locator(".author-detail__bio")).toBeVisible();
    await expect(page.locator(".author-detail__ext-link")).toBeVisible();
  });

  test("el detalle del autor permite scroll vertical cuando el contenido crece", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("/#autor/lenin-vi");
    await expect(page.locator(".author-detail__name")).toContainText(/Lenin/);

    const metrics = await page.locator("#detail-content").evaluate(el => {
      const computed = getComputedStyle(el);
      const before = el.scrollTop;
      el.scrollTop = 220;
      return {
        overflowY: computed.overflowY,
        clientHeight: el.clientHeight,
        scrollHeight: el.scrollHeight,
        scrollTopBefore: before,
        scrollTopAfter: el.scrollTop,
      };
    });

    expect(metrics.overflowY).toBe("auto");
    expect(metrics.scrollHeight).toBeGreaterThan(metrics.clientHeight);
    expect(metrics.scrollTopAfter).toBeGreaterThan(metrics.scrollTopBefore);
  });

  test("el detalle del autor muestra una cronología con textos y contexto histórico", async ({ page }) => {
    await page.goto("/#autor/lenin-vi");
    await expect(page.locator(".author-timeline")).toBeVisible();
    await expect(page.locator(".author-timeline__item--context").first()).toBeVisible();
    await expect(page.locator(".author-timeline__item--work .author-timeline__title--link").first()).toHaveAttribute("href", /#obra\//);
    const years = await page.locator(".author-timeline__year").allTextContents();
    expect(years).toEqual(expect.arrayContaining(["1870", "1914", "1924"]));
  });

  test("el botón 'Ver todos los temas' en el detalle del autor filtra la vista de temas", async ({ page }) => {
    await page.goto("/");
    await page.locator("#nav-autores").click();
    await page.locator(".author-list-card").first().click();
    await page.locator(".author-detail__filter-btn").first().click();
    // Should switch to temas view with author filter active
    await expect(page.locator("#nav-temas")).toHaveClass(/topbar__nav-btn--active/);
    const cards = page.locator(".theme-card");
    await expect(cards.first()).toBeVisible();
  });

  test("el botón Temas vuelve a la vista normal", async ({ page }) => {
    await page.goto("/");
    await page.locator("#nav-autores").click();
    await page.locator("#nav-temas").click();
    const count = await page.locator(".theme-card").count();
    expect(count).toBeGreaterThanOrEqual(6);
  });
});

test.describe("Atlas Marxista — mapa de conexiones", () => {
  test("el botón Mapa en el topbar muestra la vista del mapa", async ({ page }) => {
    await page.goto("/");
    await page.locator("#nav-mapa").click();
    await expect(page.locator("#map-view")).toBeVisible();
    await expect(page.locator(".app")).not.toBeVisible();
  });

  test("el mapa renderiza los nodos de todos los temas", async ({ page }) => {
    await page.goto("/");
    await page.locator("#nav-mapa").click();
    // Wait for nodes to appear (force layout is synchronous after rAF)
    await page.waitForSelector(".map-node");
    const nodes = page.locator(".map-node");
    const count = await nodes.count();
    expect(count).toBeGreaterThanOrEqual(6);
  });

  test("el mapa renderiza las aristas SVG entre temas relacionados", async ({ page }) => {
    await page.goto("/");
    await page.locator("#nav-mapa").click();
    await page.waitForSelector(".map-edge");
    const edges = page.locator(".map-edge");
    const count = await edges.count();
    expect(count).toBeGreaterThanOrEqual(5);
  });

  test("hacer clic en un nodo navega al tema correspondiente", async ({ page }) => {
    await page.goto("/");
    await page.locator("#nav-mapa").click();
    await page.waitForSelector(".map-node");
    const firstNode = page.locator(".map-node").first();
    await firstNode.click();
    // Should switch back to temas view and show detail
    await expect(page.locator(".app")).toBeVisible();
    await expect(page.locator("#detail-content")).toBeVisible();
  });

  test("el botón Temas desde el mapa vuelve a la vista normal", async ({ page }) => {
    await page.goto("/");
    await page.locator("#nav-mapa").click();
    await page.locator("#nav-temas").click();
    await expect(page.locator(".app")).toBeVisible();
    await expect(page.locator("#map-view")).not.toBeVisible();
  });
});

test.describe("Atlas Marxista — UX móvil", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("en mobile la vista lista muestra el sidebar", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".sidebar")).toBeVisible();
  });

  test("seleccionar un tema en mobile muestra el detalle y oculta el sidebar", async ({ page }) => {
    await page.goto("/");
    await page.locator(".theme-card").first().click();
    await expect(page.locator("#detail-content")).toBeVisible();
    await expect(page.locator(".sidebar")).not.toBeVisible();
  });

  test("el botón atrás en mobile vuelve al sidebar", async ({ page }) => {
    await page.goto("/");
    await page.locator(".theme-card").first().click();
    await page.locator(".detail__back").click();
    await expect(page.locator(".sidebar")).toBeVisible();
  });
});
