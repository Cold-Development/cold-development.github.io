// The frozen window.
// .ice-scene: cracked lake ice behind the glass, rendered once per size/theme.
// .ice-frost: frost on the glass. It forms from the edges on load, the cursor
// (or a tap) wipes it clear, and it slowly freezes back over.
(() => {
    const sceneCanvas = document.querySelector('.ice-scene');
    const frostCanvas = document.querySelector('.ice-frost');
    if (!sceneCanvas || !frostCanvas || !sceneCanvas.getContext) return;

    const scene = sceneCanvas.getContext('2d');
    const frost = frostCanvas.getContext('2d');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const darkScheme = window.matchMedia('(prefers-color-scheme: dark)');

    const CLEAR_SCALE = 8;      // the wipe map is 1/8 of the viewport, smoothed when drawn
    const INTRO_SECONDS = 2.6;  // frost forming over the window on load
    const REFREEZE_PER_SEC = 0.3;
    const IDLE_STOP_SECONDS = 12;

    let width = 0;
    let height = 0;
    let dpr = 1;
    let colors = {};
    let frostTexture = null;
    let clearMap = null;
    let clearCtx = null;
    let running = false;
    let lastFrame = 0;
    let lastWipe = 0;
    let introLeft = 0;
    let lastPoint = null;
    let dirty = null;           // wiped area in clear-map units: only this part is redrawn

    const rand = (min, max) => min + Math.random() * (max - min);

    // Resolve any CSS colour (hex, rgba) to [r, g, b, a 0..1]
    const probe = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
    function toRGBA(value) {
        probe.clearRect(0, 0, 1, 1);
        probe.fillStyle = '#000';
        probe.fillStyle = value;
        probe.fillRect(0, 0, 1, 1);
        const [r, g, b, a] = probe.getImageData(0, 0, 1, 1).data;
        return [r, g, b, a / 255];
    }

    function readColors() {
        const css = getComputedStyle(document.documentElement);
        const get = (name) => css.getPropertyValue(name).trim();
        colors = {
            deep: toRGBA(get('--scene-deep')),
            mid: toRGBA(get('--scene-mid')),
            crack: get('--scene-crack'),
            crackRGBA: toRGBA(get('--scene-crack')),
            tint: get('--frost-tint'),
            crystal: get('--frost-crystal'),
            dark: darkScheme.matches
        };
    }

    function size() {
        dpr = Math.min(window.devicePixelRatio || 1, 2);
        width = window.innerWidth;
        height = window.innerHeight;
        for (const canvas of [sceneCanvas, frostCanvas]) {
            canvas.width = Math.round(width * dpr);
            canvas.height = Math.round(height * dpr);
        }
    }

    // ---- Behind the glass: lake ice with cracks ---------------------------

    function voronoiField(w, h, count) {
        const points = [];
        for (let i = 0; i < count; i++) points.push([Math.random() * w, Math.random() * h, Math.random()]);
        const nearest = new Float32Array(w * h);
        const edge = new Float32Array(w * h);
        const shade = new Float32Array(w * h);
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                let d1 = Infinity;
                let d2 = Infinity;
                let s = 0;
                for (const p of points) {
                    const dx = p[0] - x;
                    const dy = p[1] - y;
                    const d = dx * dx + dy * dy;
                    if (d < d1) { d2 = d1; d1 = d; s = p[2]; }
                    else if (d < d2) { d2 = d; }
                }
                const i = y * w + x;
                d1 = Math.sqrt(d1);
                nearest[i] = d1;
                edge[i] = Math.sqrt(d2) - d1;
                shade[i] = s;
            }
        }
        return { nearest, edge, shade };
    }

    function renderScene() {
        // Low-res field, scaled up smoothly: the frost and glass soften it anyway
        const step = 3;
        const w = Math.ceil(width / step);
        const h = Math.ceil(height / step);
        const big = voronoiField(w, h, Math.max(24, Math.round((w * h) / 2200)));
        const fine = voronoiField(w, h, Math.max(60, Math.round((w * h) / 380)));

        const image = new ImageData(w, h);
        const data = image.data;
        const { deep, mid, crackRGBA } = colors;

        for (let y = 0; y < h; y++) {
            const depth = y / h;
            for (let x = 0; x < w; x++) {
                const i = y * w + x;
                // Each slab of ice has its own clarity, darker toward its middle
                let t = 0.25 + big.shade[i] * 0.55 - Math.min(big.nearest[i] / 60, 1) * 0.25 + (1 - depth) * 0.15;
                t = Math.min(1, Math.max(0, t));
                let r = deep[0] + (mid[0] - deep[0]) * t;
                let g = deep[1] + (mid[1] - deep[1]) * t;
                let b = deep[2] + (mid[2] - deep[2]) * t;

                // Main cracks, then a net of hairline fractures
                const main = Math.max(0, 1 - big.edge[i] / 1.6);
                const hair = Math.max(0, 1 - fine.edge[i] / 0.9) * 0.28;
                const glow = Math.max(0, 1 - big.edge[i] / 7) * 0.12;
                const c = Math.min(1, (main + hair + glow) * crackRGBA[3]);
                r += (crackRGBA[0] - r) * c;
                g += (crackRGBA[1] - g) * c;
                b += (crackRGBA[2] - b) * c;

                const o = i * 4;
                data[o] = r;
                data[o + 1] = g;
                data[o + 2] = b;
                data[o + 3] = 255;
            }
        }

        const tile = document.createElement('canvas');
        tile.width = w;
        tile.height = h;
        tile.getContext('2d').putImageData(image, 0, 0);

        scene.setTransform(dpr, 0, 0, dpr, 0, 0);
        scene.imageSmoothingEnabled = true;
        scene.imageSmoothingQuality = 'high';
        scene.drawImage(tile, 0, 0, width, height);

        // Air bubbles trapped in the ice
        scene.strokeStyle = colors.crack;
        for (let i = 0; i < Math.round((width * height) / 26000); i++) {
            const r = rand(0.8, 3.6);
            scene.globalAlpha = rand(0.25, 0.6);
            scene.lineWidth = 0.8;
            scene.beginPath();
            scene.arc(rand(0, width), rand(0, height), r, 0, Math.PI * 2);
            scene.stroke();
        }
        scene.globalAlpha = 1;
    }

    // ---- On the glass: frost ----------------------------------------------

    // Fern-like ice crystals: main branches with 60 degree side branches
    function growCrystals(ctx, seeds) {
        const SIXTY = Math.PI / 3;
        const widths = [1.1, 0.7, 0.45];
        const paths = [new Path2D(), new Path2D(), new Path2D()];
        let branches = seeds.map(([x, y, angle, length]) => ({ x, y, angle, left: length, gen: 0, until: rand(5, 12), side: 1 }));

        while (branches.length) {
            const next = [];
            for (const b of branches) {
                const path = paths[b.gen];
                path.moveTo(b.x, b.y);
                while (b.left > 0) {
                    const stepLength = Math.min(3, b.left);
                    b.left -= stepLength;
                    b.until -= stepLength;
                    if (b.gen === 0) b.angle += rand(-0.05, 0.05);
                    b.x += Math.cos(b.angle) * stepLength;
                    b.y += Math.sin(b.angle) * stepLength;
                    path.lineTo(b.x, b.y);
                    if (b.gen < 2 && b.until <= 0 && b.left > 6) {
                        const sides = Math.random() < 0.25 ? [1, -1] : [b.side];
                        for (const s of sides) {
                            next.push({ x: b.x, y: b.y, angle: b.angle + s * SIXTY * rand(0.9, 1.1), left: b.left * rand(0.3, 0.55), gen: b.gen + 1, until: rand(6, 12) * (b.gen + 2), side: 1 });
                        }
                        b.side = -b.side;
                        b.until = rand(9, 16) * (b.gen + 1);
                    }
                }
            }
            branches = next;
        }

        ctx.strokeStyle = colors.crystal;
        ctx.lineCap = 'round';
        paths.forEach((path, gen) => {
            ctx.globalAlpha = [0.9, 0.7, 0.5][gen];
            ctx.lineWidth = widths[gen];
            ctx.stroke(path);
        });
        ctx.globalAlpha = 1;
    }

    function buildFrost() {
        frostTexture = document.createElement('canvas');
        frostTexture.width = frostCanvas.width;
        frostTexture.height = frostCanvas.height;
        const ctx = frostTexture.getContext('2d');
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        // Frosted glass diffuses what is behind it: start from the scene,
        // blurred by scaling it down and back up (works without ctx.filter)
        const blur = document.createElement('canvas');
        blur.width = Math.max(1, Math.round(width / 16));
        blur.height = Math.max(1, Math.round(height / 16));
        const blurCtx = blur.getContext('2d');
        blurCtx.imageSmoothingQuality = 'high';
        blurCtx.drawImage(sceneCanvas, 0, 0, blur.width, blur.height);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(blur, 0, 0, width, height);

        // Even frost over the pane, thicker toward the frame
        ctx.fillStyle = colors.tint;
        ctx.fillRect(0, 0, width, height);
        const edge = ctx.createRadialGradient(width / 2, height / 2, Math.min(width, height) * 0.3, width / 2, height / 2, Math.hypot(width, height) / 2);
        edge.addColorStop(0, 'rgba(0, 0, 0, 0)');
        edge.addColorStop(1, colors.tint);
        ctx.fillStyle = edge;
        ctx.fillRect(0, 0, width, height);

        // Frosted grain
        const grain = document.createElement('canvas');
        grain.width = grain.height = 160;
        const g = grain.getContext('2d');
        const noise = g.createImageData(160, 160);
        const [cr, cg, cb] = toRGBA(colors.crystal);
        for (let i = 0; i < noise.data.length; i += 4) {
            noise.data[i] = cr;
            noise.data[i + 1] = cg;
            noise.data[i + 2] = cb;
            noise.data[i + 3] = Math.random() < 0.5 ? Math.random() * (colors.dark ? 46 : 80) : 0;
        }
        g.putImageData(noise, 0, 0);
        ctx.fillStyle = ctx.createPattern(grain, 'repeat');
        ctx.fillRect(0, 0, width, height);

        // Crystals: dense along the frame, a few loose ones on the pane
        const reach = Math.min(width, height);
        const seeds = [];
        const perimeter = 2 * (width + height);
        for (let i = 0, n = Math.round(perimeter / 70); i < n; i++) {
            let d = Math.random() * perimeter;
            let x, y, inward;
            if (d < width) { x = d; y = 0; inward = Math.PI / 2; }
            else if ((d -= width) < height) { x = width; y = d; inward = Math.PI; }
            else if ((d -= height) < width) { x = width - d; y = height; inward = -Math.PI / 2; }
            else { d -= width; x = 0; y = height - d; inward = 0; }
            seeds.push([x, y, inward + rand(-0.75, 0.75), reach * rand(0.08, 0.26)]);
        }
        for (const [x, y] of [[0, 0], [width, 0], [0, height], [width, height]]) {
            const toCenter = Math.atan2(height / 2 - y, width / 2 - x);
            for (let k = 0; k < 3; k++) seeds.push([x, y, toCenter + rand(-0.5, 0.5), reach * rand(0.25, 0.4)]);
        }
        for (let i = 0, n = Math.round((width * height) / 90000); i < n; i++) {
            seeds.push([rand(0, width), rand(0, height), rand(0, Math.PI * 2), reach * rand(0.03, 0.08)]);
        }
        growCrystals(ctx, seeds);
    }

    // ---- Wiping and refreezing --------------------------------------------

    function resetClearMap(clear) {
        clearMap = document.createElement('canvas');
        clearMap.width = Math.ceil(width / CLEAR_SCALE);
        clearMap.height = Math.ceil(height / CLEAR_SCALE);
        clearCtx = clearMap.getContext('2d');
        dirty = null;
        if (clear) {
            clearCtx.fillStyle = '#fff';
            clearCtx.fillRect(0, 0, clearMap.width, clearMap.height);
            markDirty(0, 0, clearMap.width, clearMap.height);
        }
    }

    function markDirty(x, y, w, h) {
        const x2 = Math.min(clearMap.width, Math.ceil(x + w) + 1);
        const y2 = Math.min(clearMap.height, Math.ceil(y + h) + 1);
        const x1 = Math.max(0, Math.floor(x) - 1);
        const y1 = Math.max(0, Math.floor(y) - 1);
        if (!dirty) dirty = { x1, y1, x2, y2 };
        else {
            dirty.x1 = Math.min(dirty.x1, x1);
            dirty.y1 = Math.min(dirty.y1, y1);
            dirty.x2 = Math.max(dirty.x2, x2);
            dirty.y2 = Math.max(dirty.y2, y2);
        }
    }

    // Frost texture minus the wiped areas, redrawn only inside the dirty box
    function compose(full) {
        const k = frostCanvas.width / clearMap.width;
        const box = full || !dirty ? { x1: 0, y1: 0, x2: clearMap.width, y2: clearMap.height } : dirty;
        const sx = Math.floor(box.x1 * k);
        const sy = Math.floor(box.y1 * k);
        const sw = Math.min(frostCanvas.width, Math.ceil(box.x2 * k)) - sx;
        const sh = Math.min(frostCanvas.height, Math.ceil(box.y2 * k)) - sy;
        if (sw <= 0 || sh <= 0) return;

        frost.setTransform(1, 0, 0, 1, 0, 0);
        frost.globalCompositeOperation = 'source-over';
        frost.clearRect(sx, sy, sw, sh);
        frost.drawImage(frostTexture, sx, sy, sw, sh, sx, sy, sw, sh);
        frost.globalCompositeOperation = 'destination-out';
        frost.imageSmoothingEnabled = true;
        frost.imageSmoothingQuality = 'high';
        frost.drawImage(clearMap, box.x1, box.y1, box.x2 - box.x1, box.y2 - box.y1, box.x1 * k, box.y1 * k, (box.x2 - box.x1) * k, (box.y2 - box.y1) * k);
        frost.globalCompositeOperation = 'source-over';
    }

    function dab(x, y, scale = 1) {
        const r = (Math.max(60, Math.min(width, height) * 0.09) * scale) / CLEAR_SCALE;
        const cx = x / CLEAR_SCALE;
        const cy = y / CLEAR_SCALE;
        const gradient = clearCtx.createRadialGradient(cx, cy, 0, cx, cy, r);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
        gradient.addColorStop(0.6, 'rgba(255, 255, 255, 0.4)');
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        clearCtx.globalCompositeOperation = 'source-over';
        clearCtx.fillStyle = gradient;
        clearCtx.fillRect(cx - r, cy - r, r * 2, r * 2);
        markDirty(cx - r, cy - r, r * 2, r * 2);
    }

    function wipe(x, y) {
        if (lastPoint) {
            const dx = x - lastPoint[0];
            const dy = y - lastPoint[1];
            const steps = Math.min(30, Math.ceil(Math.hypot(dx, dy) / 18));
            for (let s = 1; s <= steps; s++) dab(lastPoint[0] + (dx * s) / steps, lastPoint[1] + (dy * s) / steps);
        } else {
            dab(x, y);
        }
        lastPoint = [x, y];
        lastWipe = performance.now();
        start();
    }

    function refreeze(dt) {
        clearCtx.globalCompositeOperation = 'destination-out';
        if (introLeft > 0) {
            // Frost forms at the frame first and reaches the middle last
            const t = 1 - introLeft / INTRO_SECONDS;
            const cx = clearMap.width / 2;
            const cy = clearMap.height / 2;
            const far = Math.hypot(cx, cy);
            const inner = Math.max(0, far * (1 - t * 1.25));
            const gradient = clearCtx.createRadialGradient(cx, cy, inner, cx, cy, inner + far * 0.45);
            gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
            gradient.addColorStop(1, `rgba(0, 0, 0, ${Math.min(1, dt * 4)})`);
            clearCtx.fillStyle = gradient;
            introLeft -= dt;
        } else {
            const amount = 1 - Math.pow(1 - REFREEZE_PER_SEC, dt);
            clearCtx.fillStyle = `rgba(0, 0, 0, ${amount})`;
        }
        if (dirty) clearCtx.fillRect(dirty.x1, dirty.y1, dirty.x2 - dirty.x1, dirty.y2 - dirty.y1);
    }

    function frame(now) {
        const dt = Math.min((now - lastFrame) / 1000, 0.05);
        lastFrame = now;
        refreeze(dt);
        compose();
        if (introLeft > 0 || now - lastWipe < IDLE_STOP_SECONDS * 1000) {
            requestAnimationFrame(frame);
        } else {
            // Fully refrozen: drop any leftover clear pixels and rest
            const last = dirty;
            resetClearMap(false);
            dirty = last;
            compose();
            dirty = null;
            running = false;
        }
    }

    function start() {
        if (running || reducedMotion.matches) return;
        running = true;
        lastFrame = performance.now();
        requestAnimationFrame(frame);
    }

    // ---- Click: the ice cracks --------------------------------------------

    // A jagged crack from (x, y), with the odd side branch
    function crackPath(x, y, angle, length, depth, out) {
        const points = [[x, y]];
        let travelled = 0;
        while (travelled < length) {
            const step = rand(7, 16);
            angle += rand(-0.35, 0.35);
            x += Math.cos(angle) * step;
            y += Math.sin(angle) * step;
            travelled += step;
            points.push([x, y]);
            if (depth < 1 && Math.random() < 0.12) {
                crackPath(x, y, angle + rand(0.5, 1) * (Math.random() < 0.5 ? 1 : -1), (length - travelled) * rand(0.3, 0.6), depth + 1, out);
            }
        }
        if (points.length > 1) out.push({ points, depth });
        return out;
    }

    function crackAt(x, y) {
        const paths = [];
        const rays = 5 + Math.floor(Math.random() * 4);
        const reach = Math.min(width, height);
        for (let i = 0; i < rays; i++) {
            crackPath(x, y, (i / rays) * Math.PI * 2 + rand(-0.3, 0.3), reach * rand(0.1, 0.24), 0, paths);
        }
        // A broken ring of fractures around the impact
        const ringRadius = rand(18, 30);
        for (let a = rand(0, 1); a < Math.PI * 2; a += rand(0.6, 1.1)) {
            const sweep = rand(0.3, 0.7);
            const points = [];
            for (let t = 0; t <= 1; t += 0.25) {
                const r = ringRadius + rand(-3, 3);
                points.push([x + Math.cos(a + sweep * t) * r, y + Math.sin(a + sweep * t) * r]);
            }
            paths.push({ points, depth: 1 });
        }

        // Knock the frost off the glass around the impact so the crack shows
        lastPoint = null;
        dab(x, y, 2.2);
        dab(x, y, 1.2);
        lastWipe = performance.now();
        start();

        // Grow the cracks outward over a quarter second, drawn into the scene
        const duration = 260;
        const begin = performance.now();
        const drawn = paths.map(() => 1);
        const grow = (now) => {
            const t = Math.min(1, (now - begin) / duration);
            const eased = 1 - Math.pow(1 - t, 3);
            scene.strokeStyle = colors.crack;
            scene.lineCap = 'round';
            scene.lineJoin = 'round';
            paths.forEach((path, i) => {
                const target = Math.min(path.points.length - 1, Math.max(1, Math.round(eased * (path.points.length - 1))));
                if (target <= drawn[i] - 1 && t < 1) return;
                const from = drawn[i] - 1;
                const segment = new Path2D();
                segment.moveTo(path.points[from][0], path.points[from][1]);
                for (let k = from + 1; k <= target; k++) segment.lineTo(path.points[k][0], path.points[k][1]);
                scene.globalAlpha = path.depth ? 0.18 : 0.28;
                scene.lineWidth = path.depth ? 2.5 : 4;
                scene.stroke(segment);
                scene.globalAlpha = path.depth ? 0.7 : 0.95;
                scene.lineWidth = path.depth ? 0.8 : 1.3;
                scene.stroke(segment);
                drawn[i] = target + 1;
            });
            scene.globalAlpha = 1;
            if (t < 1) requestAnimationFrame(grow);
        };
        requestAnimationFrame(grow);

        // Shock ring on the glass
        const ring = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        ring.setAttribute('class', 'impact');
        ring.setAttribute('viewBox', '0 0 20 20');
        ring.setAttribute('aria-hidden', 'true');
        ring.innerHTML = '<circle cx="10" cy="10" r="9" />';
        ring.style.left = `${x}px`;
        ring.style.top = `${y}px`;
        ring.addEventListener('animationend', () => ring.remove());
        document.body.appendChild(ring);
    }

    // ---- Setup --------------------------------------------------------------

    function build(withIntro) {
        readColors();
        size();
        renderScene();
        buildFrost();
        const intro = withIntro && !reducedMotion.matches;
        resetClearMap(intro);
        introLeft = intro ? INTRO_SECONDS : 0;
        compose(true);
        if (intro) start();
    }

    build(true);

    window.addEventListener('pointermove', (event) => {
        if (reducedMotion.matches) return;
        wipe(event.clientX, event.clientY);
    }, { passive: true });
    window.addEventListener('pointerdown', (event) => {
        if (reducedMotion.matches) return;
        lastPoint = null;
        wipe(event.clientX, event.clientY);
    }, { passive: true });
    window.addEventListener('click', (event) => {
        if (reducedMotion.matches || event.target.closest('a, button, .slab, .topbar, .footer')) return;
        crackAt(event.clientX, event.clientY);
    });
    document.addEventListener('pointerleave', () => { lastPoint = null; });
    window.addEventListener('blur', () => { lastPoint = null; });

    let resizeTimer;
    let lastWidth = window.innerWidth;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            // Mobile browsers resize on scroll as the toolbar hides; only rebuild on real changes
            if (window.innerWidth === lastWidth && Math.abs(window.innerHeight - height) < 120) return;
            lastWidth = window.innerWidth;
            build(false);
        }, 200);
    });
    darkScheme.addEventListener('change', () => build(false));
})();
