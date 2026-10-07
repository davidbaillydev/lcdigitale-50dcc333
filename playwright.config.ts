import { defineConfig } from "@playwright/test";

/**
 * Tests de bout en bout. Lancer : `bunx playwright test`
 * Variables : E2E_BASE_URL (défaut http://localhost:8080), E2E_SLUG (défaut woknsushi),
 * E2E_STAFF_STATE (session gérant enregistrée, pour les tests cuisine),
 * E2E_ALLOW_WRITES=1 (autorise la création de vraies commandes de test).
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  retries: 0,
  use: { baseURL: process.env["E2E_BASE_URL"] ?? "http://localhost:8080", viewport: { width: 1280, height: 1800 } },
});
