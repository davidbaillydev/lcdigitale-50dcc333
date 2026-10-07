import { expect, type Page } from "@playwright/test";

export const SLUG = process.env["E2E_SLUG"] ?? "woknsushi";
export const STAFF_STATE = process.env["E2E_STAFF_STATE"];
export const WRITES = process.env["E2E_ALLOW_WRITES"] === "1";

/** Ouvre la carte publique et attend l'hydratation (premier plat cliquable). */
export async function openMenu(page: Page, query = "") {
  await page.goto(`/${SLUG}${query}`);
  await expect(page.locator("h1").first()).toBeVisible({ timeout: 30_000 });
  await page.waitForLoadState("networkidle");
}

/** Configuration publique du restaurant lue depuis la page (via les bandeaux). */
export async function bannerText(page: Page) {
  return (await page.getByRole("status").allTextContents()).join(" | ");
}

/** Ajoute au panier le premier plat sans choix obligatoire. */
export async function addSimpleDish(page: Page) {
  const dishes = page.locator("main button, section button").filter({ hasText: "€" });
  const n = Math.min(await dishes.count(), 15);
  for (let i = 0; i < n; i++) {
    await dishes.nth(i).click();
    const add = page.getByRole("button", { name: /^Ajouter ·/ });
    if (await add.isVisible({ timeout: 3000 }).catch(() => false)) { await add.click(); return; }
    await page.keyboard.press("Escape");
  }
  throw new Error("Aucun plat simple trouvé");
}
