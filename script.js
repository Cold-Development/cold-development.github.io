document.addEventListener('DOMContentLoaded', () => {
    createSnowflakes();

    function createSnowflakes() {
        const snowflakeCount = 50;
        const container = document.body;
        
        for (let i = 0; i < snowflakeCount; i++) {
            const snowflake = document.createElement('div');
            snowflake.classList.add('snowflake');
            snowflake.innerHTML = '❄';

            // Randomizare poziție și dimensiune
            snowflake.style.left = `${Math.random() * 100}vw`;
            snowflake.style.fontSize = `${Math.random() * 15 + 10}px`;

            // Adăugare întârziere și durată aleatorie pentru fiecare fulg
            snowflake.style.animationDuration = `${Math.random() * 6 + 2}s`; // Durată între 2 și 5 secunde
            snowflake.style.animationDelay = `${Math.random() * 5}s`; // Întârziere între 0 și 5 secunde

            container.appendChild(snowflake);
        }
    }
});

document.addEventListener('mousemove', function(e) {
    const cursor = document.querySelector('.custom-cursor');
    cursor.style.left = `${e.pageX}px`;
    cursor.style.top = `${e.pageY}px`;
});
const canvas = document.getElementById('background-canvas');
const ctx = canvas.getContext('2d');

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

let particlesArray = [];
const colors = ['#AED2FF', '#9400FF', '#E4F1FF', '#27005D'];

/* Funcția pentru generarea particulelor */
function createParticles() {
    for (let i = 0; i < 100; i++) {
        let size = Math.random() * 5 + 1;
        let x = Math.random() * canvas.width;
        let y = Math.random() * canvas.height;
        let directionX = (Math.random() * 0.4) - 0.2;
        let directionY = (Math.random() * 0.4) - 0.2;
        let color = colors[Math.floor(Math.random() * colors.length)];
        
        particlesArray.push({ x, y, directionX, directionY, size, color });
    }
}

/* Actualizarea particulelor */
function updateParticles() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < particlesArray.length; i++) {
        let p = particlesArray[i];
        
        p.x += p.directionX;
        p.y += p.directionY;
        
        if (p.x > canvas.width || p.x < 0) p.directionX = -p.directionX;
        if (p.y > canvas.height || p.y < 0) p.directionY = -p.directionY;
        
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.fill();
    }
}

function animateParticles() {
    updateParticles();
    requestAnimationFrame(animateParticles);
}

createParticles();
animateParticles();
