// LC Digitale — pont d'impression ESC/POS réseau (Wi-Fi / Ethernet).
// Lancer sur un ordinateur du restaurant (même réseau que l'imprimante) : node lc-print-bridge.mjs
// Écoute sur http://localhost:9180 — /health, /discover (recherche port 9100), /print.
import http from "node:http";
import net from "node:net";
import os from "node:os";

const PORT = Number(process.env.PORT || 9180);
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Allow-Methods": "GET,POST,OPTIONS", "Access-Control-Allow-Private-Network": "true" };

function probe(host, port = 9100, ms = 400) {
  return new Promise((res) => {
    const s = net.connect({ host, port }); const t = setTimeout(() => { s.destroy(); res(false); }, ms);
    s.on("connect", () => { clearTimeout(t); s.destroy(); res(true); });
    s.on("error", () => { clearTimeout(t); res(false); });
  });
}
async function discover() {
  const found = [];
  for (const list of Object.values(os.networkInterfaces())) for (const i of list ?? []) {
    if (i.family !== "IPv4" || i.internal) continue;
    const base = i.address.split(".").slice(0, 3).join(".");
    const hosts = Array.from({ length: 254 }, (_, n) => `${base}.${n + 1}`);
    const ok = await Promise.all(hosts.map((h) => probe(h)));
    hosts.forEach((h, n) => ok[n] && found.push({ host: h, port: 9100 }));
  }
  return found;
}
function print(host, port, buf) {
  return new Promise((res, rej) => {
    const s = net.connect({ host, port }, () => s.end(buf, () => res()));
    s.setTimeout(8000, () => { s.destroy(); rej(new Error("Délai dépassé")); });
    s.on("error", rej);
  });
}

http.createServer(async (req, res) => {
  const send = (code, body) => { res.writeHead(code, { ...cors, "Content-Type": "application/json" }); res.end(JSON.stringify(body)); };
  if (req.method === "OPTIONS") { res.writeHead(204, cors); return res.end(); }
  try {
    if (req.url === "/health") return send(200, { ok: true });
    if (req.url === "/discover") return send(200, { printers: await discover() });
    if (req.url === "/print" && req.method === "POST") {
      let raw = ""; for await (const c of req) raw += c;
      const { host, port = 9100, data } = JSON.parse(raw);
      if (!/^[\w.-]+$/.test(host)) return send(400, { error: "Adresse invalide" });
      await print(host, Number(port), Buffer.from(data, "base64"));
      return send(200, { ok: true });
    }
    send(404, { error: "Introuvable" });
  } catch (e) { send(500, { error: String(e.message || e) }); }
}).listen(PORT, "127.0.0.1", () => console.log(`Pont LC Print prêt sur http://localhost:${PORT}`));
