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

    // Exact Voronoi cells as polygons: start each site with the whole
    // (padded) viewport and clip it by the bisector with every other site,
    // nearest first, until no farther site can still cut it.
    function voronoiCells(sites) {
        const pad = 40;
        const frame = [[-pad, -pad], [width + pad, -pad], [width + pad, height + pad], [-pad, height + pad]];
        return sites.map((site) => {
            let poly = frame;
            const others = sites
                .filter((o) => o !== site)
                .map((o) => ({ o, d: Math.hypot(o.x - site.x, o.y - site.y) }))
                .sort((a, b) => a.d - b.d);
            for (const { o, d } of others) {
                let reach = 0;
                for (const [px, py] of poly) reach = Math.max(reach, Math.hypot(px - site.x, py - site.y));
                if (d / 2 > reach) break;
                const mx = (site.x + o.x) / 2;
                const my = (site.y + o.y) / 2;
                const nx = o.x - site.x;
                const ny = o.y - site.y;
                const clipped = [];
                for (let i = 0; i < poly.length; i++) {
                    const a = poly[i];
                    const b = poly[(i + 1) % poly.length];
                    const da = (a[0] - mx) * nx + (a[1] - my) * ny;
                    const db = (b[0] - mx) * nx + (b[1] - my) * ny;
                    if (da <= 0) clipped.push(a);
                    if ((da < 0 && db > 0) || (da > 0 && db < 0)) {
                        const t = da / (da - db);
                        clipped.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
                    }
                }
                poly = clipped;
                if (poly.length < 3) break;
            }
            return { site, poly };
        });
    }

    // Unique cell edges, each once, as slightly wandering crack lines
    function crackEdges(cells, wander) {
        const seen = new Set();
        const key = (p) => `${Math.round(p[0])},${Math.round(p[1])}`;
        const edges = [];
        for (const { poly } of cells) {
            for (let i = 0; i < poly.length; i++) {
                const a = poly[i];
                const b = poly[(i + 1) % poly.length];
                const ka = key(a);
                const kb = key(b);
                const id = ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
                if (ka === kb || seen.has(id)) continue;
                seen.add(id);
                // Midpoint displacement, two levels, so cracks are never ruler-straight
                let points = [a, b];
                for (let level = 0; level < 3; level++) {
                    const next = [points[0]];
                    for (let k = 1; k < points.length; k++) {
                        const p = points[k - 1];
                        const q = points[k];
                        const len = Math.hypot(q[0] - p[0], q[1] - p[1]);
                        const off = rand(-1, 1) * len * wander;
                        const nx = -(q[1] - p[1]) / (len || 1);
                        const ny = (q[0] - p[0]) / (len || 1);
                        next.push([(p[0] + q[0]) / 2 + nx * off, (p[1] + q[1]) / 2 + ny * off], q);
                    }
                    points = next;
                }
                edges.push(points);
            }
        }
        return edges;
    }

    function strokeEdges(edges, passes) {
        const path = new Path2D();
        for (const points of edges) {
            path.moveTo(points[0][0], points[0][1]);
            for (let k = 1; k < points.length; k++) path.lineTo(points[k][0], points[k][1]);
        }
        for (const [lineWidth, alpha] of passes) {
            scene.globalAlpha = alpha * colors.crackRGBA[3];
            scene.lineWidth = lineWidth;
            scene.stroke(path);
        }
        scene.globalAlpha = 1;
    }

    const mix = (a, b, t) => `rgb(${Math.round(a[0] + (b[0] - a[0]) * t)}, ${Math.round(a[1] + (b[1] - a[1]) * t)}, ${Math.round(a[2] + (b[2] - a[2]) * t)})`;

    // Drawn as vectors at full device resolution, so the ice stays sharp
    // wherever the frost is wiped away.
    function renderScene() {
        const { deep, mid, crackRGBA } = colors;
        const area = width * height;
        scene.setTransform(dpr, 0, 0, dpr, 0, 0);
        scene.fillStyle = mix(deep, mid, 0.2);
        scene.fillRect(0, 0, width, height);

        // Slabs of ice, each with its own clarity, darker toward its middle
        const slabs = voronoiCells(Array.from({ length: Math.max(24, Math.round(area / 19800)) }, () => ({
            x: Math.random() * width, y: Math.random() * height, shade: Math.random()
        })));
        for (const { site, poly } of slabs) {
            if (poly.length < 3) continue;
            let reach = 0;
            for (const [px, py] of poly) reach = Math.max(reach, Math.hypot(px - site.x, py - site.y));
            const t = Math.min(1, Math.max(0, 0.3 + site.shade * 0.55 + (1 - site.y / height) * 0.15));
            const gradient = scene.createRadialGradient(site.x, site.y, 0, site.x, site.y, reach);
            gradient.addColorStop(0, mix(deep, mid, Math.max(0, t - 0.28)));
            gradient.addColorStop(0.7, mix(deep, mid, t - 0.05));
            gradient.addColorStop(1, mix(deep, mid, t));
            scene.fillStyle = gradient;
            scene.beginPath();
            scene.moveTo(poly[0][0], poly[0][1]);
            for (let k = 1; k < poly.length; k++) scene.lineTo(poly[k][0], poly[k][1]);
            scene.closePath();
            scene.fill();
            // Seal the antialiased seam against the neighbouring slab
            scene.strokeStyle = gradient;
            scene.lineWidth = 1.5;
            scene.stroke();
        }

        // Fine grain inside the ice
        const grain = document.createElement('canvas');
        grain.width = grain.height = 128;
        const g = grain.getContext('2d');
        const noise = g.createImageData(128, 128);
        for (let i = 0; i < noise.data.length; i += 4) {
            const v = Math.random() < 0.5 ? 255 : 0;
            noise.data[i] = noise.data[i + 1] = noise.data[i + 2] = v;
            noise.data[i + 3] = Math.random() * 14;
        }
        g.putImageData(noise, 0, 0);
        scene.save();
        scene.setTransform(1, 0, 0, 1, 0, 0);
        scene.fillStyle = scene.createPattern(grain, 'repeat');
        scene.fillRect(0, 0, sceneCanvas.width, sceneCanvas.height);
        scene.restore();

        scene.strokeStyle = colors.crack;
        scene.lineCap = 'round';
        scene.lineJoin = 'round';

        // A net of hairline fractures from a second, finer field
        const hairlines = crackEdges(voronoiCells(Array.from({ length: Math.max(60, Math.round(area / 3420)) }, () => ({
            x: Math.random() * width, y: Math.random() * height
        }))), 0.05);
        strokeEdges(hairlines, [[0.6, 0.3]]);

        // The main cracks between slabs: wide soft glow, then a bright core
        strokeEdges(crackEdges(slabs, 0.035), [[14, 0.05], [6, 0.12], [2.4, 0.4], [1.1, 1]]);

        // Air bubbles trapped in the ice
        scene.strokeStyle = colors.crack;
        scene.lineWidth = 0.8;
        for (let i = 0; i < Math.round(area / 26000); i++) {
            const r = rand(0.8, 3.6);
            const x = rand(0, width);
            const y = rand(0, height);
            scene.globalAlpha = rand(0.25, 0.6) * crackRGBA[3];
            scene.beginPath();
            scene.arc(x, y, r, 0, Math.PI * 2);
            scene.stroke();
            scene.globalAlpha *= 0.6;
            scene.beginPath();
            scene.arc(x - r * 0.3, y - r * 0.3, r * 0.3, 0, Math.PI * 2);
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
