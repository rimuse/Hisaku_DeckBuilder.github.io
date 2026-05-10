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
   登録済み奥義一覧
---------------------------------------------------------------- */
function _sortOugiList(list, sortVal) {
  if (sortVal === 'name-asc')  return list.slice().sort((a, b) => a.name.localeCompare(b.name, 'ja'));
  if (sortVal === 'name-desc') return list.slice().sort((a, b) => b.name.localeCompare(a.name, 'ja'));
  if (sortVal === 'reg-desc')  return list.slice().reverse();
  return list.slice(); /* reg-asc: 登録順（古い順） */
}

document.getElementById('ougiListSort').addEventListener('change', renderOugiList);

function renderOugiList() {
  const el      = document.getElementById('ougiList');
  const sortVal = document.getElementById('ougiListSort').value;
  const list    = _sortOugiList(Storage.ougi.getAll(), sortVal);

  if (!list.length) {
    el.innerHTML = '<div class="empty-state">奥義が登録されていません</div>';
    return;
  }

  el.innerHTML = list.map(o => {
    const noEffect = !!o.noEffect;
    const badge    = noEffect ? '<span class="no-effect-badge">効果なし</span>' : '';
    const sub      = noEffect ? '' : (o.desc ? `<div class="list-item-sub">${esc(o.desc)}</div>` : '');
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
}

function editOugi(id) {
  const o = Storage.ougi.get(id);
  if (!o) return;

  document.getElementById('ougiId').value           = o.id;
  document.getElementById('ougiName').value         = o.name     || '';
  document.getElementById('ougiDesc').value         = o.desc     || '';
  document.getElementById('ougiNoEffect').checked   = !!o.noEffect;
  document.getElementById('ougiDescSection').hidden = !!o.noEffect;

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
  Storage.ougi.save({
    id:       document.getElementById('ougiId').value || undefined,
    name:     document.getElementById('ougiName').value.trim(),
    noEffect: noEffect || undefined,
    desc:     noEffect ? undefined : (document.getElementById('ougiDesc').value.trim() || undefined),
  });
  resetOugiForm();
  renderOugiList();
  populateOugiSelect(); /* cards.js */
});

document.getElementById('ougiCancelBtn').addEventListener('click', resetOugiForm);
