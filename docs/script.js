const hamburger = document.querySelector('.hamburger');
const mobileMenu = document.querySelector('.mobile-menu');
const closeBtn = document.querySelector('.close-btn');

hamburger.addEventListener('click', () =>{
    mobileMenu.classList.add('open');
})

closeBtn.addEventListener('click', () =>{
    mobileMenu.classList.remove('open');
})