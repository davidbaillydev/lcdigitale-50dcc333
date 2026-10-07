import { expect, test } from "@playwright/test";
import { STAFF_STATE, WRITES, SLUG, bannerText, openMenu, addSimpleDish } from "./helpers";

test.describe("QR codes", () => {
  test("Consultation seule : menu visible, aucun ajout au panier", async ({ page }) => {
    await openMenu(page, "?qr=view");
    await expect(page.getByText("Menu en consultation")).toBeVisible();
    const dish = page.locator("button[disabled]").filter({ hasText: "€" }).first();
    await expect(dish).toBeVisible();
    await expect(page.getByText("Voir mon panier")).toHaveCount(0);
    await page.reload();
    await expect(page.getByText("Menu en consultation")).toBeVisible();
    await expect(page.getByText("Voir mon panier")).toHaveCount(0);
  });

  test("Room service : le numéro de chambre est repris", async ({ page }) => {
    await openMenu(page, "?room=102");
    const txt = await bannerText(page);
    test.skip(!txt.includes("Room service"), "Room service non activé pour ce restaurant (page QR codes)");
    await expect(page.getByText("Room service · Chambre 102")).toBeVisible();
    await page.reload();
    await expect(page.getByText("Room service · Chambre 102")).toBeVisible();
    await addSimpleDish(page);
    await page.goto(`/${SLUG}/commande`);
    await expect(page.getByText(/Chambre 102/).first()).toBeVisible();
  });

  test("Libre-service : commande en attente puis validée par le staff", async ({ page, browser }) => {
    await openMenu(page, "?qr=self");
    const txt = await bannerText(page);
    test.skip(!txt.includes("Libre-service"), "Libre-service non activé pour ce restaurant");
    test.skip(!WRITES, "E2E_ALLOW_WRITES=1 requis pour créer une vraie commande");
    test.skip(!STAFF_STATE, "Session staff requise avant toute création de commande");

    // Ajout du premier plat simple puis commande
    await addSimpleDish(page);
    await page.goto(`/${SLUG}/commande`);
    await expect(page.getByText("vérifiée par notre équipe")).toBeVisible();
    await page.getByLabel("Nom *").fill("Test E2E");
    await page.getByLabel("Téléphone *").fill("0600000000");
    await page.getByRole("checkbox").last().check();
    await page.getByRole("button", { name: /Commander|Valider/ }).last().click();
    await expect(page.getByText("Commande transmise à l'équipe, en attente de confirmation")).toBeVisible({ timeout: 30_000 });
    const orderNo = (await page.locator("h1").first().textContent())?.match(/\d+/)?.[0];
    expect(orderNo).toBeTruthy();

    test.skip(!STAFF_STATE, "E2E_STAFF_STATE requis pour la validation côté cuisine");
    const staff = await browser.newContext({ storageState: STAFF_STATE });
    const kds = await staff.newPage();
    await kds.goto(`/espace/${SLUG}`);
    const start = kds.getByRole("button", { name: /Démarrer le service/ });
    if (await start.isVisible().catch(() => false)) await start.click();
    const card = kds.locator("li").filter({ hasText: `N° ${orderNo}` });
    await expect(card.getByText(/Nouvelle commande/)).toBeVisible({ timeout: 20_000 });
    await card.getByRole("button", { name: /Valider & Envoyer en cuisine/ }).click();
    await expect(page.getByText("en attente de confirmation")).toHaveCount(0, { timeout: 30_000 });
    await page.reload();
    await expect(page.getByText("en attente de confirmation")).toHaveCount(0);
    await staff.close();
  });
});
