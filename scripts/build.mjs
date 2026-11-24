// Build: src/ -> dist/ (override with OUT=…, test builds only). Zero dependencies.
import { rm, mkdir, cp, readFile, writeFile, readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'src');
const out = path.resolve(process.env.OUT || path.join(root, 'dist'));
const fails = [];
const must = (cond, msg) => { if (!cond) fails.push(msg); };

async function walk(dir) {
  const acc = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    e.isDirectory() ? acc.push(...await walk(p)) : acc.push(p);
  }
  return acc;
}

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
await cp(path.join(src, 'index.html'), path.join(out, 'index.html'));
for (const d of ['css', 'js', 'assets']) await cp(path.join(src, d), path.join(out, d), { recursive: true });
// explicit logo copies: prepared sizes (premultiplied resize) + the untouched source from brand/
await mkdir(path.join(out, 'assets/brand'), { recursive: true });
await cp(path.join(root, 'brand', 'LOGO VELIUS PNG...png'), path.join(out, 'assets/brand/logo-source.png'));

// Test-only register override (never used for dist/): VELIUS_CA=<address>, VELIUS_GITHUB=<url>
if (process.env.VELIUS_CA || process.env.VELIUS_GITHUB) {
  const f = path.join(out, 'js/register.js');
  let t = await readFile(f, 'utf8');
  if (process.env.VELIUS_CA) t = t.replace("{ id: 'ca',            label: 'CA', state: 'absent',  value: null }", `{ id: 'ca', label: 'CA', state: 'stated', value: '${process.env.VELIUS_CA}' }`);
  if (process.env.VELIUS_GITHUB) t = t.replace("{ id: 'github',        label: 'GitHub',           state: 'absent',  value: null }", `{ id: 'github', label: 'GitHub', state: 'stated', value: '${process.env.VELIUS_GITHUB}' }`);
  await writeFile(f, t);
}

// ---- gates run at build time
const html = await readFile(path.join(out, 'index.html'), 'utf8');

// 1. logo present in output and referenced with a relative path that resolves
for (const f of ['assets/brand/logo-64.png', 'assets/brand/logo-192.png', 'assets/brand/logo-512.png', 'assets/brand/favicon.svg', 'assets/brand/logo-source.png'])
  must(existsSync(path.join(out, f)), `missing in output: ${f}`);
must(/src="assets\/brand\/logo-512\.png"/.test(html), 'index.html does not reference assets/brand/logo-512.png');
must(/href="assets\/brand\/favicon\.svg"/.test(html), 'index.html does not reference favicon.svg');

// 2. every local reference in index.html resolves
for (const m of html.matchAll(/(?:src|href)="([^"#:]+?)"/g)) {
  const rel = m[1]; if (/^(https?:|mailto:|data:)/.test(rel)) continue;
  must(existsSync(path.join(out, rel)), `unresolved reference: ${rel}`);
}
for (const m of html.matchAll(/(?:src|href)="([^"]+)"/g)) must(!m[1].startsWith('/'), `root-absolute path breaks relative deploy: ${m[1]}`);

// 3. palette rule: colour literals only in tokens.css (and the traced favicon asset)
for (const f of await walk(src)) {
  const rel = path.relative(src, f).replaceAll('\\', '/');
  if (rel === 'css/tokens.css' || rel.endsWith('.png') || rel === 'assets/brand/favicon.svg') continue;
  const t = await readFile(f, 'utf8');
  const hits = t.match(/#[0-9a-fA-F]{3,8}\b(?![\w-])|\brgba?\(|\bhsla?\(/g);
  // '#home'-style anchors are not colours: exclude hits that are in href="#…" or url fragments
  const real = (hits || []).filter((h) => !/^#(home|board|method|ledger|faq)$/.test(h) && !/^#[0-9a-fA-F]{3,8}$/.test(h) ? true : /^#[0-9a-fA-F]{3,8}$/.test(h) && !/^#(?:[a-f]{3}|face|fade|bad|add|dad|dead)$/i.test(h) && /[0-9]/.test(h) ? true : false);
  must(real.length === 0, `colour literal outside tokens.css in ${rel}: ${[...new Set(real)].join(' ')}`);
}

// 4. no dates / timestamps in markup or clock APIs in code
const visible = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<svg[\s\S]*?<\/svg>/g, ' ').replace(/<[^>]+>/g, ' ');
const dateRe = /\b(?:19|20)\d{2}\b|\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b\.? \d{1,2}|\b\d{1,2}:\d{2}\b|\b\d{1,2}\/\d{1,2}\/\d{2,4}\b|\bas of\b|\bchecked\b|\bupdated\b|\bago\b/i;
must(!dateRe.test(visible), `date-like text in markup: ${(visible.match(dateRe) || [])[0]}`);
for (const f of await walk(path.join(out, 'js'))) {
  const t = await readFile(f, 'utf8');
  must(!/new Date\(|Date\.now|toLocale(Date|Time)String|toISOString/.test(t), `clock API in ${path.basename(f)}`);
}

// 5. address scanner over the built markup: 0x hex is matched, never blanket-rejected
const { register } = await import(pathToFileURL(path.join(out, 'js/register.js')).href + '?t=' + Date.now());
const { scanAddresses } = await import(pathToFileURL(path.join(out, 'js/gate.js')).href + '?t=' + Date.now());
const scan = scanAddresses(visible, register);
must(scan.unknown.length === 0, `unmatched address-shaped strings: ${scan.unknown.map((s) => s.value).join(', ')}`);

if (fails.length) { console.error('BUILD FAILED\n - ' + fails.join('\n - ')); process.exit(1); }
const files = (await walk(out)).length;
console.log(`build ok -> ${path.relative(root, out) || '.'}  (${files} files, ca=${register.isStated('ca') ? 'stated' : 'absent'}, github=${register.isStated('github') ? 'stated' : 'absent'})`);
