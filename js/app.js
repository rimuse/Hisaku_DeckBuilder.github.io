/* =============================================================
   Hisaku DeckBuilder — main application
   ============================================================= */

/* ----------------------------------------------------------------
   Utility helpers
---------------------------------------------------------------- */
function esc(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function num(v) { return +v || 0; }
function fmt(v) { return num(v).toLocaleString(); }

const COND_LABELS = { character: 'キャラ', work: '作品', attribute: '属性' };
function condLabel(type) { return COND_LABELS[type] || type; }

/* ----------------------------------------------------------------
   Navigation
---------------------------------------------------------------- */
const navBtns  = document.querySelectorAll('.nav-btn');
const pages    = document.querySelectorAll('.page');

function showPage(id) {
  pages.forEach(p => p.classList.toggle('active', p.id === 'page-' + id));
  navBtns.forEach(b => b.classList.toggle('active', b.dataset.page === id));
  if (id === 'deck')   initDeckPage();
  if (id === 'cards')  initCardPage();
  if (id === 'skills') initSkillsPage();
}

navBtns.forEach(btn => btn.addEventListener('click', () => {
  showPage(btn.dataset.page);
  document.getElementById('navMobile').classList.remove('open');
}));

document.getElementById('hamburger').addEventListener('click', () => {
  document.getElementById('navMobile').classList.toggle('open');
});

/* ----------------------------------------------------------------
   Modals
---------------------------------------------------------------- */
function setupModal(overlayId, closeId) {
  const overlay = document.getElementById(overlayId);
  const closeBtn = closeId ? document.getElementById(closeId) : null;
  function open(contentFn) {
    if (contentFn) contentFn();
    overlay.classList.add('open');
  }
  function close() { overlay.classList.remove('open'); }
  if (closeBtn) closeBtn.addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  return { open, close };
}

const cardModal    = setupModal('cardModalOverlay', 'cardModalClose');
const confirmModal = setupModal('confirmOverlay');

let _confirmCallback = null;
document.getElementById('confirmYes').addEventListener('click', () => {
  if (_confirmCallback) _confirmCallback();
  confirmModal.close();
  _confirmCallback = null;
});
document.getElementById('confirmNo').addEventListener('click', () => {
  confirmModal.close();
  _confirmCallback = null;
});

function confirm(msg, cb) {
  document.getElementById('confirmMsg').textContent = msg;
  _confirmCallback = cb;
  confirmModal.open();
}

/* ----------------------------------------------------------------
   DECK PAGE
---------------------------------------------------------------- */
let deck = Array(5).fill(null);

function initDeckPage() {
  renderDeckSlots();
  renderCardGrid();
  renderDeckStats();
  refreshWorkFilter();
}

/* Deck slots */
function renderDeckSlots() {
  const container = document.getElementById('deckSlots');
  container.innerHTML = '';
  deck.forEach((card, i) => {
    const el = document.createElement('div');
    if (card) {
      el.className = 'deck-slot';
      el.innerHTML = `
        <span class="slot-rarity rarity-${esc(card.rarity)}">${esc(card.rarity)}</span>
        <div class="slot-info">
          <div class="slot-card-name">${esc(card.cardName)}</div>
          <div class="slot-char-name">${esc(card.charName)}${card.workName ? ' / ' + esc(card.workName) : ''}${card.lv ? ' Lv.' + card.lv : ''}</div>
        </div>
        <button class="slot-remove" data-slot="${i}" title="取り外す">&times;</button>`;
    } else {
      el.className = 'deck-slot empty';
      el.textContent = 'スロット ' + (i + 1);
    }
    container.appendChild(el);
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

/* Card grid in deck page */
function renderCardGrid() {
  const text  = document.getElementById('filterText').value.trim().toLowerCase();
  const rar   = document.getElementById('filterRarity').value;
  const attr  = document.getElementById('filterAttribute').value;
  const work  = document.getElementById('filterWork').value;
  const grid  = document.getElementById('cardGrid');

  let cards = Storage.cards.getAll();
  if (text) cards = cards.filter(c => [c.cardName, c.charName, c.workName].some(v => (v || '').toLowerCase().includes(text)));
  if (rar)  cards = cards.filter(c => c.rarity === rar);
  if (attr) cards = cards.filter(c => c.attribute === attr);
  if (work) cards = cards.filter(c => c.workName === work);

  if (!cards.length) {
    grid.innerHTML = '<div class="empty-state">カードが見つかりません</div>';
    return;
  }

  const inDeckIds = new Set(deck.filter(Boolean).map(c => c.id));
  grid.innerHTML = cards.map(c => `
    <div class="card-thumb${inDeckIds.has(c.id) ? ' in-deck' : ''}" data-id="${esc(c.id)}" title="${esc(c.cardName)}">
      <span class="card-thumb-rarity rarity-${esc(c.rarity)}">${esc(c.rarity)}</span>
      <span class="card-thumb-attr attr-${esc(c.attribute)}">${esc(c.attribute)}</span>
      <div class="card-thumb-name">${esc(c.cardName)}</div>
      <div class="card-thumb-char">${esc(c.charName)}${c.workName ? ' / ' + esc(c.workName) : ''}</div>
      <div class="card-thumb-stat">脅 ${fmt(c.power)} / 耐 ${fmt(c.hp)}</div>
    </div>`).join('');

  grid.querySelectorAll('.card-thumb').forEach(el => {
    el.addEventListener('click', () => onCardThumbClick(el.dataset.id));
  });
}

function onCardThumbClick(cardId) {
  const card = Storage.cards.get(cardId);
  if (!card) return;
  const emptySlot = deck.indexOf(null);
  if (emptySlot === -1) {
    openCardDetail(card);
    return;
  }
  if (deck.some(c => c && c.id === cardId)) {
    openCardDetail(card);
    return;
  }
  deck[emptySlot] = card;
  renderDeckSlots();
  renderCardGrid();
  renderDeckStats();
}

function openCardDetail(card) {
  const skill = card.skillId ? Storage.skills.get(card.skillId) : null;
  const ougi  = card.ougiId  ? Storage.ougi.get(card.ougiId)   : null;
  document.getElementById('cardModalContent').innerHTML = `
    <div class="card-detail-name">${esc(card.cardName)}</div>
    ${row('キャラクター', card.charName)}
    ${row('作品', card.workName || '—')}
    ${row('レア度', `<span class="rarity-${esc(card.rarity)}">${esc(card.rarity)}</span>`)}
    ${row('属性', `<span class="attr-${esc(card.attribute)}">${esc(card.attribute)}</span>`)}
    ${card.lv ? row('Lv', card.lv) : ''}
    ${row('脅迫力', fmt(card.power))}
    ${row('耐久力', fmt(card.hp))}
    ${row('スキル', skill ? esc(skill.name) : '—')}
    ${row('奥義', ougi ? esc(ougi.name) : '—')}`;
  cardModal.open();
}

function row(k, v) {
  return `<div class="card-detail-row"><span class="card-detail-key">${k}</span><span class="card-detail-value">${v}</span></div>`;
}

/* Deck stats & skill activation */
function renderDeckStats() {
  const cards   = deck.filter(Boolean);
  const statsEl = document.getElementById('deckStats');
  const skillEl = document.getElementById('deckSkillStatus');

  if (!cards.length) {
    statsEl.innerHTML = '<div class="empty-state">カードを選択してください</div>';
    skillEl.innerHTML = '';
    return;
  }

  const activations = calcSkillActivations(cards);
  const threatBuff  = activations.filter(a => a.active).reduce((s, a) => s + a.threatBuff, 0);
  const hpBuff      = activations.filter(a => a.active).reduce((s, a) => s + a.hpBuff,     0);
  const baseThreat  = cards.reduce((s, c) => s + num(c.power), 0);
  const baseHp      = cards.reduce((s, c) => s + num(c.hp),    0);
  const attrStr     = Object.entries(
    cards.reduce((acc, c) => { acc[c.attribute] = (acc[c.attribute] || 0) + 1; return acc; }, {})
  ).map(([k, v]) => `${k}×${v}`).join(' / ');

  statsEl.innerHTML = `
    <div class="stat-row"><span class="stat-label">カード枚数</span><span class="stat-value">${cards.length} / 5</span></div>
    <div class="stat-row"><span class="stat-label">総脅迫力</span><span class="stat-value">${fmt(baseThreat + threatBuff)}${threatBuff > 0 ? `<span class="stat-buff">(+${fmt(threatBuff)})</span>` : ''}</span></div>
    <div class="stat-row"><span class="stat-label">総耐久力</span><span class="stat-value">${fmt(baseHp + hpBuff)}${hpBuff > 0 ? `<span class="stat-buff">(+${fmt(hpBuff)})</span>` : ''}</span></div>
    <div class="stat-row"><span class="stat-label">属性内訳</span><span class="stat-value">${attrStr || '—'}</span></div>`;

  if (!activations.length) { skillEl.innerHTML = ''; return; }

  skillEl.innerHTML = `<div class="skill-status-title">スキル発動状況</div>` +
    activations.map(a => {
      const badge = a.active
        ? '<span class="status-badge on">発動中</span>'
        : '<span class="status-badge off">未発動</span>';
      const effects = [];
      if (a.skill.threatPct)    effects.push(`脅迫力 +${a.skill.threatPct}%`);
      if (a.skill.endurancePct) effects.push(`耐久力 +${a.skill.endurancePct}%`);
      const effectStr = effects.join(' / ') || '効果なし';
      const targetStr = !a.skill.target || a.skill.target.type === 'all'
        ? '全体' : `${condLabel(a.skill.target.type)}: ${esc(a.skill.target.value)}`;
      return `<div class="skill-status-item${a.active ? ' active' : ''}">
        <div class="skill-status-header">
          <span class="skill-status-name">${esc(a.skill.name)}</span>${badge}
        </div>
        <div class="skill-status-detail">${effectStr}（対象: ${targetStr}）</div>
      </div>`;
    }).join('');
}

function calcSkillActivations(cards) {
  const allSkills  = Storage.skills.getAll();
  const skillIds   = [...new Set(cards.map(c => c.skillId).filter(Boolean))];
  const deckSkills = allSkills.filter(s => skillIds.includes(s.id));

  return deckSkills.map(skill => {
    const conditions = skill.conditions || [];
    const active = conditions.length === 0 || conditions.every(cond => {
      const count = cards.filter(c => {
        if (cond.type === 'character') return c.charName  === cond.value;
        if (cond.type === 'work')      return c.workName  === cond.value;
        if (cond.type === 'attribute') return c.attribute === cond.value;
        return false;
      }).length;
      return count >= num(cond.minCount || 1);
    });

    const target = skill.target || { type: 'all' };
    const targetCards = active ? cards.filter(c => {
      if (!target || target.type === 'all') return true;
      if (target.type === 'character') return c.charName  === target.value;
      if (target.type === 'work')      return c.workName  === target.value;
      if (target.type === 'attribute') return c.attribute === target.value;
      return false;
    }) : [];

    const tPct = num(skill.threatPct);
    const ePct = num(skill.endurancePct);
    return {
      skill,
      active,
      threatBuff:  Math.round(targetCards.reduce((s, c) => s + num(c.power) * tPct / 100, 0)),
      hpBuff:      Math.round(targetCards.reduce((s, c) => s + num(c.hp)    * ePct / 100, 0))
    };
  });
}

/* Work filter refresh */
function refreshWorkFilter() {
  const sel   = document.getElementById('filterWork');
  const works = [...new Set(Storage.cards.getAll().map(c => c.workName).filter(Boolean))].sort();
  const prev  = sel.value;
  sel.innerHTML = '<option value="">作品: すべて</option>' + works.map(w => `<option value="${esc(w)}"${w === prev ? ' selected' : ''}>${esc(w)}</option>`).join('');
}

/* Clear deck */
document.getElementById('btnClearDeck').addEventListener('click', () => {
  deck = Array(5).fill(null);
  renderDeckSlots();
  renderCardGrid();
  renderDeckStats();
});

/* Filters */
['filterText','filterRarity','filterAttribute','filterWork'].forEach(id => {
  document.getElementById(id).addEventListener('input', renderCardGrid);
});

/* ----------------------------------------------------------------
   CARD PAGE
---------------------------------------------------------------- */
function initCardPage() {
  populateSkillSelect();
  populateOugiSelect();
  refreshWorkSuggestions();
  renderCardList();
}

function populateSkillSelect() {
  const sel = document.getElementById('cardSkill');
  const cur = sel.value;
  sel.innerHTML = '<option value="">なし</option>' +
    Storage.skills.getAll().map(s => `<option value="${esc(s.id)}"${s.id === cur ? ' selected' : ''}>${esc(s.name)}</option>`).join('');
}

function populateOugiSelect() {
  const sel = document.getElementById('cardOugi');
  const cur = sel.value;
  sel.innerHTML = '<option value="">なし</option>' +
    Storage.ougi.getAll().map(o => `<option value="${esc(o.id)}"${o.id === cur ? ' selected' : ''}>${esc(o.name)}</option>`).join('');
}

function refreshWorkSuggestions() {
  const works = [...new Set(Storage.cards.getAll().map(c => c.workName).filter(Boolean))].sort();
  document.getElementById('workSuggestions').innerHTML = works.map(w => `<option value="${esc(w)}">`).join('');
}

function renderCardList() {
  const query = (document.getElementById('cardListSearch').value || '').toLowerCase();
  let cards = Storage.cards.getAll();
  if (query) cards = cards.filter(c => [c.cardName, c.charName, c.workName].some(v => (v || '').toLowerCase().includes(query)));
  const el = document.getElementById('cardList');
  if (!cards.length) { el.innerHTML = '<div class="empty-state">カードが登録されていません</div>'; return; }
  el.innerHTML = cards.map(c => `
    <div class="list-item">
      <span class="slot-rarity rarity-${esc(c.rarity)}">${esc(c.rarity)}</span>
      <div class="list-item-main">
        <div class="list-item-name">${esc(c.cardName)}</div>
        <div class="list-item-sub">${esc(c.charName)}${c.workName ? ' / ' + esc(c.workName) : ''} — 脅 ${fmt(c.power)} / 耐 ${fmt(c.hp)}</div>
      </div>
      <div class="list-item-actions">
        <button class="icon-btn edit"   data-id="${esc(c.id)}">編集</button>
        <button class="icon-btn delete" data-id="${esc(c.id)}">削除</button>
      </div>
    </div>`).join('');

  el.querySelectorAll('.icon-btn.edit').forEach(btn => btn.addEventListener('click', () => editCard(btn.dataset.id)));
  el.querySelectorAll('.icon-btn.delete').forEach(btn => btn.addEventListener('click', () => deleteCard(btn.dataset.id)));
}

document.getElementById('cardListSearch').addEventListener('input', renderCardList);

function resetCardForm() {
  document.getElementById('cardForm').reset();
  document.getElementById('cardId').value = '';
  document.getElementById('cardFormTitle').textContent = '新規カード登録';
  document.getElementById('cardCancelBtn').hidden = true;
}

function editCard(id) {
  const c = Storage.cards.get(id);
  if (!c) return;
  document.getElementById('cardId').value = c.id;
  document.getElementById('cardName').value  = c.cardName  || '';
  document.getElementById('charName').value  = c.charName  || '';
  document.getElementById('workName').value  = c.workName  || '';
  document.getElementById('cardLv').value    = c.lv        || '';
  document.getElementById('cardPower').value = c.power     || '';
  document.getElementById('cardHp').value    = c.hp        || '';
  document.getElementById('cardSkill').value = c.skillId   || '';
  document.getElementById('cardOugi').value  = c.ougiId    || '';
  document.querySelector(`input[name="rarity"][value="${c.rarity}"]`).checked   = true;
  document.querySelector(`input[name="attribute"][value="${c.attribute}"]`).checked = true;
  document.getElementById('cardFormTitle').textContent = 'カード編集';
  document.getElementById('cardCancelBtn').hidden = false;
  document.getElementById('cardForm').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function deleteCard(id) {
  const c = Storage.cards.get(id);
  if (!c) return;
  confirm(`「${c.cardName}」を削除しますか？`, () => {
    Storage.cards.delete(id);
    deck = deck.map(d => (d && d.id === id) ? null : d);
    renderCardList();
    refreshWorkSuggestions();
  });
}

document.getElementById('cardForm').addEventListener('submit', e => {
  e.preventDefault();
  const rarity    = document.querySelector('input[name="rarity"]:checked');
  const attribute = document.querySelector('input[name="attribute"]:checked');
  if (!rarity || !attribute) { alert('レア度と属性は必須です'); return; }

  Storage.cards.save({
    id:        document.getElementById('cardId').value || undefined,
    cardName:  document.getElementById('cardName').value.trim(),
    charName:  document.getElementById('charName').value.trim(),
    rarity:    rarity.value,
    workName:  document.getElementById('workName').value.trim(),
    attribute: attribute.value,
    lv:        document.getElementById('cardLv').value,
    power:     document.getElementById('cardPower').value,
    hp:        document.getElementById('cardHp').value,
    skillId:   document.getElementById('cardSkill').value || undefined,
    ougiId:    document.getElementById('cardOugi').value  || undefined,
  });
  resetCardForm();
  renderCardList();
  refreshWorkSuggestions();
});

document.getElementById('cardCancelBtn').addEventListener('click', resetCardForm);

/* ----------------------------------------------------------------
   SKILL / OUGI PAGE
---------------------------------------------------------------- */
function initSkillsPage() {
  renderSkillList();
  renderOugiList();
  refreshCondSuggestions();
}

/* ----- Skill form helpers ----- */
let skillConditions = [];

function renderCondList() {
  const el = document.getElementById('condList');
  if (!skillConditions.length) {
    el.innerHTML = '<span class="empty-hint">条件なし（常時発動）</span>';
    return;
  }
  el.innerHTML = skillConditions.map((c, i) => `
    <span class="cond-tag">
      ${condLabel(c.type)}: ${esc(c.value)} ≥ ${c.minCount}枚
      <button type="button" class="cond-tag-remove" data-i="${i}">&times;</button>
    </span>`).join('');
  el.querySelectorAll('.cond-tag-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      skillConditions.splice(+btn.dataset.i, 1);
      renderCondList();
    });
  });
}

document.getElementById('btnAddCond').addEventListener('click', () => {
  const type  = document.getElementById('condType').value;
  const value = document.getElementById('condValue').value.trim();
  const count = parseInt(document.getElementById('condMinCount').value, 10) || 1;
  if (!value) { alert('条件の値を入力してください'); return; }
  skillConditions.push({ type, value, minCount: count });
  document.getElementById('condValue').value = '';
  renderCondList();
});

/* condType → attribute → show select instead of text */
document.getElementById('condType').addEventListener('change', function () {
  const inp = document.getElementById('condValue');
  if (this.value === 'attribute') {
    inp.setAttribute('list', '');
    inp.placeholder = '親愛 / 調教 / 従順';
  } else {
    inp.setAttribute('list', 'condValueSuggestions');
    inp.placeholder = '値を入力';
    refreshCondSuggestions();
  }
});

function refreshCondSuggestions() {
  const cards = Storage.cards.getAll();
  const chars = [...new Set(cards.map(c => c.charName).filter(Boolean))].sort();
  const works = [...new Set(cards.map(c => c.workName).filter(Boolean))].sort();
  const type  = document.getElementById('condType').value;
  const vals  = type === 'work' ? works : chars;
  document.getElementById('condValueSuggestions').innerHTML = vals.map(v => `<option value="${esc(v)}">`).join('');
}

/* Target type */
document.getElementById('targetTypeGroup').addEventListener('change', e => {
  const wrap = document.getElementById('targetValueWrap');
  const type = e.target.value;
  if (type === 'all') { wrap.hidden = true; wrap.innerHTML = ''; return; }
  wrap.hidden = false;
  if (type === 'attribute') {
    wrap.innerHTML = `
      <div class="radio-group">
        <label class="radio-label"><input type="radio" name="targetValue" value="親愛"> 親愛</label>
        <label class="radio-label"><input type="radio" name="targetValue" value="調教"> 調教</label>
        <label class="radio-label"><input type="radio" name="targetValue" value="従順"> 従順</label>
      </div>`;
  } else {
    const cards = Storage.cards.getAll();
    const vals  = type === 'work'
      ? [...new Set(cards.map(c => c.workName).filter(Boolean))].sort()
      : [...new Set(cards.map(c => c.charName).filter(Boolean))].sort();
    const datalistId = 'targetValList';
    wrap.innerHTML = `
      <input type="text" id="targetValueInput" class="form-input" placeholder="値を入力" list="${datalistId}" autocomplete="off">
      <datalist id="${datalistId}">${vals.map(v => `<option value="${esc(v)}">`).join('')}</datalist>`;
  }
});

function resetSkillForm() {
  document.getElementById('skillForm').reset();
  document.getElementById('skillId').value = '';
  skillConditions = [];
  renderCondList();
  document.getElementById('targetValueWrap').hidden = true;
  document.getElementById('targetValueWrap').innerHTML = '';
  document.getElementById('skillFormTitle').textContent = '新規スキル登録';
  document.getElementById('skillCancelBtn').hidden = true;
  document.getElementById('effectThreat').value = 0;
  document.getElementById('effectEndurance').value = 0;
}

function editSkill(id) {
  const s = Storage.skills.get(id);
  if (!s) return;
  document.getElementById('skillId').value   = s.id;
  document.getElementById('skillName').value = s.name || '';
  document.getElementById('effectThreat').value    = s.threatPct    || 0;
  document.getElementById('effectEndurance').value = s.endurancePct || 0;
  skillConditions = (s.conditions || []).slice();
  renderCondList();

  const target = s.target || { type: 'all' };
  document.querySelector(`input[name="targetType"][value="${target.type}"]`).checked = true;
  document.getElementById('targetTypeGroup').dispatchEvent(new Event('change', { bubbles: true }));
  if (target.type !== 'all' && target.value) {
    const wrap = document.getElementById('targetValueWrap');
    if (target.type === 'attribute') {
      const radio = wrap.querySelector(`input[name="targetValue"][value="${target.value}"]`);
      if (radio) radio.checked = true;
    } else {
      const inp = wrap.querySelector('input[type="text"]');
      if (inp) inp.value = target.value;
    }
  }

  document.getElementById('skillFormTitle').textContent = 'スキル編集';
  document.getElementById('skillCancelBtn').hidden = false;
  document.getElementById('skillForm').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function deleteSkill(id) {
  const s = Storage.skills.get(id);
  if (!s) return;
  confirm(`「${s.name}」を削除しますか？`, () => {
    Storage.skills.delete(id);
    renderSkillList();
  });
}

function renderSkillList() {
  const el = document.getElementById('skillList');
  const skills = Storage.skills.getAll();
  if (!skills.length) { el.innerHTML = '<div class="empty-state">スキルが登録されていません</div>'; return; }
  el.innerHTML = skills.map(s => {
    const conds  = (s.conditions || []).map(c => `${condLabel(c.type)}:${esc(c.value)}≥${c.minCount}`).join(' AND ') || '常時発動';
    const effs   = [s.threatPct ? `脅${s.threatPct}%` : '', s.endurancePct ? `耐${s.endurancePct}%` : ''].filter(Boolean).join('/') || '—';
    return `<div class="list-item">
      <div class="list-item-main">
        <div class="list-item-name">${esc(s.name)}</div>
        <div class="list-item-sub">${conds} → ${effs}</div>
      </div>
      <div class="list-item-actions">
        <button class="icon-btn edit"   data-id="${esc(s.id)}">編集</button>
        <button class="icon-btn delete" data-id="${esc(s.id)}">削除</button>
      </div>
    </div>`;
  }).join('');
  el.querySelectorAll('.icon-btn.edit').forEach(btn => btn.addEventListener('click', () => editSkill(btn.dataset.id)));
  el.querySelectorAll('.icon-btn.delete').forEach(btn => btn.addEventListener('click', () => deleteSkill(btn.dataset.id)));
}

document.getElementById('skillForm').addEventListener('submit', e => {
  e.preventDefault();
  const targetType = document.querySelector('input[name="targetType"]:checked')?.value || 'all';
  let targetValue = '';
  if (targetType !== 'all') {
    const wrap = document.getElementById('targetValueWrap');
    if (targetType === 'attribute') {
      targetValue = wrap.querySelector('input[name="targetValue"]:checked')?.value || '';
    } else {
      targetValue = wrap.querySelector('input[type="text"]')?.value.trim() || '';
    }
    if (!targetValue) { alert('発動対象の値を入力してください'); return; }
  }

  Storage.skills.save({
    id:            document.getElementById('skillId').value || undefined,
    name:          document.getElementById('skillName').value.trim(),
    conditions:    skillConditions.slice(),
    target:        { type: targetType, value: targetValue },
    threatPct:     num(document.getElementById('effectThreat').value),
    endurancePct:  num(document.getElementById('effectEndurance').value),
  });
  resetSkillForm();
  renderSkillList();
  populateSkillSelect();
});

document.getElementById('skillCancelBtn').addEventListener('click', resetSkillForm);

/* ----- Ougi form helpers ----- */
function resetOugiForm() {
  document.getElementById('ougiForm').reset();
  document.getElementById('ougiId').value = '';
  document.getElementById('ougiFormTitle').textContent = '新規奥義登録';
  document.getElementById('ougiCancelBtn').hidden = true;
}

function editOugi(id) {
  const o = Storage.ougi.get(id);
  if (!o) return;
  document.getElementById('ougiId').value   = o.id;
  document.getElementById('ougiName').value = o.name || '';
  document.getElementById('ougiDesc').value = o.desc || '';
  document.getElementById('ougiFormTitle').textContent = '奥義編集';
  document.getElementById('ougiCancelBtn').hidden = false;
  document.getElementById('ougiForm').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function deleteOugi(id) {
  const o = Storage.ougi.get(id);
  if (!o) return;
  confirm(`「${o.name}」を削除しますか？`, () => {
    Storage.ougi.delete(id);
    renderOugiList();
    populateOugiSelect();
  });
}

function renderOugiList() {
  const el = document.getElementById('ougiList');
  const list = Storage.ougi.getAll();
  if (!list.length) { el.innerHTML = '<div class="empty-state">奥義が登録されていません</div>'; return; }
  el.innerHTML = list.map(o => `
    <div class="list-item">
      <div class="list-item-main">
        <div class="list-item-name">${esc(o.name)}</div>
        ${o.desc ? `<div class="list-item-sub">${esc(o.desc)}</div>` : ''}
      </div>
      <div class="list-item-actions">
        <button class="icon-btn edit"   data-id="${esc(o.id)}">編集</button>
        <button class="icon-btn delete" data-id="${esc(o.id)}">削除</button>
      </div>
    </div>`).join('');
  el.querySelectorAll('.icon-btn.edit').forEach(btn => btn.addEventListener('click', () => editOugi(btn.dataset.id)));
  el.querySelectorAll('.icon-btn.delete').forEach(btn => btn.addEventListener('click', () => deleteOugi(btn.dataset.id)));
}

document.getElementById('ougiForm').addEventListener('submit', e => {
  e.preventDefault();
  Storage.ougi.save({
    id:   document.getElementById('ougiId').value || undefined,
    name: document.getElementById('ougiName').value.trim(),
    desc: document.getElementById('ougiDesc').value.trim(),
  });
  resetOugiForm();
  renderOugiList();
  populateOugiSelect();
});

document.getElementById('ougiCancelBtn').addEventListener('click', resetOugiForm);

/* ----------------------------------------------------------------
   Boot — show default page
---------------------------------------------------------------- */
showPage('deck');
