# Landing hero asset brief

## Scope: what changes and what stays

Three.js lives in **exactly one place** in the landing page: `src/components/three/LoopScene.tsx`, rendered behind `src/components/landing/Hero.tsx`. Everything else on the landing page (Stats, HowItWorks, Features, Testimonials, CTA) is SVG / CSS / text — no replacement work needed.

The replacement stack is raster + video assets consumed by a small client component. Plan:

```
src/components/landing/
  Hero.tsx                    (existing, edits to remove LoopSceneLazy import + bg layer)
  HeroBackgroundVideo.tsx     (new client component — plays <video> poster + loop)
  HeroParticles.tsx           (new client component — sparse CSS/SVG dots, no canvas)

public/landing/
  hero-bg.mp4                 (NEW, 8-12s loop, the centerpiece)
  hero-bg.webm                (NEW, fallback codec)
  hero-bg-poster.webp         (NEW, first-frame static image, < 250KB)
  hero-particles.png          (NEW, sparse dot pattern with transparency)
  hero-fallback-static.webp   (NEW, fully static fallback for prefers-reduced-motion)
```

After delivery:
1. `HeroBackgroundVideo` renders `<video autoplay muted loop playsinline poster=...>`, with CSS `mix-blend-mode: screen` and a dark gradient overlay on top to ensure text contrast. No WebGL, no canvas, no JS per-frame work.
2. `HeroParticles` is a single positioned PNG with subtle CSS drift animation (translate keyframes, 30s loop). One image, ~1KB of CSS.
3. Old `src/components/three/*` files removed (delete after final smoke test).
4. `Hero.tsx` no longer imports `LoopSceneLazy`; replaced with the two new components.

Net weight budget: hero video ≤ 1.5MB at 1080p, 720p ≤ 700KB, particles PNG ≤ 80KB.

---

## Brand constraints (read before generating)

Loop's identity — the imperative isn't decoration, it's evidence.

| Token | Value | Use |
|---|---|---|
| `--ink-base` | `#0b0f17` (deep navy-black) | all bg |
| `--ink-deep` | `#070a11` | depth layer |
| `--brand-cyan` | `#3dd5f3` | only accent, never large fills |
| `--brand-cyan-soft` | dim cyan | lines, secondary glow |
| `--signal-violet` | `#a06bff` | secondary accent (AI / plan) |

Mood: observatory instrument, lab bench, control plane. NOT cyberpunk, NOT stock-tech, NOT neural-net-glow.

Banned visual moves:
- Glowing circuit boards / CPU chips / motherboard traces
- Generic "matrix" data rain
- Cartoon brain / network node icons
- Stock footage of businesspeople / offices / laptops
- Stock 3D shapes (spheres, cubes, gears) with rainbow rim lighting
- Fiber-optic particle systems
- Bright saturated multi-color (Loop is monochrome cyan-on-black)

What works: focal-point visuals, slow tempo, sparse but deliberate motion, evidence of process (something happening with intent).

---

## Asset 1 — `hero-bg.mp4` (THE centerpiece)

**Purpose**: Hero background video. Plays muted, autoplay, looped, behind the headline. The single most important visual on the page.

**Specs**:
- Resolution: 1920×1080 (preferred) OR 1280×720 (acceptable, smaller file)
- Duration: 8–12 seconds, perfectly seamless loop (first frame = last frame)
- Frame rate: 24fps
- Codec: H.264 MP4 + VP9 WebM fallback
- File size: ≤ 1.5 MB for 1080p, ≤ 700 KB for 720p
- Color space: dark — average luma under 40/255, so headline text stays readable without heavy overlay
- Aspect: 16:9, scales via `object-fit: cover`
- No audio
- No text, no UI, no logos
- No visible compression artifacts in the focal area (where headline sits)

**Three prompt variants — generate all three, pick the best, or remix**:

### Variant A — Closing arcs
```
Abstract observatory visualization, deep near-black background (#0a0f17).
Faint cyan (#3dd5f3) luminous arcs drift through 3D space, slowly converging
from the periphery toward the center of frame. As arcs meet, they form a
closed circular loop, hold for one second, then dissolve and reset to drift
outward again. Camera nearly static with subtle 5-degree parallax drift.
Mood: precision instrument, slow tempo, contemplative. No text, no UI,
no logos, no figures. 24fps cinematic motion blur on arcs.
```

### Variant B — Particle convergence
```
Dark observatory interior, near-black navy background. Roughly 200 small
soft cyan-white luminous points float in 3D space, drifting slowly.
Every few seconds, the points gently accelerate toward a single focal
point at frame center, briefly form a tight cluster, then disperse back
outward into the original floating field. Subtle camera dolly forward
during convergence, dolly back during dispersal. 24fps, slow tempo,
sparse composition, mostly empty space. No text, no UI.
```

### Variant C — Layered rings (authority tiers)
```
Abstract control-plane visualization, deep near-black background (#0a0f17).
Four concentric thin glowing cyan rings, slightly offset in 3D so they
appear as nested ellipses rather than flat circles. Each ring pulses
in sequence (outer → inner → outer) over a 6-second cycle, suggesting
a tiered authority decision system. Soft bloom on highlights. Faint
particle dust drifting in the background. Camera static. Very slow tempo.
No text, no UI, no figures. Mood: instrument panel, not entertainment.
```

**Technical generation notes**:
- Use Runway Gen-3/4, Sora, Luma Dream Machine, or Kling 1.6 for best results.
- For Runway: set motion intensity to low/medium, set seed, generate 4-8s clips, extend or stitch.
- For Sora: ask for "10 second seamless loop" explicitly.
- For Luma: select "cinematic" mode, prompt "loop perfectly".
- If using Higgsfield (your reference example was on their CDN), use their "product abstract" or "sci-fi ambient" preset with low motion.

**Verification checklist before delivering**:
- [ ] Loops seamlessly (last frame ≈ first frame)
- [ ] Average frame luma ≤ 40/255 (test with ffmpeg: `ffmpeg -i hero-bg.mp4 -vf signalstats -f null - 2>&1 | grep YAVG`)
- [ ] Center-frame area (where headline lands) is darkest, not brightest
- [ ] No copyright/IP risks
- [ ] File size within budget
- [ ] Plays on iOS Safari (H.264 baseline profile, no B-frames in first GOP)

---

## Asset 2 — `hero-bg-poster.webp`

**Purpose**: Static image shown while video loads, and as the displayed frame if video fails.

**Specs**:
- 1920×1080 (or 1280×720), WebP, ≤ 250 KB
- Should be visually similar to a representative frame of the chosen video (Variant A/B/C)
- Same dark composition

**Prompt**:
```
Abstract observatory visualization poster, deep near-black background
(#0a0f17). Faint glowing cyan (#3dd5f3) curves and points suspended in
3D space, single dramatic focal area. Soft bloom on highlights. No text,
no UI, no logos. Cinematic composition with most visual weight in the
center-left third. 16:9 aspect ratio, photography-quality, high contrast
between dark field and luminous accents.
```

---

## Asset 3 — `hero-particles.png`

**Purpose**: Subtle ambient particle layer that sits ABOVE the video (with reduced opacity) to add the "data field" feel that the original Three.js particle system provided.

**Specs**:
- 1920×1080 PNG with transparency
- ~60–120 small white-cyan dots scattered with even-but-irregular density
- Dot sizes: 1px–4px, with soft Gaussian glow (each dot is a small radial gradient, not a hard circle)
- Color: very desaturated white with cyan tint, max alpha 0.7
- File size: ≤ 80 KB

**Prompt**:
```
Sparse particle field on transparent background, dark version. Roughly
90 small soft glowing dots, sizes 1-4px, scattered with even-but-irregular
density across 1920x1080. Each dot is a soft radial gradient (Gaussian
falloff, not a hard circle). Color: very light cyan-white with max 70%
opacity at the center, fully transparent at edges. No large stars, no
clumps, no visible patterns. Film grain texture subtle on background.
```

**Alternative — generate procedurally**:
If AI generation produces noise you don't like, just generate this procedurally:
```bash
node -e "
const { createCanvas } = require('canvas');
const c = createCanvas(1920, 1080);
const ctx = c.getContext('2d');
for (let i = 0; i < 90; i++) {
  const x = Math.random() * 1920;
  const y = Math.random() * 1080;
  const r = 1 + Math.random() * 3;
  const g = ctx.createRadialGradient(x, y, 0, x, y, r * 2);
  g.addColorStop(0, 'rgba(180, 230, 255, 0.7)');
  g.addColorStop(1, 'rgba(180, 230, 255, 0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(x, y, r * 2, 0, Math.PI*2); ctx.fill();
}
require('fs').writeFileSync('hero-particles.png', c.toBuffer('image/png'));
"
```
(Pure JS, no AI needed, ~5KB output, full control over density.)

---

## Asset 4 — `hero-fallback-static.webp`

**Purpose**: Fully static fallback for `prefers-reduced-motion: reduce`. Shown instead of video when user has reduced motion enabled.

**Specs**:
- 1920×1080 WebP, ≤ 300 KB
- Same composition as `hero-bg-poster.webp` but more deliberate
- Single image, no animation suggestion

**Prompt**:
```
Static observatory visualization poster, deep near-black background
(#0a0f17). A single luminous cyan ring (#3dd5f3) at frame center,
half-formed, with soft glowing points around it suggesting data input.
No motion implied. Soft bloom on highlights. High contrast between
field and luminous accents. 16:9. Photography-quality. No text, no UI.
```

---

## Asset 5 (optional) — `gate-bg.webp`

**Purpose**: Background for `/gate` (the access gate page). Currently uses the same LoopScene fallback gradient.

**Specs**:
- 1920×1080 WebP, ≤ 400 KB
- Even more subtle than hero — this page is a single form, visual should be ambient not focal

**Prompt**:
```
Abstract dark ambient texture, deep near-black background (#0a0f17).
Very faint cyan vignette glow at the center. Almost entirely black
with the barest suggestion of structure. Suitable as a backdrop for a
centered form. 16:9. No text, no UI, no focal points.
```

---

## What to deliver back

Once generated, place files at these paths (I will wire them into the code):

```
public/landing/hero-bg.mp4
public/landing/hero-bg.webm
public/landing/hero-bg-poster.webp
public/landing/hero-particles.png
public/landing/hero-fallback-static.webp
public/landing/gate-bg.webp           (optional)
```

Then I'll:
1. Write `HeroBackgroundVideo.tsx` and `HeroParticles.tsx`
2. Patch `Hero.tsx` to use them instead of `LoopSceneLazy`
3. Delete `src/components/three/LoopScene.tsx`, `LoopSceneLazy.tsx`, and the directory
4. Remove `three`, `@react-three/fiber`, `@react-three/postprocessing` from `package.json`
5. Run `npm install` to drop ~250KB from `node_modules`
6. Re-verify landing page through the live tunnel

Tell me when you've got the assets dropped in `public/landing/` (or send them inline and I'll write them to disk), and I'll do the rest.
