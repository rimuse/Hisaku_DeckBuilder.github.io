/* ===== Navigation ===== */
const allNavBtns = document.querySelectorAll('.nav-btn');
const allPages = document.querySelectorAll('.page');

function showPage(pageId) {
  allPages.forEach(p => p.classList.toggle('active', p.id === 'page-' + pageId));
  allNavBtns.forEach(b => b.classList.toggle('active', b.dataset.page === pageId));
  if (pageId === 'deck') renderDeckPage();
  if (pageId === 'cards') renderCardPage();
  if (pageId === 'skills') renderSkillsPage();
}

allNavBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    showPage(btn.dataset.page);
    document.getElementById('navMobile').classList.remove('open');
  });
});

document.getElementById('hamburger').addEventListener('click', () => {
  document.getElementById('navMobile').classList.toggle('open');
});

/* ===== Helpers ===== */
function rarityClass(r) { return 'rarity-' + r; }
function attrClass(a) { return 'attr-' + a; }

function escHtml(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ===== Modal ===== */
const modalOverlay = document.getElementById('modalOverlay');
const modalContent = document.getElementById('modalContent');

function openModal(html) {
  modalContent.innerHTML = html;
  modalOverlay.classList.add('open');
}
function closeModal() { modalOverlay.classList.remove('open'); }

document.getElementById('modalClose').addEventListener('click', closeModal);
modalOverlay.addEventListener('click', e => { if (e.target === modalOverlay) closeModal(); });

/* ===== Confirm Modal ===== */
const confirmOverlay = document.getElementById('confirmOverlay');
let _confirmCb = null;

function openConfirm(msg, cb) {
  document.getElementById('confirmMessage').textContent = msg;
  _confirmCb = cb;
  confirmOverlay.classList.add('open');
}
function closeConfirm() { confirmOverlay.classList.remove('open'); _confirmCb = null; }

document.getElementById('confirmYes').addEventListener('click', () => { if (_confirmCb) _confirmCb(); closeConfirm(); });
document.getElementById('confirmNo').addEventListener('click', closeConfirm);
confirmOverlay.addEventListener('click', e => { if (e.target === confirmOverlay) closeConfirm(); });

/* ===========================
   DECK PAGE
   =========================== */
let deck = [null, null, null, null, null]; // 5 slots

function renderDeckPage() {
  renderDeckSlots();
  renderCardGrid();
  renderDeckStats();
  updateWorkFilter();
}

function renderDeckSlots() {
  const container = document.getElementById('deckCards');
  container.innerHTML = '';
  deck.forEach((card, i) => {
    const slot = document.createElement('div');
    slot.className = 'deck-slot' + (card ? '' : ' empty');
    slot.dataset.slot = i;
    if (card) {
      slot.innerHTML = `
        <span class="slot-rarity ${rarityClass(card.rarity)}">${escHtml(card.rarity)}</span>
        <div class="slot-info">
          <div class="slot-card-name">${escHtml(card.cardName)}</div>
          <div class="slot-char-name">${escHtml(card.charName)}${card.workName ? ' / ' + escHtml(card.workName) : ''}</div>
        </div>
        <button class="slot-remove" data-slot="${i}" title="取り外す">&times;</button>`;
    } else {
      slot.textContent = 'スロット ' + (i + 1);
    }
    container.appendChild(slot);
  });
  container.querySelectorAll('.slot-remove').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      deck[+btn.dataset.slot] = null;
      renderDeckSlots();
      renderCardGrid();
      renderDeckStats();
    });
  });
}

function renderDeckStats() {
  const cards = deck.filter(Boolean);
  const statsEl = document.getElementById('deckStats');
  const previewEl = document.getElementById('deckSkillPreview');

  if (!cards.length) {
    statsEl.innerHTML = '<div class="empty-state">カードを選択してください</div>';
    previewEl.innerHTML = '';
    return;
  }

  const totalPower = cards.reduce((s, c) => s + (+c.power || 0), 0);
  const totalHp = cards.reduce((s, c) => s + (+c.hp || 0), 0);
  const attrCount = {};
  cards.forEach(c => { attrCount[c.attribute] = (attrCount[c.attribute] || 0) + 1; });
  const attrStr = Object.entries(attrCount).map(([k, v]) => `${k}×${v}`).join(' / ');

  statsEl.innerHTML = `
    <div class="stat-row"><span class="stat-label">カード枚数</span><span class="stat-value">${cards.length} / 5</span></div>
    <div class="stat-row"><span class="stat-label">総脅迫力</span><span class="stat-value">${totalPower.toLocaleString()}</span></div>
    <div class="stat-row"><span class="stat-label">総耐久力</span><span class="stat-value">${totalHp.toLocaleString()}</span></div>
    <div class="stat-row"><span class="stat-label">属性内訳</span><span class="stat-value">${attrStr || '—'}</span></div>`;

  // Skill preview
  const allSkills = Storage.skills.getAll();
  const cardSkillIds = [...new Set(cards.map(c => c.skillId).filter(Boolean))];
  const activeSkills = allSkills.filter(s => cardSkillIds.includes(s.id));

  if (!activeSkills.length) {
    previewEl.innerHTML = '<h4>スキル発動状況</h4><div class="empty-state" style="padding:0.5rem">スキルなし</div>';
    return;
  }

  let html = '<h4>スキル発動状況</h4>';
  activeSkills.forEach(skill => {
    const matching = cards.filter(c => {
      if (!skill.conditions || !skill.conditions.length) return true;
      return skill.conditions.some(cond => {
        if (cond.type === 'character') return c.charName === cond.value;
        if (cond.type === 'work') return c.workName === cond.value;
        if (cond.type === 'attribute') return c.attribute === cond.value;
        return false;
      });
    });
    const names = matching.map(c => escHtml(c.cardName)).join(', ');
    html += `<div class="skill-preview-item">
      <div class="sp-name">${escHtml(skill.name)}</div>
      <div class="sp-cards">対象: ${names || 'なし'}</div>
      ${skill.effect ? `<div class="sp-effect">${escHtml(skill.effect)}</div>` : ''}
    </div>`;
  });
  previewEl.innerHTML = html;
}

function renderCardGrid() {
  const grid = document.getElementById('cardGrid');
  const filterText = (document.getElementById('filterText').value || '').toLowerCase();
  const filterRarity = document.getElementById('filterRarity').value;
  const filterAttribute = document.getElementById('filterAttribute').value;
  const filterWork = document.getElementById('filterWork').value;

  let cards = Storage.cards.getAll();
  if (filterText) cards = cards.filter(c =>
    c.cardName.toLowerCase().includes(filterText) || c.charName.toLowerCase().includes(filterText));
  if (filterRarity) cards = cards.filter(c => c.rarity === filterRarity);
  if (filterAttribute) cards = cards.filter(c => c.attribute === filterAttribute);
  if (filterWork) cards = cards.filter(c => c.workName === filterWork);

  if (!cards.length) {
    grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1">カードが登録されていません</div>';
    return;
  }

  const deckIds = new Set(deck.filter(Boolean).map(c => c.id));

  grid.innerHTML = cards.map(c => `
    <div class="card-item${deckIds.has(c.id) ? ' in-deck' : ''}" data-id="${c.id}">
      <div class="card-rarity ${rarityClass(c.rarity)}">${escHtml(c.rarity)}</div>
      <div class="card-name">${escHtml(c.cardName)}</div>
      <div class="card-char">${escHtml(c.charName)}</div>
      <div class="card-attr ${attrClass(c.attribute)}">${escHtml(c.attribute)}</div>
      <div class="card-stats">
        <span>脅:${(+c.power||0).toLocaleString()}</span>
        <span>耐:${(+c.hp||0).toLocaleString()}</span>
      </div>
    </div>`).join('');

  grid.querySelectorAll('.card-item:not(.in-deck)').forEach(el => {
    el.addEventListener('click', () => {
      const card = Storage.cards.get(el.dataset.id);
      if (!card) return;
      const emptySlot = deck.findIndex(s => s === null);
      if (emptySlot === -1) { alert('デッキが満杯です（5枚まで）'); return; }
      deck[emptySlot] = card;
      renderDeckSlots();
      renderCardGrid();
      renderDeckStats();
    });
  });

  grid.querySelectorAll('.card-item').forEach(el => {
    el.addEventListener('dblclick', () => {
      const card = Storage.cards.get(el.dataset.id);
      if (card) openCardDetail(card);
    });
  });
}

function updateWorkFilter() {
  const cards = Storage.cards.getAll();
  const works = [...new Set(cards.map(c => c.workName).filter(Boolean))].sort();
  const sel = document.getElementById('filterWork');
  const cur = sel.value;
  sel.innerHTML = '<option value="">作品：全て</option>' + works.map(w => `<option value="${escHtml(w)}">${escHtml(w)}</option>`).join('');
  if (works.includes(cur)) sel.value = cur;
}

['filterText','filterRarity','filterAttribute','filterWork'].forEach(id => {
  document.getElementById(id).addEventListener('input', renderCardGrid);
  document.getElementById(id).addEventListener('change', renderCardGrid);
});

document.getElementById('clearDeck').addEventListener('click', () => {
  if (deck.every(s => s === null)) return;
  openConfirm('デッキをクリアしますか？', () => {
    deck = [null,null,null,null,null];
    renderDeckSlots();
    renderCardGrid();
    renderDeckStats();
  });
});

function openCardDetail(card) {
  const allSkills = Storage.skills.getAll();
  const allOugi = Storage.ougi.getAll();
  const skill = card.skillId ? allSkills.find(s => s.id === card.skillId) : null;
  const ougi = card.ougiId ? allOugi.find(o => o.id === card.ougiId) : null;

  openModal(`<div class="modal-card-detail">
    <div class="detail-header">
      <span class="card-rarity ${rarityClass(card.rarity)}">${escHtml(card.rarity)}</span>
      <div class="detail-title">${escHtml(card.cardName)}</div>
    </div>
    <div class="detail-row"><span class="detail-label">キャラクター</span><span>${escHtml(card.charName)}</span></div>
    <div class="detail-row"><span class="detail-label">作品</span><span>${escHtml(card.workName || '—')}</span></div>
    <div class="detail-row"><span class="detail-label">属性</span><span class="card-attr ${attrClass(card.attribute)}">${escHtml(card.attribute)}</span></div>
    <div class="detail-row"><span class="detail-label">脅迫力</span><span>${(+card.power||0).toLocaleString()}</span></div>
    <div class="detail-row"><span class="detail-label">耐久力</span><span>${(+card.hp||0).toLocaleString()}</span></div>
    <div class="detail-row"><span class="detail-label">スキル</span><span>${skill ? escHtml(skill.name) : '—'}</span></div>
    <div class="detail-row"><span class="detail-label">奥義</span><span>${ougi ? escHtml(ougi.name) : '—'}</span></div>
  </div>`);
}

/* ===========================
   CARD PAGE
   =========================== */
let editingCardId = null;

function renderCardPage() {
  populateSkillOugiSelects();
  updateWorkDatalist();
  renderCardList();
  resetCardForm();
}

function populateSkillOugiSelects() {
  const skillSel = document.getElementById('cardSkill');
  const ougiSel = document.getElementById('cardOugi');
  const skills = Storage.skills.getAll();
  const ougiList = Storage.ougi.getAll();

  skillSel.innerHTML = '<option value="">なし</option>' + skills.map(s =>
    `<option value="${s.id}">${escHtml(s.name)}</option>`).join('');
  ougiSel.innerHTML = '<option value="">なし</option>' + ougiList.map(o =>
    `<option value="${o.id}">${escHtml(o.name)}</option>`).join('');
}

function updateWorkDatalist() {
  const cards = Storage.cards.getAll();
  const works = [...new Set(cards.map(c => c.workName).filter(Boolean))].sort();
  document.getElementById('workList').innerHTML = works.map(w => `<option value="${escHtml(w)}">`).join('');
}

function renderCardList() {
  const filter = (document.getElementById('cardListFilter').value || '').toLowerCase();
  let cards = Storage.cards.getAll();
  if (filter) cards = cards.filter(c =>
    c.cardName.toLowerCase().includes(filter) || c.charName.toLowerCase().includes(filter));

  const el = document.getElementById('cardList');
  if (!cards.length) {
    el.innerHTML = '<div class="empty-state">登録されたカードはありません</div>';
    return;
  }
  el.innerHTML = cards.map(c => `
    <div class="list-item" data-id="${c.id}">
      <div class="list-item-info">
        <div class="list-item-name">
          <span class="card-rarity ${rarityClass(c.rarity)}" style="margin-right:0.4rem">${escHtml(c.rarity)}</span>
          ${escHtml(c.cardName)}
        </div>
        <div class="list-item-sub">${escHtml(c.charName)}${c.workName ? ' / ' + escHtml(c.workName) : ''} | ${escHtml(c.attribute)}</div>
      </div>
      <div class="list-item-actions">
        <button class="icon-btn edit-card" data-id="${c.id}">編集</button>
        <button class="icon-btn del del-card" data-id="${c.id}">削除</button>
      </div>
    </div>`).join('');

  el.querySelectorAll('.edit-card').forEach(btn => {
    btn.addEventListener('click', () => loadCardForEdit(btn.dataset.id));
  });
  el.querySelectorAll('.del-card').forEach(btn => {
    btn.addEventListener('click', () => {
      const card = Storage.cards.get(btn.dataset.id);
      if (!card) return;
      openConfirm(`「${card.cardName}」を削除しますか？`, () => {
        Storage.cards.delete(card.id);
        deck = deck.map(d => (d && d.id === card.id) ? null : d);
        renderCardList();
        updateWorkDatalist();
      });
    });
  });
}

function loadCardForEdit(id) {
  const card = Storage.cards.get(id);
  if (!card) return;
  editingCardId = id;
  document.getElementById('cardFormTitle').textContent = 'カードを編集';
  document.getElementById('cardId').value = card.id;
  document.getElementById('cardName').value = card.cardName;
  document.getElementById('charName').value = card.charName;
  document.querySelector(`input[name="rarity"][value="${card.rarity}"]`).checked = true;
  document.getElementById('workName').value = card.workName || '';
  document.querySelector(`input[name="attribute"][value="${card.attribute}"]`).checked = true;
  document.getElementById('power').value = card.power || '';
  document.getElementById('hp').value = card.hp || '';
  document.getElementById('cardSkill').value = card.skillId || '';
  document.getElementById('cardOugi').value = card.ougiId || '';
  document.getElementById('cardSubmitBtn').textContent = '更新する';
  document.getElementById('cardCancelBtn').style.display = 'inline-block';
  document.getElementById('cardForm').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function resetCardForm() {
  editingCardId = null;
  document.getElementById('cardFormTitle').textContent = '新規カード登録';
  document.getElementById('cardForm').reset();
  document.getElementById('cardId').value = '';
  document.getElementById('cardSubmitBtn').textContent = '登録する';
  document.getElementById('cardCancelBtn').style.display = 'none';
}

document.getElementById('cardCancelBtn').addEventListener('click', resetCardForm);
document.getElementById('cardListFilter').addEventListener('input', renderCardList);

document.getElementById('cardForm').addEventListener('submit', e => {
  e.preventDefault();
  const rarity = document.querySelector('input[name="rarity"]:checked');
  const attribute = document.querySelector('input[name="attribute"]:checked');
  if (!rarity || !attribute) { alert('レア度と属性を選択してください'); return; }

  const card = {
    id: document.getElementById('cardId').value || undefined,
    cardName: document.getElementById('cardName').value.trim(),
    charName: document.getElementById('charName').value.trim(),
    rarity: rarity.value,
    workName: document.getElementById('workName').value.trim(),
    attribute: attribute.value,
    power: document.getElementById('power').value,
    hp: document.getElementById('hp').value,
    skillId: document.getElementById('cardSkill').value || null,
    ougiId: document.getElementById('cardOugi').value || null,
  };

  Storage.cards.save(card);
  resetCardForm();
  renderCardList();
  updateWorkDatalist();
  populateSkillOugiSelects();
});

/* ===========================
   SKILLS PAGE
   =========================== */
let editingSkillId = null;
let skillConditions = [];
let activeCondTab = 'character';

let editingOugiId = null;

function renderSkillsPage() {
  updateCondDatalist();
  renderSkillList();
  renderOugiList();
}

function updateCondDatalist() {
  const cards = Storage.cards.getAll();
  const chars = [...new Set(cards.map(c => c.charName).filter(Boolean))].sort();
  const works = [...new Set(cards.map(c => c.workName).filter(Boolean))].sort();
  document.getElementById('condCharList').innerHTML = chars.map(c => `<option value="${escHtml(c)}">`).join('');
  document.getElementById('condWorkList').innerHTML = works.map(w => `<option value="${escHtml(w)}">`).join('');
}

// Condition tabs
document.querySelectorAll('.cond-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    activeCondTab = tab.dataset.type;
    document.querySelectorAll('.cond-tab').forEach(t => t.classList.toggle('active', t === tab));
    document.querySelectorAll('.cond-panel').forEach(p => p.classList.toggle('active', p.dataset.type === activeCondTab));
  });
});

function renderConditions() {
  const el = document.getElementById('conditionsDisplay');
  if (!skillConditions.length) {
    el.innerHTML = '<span class="no-cond">条件なし（全カードに効果）</span>';
    return;
  }
  el.innerHTML = skillConditions.map((cond, i) => {
    const label = cond.type === 'character' ? 'キャラ' : cond.type === 'work' ? '作品' : '属性';
    return `<span class="cond-tag">${label}: ${escHtml(cond.value)}<button data-idx="${i}">&times;</button></span>`;
  }).join('');
  el.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
      skillConditions.splice(+btn.dataset.idx, 1);
      renderConditions();
    });
  });
}

function addCondition(type, value) {
  if (!value) return;
  if (skillConditions.some(c => c.type === type && c.value === value)) return;
  skillConditions.push({ type, value });
  renderConditions();
}

document.getElementById('addCondChar').addEventListener('click', () => {
  addCondition('character', document.getElementById('condCharInput').value.trim());
  document.getElementById('condCharInput').value = '';
});
document.getElementById('addCondWork').addEventListener('click', () => {
  addCondition('work', document.getElementById('condWorkInput').value.trim());
  document.getElementById('condWorkInput').value = '';
});
document.querySelectorAll('.cond-attr').forEach(cb => {
  cb.addEventListener('change', () => {
    if (cb.checked) addCondition('attribute', cb.value);
    else {
      skillConditions = skillConditions.filter(c => !(c.type === 'attribute' && c.value === cb.value));
      renderConditions();
    }
  });
});

// Enter key in condition inputs
['condCharInput','condWorkInput'].forEach(id => {
  document.getElementById(id).addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); document.getElementById(id === 'condCharInput' ? 'addCondChar' : 'addCondWork').click(); }
  });
});

function renderSkillList() {
  const skills = Storage.skills.getAll();
  const el = document.getElementById('skillList');
  if (!skills.length) {
    el.innerHTML = '<div class="empty-state">登録されたスキルはありません</div>';
    return;
  }
  el.innerHTML = skills.map(s => `
    <div class="list-item" data-id="${s.id}">
      <div class="list-item-info">
        <div class="list-item-name">${escHtml(s.name)}</div>
        <div class="list-item-sub">${s.conditions && s.conditions.length ? s.conditions.map(c => c.value).join(', ') : '条件なし'}</div>
      </div>
      <div class="list-item-actions">
        <button class="icon-btn edit-skill" data-id="${s.id}">編集</button>
        <button class="icon-btn del del-skill" data-id="${s.id}">削除</button>
      </div>
    </div>`).join('');

  el.querySelectorAll('.edit-skill').forEach(btn => btn.addEventListener('click', () => loadSkillForEdit(btn.dataset.id)));
  el.querySelectorAll('.del-skill').forEach(btn => {
    btn.addEventListener('click', () => {
      const s = Storage.skills.get(btn.dataset.id);
      if (!s) return;
      openConfirm(`「${s.name}」を削除しますか？`, () => {
        Storage.skills.delete(s.id);
        renderSkillList();
      });
    });
  });
}

function loadSkillForEdit(id) {
  const skill = Storage.skills.get(id);
  if (!skill) return;
  editingSkillId = id;
  document.getElementById('skillFormTitle').textContent = 'スキルを編集';
  document.getElementById('skillId').value = skill.id;
  document.getElementById('skillName').value = skill.name;
  document.getElementById('skillEffect').value = skill.effect || '';
  skillConditions = skill.conditions ? [...skill.conditions] : [];
  // Restore attribute checkboxes
  document.querySelectorAll('.cond-attr').forEach(cb => {
    cb.checked = skillConditions.some(c => c.type === 'attribute' && c.value === cb.value);
  });
  renderConditions();
  document.getElementById('skillCancelBtn').style.display = 'inline-block';
  document.getElementById('skillForm').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function resetSkillForm() {
  editingSkillId = null;
  document.getElementById('skillFormTitle').textContent = '新規スキル登録';
  document.getElementById('skillForm').reset();
  document.getElementById('skillId').value = '';
  skillConditions = [];
  document.querySelectorAll('.cond-attr').forEach(cb => cb.checked = false);
  renderConditions();
  document.getElementById('skillCancelBtn').style.display = 'none';
}

document.getElementById('skillCancelBtn').addEventListener('click', resetSkillForm);

document.getElementById('skillForm').addEventListener('submit', e => {
  e.preventDefault();
  const skill = {
    id: document.getElementById('skillId').value || undefined,
    name: document.getElementById('skillName').value.trim(),
    effect: document.getElementById('skillEffect').value.trim(),
    conditions: [...skillConditions],
  };
  Storage.skills.save(skill);
  resetSkillForm();
  renderSkillList();
  // Update card page dropdowns if visible
  populateSkillOugiSelects();
});

/* Ougi */
function renderOugiList() {
  const list = Storage.ougi.getAll();
  const el = document.getElementById('ougiList');
  if (!list.length) {
    el.innerHTML = '<div class="empty-state">登録された奥義はありません</div>';
    return;
  }
  el.innerHTML = list.map(o => `
    <div class="list-item" data-id="${o.id}">
      <div class="list-item-info">
        <div class="list-item-name">${escHtml(o.name)}</div>
        ${o.desc ? `<div class="list-item-sub">${escHtml(o.desc)}</div>` : ''}
      </div>
      <div class="list-item-actions">
        <button class="icon-btn edit-ougi" data-id="${o.id}">編集</button>
        <button class="icon-btn del del-ougi" data-id="${o.id}">削除</button>
      </div>
    </div>`).join('');

  el.querySelectorAll('.edit-ougi').forEach(btn => btn.addEventListener('click', () => loadOugiForEdit(btn.dataset.id)));
  el.querySelectorAll('.del-ougi').forEach(btn => {
    btn.addEventListener('click', () => {
      const o = Storage.ougi.get(btn.dataset.id);
      if (!o) return;
      openConfirm(`「${o.name}」を削除しますか？`, () => {
        Storage.ougi.delete(o.id);
        renderOugiList();
      });
    });
  });
}

function loadOugiForEdit(id) {
  const o = Storage.ougi.get(id);
  if (!o) return;
  editingOugiId = id;
  document.getElementById('ougiFormTitle').textContent = '奥義を編集';
  document.getElementById('ougiId').value = o.id;
  document.getElementById('ougiName').value = o.name;
  document.getElementById('ougiDesc').value = o.desc || '';
  document.getElementById('ougiCancelBtn').style.display = 'inline-block';
  document.getElementById('ougiForm').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function resetOugiForm() {
  editingOugiId = null;
  document.getElementById('ougiFormTitle').textContent = '新規奥義登録';
  document.getElementById('ougiForm').reset();
  document.getElementById('ougiId').value = '';
  document.getElementById('ougiCancelBtn').style.display = 'none';
}

document.getElementById('ougiCancelBtn').addEventListener('click', resetOugiForm);

document.getElementById('ougiForm').addEventListener('submit', e => {
  e.preventDefault();
  const item = {
    id: document.getElementById('ougiId').value || undefined,
    name: document.getElementById('ougiName').value.trim(),
    desc: document.getElementById('ougiDesc').value.trim(),
  };
  Storage.ougi.save(item);
  resetOugiForm();
  renderOugiList();
  populateSkillOugiSelects();
});

/* ===== Init ===== */
showPage('deck');
