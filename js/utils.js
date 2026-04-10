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
const COND_LABELS = { character: 'キャラ', work: '作品', attribute: '属性' };
function condLabel(type) { return COND_LABELS[type] || type; }
