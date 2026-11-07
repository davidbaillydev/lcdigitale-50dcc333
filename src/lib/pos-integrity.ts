/** A checksum detects changes; it is not a certificate or an electronic signature. */
export const POS_INTEGRITY_VERSION = "lc-pos-integrity-v1";
export const ZERO_HASH = "0".repeat(64);
export type ChainEntry = { sequence: number; previous_hash: string; hash: string; payload_text: string };
export async function sha256(text: string): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, "0")).join("");
}
/** Hash exact database UTF-8 bytes, never JSON.parse/stringify the signed text. */
export async function verifyChain(entries: ChainEntry[], startSequence = 0, startHash = ZERO_HASH): Promise<boolean> {
  let number = startSequence, previous = startHash;
  for (const entry of entries) {
    if (entry.sequence !== number + 1 || entry.previous_hash !== previous || await sha256(entry.previous_hash + "\n" + entry.payload_text) !== entry.hash) return false;
    number = entry.sequence; previous = entry.hash;
  }
  return true;
}
export function shortReceiptHash(hash?: string | null): string | null {
  return hash && /^[a-f0-9]{64}$/.test(hash) ? hash.slice(0, 16).toUpperCase() : null;
}
export async function verifyArchive(text: string, expectedHash: string): Promise<boolean> {
  return /^[a-f0-9]{64}$/.test(expectedHash) && await sha256(text) === expectedHash;
}