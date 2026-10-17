// Local time in Bucharest, refreshed every 30s
const clock = document.getElementById('clock');
if (clock) {
    const format = new Intl.DateTimeFormat('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Europe/Bucharest'
    });
    const tick = () => {
        const now = new Date();
        clock.textContent = format.format(now);
        clock.dateTime = now.toISOString();
    };
    tick();
    setInterval(tick, 30000);
}

// Current temperature in Bucharest (Open-Meteo, no key). Stays hidden if the request fails.
const temp = document.getElementById('temp');
if (temp && 'fetch' in window) {
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 6000);
    fetch('https://api.open-meteo.com/v1/forecast?latitude=44.43&longitude=26.10&current=temperature_2m', { signal: ctrl.signal })
        .then((res) => (res.ok ? res.json() : Promise.reject(new Error(res.status))))
        .then((data) => {
            const value = data && data.current && data.current.temperature_2m;
            if (typeof value !== 'number') return;
            const text = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 1 }).format(value).replace('-', '−');
            temp.textContent = `${text} °C`;
            temp.hidden = false;
        })
        .catch(() => {})
        .finally(() => clearTimeout(timeout));
}

// Copy the Discord username, with a non-HTTPS fallback
function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    return new Promise((resolve, reject) => {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        try {
            document.execCommand('copy') ? resolve() : reject(new Error('copy failed'));
        } catch (err) {
            reject(err);
        } finally {
            ta.remove();
        }
    });
}

document.querySelectorAll('[data-copy]').forEach((btn) => {
    const hint = document.getElementById(btn.getAttribute('aria-describedby'));
    const idle = hint ? hint.textContent : '';
    let timer;

    btn.addEventListener('click', () => {
        copyText(btn.dataset.copy).then(() => {
            clearTimeout(timer);
            btn.classList.add('is-copied');
            if (hint) hint.textContent = 'Copied. Paste it into Discord to add me.';
            timer = setTimeout(() => {
                btn.classList.remove('is-copied');
                if (hint) hint.textContent = idle;
            }, 1800);
        }).catch(() => {
            if (hint) hint.textContent = 'Copy failed. The username is padrewin.';
        });
    });
});

// Draw each core segment: annual layers, trapped air bubbles and the red/black orientation lines.
// Seeded per segment so the ice looks the same on every visit.
const SVG = 'http://www.w3.org/2000/svg';

function rng(seed) {
    return () => {
        seed = (seed + 0x6d2b79f5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function el(name, attrs) {
    const node = document.createElementNS(SVG, name);
    for (const key in attrs) node.setAttribute(key, attrs[key]);
    return node;
}

function drawIce(ice, index) {
    const w = Math.round(ice.clientWidth);
    const h = Math.round(ice.clientHeight);
    if (!w || !h) return;
    const rand = rng(index * 7919 + 17);
    // on narrow screens the core stands up, so layers run across its width
    const upright = window.matchMedia('(max-width: 720px)').matches;
    const svg = el('svg', { viewBox: `0 0 ${w} ${h}`, preserveAspectRatio: 'none', 'aria-hidden': 'true' });

    // annual layers: soft bands of slightly cloudier ice
    const along = upright ? h : w;
    const across = upright ? w : h;
    let pos = rand() * 30;
    while (pos < along) {
        const band = 2 + rand() * 9;
        const wobble = (rand() - 0.5) * 6;
        const d = upright
            ? `M0 ${pos} Q ${across / 2} ${pos + wobble} ${across} ${pos}`
            : `M${pos} 0 Q ${pos + wobble} ${across / 2} ${pos} ${across}`;
        svg.appendChild(el('path', {
            d,
            fill: 'none',
            stroke: rand() > 0.7 ? '#8fb3c4' : '#f4fafc',
            'stroke-width': band,
            opacity: (0.18 + rand() * 0.32).toFixed(2)
        }));
        pos += band + 6 + rand() * 34;
    }

    // air bubbles trapped in the firn
    const count = Math.round((w * h) / 520);
    for (let i = 0; i < count; i++) {
        const r = 0.5 + Math.pow(rand(), 2.4) * 2.6;
        const cx = rand() * w;
        const cy = rand() * h;
        svg.appendChild(el('ellipse', {
            cx: cx.toFixed(1),
            cy: cy.toFixed(1),
            rx: (upright ? r : r * (1 + rand() * 0.6)).toFixed(2),
            ry: (upright ? r * (1 + rand() * 0.6) : r).toFixed(2),
            fill: '#ffffff',
            opacity: (0.35 + rand() * 0.5).toFixed(2)
        }));
        if (r > 1.6) {
            svg.appendChild(el('circle', {
                cx: (cx + r * 0.3).toFixed(1),
                cy: (cy + r * 0.3).toFixed(1),
                r: (r * 0.45).toFixed(2),
                fill: '#5f8aa0',
                opacity: '0.35'
            }));
        }
    }

    // orientation lines, hand-drawn along the top of the core
    const line = (offset, color) => {
        let d = upright ? `M${offset} 0` : `M0 ${offset}`;
        for (let t = 24; t <= along + 24; t += 24) {
            const jitter = (rand() - 0.5) * 1.4;
            d += upright ? ` L${(offset + jitter).toFixed(1)} ${t}` : ` L${t} ${(offset + jitter).toFixed(1)}`;
        }
        svg.appendChild(el('path', { d, fill: 'none', stroke: color, 'stroke-width': '2.2', 'stroke-linecap': 'round', opacity: '0.8' }));
    };
    line(upright ? across - 14 : 12, '#c8283a');
    line(upright ? across - 20 : 18, '#14233a');

    ice.replaceChildren(svg);
}

const ices = [...document.querySelectorAll('.seg__ice')];
const drawAll = () => ices.forEach(drawIce);
if (ices.length) {
    drawAll();
    let frame;
    let lastWidth = window.innerWidth;
    window.addEventListener('resize', () => {
        if (window.innerWidth === lastWidth) return;
        lastWidth = window.innerWidth;
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(drawAll);
    });
    if (document.fonts) document.fonts.ready.then(drawAll);
}
