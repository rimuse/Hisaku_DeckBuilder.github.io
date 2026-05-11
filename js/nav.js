/**
 * nav.js — ページ切り替えナビゲーション
 * 依存: deck.js / cards.js / skills.js（各 init 関数）
 *       auth.js（isAuthenticated / openLoginModal）
 */

const _navBtns = document.querySelectorAll('.nav-btn');
const _pages   = document.querySelectorAll('.page');

/** 管理者権限が必要なページ */
const PROTECTED_PAGES = ['cards', 'skills'];

/** 現在表示中のページ ID（storage.js の Firebase リスナーが再描画に使用） */
let _currentPage = 'deck';

function showPage(id) {
  /* 管理ページへのアクセスは認証チェック */
  if (PROTECTED_PAGES.includes(id) && !isAuthenticated()) {
    openLoginModal(id);
    return;
  }

  _currentPage = id;
  _pages.forEach(p => p.classList.toggle('active', p.id === 'page-' + id));
  _navBtns.forEach(b => b.classList.toggle('active', b.dataset.page === id));

  if (id === 'deck')    initDeckPage();
  if (id === 'reginfo') initRegInfoPage();
  if (id === 'cards')   initCardPage();
  if (id === 'skills')  initSkillsPage();
}

/**
 * Firebase のデータ更新時に storage.js から呼び出される。
 * 現在表示中のページを再描画する。
 */
function renderCurrentPage() {
  if (_currentPage === 'deck')    initDeckPage();
  if (_currentPage === 'reginfo') initRegInfoPage();
  if (_currentPage === 'cards')   initCardPage();
  if (_currentPage === 'skills')  initSkillsPage();
}

_navBtns.forEach(btn => btn.addEventListener('click', () => {
  showPage(btn.dataset.page);
  document.getElementById('navMobile').classList.remove('open');
}));

document.getElementById('hamburger').addEventListener('click', () => {
  document.getElementById('navMobile').classList.toggle('open');
});
