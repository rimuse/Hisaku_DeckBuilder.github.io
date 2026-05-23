/**
 * cards.js — カード情報登録ページ
 * 依存: storage.js / utils.js / modal.js / deck.js（deck 変数参照）
 */

/* ----------------------------------------------------------------
   ページ初期化
---------------------------------------------------------------- */
function initCardPage() {
  populateSkillSelect();
  populateOugiSelect();
  refreshGensakuSuggestions();
  refreshWorkSuggestions();
}

/* ----------------------------------------------------------------
   カードフォームのセレクト更新（他ページから呼び出される）
---------------------------------------------------------------- */
function populateSkillSelect() {
  const sel = document.getElementById('cardSkill');
  const cur = sel.value;
  sel.innerHTML = '<option value="">なし</option>' +
    Storage.skills.getAll().slice().sort((a, b) => a.name.localeCompare(b.name, 'ja')).map(s =>
      `<option value="${esc(s.id)}"${s.id === cur ? ' selected' : ''}>${esc(s.name)}</option>`
    ).join('');
}

function populateOugiSelect() {
  const sel = document.getElementById('cardOugi');
  const cur = sel.value;
  sel.innerHTML = '<option value="">なし</option>' +
    Storage.ougi.getAll().slice().sort((a, b) => a.name.localeCompare(b.name, 'ja')).map(o =>
      `<option value="${esc(o.id)}"${o.id === cur ? ' selected' : ''}>${esc(o.name)}</option>`
    ).join('');
}

/* ----------------------------------------------------------------
   原作・作品サジェスト更新
---------------------------------------------------------------- */
function refreshGensakuSuggestions() {
  const gensakus = [...new Set(Storage.cards.getAll().map(c => c.gensaku).filter(Boolean))].sort();
  document.getElementById('gensakuSuggestions').innerHTML =
    gensakus.map(g => `<option value="${esc(g)}">`).join('');
}

function refreshWorkSuggestions() {
  const works = [...new Set(Storage.cards.getAll().map(c => c.workName).filter(Boolean))].sort();
  document.getElementById('workSuggestions').innerHTML =
    works.map(w => `<option value="${esc(w)}">`).join('');
}

/* ----------------------------------------------------------------
   登録済みカード一覧
---------------------------------------------------------------- */
function renderCardList() {
  const query = (document.getElementById('cardListSearch').value || '').toLowerCase();
  let cards = Storage.cards.getAll();
  if (query) cards = cards.filter(c =>
    [c.internalId, c.cardName, c.charName, c.gensaku, c.workName].some(v => (v || '').toLowerCase().includes(query))
  );

  const el = document.getElementById('cardList');
  if (!cards.length) {
    el.innerHTML = '<div class="empty-state">カードが登録されていません</div>';
    return;
  }

  el.innerHTML = cards.map(c => {
    const skill = c.skillId ? Storage.skills.get(c.skillId) : null;
    const ougi  = c.ougiId  ? Storage.ougi.get(c.ougiId)   : null;
    return `
    <div class="list-item">
      <span class="slot-rarity rarity-${esc(c.rarity)}">${esc(c.rarity)}</span>
      <div class="list-item-main">
        <div class="list-item-name">${esc(c.cardName)}${c.internalId ? `<span class="internal-id-badge">${esc(c.internalId)}</span>` : ''}</div>
        <div class="list-item-sub">${esc(c.charName)}${c.gensaku ? ' / ' + esc(c.gensaku) : ''}${c.workName ? ' / ' + esc(c.workName) : ''} — 脅 ${fmt(c.power)} / 耐 ${fmt(c.hp)}</div>
        <div class="list-item-sub">特技：${skill ? esc(skill.name) : '—'}</div>
        <div class="list-item-sub">奥義：${ougi  ? esc(ougi.name)  : '—'}</div>
      </div>
      <div class="list-item-actions">
        <button class="icon-btn edit"   data-id="${esc(c.id)}">編集</button>
        <button class="icon-btn delete" data-id="${esc(c.id)}">削除</button>
      </div>
    </div>`;
  }).join('');

  el.querySelectorAll('.icon-btn.edit').forEach(btn =>
    btn.addEventListener('click', () => { cardListModal.close(); editCard(btn.dataset.id); })
  );
  el.querySelectorAll('.icon-btn.delete').forEach(btn =>
    btn.addEventListener('click', () => deleteCard(btn.dataset.id))
  );
}

document.getElementById('cardListSearch').addEventListener('input', renderCardList);

/* ----------------------------------------------------------------
   フォーム操作
---------------------------------------------------------------- */
function resetCardForm() {
  document.getElementById('cardForm').reset();
  document.getElementById('cardId').value = '';
  document.getElementById('cardFormTitle').textContent = '新規カード登録';
  document.getElementById('cardCancelBtn').hidden = true;
}

function editCard(id) {
  const c = Storage.cards.get(id);
  if (!c) return;

  document.getElementById('cardId').value         = c.id;
  document.getElementById('internalId').value     = c.internalId || '';
  document.getElementById('cardName').value       = c.cardName   || '';
  document.getElementById('charName').value       = c.charName   || '';
  document.getElementById('gensaku').value        = c.gensaku    || '';
  document.getElementById('workName').value       = c.workName   || '';
  document.getElementById('cardPower').value      = c.power      || '';
  document.getElementById('cardHp').value         = c.hp         || '';
  document.getElementById('cardSkill').value      = c.skillId    || '';
  document.getElementById('cardOugi').value       = c.ougiId     || '';
  document.querySelector(`input[name="rarity"][value="${c.rarity}"]`).checked       = true;
  document.querySelector(`input[name="attribute"][value="${c.attribute}"]`).checked = true;

  document.getElementById('cardFormTitle').textContent = 'カード編集';
  document.getElementById('cardCancelBtn').hidden = false;
  document.getElementById('cardForm').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function deleteCard(id) {
  const c = Storage.cards.get(id);
  if (!c) return;
  openConfirm(`「${c.cardName}」を削除しますか？`, () => {
    Storage.cards.delete(id);
    /* デッキからも除去（deck は deck.js のグローバル変数） */
    deck = deck.map(d => (d && d.card && d.card.id === id) ? null : d);
    renderCardList();
    refreshGensakuSuggestions();
    refreshWorkSuggestions();
  });
}

/* ----------------------------------------------------------------
   カード保存（共通）
---------------------------------------------------------------- */
function saveCard(data) {
  const ok = Storage.cards.save(data);
  if (!ok) return;            // 未認証 — Storage 側でエラートーストを表示済み
  resetCardForm();
  renderCardList();
  refreshGensakuSuggestions();
  refreshWorkSuggestions();
  showToast('カードを登録しました（Firebase へ保存中...）');
}

/* ----------------------------------------------------------------
   重複確認モーダル
---------------------------------------------------------------- */
let _pendingOverwrite = null;

function openDupModal(existing, newData, reason) {
  document.getElementById('dupModalMsg').textContent = reason;

  function skillName(id) { const s = id ? Storage.skills.get(id) : null; return s ? s.name : '—'; }
  function ougiName(id)  { const o = id ? Storage.ougi.get(id)   : null; return o ? o.name : '—'; }

  function renderDupCard(c) {
    return [
      ['ゲーム内ID',   c.internalId || '—'],
      ['カード名', c.cardName   || '—'],
      ['キャラ',   c.charName   || '—'],
      ['レア度',   c.rarity     || '—'],
      ['原作',     c.gensaku    || '—'],
      ['作品',     c.workName   || '—'],
      ['属性',     c.attribute  || '—'],
      ['脅迫力',   fmt(c.power)],
      ['耐久力',   fmt(c.hp)],
      ['特技',   skillName(c.skillId)],
      ['奥義',     ougiName(c.ougiId)],
    ].map(([k, v]) => `<div class="dup-row"><span class="dup-key">${esc(k)}</span><span class="dup-val">${esc(String(v))}</span></div>`).join('');
  }

  document.getElementById('dupCurrentContent').innerHTML = renderDupCard(existing);
  document.getElementById('dupNewContent').innerHTML     = renderDupCard(newData);

  _pendingOverwrite = { existing, newData };
  dupModal.open();
}

document.getElementById('dupOverwriteBtn').addEventListener('click', () => {
  if (_pendingOverwrite) {
    const { existing, newData } = _pendingOverwrite;
    saveCard({ ...newData, id: existing.id });
    _pendingOverwrite = null;
    dupModal.close();
  }
});

document.getElementById('dupCancelBtn').addEventListener('click', () => {
  _pendingOverwrite = null;
  dupModal.close();
});

/* ----------------------------------------------------------------
   フォーム送信（重複チェック付き）
---------------------------------------------------------------- */
document.getElementById('cardForm').addEventListener('submit', e => {
  e.preventDefault();
  const rarity    = document.querySelector('input[name="rarity"]:checked');
  const attribute = document.querySelector('input[name="attribute"]:checked');
  if (!rarity || !attribute) { alert('レア度と属性は必須です'); return; }

  const editingId = document.getElementById('cardId').value || undefined;

  const newData = {
    id:         editingId,
    internalId: document.getElementById('internalId').value.trim() || undefined,
    cardName:   document.getElementById('cardName').value.trim(),
    charName:   document.getElementById('charName').value.trim(),
    rarity:     rarity.value,
    gensaku:    document.getElementById('gensaku').value.trim() || undefined,
    workName:   document.getElementById('workName').value.trim(),
    attribute:  attribute.value,
    power:      document.getElementById('cardPower').value,
    hp:         document.getElementById('cardHp').value,
    skillId:    document.getElementById('cardSkill').value || undefined,
    ougiId:     document.getElementById('cardOugi').value  || undefined,
  };

  const allCards = Storage.cards.getAll();
  let duplicate = null;
  let dupReason = '';

  /* チェック１: ゲーム内ID重複 */
  if (newData.internalId) {
    duplicate = allCards.find(c => c.internalId === newData.internalId && c.id !== editingId);
    if (duplicate) {
      dupReason = `ゲーム内ID「${newData.internalId}」がすでに登録されています`;
    }
  }

  /* チェック２: カード名＋キャラクター名重複 */
  if (!duplicate) {
    duplicate = allCards.find(c =>
      c.cardName === newData.cardName &&
      c.charName === newData.charName &&
      c.id !== editingId
    );
    if (duplicate) {
      dupReason = `カード名「${newData.cardName}」＋キャラクター「${newData.charName}」がすでに登録されています`;
    }
  }

  if (duplicate) {
    openDupModal(duplicate, newData, dupReason);
    return;
  }

  saveCard(newData);
});

document.getElementById('cardCancelBtn').addEventListener('click', resetCardForm);
