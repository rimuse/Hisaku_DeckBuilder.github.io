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
   発動条件（OR グループ）ヘルパー
   1グループ = 複数条件の AND、グループ間は OR
   旧データ（conditions + condMinCount のみ）は単一グループとして扱う
---------------------------------------------------------------- */
function getSkillConditionGroups(skill) {
  if (skill.conditionGroups?.length) return skill.conditionGroups;
  if (skill.conditions?.length) return [{ conditions: skill.conditions, minCount: skill.condMinCount }];
  return [];
}

/** OR グループ配列 → 表示用文字列（グループ内は「かつ」、グループ間は「または」） */
function formatConditionGroups(groups) {
  if (!groups.length) return '常時発動';
  return groups.map(g => {
    const condItems = g.conditions || [];
    if (!condItems.length) return '常時発動';
    const parts = condItems.map(c => {
      const isOwner = c.type === 'owner_character' || c.type === 'owner_work' || c.type === 'owner_attribute';
      return `${condLabel(c.type)}${isOwner ? '' : ':' + esc(c.value)}`;
    });
    if (g.minCount !== undefined) return `${parts.join(' かつ ')} ≥${g.minCount}枚`;
    /* 旧データ互換: 条件ごとに minCount */
    return condItems.map((c, i) => `${parts[i]}≥${c.minCount ?? 1}`).join(' かつ ');
  }).join(' または ');
}

/* ----------------------------------------------------------------
   発動条件リスト（ローカル状態）
   skillConditionGroups: 確定済みの OR グループ
   skillConditions      : 編集中（未確定）のグループの条件
---------------------------------------------------------------- */
let skillConditions = [];
let skillConditionGroups = [];

function renderCondGroupList() {
  const el = document.getElementById('condGroupList');
  if (!skillConditionGroups.length) { el.innerHTML = ''; return; }
  el.innerHTML = skillConditionGroups.map((g, i) => {
    const parts = (g.conditions || []).map(c => {
      const isOwner = c.type === 'owner_character' || c.type === 'owner_work' || c.type === 'owner_attribute';
      return `${condLabel(c.type)}${isOwner ? '' : ':' + esc(c.value)}`;
    }).join(' かつ ');
    const countLabel = g.minCount !== undefined ? ` ≥${g.minCount}枚` : '';
    return `<span class="cond-tag">
      ${parts || '条件なし'}${countLabel}
      <button type="button" class="cond-tag-remove" data-i="${i}">&times;</button>
    </span>`;
  }).join('<span class="or-sep">または</span>');
  el.querySelectorAll('.cond-tag-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      skillConditionGroups.splice(+btn.dataset.i, 1);
      renderCondGroupList();
    });
  });
}

/* 現在編集中の条件を OR グループとして確定 */
document.getElementById('btnAddCondGroup').addEventListener('click', () => {
  if (!skillConditions.length) { alert('条件を1つ以上追加してください'); return; }
  const minCount = num(document.getElementById('skillCondMinCount').value) || 1;
  skillConditionGroups.push({ conditions: skillConditions.slice(), minCount });
  skillConditions = [];
  renderCondList();
  document.getElementById('skillCondMinCount').value = 1;
  renderCondGroupList();
});

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
      ${condLabel(c.type)}${valPart}
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
  let value = '';
  if (isAttr) {
    value = document.querySelector('input[name="condAttrVal"]:checked')?.value || '';
    if (!value) { alert('属性を選択してください'); return; }
  } else if (!isOwner) {
    value = document.getElementById('condValue').value.trim();
    if (!value) { alert('条件の値を入力してください'); return; }
    document.getElementById('condValue').value = '';
  }
  skillConditions.push({ type, value });
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
function _sortSkillList(list, sortVal) {
  if (sortVal === 'name-asc')  return list.slice().sort((a, b) => a.name.localeCompare(b.name, 'ja'));
  if (sortVal === 'name-desc') return list.slice().sort((a, b) => b.name.localeCompare(a.name, 'ja'));
  if (sortVal === 'reg-desc')  return list.slice().reverse();
  return list.slice(); /* reg-asc: 登録順（古い順） */
}

document.getElementById('skillListSort').addEventListener('change', renderSkillList);
document.getElementById('skillListSearch').addEventListener('input', renderSkillList);

function renderSkillList() {
  const el      = document.getElementById('skillList');
  const sortVal = document.getElementById('skillListSort').value;
  const query   = document.getElementById('skillListSearch').value.toLowerCase();
  let skills    = _sortSkillList(Storage.skills.getAll(), sortVal);
  if (query) skills = skills.filter(s => s.name.toLowerCase().includes(query));

  if (!skills.length) {
    el.innerHTML = `<div class="empty-state">${query ? '検索結果が見つかりません' : '特技が登録されていません'}</div>`;
    return;
  }

  el.innerHTML = skills.map(s => {
    const conds = formatConditionGroups(getSkillConditionGroups(s));
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
  skillConditionGroups = [];
  renderCondGroupList();
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
  document.getElementById('skillCondMinCount').value    = 1;
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

  /* 既存グループのうち最後の1件を編集中欄に、それより前は確定済み OR グループとして読み込む */
  const allGroups = getSkillConditionGroups(s);
  if (allGroups.length) {
    const editing = allGroups[allGroups.length - 1];
    skillConditionGroups = allGroups.slice(0, -1).map(g => ({
      conditions: (g.conditions || []).map(c => ({ type: c.type, value: c.value })),
      minCount: g.minCount,
    }));
    skillConditions = (editing.conditions || []).map(c => ({ type: c.type, value: c.value }));
    renderCondList();
    /* 旧データ（minCount なし）は最初の条件の minCount を引き継ぐ */
    document.getElementById('skillCondMinCount').value =
      editing.minCount ?? editing.conditions?.[0]?.minCount ?? 1;
  } else {
    skillConditionGroups = [];
    skillConditions = [];
    renderCondList();
    document.getElementById('skillCondMinCount').value = 1;
  }
  renderCondGroupList();

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

  const condMinCount = num(document.getElementById('skillCondMinCount').value) || 1;
  const conditionGroups = skillConditionGroups.slice();
  if (skillConditions.length) {
    conditionGroups.push({ conditions: skillConditions.slice(), minCount: condMinCount });
  }

  Storage.skills.save({
    id:               document.getElementById('skillId').value || undefined,
    name:             document.getElementById('skillName').value.trim(),
    conditionGroups:  conditionGroups,
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
