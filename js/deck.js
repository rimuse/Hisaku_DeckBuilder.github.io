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
          <div class="slot-badges">
            <span class="slot-rarity rarity-${esc(card.rarity)}">${esc(card.rarity)}</span>
            <span class="slot-attr attr-${esc(card.attribute)}">${esc(card.attribute)}</span>
            ${card.workName ? `<span class="slot-work">${esc(card.workName)}</span>` : ''}
          </div>
          <button class="slot-remove" data-slot="${i}" title="取り外す">&times;</button>
        </div>
        <div class="slot-card-name">${esc(card.cardName)}</div>
        <div class="slot-char-name">${esc(card.charName)}</div>
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

    /* ---- 特効チェックボックス ---- */
    if (slot) {
      const checksEl = document.createElement('div');
      checksEl.className = 'deck-col-checks';
      checksEl.innerHTML = `
        <label class="deck-check-label">
          <input type="checkbox" class="slot-tokko-check" data-slot="${i}"${slot.isTokkoTarget ? ' checked' : ''}>
          特効効果対象
        </label>
        <label class="deck-check-label">
          <input type="checkbox" class="slot-new-tokko-check" data-slot="${i}"${slot.isNewCardTokko ? ' checked' : ''}>
          新カード特効
        </label>`;
      col.appendChild(checksEl);
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

  /* 特効チェックボックス */
  container.querySelectorAll('.slot-tokko-check').forEach(input => {
    input.addEventListener('change', e => {
      const idx = +e.target.dataset.slot;
      if (deck[idx]) { deck[idx].isTokkoTarget = e.target.checked; renderDeckStats(); }
    });
  });
  container.querySelectorAll('.slot-new-tokko-check').forEach(input => {
    input.addEventListener('change', e => {
      const idx = +e.target.dataset.slot;
      if (deck[idx]) { deck[idx].isNewCardTokko = e.target.checked; renderDeckStats(); }
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
  if (text) cards = cards.filter(c => [c.cardName, c.charName, c.gensaku, c.workName].some(v => (v || '').toLowerCase().includes(text)));
  if (rar)  cards = cards.filter(c => c.rarity    === rar);
  if (attr) cards = cards.filter(c => c.attribute === attr);
  if (work) cards = cards.filter(c => c.workName  === work);

  if (!cards.length) {
    grid.innerHTML = '<div class="empty-state">カードが見つかりません</div>';
    return;
  }

  const inDeckIds = new Set(deck.filter(Boolean).map(s => s.card.id));
  grid.innerHTML = cards.map(c => {
    const skill = c.skillId ? Storage.skills.get(c.skillId) : null;
    const ougi  = c.ougiId  ? Storage.ougi.get(c.ougiId)   : null;
    return `
    <div class="card-thumb${inDeckIds.has(c.id) ? ' in-deck' : ''}" data-id="${esc(c.id)}" title="${esc(c.cardName)}">
      <div class="card-thumb-badges">
        <span class="card-thumb-rarity rarity-${esc(c.rarity)}">${esc(c.rarity)}</span>
        <span class="card-thumb-attr attr-${esc(c.attribute)}">${esc(c.attribute)}</span>
        ${c.workName ? `<span class="card-thumb-work">${esc(c.workName)}</span>` : ''}
      </div>
      <div class="card-thumb-name">${esc(c.cardName)}</div>
      <div class="card-thumb-char">${esc(c.charName)}</div>
      <div class="card-thumb-stat">脅迫力：${fmt(c.power)}</div>
      <div class="card-thumb-stat">耐久力：${fmt(c.hp)}</div>
      <div class="card-thumb-stat">${skill ? esc(skill.name) : '—'}</div>
      <div class="card-thumb-stat">${ougi  ? esc(ougi.name)  : '—'}</div>
    </div>`;
  }).join('');

  grid.querySelectorAll('.card-thumb').forEach(el => {
    el.addEventListener('click', () => onCardThumbClick(el.dataset.id));
  });
}

function onCardThumbClick(cardId) {
  const card = Storage.cards.get(cardId);
  if (!card || _pickingSlot < 0) return;
  deck[_pickingSlot] = { card, lbLv: 0, skillLv: 1, isTokkoTarget: false, isNewCardTokko: false };
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
    ${card.gensaku ? detailRow('原作', card.gensaku) : ''}
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

  const skillThreat = activations.filter(a => a.active).reduce((s, a) => s + a.threatBuff, 0);
  const skillHp     = activations.filter(a => a.active).reduce((s, a) => s + a.hpBuff,     0);

  const baseThreat = slots.reduce((s, slot) => s + num(slot.card.power), 0);
  const baseHp     = slots.reduce((s, slot) => s + num(slot.card.hp),    0);
  const lbThreat   = slots.reduce((s, slot) => s + lbBonus(slot.card, slot.lbLv), 0);
  const lbHp       = slots.reduce((s, slot) => s + lbBonus(slot.card, slot.lbLv), 0);

  const { threat: tokuboThreat, hp: tokuboHp } = calcTokutsuboBonus(slots);
  const { fukyoThreat, fukyoHp, tokkoThreat: corrTokkoThreat, tokkoHp: corrTokkoHp, newCardTokkoThreat: corrNewTokkoThreat, newCardTokkoHp } = calcCorrectionBonus(slots);

  const totalThreat = baseThreat + lbThreat + skillThreat + tokuboThreat + fukyoThreat + corrTokkoThreat + corrNewTokkoThreat;
  const totalHp     = baseHp     + lbHp     + skillHp     + tokuboHp     + fukyoHp + corrTokkoHp + newCardTokkoHp;

  const attrStr = Object.entries(
    slots.reduce((acc, s) => { acc[s.card.attribute] = (acc[s.card.attribute] || 0) + 1; return acc; }, {})
  ).map(([k, v]) => `${k}×${v}`).join(' / ');

  function buffParts(lb, skill, tokubo, fukuyo, tokko, newTokko) {
    const parts = [];
    if (lb       > 0) parts.push(`<span class="stat-buff lb">+${fmt(lb)} 限突</span>`);
    if (skill    > 0) parts.push(`<span class="stat-buff skill">+${fmt(skill)} 特技</span>`);
    if (tokubo   > 0) parts.push(`<span class="stat-buff tokubo">+${fmt(tokubo)} 特壺</span>`);
    if (fukuyo   > 0) parts.push(`<span class="stat-buff fukuyo">+${fmt(fukuyo)} 布教</span>`);
    if (tokko    > 0) parts.push(`<span class="stat-buff tokko">+${fmt(tokko)} 特効</span>`);
    if (newTokko > 0) parts.push(`<span class="stat-buff new-tokko">+${fmt(newTokko)} 新特効</span>`);
    return parts.join('');
  }

  statsEl.innerHTML = `
    <div class="stat-row"><span class="stat-label">総脅迫力</span><span class="stat-value">${fmt(totalThreat)}${buffParts(lbThreat, skillThreat, tokuboThreat, fukyoThreat, corrTokkoThreat, corrNewTokkoThreat)}</span></div>
    <div class="stat-row"><span class="stat-label">総耐久力</span><span class="stat-value">${fmt(totalHp)}${buffParts(lbHp, skillHp, tokuboHp, fukyoHp, corrTokkoHp, newCardTokkoHp)}</span></div>
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
  const skillById = Object.fromEntries(allSkills.map(s => [s.id, s]));

  /* スロットごとに1エントリ生成（同じ特技でも複数枚分を個別に扱う） */
  return slots
    .filter(slot => slot.card.skillId && skillById[slot.card.skillId])
    .map(slot => {
      const skill     = skillById[slot.card.skillId];
      const skillLv   = slot.skillLv       || 1;
      const ownerChar = slot.card.charName  || '';
      const ownerWork = slot.card.workName  || '';
      const ownerAttr = slot.card.attribute || '';

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
   布教Lv → 増加率%
---------------------------------------------------------------- */
function fukyoLvToPct(lv) {
  const n = Math.min(50, Math.max(1, Math.round(lv)));
  if (n <= 1) return 0;
  if (n <= 26) return (n - 1) * 0.20;
  return 5.00 + (n - 26) * 0.10;
}

/* ----------------------------------------------------------------
   補正系計算（純粋関数）
   布教Lv: 全カードの脅迫力・耐久力それぞれに増加率%を適用
   特効%: 全カードの耐久力に指定%を適用
---------------------------------------------------------------- */
function calcCorrectionBonus(slots) {
  const fukyoPowerEl = document.getElementById('fukyoPowerLv');
  const fukuyoHpEl   = document.getElementById('fukuyoHpLv');
  const powerLv = Math.min(num(fukyoPowerEl.max) || 50, Math.max(1, num(fukyoPowerEl.value) || 1));
  const hpLv    = Math.min(num(fukuyoHpEl.max)   || 50, Math.max(1, num(fukuyoHpEl.value)   || 1));
  const tokkoPct        = num(document.getElementById('tokkoEffectPct').value)        || 0;
  const newCardTokkoPct = num(document.getElementById('newCardTokkoEffectPct').value) || 0;

  const fukyoPowerPct = fukyoLvToPct(powerLv);
  const fukyoHpPct    = fukyoLvToPct(hpLv);

  const fukyoThreat    = Math.round(slots.reduce((s, slot) => s + slotPower(slot) * fukyoPowerPct / 100, 0));
  const fukyoHp        = Math.round(slots.reduce((s, slot) => s + slotHp(slot)    * fukyoHpPct    / 100, 0));
  const tokkoThreat    = Math.round(slots.filter(slot => slot.isTokkoTarget)
    .reduce((s, slot) => s + slotPower(slot) * tokkoPct        / 100, 0));
  const tokkoHp        = Math.round(slots.filter(slot => slot.isTokkoTarget)
    .reduce((s, slot) => s + slotHp(slot)    * tokkoPct        / 100, 0));
  const newCardTokkoThreat = Math.round(slots.filter(slot => slot.isNewCardTokko)
    .reduce((s, slot) => s + slotPower(slot) * newCardTokkoPct / 100, 0));
  const newCardTokkoHp = Math.round(slots.filter(slot => slot.isNewCardTokko)
    .reduce((s, slot) => s + slotHp(slot)    * newCardTokkoPct / 100, 0));

  return { fukyoThreat, fukyoHp, tokkoThreat, tokkoHp, newCardTokkoThreat, newCardTokkoHp, fukyoPowerPct, fukyoHpPct, tokkoPct, newCardTokkoPct };
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
  sel.innerHTML = '<option value="">特壺: なし</option>' +
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

['fukyoPowerLv', 'fukuyoHpLv'].forEach(id => {
  const el = document.getElementById(id);
  el.addEventListener('input', () => {
    renderDeckStats();
  });
  el.addEventListener('blur', () => {
    const max = num(el.max) || 50;
    const min = num(el.min) || 1;
    el.value = Math.min(max, Math.max(min, num(el.value) || min));
    renderDeckStats();
  });
});

['tokkoEffectPct', 'newCardTokkoEffectPct'].forEach(id => {
  document.getElementById(id).addEventListener('input', renderDeckStats);
});

/* ----------------------------------------------------------------
   デッキ保存 / 読み込み（localStorage）
   保存形式: { id, name, savedAt, tokutsuboChar, tokutsuboLv, slots[] }
   slots の各要素: { cardId, lbLv, skillLv } | null
---------------------------------------------------------------- */
const SAVED_DECKS_KEY = 'hisaku_saved_decks';
const MAX_SAVED_DECKS = 5;

const saveDeckModal   = setupModal('saveDeckOverlay',   'saveDeckClose');
const savedDecksModal = setupModal('savedDecksOverlay', 'savedDecksClose');

function getSavedDecks() {
  try { return JSON.parse(localStorage.getItem(SAVED_DECKS_KEY) || '[]'); }
  catch { return []; }
}

function persistSavedDecks(decks) {
  localStorage.setItem(SAVED_DECKS_KEY, JSON.stringify(decks));
}

function deckToSaveData() {
  return {
    tokutsuboChar: document.getElementById('tokutsuboChar').value,
    tokutsuboLv:   +document.getElementById('tokutsuboLv').value || 1,
    slots: deck.map(slot => slot ? { cardId: slot.card.id, lbLv: slot.lbLv, skillLv: slot.skillLv || 1 } : null)
  };
}

function applyDeckSaveData(data) {
  document.getElementById('tokutsuboChar').value = data.tokutsuboChar || '';
  document.getElementById('tokutsuboLv').value   = data.tokutsuboLv   || 1;
  deck = (data.slots || []).map(s => {
    if (!s) return null;
    const card = Storage.cards.get(s.cardId);
    return card ? { card, lbLv: s.lbLv || 0, skillLv: s.skillLv || 1, isTokkoTarget: false, isNewCardTokko: false } : null;
  });
}

function doSaveDeck(name) {
  const saved = getSavedDecks();
  const data  = deckToSaveData();
  if (!data.slots.some(Boolean)) return 'デッキにカードがありません';
  if (saved.length >= MAX_SAVED_DECKS) return `保存できるデッキは最大 ${MAX_SAVED_DECKS} 件です`;
  saved.push({ id: 'deck_' + Date.now(), name: name || '名無しデッキ', savedAt: Date.now(), ...data });
  persistSavedDecks(saved);
  return null;
}

function overwriteSavedDeck(id) {
  const saved = getSavedDecks();
  const idx   = saved.findIndex(d => d.id === id);
  if (idx < 0) return;
  const data = deckToSaveData();
  if (!data.slots.some(Boolean)) { showToast('デッキにカードがありません', true); return; }
  saved[idx] = { ...saved[idx], ...data, savedAt: Date.now() };
  persistSavedDecks(saved);
  renderSavedDecksList();
  showToast('上書き保存しました');
}

function deleteSavedDeck(id) {
  persistSavedDecks(getSavedDecks().filter(d => d.id !== id));
  renderSavedDecksList();
}

function renderSavedDecksList() {
  const el    = document.getElementById('savedDecksList');
  const saved = getSavedDecks();

  document.getElementById('savedDecksCount').textContent = `${saved.length} / ${MAX_SAVED_DECKS} 件保存中`;

  if (!saved.length) {
    el.innerHTML = '<div class="empty-state">保存済みデッキはありません</div>';
    return;
  }

  el.innerHTML = saved.map(d => {
    const cardCount = (d.slots || []).filter(Boolean).length;
    const dateStr   = new Date(d.savedAt).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    return `<div class="saved-deck-item">
      <div class="saved-deck-info">
        <div class="saved-deck-name">${esc(d.name)}</div>
        <div class="saved-deck-meta">${cardCount}枚 &nbsp;·&nbsp; ${dateStr}</div>
      </div>
      <div class="saved-deck-actions">
        <button class="btn btn-sm btn-primary  saved-deck-load"      data-id="${esc(d.id)}">読み込む</button>
        <button class="btn btn-sm btn-secondary saved-deck-overwrite" data-id="${esc(d.id)}">上書き</button>
        <button class="btn btn-sm btn-danger    saved-deck-delete"    data-id="${esc(d.id)}">削除</button>
      </div>
    </div>`;
  }).join('');

  el.querySelectorAll('.saved-deck-load').forEach(btn => {
    btn.addEventListener('click', () => {
      const d = getSavedDecks().find(x => x.id === btn.dataset.id);
      if (!d) return;
      applyDeckSaveData(d);
      renderDeckSlots();
      renderDeckStats();
      savedDecksModal.close();
      showToast('デッキを読み込みました');
    });
  });

  el.querySelectorAll('.saved-deck-overwrite').forEach(btn => {
    btn.addEventListener('click', () => overwriteSavedDeck(btn.dataset.id));
  });

  el.querySelectorAll('.saved-deck-delete').forEach(btn => {
    btn.addEventListener('click', () =>
      openConfirm('このデッキを削除しますか？', () => deleteSavedDeck(btn.dataset.id))
    );
  });
}

/* 保存ボタン */
document.getElementById('btnSaveDeck').addEventListener('click', () => {
  const saved = getSavedDecks();
  document.getElementById('saveDeckName').value        = '';
  document.getElementById('saveDeckError').textContent = '';
  document.getElementById('saveDeckSlotInfo').textContent =
    `保存済み: ${saved.length} / ${MAX_SAVED_DECKS}`;
  saveDeckModal.open();
  setTimeout(() => document.getElementById('saveDeckName').focus(), 50);
});

document.getElementById('saveDeckConfirm').addEventListener('click', () => {
  const name = document.getElementById('saveDeckName').value.trim() || '名無しデッキ';
  const err  = doSaveDeck(name);
  if (err) { document.getElementById('saveDeckError').textContent = err; return; }
  saveDeckModal.close();
  showToast('デッキを保存しました');
});

document.getElementById('saveDeckName').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('saveDeckConfirm').click();
});

/* 保存済み一覧ボタン */
document.getElementById('btnOpenSavedDecks').addEventListener('click', () => {
  renderSavedDecksList();
  savedDecksModal.open();
});
