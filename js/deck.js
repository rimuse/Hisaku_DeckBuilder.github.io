/**
 * deck.js — デッキシミュレーションページ
 * 依存: storage.js / utils.js / modal.js
 */

/* デッキ状態（5スロット） */
let deck = Array(5).fill(null);

/* ----------------------------------------------------------------
   ページ初期化
---------------------------------------------------------------- */
function initDeckPage() {
  renderDeckSlots();
  renderCardGrid();
  renderDeckStats();
  refreshWorkFilter();
}

/* ----------------------------------------------------------------
   デッキスロット
---------------------------------------------------------------- */
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
          <div class="slot-char-name">${esc(card.charName)}${card.workName ? ' / ' + esc(card.workName) : ''}</div>
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

/* ----------------------------------------------------------------
   カードグリッド（デッキページ用）
---------------------------------------------------------------- */
function renderCardGrid() {
  const text = document.getElementById('filterText').value.trim().toLowerCase();
  const rar  = document.getElementById('filterRarity').value;
  const attr = document.getElementById('filterAttribute').value;
  const work = document.getElementById('filterWork').value;
  const grid = document.getElementById('cardGrid');

  let cards = Storage.cards.getAll();
  if (text) cards = cards.filter(c => [c.cardName, c.charName, c.workName].some(v => (v || '').toLowerCase().includes(text)));
  if (rar)  cards = cards.filter(c => c.rarity    === rar);
  if (attr) cards = cards.filter(c => c.attribute === attr);
  if (work) cards = cards.filter(c => c.workName  === work);

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
  /* すでにデッキにある or 空きスロットなし → 詳細表示 */
  if (deck.some(c => c && c.id === cardId) || deck.indexOf(null) === -1) {
    openCardDetail(card);
    return;
  }
  deck[deck.indexOf(null)] = card;
  renderDeckSlots();
  renderCardGrid();
  renderDeckStats();
}

/* ----------------------------------------------------------------
   カード詳細モーダル
---------------------------------------------------------------- */
function openCardDetail(card) {
  const skill = card.skillId ? Storage.skills.get(card.skillId) : null;
  const ougi  = card.ougiId  ? Storage.ougi.get(card.ougiId)   : null;
  document.getElementById('cardModalContent').innerHTML = `
    <div class="card-detail-name">${esc(card.cardName)}</div>
    ${detailRow('キャラクター', card.charName)}
    ${detailRow('作品', card.workName || '—')}
    ${detailRow('レア度', `<span class="rarity-${esc(card.rarity)}">${esc(card.rarity)}</span>`)}
    ${detailRow('属性', `<span class="attr-${esc(card.attribute)}">${esc(card.attribute)}</span>`)}
    ${detailRow('脅迫力', fmt(card.power))}
    ${detailRow('耐久力', fmt(card.hp))}
    ${detailRow('スキル', skill ? esc(skill.name) : '—')}
    ${detailRow('奥義',   ougi  ? esc(ougi.name)  : '—')}`;
  cardModal.open();
}

function detailRow(key, val) {
  return `<div class="card-detail-row"><span class="card-detail-key">${key}</span><span class="card-detail-value">${val}</span></div>`;
}

/* ----------------------------------------------------------------
   デッキ統計 & スキル発動状況
   ※ 脅迫力・耐久力は限界突破補正後の値を使用
---------------------------------------------------------------- */
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

  skillEl.innerHTML = '<div class="skill-status-title">スキル発動状況</div>' +
    activations.map(a => {
      const badge = a.active
        ? '<span class="status-badge on">発動中</span>'
        : '<span class="status-badge off">未発動</span>';
      const effects = [
        a.skill.threatPct    ? `脅迫力 +${a.skill.threatPct}%`    : '',
        a.skill.endurancePct ? `耐久力 +${a.skill.endurancePct}%` : ''
      ].filter(Boolean).join(' / ') || '効果なし';
      const targetStr = !a.skill.target || a.skill.target.type === 'all'
        ? '全体' : `${condLabel(a.skill.target.type)}: ${esc(a.skill.target.value)}`;
      return `<div class="skill-status-item${a.active ? ' active' : ''}">
        <div class="skill-status-header">
          <span class="skill-status-name">${esc(a.skill.name)}</span>${badge}
        </div>
        <div class="skill-status-detail">${effects}（対象: ${targetStr}）</div>
      </div>`;
    }).join('');
}

/* ----------------------------------------------------------------
   スキル発動計算（純粋関数）
   ※ バフ計算のベースに限界突破補正後の値を使用
---------------------------------------------------------------- */
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

    const target      = skill.target || { type: 'all' };
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
      threatBuff: Math.round(targetCards.reduce((s, c) => s + num(c.power) * tPct / 100, 0)),
      hpBuff:     Math.round(targetCards.reduce((s, c) => s + num(c.hp)    * ePct / 100, 0))
    };
  });
}

/* ----------------------------------------------------------------
   作品フィルター更新
---------------------------------------------------------------- */
function refreshWorkFilter() {
  const sel   = document.getElementById('filterWork');
  const works = [...new Set(Storage.cards.getAll().map(c => c.workName).filter(Boolean))].sort();
  const prev  = sel.value;
  sel.innerHTML = '<option value="">作品: すべて</option>' +
    works.map(w => `<option value="${esc(w)}"${w === prev ? ' selected' : ''}>${esc(w)}</option>`).join('');
}

/* ----------------------------------------------------------------
   イベントリスナー
---------------------------------------------------------------- */
document.getElementById('btnClearDeck').addEventListener('click', () => {
  deck = Array(5).fill(null);
  renderDeckSlots();
  renderCardGrid();
  renderDeckStats();
});

['filterText', 'filterRarity', 'filterAttribute', 'filterWork'].forEach(id => {
  document.getElementById(id).addEventListener('input', renderCardGrid);
});
