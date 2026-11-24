// Hero scenery: starfield canvas + procedural pixel islands + step scenes. Colours are read from CSS tokens.
import { reduced } from './fx.js';
const tok = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

export function initStars(cv) {
  const ctx = cv.getContext('2d');
  const cols = [tok('--color-ink'), tok('--color-magenta'), tok('--color-ember')];
  let w = 0, h = 0, stars = [], run = false, vis = true;
  const dpr = Math.min(2, devicePixelRatio || 1);
  const resize = () => {
    w = cv.clientWidth; h = cv.clientHeight; cv.width = w * dpr; cv.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const n = Math.round((w * h) / 9000);
    stars = Array.from({ length: n }, (_, i) => ({ x: Math.random() * w, y: Math.random() * h, s: Math.random() < .12 ? 2 : 1, c: i % 9 === 0 ? 2 : (i % 5 === 0 ? 1 : 0), p: Math.random() * 6.28, f: .4 + Math.random() * 1.4, plus: i % 9 === 0 }));
    draw(0);
  };
  function draw(t) {
    ctx.clearRect(0, 0, w, h);
    for (const s of stars) {
      const a = reduced() ? .8 : .35 + .65 * (0.5 + 0.5 * Math.sin(t / 1000 * s.f + s.p));
      ctx.globalAlpha = a; ctx.fillStyle = cols[s.c];
      if (s.plus) { ctx.fillRect(s.x - 3, s.y - 1, 7, 2); ctx.fillRect(s.x - 1, s.y - 3, 2, 7); } else ctx.fillRect(s.x, s.y, s.s, s.s);
    }
    ctx.globalAlpha = 1;
  }
  const loop = (t) => { if (!run) return; draw(t); requestAnimationFrame(loop); };
  const setRun = () => { const want = vis && !document.hidden && !reduced(); if (want && !run) { run = true; requestAnimationFrame(loop); } else if (!want) run = false; };
  new IntersectionObserver((es) => { vis = es[0].isIntersecting; setRun(); }).observe(cv);
  document.addEventListener('visibilitychange', setRun);
  new ResizeObserver(resize).observe(cv); resize(); setRun();
}

/** Procedural pixel island: stepped inverted block pyramid with blossoms and a lit window. */
function islandSVG(seed, cols = 17) {
  let s = seed; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const rows = [], rects = [];
  const depth = 10;
  for (let r = 0; r < depth; r++) {
    const width = Math.max(3, cols - Math.floor(r * 1.5) * 1 - (r > 2 ? r : 0));
    const x0 = Math.floor((cols - width) / 2);
    for (let c = 0; c < width; c++) {
      const cls = r === 0 ? 'c-top' : (r < 3 ? 'c-mid' : 'c-low');
      const tone = rnd() < .18 ? 'c-top' : cls;
      rects.push(`<rect class="${tone}" x="${x0 + c}" y="${r + 4}" width="1.04" height="1.04"/>`);
    }
    rows.push(width);
  }
  const tx = 3 + Math.floor(rnd() * (cols - 8));
  for (let k = 0; k < 3; k++) for (let c = 0; c < 3 - k % 2; c++) rects.push(`<rect class="c-bloom" x="${tx + c - (k % 2)}" y="${3 - k}" width="1.04" height="1.04"/>`);
  rects.push(`<rect class="c-lamp" x="${tx + 5}" y="3" width="1.04" height="1.04"/>`);
  return `<svg viewBox="0 0 ${cols} ${depth + 5}" aria-hidden="true">${rects.join('')}</svg>`;
}

export function initIslands(host) {
  const spec = [
    { seed: 11, left: '8%', top: '14%', w: 'clamp(110px,15vw,230px)', depth: .3, delay: '0s' },
    { seed: 29, left: '56%', top: '62%', w: 'clamp(120px,17vw,260px)', depth: .7, delay: '-2s' },
    { seed: 47, left: '36%', top: '8%', w: 'clamp(70px,9vw,140px)', depth: .2, delay: '-4s' },
    { seed: 83, left: '88%', top: '44%', w: 'clamp(80px,11vw,170px)', depth: .45, delay: '-1s' },
  ];
  host.innerHTML = spec.map((p) => `<div class="isl" data-depth="${p.depth}" style="left:${p.left};top:${p.top};width:${p.w}"><div class="isl-in" style="animation-delay:${p.delay}">${islandSVG(p.seed)}</div></div>`).join('');
}

/** Small pixel scenes for the four method figures. */
const SCENES = {
  claim: () => grid(['..................', '....bb............', '...bbbb...........', '..aaaaaaaa........', '.aaeeeeeeeaa......', '..aeeeeeeea...cc..', '...aeeffea.......', '....effffe........', '.....ffff.........', '......ff..........'], 'c'),
  seal: () => `<svg viewBox="0 0 160 100"><circle class="sc-ring" cx="80" cy="50" r="34"/><circle class="sc-ring" cx="80" cy="50" r="22" style="animation-delay:-1s"/>${rect([[74,44,12,12,'sc-d']])}</svg>`,
  count: () => `<svg viewBox="0 0 160 100">${rect([[30,70,18,20,'sc-a'],[56,52,18,38,'sc-b'],[82,36,18,54,'sc-c'],[108,58,18,32,'sc-g'],[20,90,128,3,'sc-e']])}</svg>`,
  dig: () => `<svg viewBox="0 0 160 100">${rect([[70,12,8,8,'sc-d'],[72,20,4,38,'sc-d'],[62,58,24,14,'sc-d'],[66,72,16,8,'sc-d'],[70,80,8,6,'sc-d'],[20,88,120,6,'sc-a'],[30,82,10,6,'sc-b'],[112,80,8,8,'sc-c']])}</svg>`,
};
function rect(list) { return list.map(([x, y, w, h, c]) => `<rect class="${c}" x="${x}" y="${y}" width="${w}" height="${h}"/>`).join(''); }
function grid(rows) {
  const m = { a: 'sc-a', b: 'sc-b', c: 'sc-c', e: 'sc-e', f: 'sc-f' }, out = [];
  rows.forEach((r, y) => [...r].forEach((ch, x) => { if (m[ch]) out.push(`<rect class="${m[ch]}" x="${x * 8 + 8}" y="${y * 8 + 6}" width="8.2" height="8.2"/>`); }));
  return `<svg viewBox="0 0 160 100">${out.join('')}</svg>`;
}
export function initScenes() { document.querySelectorAll('[data-scene]').forEach((f) => { const fn = SCENES[f.dataset.scene]; if (fn) f.innerHTML = fn(); }); }
