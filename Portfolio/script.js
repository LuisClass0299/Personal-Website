const btn = document.querySelector('.hamburger');
const navLinks = document.querySelector('.nav-links');

btn.addEventListener('click', () => {
    btn.classList.toggle('open');
})