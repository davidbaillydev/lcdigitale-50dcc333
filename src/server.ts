import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

// En-têtes anti-iframe : tout est interdit par défaut, sauf les pages publiques
// de commande (carte, commande, suivi, réservation, pages légales) qui peuvent
// être intégrées en iframe sur le site du restaurant (module « embed »).
const RESERVED_SLUGS = new Set([
  "espace", "admin", "agence", "connexion", "cuisine", "livreur", "api",
  "commande", "suivi", "reset-password", "desabonnement", "borne",
]);
const EMBED_PATH = /^\/([a-z0-9-]{2,40})(\/(commande|suivi\/[a-z0-9-]+|reserver|cgv|confidentialite|mentions-legales|cookies))?\/?$/i;

function isEmbeddablePath(pathname: string): boolean {
  const m = EMBED_PATH.exec(pathname);
  if (!m) return false;
  return !RESERVED_SLUGS.has(m[1]!.toLowerCase());
}

function withSecurityHeaders(response: Response, request: Request): Response {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("text/html")) return response;
  const headers = new Headers(response.headers);
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("X-Content-Type-Options", "nosniff");
  const pathname = new URL(request.url).pathname;
  if (isEmbeddablePath(pathname)) {
    headers.delete("X-Frame-Options");
    headers.set("Content-Security-Policy", "frame-ancestors https:");
  } else {
    headers.set("X-Frame-Options", "DENY");
    headers.set("Content-Security-Policy", "frame-ancestors 'none'");
  }
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
