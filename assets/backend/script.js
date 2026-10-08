console.log(
    "%c ❄ %c it's free💤ing cold..",
    "background-color: #0a6f9c; color: white; border-radius: 8px;",
    "font-style: italic; color: white"
);

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
    const text = btn.dataset.copy;
    let timer;

    // The .copied class swaps the copy icon for a check (see style.css)
    const setLabel = (value) => {
        if (!label) return;
        label.textContent = value;
        // Restart the flip-in animation on every swap
        label.classList.remove('flip');
        void label.offsetWidth;
        label.classList.add('flip');
    };

    btn.addEventListener('click', () => {
        copyText(text).then(() => {
            clearTimeout(timer);
            btn.classList.add('copied');
            setLabel('copied!');
            timer = setTimeout(() => {
                btn.classList.remove('copied');
                setLabel(text);
            }, 1400);
        }).catch(() => {
            setLabel('copy failed');
        });
    });
});
