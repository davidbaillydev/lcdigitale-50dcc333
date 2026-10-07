import { expect, test } from "@playwright/test";
import { SLUG, STAFF_STATE } from "./helpers";

test("La session enregistrée peut ouvrir la gestion du restaurant", async ({ browser }) => {
  test.skip(!STAFF_STATE, "E2E_STAFF_STATE requis");
  if (!STAFF_STATE) return;
  const context = await browser.newContext({ storageState: STAFF_STATE, viewport: { width: 1280, height: 1800 } });
  try {
    const page = await context.newPage();
    await page.goto(`/${"espace"}/${SLUG}/livraison`);
    await expect(page.getByRole("heading", { name: "Livraison & livreurs", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Équipe de livraison" })).toBeVisible();
  } finally { await context.close(); }
});