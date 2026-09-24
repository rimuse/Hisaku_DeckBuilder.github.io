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

/**
 * カードの field（gensaku / workName / charName）の値を重複なく集め、ゲーム内の並び順で返す。
 * 並び順リスト（Storage.sortOrder）にない値は末尾に五十音順で並べる。
 */
function distinctInGameOrder(field, cards = Storage.cards.getAll()) {
  const values = [...new Set(cards.map(c => c[field]).filter(Boolean))];
  const rank   = new Map(Storage.sortOrder.get(field).map((v, i) => [v, i]));
  return values.sort((a, b) => {
    const ra = rank.has(a) ? rank.get(a) : Infinity;
    const rb = rank.has(b) ? rank.get(b) : Infinity;
    return ra !== rb ? ra - rb : a.localeCompare(b, 'ja');
  });
}

/** 条件タイプの日本語ラベル */
const COND_LABELS = {
  character:       'キャラ',
  work:            '作品',
  attribute:       '属性',
  owner_character: '所有者キャラ',
  owner_work:      '所有者作品',
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

/* ----------------------------------------------------------------
   セレクトの文字入力絞り込み
---------------------------------------------------------------- */
/** 絞り込み比較用の正規化（全角半角・大小文字・カタカナ/ひらがなを同一視） */
function normalizeForFilter(s) {
  return String(s ?? '').normalize('NFKC').toLowerCase()
    .replace(/[ァ-ヶ]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0x60));
}

/**
 * セレクトの選択肢を設定する（先頭に「なし」を自動付与）
 * items: [{ value, label }]
 * 絞り込み入力欄が紐づいていれば、その文字列で絞り込んで表示する
 */
function setSelectOptions(sel, items) {
  sel._filterItems = items;
  applySelectFilter(sel);
}

/**
 * 紐づく入力欄の文字列で選択肢を絞り込む
 * 現在の選択値は、条件に合わなくても選択肢に残す（値が勝手に変わらないように）
 */
function applySelectFilter(sel) {
  const cur = sel.value;
  const q   = normalizeForFilter(sel._filterInput ? sel._filterInput.value.trim() : '');
  const list = (sel._filterItems || []).filter(it =>
    !q || it.value === cur || normalizeForFilter(it.label).includes(q)
  );
  sel.innerHTML = '<option value="">なし</option>' +
    list.map(it => `<option value="${esc(it.value)}">${esc(it.label)}</option>`).join('');
  sel.value = list.some(it => it.value === cur) ? cur : '';
}

/** 絞り込み入力欄とセレクトを紐づける */
function bindSelectFilter(input, sel) {
  sel._filterInput = input;
  input.addEventListener('input', () => applySelectFilter(sel));
  // Enter でフォーム送信させず、候補があれば先頭を選択してセレクトへ移動
  input.addEventListener('keydown', e => {
    if (e.key !== 'Enter' || e.isComposing) return;
    e.preventDefault();
    if (sel.options.length > 1 && !sel.value) sel.value = sel.options[1].value;
    sel.focus();
  });
}

/** 絞り込みを解除して値を設定する（編集・リセット時用） */
function setFilteredSelectValue(sel, value) {
  if (sel._filterInput) sel._filterInput.value = '';
  applySelectFilter(sel);
  sel.value = value || '';
}
