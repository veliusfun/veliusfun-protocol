// Motion toolkit. Every function degrades to instant when reduced motion is requested.
export const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Damped spring solver (semi-implicit Euler, fixed 1/120s steps). */
export function spring({ from = 0, to = 1, stiffness = 170, damping = 22, mass = 1, onUpdate, onDone }) {
  if (reduced()) { onUpdate(to); onDone && onDone(); return () => {}; }
  let x = from, v = 0, last = performance.now(), raf = 0, acc = 0, dead = false;
  const dt = 1 / 120;
  const frame = (now) => {
    if (dead) return;
    acc += Math.min(0.05, (now - last) / 1000); last = now;
    while (acc >= dt) { const a = (-stiffness * (x - to) - damping * v) / mass; v += a * dt; x += v * dt; acc -= dt; }
    onUpdate(x);
    if (Math.abs(v) < 0.001 && Math.abs(x - to) < 0.001) { onUpdate(to); onDone && onDone(); return; }
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  return () => { dead = true; cancelAnimationFrame(raf); };
}

/** Scroll reveal with staggered spring entrance. Elements start hidden via .js .rv. */
export function initReveal() {
  const els = [...document.querySelectorAll('.rv')];
  if (reduced() || !('IntersectionObserver' in window)) { els.forEach((e) => { e.style.opacity = 1; e.style.transform = 'none'; }); return; }
  let batch = 0;
  const io = new IntersectionObserver((entries) => {
    const vis = entries.filter((e) => e.isIntersecting);
    vis.forEach((e, i) => {
      io.unobserve(e.target);
      const el = e.target;
      setTimeout(() => spring({ stiffness: 150, damping: 17, onUpdate: (p) => { el.style.opacity = Math.max(0, Math.min(1, p)); el.style.transform = `translateY(${(1 - p) * 26}px)`; }, onDone: () => { el.style.transform = 'none'; } }), i * 80 + batch);
    });
  }, { rootMargin: '0px 0px -10% 0px', threshold: 0.05 });
  els.forEach((e) => io.observe(e));
}

/** Spotlight hover: writes --mx/--my on any [data-spot]. */
export function initSpotlight(root = document) {
  root.addEventListener('pointermove', (ev) => {
    const el = ev.target.closest && ev.target.closest('[data-spot], .mrow');
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--mx', ev.clientX - r.left + 'px');
    el.style.setProperty('--my', ev.clientY - r.top + 'px');
  }, { passive: true });
}

export function initProgress(bar, header) {
  const on = () => {
    const h = document.documentElement.scrollHeight - innerHeight;
    bar.style.transform = `scaleX(${h > 0 ? Math.min(1, scrollY / h) : 0})`;
    header.classList.toggle('solid', scrollY > 24);
  };
  addEventListener('scroll', on, { passive: true }); addEventListener('resize', on); on();
}

/** Parallax: layers carry data-depth; pointer + scroll. */
export function initParallax(hero) {
  if (reduced()) return;
  const layers = [...hero.querySelectorAll('[data-depth]')];
  let tx = 0, ty = 0, cx = 0, cy = 0, run = false, visible = true;
  hero.addEventListener('pointermove', (e) => { const r = hero.getBoundingClientRect(); tx = (e.clientX - r.left) / r.width - 0.5; ty = (e.clientY - r.top) / r.height - 0.5; }, { passive: true });
  new IntersectionObserver((es) => { visible = es[0].isIntersecting; kick(); }).observe(hero);
  addEventListener('scroll', kick, { passive: true });
  function kick() { if (!run && visible) { run = true; requestAnimationFrame(step); } }
  function step() {
    cx += (tx - cx) * 0.08; cy += (ty - cy) * 0.08;
    const sy = Math.min(scrollY, innerHeight);
    for (const l of layers) {
      const d = parseFloat(l.dataset.depth);
      l.style.transform = `translate3d(${-cx * d * 60}px, ${-cy * d * 40 + sy * d * 0.35}px, 0)`;
    }
    if (visible && (Math.abs(tx - cx) > 0.001 || Math.abs(ty - cy) > 0.001)) requestAnimationFrame(step); else run = false;
  }
  kick();
}

/** Count-up with directional flash on change. fmt turns a number into text. */
export function setNumber(el, value, fmt) {
  const prev = el._v;
  el._v = value;
  if (value == null || Number.isNaN(value)) { el.textContent = '—'; el._v = null; return; }
  if (reduced()) { el.textContent = fmt(value); return; }
  const from = prev == null ? 0 : prev;
  if (prev != null && prev !== value) {
    el.classList.remove('flash-up', 'flash-down'); void el.offsetWidth;
    el.classList.add(value > prev ? 'flash-up' : 'flash-down');
  }
  if (from === value) { el.textContent = fmt(value); return; }
  const t0 = performance.now(), dur = prev == null ? 900 : 500;
  const tick = (now) => {
    const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 4);
    el.textContent = fmt(from + (value - from) * e);
    if (k < 1) requestAnimationFrame(tick); else el.textContent = fmt(value);
  };
  requestAnimationFrame(tick);
}
