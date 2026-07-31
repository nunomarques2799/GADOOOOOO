// Terrabovina — interações da landing page

// Ano no rodapé
document.getElementById('year').textContent = new Date().getFullYear();

// Sombra da nav ao rolar
const nav = document.getElementById('nav');
const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 8);
onScroll();
window.addEventListener('scroll', onScroll, { passive: true });

// Menu mobile
const toggle = document.getElementById('navToggle');
const navLinks = document.getElementById('navLinks');
const fecharMenu = () => {
  nav.classList.remove('open');
  toggle?.setAttribute('aria-expanded', 'false');
};
toggle?.addEventListener('click', (e) => {
  e.stopPropagation();
  const aberto = nav.classList.toggle('open');
  toggle.setAttribute('aria-expanded', String(aberto));
});
navLinks?.addEventListener('click', (e) => {
  if (e.target.closest('a')) fecharMenu();
});
// Um menu aberto tapa a página. Tocar fora, carregar em Escape ou rodar o
// telemóvel para o formato de computador tem de o fechar — senão fica um
// painel branco por cima do conteúdo sem forma óbvia de sair.
document.addEventListener('click', (e) => {
  if (nav.classList.contains('open') && !nav.contains(e.target)) fecharMenu();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') fecharMenu();
});
// 901px = o ponto onde a barra volta a mostrar os links todos (styles.css).
window.matchMedia('(min-width: 901px)').addEventListener('change', (e) => {
  if (e.matches) fecharMenu();
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

// A altura da resposta aberta é fixada em pixéis no momento do clique. Se o
// ecrã mudar de largura a seguir (rodar o telemóvel), o texto passa a ocupar
// mais linhas do que a altura guardada e fica cortado.
window.addEventListener('resize', () => {
  document.querySelectorAll('.faq-item.open .faq-a').forEach((a) => {
    a.style.maxHeight = a.scrollHeight + 'px';
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
