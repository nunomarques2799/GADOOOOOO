// Gestão de Gado — interações da landing page

// Ano no rodapé
document.getElementById('year').textContent = new Date().getFullYear();

// Sombra da nav ao rolar
const nav = document.getElementById('nav');
const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 8);
onScroll();
window.addEventListener('scroll', onScroll, { passive: true });

// Menu mobile
const toggle = document.getElementById('navToggle');
toggle?.addEventListener('click', () => nav.classList.toggle('open'));
document.getElementById('navLinks')?.addEventListener('click', (e) => {
  if (e.target.tagName === 'A') nav.classList.remove('open');
});

// FAQ acordeão
document.querySelectorAll('.faq-item').forEach((item) => {
  const q = item.querySelector('.faq-q');
  const a = item.querySelector('.faq-a');
  q.addEventListener('click', () => {
    const isOpen = item.classList.contains('open');
    document.querySelectorAll('.faq-item.open').forEach((other) => {
      if (other !== item) {
        other.classList.remove('open');
        other.querySelector('.faq-a').style.maxHeight = null;
      }
    });
    item.classList.toggle('open', !isOpen);
    a.style.maxHeight = isOpen ? null : a.scrollHeight + 'px';
  });
});

// Revelar ao entrar no ecrã
const io = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in');
        io.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
);
document.querySelectorAll('.reveal').forEach((el) => io.observe(el));

// Fallback: se o utilizador prefere menos movimento, mostra tudo já
if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  document.querySelectorAll('.reveal').forEach((el) => el.classList.add('in'));
}
