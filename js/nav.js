/**
 * nav.js — ページ切り替えナビゲーション
 * 依存: deck.js / cards.js / skills.js（各 init 関数）
 */

const _navBtns = document.querySelectorAll('.nav-btn');
const _pages   = document.querySelectorAll('.page');

function showPage(id) {
  _pages.forEach(p => p.classList.toggle('active', p.id === 'page-' + id));
  _navBtns.forEach(b => b.classList.toggle('active', b.dataset.page === id));

  if (id === 'deck')   initDeckPage();
  if (id === 'cards')  initCardPage();
  if (id === 'skills') initSkillsPage();
}

_navBtns.forEach(btn => btn.addEventListener('click', () => {
  showPage(btn.dataset.page);
  document.getElementById('navMobile').classList.remove('open');
}));

document.getElementById('hamburger').addEventListener('click', () => {
  document.getElementById('navMobile').classList.toggle('open');
});
