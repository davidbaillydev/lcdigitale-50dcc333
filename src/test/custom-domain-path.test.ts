import { describe, expect, it } from "vitest";
import { customDomainLocation, customDomainPath } from "@/lib/custom-domain-path";
import { customDomainRedirect } from "@/server";

const location = (path: string) => customDomainLocation(new URL(`https://commande.frenchpouletbraise.com${path}`), "frenchpouletbraise");

describe("chemins courts des domaines personnalisés", () => {
  it.each([
    ["/", "/frenchpouletbraise"],
    ["/borne?borne=1", "/frenchpouletbraise/borne?borne=1"],
    ["/borne?borne=2", "/frenchpouletbraise/borne?borne=2"],
    ["/commande", "/frenchpouletbraise/commande"],
    ["/cuisine", "/frenchpouletbraise/cuisine"],
    ["/suivi/abc-123?from=email", "/frenchpouletbraise/suivi/abc-123?from=email"],
    ["/reserver", "/frenchpouletbraise/reserver"],
  ])("redirige %s sans perdre ses paramètres", (input, expected) => {
    expect(location(input)).toBe(expected);
  });

  it.each([
    "/admin",
    "/espace/frenchpouletbraise",
    "/connexion",
    "/livreur",
    "/agence",
    "/api/public/menu",
    "/assets/index-abc123.js",
    "/favicon.ico",
    "/push-sw.js",
  ])("conserve la route globale ou l’asset %s", (path) => {
    expect(location(path)).toBeNull();
  });

  it("ne redirige ni un chemin déjà préfixé ni une adresse inconnue", () => {
    expect(customDomainPath("/frenchpouletbraise/borne")).toBeNull();
    expect(customDomainPath("/ce-restaurant-nexiste-pas")).toBeNull();
  });

  it("accepte la barre finale sans créer de double barre", () => {
    expect(location("/borne/?borne=1")).toBe("/frenchpouletbraise/borne?borne=1");
  });

  it("renvoie la redirection HTTP du serveur avec le paramètre de borne", async () => {
    const response = await customDomainRedirect(new Request("https://commande.woknsushi.com/borne?borne=2"));
    expect(response?.status).toBe(302);
    expect(response?.headers.get("Location")).toBe("/woknsushi/borne?borne=2");
  });

  it("ne redirige pas les routes globales au niveau du serveur", async () => {
    expect(await customDomainRedirect(new Request("https://commande.woknsushi.com/admin"))).toBeNull();
    expect(await customDomainRedirect(new Request("https://commande.woknsushi.com/assets/index.js"))).toBeNull();
    expect(await customDomainRedirect(new Request("https://lcdigitale.lovable.app/borne?borne=1"))).toBeNull();
  });
});
