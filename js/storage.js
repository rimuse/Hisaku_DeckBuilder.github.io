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
const _db = firebase.database();

/* ----------------------------------------------------------------
   ローカルキャッシュ（読み取りはここから行う）
---------------------------------------------------------------- */
let _cache = { cards: [], skills: [], ougi: [], cardHistory: [] };

/* ----------------------------------------------------------------
   ID インデックス（id → アイテムの Map）
   get(id) を線形探索 O(n) から O(1) に高速化するため、
   キャッシュ更新時に再構築する。
---------------------------------------------------------------- */
let _index = { cards: new Map(), skills: new Map(), ougi: new Map() };

function _rebuildIndex(key) {
  const m = new Map();
  for (const item of _cache[key]) m.set(item.id, item);
  _index[key] = m;
}

/* ----------------------------------------------------------------
   Firebase リアルタイムリスナー
   管理者がデータを変更すると全利用者のキャッシュが即時更新される
---------------------------------------------------------------- */
_db.ref('hisaku').on('value', snapshot => {
  const data  = snapshot.val() || {};
  const toArr = obj => (obj ? Object.values(obj) : []);

  _cache.cards       = toArr(data.cards);
  _cache.skills      = toArr(data.skills);
  _cache.ougi        = toArr(data.ougi);
  _cache.cardHistory = toArr(data.cardHistory);

  _rebuildIndex('cards');
  _rebuildIndex('skills');
  _rebuildIndex('ougi');

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
   undefined プロパティ除去
   Firebase RTDB は undefined 値を含むオブジェクトを拒否するため、
   書き込み前にすべての undefined プロパティを除去する
---------------------------------------------------------------- */
function _clean(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));
}

/* ----------------------------------------------------------------
   汎用ストアファクトリー
---------------------------------------------------------------- */
function makeStore(key) {
  return {
    /** キャッシュから全件返す（同期） */
    getAll() { return _cache[key].slice(); },

    /** キャッシュから1件返す（同期, O(1)） */
    get(id)  { return _index[key].get(id) || null; },

    /**
     * Firebase に書き込む（認証済み管理者のみ）。
     * キャッシュを即時楽観的更新して UI に即反映する。
     * @returns {boolean} true = 書き込み試行済み、false = 未認証で中止
     */
    save(item) {
      const user = firebase.auth().currentUser;
      console.log(`[Storage.save] user=${user ? user.email : 'null'}, key=${key}`);
      if (!user) {
        showToast('保存できません: ログインが必要です', true);
        return false;
      }
      if (!item.id) item.id = _uid();
      const clean = _clean(item);   // undefined を除去（Firebase が拒否するため）

      /* 楽観的更新 */
      const idx = _cache[key].findIndex(x => x.id === clean.id);
      if (idx >= 0) _cache[key][idx] = clean;
      else _cache[key].push(clean);
      _index[key].set(clean.id, clean);

      const path = `hisaku/${key}/${clean.id}`;
      console.log(`[Storage.save] Writing to ${path}`);
      _db.ref(path).set(clean)
        .then(() => console.log(`[Storage.save] OK: ${path}`))
        .catch(err => {
          console.error(`[Storage.save] FAILED: ${path}`, err);
          showToast(`保存に失敗しました: ${err.message}`, true);
        });
      return true;
    },

    /**
     * 複数アイテムを一括で Firebase に書き込む（認証済み管理者のみ）。
     * _db.ref().update() で単一の書き込みにまとめるため onValue は1回しか発火しない。
     * @returns {boolean} true = 書き込み試行済み、false = 未認証で中止
     */
    saveAll(items) {
      const user = firebase.auth().currentUser;
      console.log(`[Storage.saveAll] user=${user ? user.email : 'null'}, count=${items.length}`);
      if (!user) {
        showToast('保存できません: ログインが必要です', true);
        return false;
      }
      const updates = {};
      items.forEach(item => {
        if (!item.id) item.id = _uid();
        const clean = _clean(item);   // undefined を除去（Firebase が拒否するため）
        const idx = _cache[key].findIndex(x => x.id === clean.id);
        if (idx >= 0) _cache[key][idx] = clean;
        else _cache[key].push(clean);
        _index[key].set(clean.id, clean);
        updates[`hisaku/${key}/${clean.id}`] = clean;
      });
      console.log(`[Storage.saveAll] Paths:`, Object.keys(updates));
      _db.ref().update(updates)
        .then(() => console.log(`[Storage.saveAll] OK: ${items.length} items`))
        .catch(err => {
          console.error(`[Storage.saveAll] FAILED`, err);
          showToast(`一括保存に失敗しました: ${err.message}`, true);
        });
      return true;
    },

    /**
     * Firebase から削除する（認証済み管理者のみ）。
     * キャッシュを即時楽観的更新する。
     */
    delete(id) {
      if (!firebase.auth().currentUser) {
        alert('データの削除には管理者ログインが必要です。');
        return;
      }
      _cache[key] = _cache[key].filter(x => x.id !== id);
      _index[key].delete(id);

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
  ougi:   makeStore('ougi'),

  cardHistory: {
    getAll() {
      return _cache.cardHistory.slice()
        .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
        .slice(0, 100);
    },
    /** カード登録/編集時に呼び出す */
    record(cardName, charName, action) {
      const user = firebase.auth().currentUser;
      if (!user) return;
      const entry = { id: _uid(), timestamp: Date.now(), cardName, charName, action };
      _cache.cardHistory.push(entry);
      _db.ref(`hisaku/cardHistory/${entry.id}`).set(entry)
        .catch(err => console.error('[cardHistory.record] FAILED', err));
    }
  }
};

