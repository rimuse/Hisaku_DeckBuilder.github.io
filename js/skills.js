/**
 * skills.js — スキル登録ページ
 * 依存: storage.js / utils.js / modal.js / ougi.js（renderOugiList）
 * 他モジュールへの呼び出し: populateSkillSelect()（cards.js）
 */

/* ----------------------------------------------------------------
   ページ初期化
---------------------------------------------------------------- */
function initSkillsPage() {
  refreshCondSuggestions();
}

/* ----------------------------------------------------------------
   効果なしチェックボックス
---------------------------------------------------------------- */
document.getElementById('skillNoEffect').addEventListener('change', function () {
  document.getElementById('skillEffectSection').hidden = this.checked;
});

/* ----------------------------------------------------------------
   発動条件リスト（ローカル状態）
---------------------------------------------------------------- */
let skillConditions = [];

function renderCondList() {
  const el = document.getElementById('condList');
  if (!skillConditions.length) {
    el.innerHTML = '<span class="empty-hint">条件なし（常時発動）</span>';
    return;
  }
  el.innerHTML = skillConditions.map((c, i) => {
    const isOwner = c.type === 'owner_character' || c.type === 'owner_work' || c.type === 'owner_attribute';
    const valPart = isOwner ? '' : `: ${esc(c.value)}`;
    return `
    <span class="cond-tag">
      ${condLabel(c.type)}${valPart} ≥ ${c.minCount}枚
      <button type="button" class="cond-tag-remove" data-i="${i}">&times;</button>
    </span>`;
  }).join('');
  el.querySelectorAll('.cond-tag-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      skillConditions.splice(+btn.dataset.i, 1);
      renderCondList();
    });
  });
}

/* 条件追加ボタン */
document.getElementById('btnAddCond').addEventListener('click', () => {
  const type    = document.getElementById('condType').value;
  const isOwner = type === 'owner_character' || type === 'owner_work' || type === 'owner_attribute';
  const isAttr  = type === 'attribute';
  const count   = parseInt(document.getElementById('condMinCount').value, 10) || 1;
  let value = '';
  if (isAttr) {
    value = document.querySelector('input[name="condAttrVal"]:checked')?.value || '';
    if (!value) { alert('属性を選択してください'); return; }
  } else if (!isOwner) {
    value = document.getElementById('condValue').value.trim();
    if (!value) { alert('条件の値を入力してください'); return; }
    document.getElementById('condValue').value = '';
  }
  skillConditions.push({ type, value, minCount: count });
  renderCondList();
});

/* 条件タイプ変更 → サジェスト・入力欄切り替え */
document.getElementById('condType').addEventListener('change', function () {
  const inp     = document.getElementById('condValue');
  const sepEl   = document.getElementById('condValueSep');
  const attrGr  = document.getElementById('condAttrGroup');
  const isOwner = this.value === 'owner_character' || this.value === 'owner_work' || this.value === 'owner_attribute';
  const isAttr  = this.value === 'attribute';

  inp.hidden    = isOwner || isAttr;
  sepEl.hidden  = isOwner;
  attrGr.hidden = !isAttr;

  if (isOwner || isAttr) {
    inp.value = '';
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
  document.getElementById('condValueSuggestions').innerHTML =
    (type === 'work' ? works : chars).map(v => `<option value="${esc(v)}">`).join('');
}

/* ----------------------------------------------------------------
   発動対象リスト（ローカル状態）
---------------------------------------------------------------- */
let skillTargets = [];

/** 旧 target 単体形式との後方互換正規化 */
function getSkillTargets(skill) {
  if (skill.targets?.length) return skill.targets.slice();
  if (skill.target && skill.target.type !== 'all') return [{ ...skill.target }];
  return [];
}

function renderTargetList() {
  const el = document.getElementById('targetList');
  if (!skillTargets.length) {
    el.innerHTML = '<span class="empty-hint">対象なし（全体）</span>';
    return;
  }
  el.innerHTML = skillTargets.map((t, i) => {
    const isOwner = t.type === 'owner_character' || t.type === 'owner_work' || t.type === 'owner_attribute';
    const valPart = isOwner ? '' : `：${esc(t.value)}`;
    return `<span class="cond-tag">
      ${condLabel(t.type)}${valPart}
      <button type="button" class="cond-tag-remove" data-i="${i}">&times;</button>
    </span>`;
  }).join('<span class="or-sep">または</span>');
  el.querySelectorAll('.cond-tag-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      skillTargets.splice(+btn.dataset.i, 1);
      renderTargetList();
    });
  });
}

/* 対象追加ボタン */
document.getElementById('btnAddTarget').addEventListener('click', () => {
  const type    = document.getElementById('targetAddType').value;
  if (type === 'all') {
    skillTargets = [];
    renderTargetList();
    return;
  }
  const isOwner = type === 'owner_character' || type === 'owner_work' || type === 'owner_attribute';
  let value = '';
  if (type === 'attribute') {
    value = document.querySelector('input[name="targetAddAttrVal"]:checked')?.value || '';
    if (!value) { alert('属性を選択してください'); return; }
  } else if (!isOwner) {
    value = document.getElementById('targetAddValue').value.trim();
    if (!value) { alert('対象の値を入力してください'); return; }
    document.getElementById('targetAddValue').value = '';
  }
  skillTargets.push({ type, value });
  renderTargetList();
});

/* 対象タイプ変更 → 入力欄切り替え */
document.getElementById('targetAddType').addEventListener('change', function () {
  const inp    = document.getElementById('targetAddValue');
  const sepEl  = document.getElementById('targetAddValueSep');
  const attrGr = document.getElementById('targetAddAttrGroup');
  const isAll   = this.value === 'all';
  const isOwner = this.value === 'owner_character' || this.value === 'owner_work' || this.value === 'owner_attribute';
  const isAttr  = this.value === 'attribute';

  inp.hidden    = isAll || isOwner || isAttr;
  sepEl.hidden  = isAll || isOwner;
  attrGr.hidden = !isAttr;

  if (isAll || isOwner || isAttr) inp.value = '';
  if (!isAll && !isOwner && !isAttr) refreshTargetSuggestions();
});

function refreshTargetSuggestions() {
  const cards = Storage.cards.getAll();
  const chars = [...new Set(cards.map(c => c.charName).filter(Boolean))].sort();
  const works = [...new Set(cards.map(c => c.workName).filter(Boolean))].sort();
  const type  = document.getElementById('targetAddType').value;
  document.getElementById('targetAddValueSuggestions').innerHTML =
    (type === 'work' ? works : chars).map(v => `<option value="${esc(v)}">`).join('');
}

/* ----------------------------------------------------------------
   登録済みスキル一覧
---------------------------------------------------------------- */
function renderSkillList() {
  const el     = document.getElementById('skillList');
  const skills = Storage.skills.getAll();

  if (!skills.length) {
    el.innerHTML = '<div class="empty-state">特技が登録されていません</div>';
    return;
  }

  el.innerHTML = skills.map(s => {
    const conds = (s.conditions || [])
      .map(c => {
        const isOwner = c.type === 'owner_character' || c.type === 'owner_work' || c.type === 'owner_attribute';
        return `${condLabel(c.type)}${isOwner ? '' : ':' + esc(c.value)}≥${c.minCount}`;
      })
      .join(' AND ') || '常時発動';
    const noEffect = !!s.noEffect;
    const tInit = s.threatPctInit     ?? s.threatPct     ?? 0;
    const tMax  = s.threatPctMax      ?? s.threatPct     ?? 0;
    const eInit = s.endurancePctInit  ?? s.endurancePct  ?? 0;
    const eMax  = s.endurancePctMax   ?? s.endurancePct  ?? 0;
    const effs = noEffect ? '効果なし' : (
      [
        (tInit || tMax) ? `脅${tInit}%→${tMax}%` : '',
        (eInit || eMax) ? `耐${eInit}%→${eMax}%` : ''
      ].filter(Boolean).join('/') || '—'
    );
    const targets = getSkillTargets(s);
    const targetStr = targets.length
      ? targets.map(t => {
          const isOwner = t.type === 'owner_character' || t.type === 'owner_work' || t.type === 'owner_attribute';
          return condLabel(t.type) + (isOwner ? '' : ':' + esc(t.value));
        }).join(' OR ')
      : '全体';
    const nameBadges = [
      s.maxSkillLv && !noEffect ? `<span class="skill-lv-badge">最大Lv${s.maxSkillLv}</span>` : '',
      noEffect                  ? `<span class="no-effect-badge">効果なし</span>` : '',
    ].join('');

    return `<div class="list-item">
      <div class="list-item-main">
        <div class="list-item-name">${esc(s.name)}${nameBadges}</div>
        <div class="list-item-sub">条件: ${conds}</div>
        <div class="list-item-sub">効果: ${targetStr}${noEffect ? '' : ' — ' + effs}</div>
      </div>
      <div class="list-item-actions">
        <button class="icon-btn edit"   data-id="${esc(s.id)}">編集</button>
        <button class="icon-btn delete" data-id="${esc(s.id)}">削除</button>
      </div>
    </div>`;
  }).join('');

  el.querySelectorAll('.icon-btn.edit').forEach(btn =>
    btn.addEventListener('click', () => { skillListModal.close(); editSkill(btn.dataset.id); })
  );
  el.querySelectorAll('.icon-btn.delete').forEach(btn =>
    btn.addEventListener('click', () => deleteSkill(btn.dataset.id))
  );
}

/* ----------------------------------------------------------------
   フォーム操作
---------------------------------------------------------------- */
function resetSkillForm() {
  document.getElementById('skillForm').reset();
  document.getElementById('skillId').value = '';
  skillConditions = [];
  renderCondList();
  skillTargets = [];
  renderTargetList();
  document.getElementById('skillNoEffect').checked      = false;
  document.getElementById('skillEffectSection').hidden  = false;
  document.getElementById('skillFormTitle').textContent = '新規特技登録';
  document.getElementById('skillCancelBtn').hidden      = true;
  document.getElementById('maxSkillLv').value           = 1;
  document.getElementById('effectThreatInit').value     = 0;
  document.getElementById('effectEnduranceInit').value  = 0;
  document.getElementById('effectThreatMax').value      = 0;
  document.getElementById('effectEnduranceMax').value   = 0;
}

function editSkill(id) {
  const s = Storage.skills.get(id);
  if (!s) return;

  document.getElementById('skillId').value              = s.id;
  document.getElementById('skillName').value            = s.name             || '';
  document.getElementById('skillNoEffect').checked      = !!s.noEffect;
  document.getElementById('skillEffectSection').hidden  = !!s.noEffect;
  document.getElementById('maxSkillLv').value           = s.maxSkillLv       || 1;
  document.getElementById('effectThreatInit').value     = s.threatPctInit    ?? s.threatPct    ?? 0;
  document.getElementById('effectEnduranceInit').value  = s.endurancePctInit ?? s.endurancePct ?? 0;
  document.getElementById('effectThreatMax').value      = s.threatPctMax     ?? s.threatPct    ?? 0;
  document.getElementById('effectEnduranceMax').value   = s.endurancePctMax  ?? s.endurancePct ?? 0;

  skillConditions = (s.conditions || []).slice();
  renderCondList();

  skillTargets = getSkillTargets(s);
  renderTargetList();

  document.getElementById('skillFormTitle').textContent = '特技編集';
  document.getElementById('skillCancelBtn').hidden = false;
  document.getElementById('skillForm').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function deleteSkill(id) {
  const s = Storage.skills.get(id);
  if (!s) return;
  openConfirm(`「${s.name}」を削除しますか？`, () => {
    Storage.skills.delete(id);
    renderSkillList();
  });
}

document.getElementById('skillForm').addEventListener('submit', e => {
  e.preventDefault();

  const noEffect = document.getElementById('skillNoEffect').checked;
  const maxLv    = noEffect ? 1 : (num(document.getElementById('maxSkillLv').value) || 1);
  const tInit    = noEffect ? 0 : num(document.getElementById('effectThreatInit').value);
  const tMax     = noEffect ? 0 : num(document.getElementById('effectThreatMax').value);
  const eInit    = noEffect ? 0 : num(document.getElementById('effectEnduranceInit').value);
  const eMax     = noEffect ? 0 : num(document.getElementById('effectEnduranceMax').value);
  const calcRise = (init, max, lv) => lv > 1 ? (max - init) / (lv - 1) : 0;

  Storage.skills.save({
    id:               document.getElementById('skillId').value || undefined,
    name:             document.getElementById('skillName').value.trim(),
    conditions:       skillConditions.slice(),
    targets:          skillTargets.slice(),
    noEffect:         noEffect || undefined,
    maxSkillLv:       noEffect ? undefined : maxLv,
    threatPctInit:    noEffect ? undefined : tInit,
    endurancePctInit: noEffect ? undefined : eInit,
    threatPctMax:     noEffect ? undefined : tMax,
    endurancePctMax:  noEffect ? undefined : eMax,
    threatRise:       noEffect ? undefined : calcRise(tInit, tMax, maxLv),
    enduranceRise:    noEffect ? undefined : calcRise(eInit, eMax, maxLv),
  });
  resetSkillForm();
  renderSkillList();
  populateSkillSelect(); /* cards.js */
});

document.getElementById('skillCancelBtn').addEventListener('click', resetSkillForm);
