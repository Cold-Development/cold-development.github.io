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

// Copy-to-clipboard buttons (Discord username), with a non-HTTPS fallback
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
    const label = btn.querySelector('.copy-label');
    const idle = label ? label.textContent : '';
    let timer;

    btn.addEventListener('click', () => {
        copyText(btn.dataset.copy).then(() => {
            clearTimeout(timer);
            btn.classList.add('is-copied');
            if (label) label.textContent = 'copied, paste it in Discord';
            timer = setTimeout(() => {
                btn.classList.remove('is-copied');
                if (label) label.textContent = idle;
            }, 1800);
        }).catch(() => {
            if (label) label.textContent = `copy failed, it's ${btn.dataset.copy}`;
        });
    });
});

// Snowflake: one arm grown from a seed, mirrored, then repeated six times
const SVG = 'http://www.w3.org/2000/svg';

function rng(seed) {
    return () => {
        seed = (seed + 0x6d2b79f5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function growArm(rand) {
    const R = 150 + rand() * 25;
    const SIN = Math.sin(Math.PI / 3);
    const COS = Math.cos(Math.PI / 3);
    // segments as [x1, y1, x2, y2, width]; the arm points up (negative y)
    const segs = [[0, -14, 0, -R, 3.2]];
    const count = 3 + Math.floor(rand() * 3);
    for (let i = 0; i < count; i++) {
        const at = R * (0.28 + (0.6 * (i + rand() * 0.6)) / count);
        const len = (R - at) * (0.35 + rand() * 0.45) + 8;
        const x = len * SIN;
        const y = -at - len * COS;
        segs.push([0, -at, -x, y, 2.2], [0, -at, x, y, 2.2]);
        // small barbs along the side branch, pointing outward
        const barbs = len > 40 ? 1 + Math.floor(rand() * 2) : 0;
        for (let b = 1; b <= barbs; b++) {
            const f = b / (barbs + 1);
            const bx = x * f;
            const by = -at - len * COS * f;
            const bl = len * (0.18 + rand() * 0.2);
            segs.push([-bx, by, -bx, by - bl, 1.5], [bx, by, bx, by - bl, 1.5]);
        }
    }
    // a little crown at the tip
    const tip = 8 + rand() * 10;
    segs.push([0, -R + tip, -tip * SIN, -R + tip - tip * COS - tip * 0.2, 1.6], [0, -R + tip, tip * SIN, -R + tip - tip * COS - tip * 0.2, 1.6]);
    return segs;
}

function buildFlake(group, seed) {
    const rand = rng(seed);
    const arm = growArm(rand);
    const g = document.createElementNS(SVG, 'g');
    const hex = 14 + rand() * 10;

    const add = (d, width, delay) => {
        const p = document.createElementNS(SVG, 'path');
        p.setAttribute('d', d);
        p.setAttribute('pathLength', '1');
        p.setAttribute('stroke-width', width);
        p.style.setProperty('--d', Math.round(delay));
        g.appendChild(p);
    };

    // the central plate
    let plate = '';
    for (let k = 0; k < 6; k++) {
        const a = (Math.PI / 3) * k - Math.PI / 2;
        plate += `${k ? 'L' : 'M'}${(Math.cos(a) * hex).toFixed(1)} ${(Math.sin(a) * hex).toFixed(1)}`;
    }
    add(plate + 'Z', 2, 0);

    for (let k = 0; k < 6; k++) {
        const a = (Math.PI / 3) * k;
        const cos = Math.cos(a);
        const sin = Math.sin(a);
        const rot = (x, y) => `${(x * cos - y * sin).toFixed(1)} ${(x * sin + y * cos).toFixed(1)}`;
        arm.forEach(([x1, y1, x2, y2, w]) => {
            add(`M${rot(x1, y1)}L${rot(x2, y2)}`, w, 80 + Math.abs(y1) * 4.2);
        });
    }
    group.appendChild(g);
    return g;
}

const art = document.querySelector('.flake__art');
const stage = document.querySelector('.flake__stage');
if (art && stage) {
    let current = buildFlake(art, (Math.random() * 2 ** 31) | 0);
    stage.addEventListener('click', () => {
        const old = current;
        old.classList.add('is-old');
        setTimeout(() => old.remove(), 240);
        current = buildFlake(art, (Math.random() * 2 ** 31) | 0);
    });
}

// Recently updated repositories, straight from GitHub
const LANG_COLORS = {
    Java: '#b07219',
    Kotlin: '#a97bff',
    JavaScript: '#f1e05a',
    TypeScript: '#3178c6',
    HTML: '#e34c26',
    CSS: '#663399',
    Python: '#3572a5',
    Shell: '#89e051'
};

function ago(date) {
    const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
    const days = Math.round((date - Date.now()) / 86400000);
    if (Math.abs(days) < 1) return 'today';
    if (Math.abs(days) < 30) return rtf.format(days, 'day');
    if (Math.abs(days) < 365) return rtf.format(Math.round(days / 30), 'month');
    return rtf.format(Math.round(days / 365), 'year');
}

function node(tag, className, text) {
    const n = document.createElement(tag);
    if (className) n.className = className;
    if (text) n.textContent = text;
    return n;
}

function renderRepo(repo) {
    const li = node('li', 'repo');
    const a = node('a');
    a.href = repo.html_url;
    a.appendChild(node('span', 'repo__name', repo.name));
    a.appendChild(node('span', 'repo__desc', repo.description || 'No description yet.'));

    const facts = node('span', 'repo__facts');
    if (repo.language) {
        const lang = node('span', 'repo__lang', repo.language);
        lang.style.setProperty('--lang', LANG_COLORS[repo.language] || '#93a7bf');
        facts.appendChild(lang);
    }
    if (repo.stargazers_count) {
        const stars = node('span', 'repo__stars');
        stars.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3l-5.6 2.9 1.1-6.2L3 9.6l6.2-.9z"/></svg>';
        stars.appendChild(document.createTextNode(String(repo.stargazers_count)));
        stars.setAttribute('aria-label', `${repo.stargazers_count} stars`);
        facts.appendChild(stars);
    }
    facts.appendChild(node('span', null, `updated ${ago(new Date(repo.pushed_at))}`));
    a.appendChild(facts);
    li.appendChild(a);
    return li;
}

const repos = document.querySelector('.repos');
if (repos) {
    const org = repos.dataset.org;
    const fail = () => {
        const li = node('li', 'repos__note', 'GitHub didn’t answer just now. ');
        const link = node('a', 'text-link', 'Browse the repositories on GitHub');
        link.href = `https://github.com/orgs/${org}/repositories`;
        li.appendChild(link);
        repos.replaceChildren(li);
        repos.setAttribute('aria-busy', 'false');
    };
    // GitHub allows 60 anonymous requests an hour, so keep the answer for this visit
    const KEY = `repos:${org}`;
    const load = (tries) => fetch(`https://api.github.com/orgs/${org}/repos?per_page=100&sort=pushed`)
        .then((res) => (res.ok ? res.json() : Promise.reject(new Error(res.status))))
        .catch((err) => (tries > 0 ? new Promise((r) => setTimeout(r, 800)).then(() => load(tries - 1)) : Promise.reject(err)));
    let cached = null;
    try {
        cached = JSON.parse(sessionStorage.getItem(KEY));
    } catch (err) {}
    (cached ? Promise.resolve(cached) : load(1).then((list) => {
        try {
            sessionStorage.setItem(KEY, JSON.stringify(list));
        } catch (err) {}
        return list;
    }))
        .then((list) => {
            const picked = list
                .filter((r) => !r.fork && !r.archived && !r.private && r.name !== `${org.toLowerCase()}.github.io`)
                .sort((x, y) => new Date(y.pushed_at) - new Date(x.pushed_at))
                .slice(0, 6);
            if (!picked.length) return fail();
            repos.replaceChildren(...picked.map(renderRepo));
            repos.setAttribute('aria-busy', 'false');
        })
        .catch(fail);
}
