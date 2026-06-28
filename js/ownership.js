/**
 * ownership.js — カードの所持/未所持をローカル領域(localStorage)で管理
 *
 * Firebase 上のカードマスターデータは変更せず、所持情報のみ
 * 各利用者のブラウザに分離して保存する。
 *
 * 保存先: localStorage キー `hisaku_owned_cards`
 * 保存形式: 所持カードの card.id 配列（JSON）
 *   card.id は Firebase の保存キーで全カードに必ず存在する（storage.js 参照）。
 */

const Ownership = (() => {
  const STORAGE_KEY = 'hisaku_owned_cards';
  let _owned = _load();

  function _load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return new Set(Array.isArray(arr) ? arr : []);
    } catch (e) {
      console.error('[Ownership] load failed:', e);
      return new Set();
    }
  }

  function _persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([..._owned]));
    } catch (e) {
      console.error('[Ownership] persist failed:', e);
    }
  }

  return {
    /** 所持しているか */
    isOwned(cardId) { return _owned.has(cardId); },

    /** 所持状態をセット */
    setOwned(cardId, owned) {
      if (!cardId) return;
      if (owned) _owned.add(cardId);
      else _owned.delete(cardId);
      _persist();
    },

    /** 全所持IDの Set を返す（コピー） */
    getAll() { return new Set(_owned); },

    /**
     * 現存カードに存在しない所持IDを除去する（孤立データ掃除）。
     * カード削除→再登録で id がブレた場合に残るゴミを掃除する。
     */
    cleanup() {
      const validIds = new Set(Storage.cards.getAll().map(c => c.id));
      let changed = false;
      for (const id of [..._owned]) {
        if (!validIds.has(id)) { _owned.delete(id); changed = true; }
      }
      if (changed) _persist();
    },
  };
})();
