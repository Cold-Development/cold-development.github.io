// Pointer effects on the content:
// - the headline's letters melt as the cursor passes near them and refreeze
//   when it leaves (Climate Crisis YEAR axis: 1979 solid, 2050 melted);
// - the ice slab tilts toward the cursor and a glint follows it over the
//   glass and along the edge (fine pointers only).
(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const SOLID = 1979;
    const MELTED = 2050;
    const pointer = { x: -9999, y: -9999, active: false };

    // ---- Melting headline ----------------------------------------------------

    const headline = document.querySelector('.headline');
    const letters = [];

    if (headline) {
        // Name the heading once, then split its words into letters
        headline.setAttribute('aria-label', 'it’s freezing cold');
        const walker = document.createTreeWalker(headline, NodeFilter.SHOW_TEXT, {
            acceptNode: (node) => (node.parentElement.closest('.zz') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT)
        });
        const textNodes = [];
        while (walker.nextNode()) textNodes.push(walker.currentNode);
        for (const node of textNodes) {
            const fragment = document.createDocumentFragment();
            for (const char of node.textContent) {
                if (/\s/.test(char)) {
                    fragment.appendChild(document.createTextNode(char));
                    continue;
                }
                const span = document.createElement('span');
                span.className = 'ch';
                span.setAttribute('aria-hidden', 'true');
                span.textContent = char;
                fragment.appendChild(span);
                letters.push({ el: span, year: SOLID });
            }
            node.replaceWith(fragment);
        }
    }

    let meltReady = false;
    // Only take over the letters once the load "freeze" has finished
    if (headline) {
        const ready = () => { meltReady = true; };
        headline.addEventListener('animationend', ready, { once: true });
        setTimeout(ready, 2600);
    }

    function meltStep() {
        if (!meltReady || !letters.length) return false;
        const radius = parseFloat(getComputedStyle(headline).fontSize) * 1.3;
        // Read every position first, then write, so layout runs once a frame
        const rects = letters.map((l) => l.el.getBoundingClientRect());
        let moving = false;
        letters.forEach((letter, i) => {
            const r = rects[i];
            const d = Math.hypot(pointer.x - (r.left + r.width / 2), pointer.y - (r.top + r.height / 2));
            const t = pointer.active ? Math.max(0, 1 - d / radius) : 0;
            const target = SOLID + (MELTED - SOLID) * t * t * (3 - 2 * t);
            // Melts quickly, refreezes slowly
            letter.year += (target - letter.year) * (target > letter.year ? 0.22 : 0.045);
            if (Math.abs(target - letter.year) < 0.4) letter.year = target;
            if (letter.year > SOLID + 0.4) {
                letter.el.style.fontVariationSettings = `'YEAR' ${letter.year.toFixed(1)}`;
                moving = true;
            } else if (letter.el.style.fontVariationSettings) {
                letter.year = SOLID;
                letter.el.style.fontVariationSettings = '';
            }
            if (target !== letter.year) moving = true;
        });
        return moving;
    }

    // ---- Tilting ice slab ----------------------------------------------------

    const slab = document.querySelector('.slab');
    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
    const tilt = { rx: 0, ry: 0, mx: 30, my: 0 };

    function tiltStep() {
        if (!slab || !finePointer.matches) return false;
        const r = slab.getBoundingClientRect();
        let target = { rx: 0, ry: 0, mx: 30, my: 0 };
        if (pointer.active) {
            const nx = Math.max(-1, Math.min(1, (pointer.x - (r.left + r.width / 2)) / (window.innerWidth / 2)));
            const ny = Math.max(-1, Math.min(1, (pointer.y - (r.top + r.height / 2)) / (window.innerHeight / 2)));
            target = {
                rx: -ny * 5,
                ry: nx * 7,
                mx: ((pointer.x - r.left) / r.width) * 100,
                my: ((pointer.y - r.top) / r.height) * 100
            };
        }
        let moving = false;
        for (const key of ['rx', 'ry', 'mx', 'my']) {
            tilt[key] += (target[key] - tilt[key]) * 0.12;
            if (Math.abs(target[key] - tilt[key]) > 0.02) moving = true;
            else tilt[key] = target[key];
        }
        slab.style.transform = tilt.rx || tilt.ry ? `perspective(1100px) rotateX(${tilt.rx.toFixed(2)}deg) rotateY(${tilt.ry.toFixed(2)}deg)` : '';
        slab.style.setProperty('--mx', `${tilt.mx.toFixed(1)}%`);
        slab.style.setProperty('--my', `${tilt.my.toFixed(1)}%`);
        return moving;
    }

    // ---- One loop for both, only while something is moving ---------------

    let running = false;
    function frame() {
        const melting = meltStep();
        const tilting = tiltStep();
        if (melting || tilting) requestAnimationFrame(frame);
        else running = false;
    }
    function kick() {
        if (running) return;
        running = true;
        requestAnimationFrame(frame);
    }

    window.addEventListener('pointermove', (event) => {
        pointer.x = event.clientX;
        pointer.y = event.clientY;
        pointer.active = true;
        kick();
    }, { passive: true });
    window.addEventListener('pointerdown', (event) => {
        pointer.x = event.clientX;
        pointer.y = event.clientY;
        pointer.active = true;
        kick();
    }, { passive: true });
    const release = () => {
        pointer.active = false;
        kick();
    };
    document.documentElement.addEventListener('pointerleave', release);
    window.addEventListener('blur', release);
    // Touch has no hover: let the letters refreeze once the finger lifts
    window.addEventListener('pointerup', (event) => {
        if (event.pointerType !== 'mouse') release();
    });
})();
