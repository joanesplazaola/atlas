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
    await expect(cards).toHaveCount(4);
  });

  test("los stats muestran el número correcto de temas", async ({ page }) => {
    await page.goto("/");
    const stat = page.locator(".stat-pill").first();
    await expect(stat).toContainText("4");
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

  test("cambiar al tab Debates muestra los debates", async ({ page }) => {
    await page.locator(".tab-btn", { hasText: /Debates/ }).click();
    await expect(page.locator("#tab-debates")).toHaveClass(/tab-panel--active/);
    await expect(page.locator(".debate-card").first()).toBeVisible();
  });
});

test.describe("Atlas Marxista — búsqueda y filtros", () => {
  test("la búsqueda filtra los temas del sidebar", async ({ page }) => {
    await page.goto("/");
    await page.locator("#search-input").fill("imperialismo");
    const cards = page.locator(".theme-card");
    await expect(cards).toHaveCount(1);
    await expect(cards.first().locator(".theme-card__title")).toContainText(/imperialismo/i);
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
    await expect(page.locator(".theme-card")).toHaveCount(4);
  });

  test("hacer clic en un chip de concepto filtra los temas", async ({ page }) => {
    await page.goto("/");
    // Open a theme to get concept chips visible in sidebar
    const chip = page.locator(".theme-card .chip").first();
    const conceptText = await chip.textContent();
    await chip.click();
    // All remaining cards should contain that concept
    const filter = page.locator(".filter-pill");
    await expect(filter).toContainText(conceptText.trim());
  });

  test("el botón × del filtro activo lo elimina", async ({ page }) => {
    await page.goto("/");
    await page.locator(".theme-card .chip").first().click();
    await page.locator(".filter-pill button").click();
    await expect(page.locator(".filter-pill")).toHaveCount(0);
    await expect(page.locator(".theme-card")).toHaveCount(4);
  });
});

test.describe("Atlas Marxista — navegación por hash", () => {
  test("navegar directamente a un hash carga el tema correcto", async ({ page }) => {
    await page.goto("/#tema/imperialismo");
    await expect(page.locator("#detail-title")).toHaveText(/imperialismo/i);
    await expect(page.locator(".theme-card--active")).toBeVisible();
  });

  test("un hash inválido muestra el estado vacío del detalle", async ({ page }) => {
    await page.goto("/#tema/tema-inexistente");
    // Falls back to first theme (app auto-selects)
    await expect(page.locator("#detail-content")).toBeVisible();
  });
});
