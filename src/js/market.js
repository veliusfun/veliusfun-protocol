// Market client. Reads ONLY the market-source register record; CA state is not an input here.
const sleep = (ms, sig) => new Promise((res, rej) => { const t = setTimeout(res, ms); sig && sig.addEventListener('abort', () => { clearTimeout(t); rej(new DOMException('aborted', 'AbortError')); }); });

export async function fetchJson(url, { signal, timeout = 10000 } = {}) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeout);
  const onAbort = () => ctl.abort();
  signal && signal.addEventListener('abort', onAbort);
  try {
    const r = await fetch(url, { signal: ctl.signal, headers: { accept: 'application/json' } });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.json();
  } finally { clearTimeout(t); signal && signal.removeEventListener('abort', onAbort); }
}

/** Exponential backoff with jitter: base, 2x, 4x … capped. */
export async function withBackoff(fn, { tries = 4, base = 700, cap = 8000, signal } = {}) {
  let err;
  for (let i = 0; i < tries; i++) {
    try { return await fn(); } catch (e) {
      err = e; if (e.name === 'AbortError' && signal && signal.aborted) throw e;
      if (i < tries - 1) await sleep(Math.min(cap, base * 2 ** i) + Math.random() * 250, signal);
    }
  }
  throw err;
}

const num = (v) => { const n = typeof v === 'string' ? parseFloat(v) : v; return Number.isFinite(n) ? n : null; };

export function pairToRow(pair, extra = {}) {
  if (!pair) return null;
  return {
    address: pair.baseToken && pair.baseToken.address,
    symbol: pair.baseToken && pair.baseToken.symbol,
    name: pair.baseToken && pair.baseToken.name,
    price: num(pair.priceUsd),
    change24: num(pair.priceChange && pair.priceChange.h24),
    volume24: num(pair.volume && pair.volume.h24),
    liquidity: num(pair.liquidity && pair.liquidity.usd),
    img: (pair.info && pair.info.imageUrl) || null,
    url: pair.url || null,
    ...extra,
  };
}

const byVolume = (a, b) => (num(b.volume && b.volume.h24) || 0) - (num(a.volume && a.volume.h24) || 0);

/** Top 10 Solana boosts, each resolved to its best pair. Per-token failures return a partial row. */
export async function loadTrending(base, { signal } = {}) {
  const boosts = await withBackoff(() => fetchJson(`${base}/token-boosts/top/v1`, { signal }), { signal });
  const seen = new Set();
  const top = (Array.isArray(boosts) ? boosts : [])
    .filter((b) => b && b.chainId === 'solana' && b.tokenAddress)
    .sort((a, b) => (num(b.totalAmount) || 0) - (num(a.totalAmount) || 0))
    .filter((b) => (seen.has(b.tokenAddress) ? false : seen.add(b.tokenAddress)))
    .slice(0, 10);
  const settled = await Promise.allSettled(top.map((b) => withBackoff(() => fetchJson(`${base}/tokens/v1/solana/${b.tokenAddress}`, { signal }), { signal, tries: 3 })));
  return top.map((b, i) => {
    const res = settled[i];
    if (res.status !== 'fulfilled' || !Array.isArray(res.value) || !res.value.length) return { address: b.tokenAddress, partial: true, boostIcon: b.icon || null, url: b.url || null };
    const mine = res.value.filter((p) => p.baseToken && p.baseToken.address === b.tokenAddress);
    const best = (mine.length ? mine : res.value).slice().sort(byVolume)[0];
    return { ...pairToRow(best), address: b.tokenAddress, boostIcon: b.icon || null, boost: num(b.totalAmount) };
  });
}

/** Own token: DexScreener and pump.fun fire in parallel; neither blocks the other. */
export async function loadOwn(base, ca, { signal } = {}) {
  const dex = withBackoff(() => fetchJson(`${base}/latest/dex/tokens/${ca}`, { signal }), { signal, tries: 3 });
  const pump = fetchJson(`https://frontend-api.pump.fun/coins/${ca}`, { signal, timeout: 8000 });
  const [d, p] = await Promise.allSettled([dex, pump]);
  const pairs = d.status === 'fulfilled' && d.value && Array.isArray(d.value.pairs) ? d.value.pairs.slice().sort(byVolume) : [];
  const pair = pairs[0] || null;
  const pf = p.status === 'fulfilled' ? p.value : null;
  if (!pair && !pf) throw new Error('own token: both sources failed');
  const row = pair ? pairToRow(pair) : { symbol: pf.symbol, name: pf.name, price: null, change24: null, volume24: null, liquidity: null, url: null };
  row.address = ca;
  row.symbol = row.symbol || (pf && pf.symbol);
  row.name = row.name || (pf && pf.name);
  row.imgs = [pf && pf.image_uri, row.img].filter(Boolean);
  return row;
}

export async function loadSlot(rpc, { signal } = {}) {
  const r = await fetch(rpc, { method: 'POST', signal, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getSlot', params: [{ commitment: 'finalized' }] }) });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const j = await r.json();
  return typeof j.result === 'number' ? j.result : null;
}

// ---- formatting
export const fmtUsd = (n) => {
  if (n == null) return '—';
  if (n >= 1000) return '$' + n.toLocaleString('en-US', { maximumFractionDigits: 0 });
  if (n >= 1) return '$' + n.toFixed(2);
  if (n === 0) return '$0';
  const d = Math.min(10, Math.max(4, 2 - Math.floor(Math.log10(n)) + 1));
  return '$' + n.toFixed(d);
};
export const fmtCompact = (n) => (n == null ? '—' : '$' + Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(n));
export const fmtPct = (n) => (n == null ? '—' : (n > 0 ? '+' : '') + n.toFixed(2) + '%');
