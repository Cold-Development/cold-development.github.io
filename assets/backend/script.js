console.log(
    "%c ❄ %c it's free💤ing cold..",
    "background-color: #3b6fe0; color: white; border-radius: 8px;",
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
