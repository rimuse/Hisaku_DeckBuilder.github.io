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

function fmtNum(n) { return (+n || 0).toLocaleString(); }

function condLabel(type) {
  if (type === 'character') return 'キャラ';
  if (type === 'work') return '作品';
  if (type === 'attribute') return '属性';
  return type;
}
function targetLabel(target) {
  if (!target || target.type === 'all') return '全体';
  return condLabel(target.type) + ': ' + (target.value || '');
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
let deck = [null, null, null, null, null];

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
      const lv = card.lv ? ` Lv.${card.lv}` : '';
      slot.innerHTML = `
        <span class="slot-rarity ${rarityClass(card.rarity)}">${escHtml(card.rarity)}</span>
        <div class="slot-info">
          <div class="slot-card-name">${escHtml(card.cardName)}</div>
          <div class="slot-char-name">${escHtml(card.charName)}${card.workName ? ' / ' + escHtml(card.workName) : ''}${lv}</div>
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

/* ===== Skill Activation Logic ===== */
function calcSkillActivation(deckCards) {
  const allSkills = Storage.skills.getAll();
  const deckSkillIds = [...new Set(deckCards.map(c => c.skillId).filter(Boolean))];
  const deckSkills = allSkills.filter(s => deckSkillIds.includes(s.id));

  return deckSkills.map(skill => {
    // Check all conditions (AND logic)
    const conditions = skill.conditions || [];
    const conditionsMet = conditions.length === 0 || conditions.every(cond => {
      const count = deckCards.filter(c => {
        if (cond.type === 'character') return c.charName === cond.value;
        if (cond.type === 'work') return c.workName === cond.value;
        if (cond.type === 'attribute') return c.attribute === cond.value;
        return false;
      }).length;
      return count >= (cond.minCount || 1);
    });

    // Find target cards
    const target = skill.target || { type: 'all' };
    const targetCards = conditionsMet ? deckCards.filter(c => {
      if (!target || target.type === 'all') return true;
      if (target.type === 'character') return c.charName === target.value;
      if (target.type === 'work') return c.workName === target.value;
      if (target.type === 'attribute') return c.attribute === target.value;
      return false;
    }) : [];

    const threatPct = +(skill.threatPct || 0);
    const endurancePct = +(skill.endurancePct || 0);
    const threatBuff = Math.round(targetCards.reduce((s, c) => s + (+c.power || 0) * threatPct / 100, 0));
    const enduranceBuff = Math.round(targetCards.reduce((s, c) => s + (+c.hp || 0) * endurancePct / 100, 0));

    return { skill, conditionsMet, targetCards, threatBuff, enduranceBuff };
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

  const baseThreat = cards.reduce((s, c) => s + (+c.power || 0), 0);
  const baseHp = cards.reduce((s, c) => s + (+c.hp || 0), 0);
  const attrCount = {};
  cards.forEach(c => { attrCount[c.attribute] = (attrCount[c.attribute] || 0) + 1; });
  const attrStr = Object.entries(attrCount).map(([k, v]) => `${k}×${v}`).join(' / ');

  const activations = calcSkillActivation(cards);
  const totalThreatBuff = activations.filter(a => a.conditionsMet).reduce((s, a) => s + a.threatBuff, 0);
  const totalHpBuff = activations.filter(a => a.conditionsMet).reduce((s, a) => s + a.enduranceBuff, 0);
  const totalThreat = baseThreat + totalThreatBuff;
  const totalHp = baseHp + totalHpBuff;

  const thrBuff = totalThreatBuff > 0 ? `<span class="stat-value-buff">(+${fmtNum(totalThreatBuff)})</span>` : '';
  const hpBuff = totalHpBuff > 0 ? `<span class="stat-value-buff">(+${fmtNum(totalHpBuff)})</span>` : '';

  statsEl.innerHTML = `
    <div class="stat-row"><span class="stat-label">カード枚数</span><span class="stat-value">${cards.length} / 5</span></div>
    <div class="stat-row"><span class="stat-label">総脅迫力</span><span class="stat-value">${fmtNum(totalThreat)}${thrBuff}</span></div>
    <div class="stat-row"><span class="stat-label">総耐久力</span><span class="stat-value">${fmtNum(totalHp)}${hpBuff}</span></div>
    <div class="stat-row"><span class="stat-label">属性内訳</span><span class="stat-value">${attrStr || '—'}</span></div>`;

  // Skill preview
  if (!activations.length) {
    previewEl.innerHTML = '<h4>スキル発動状況</h4><div class="empty-state" style="padding:0.5rem">スキルなし</div>';
    return;
  }

  let html = '<h4>スキル発動状況</h4>';
  activations.forEach(({ skill, conditionsMet, targetCards, threatBuff, enduranceBuff }) => {
    const statusBadge = conditionsMet
      ? '<span class="sp-status-badge on">発動中</span>'
      : '<span class="sp-status-badge off">未発動</span>';

    const effectParts = [];
    if (skill.threatPct) effectParts.push(`脅迫力+${skill.threatPct}%`);
    if (skill.endurancePct) effectParts.push(`耐久力+${skill.endurancePct}%`);
    const effectStr = effectParts.join(' / ') || '—';

    const buffNums = conditionsMet
      ? `<div class="sp-effect-nums">+${fmtNum(threatBuff)} / +${fmtNum(enduranceBuff)}</div>`
      : '';

    const condDetail = skill.conditions && skill.conditions.length
      ? '<div class="sp-cond-detail">条件: ' + skill.conditions.map(c =>
          escHtml(`${condLabel(c.type)}:${c.value} ≥${c.minCount || 1}枚`)).join(' AND ') + '</div>'
      : '<div class="sp-cond-detail">条件なし（常時発動）</div>';

    const targetInfo = conditionsMet
      ? `<div class="sp-target-info">対象: ${escHtml(targetLabel(skill.target))}（${targetCards.length}枚）</div>`
      : '';

    html += `<div class="skill-preview-item ${conditionsMet ? 'active' : 'inactive'}">
      <div class="sp-name">${escHtml(skill.name)}${statusBadge}</div>
      ${condDetail}
      <div class="sp-effect">${escHtml(effectStr)}</div>
      ${targetInfo}
      ${buffNums}
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
        ${c.lv ? `<span>Lv.${c.lv}</span>` : ''}
        <span>脅:${fmtNum(c.power)}</span>
        <span>耐:${fmtNum(c.hp)}</span>
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

  let skillText = '—';
  if (skill) {
    const effectParts = [];
    if (skill.threatPct) effectParts.push(`脅迫力+${skill.threatPct}%`);
    if (skill.endurancePct) effectParts.push(`耐久力+${skill.endurancePct}%`);
    skillText = escHtml(skill.name) + (effectParts.length ? ` (${effectParts.join(' / ')})` : '');
  }

  openModal(`<div class="modal-card-detail">
    <div class="detail-header">
      <span class="card-rarity ${rarityClass(card.rarity)}">${escHtml(card.rarity)}</span>
      <div class="detail-title">${escHtml(card.cardName)}</div>
    </div>
    <div class="detail-row"><span class="detail-label">キャラクター</span><span>${escHtml(card.charName)}</span></div>
    <div class="detail-row"><span class="detail-label">作品</span><span>${escHtml(card.workName || '—')}</span></div>
    <div class="detail-row"><span class="detail-label">属性</span><span class="card-attr ${attrClass(card.attribute)}">${escHtml(card.attribute)}</span></div>
    <div class="detail-row"><span class="detail-label">Lv</span><span>${escHtml(card.lv || '—')}</span></div>
    <div class="detail-row"><span class="detail-label">脅迫力</span><span>${fmtNum(card.power)}</span></div>
    <div class="detail-row"><span class="detail-label">耐久力</span><span>${fmtNum(card.hp)}</span></div>
    <div class="detail-row"><span class="detail-label">スキル</span><span>${skillText}</span></div>
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

  skillSel.innerHTML = '<option value="">なし</option>' + skills.map(s => {
    const parts = [];
    if (s.threatPct) parts.push(`脅+${s.threatPct}%`);
    if (s.endurancePct) parts.push(`耐+${s.endurancePct}%`);
    const suffix = parts.length ? ` [${parts.join('/')}]` : '';
    return `<option value="${s.id}">${escHtml(s.name)}${suffix}</option>`;
  }).join('');
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
        <div class="list-item-sub">${escHtml(c.charName)}${c.workName ? ' / ' + escHtml(c.workName) : ''} | ${escHtml(c.attribute)}${c.lv ? ' | Lv.' + c.lv : ''}</div>
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
  const rarityInput = document.querySelector(`input[name="rarity"][value="${card.rarity}"]`);
  if (rarityInput) rarityInput.checked = true;
  document.getElementById('workName').value = card.workName || '';
  const attrInput = document.querySelector(`input[name="attribute"][value="${card.attribute}"]`);
  if (attrInput) attrInput.checked = true;
  document.getElementById('cardLv').value = card.lv || '';
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
    lv: document.getElementById('cardLv').value,
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
let editingOugiId = null;

function renderSkillsPage() {
  updateCondDatalist();
  updateTargetDatalist();
  renderSkillList();
  renderOugiList();
  renderConditions();
}

/* --- Condition type/value area --- */
function updateCondDatalist() {
  const cards = Storage.cards.getAll();
  const chars = [...new Set(cards.map(c => c.charName).filter(Boolean))].sort();
  const works = [...new Set(cards.map(c => c.workName).filter(Boolean))].sort();
  // Will be used when condType changes
  window._condChars = chars;
  window._condWorks = works;
  refreshCondValueArea();
}

function refreshCondValueArea() {
  const type = document.getElementById('condType').value;
  const wrap = document.getElementById('condValueWrap');
  if (type === 'character') {
    wrap.innerHTML = `<input type="text" id="condValueText" placeholder="キャラクター名" list="condCharList" autocomplete="off" class="cond-value-input">
      <datalist id="condCharList">${(window._condChars||[]).map(c=>`<option value="${escHtml(c)}">`).join('')}</datalist>`;
  } else if (type === 'work') {
    wrap.innerHTML = `<input type="text" id="condValueText" placeholder="作品名" list="condWorkList" autocomplete="off" class="cond-value-input">
      <datalist id="condWorkList">${(window._condWorks||[]).map(w=>`<option value="${escHtml(w)}">`).join('')}</datalist>`;
  } else {
    wrap.innerHTML = `<select id="condValueText" class="cond-value-select">
      <option value="親愛">親愛</option>
      <option value="調教">調教</option>
      <option value="従順">従順</option>
    </select>`;
  }
}

document.getElementById('condType').addEventListener('change', refreshCondValueArea);

/* --- Add condition --- */
document.getElementById('addCond').addEventListener('click', () => {
  const type = document.getElementById('condType').value;
  const valueEl = document.getElementById('condValueText');
  const value = valueEl ? valueEl.value.trim() : '';
  const minCount = parseInt(document.getElementById('condMinCount').value) || 1;

  if (!value) { alert('値を入力してください'); return; }
  if (skillConditions.some(c => c.type === type && c.value === value)) {
    // Update minCount if same cond exists
    const existing = skillConditions.find(c => c.type === type && c.value === value);
    existing.minCount = minCount;
    renderConditions();
    return;
  }
  skillConditions.push({ type, value, minCount });
  renderConditions();
  if (valueEl && valueEl.tagName !== 'SELECT') valueEl.value = '';
});

// Enter key in condition value input
document.getElementById('condValueWrap').addEventListener('keydown', e => {
  if (e.key === 'Enter') { e.preventDefault(); document.getElementById('addCond').click(); }
});

function renderConditions() {
  const el = document.getElementById('conditionsDisplay');
  if (!skillConditions.length) {
    el.innerHTML = '<span class="no-cond">条件なし（常時発動）</span>';
    return;
  }
  el.innerHTML = skillConditions.map((cond, i) => {
    return `<span class="cond-tag">${condLabel(cond.type)}: ${escHtml(cond.value)} ≥${cond.minCount || 1}枚<button data-idx="${i}">&times;</button></span>`;
  }).join('');
  el.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
      skillConditions.splice(+btn.dataset.idx, 1);
      renderConditions();
    });
  });
}

/* --- Target type/value area --- */
function updateTargetDatalist() {
  const cards = Storage.cards.getAll();
  window._targetChars = [...new Set(cards.map(c => c.charName).filter(Boolean))].sort();
  window._targetWorks = [...new Set(cards.map(c => c.workName).filter(Boolean))].sort();
}

function refreshTargetValueArea() {
  const type = document.querySelector('input[name="targetType"]:checked').value;
  const wrap = document.getElementById('targetValueWrap');
  if (type === 'all') {
    wrap.style.display = 'none';
    wrap.innerHTML = '';
    return;
  }
  wrap.style.display = 'block';
  if (type === 'character') {
    wrap.innerHTML = `<input type="text" id="targetValue" placeholder="キャラクター名" list="targetCharList" autocomplete="off">
      <datalist id="targetCharList">${(window._targetChars||[]).map(c=>`<option value="${escHtml(c)}">`).join('')}</datalist>`;
  } else if (type === 'work') {
    wrap.innerHTML = `<input type="text" id="targetValue" placeholder="作品名" list="targetWorkList" autocomplete="off">
      <datalist id="targetWorkList">${(window._targetWorks||[]).map(w=>`<option value="${escHtml(w)}">`).join('')}</datalist>`;
  } else {
    wrap.innerHTML = `<select id="targetValue">
      <option value="親愛">親愛</option>
      <option value="調教">調教</option>
      <option value="従順">従順</option>
    </select>`;
  }
}

document.querySelectorAll('input[name="targetType"]').forEach(radio => {
  radio.addEventListener('change', refreshTargetValueArea);
});

/* --- Skill form submit --- */
function resetSkillForm() {
  editingSkillId = null;
  document.getElementById('skillFormTitle').textContent = '新規スキル登録';
  document.getElementById('skillForm').reset();
  document.getElementById('skillId').value = '';
  skillConditions = [];
  renderConditions();
  refreshCondValueArea();
  const allRadio = document.querySelector('input[name="targetType"][value="all"]');
  if (allRadio) { allRadio.checked = true; refreshTargetValueArea(); }
  document.getElementById('effectThreat').value = 0;
  document.getElementById('effectEndurance').value = 0;
  document.getElementById('skillCancelBtn').style.display = 'none';
}

document.getElementById('skillCancelBtn').addEventListener('click', resetSkillForm);

document.getElementById('skillForm').addEventListener('submit', e => {
  e.preventDefault();
  const targetTypeEl = document.querySelector('input[name="targetType"]:checked');
  const targetType = targetTypeEl ? targetTypeEl.value : 'all';
  const targetValueEl = document.getElementById('targetValue');
  const targetValue = targetValueEl ? targetValueEl.value.trim() : '';

  if (targetType !== 'all' && !targetValue) {
    alert('発動対象の値を入力してください');
    return;
  }

  const skill = {
    id: document.getElementById('skillId').value || undefined,
    name: document.getElementById('skillName').value.trim(),
    conditions: [...skillConditions],
    target: { type: targetType, value: targetType !== 'all' ? targetValue : '' },
    threatPct: +(document.getElementById('effectThreat').value) || 0,
    endurancePct: +(document.getElementById('effectEndurance').value) || 0,
  };

  Storage.skills.save(skill);
  resetSkillForm();
  renderSkillList();
  populateSkillOugiSelects();
});

function loadSkillForEdit(id) {
  const skill = Storage.skills.get(id);
  if (!skill) return;
  editingSkillId = id;
  document.getElementById('skillFormTitle').textContent = 'スキルを編集';
  document.getElementById('skillId').value = skill.id;
  document.getElementById('skillName').value = skill.name;
  skillConditions = skill.conditions ? skill.conditions.map(c => ({
    type: c.type,
    value: c.value,
    minCount: c.minCount || 1,
  })) : [];
  renderConditions();

  // Restore target
  const target = skill.target || { type: 'all', value: '' };
  const targetRadio = document.querySelector(`input[name="targetType"][value="${target.type}"]`);
  if (targetRadio) { targetRadio.checked = true; refreshTargetValueArea(); }
  setTimeout(() => {
    const targetValueEl = document.getElementById('targetValue');
    if (targetValueEl && target.value) targetValueEl.value = target.value;
  }, 10);

  document.getElementById('effectThreat').value = skill.threatPct || 0;
  document.getElementById('effectEndurance').value = skill.endurancePct || 0;
  document.getElementById('skillCancelBtn').style.display = 'inline-block';
  document.getElementById('skillForm').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderSkillList() {
  const skills = Storage.skills.getAll();
  const el = document.getElementById('skillList');
  if (!skills.length) {
    el.innerHTML = '<div class="empty-state">登録されたスキルはありません</div>';
    return;
  }
  el.innerHTML = skills.map(s => {
    const condStr = s.conditions && s.conditions.length
      ? s.conditions.map(c => `${condLabel(c.type)}:${c.value} ≥${c.minCount||1}枚`).join(' AND ')
      : '条件なし';
    const effectParts = [];
    if (s.threatPct) effectParts.push(`脅迫力+${s.threatPct}%`);
    if (s.endurancePct) effectParts.push(`耐久力+${s.endurancePct}%`);
    const effectStr = effectParts.join(' / ') || '効果なし';
    const tgtStr = `対象: ${targetLabel(s.target)}`;
    return `
    <div class="list-item" data-id="${s.id}">
      <div class="list-item-info">
        <div class="list-item-name">${escHtml(s.name)}</div>
        <div class="list-item-sub">${escHtml(condStr)}</div>
        <div class="list-item-target">${escHtml(tgtStr)}</div>
        <div class="list-item-effect">${escHtml(effectStr)}</div>
      </div>
      <div class="list-item-actions">
        <button class="icon-btn edit-skill" data-id="${s.id}">編集</button>
        <button class="icon-btn del del-skill" data-id="${s.id}">削除</button>
      </div>
    </div>`;
  }).join('');

  el.querySelectorAll('.edit-skill').forEach(btn => btn.addEventListener('click', () => loadSkillForEdit(btn.dataset.id)));
  el.querySelectorAll('.del-skill').forEach(btn => {
    btn.addEventListener('click', () => {
      const s = Storage.skills.get(btn.dataset.id);
      if (!s) return;
      openConfirm(`「${s.name}」を削除しますか？`, () => {
        Storage.skills.delete(s.id);
        renderSkillList();
        populateSkillOugiSelects();
      });
    });
  });
}

/* ===== Ougi ===== */
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
        populateSkillOugiSelects();
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
