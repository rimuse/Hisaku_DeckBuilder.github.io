/**
 * reginfo.js — 登録情報確認画面
 * 依存: storage.js / utils.js / skills.js（getSkillTargets）
 */

/* ----------------------------------------------------------------
   ページ初期化
---------------------------------------------------------------- */
function initRegInfoPage() {
  _refreshRegWorkFilter();
  _refreshRegGensakuFilter();
  _showRegInfoTab('cards');
}

/* ----------------------------------------------------------------
   タブ切り替え
---------------------------------------------------------------- */
function _showRegInfoTab(tab) {
  ['cards', 'skills', 'ougi', 'history'].forEach(t => {
    document.getElementById(`reginfo-tab-${t}`).classList.toggle('active', t === tab);
    document.getElementById(`reginfo-panel-${t}`).hidden = (t !== tab);
  });
  if (tab === 'cards')   renderRegCardList();
  if (tab === 'skills')  renderRegSkillList();
  if (tab === 'ougi')    renderRegOugiList();
  if (tab === 'history') renderRegHistoryList();
}

document.getElementById('reginfo-tab-cards').addEventListener('click',   () => _showRegInfoTab('cards'));
document.getElementById('reginfo-tab-skills').addEventListener('click',  () => _showRegInfoTab('skills'));
document.getElementById('reginfo-tab-ougi').addEventListener('click',    () => _showRegInfoTab('ougi'));
document.getElementById('reginfo-tab-history').addEventListener('click', () => _showRegInfoTab('history'));

/* ----------------------------------------------------------------
   カード情報一覧
---------------------------------------------------------------- */
['reginfoCardSearch', 'reginfoSkillFilter', 'reginfoOugiFilter', 'reginfoCardRarity', 'reginfoCardAttribute', 'reginfoCardWork', 'reginfoCardGensaku'].forEach(id => {
  document.getElementById(id).addEventListener('input', renderRegCardList);
});
document.getElementById('reginfoCardCsvBtn').addEventListener('click', downloadRegCardCSV);

function _refreshRegWorkFilter() {
  const sel   = document.getElementById('reginfoCardWork');
  const works = [...new Set(Storage.cards.getAll().map(c => c.workName).filter(Boolean))].sort();
  const prev  = sel.value;
  sel.innerHTML = '<option value="">作品: すべて</option>' +
    works.map(w => `<option value="${esc(w)}"${w === prev ? ' selected' : ''}>${esc(w)}</option>`).join('');
}

function _refreshRegGensakuFilter() {
  const sel      = document.getElementById('reginfoCardGensaku');
  const gensakus = [...new Set(Storage.cards.getAll().map(c => c.gensaku).filter(Boolean))].sort();
  const prev     = sel.value;
  sel.innerHTML = '<option value="">原作: すべて</option>' +
    gensakus.map(g => `<option value="${esc(g)}"${g === prev ? ' selected' : ''}>${esc(g)}</option>`).join('');
}

function renderRegCardList() {
  const query   = (document.getElementById('reginfoCardSearch').value || '').toLowerCase();
  const skill   = (document.getElementById('reginfoSkillFilter').value || '').toLowerCase();
  const ougi    = (document.getElementById('reginfoOugiFilter').value  || '').toLowerCase();
  const rar     = document.getElementById('reginfoCardRarity').value;
  const attr    = document.getElementById('reginfoCardAttribute').value;
  const work    = document.getElementById('reginfoCardWork').value;
  const gensaku = document.getElementById('reginfoCardGensaku').value;

  let cards = Storage.cards.getAll().slice().sort((a, b) =>
    (a.cardName || '').localeCompare(b.cardName || '', 'ja')
  );
  if (query)   cards = cards.filter(c =>
    [c.internalId, c.cardName, c.charName, c.workName].some(v => (v || '').toLowerCase().includes(query))
  );
  if (skill)   cards = cards.filter(c => {
    const s = c.skillId ? Storage.skills.get(c.skillId) : null;
    return s && s.name.toLowerCase().includes(skill);
  });
  if (ougi)    cards = cards.filter(c => {
    const o = c.ougiId ? Storage.ougi.get(c.ougiId) : null;
    return o && o.name.toLowerCase().includes(ougi);
  });
  if (rar)     cards = cards.filter(c => c.rarity    === rar);
  if (attr)    cards = cards.filter(c => c.attribute === attr);
  if (work)    cards = cards.filter(c => c.workName  === work);
  if (gensaku) cards = cards.filter(c => c.gensaku   === gensaku);

  const el = document.getElementById('reginfoCardList');
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
        <div class="list-item-sub">${esc(c.charName)}${c.workName ? ' / ' + esc(c.workName) : ''} — ${esc(c.attribute || '')} — 脅 ${fmt(c.power)} / 耐 ${fmt(c.hp)}</div>
        <div class="list-item-sub">特技：${skill ? esc(skill.name) : '—'} ／ 奥義：${ougi ? esc(ougi.name) : '—'}</div>
      </div>
    </div>`;
  }).join('');
}

function downloadRegCardCSV() {
  const cards = Storage.cards.getAll().slice().sort((a, b) =>
    (a.cardName || '').localeCompare(b.cardName || '', 'ja')
  );
  const header = 'ゲーム内ID,カード名,キャラクター名,レア度,作品,属性,脅迫力,耐久力,特技,奥義';
  const rows = cards.map(c => {
    const skill = c.skillId ? Storage.skills.get(c.skillId) : null;
    const ougi  = c.ougiId  ? Storage.ougi.get(c.ougiId)   : null;
    return [
      c.internalId || '',
      c.cardName   || '',
      c.charName   || '',
      c.rarity     || '',
      c.workName   || '',
      c.attribute  || '',
      c.power      || '0',
      c.hp         || '0',
      skill ? skill.name : '',
      ougi  ? ougi.name  : '',
    ].map(_csvCell).join(',');
  });
  _downloadRegCSV(header + '\n' + rows.join('\n'), 'card_list.csv');
}

/* ----------------------------------------------------------------
   特技情報一覧
---------------------------------------------------------------- */
document.getElementById('reginfoSkillSearch').addEventListener('input', renderRegSkillList);
document.getElementById('reginfoSkillCsvBtn').addEventListener('click', downloadRegSkillCSV);

/* インポート用フォーマットに合わせた型→日本語ラベルのマッピング */
const _COND_TYPE_LABEL = {
  character:       'キャラクター名',
  work:            '作品',
  attribute:       '属性',
  owner_character: '所有者キャラクター',
  owner_work:      '所有者作品',
  owner_attribute: '所有者属性',
};
const _TARGET_TYPE_LABEL = {
  all:             '全体',
  character:       'キャラクター名',
  work:            '作品',
  attribute:       '属性',
  owner_character: '所有者キャラクター',
  owner_work:      '所有者作品',
  owner_attribute: '所有者属性',
};

function _conditionsToStr(conditions, condMinCount) {
  if (!conditions || !conditions.length) return '';
  if (condMinCount !== undefined) {
    /* 新形式: 最後の条件に枚数を付加 */
    return conditions.map((c, i) => {
      const label   = _COND_TYPE_LABEL[c.type] || c.type;
      const isOwner = c.type === 'owner_character' || c.type === 'owner_work' || c.type === 'owner_attribute';
      const isLast  = i === conditions.length - 1;
      if (isOwner) return isLast ? `${label}:${condMinCount}` : label;
      return isLast ? `${label}:${c.value}:${condMinCount}` : `${label}:${c.value}`;
    }).join(';');
  }
  /* 旧データ互換: 各条件に minCount */
  return conditions.map(c => {
    const label   = _COND_TYPE_LABEL[c.type] || c.type;
    const isOwner = c.type === 'owner_character' || c.type === 'owner_work' || c.type === 'owner_attribute';
    return isOwner ? `${label}:${c.minCount ?? 1}` : `${label}:${c.value}:${c.minCount ?? 1}`;
  }).join(';');
}

function _targetsToStr(targets) {
  if (!targets || !targets.length) return '全体';
  return targets.map(t => {
    const label   = _TARGET_TYPE_LABEL[t.type] || t.type;
    const isOwner = t.type === 'owner_character' || t.type === 'owner_work' || t.type === 'owner_attribute';
    return isOwner ? label : `${label}:${t.value}`;
  }).join(';');
}

function renderRegSkillList() {
  const query = (document.getElementById('reginfoSkillSearch').value || '').toLowerCase();
  let skills = Storage.skills.getAll().slice().sort((a, b) =>
    (a.name || '').localeCompare(b.name || '', 'ja')
  );
  if (query) skills = skills.filter(s => (s.name || '').toLowerCase().includes(query));

  const el = document.getElementById('reginfoSkillList');
  if (!skills.length) {
    el.innerHTML = '<div class="empty-state">特技が登録されていません</div>';
    return;
  }

  el.innerHTML = skills.map(s => {
    const noEffect = !!s.noEffect;
    const tInit    = s.threatPctInit    ?? s.threatPct    ?? 0;
    const tMax     = s.threatPctMax     ?? s.threatPct    ?? 0;
    const eInit    = s.endurancePctInit ?? s.endurancePct ?? 0;
    const eMax     = s.endurancePctMax  ?? s.endurancePct ?? 0;
    const conds    = _conditionsToStr(s.conditions, s.condMinCount) || '常時発動';
    const targets  = getSkillTargets(s);
    const targetStr = _targetsToStr(targets);
    const effs = noEffect ? '効果なし' : (
      [
        (tInit || tMax) ? `脅 ${tInit}%→${tMax}%` : '',
        (eInit || eMax) ? `耐 ${eInit}%→${eMax}%` : '',
      ].filter(Boolean).join(' / ') || '—'
    );
    const badges = [
      s.maxSkillLv && !noEffect ? `<span class="skill-lv-badge">最大Lv${s.maxSkillLv}</span>` : '',
      noEffect ? '<span class="no-effect-badge">効果なし</span>' : '',
    ].join('');

    return `
    <div class="list-item">
      <div class="list-item-main">
        <div class="list-item-name">${esc(s.name)}${badges}</div>
        <div class="list-item-sub">条件: ${esc(conds)}</div>
        <div class="list-item-sub">対象: ${esc(targetStr)}${noEffect ? '' : ' — ' + effs}</div>
      </div>
    </div>`;
  }).join('');
}

function downloadRegSkillCSV() {
  const skills = Storage.skills.getAll().slice().sort((a, b) =>
    (a.name || '').localeCompare(b.name || '', 'ja')
  );
  const header = '特技名,効果なし,最大特技Lv,発動条件,発動対象,脅迫力(初期値)%,脅迫力(最大値)%,耐久力(初期値)%,耐久力(最大値)%';
  const rows = skills.map(s => {
    const noEffect = !!s.noEffect;
    const targets  = getSkillTargets(s);
    return [
      s.name || '',
      noEffect ? 'true' : '',
      noEffect ? '' : (s.maxSkillLv || 1),
      _conditionsToStr(s.conditions, s.condMinCount),
      _targetsToStr(targets),
      noEffect ? '' : (s.threatPctInit    ?? s.threatPct    ?? 0),
      noEffect ? '' : (s.threatPctMax     ?? s.threatPct    ?? 0),
      noEffect ? '' : (s.endurancePctInit ?? s.endurancePct ?? 0),
      noEffect ? '' : (s.endurancePctMax  ?? s.endurancePct ?? 0),
    ].map(_csvCell).join(',');
  });
  _downloadRegCSV(header + '\n' + rows.join('\n'), 'skill_list.csv');
}

/* ----------------------------------------------------------------
   奥義情報一覧
---------------------------------------------------------------- */
document.getElementById('reginfoOugiSearch').addEventListener('input', renderRegOugiList);
document.getElementById('reginfoOugiCsvBtn').addEventListener('click', downloadRegOugiCSV);

function _ougiTargetStr(targets) {
  if (!targets || !targets.length) return 'すべて';
  return targets.map(t => {
    const label = t.type === 'attribute' ? '属性' :
                  t.type === 'character' ? 'キャラクター名' :
                  t.type === 'work'      ? '作品' : t.type;
    return `${label}：${t.value}`;
  }).join(' かつ ');
}

function renderRegOugiList() {
  const query = (document.getElementById('reginfoOugiSearch').value || '').toLowerCase();
  let list = Storage.ougi.getAll().slice().sort((a, b) =>
    (a.name || '').localeCompare(b.name || '', 'ja')
  );
  if (query) list = list.filter(o => (o.name || '').toLowerCase().includes(query));

  const el = document.getElementById('reginfoOugiList');
  if (!list.length) {
    el.innerHTML = '<div class="empty-state">奥義が登録されていません</div>';
    return;
  }

  el.innerHTML = list.map(o => {
    const noEffect = !!o.noEffect;
    const badge = noEffect ? '<span class="no-effect-badge">効果なし</span>' : '';
    let sub = '';
    if (!noEffect) {
      const lvBadge  = o.maxLv ? `<span class="skill-lv-badge">最大Lv${o.maxLv}</span>` : '';
      const target   = _ougiTargetStr(o.targets);
      const effStr   = o.pattern === 'damage'
        ? `ダメージ ${fmt(o.minRate)}→${fmt(o.maxRate)}倍`
        : `脅迫力上昇 ${fmt(o.minPct)}→${fmt(o.maxPct)}%`;
      sub = `<div class="list-item-sub">対象: ${esc(target)} — ${effStr}${lvBadge}</div>`;
    }
    return `
    <div class="list-item">
      <div class="list-item-main">
        <div class="list-item-name">${esc(o.name)}${badge}</div>
        ${sub}
      </div>
    </div>`;
  }).join('');
}

function downloadRegOugiCSV() {
  const list = Storage.ougi.getAll().slice().sort((a, b) =>
    (a.name || '').localeCompare(b.name || '', 'ja')
  );
  const header = '奥義名,効果なし,最大Lv,対象,パターン,最低%,最大%,最低倍率,最大倍率';
  const rows = list.map(o => {
    const noEffect = !!o.noEffect;
    return [
      o.name || '',
      noEffect ? 'true' : '',
      noEffect ? '' : (o.maxLv || 1),
      noEffect ? '' : _ougiTargetStr(o.targets),
      noEffect ? '' : (o.pattern === 'damage' ? 'ダメージ' : '脅迫力上昇'),
      (noEffect || o.pattern === 'damage')  ? '' : (o.minPct  ?? 0),
      (noEffect || o.pattern === 'damage')  ? '' : (o.maxPct  ?? 0),
      (noEffect || o.pattern !== 'damage')  ? '' : (o.minRate ?? 0),
      (noEffect || o.pattern !== 'damage')  ? '' : (o.maxRate ?? 0),
    ].map(_csvCell).join(',');
  });
  _downloadRegCSV(header + '\n' + rows.join('\n'), 'ougi_list.csv');
}

/* ----------------------------------------------------------------
   登録履歴一覧
---------------------------------------------------------------- */
function renderRegHistoryList() {
  const list = Storage.cardHistory.getAll();
  const el = document.getElementById('reginfo-history-list');
  if (!list.length) {
    el.innerHTML = '<div class="empty-state">登録履歴がありません</div>';
    return;
  }

  el.innerHTML = list.map(h => {
    const dt = new Date(h.timestamp);
    const dateStr = `${dt.getFullYear()}/${String(dt.getMonth()+1).padStart(2,'0')}/${String(dt.getDate()).padStart(2,'0')} ${String(dt.getHours()).padStart(2,'0')}:${String(dt.getMinutes()).padStart(2,'0')}`;
    const actionLabel = h.action === 'create' ? '登録' : '編集';
    return `
    <div class="list-item">
      <div class="list-item-main">
        <div class="list-item-sub">${esc(dateStr)} — <span class="history-action-${esc(h.action || 'create')}">${actionLabel}</span> — ${esc(h.cardName || '—')} / ${esc(h.charName || '—')}</div>
      </div>
    </div>`;
  }).join('');
}

/* ----------------------------------------------------------------
   CSV ユーティリティ
---------------------------------------------------------------- */
function _csvCell(val) {
  const s = String(val);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function _downloadRegCSV(content, filename) {
  const blob = new Blob(['﻿' + content], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), { href: url, download: filename });
  a.click();
  URL.revokeObjectURL(url);
}
