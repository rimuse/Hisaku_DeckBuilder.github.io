/**
 * storage.js — Firebase Realtime Database を使ったマスターデータ管理
 *
 * アクセス制御:
 *   - 読み取り: 誰でも可（デッキシミュレーター利用者）
 *   - 書き込み: 認証済み管理者のみ（Firebase Auth + ルールで二重保護）
 *
 * Firebase コンソール → Realtime Database → ルール に以下を設定してください:
 *   {
 *     "rules": {
 *       "hisaku": {
 *         ".read": true,
 *         ".write": "auth != null"
 *       }
 *     }
 *   }
 */

/* ----------------------------------------------------------------
   Firebase 初期化
---------------------------------------------------------------- */
firebase.initializeApp(FIREBASE_CONFIG);
const _db   = firebase.database();
const _auth = firebase.auth();

/* ----------------------------------------------------------------
   ローカルキャッシュ（読み取りはここから行う）
---------------------------------------------------------------- */
let _cache = { cards: [], skills: [], ougi: [] };

/* ----------------------------------------------------------------
   Firebase リアルタイムリスナー
   管理者がデータを変更すると全利用者のキャッシュが即時更新される
---------------------------------------------------------------- */
_db.ref('hisaku').on('value', snapshot => {
  const data  = snapshot.val() || {};
  const toArr = obj => (obj ? Object.values(obj) : []);

  _cache.cards  = toArr(data.cards);
  _cache.skills = toArr(data.skills);
  _cache.ougi   = toArr(data.ougi);

  const overlay = document.getElementById('loadingOverlay');
  if (overlay) overlay.hidden = true;

  if (typeof renderCurrentPage === 'function') renderCurrentPage();
}, err => {
  /* 読み取りエラー（ルール拒否など） */
  console.error('Firebase read error:', err);
  const overlay = document.getElementById('loadingOverlay');
  if (overlay) {
    overlay.querySelector('.loading-msg').textContent =
      `データ読み取りエラー: ${err.message}`;
  }
});

/* ----------------------------------------------------------------
   接続状態監視（初期 false を誤検知しないようタイムアウト方式）
---------------------------------------------------------------- */
let _everConnected = false;
const _connErrorTimer = setTimeout(() => {
  if (!_everConnected) {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
      overlay.querySelector('.loading-msg').textContent =
        'Firebase に接続できません。\n' +
        '① Realtime Database が作成済みか\n' +
        '② セキュリティルールで .read が許可されているか\n' +
        '③ ネットワーク環境を確認してください。';
    }
  }
}, 10000);

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

    /**
     * Firebase に書き込む（認証済み管理者のみ）。
     * キャッシュを即時楽観的更新して UI に即反映する。
     */
    save(item) {
      if (!_auth.currentUser) {
        alert('データの保存には管理者ログインが必要です。');
        return item;
      }
      if (!item.id) item.id = _uid();

      /* 楽観的更新 */
      const idx = _cache[key].findIndex(x => x.id === item.id);
      if (idx >= 0) _cache[key][idx] = item;
      else _cache[key].push(item);

      _db.ref(`hisaku/${key}/${item.id}`).set(item).catch(err => {
        console.error('Firebase write error:', err);
        alert(`保存に失敗しました。\n${err.message}`);
      });
      return item;
    },

    /**
     * Firebase から削除する（認証済み管理者のみ）。
     * キャッシュを即時楽観的更新する。
     */
    delete(id) {
      if (!_auth.currentUser) {
        alert('データの削除には管理者ログインが必要です。');
        return;
      }
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

