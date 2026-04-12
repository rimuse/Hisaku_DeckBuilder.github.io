/**
 * utils.js — 共通ユーティリティ関数
 * 依存: なし
 */

/** HTML エスケープ */
function esc(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/** 数値変換（NaN → 0） */
function num(v) { return +v || 0; }

/** 数値を locale 形式で表示 */
function fmt(v) { return num(v).toLocaleString(); }

/** 条件タイプの日本語ラベル */
const COND_LABELS = {
  character:       'キャラ',
  work:            '作品',
  attribute:       '属性',
  owner_character: '所有者キャラ',
  owner_attribute: '所有者属性',
};
function condLabel(type) { return COND_LABELS[type] || type; }

/** トースト通知（画面下部に3秒間表示） */
function showToast(msg, isError = false) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.className   = 'toast' + (isError ? ' toast-error' : '');
  el.hidden      = false;
  clearTimeout(el._hideTimer);
  el._hideTimer  = setTimeout(() => { el.hidden = true; }, 3000);
}
