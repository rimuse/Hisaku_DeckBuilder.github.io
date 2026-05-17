/**
 * ougi.js — 奥義登録ページ
 * 依存: storage.js / utils.js / modal.js
 * 他モジュールへの呼び出し: populateOugiSelect()（cards.js）
 */

/* ----------------------------------------------------------------
   効果なしチェックボックス
---------------------------------------------------------------- */
document.getElementById('ougiNoEffect').addEventListener('change', function () {
  document.getElementById('ougiDescSection').hidden = this.checked;
});

/* ----------------------------------------------------------------
   対象リスト（ローカル状態）
---------------------------------------------------------------- */
let ougiTargets = [];

function renderOugiTargetList() {
  const el = document.getElementById('ougiTargetList');
  if (!ougiTargets.length) {
    el.innerHTML = '<span class="empty-hint">対象なし（すべて）</span>';
    return;
  }
  el.innerHTML = ougiTargets.map((t, i) => {
    const valPart = t.type === 'attribute' ? `：${esc(t.value)}` :
                    t.type === 'character' ? `：${esc(t.value)}` :
                    t.type === 'work'      ? `：${esc(t.value)}` : '';
    const label = t.type === 'attribute' ? '属性' :
                  t.type === 'character' ? 'キャラクター名' :
                  t.type === 'work'      ? '作品' : t.type;
    return `<span class="cond-tag">
      ${label}${valPart}
      <button type="button" class="cond-tag-remove" data-i="${i}">&times;</button>
    </span>`;
  }).join('<span class="or-sep">または</span>');

  el.querySelectorAll('.cond-tag-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      ougiTargets.splice(+btn.dataset.i, 1);
      renderOugiTargetList();
    });
  });
}

/* 対象タイプ変更 → 入力欄切り替え */
document.getElementById('ougiTargetType').addEventListener('change', function () {
  const inp    = document.getElementById('ougiTargetValue');
  const sepEl  = document.getElementById('ougiTargetValueSep');
  const attrGr = document.getElementById('ougiTargetAttrGroup');
  const isAll  = this.value === 'all';
  const isAttr = this.value === 'attribute';

  inp.hidden    = isAll || isAttr;
  sepEl.hidden  = isAll;
  attrGr.hidden = !isAttr;

  if (isAll || isAttr) inp.value = '';
  if (!isAll && !isAttr) _refreshOugiTargetSuggestions();
});

function _refreshOugiTargetSuggestions() {
  const cards = Storage.cards.getAll();
  const type  = document.getElementById('ougiTargetType').value;
  const vals  = type === 'work'
    ? [...new Set(cards.map(c => c.workName).filter(Boolean))].sort()
    : [...new Set(cards.map(c => c.charName).filter(Boolean))].sort();
  document.getElementById('ougiTargetValueSuggestions').innerHTML =
    vals.map(v => `<option value="${esc(v)}">`).join('');
}

/* 対象追加ボタン */
document.getElementById('btnAddOugiTarget').addEventListener('click', () => {
  const type = document.getElementById('ougiTargetType').value;
  if (type === 'all') {
    ougiTargets = [];
    renderOugiTargetList();
    return;
  }
  let value = '';
  if (type === 'attribute') {
    value = document.querySelector('input[name="ougiTargetAttrVal"]:checked')?.value || '';
    if (!value) { alert('属性を選択してください'); return; }
  } else {
    value = document.getElementById('ougiTargetValue').value.trim();
    if (!value) { alert('対象の値を入力してください'); return; }
    document.getElementById('ougiTargetValue').value = '';
  }
  ougiTargets.push({ type, value });
  renderOugiTargetList();
});

/* ----------------------------------------------------------------
   パターン切り替え
---------------------------------------------------------------- */
document.querySelectorAll('input[name="ougiPattern"]').forEach(radio => {
  radio.addEventListener('change', function () {
    document.getElementById('ougiPatternPower').hidden  = this.value !== 'power';
    document.getElementById('ougiPatternDamage').hidden = this.value !== 'damage';
  });
});

/* ----------------------------------------------------------------
   登録済み奥義一覧
---------------------------------------------------------------- */
function _sortOugiList(list, sortVal) {
  if (sortVal === 'name-asc')  return list.slice().sort((a, b) => a.name.localeCompare(b.name, 'ja'));
  if (sortVal === 'name-desc') return list.slice().sort((a, b) => b.name.localeCompare(a.name, 'ja'));
  if (sortVal === 'reg-desc')  return list.slice().reverse();
  return list.slice(); /* reg-asc: 登録順（古い順） */
}

document.getElementById('ougiListSort').addEventListener('change', renderOugiList);
document.getElementById('ougiListSearch').addEventListener('input', renderOugiList);

function _ougiTargetLabel(targets) {
  if (!targets || !targets.length) return 'すべて';
  return targets.map(t => {
    const label = t.type === 'attribute' ? '属性' :
                  t.type === 'character' ? 'キャラクター名' :
                  t.type === 'work'      ? '作品' : t.type;
    return `${label}：${t.value}`;
  }).join(' / ');
}

function renderOugiList() {
  const el      = document.getElementById('ougiList');
  const sortVal = document.getElementById('ougiListSort').value;
  const query   = document.getElementById('ougiListSearch').value.toLowerCase();
  let list      = _sortOugiList(Storage.ougi.getAll(), sortVal);
  if (query) list = list.filter(o => o.name.toLowerCase().includes(query));

  if (!list.length) {
    el.innerHTML = `<div class="empty-state">${query ? '検索結果が見つかりません' : '奥義が登録されていません'}</div>`;
    return;
  }

  el.innerHTML = list.map(o => {
    const noEffect = !!o.noEffect;
    const badge    = noEffect ? '<span class="no-effect-badge">効果なし</span>' : '';
    let sub = '';
    if (!noEffect) {
      const lvBadge  = o.maxLv ? `<span class="skill-lv-badge">最大Lv${o.maxLv}</span>` : '';
      const target   = _ougiTargetLabel(o.targets);
      const effStr   = o.pattern === 'damage'
        ? `ダメージ ${fmt(o.minRate)}→${fmt(o.maxRate)}倍`
        : `脅迫力上昇 ${fmt(o.minPct)}→${fmt(o.maxPct)}%`;
      sub = `<div class="list-item-sub">${esc(target)} — ${effStr}${lvBadge}</div>`;
    }
    return `
    <div class="list-item">
      <div class="list-item-main">
        <div class="list-item-name">${esc(o.name)}${badge}</div>
        ${sub}
      </div>
      <div class="list-item-actions">
        <button class="icon-btn edit"   data-id="${esc(o.id)}">編集</button>
        <button class="icon-btn delete" data-id="${esc(o.id)}">削除</button>
      </div>
    </div>`;
  }).join('');

  el.querySelectorAll('.icon-btn.edit').forEach(btn =>
    btn.addEventListener('click', () => { ougiListModal.close(); editOugi(btn.dataset.id); })
  );
  el.querySelectorAll('.icon-btn.delete').forEach(btn =>
    btn.addEventListener('click', () => deleteOugi(btn.dataset.id))
  );
}

/* ----------------------------------------------------------------
   フォーム操作
---------------------------------------------------------------- */
function resetOugiForm() {
  document.getElementById('ougiForm').reset();
  document.getElementById('ougiId').value              = '';
  document.getElementById('ougiNoEffect').checked      = false;
  document.getElementById('ougiDescSection').hidden    = false;
  document.getElementById('ougiFormTitle').textContent = '新規奥義登録';
  document.getElementById('ougiCancelBtn').hidden      = true;

  /* 対象リストリセット */
  ougiTargets = [];
  renderOugiTargetList();

  /* パターンリセット */
  document.querySelector('input[name="ougiPattern"][value="power"]').checked = true;
  document.getElementById('ougiPatternPower').hidden  = false;
  document.getElementById('ougiPatternDamage').hidden = true;

  /* 対象入力リセット */
  document.getElementById('ougiTargetType').value    = 'all';
  document.getElementById('ougiTargetValue').hidden  = true;
  document.getElementById('ougiTargetValueSep').hidden = true;
  document.getElementById('ougiTargetAttrGroup').hidden = true;

  /* 数値リセット */
  document.getElementById('ougiMaxLv').value   = 1;
  document.getElementById('ougiMinPct').value  = 0;
  document.getElementById('ougiMaxPct').value  = 0;
  document.getElementById('ougiMinRate').value = 0;
  document.getElementById('ougiMaxRate').value = 0;
}

function editOugi(id) {
  const o = Storage.ougi.get(id);
  if (!o) return;

  document.getElementById('ougiId').value           = o.id;
  document.getElementById('ougiName').value         = o.name     || '';
  document.getElementById('ougiNoEffect').checked   = !!o.noEffect;
  document.getElementById('ougiDescSection').hidden = !!o.noEffect;

  if (!o.noEffect) {
    document.getElementById('ougiMaxLv').value = o.maxLv || 1;

    /* 対象 */
    ougiTargets = (o.targets || []).slice();
    renderOugiTargetList();

    /* パターン */
    const pattern = o.pattern || 'power';
    document.querySelector(`input[name="ougiPattern"][value="${pattern}"]`).checked = true;
    document.getElementById('ougiPatternPower').hidden  = pattern !== 'power';
    document.getElementById('ougiPatternDamage').hidden = pattern !== 'damage';

    document.getElementById('ougiMinPct').value  = o.minPct  ?? 0;
    document.getElementById('ougiMaxPct').value  = o.maxPct  ?? 0;
    document.getElementById('ougiMinRate').value = o.minRate ?? 0;
    document.getElementById('ougiMaxRate').value = o.maxRate ?? 0;
  } else {
    ougiTargets = [];
    renderOugiTargetList();
  }

  document.getElementById('ougiFormTitle').textContent = '奥義編集';
  document.getElementById('ougiCancelBtn').hidden = false;
  document.getElementById('ougiForm').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function deleteOugi(id) {
  const o = Storage.ougi.get(id);
  if (!o) return;
  openConfirm(`「${o.name}」を削除しますか？`, () => {
    Storage.ougi.delete(id);
    renderOugiList();
    populateOugiSelect(); /* cards.js */
  });
}

document.getElementById('ougiForm').addEventListener('submit', e => {
  e.preventDefault();
  const noEffect = document.getElementById('ougiNoEffect').checked;
  const pattern  = document.querySelector('input[name="ougiPattern"]:checked')?.value || 'power';

  Storage.ougi.save({
    id:       document.getElementById('ougiId').value || undefined,
    name:     document.getElementById('ougiName').value.trim(),
    noEffect: noEffect || undefined,
    maxLv:    noEffect ? undefined : (num(document.getElementById('ougiMaxLv').value) || 1),
    targets:  noEffect ? undefined : ougiTargets.slice(),
    pattern:  noEffect ? undefined : pattern,
    minPct:   (noEffect || pattern !== 'power')   ? undefined : num(document.getElementById('ougiMinPct').value),
    maxPct:   (noEffect || pattern !== 'power')   ? undefined : num(document.getElementById('ougiMaxPct').value),
    minRate:  (noEffect || pattern !== 'damage')  ? undefined : num(document.getElementById('ougiMinRate').value),
    maxRate:  (noEffect || pattern !== 'damage')  ? undefined : num(document.getElementById('ougiMaxRate').value),
  });
  resetOugiForm();
  renderOugiList();
  populateOugiSelect(); /* cards.js */
});

document.getElementById('ougiCancelBtn').addEventListener('click', resetOugiForm);
