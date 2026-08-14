const CATEGORIES = [
  'Transport & véhicules','Bâtiment & réparation','Maison & entretien','Beauté & bien-être',
  'Couture & artisanat','Éducation & cours','Événements & cérémonies','Digital & technologie',
  'Agriculture & artisanat rural','Administratif & services pro'
];

const marquee = document.getElementById('marquee');
const doubled = [...CATEGORIES, ...CATEGORIES];
marquee.innerHTML = doubled.map(c => `<div class="chip">${c}</div>`).join('');

const nav = document.getElementById('nav');
window.addEventListener('scroll', () => {
  nav.classList.toggle('show', window.scrollY > window.innerHeight * 0.6);
}, { passive: true });

const io = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add('in-view');
      io.unobserve(entry.target);
    }
  });
}, { threshold: 0.15 });

document.querySelectorAll('.reveal, .reveal-stagger').forEach((el) => io.observe(el));
