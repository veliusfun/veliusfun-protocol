// Register pattern: every external fact is exactly one record.
// state: 'stated' | 'absent' | 'unconfirmed'. Absent/unconfirmed records render inert.
const records = [
  { id: 'ca',            label: 'CA', state: 'absent',  value: null },
  { id: 'x',             label: 'X',                state: 'stated',  value: 'https://x.com/veliusfun' },
  { id: 'github',        label: 'GitHub',           state: 'absent',  value: null },
  { id: 'market-source', label: 'Market source',    state: 'stated',  value: 'https://api.dexscreener.com' },
  { id: 'chain',         label: 'Chain',            state: 'stated',  value: 'solana', rpc: 'https://solana-rpc.publicnode.com' },
  { id: 'domain',        label: 'Domain',           state: 'stated',  value: 'velius.fun' },
];

const map = new Map(records.map((r) => [r.id, Object.freeze({ ...r })]));

export const register = Object.freeze({
  get(id) { return map.get(id); },
  all() { return [...map.values()]; },
  isStated(id) { const r = map.get(id); return !!r && r.state === 'stated' && !!r.value; },
  value(id) { return this.isStated(id) ? map.get(id).value : null; },
});

/** Derive a display handle from a stored URL. Returns null if the record is not stated. */
export function handleOf(id) {
  const v = register.value(id);
  if (!v) return null;
  try {
    const u = new URL(v);
    const seg = u.pathname.split('/').filter(Boolean)[0];
    return seg ? '@' + seg : u.hostname;
  } catch { return null; }
}
