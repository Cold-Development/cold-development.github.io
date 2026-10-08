// The frozen window behind the page: frosted glass over cracked lake ice.
// Drawn once per size and colour scheme. It does not react to the pointer;
// the only motion is the CSS fade-in on load.
(() => {
    const canvas = document.querySelector('.ice');
    if (!canvas || !canvas.getContext) return;

    const ctx = canvas.getContext('2d');
    const darkScheme = window.matchMedia('(prefers-color-scheme: dark)');

    let width = 0;
    let height = 0;
    let dpr = 1;
    let colors = {};
    // The lake ice is drawn offscreen; only its frosted (blurred) copy is shown
    const sceneCanvas = document.createElement('canvas');
    const sctx = sceneCanvas.getContext('2d');

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
        for (const c of [canvas, sceneCanvas]) {
            c.width = Math.round(width * dpr);
            c.height = Math.round(height * dpr);
        }
    }

    // ---- The lake ice ---------------------------------------------------------

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
            sctx.globalAlpha = alpha * colors.crackRGBA[3];
            sctx.lineWidth = lineWidth;
            sctx.stroke(path);
        }
        sctx.globalAlpha = 1;
    }

    const mix = (a, b, t) => `rgb(${Math.round(a[0] + (b[0] - a[0]) * t)}, ${Math.round(a[1] + (b[1] - a[1]) * t)}, ${Math.round(a[2] + (b[2] - a[2]) * t)})`;

    // Drawn as vectors at full device resolution, so the ice stays sharp
    // wherever the frost is wiped away.
    function renderScene() {
        const { deep, mid, crackRGBA } = colors;
        const area = width * height;
        sctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        sctx.fillStyle = mix(deep, mid, 0.2);
        sctx.fillRect(0, 0, width, height);

        // Slabs of ice, each with its own clarity, darker toward its middle
        const slabs = voronoiCells(Array.from({ length: Math.max(24, Math.round(area / 19800)) }, () => ({
            x: Math.random() * width, y: Math.random() * height, shade: Math.random()
        })));
        for (const { site, poly } of slabs) {
            if (poly.length < 3) continue;
            let reach = 0;
            for (const [px, py] of poly) reach = Math.max(reach, Math.hypot(px - site.x, py - site.y));
            const t = Math.min(1, Math.max(0, 0.3 + site.shade * 0.55 + (1 - site.y / height) * 0.15));
            const gradient = sctx.createRadialGradient(site.x, site.y, 0, site.x, site.y, reach);
            gradient.addColorStop(0, mix(deep, mid, Math.max(0, t - 0.28)));
            gradient.addColorStop(0.7, mix(deep, mid, t - 0.05));
            gradient.addColorStop(1, mix(deep, mid, t));
            sctx.fillStyle = gradient;
            sctx.beginPath();
            sctx.moveTo(poly[0][0], poly[0][1]);
            for (let k = 1; k < poly.length; k++) sctx.lineTo(poly[k][0], poly[k][1]);
            sctx.closePath();
            sctx.fill();
            // Seal the antialiased seam against the neighbouring slab
            sctx.strokeStyle = gradient;
            sctx.lineWidth = 1.5;
            sctx.stroke();
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
        sctx.save();
        sctx.setTransform(1, 0, 0, 1, 0, 0);
        sctx.fillStyle = sctx.createPattern(grain, 'repeat');
        sctx.fillRect(0, 0, sceneCanvas.width, sceneCanvas.height);
        sctx.restore();

        sctx.strokeStyle = colors.crack;
        sctx.lineCap = 'round';
        sctx.lineJoin = 'round';

        // A net of hairline fractures from a second, finer field
        const hairlines = crackEdges(voronoiCells(Array.from({ length: Math.max(60, Math.round(area / 3420)) }, () => ({
            x: Math.random() * width, y: Math.random() * height
        }))), 0.05);
        strokeEdges(hairlines, [[0.6, 0.3]]);

        // The main cracks between slabs: wide soft glow, then a bright core
        strokeEdges(crackEdges(slabs, 0.035), [[14, 0.05], [6, 0.12], [2.4, 0.4], [1.1, 1]]);

        // Air bubbles trapped in the ice
        sctx.strokeStyle = colors.crack;
        sctx.lineWidth = 0.8;
        for (let i = 0; i < Math.round(area / 26000); i++) {
            const r = rand(0.8, 3.6);
            const x = rand(0, width);
            const y = rand(0, height);
            sctx.globalAlpha = rand(0.25, 0.6) * crackRGBA[3];
            sctx.beginPath();
            sctx.arc(x, y, r, 0, Math.PI * 2);
            sctx.stroke();
            sctx.globalAlpha *= 0.6;
            sctx.beginPath();
            sctx.arc(x - r * 0.3, y - r * 0.3, r * 0.3, 0, Math.PI * 2);
            sctx.stroke();
        }
        sctx.globalAlpha = 1;
    }

    // ---- The frost on the glass -----------------------------------------------

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
            ctx.globalAlpha = [0.5, 0.38, 0.26][gen];
            ctx.lineWidth = widths[gen];
            ctx.stroke(path);
        });
        ctx.globalAlpha = 1;
    }

    function drawFrost() {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        // Frosted glass diffuses what is behind it: the ice, heavily blurred
        // by scaling it down and back up (works without ctx.filter)
        const blur = document.createElement('canvas');
        blur.width = Math.max(1, Math.round(width / 36));
        blur.height = Math.max(1, Math.round(height / 36));
        const blurCtx = blur.getContext('2d');
        blurCtx.imageSmoothingQuality = 'high';
        blurCtx.drawImage(sceneCanvas, 0, 0, blur.width, blur.height);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(blur, 0, 0, width, height);

        // An even veil of frost, a little thicker toward the frame
        ctx.fillStyle = colors.tint;
        ctx.fillRect(0, 0, width, height);
        const edge = ctx.createRadialGradient(width / 2, height / 2, Math.min(width, height) * 0.35, width / 2, height / 2, Math.hypot(width, height) / 2);
        edge.addColorStop(0, 'rgba(0, 0, 0, 0)');
        edge.addColorStop(1, colors.tint);
        ctx.fillStyle = edge;
        ctx.fillRect(0, 0, width, height);

        // Fine frosted grain
        const grain = document.createElement('canvas');
        grain.width = grain.height = 160;
        const g = grain.getContext('2d');
        const noise = g.createImageData(160, 160);
        const [cr, cg, cb] = toRGBA(colors.crystal);
        for (let i = 0; i < noise.data.length; i += 4) {
            noise.data[i] = cr;
            noise.data[i + 1] = cg;
            noise.data[i + 2] = cb;
            noise.data[i + 3] = Math.random() < 0.5 ? Math.random() * (colors.dark ? 30 : 55) : 0;
        }
        g.putImageData(noise, 0, 0);
        ctx.fillStyle = ctx.createPattern(grain, 'repeat');
        ctx.fillRect(0, 0, width, height);

        // A few fine crystals, only where frost would start: the corners
        const reach = Math.min(width, height);
        const seeds = [];
        for (const [x, y] of [[0, 0], [width, 0], [0, height], [width, height]]) {
            const toCenter = Math.atan2(height / 2 - y, width / 2 - x);
            for (let k = 0; k < 2; k++) seeds.push([x, y, toCenter + rand(-0.45, 0.45), reach * rand(0.16, 0.28)]);
        }
        growCrystals(ctx, seeds);
    }

    function draw() {
        readColors();
        size();
        renderScene();
        drawFrost();
    }

    draw();

    let resizeTimer;
    let lastWidth = window.innerWidth;
    let lastHeight = window.innerHeight;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            // Mobile browsers resize on scroll as the toolbar hides; only redraw on real changes
            if (window.innerWidth === lastWidth && Math.abs(window.innerHeight - lastHeight) < 120) return;
            lastWidth = window.innerWidth;
            lastHeight = window.innerHeight;
            draw();
        }, 200);
    });
    darkScheme.addEventListener('change', draw);
})();
