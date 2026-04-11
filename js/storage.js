/**
 * storage.js — Firebase Realtime Database を使った全ユーザー共通データ管理
 *
 * 動作概要:
 *   - 読み取り: ローカルキャッシュから同期的に返す（高速）
 *   - 書き込み: Firebase に非同期で送信
 *   - 同期:     Firebase の変更を全員のブラウザにリアルタイム反映
 */

/* ----------------------------------------------------------------
   Firebase 初期化
---------------------------------------------------------------- */
firebase.initializeApp(FIREBASE_CONFIG);
const _db = firebase.database();

/* ----------------------------------------------------------------
   ローカルキャッシュ（読み取りはここから行う）
---------------------------------------------------------------- */
let _cache = { cards: [], skills: [], ougi: [] };

/* ----------------------------------------------------------------
   Firebase リアルタイムリスナー
   誰かがデータを変更するたびに全ユーザーのキャッシュが更新される
---------------------------------------------------------------- */
_db.ref('hisaku').on('value', snapshot => {
  const data  = snapshot.val() || {};
  const toArr = obj => (obj ? Object.values(obj) : []);

  _cache.cards  = toArr(data.cards);
  _cache.skills = toArr(data.skills);
  _cache.ougi   = toArr(data.ougi);

  /* ローディング画面を非表示にする */
  const overlay = document.getElementById('loadingOverlay');
  if (overlay) overlay.hidden = true;

  /* 現在表示中のページを再描画する（nav.js で定義） */
  if (typeof renderCurrentPage === 'function') renderCurrentPage();
});

/* ----------------------------------------------------------------
   エラーハンドリング（設定値が未入力の場合など）
---------------------------------------------------------------- */
_db.ref('.info/connected').on('value', snapshot => {
  if (snapshot.val() === false) {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
      overlay.querySelector('.loading-msg').textContent =
        'Firebase に接続できません。firebase-config.js の設定を確認してください。';
    }
  }
});

/* ----------------------------------------------------------------
   ID 生成
---------------------------------------------------------------- */
function _uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/* ----------------------------------------------------------------
   汎用ストアファクトリー
---------------------------------------------------------------- */
function makeStore(key) {
  return {
    /** キャッシュから全件返す（同期） */
    getAll() { return _cache[key].slice(); },

    /** キャッシュから1件返す（同期） */
    get(id)  { return _cache[key].find(x => x.id === id) || null; },

    /** Firebase に書き込む（非同期）。id がなければ採番して返す */
    save(item) {
      if (!item.id) item.id = _uid();
      _db.ref(`hisaku/${key}/${item.id}`).set(item);
      return item;
    },

    /** Firebase から削除する（非同期） */
    delete(id) {
      _db.ref(`hisaku/${key}/${id}`).remove();
    }
  };
}

/* ----------------------------------------------------------------
   公開 API
---------------------------------------------------------------- */
const Storage = {
  cards:  makeStore('cards'),
  skills: makeStore('skills'),
  ougi:   makeStore('ougi')
};
