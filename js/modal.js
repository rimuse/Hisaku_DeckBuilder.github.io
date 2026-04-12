/**
 * modal.js — モーダル共通ロジック＋削除確認ダイアログ
 * 依存: utils.js
 */

/** オーバーレイとクローズボタンを紐付けて open/close を返す */
function setupModal(overlayId, closeBtnId) {
  const overlay  = document.getElementById(overlayId);
  const closeBtn = closeBtnId ? document.getElementById(closeBtnId) : null;

  function open()  { overlay.classList.add('open'); }
  function close() { overlay.classList.remove('open'); }

  if (closeBtn) closeBtn.addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

  return { open, close };
}

/* カード詳細モーダル */
const cardModal = setupModal('cardModalOverlay', 'cardModalClose');

/* 削除確認モーダル */
const confirmModal = setupModal('confirmOverlay');

/* 重複確認モーダル */
const dupModal = setupModal('dupOverlay');

/* カード一覧モーダル */
const cardListModal = setupModal('cardListOverlay', 'cardListClose');
document.getElementById('btnOpenCardList').addEventListener('click', () => {
  renderCardList();
  cardListModal.open();
});

/* 特技一覧モーダル */
const skillListModal = setupModal('skillListOverlay', 'skillListClose');
document.getElementById('btnOpenSkillList').addEventListener('click', () => {
  renderSkillList();
  skillListModal.open();
});

/* 奥義一覧モーダル */
const ougiListModal = setupModal('ougiListOverlay', 'ougiListClose');
document.getElementById('btnOpenOugiList').addEventListener('click', () => {
  renderOugiList();
  ougiListModal.open();
});
let _confirmCb = null;

document.getElementById('confirmYes').addEventListener('click', () => {
  if (_confirmCb) _confirmCb();
  confirmModal.close();
  _confirmCb = null;
});
document.getElementById('confirmNo').addEventListener('click', () => {
  confirmModal.close();
  _confirmCb = null;
});

/**
 * 削除確認ダイアログを開く
 * @param {string} msg  - 表示メッセージ
 * @param {Function} cb - 「削除する」押下時のコールバック
 */
function openConfirm(msg, cb) {
  document.getElementById('confirmMsg').textContent = msg;
  _confirmCb = cb;
  confirmModal.open();
}
