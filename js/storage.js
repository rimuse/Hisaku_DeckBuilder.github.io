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
   接続状態監視
   .info/connected はページ読み込み直後は必ず false から始まるため、
   初期 false をエラーと誤判定しないようタイムアウト方式で検知する
---------------------------------------------------------------- */
let _everConnected = false;
const _connErrorTimer = setTimeout(() => {
  if (!_everConnected) {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
      overlay.querySelector('.loading-msg').textContent =
        'Firebase に接続できません。\n' +
        '① Realtime Database が Firebase コンソールで作成済みか\n' +
        '② セキュリティルールが読み取りを許可しているか\n' +
        '③ ネットワーク環境を確認してください。';
    }
  }
}, 10000); // 10秒以内に接続できなければエラー表示

_db.ref('.info/connected').on('value', snapshot => {
  if (snapshot.val() === true) {
    _everConnected = true;
    clearTimeout(_connErrorTimer);
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

    /** Firebase に書き込む（非同期）。キャッシュを即時楽観的更新する */
    save(item) {
      if (!item.id) item.id = _uid();

      /* 楽観的更新: Firebase の応答を待たずキャッシュに反映 */
      const idx = _cache[key].findIndex(x => x.id === item.id);
      if (idx >= 0) _cache[key][idx] = item;
      else _cache[key].push(item);

      _db.ref(`hisaku/${key}/${item.id}`).set(item).catch(err => {
        console.error('Firebase write error:', err);
        alert(`保存に失敗しました。\n${err.message}`);
      });
      return item;
    },

    /** Firebase から削除する（非同期）。キャッシュを即時楽観的更新する */
    delete(id) {
      /* 楽観的更新 */
      _cache[key] = _cache[key].filter(x => x.id !== id);

      _db.ref(`hisaku/${key}/${id}`).remove().catch(err => {
        console.error('Firebase delete error:', err);
        alert(`削除に失敗しました。\n${err.message}`);
      });
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
