"""One-shot asset prep: reads brand/ + reference/, writes src/assets/brand/* and src/palette.sampled.json.
Premultiplied-alpha resize (source PNG has pure-black RGB under alpha=0 regions)."""
from PIL import Image
import numpy as np, json
from collections import Counter

def mode_rgb(px):
    c = Counter(map(tuple, px.reshape(-1, 3))); k = c.most_common(1)[0][0]
    return '#%02x%02x%02x' % tuple(int(v) for v in k)

src = np.array(Image.open('brand/LOGO VELIUS PNG...png').convert('RGBA')).astype(np.float64)
a = src[..., 3]
print('alpha unique (top):', Counter(a.astype(int).ravel().tolist()).most_common(5))
solid = src[a > 200][:, :3].astype(np.uint8)
accent = mode_rgb(solid)
print('logo accent (mode of alpha>200 px):', accent, 'median', np.median(solid, 0))

# --- premultiplied resize
def premul_resize(arr, size):
    af = arr[..., 3:4] / 255.0
    pm = np.concatenate([arr[..., :3] * af, arr[..., 3:4]], axis=2)  # premultiplied
    chans = [Image.fromarray(pm[..., i].astype(np.float32), mode='F').resize((size, size), Image.LANCZOS) for i in range(4)]
    o = np.stack([np.array(c) for c in chans], axis=2)
    al = np.clip(o[..., 3:4], 0, 255)
    rgb = np.where(al > 0, o[..., :3] / np.maximum(al / 255.0, 1e-6), 0)
    return Image.fromarray(np.concatenate([np.clip(rgb, 0, 255), al], axis=2).astype(np.uint8), 'RGBA')

# crop square around the shovel with padding, so small renders are not mostly empty
ys, xs = np.where(a > 128); y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
side = int((y1 - y0) * 1.16); cy = (y0 + y1) // 2; cx = (x0 + x1) // 2
sq = np.zeros((side, side, 4)); oy = cy - side // 2; ox = cx - side // 2
sq[:, :, :] = src[oy:oy + side, ox:ox + side]
for s in (512, 192, 64):
    premul_resize(sq, s).save(f'src/assets/brand/logo-{s}.png', optimize=True)
print('wrote logo-512/192/64')

# --- favicon: trace real pixel grid
sub = (a[y0:y1, x0:x1] > 128)
H, W = sub.shape; unit = 12.95
gw, gh = round(W / unit), round(H / unit)
print('bbox', W, H, 'grid', gw, gh)
cells = np.zeros((gh, gw), bool)
for j in range(gh):
    for i in range(gw):
        blk = sub[int(j * H / gh):int((j + 1) * H / gh), int(i * W / gw):int((i + 1) * W / gw)]
        cells[j, i] = blk.mean() > 0.5
sc = 32.0 / gh; offx = (32 - gw * sc) / 2
rects = []
for j in range(gh):
    i = 0
    while i < gw:
        if cells[j, i]:
            k = i
            while k < gw and cells[j, k]: k += 1
            rects.append(f'M{i} {j}h{k-i}v1h-{k-i}z'); i = k
        else: i += 1
svg = (f'<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32" shape-rendering="crispEdges">'
       f'<g transform="translate({offx:.4f} 0) scale({sc:.6f})"><path fill="ACCENT" d="{"".join(rects)}"/></g></svg>')
open('src/assets/brand/favicon.svg', 'w').write(svg.replace('ACCENT', accent))

# --- palette sampling from reference art
ref = np.array(Image.open('reference/VELIUS 1.jpg.jpeg').convert('RGB')).reshape(-1, 3)
cov = np.array(Image.open('reference/SAMPUL VELIUS JPG.jpg.jpeg').convert('RGB')).reshape(-1, 3)
def exact_mode(px, cond):
    sel = px[cond(px.astype(int))]; return mode_rgb(sel), len(sel)
r = lambda p: p
pal = {
 'accent_logo': accent,
 'space_deep': exact_mode(ref, lambda p: p.sum(1) < 40)[0],
 'space_mid': exact_mode(ref, lambda p: (p[:,2] > p[:,1]+30) & (p[:,0] > 20) & (p.sum(1) < 200) & (p.sum(1) > 90))[0],
 'purple': exact_mode(ref, lambda p: (p[:,0] > 90) & (p[:,2] > 120) & (p[:,1] < 70))[0],
 'magenta': exact_mode(ref, lambda p: (p[:,0] > 200) & (p[:,2] > 150) & (p[:,1] < 90))[0],
 'ember': exact_mode(ref, lambda p: (p[:,0] > 220) & (p[:,1] > 130) & (p[:,1] < 200) & (p[:,2] < 90))[0],
 'text_white': exact_mode(ref, lambda p: p.min(1) > 245)[0],
 'coral': exact_mode(cov, lambda p: (p[:,0] > 230) & (p[:,1] > 70) & (p[:,1] < 110) & (p[:,2] < 90))[0],
 'violet_deep': exact_mode(cov, lambda p: (p[:,0] > 30) & (p[:,0] < 60) & (p[:,2] > 40) & (p[:,1] < 30))[0],
}
print(json.dumps(pal, indent=1)); json.dump(pal, open('scripts/palette.sampled.json', 'w'), indent=1)
