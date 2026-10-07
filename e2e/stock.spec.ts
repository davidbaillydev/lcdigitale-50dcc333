import { expect, test } from "@playwright/test";
import { SLUG, STAFF_STATE, openMenu } from "./helpers";

test("Rupture en 1 clic : le plat disparaît du site client sans rechargement", async ({ page, browser }) => {
  test.skip(!STAFF_STATE, "E2E_STAFF_STATE requis (session gérant)");
  await openMenu(page);
  const firstDish = page.locator("button").filter({ hasText: "€" }).first();
  const name = (await firstDish.locator("h3, p").first().textContent())?.trim() ?? "";
  expect(name.length).toBeGreaterThan(1);

  const staff = await browser.newContext({ storageState: STAFF_STATE });
  const admin = await staff.newPage();
  await admin.goto(`/espace/${SLUG}/carte`);
  await admin.getByRole("button", { name: /Catégorie|Ouvrir/ }).first().click().catch(() => {});
  const row = admin.locator("div").filter({ has: admin.locator(`input[value="${name}"]`) }).last();
  await row.getByRole("button", { name: /Marquer épuisé/ }).click();

  try {
    // Le client ne recharge pas : Realtime doit retirer le plat.
    await expect(page.getByText(name, { exact: true })).toHaveCount(0, { timeout: 15_000 });
  } finally {
    await row.getByRole("button", { name: /Épuisé/ }).click(); // remise en vente
    await expect(page.getByText(name, { exact: true }).first()).toBeVisible({ timeout: 15_000 });
    await staff.close();
  }
});
