import { register, handleOf } from './register.js';
import { scanAddresses, linkFor, caState } from './gate.js';
import { loadTrending, loadOwn, loadSlot, fmtUsd, fmtCompact, fmtPct } from './market.js';
import { initReveal, initSpotlight, initProgress, initParallax, setNumber, reduced } from './fx.js';
import { initStars, initIslands, initScenes } from './hero.js';

document.documentElement.classList.add('js');
const $ = (s, r = document) => r.querySelector(s);
const brandLogo = 'assets/brand/logo-192.png';
const toast = (msg) => { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('on'), 1800); };

// theme-color from the token (no literal in markup)
const tc = $('meta[name="theme-color"]'); if (tc) tc.content = getComputedStyle(document.documentElement).getPropertyValue('--color-space').trim();

/* ---------- register bindings: read the CURRENT record at call time ---------- */
function bindSocials() {
  document.querySelectorAll('a[data-record]').forEach((a) => {
    const id = a.dataset.record, rec = register.get(id), href = linkFor(register, id);
    if (href) {
      a.href = href; a.target = '_blank'; a.rel = 'noopener noreferrer';
      a.setAttribute('aria-label', `${rec.label} ${handleOf(id) || ''}`.trim()); a.title = handleOf(id) || rec.label; a.removeAttribute('aria-disabled'); a.dataset.state = 'stated';
    } else {
      a.removeAttribute('href'); a.setAttribute('aria-disabled', 'true'); a.setAttribute('role', 'link'); a.title = `${rec.label}: not stated`; a.dataset.state = rec.state;
    }
  });
  document.querySelectorAll('[data-record-text]').forEach((el) => { el.textContent = register.value(el.dataset.recordText) || '—'; });
}

function bindCA() {
  const btn = $('[data-slot="ca"]'), text = $('[data-slot="ca-text"]'), act = $('[data-slot="ca-act"]');
  const s = caState(register);
  btn.dataset.state = s.stated ? 'stated' : 'absent';
  if (!s.stated) { btn.disabled = true; btn.setAttribute('aria-disabled', 'true'); text.textContent = '· · · · · · · · · ·'; act.textContent = 'Not stated yet'; btn.onclick = null; return; }
  btn.disabled = false; btn.removeAttribute('aria-disabled'); text.textContent = s.value; act.textContent = 'Copy'; btn.setAttribute('aria-label', 'Copy address ' + s.value);
  btn.onclick = async () => {
    try { await navigator.clipboard.writeText(s.value); } catch {
      const ta = document.createElement('textarea'); ta.value = s.value; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.append(ta); ta.select(); try { document.execCommand('copy'); } catch {} ta.remove();
    }
    btn.classList.add('copied'); act.textContent = 'Copied'; toast('Copied to clipboard');
    clearTimeout(btn._t); btn._t = setTimeout(() => { btn.classList.remove('copied'); act.textContent = 'Copy'; }, 1800);
  };
}

/* ---------- market board ---------- */
const rowsEl = $('#rows');
const board = { own: null, trending: [], status: 'loading', fails: 0 };
const els = new Map(); // address -> row element

function logoNode(sources, symbol, isBrand) {
  const box = document.createElement('span'); box.className = 'logo';
  const list = sources.filter(Boolean); let i = 0;
  const letter = () => { box.replaceChildren(document.createTextNode(((symbol || '?')[0] || '?').toUpperCase())); };
  const next = () => {
    if (i >= list.length) return letter();
    const img = new Image(); img.alt = ''; img.decoding = 'async'; if (list[i] === brandLogo) img.className = 'brand-logo';
    img.onerror = () => { i++; next(); }; img.onload = () => box.replaceChildren(img); img.src = list[i];
  };
  next(); if (!list.length) letter();
  return box;
}
function rowShell(tag) {
  const el = document.createElement(tag);
  el.className = 'mrow';
  el.innerHTML = '<span class="rk"></span><span class="tok"><span class="logo-slot"></span><span><span class="sym"></span><span class="nm"></span></span></span><span class="cell r" data-f="price"></span><span class="cell r" data-f="chg"></span><span class="cell r hide-s" data-f="vol"></span><span class="cell r hide-m" data-f="liq"></span>';
  return el;
}
function fillRow(el, r, rank) {
  $('.rk', el).textContent = rank;
  $('.sym', el).textContent = r.symbol || '—'; $('.nm', el).textContent = r.name || '';
  setNumber($('[data-f="price"]', el), r.price, fmtUsd);
  const chg = $('[data-f="chg"]', el); setNumber(chg, r.change24, fmtPct); chg.classList.toggle('up', r.change24 > 0); chg.classList.toggle('down', r.change24 < 0);
  setNumber($('[data-f="vol"]', el), r.volume24, fmtCompact); setNumber($('[data-f="liq"]', el), r.liquidity, fmtCompact);
}

function ownRowEl() {
  let el = $('[data-row="own"]', rowsEl);
  if (!el) { el = rowShell('a'); el.classList.add('own'); el.dataset.row = 'own'; rowsEl.prepend(el); }
  return el;
}
function renderOwn() {
  const el = ownRowEl(), s = caState(register);
  $('.rk', el).textContent = '1';
  const slot = $('.logo-slot, .logo', el);
  const isPlaceholder = !s.stated;
  el.classList.toggle('is-placeholder', isPlaceholder);
  el.dataset.ownState = s.stated ? (board.own ? 'live' : 'loading') : 'absent';
  if (isPlaceholder) {
    el.removeAttribute('href'); el.setAttribute('aria-disabled', 'true');
    if (!el._brand) { el._brand = true; slot.replaceWith(logoNode([brandLogo], 'V')); }
    $('.sym', el).innerHTML = 'VELIUS<span class="tag-own">YOU</span>'; $('.nm', el).textContent = 'Waiting for CA';
    el.querySelectorAll('.cell').forEach((c) => { c.textContent = '· · · · ·'; c.classList.add('ph'); c.classList.remove('up', 'down'); c._v = null; });
    return;
  }
  el.querySelectorAll('.cell').forEach((c) => c.classList.remove('ph'));
  el.removeAttribute('aria-disabled');
  const d = board.own;
  if (!d) { el.querySelectorAll('.cell').forEach((c) => { if (!c._v) c.innerHTML = '<span class="sk w2"></span>'; }); if (!el._brand) { el._brand = true; $('.logo-slot, .logo', el).replaceWith(logoNode([brandLogo], 'V')); } return; }
  if (d.url) { el.href = d.url; el.target = '_blank'; el.rel = 'noopener noreferrer'; }
  $('.sym', el).innerHTML = ''; $('.sym', el).append(document.createTextNode(d.symbol || 'VELIUS')); const t = document.createElement('span'); t.className = 'tag-own'; t.textContent = 'YOU'; $('.sym', el).append(t);
  $('.nm', el).textContent = d.name || '';
  const key = (d.imgs || []).join('|');
  if (el._imgKey !== key) { el._imgKey = key; $('.logo-slot, .logo', el).replaceWith(logoNode([...(d.imgs || []), brandLogo], d.symbol)); el._brand = false; }
  fillRow(el, d, 1);
  $('.sym', el).append(t);
}

function skeletonRows() {
  return Array.from({ length: 9 }, (_, i) => `<div class="mrow skel" aria-hidden="true"><span class="rk">${i + 2}</span><span class="tok"><span class="sk round"></span><span style="flex:1"><span class="sk w1"></span></span></span><span class="cell"><span class="sk w2"></span></span><span class="cell"><span class="sk w3"></span></span><span class="cell hide-s"><span class="sk w2"></span></span><span class="cell hide-m"><span class="sk w2"></span></span></div>`).join('');
}

function renderTrending() {
  const own = register.value('ca');
  const list = board.trending.filter((r) => !own || r.address !== own).slice(0, 9); // dedup + rows 2-10
  $('.skel-wrap', rowsEl) && $('.skel-wrap', rowsEl).remove();
  const keep = new Set(list.map((r) => r.address));
  for (const [a, el] of els) if (!keep.has(a)) { el.remove(); els.delete(a); }
  list.forEach((r, i) => {
    let el = els.get(r.address); const fresh = !el;
    if (fresh) { el = rowShell('a'); el.dataset.row = 'trend'; el.dataset.addr = r.address; el.classList.add('fade-in'); el.style.setProperty('--i', i); els.set(r.address, el); $('.logo-slot', el).replaceWith(logoNode([r.img, r.boostIcon], r.symbol)); }
    if (r.url) { el.href = r.url; el.target = '_blank'; el.rel = 'noopener noreferrer'; }
    if (r.partial) { el.querySelectorAll('.cell').forEach((c) => { if (c._v == null) c.textContent = '—'; }); $('.sym', el).textContent = $('.sym', el).textContent || '—'; $('.rk', el).textContent = i + 2; }
    else fillRow(el, r, i + 2);
    rowsEl.append(el); // append in order
  });
}

function renderTicker() {
  const track = $('#tickerTrack');
  const items = [...(board.own && register.value('ca') ? [board.own] : []), ...board.trending.filter((r) => r.symbol && r.address !== register.value('ca'))];
  if (!items.length) { track.innerHTML = Array(12).fill('<span class="tk">· · · · ·</span>').join(''); return; }
  const one = items.map((r) => `<span class="tk"><b>${esc(r.symbol)}</b>${fmtUsd(r.price)}<span class="${r.change24 > 0 ? 'up' : r.change24 < 0 ? 'down' : ''}">${fmtPct(r.change24)}</span></span>`).join('');
  track.innerHTML = one + one;
}
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function setStatus(state) {
  const pill = $('#statusPill'), txt = $('#statusText');
  pill.dataset.state = state;
  txt.textContent = { loading: 'Board syncing', live: 'Live board', stale: 'Retrying · showing last numbers', error: 'Feed unreachable' }[state];
  $('#boardErr').hidden = !(state === 'stale' || state === 'error');
}

/* ---------- polling: 60s, paused while hidden, immediate on visible ---------- */
let timer = 0, ctl = null, busy = false;
async function cycle() {
  if (busy) return; busy = true; ctl = new AbortController();
  const base = register.value('market-source');
  const ca = register.value('ca');
  try {
    if (!base) throw new Error('market-source not stated');
    const jobs = [loadTrending(base, { signal: ctl.signal })];
    if (ca) jobs.push(loadOwn(base, ca, { signal: ctl.signal })); // parallel; never blocks trending
    const [t, o] = await Promise.allSettled(jobs);
    let ok = false;
    if (t.status === 'fulfilled' && t.value.length) {
      // keep last good values for tokens whose pair fetch failed this round
      const prev = new Map(board.trending.map((r) => [r.address, r]));
      board.trending = t.value.map((r) => (r.partial && prev.get(r.address) && !prev.get(r.address).partial ? prev.get(r.address) : r));
      ok = true;
    }
    if (ca && o && o.status === 'fulfilled') { board.own = o.value; ok = true; }
    if (!ok) throw new Error('all sources failed');
    board.fails = 0; board.status = 'live'; setStatus('live');
  } catch (e) {
    if (e.name === 'AbortError') { busy = false; return; }
    board.fails++; const have = board.trending.length || board.own;
    board.status = have ? 'stale' : 'error'; setStatus(board.status);
    if (!have) $('.skel-wrap', rowsEl) && ($('.skel-wrap', rowsEl).innerHTML = skeletonRows().replace(/<span class="sk[^"]*"><\/span>/g, '—'));
  }
  busy = false; renderAll(); schedule();
}
function renderAll() { renderOwn(); renderTrending(); renderTicker(); }
function schedule() { clearTimeout(timer); if (document.hidden) return; const wait = 60000 * Math.min(4, 2 ** Math.max(0, board.fails - 1)); timer = setTimeout(cycle, wait); }
document.addEventListener('visibilitychange', () => { if (document.hidden) { clearTimeout(timer); ctl && ctl.abort(); busy = false; } else { cycle(); slotTick(); } });

/* ---------- slot chip via the stated rpc ---------- */
let slotTimer = 0;
async function slotTick() {
  clearTimeout(slotTimer);
  const rpc = register.get('chain') && register.get('chain').rpc, el = $('#slot');
  if (!rpc || document.hidden) return;
  try { const s = await loadSlot(rpc); if (s != null) el.textContent = s.toLocaleString('en-US'); } catch { /* keep last good */ }
  slotTimer = setTimeout(slotTick, 2400);
}

/* ---------- boot ---------- */
bindSocials(); bindCA();
rowsEl.innerHTML = `<div class="skel-wrap">${skeletonRows()}</div>`;
renderOwn(); renderTicker(); setStatus('loading');
initScenes(); initIslands($('#islands')); initStars($('#stars'));
initReveal(); initSpotlight(); initProgress($('#progress'), $('#top')); initParallax($('#home'));

// gate scan: address-shaped strings in rendered copy must match a stated record (CA exempt). 0x hex is matched, not rejected.
const gate = scanAddresses(document.body.innerText, register);
if (gate.unknown.length) { document.documentElement.dataset.gate = 'warn'; console.warn('[gate] unmatched address-shaped strings', gate.unknown); }
else document.documentElement.dataset.gate = 'clear';

window.VELIUS = Object.freeze({ register, gate, caState: () => caState(register), board: () => ({ ...board }) });
cycle(); slotTick();
