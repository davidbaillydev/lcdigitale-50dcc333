import { expect, test } from "@playwright/test";
import { SLUG, addSimpleDish } from "./helpers";

// Les calculs (rayon, polygone, frais dégressifs) sont couverts par src/lib/geo.test.ts.
// Ici : le parcours client réel, avec une adresse dans et hors zone.
const INSIDE = process.env["E2E_ADDR_IN"] ?? "1 Allée du Comminges, 31770 Colomiers";
const OUTSIDE = process.env["E2E_ADDR_OUT"] ?? "1 Place du Capitole, 31000 Toulouse";

async function checkout(page: import("@playwright/test").Page) {
  await page.goto(`/${SLUG}`);
  await page.waitForLoadState("networkidle");
  await addSimpleDish(page);
  await page.goto(`/${SLUG}/commande`);
  await page.getByRole("button", { name: /Livraison/ }).first().click();
}

test("Éligibilité et frais selon la zone dessinée", async ({ page }) => {
  await checkout(page);
  const verify = page.getByRole("button", { name: "Vérifier mon adresse" });
  test.skip(!(await verify.isVisible().catch(() => false)), "Aucune zone dessinée pour ce restaurant (page Livraison)");

  const [street, ...rest] = INSIDE.split(",");
  await page.getByLabel("Adresse *").fill(street!.trim());
  await page.getByLabel("Code postal et ville *").fill(rest.join(",").trim());
  await verify.click();
  await expect(page.getByText(/Livrable —/)).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/frais (\d+[.,]\d{2} €|offerts)/)).toBeVisible();

  const [s2, ...r2] = OUTSIDE.split(",");
  await page.getByLabel("Adresse *").fill(s2!.trim());
  await page.getByLabel("Code postal et ville *").fill(r2.join(",").trim());
  await verify.click();
  await expect(page.getByText("hors de notre zone de livraison")).toBeVisible({ timeout: 20_000 });
});
