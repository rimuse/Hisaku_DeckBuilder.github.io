/**
 * skills.js — スキル登録ページ
 * 依存: storage.js / utils.js / modal.js / ougi.js（renderOugiList）
 * 他モジュールへの呼び出し: populateSkillSelect()（cards.js）
 */

/* ----------------------------------------------------------------
   ページ初期化
---------------------------------------------------------------- */
function initSkillsPage() {
  renderSkillList();
  renderOugiList();    /* ougi.js */
  refreshCondSuggestions();
}

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

/* 条件追加ボタン */
document.getElementById('btnAddCond').addEventListener('click', () => {
  const type  = document.getElementById('condType').value;
  const value = document.getElementById('condValue').value.trim();
  const count = parseInt(document.getElementById('condMinCount').value, 10) || 1;
  if (!value) { alert('条件の値を入力してください'); return; }
  skillConditions.push({ type, value, minCount: count });
  document.getElementById('condValue').value = '';
  renderCondList();
});

/* 条件タイプ変更 → サジェスト切り替え */
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
  document.getElementById('condValueSuggestions').innerHTML =
    (type === 'work' ? works : chars).map(v => `<option value="${esc(v)}">`).join('');
}

/* ----------------------------------------------------------------
   発動対象 ラジオ切り替え
---------------------------------------------------------------- */
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
    wrap.innerHTML = `
      <input type="text" id="targetValueInput" class="form-input" placeholder="値を入力" list="targetValList" autocomplete="off">
      <datalist id="targetValList">${vals.map(v => `<option value="${esc(v)}">`).join('')}</datalist>`;
  }
});

/* ----------------------------------------------------------------
   登録済みスキル一覧
---------------------------------------------------------------- */
function renderSkillList() {
  const el     = document.getElementById('skillList');
  const skills = Storage.skills.getAll();

  if (!skills.length) {
    el.innerHTML = '<div class="empty-state">スキルが登録されていません</div>';
    return;
  }

  el.innerHTML = skills.map(s => {
    const conds = (s.conditions || [])
      .map(c => `${condLabel(c.type)}:${esc(c.value)}≥${c.minCount}`)
      .join(' AND ') || '常時発動';
    const effs = [
      s.threatPct    ? `脅${s.threatPct}%`    : '',
      s.endurancePct ? `耐${s.endurancePct}%` : ''
    ].filter(Boolean).join('/') || '—';

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

  el.querySelectorAll('.icon-btn.edit').forEach(btn =>
    btn.addEventListener('click', () => editSkill(btn.dataset.id))
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
  const wrap = document.getElementById('targetValueWrap');
  wrap.hidden    = true;
  wrap.innerHTML = '';
  document.getElementById('skillFormTitle').textContent = '新規スキル登録';
  document.getElementById('skillCancelBtn').hidden      = true;
  document.getElementById('effectThreat').value         = 0;
  document.getElementById('effectEndurance').value      = 0;
}

function editSkill(id) {
  const s = Storage.skills.get(id);
  if (!s) return;

  document.getElementById('skillId').value         = s.id;
  document.getElementById('skillName').value       = s.name          || '';
  document.getElementById('effectThreat').value    = s.threatPct     || 0;
  document.getElementById('effectEndurance').value = s.endurancePct  || 0;
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
  openConfirm(`「${s.name}」を削除しますか？`, () => {
    Storage.skills.delete(id);
    renderSkillList();
  });
}

document.getElementById('skillForm').addEventListener('submit', e => {
  e.preventDefault();

  const targetType = document.querySelector('input[name="targetType"]:checked')?.value || 'all';
  let targetValue  = '';
  if (targetType !== 'all') {
    const wrap = document.getElementById('targetValueWrap');
    targetValue = targetType === 'attribute'
      ? (wrap.querySelector('input[name="targetValue"]:checked')?.value || '')
      : (wrap.querySelector('input[type="text"]')?.value.trim() || '');
    if (!targetValue) { alert('発動対象の値を入力してください'); return; }
  }

  Storage.skills.save({
    id:           document.getElementById('skillId').value || undefined,
    name:         document.getElementById('skillName').value.trim(),
    conditions:   skillConditions.slice(),
    target:       { type: targetType, value: targetValue },
    threatPct:    num(document.getElementById('effectThreat').value),
    endurancePct: num(document.getElementById('effectEndurance').value),
  });
  resetSkillForm();
  renderSkillList();
  populateSkillSelect(); /* cards.js */
});

document.getElementById('skillCancelBtn').addEventListener('click', resetSkillForm);
