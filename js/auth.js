/**
 * auth.js — Firebase Authentication による管理画面アクセス制御
 *
 * ■ 初回セットアップ（Firebase コンソール）
 * 1. Authentication → Sign-in method → 「メール / パスワード」を有効化
 * 2. Authentication → Users → 「ユーザーを追加」で管理者アカウントを作成
 *    （メールアドレス・パスワードは自由に設定）
 * 3. 以後、そのメールアドレスとパスワードでログインする
 *
 * 保護対象ページ: カード情報登録 / スキル・奥義登録
 * 公開ページ    : デッキシミュレーション（ログイン不要）
 */

const _auth    = firebase.auth();
let _currentUser = null;
let _pendingPage = null; // ログイン前にアクセス要求されたページ

/* ----------------------------------------------------------------
   Auth 状態監視
---------------------------------------------------------------- */
_auth.onAuthStateChanged(user => {
  _currentUser = user;
  _updateAuthUI();

  /* ログイン成功後、要求されていたページへ遷移 */
  if (user && _pendingPage) {
    const page  = _pendingPage;
    _pendingPage = null;
    showPage(page);
  }
});

/** 現在ログイン中かどうか（nav.js から参照） */
function isAuthenticated() { return _currentUser !== null; }

/* ----------------------------------------------------------------
   ログインモーダル
---------------------------------------------------------------- */
function openLoginModal(requestedPage) {
  _pendingPage = requestedPage || null;
  document.getElementById('loginError').hidden = true;
  document.getElementById('loginForm').reset();
  document.getElementById('loginOverlay').classList.add('open');
  setTimeout(() => document.getElementById('loginEmail').focus(), 50);
}

function _closeLoginModal() {
  document.getElementById('loginOverlay').classList.remove('open');
}

document.getElementById('loginForm').addEventListener('submit', async e => {
  e.preventDefault();
  const email    = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  const errorEl  = document.getElementById('loginError');
  const btn      = document.getElementById('loginSubmitBtn');

  btn.disabled    = true;
  btn.textContent = 'ログイン中...';
  errorEl.hidden  = true;

  try {
    await _auth.signInWithEmailAndPassword(email, password);
    _closeLoginModal();
  } catch {
    errorEl.textContent = 'メールアドレスまたはパスワードが正しくありません';
    errorEl.hidden = false;
  } finally {
    btn.disabled    = false;
    btn.textContent = 'ログイン';
  }
});

document.getElementById('loginCancelBtn').addEventListener('click', () => {
  _pendingPage = null;
  _closeLoginModal();
});

document.getElementById('loginOverlay').addEventListener('click', e => {
  if (e.target === document.getElementById('loginOverlay')) {
    _pendingPage = null;
    _closeLoginModal();
  }
});

/* ----------------------------------------------------------------
   ログアウト
---------------------------------------------------------------- */
document.getElementById('btnLogout').addEventListener('click', async () => {
  await _auth.signOut();
  showPage('deck');
});

/* ----------------------------------------------------------------
   Auth 状態に応じた UI 更新
---------------------------------------------------------------- */
function _updateAuthUI() {
  /* ログアウトボタン表示切り替え */
  document.getElementById('btnLogout').hidden = !_currentUser;

  /* 管理ページナビボタンに「ログイン済み」クラスを付与 */
  document.querySelectorAll('.nav-btn[data-admin="true"]').forEach(btn => {
    btn.classList.toggle('admin-authed', !!_currentUser);
  });
}
