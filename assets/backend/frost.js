// Window frost: fern-like ice crystals grow in from the screen edges,
// hold for a moment, then melt from the middle outward. Repeats forever.
(() => {
    const canvas = document.querySelector('.frost-canvas');
    const fog = document.querySelector('.frost-fog');
    if (!canvas || !canvas.getContext) return;

    const ctx = canvas.getContext('2d');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const darkScheme = window.matchMedia('(prefers-color-scheme: dark)');

    const FREEZE_MAX = 11;  // seconds before growth is cut off
    const FOG_RAMP = 7;     // seconds for the edge haze to reach full strength
    const HOLD = 4;
    const THAW = 5.5;
    const REST = 1.5;
    const MAX_GEN = 2;
    const SIXTY_DEG = Math.PI / 3;
    const GEN_WIDTH = [1.3, 0.8, 0.5];
    const GEN_ALPHA = [1, 0.8, 0.6];

    let width = 0;
    let height = 0;
    let branches = [];
    let lineColor = '';
    let phase = 'freeze';
    let phaseTime = 0;
    let lastTime = 0;

    const rand = (min, max) => min + Math.random() * (max - min);

    function readColors() {
        lineColor = getComputedStyle(document.documentElement).getPropertyValue('--frost-line').trim();
    }

    function resize() {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        width = window.innerWidth;
        height = window.innerHeight;
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.lineCap = 'round';
    }

    function makeBranch(x, y, angle, length, gen) {
        return {
            x, y, angle, gen,
            left: length,
            speed: [70, 55, 40][gen] * rand(0.8, 1.2),
            untilSpawn: rand(6, 14),
            side: Math.random() < 0.5 ? 1 : -1
        };
    }

    // Seed crystals along the edges, pointing inward, with larger ones in the corners
    function seed() {
        branches = [];
        const reach = Math.min(width, height);
        const cx = width / 2;
        const cy = height / 2;
        const perimeter = 2 * (width + height);
        const count = Math.round(perimeter / 110);

        for (let i = 0; i < count; i++) {
            let d = Math.random() * perimeter;
            let x, y, inward;
            if (d < width) { x = d; y = 0; inward = Math.PI / 2; }
            else if ((d -= width) < height) { x = width; y = d; inward = Math.PI; }
            else if ((d -= height) < width) { x = width - d; y = height; inward = -Math.PI / 2; }
            else { d -= width; x = 0; y = height - d; inward = 0; }
            branches.push(makeBranch(x, y, inward + rand(-0.7, 0.7), reach * rand(0.08, 0.24), 0));
        }

        for (const [x, y] of [[0, 0], [width, 0], [0, height], [width, height]]) {
            const toCenter = Math.atan2(cy - y, cx - x);
            for (let k = 0; k < 2; k++) {
                branches.push(makeBranch(x, y, toCenter + rand(-0.5, 0.5), reach * rand(0.22, 0.36), 0));
            }
        }
    }

    function grow(dt) {
        // One path per generation, stroked once per frame
        const paths = [new Path2D(), new Path2D(), new Path2D()];
        const spawned = [];

        for (const b of branches) {
            let travel = Math.min(b.speed * dt, b.left);
            const path = paths[b.gen];
            path.moveTo(b.x, b.y);
            while (travel > 0) {
                const step = Math.min(travel, 3);
                travel -= step;
                b.left -= step;
                b.untilSpawn -= step;
                if (b.gen === 0) b.angle += rand(-0.05, 0.05);

                b.x += Math.cos(b.angle) * step;
                b.y += Math.sin(b.angle) * step;
                path.lineTo(b.x, b.y);

                // Ice branches at roughly 60 degrees, alternating sides like a fern
                if (b.gen < MAX_GEN && b.untilSpawn <= 0 && b.left > 6) {
                    const childLength = b.left * rand(0.3, 0.55);
                    const sides = Math.random() < 0.2 ? [1, -1] : [b.side];
                    for (const s of sides) {
                        spawned.push(makeBranch(b.x, b.y, b.angle + s * SIXTY_DEG * rand(0.9, 1.1), childLength, b.gen + 1));
                    }
                    b.side = -b.side;
                    b.untilSpawn = rand(10, 18) * (b.gen + 1);
                }
            }
        }

        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = lineColor;
        for (let gen = 0; gen < paths.length; gen++) {
            ctx.globalAlpha = GEN_ALPHA[gen];
            ctx.lineWidth = GEN_WIDTH[gen];
            ctx.stroke(paths[gen]);
        }
        ctx.globalAlpha = 1;

        branches = branches.filter((b) => b.left > 0);
        for (const s of spawned) branches.push(s);
    }

    // Erase from the centre outward so the ice recedes to the edges as it melts
    function melt(t) {
        const cx = width / 2;
        const cy = height / 2;
        const maxR = Math.hypot(cx, cy);
        const inner = Math.max(0, maxR * (t * 1.3 - 0.3));
        const gradient = ctx.createRadialGradient(cx, cy, inner, cx, cy, inner + maxR * 0.3);
        gradient.addColorStop(0, 'rgba(0, 0, 0, 0.14)');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.globalCompositeOperation = 'destination-out';
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);
    }

    function setLook(fogLevel, blur, opacity) {
        if (fog) fog.style.opacity = fogLevel.toFixed(3);
        canvas.style.filter = blur > 0.05 ? `blur(${blur.toFixed(2)}px)` : '';
        canvas.style.opacity = opacity.toFixed(3);
    }

    function startFreeze() {
        ctx.clearRect(0, 0, width, height);
        seed();
        phase = 'freeze';
        phaseTime = 0;
        setLook(0, 0, 1);
    }

    function frame(now) {
        const dt = Math.min((now - lastTime) / 1000 || 0, 0.05);
        lastTime = now;
        phaseTime += dt;

        if (phase === 'freeze') {
            grow(dt);
            setLook(Math.min(1, phaseTime / FOG_RAMP), 0, 1);
            if (!branches.length || phaseTime > FREEZE_MAX) {
                phase = 'hold';
                phaseTime = 0;
            }
        } else if (phase === 'hold') {
            setLook(1, 0, 1);
            if (phaseTime > HOLD) {
                phase = 'thaw';
                phaseTime = 0;
            }
        } else if (phase === 'thaw') {
            const t = Math.min(1, phaseTime / THAW);
            melt(t);
            setLook(1 - t, t * 2.5, 1 - t * t);
            if (t >= 1) {
                ctx.clearRect(0, 0, width, height);
                phase = 'rest';
                phaseTime = 0;
            }
        } else if (phaseTime > REST) {
            startFreeze();
        }

        requestAnimationFrame(frame);
    }

    // Reduced motion: one static, fully grown pane of frost
    function drawStatic() {
        ctx.clearRect(0, 0, width, height);
        seed();
        for (let i = 0; i < 400 && branches.length; i++) grow(0.05);
        setLook(0.7, 0, 1);
    }

    readColors();
    resize();

    if (reducedMotion.matches) {
        drawStatic();
        window.addEventListener('resize', () => { resize(); drawStatic(); });
        darkScheme.addEventListener('change', () => { readColors(); drawStatic(); });
        return;
    }

    let resizeTimer;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => { resize(); startFreeze(); }, 200);
    });
    darkScheme.addEventListener('change', readColors);

    startFreeze();
    requestAnimationFrame((now) => {
        lastTime = now;
        requestAnimationFrame(frame);
    });
})();
