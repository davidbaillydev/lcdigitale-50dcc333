import type { Invoice } from "./invoice";

/** Preparation only: no provider call or assertion of fiscal compliance. */
export type PlatformStatus = "not_connected" | "queued" | "submitted" | "accepted" | "rejected" | "paid";
export type BusinessBuyer = { company: string; siren: string; vatNumber?: string; address: string; postalCode: string; city: string; country: string; routingAddress: string };
export type PlatformSubmission = { invoiceId: string; restaurantId: string; idempotencyKey: string; invoice: Invoice; buyer: BusinessBuyer; operation: "goods" | "services" | "mixed" };
export type PlatformReceipt = { externalId: string; status: PlatformStatus; receivedAt: string };

export function invoicePlatformReadiness(invoice: Invoice) {
  const missing: string[] = [];
  const { seller, totalHT, totalVAT, totalTTC } = invoice.data;
  if (!seller.company.trim()) missing.push("Raison sociale du vendeur");
  if (!/^\d{14}$/.test(seller.siret.replace(/\s/g, ""))) missing.push("SIRET du vendeur (14 chiffres)");
  if (!(seller.seat || seller.address).trim()) missing.push("Adresse du vendeur");
  if (![totalHT, totalVAT, totalTTC].every(Number.isFinite) || Math.abs(totalHT + totalVAT - totalTTC) > 0.02) missing.push("Totaux HT / TVA / TTC cohérents");
  // Existing snapshots do not collect legal buyer identity or fiscal routing.
  missing.push("Identité et SIREN du client professionnel", "Adresse complète et adresse de facturation électronique du client", "Nature de l’opération et régime TVA", "Validation XML / PDF par la plateforme agréée", "Compte et mandat de l’établissement auprès d’une plateforme agréée");
  return { status: "not_connected" as const, ready: false, missing };
}