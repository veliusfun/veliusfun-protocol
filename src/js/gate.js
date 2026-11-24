// Gates: pure functions, no DOM. Shared by the runtime and by scripts/verify.mjs.
const BASE58 = /\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/g;
const HEX40 = /\b0x[0-9a-fA-F]{40}\b/g;

/** Address-shaped strings found in text. 0x hex is recognised, never blanket-rejected. */
export function findAddressShapes(text) {
  const out = [];
  for (const m of text.matchAll(BASE58)) out.push({ kind: 'base58', value: m[0] });
  for (const m of text.matchAll(HEX40)) out.push({ kind: 'hex', value: m[0] });
  return out;
}

/**
 * Match address-shaped strings against the stated registry.
 * The CA record is exempt from the scanner (it is allowed to appear wherever the CA slot renders it).
 */
export function scanAddresses(text, register) {
  const stated = new Set(register.all().filter((r) => r.state === 'stated' && r.value).map((r) => r.value));
  const ca = register.value('ca');
  const matched = [], unknown = [];
  for (const s of findAddressShapes(text)) {
    if (ca && s.value === ca) continue; // CA exempt
    (stated.has(s.value) ? matched : unknown).push(s);
  }
  return { matched, unknown };
}

/** Link gate: href only for a stated record whose value is an http(s) URL. */
export function linkFor(register, id) {
  const v = register.value(id);
  if (!v) return null;
  try { const u = new URL(v); return /^https?:$/.test(u.protocol) ? u.href : null; } catch { return null; }
}

/** CA gate: the single state function the UI reads. */
export function caState(register) {
  const v = register.value('ca');
  return v ? { stated: true, value: v } : { stated: false, value: null };
}

export function isSolanaAddress(s) { return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(s || ''); }
