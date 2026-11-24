// Proves both CA branches. Builds dist/ (CA absent) and a throwaway stated variant in .verify/.
import { spawnSync } from 'node:child_process';
import { rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CA = 'So11111111111111111111111111111111111111112';
const HEX = '0x52908400098527886E0F7030069857D2E4169EE7';
const run = (env) => spawnSync(process.execPath, [path.join(root, 'scripts/build.mjs')], { env: { ...process.env, ...env }, encoding: 'utf8' });
let pass = 0, total = 0; const bad = [];
const gate = (name, cond) => { total++; cond ? pass++ : bad.push(name); console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`); };

const a = run({}); console.log(a.stdout.trim() || a.stderr.trim()); gate('build exit 0 (CA absent) -> dist/', a.status === 0);
const vdir = path.join(root, '.verify');
const b = run({ OUT: vdir, VELIUS_CA: CA, VELIUS_GITHUB: 'https://github.com/velius-fun/velius' }); console.log(b.stdout.trim() || b.stderr.trim()); gate('build exit 0 (CA stated, GitHub stated) -> .verify/', b.status === 0);

const load = async (dir) => ({ reg: (await import(pathToFileURL(path.join(dir, 'js/register.js')).href + '?v=' + Math.random())).register, g: await import(pathToFileURL(path.join(dir, 'js/gate.js')).href + '?v=' + Math.random()), r: await import(pathToFileURL(path.join(dir, 'js/register.js')).href + '?w=' + Math.random()) });
const A = await load(path.join(root, 'dist')), S = await load(vdir);

// CA gate
gate('absent: caState.stated === false', A.g.caState(A.reg).stated === false);
gate('stated: caState carries the exact address', S.g.caState(S.reg).stated && S.g.caState(S.reg).value === CA);
// link rule
gate('X stated: href derived from stored URL', A.g.linkFor(A.reg, 'x') === 'https://x.com/veliusfun');
gate('X stated: handle derived (@veliusfun)', A.r.handleOf('x') === '@veliusfun');
gate('GitHub absent: no href', A.g.linkFor(A.reg, 'github') === null && A.r.handleOf('github') === null);
gate('GitHub stated variant: href present', S.g.linkFor(S.reg, 'github') === 'https://github.com/velius-fun/velius');
gate('CA absent: no link derivable', A.g.linkFor(A.reg, 'ca') === null);
// address scanner
gate('scanner: CA-shaped string is flagged when CA absent', A.g.scanAddresses(`see ${CA}`, A.reg).unknown.length === 1);
gate('scanner: CA exempt when CA stated', S.g.scanAddresses(`see ${CA}`, S.reg).unknown.length === 0);
gate('scanner: 0x hex recognised as address-shaped (not blanket-rejected, not ignored)', A.g.findAddressShapes(HEX).length === 1 && A.g.findAddressShapes(HEX)[0].kind === 'hex');
gate('scanner: other 0x hex stays unmatched until stated', A.g.scanAddresses(HEX, A.reg).unknown.length === 1);
gate('scanner: 0x hex matches a stated record (registry match)', (() => { const fake = { all: () => [{ state: 'stated', value: HEX }], value: () => null }; const r = A.g.scanAddresses(HEX, fake); return r.matched.length === 1 && r.unknown.length === 0; })());
// market independence
gate('market source identical in both CA states', A.reg.value('market-source') === S.reg.value('market-source') && !!A.reg.value('market-source'));
gate('register frozen (records immutable)', Object.isFrozen(A.reg) && Object.isFrozen(A.reg.get('ca')));

await rm(vdir, { recursive: true, force: true });
console.log(`\ngates: ${pass}/${total} passed${bad.length ? ' — failed: ' + bad.join('; ') : ''}`);
process.exit(bad.length ? 1 : 0);
