console.log(
    "%c ❄ %c it's free💤ing cold..",
    "background-color: #635aa7; color: white; border-radius: 8px;",
    "font-style: italic; color: white"
);

document.addEventListener('touchmove', (e) => {
    if (e.target.closest('.scrollable')) {
        return; // Permite scroll pe elementele cu clasa `scrollable`
    }
    e.preventDefault(); // Blochează scroll în alte părți
});