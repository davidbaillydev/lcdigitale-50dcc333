// Appels Zoho Books via la passerelle connecteur (serveur uniquement).
const GATEWAY_URL = "https://connector-gateway.lovable.dev/zoho_books";
export const ZOHO_ORG_ID = "20111953185";

export async function zoho<T = Record<string, unknown>>(path: string, init?: { method?: string; body?: unknown; query?: Record<string, string> }): Promise<T> {
  const lovable = process.env["LOVABLE_API_KEY"], key = process.env["ZOHO_BOOKS_API_KEY"];
  if (!lovable || !key) throw new Error("Connexion Zoho Books non configurée.");
  const qs = new URLSearchParams({ organization_id: ZOHO_ORG_ID, ...(init?.query ?? {}) } as Record<string, string>);
  const res = await fetch(`${GATEWAY_URL}${path}?${qs}`, {
    method: init?.method ?? "GET",
    headers: { Authorization: `Bearer ${lovable}`, "X-Connection-Api-Key": key, "Content-Type": "application/json" },
    body: init?.body ? JSON.stringify(init.body) : undefined,
  });
  const text = await res.text();
  let json: Record<string, unknown> = {};
  try { json = JSON.parse(text); } catch { /* corps non JSON */ }
  if (!res.ok || (typeof json["code"] === "number" && json["code"] !== 0)) {
    console.error(`Zoho Books ${path} [${res.status}]: ${text}`);
    throw new Error(`Zoho [${res.status}] : ${(json["message"] as string) ?? text.slice(0, 200)}`);
  }
  return json as T;
}

export const zohoInvoiceUrl = (id: string) => `https://books.zoho.eu/app/${ZOHO_ORG_ID}#/invoices/${id}`;
