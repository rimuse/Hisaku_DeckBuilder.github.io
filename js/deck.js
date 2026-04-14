/**
 * deck.js — デッキシミュレーションページ
 * 依存: storage.js / utils.js / modal.js
 *
 * デッキの各スロットは { card: CardObject, lbLv: number } で管理する。
 * 限界突破Lv はカードのベース情報ではなく、デッキ構築時の可変項目。
 */

/* ----------------------------------------------------------------
   デッキ状態（5スロット）
   null | { card, lbLv }
---------------------------------------------------------------- */
let deck = Array(5).fill(null);
let _pickingSlot = -1;
const cardPickerModal = setupModal('cardPickerOverlay', 'cardPickerClose');

/* ----------------------------------------------------------------
   限界突破補正
---------------------------------------------------------------- */
const LIMIT_BREAK_BONUS = { N: 3, R: 6, SR: 9, SSR: 12 };

function lbBonus(card, lbLv) {
  return num(lbLv) * (LIMIT_BREAK_BONUS[card.rarity] || 0);
}
function slotPower(slot) { return num(slot.card.power) + lbBonus(slot.card, slot.lbLv); }
function slotHp(slot)    { return num(slot.card.hp)    + lbBonus(slot.card, slot.lbLv); }

/* ----------------------------------------------------------------
   ページ初期化
---------------------------------------------------------------- */
function initDeckPage() {
  refreshTokutsuboSelect();
  renderDeckSlots();
  renderDeckStats();
  refreshWorkFilter();
}

/* ----------------------------------------------------------------
   デッキスロット（5列グリッド）
---------------------------------------------------------------- */
function renderDeckSlots() {
  const container = document.getElementById('deckSlots');
  container.innerHTML = '';

  deck.forEach((slot, i) => {
    const col = document.createElement('div');
    col.className = 'deck-col';

    /* ---- カードスロット ---- */
    const slotEl = document.createElement('div');
    if (slot) {
      const { card, lbLv } = slot;
      slotEl.className = 'deck-col-slot';
      slotEl.innerHTML = `
        <div class="deck-col-slot-top">
          <span class="slot-rarity rarity-${esc(card.rarity)}">${esc(card.rarity)}</span>
          <span class="card-thumb-attr attr-${esc(card.attribute)}">${esc(card.attribute)}</span>
          <button class="slot-remove" data-slot="${i}" title="取り外す">&times;</button>
        </div>
        <div class="slot-card-name">${esc(card.cardName)}</div>
        <div class="slot-char-name">${esc(card.charName)}${card.workName ? ' / ' + esc(card.workName) : ''}</div>
        <div class="slot-lb-row">
          <span class="slot-lb-label">限突Lv</span>
          <input type="number" class="slot-lb-input" min="0" max="200" value="${num(lbLv)}" data-slot="${i}">
        </div>`;
    } else {
      slotEl.className = 'deck-col-slot empty';
      slotEl.innerHTML = `<span class="slot-empty-label">カード ${i + 1}</span>`;
    }
    slotEl.addEventListener('click', e => {
      if (e.target.closest('.slot-remove, .slot-lb-input')) return;
      openCardPicker(i);
    });
    col.appendChild(slotEl);

    /* ---- 特技Lv ---- */
    if (slot && slot.card.skillId) {
      const skillObj   = Storage.skills.get(slot.card.skillId);
      const maxSkillLv = skillObj && skillObj.maxSkillLv ? num(skillObj.maxSkillLv) : 1;
      const skillEl = document.createElement('div');
      skillEl.className = 'deck-col-skill';
      skillEl.innerHTML = `
        <span class="slot-skill-label">特技Lv</span>
        <input type="number" class="slot-skill-input" min="1" max="${maxSkillLv}" value="${num(slot.skillLv) || 1}" data-slot="${i}">`;
      col.appendChild(skillEl);
    }

    /* ---- スキル反映後ステータス ---- */
    if (slot) {
      const statsEl = document.createElement('div');
      statsEl.className = 'deck-col-stats';
      statsEl.innerHTML = `
        <div class="col-stats-title">スキル反映後</div>
        <div class="col-stats-row"><span>脅迫力</span><span class="col-stat-val" id="colThreat${i}">—</span></div>
        <div class="col-stats-row"><span>耐久力</span><span class="col-stat-val" id="colHp${i}">—</span></div>`;
      col.appendChild(statsEl);
    }

    container.appendChild(col);
  });

  /* 取り外しボタン */
  container.querySelectorAll('.slot-remove').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      deck[+btn.dataset.slot] = null;
      renderDeckSlots();
      renderDeckStats();
    });
  });

  /* 限突Lv 入力 */
  container.querySelectorAll('.slot-lb-input').forEach(input => {
    input.addEventListener('input', e => {
      const idx = +e.target.dataset.slot;
      if (deck[idx]) {
        deck[idx].lbLv = Math.min(200, Math.max(0, num(e.target.value)));
        renderDeckStats();
      }
    });
    input.addEventListener('blur', e => {
      const idx = +e.target.dataset.slot;
      if (deck[idx]) e.target.value = deck[idx].lbLv;
    });
  });

  /* 特技Lv 入力 */
  container.querySelectorAll('.slot-skill-input').forEach(input => {
    input.addEventListener('input', e => {
      const idx = +e.target.dataset.slot;
      if (deck[idx]) {
        const maxLv = num(e.target.max) || 1;
        deck[idx].skillLv = Math.min(maxLv, Math.max(1, num(e.target.value)));
        renderDeckStats();
      }
    });
    input.addEventListener('blur', e => {
      const idx = +e.target.dataset.slot;
      if (deck[idx]) e.target.value = deck[idx].skillLv || 1;
    });
  });
}

/* ----------------------------------------------------------------
   カード選択ピッカーを開く
---------------------------------------------------------------- */
function openCardPicker(slotIndex) {
  _pickingSlot = slotIndex;
  document.getElementById('cardPickerSlotNum').textContent = slotIndex + 1;
  refreshWorkFilter();
  renderCardGrid();
  cardPickerModal.open();
}

/* ----------------------------------------------------------------
   カードグリッド（カード選択ピッカー内）
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

  const inDeckIds = new Set(deck.filter(Boolean).map(s => s.card.id));
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
  if (!card || _pickingSlot < 0) return;
  deck[_pickingSlot] = { card, lbLv: 0, skillLv: 1 };
  cardPickerModal.close();
  _pickingSlot = -1;
  renderDeckSlots();
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
    ${detailRow('脅迫力 (Lv100)', fmt(card.power))}
    ${detailRow('耐久力 (Lv100)', fmt(card.hp))}
    ${detailRow('限突補正/Lv', `+${LIMIT_BREAK_BONUS[card.rarity] || 0}`)}
    ${detailRow('特技', skill ? esc(skill.name) : '—')}
    ${detailRow('奥義',   ougi  ? esc(ougi.name)  : '—')}`;
  cardModal.open();
}

function detailRow(key, val) {
  return `<div class="card-detail-row"><span class="card-detail-key">${key}</span><span class="card-detail-value">${val}</span></div>`;
}

/* ----------------------------------------------------------------
   デッキ統計 & スキル発動状況
---------------------------------------------------------------- */
function renderDeckStats() {
  const slots   = deck.filter(Boolean);
  const statsEl = document.getElementById('deckStats');
  const skillEl = document.getElementById('deckSkillStatus');

  if (!slots.length) {
    statsEl.innerHTML = '<div class="empty-state">カードを選択してください</div>';
    skillEl.innerHTML = '';
    return;
  }

  const activations = calcSkillActivations(slots);

  /* カードごとの反映後ステータスを更新 */
  const tokChar = document.getElementById('tokutsuboChar').value;
  const tokLv   = +document.getElementById('tokutsuboLv').value || 1;
  deck.forEach((slot, i) => {
    if (!slot) return;
    const thrEl = document.getElementById(`colThreat${i}`);
    const hpEl  = document.getElementById(`colHp${i}`);
    if (!thrEl || !hpEl) return;
    const basePow = slotPower(slot);
    const baseHp  = slotHp(slot);
    const isTargeted = a => !a.resolvedTargets.length || a.resolvedTargets.some(rt => {
      if (rt.type === 'character') return slot.card.charName  === rt.value;
      if (rt.type === 'work')      return slot.card.workName  === rt.value;
      if (rt.type === 'attribute') return slot.card.attribute === rt.value;
      return false;
    });
    const sktPow = activations.filter(a => a.active && isTargeted(a))
      .reduce((sum, a) => sum + Math.round(basePow * a.tPct / 100), 0);
    const sktHp  = activations.filter(a => a.active && isTargeted(a))
      .reduce((sum, a) => sum + Math.round(baseHp  * a.ePct / 100), 0);
    const tokuPow = (tokChar && slot.card.charName === tokChar) ? Math.round(basePow * tokLv / 100) : 0;
    const tokuHp  = (tokChar && slot.card.charName === tokChar) ? Math.round(baseHp  * tokLv / 100) : 0;
    thrEl.textContent = fmt(basePow + sktPow + tokuPow);
    hpEl.textContent  = fmt(baseHp  + sktHp  + tokuHp);
  });

  const skillThreat = activations.filter(a => a.active).reduce((s, a) => s + a.threatBuff, 0);
  const skillHp     = activations.filter(a => a.active).reduce((s, a) => s + a.hpBuff,     0);

  const baseThreat = slots.reduce((s, slot) => s + num(slot.card.power), 0);
  const baseHp     = slots.reduce((s, slot) => s + num(slot.card.hp),    0);
  const lbThreat   = slots.reduce((s, slot) => s + lbBonus(slot.card, slot.lbLv), 0);
  const lbHp       = slots.reduce((s, slot) => s + lbBonus(slot.card, slot.lbLv), 0);

  const { threat: tokuboThreat, hp: tokuboHp } = calcTokutsuboBonus(slots);

  const totalThreat = baseThreat + lbThreat + skillThreat + tokuboThreat;
  const totalHp     = baseHp     + lbHp     + skillHp     + tokuboHp;

  const attrStr = Object.entries(
    slots.reduce((acc, s) => { acc[s.card.attribute] = (acc[s.card.attribute] || 0) + 1; return acc; }, {})
  ).map(([k, v]) => `${k}×${v}`).join(' / ');

  function buffParts(lb, skill, tokubo) {
    const parts = [];
    if (lb     > 0) parts.push(`<span class="stat-buff lb">+${fmt(lb)} 限突</span>`);
    if (skill  > 0) parts.push(`<span class="stat-buff skill">+${fmt(skill)} 特技</span>`);
    if (tokubo > 0) parts.push(`<span class="stat-buff tokubo">+${fmt(tokubo)} 特壺</span>`);
    return parts.join('');
  }

  statsEl.innerHTML = `
    <div class="stat-row"><span class="stat-label">カード枚数</span><span class="stat-value">${slots.length} / 5</span></div>
    <div class="stat-row"><span class="stat-label">総脅迫力</span><span class="stat-value">${fmt(totalThreat)}${buffParts(lbThreat, skillThreat, tokuboThreat)}</span></div>
    <div class="stat-row"><span class="stat-label">総耐久力</span><span class="stat-value">${fmt(totalHp)}${buffParts(lbHp, skillHp, tokuboHp)}</span></div>
    <div class="stat-row"><span class="stat-label">属性内訳</span><span class="stat-value">${attrStr || '—'}</span></div>`;

  if (!activations.length) { skillEl.innerHTML = ''; return; }

  skillEl.innerHTML = '<div class="skill-status-title">特技発動状況</div>' +
    activations.map(a => {
      const badge = a.active
        ? '<span class="status-badge on">発動中</span>'
        : '<span class="status-badge off">未発動</span>';
      const lvLabel = (!a.skill.noEffect && a.skill.maxSkillLv) ? ` (特技Lv${a.skillLv})` : '';
      const effects = a.skill.noEffect
        ? '効果なし'
        : ([
            a.tPct ? `脅迫力 +${a.tPct}%` : '',
            a.ePct ? `耐久力 +${a.ePct}%` : ''
          ].filter(Boolean).join(' / ') || '効果なし');
      const targetStr = !a.resolvedTargets?.length
        ? '全体'
        : a.resolvedTargets.map(t => `${condLabel(t.type)}: ${esc(t.value)}`).join(' または ');
      return `<div class="skill-status-item${a.active ? ' active' : ''}">
        <div class="skill-status-header">
          <span class="skill-status-name">${esc(a.skill.name)}${lvLabel}</span>${badge}
        </div>
        <div class="skill-status-detail">${effects}（対象: ${targetStr}）</div>
      </div>`;
    }).join('');
}

/* ----------------------------------------------------------------
   特技発動計算（純粋関数）
   ※ バフ計算のベースは 限界突破補正後の実効値
   ※ owner_character / owner_attribute は所有カードの値で動的解決
---------------------------------------------------------------- */
function calcSkillActivations(slots) {
  const allSkills = Storage.skills.getAll();

  /* skillId ごとに最初に登場したスロットの情報を記録 */
  const skillInfoMap = {};
  slots.forEach(s => {
    if (s.card.skillId && !(s.card.skillId in skillInfoMap)) {
      skillInfoMap[s.card.skillId] = {
        skillLv:   s.skillLv       || 1,
        ownerChar: s.card.charName  || '',
        ownerWork: s.card.workName  || '',
        ownerAttr: s.card.attribute || '',
      };
    }
  });

  const deckSkills = allSkills.filter(skill => skill.id in skillInfoMap);

  return deckSkills.map(skill => {
    const { skillLv, ownerChar, ownerWork, ownerAttr } = skillInfoMap[skill.id];

    /* 新形式（init + rise）があれば Lv に応じて計算、なければ旧 threatPct を使用 */
    const tPct = skill.threatPctInit !== undefined
      ? num(skill.threatPctInit) + num(skill.threatRise) * (skillLv - 1)
      : num(skill.threatPct);
    const ePct = skill.endurancePctInit !== undefined
      ? num(skill.endurancePctInit) + num(skill.enduranceRise) * (skillLv - 1)
      : num(skill.endurancePct);

    /* 条件の owner タイプを所有者情報で解決 */
    const conditions = (skill.conditions || []).map(cond => {
      if (cond.type === 'owner_character') return { ...cond, type: 'character', value: ownerChar };
      if (cond.type === 'owner_work')      return { ...cond, type: 'work',      value: ownerWork };
      if (cond.type === 'owner_attribute') return { ...cond, type: 'attribute', value: ownerAttr };
      return cond;
    });

    const active = conditions.length === 0 || conditions.every(cond => {
      const count = slots.filter(s => {
        const c = s.card;
        if (cond.type === 'character') return c.charName  === cond.value;
        if (cond.type === 'work')      return c.workName  === cond.value;
        if (cond.type === 'attribute') return c.attribute === cond.value;
        return false;
      }).length;
      return count >= num(cond.minCount || 1);
    });

    /* 発動対象の正規化（旧 target 単体形式との後方互換）と owner タイプ解決 */
    const rawTargets = skill.targets?.length ? skill.targets
      : (skill.target && skill.target.type !== 'all' ? [skill.target] : []);
    const resolvedTargets = rawTargets.map(t => {
      if (t.type === 'owner_character') return { type: 'character', value: ownerChar };
      if (t.type === 'owner_work')      return { type: 'work',      value: ownerWork };
      if (t.type === 'owner_attribute') return { type: 'attribute', value: ownerAttr };
      return t;
    });

    /* 対象スロット抽出（空 = 全体、複数要素は OR） */
    const targetSlots = active ? slots.filter(s => {
      if (!resolvedTargets.length) return true;
      const c = s.card;
      return resolvedTargets.some(rt => {
        if (rt.type === 'character') return c.charName  === rt.value;
        if (rt.type === 'work')      return c.workName  === rt.value;
        if (rt.type === 'attribute') return c.attribute === rt.value;
        return false;
      });
    }) : [];

    return {
      skill,
      active,
      skillLv,
      tPct,
      ePct,
      resolvedTargets,
      threatBuff: Math.round(targetSlots.reduce((s, slot) => s + slotPower(slot) * tPct / 100, 0)),
      hpBuff:     Math.round(targetSlots.reduce((s, slot) => s + slotHp(slot)    * ePct / 100, 0))
    };
  });
}

/* ----------------------------------------------------------------
   特壺計算（純粋関数）
   対象キャラクターの限突補正後ステータスに特壺Lv%を加算
---------------------------------------------------------------- */
function calcTokutsuboBonus(slots) {
  const charName = document.getElementById('tokutsuboChar').value;
  const lv       = +document.getElementById('tokutsuboLv').value || 1;
  if (!charName) return { threat: 0, hp: 0 };
  const targets = slots.filter(s => s.card.charName === charName);
  return {
    threat: Math.round(targets.reduce((s, slot) => s + slotPower(slot) * lv / 100, 0)),
    hp:     Math.round(targets.reduce((s, slot) => s + slotHp(slot)    * lv / 100, 0))
  };
}

/* ----------------------------------------------------------------
   特壺キャラクター選択肢更新
---------------------------------------------------------------- */
function refreshTokutsuboSelect() {
  const sel   = document.getElementById('tokutsuboChar');
  const chars = [...new Set(Storage.cards.getAll().map(c => c.charName).filter(Boolean))].sort();
  const prev  = sel.value;
  sel.innerHTML = '<option value="">キャラクター: なし</option>' +
    chars.map(c => `<option value="${esc(c)}"${c === prev ? ' selected' : ''}>${esc(c)}</option>`).join('');
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
  renderDeckStats();
});

['filterText', 'filterRarity', 'filterAttribute', 'filterWork'].forEach(id => {
  document.getElementById(id).addEventListener('input', renderCardGrid);
});

document.getElementById('tokutsuboChar').addEventListener('change', renderDeckStats);
document.getElementById('tokutsuboLv').addEventListener('change', renderDeckStats);
