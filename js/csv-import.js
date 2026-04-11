/**
 * csv-import.js — CSV一括インポート機能（カード / 特技 / 奥義）
 * 依存: storage.js / utils.js
 *       cards.js  (renderCardList, refreshWorkSuggestions)
 *       deck.js   (refreshTokutsuboSelect)
 *       skills.js (renderSkillList)
 *       ougi.js   (renderOugiList)
 */

/* ================================================================
   汎用 CSVパーサー（RFC 4180 準拠・BOM 除去対応）
================================================================ */

/**
 * CSVテキストを行オブジェクトの配列に変換する
 * @param {string} text  - CSVテキスト
 * @param {object} colMap - ヘッダー名 → プロパティ名のマッピング
 */
function parseCSVText(text, colMap) {
  text = text.replace(/^\uFEFF/, '');
  const lines = text.split(/\r?\n/);
  if (lines.length < 2) return [];

  const headers = splitCSVRow(lines[0]).map(h => h.trim());
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const vals = splitCSVRow(lines[i]);
    const obj  = {};
    headers.forEach((h, idx) => {
      const key = colMap[h];
      if (key) obj[key] = (vals[idx] || '').trim();
    });
    rows.push(obj);
  }
  return rows;
}

function splitCSVRow(line) {
  const result = [];
  let inQuote = false, current = '';
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuote && line[i + 1] === '"') { current += '"'; i++; }
      else inQuote = !inQuote;
    } else if (ch === ',' && !inQuote) {
      result.push(current); current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

/* ================================================================
   カード CSV インポート
================================================================ */

const CARD_CSV_COL = {
  'ゲーム内ID':    'internalId',
  'カード名':      'cardName',
  'キャラクター名': 'charName',
  'レア度':        'rarity',
  '作品':          'workName',
  '属性':          'attribute',
  '脅迫力':        'power',
  '耐久力':        'hp',
  '特技':          'skillName',
  'スキル':        'skillName',   // 旧列名の後方互換
  '奥義':          'ougiName',
};

const VALID_RARITIES   = new Set(['N', 'R', 'SR', 'SSR']);
const VALID_ATTRIBUTES = new Set(['親愛', '調教', '従順']);

function validateCardRow(row) {
  const errors = [];
  if (!row.cardName)  errors.push('カード名は必須');
  if (!row.charName)  errors.push('キャラクター名は必須');
  if (!VALID_RARITIES.has(row.rarity))
    errors.push(`レア度「${row.rarity || '（空）'}」は無効（N / R / SR / SSR）`);
  if (!VALID_ATTRIBUTES.has(row.attribute))
    errors.push(`属性「${row.attribute || '（空）'}」は無効（親愛 / 調教 / 従順）`);

  if (row.skillName) {
    const skill = Storage.skills.getAll().find(s => s.name === row.skillName);
    if (skill) row.skillId = skill.id;
    else errors.push(`特技「${row.skillName}」が見つかりません`);
  }
  if (row.ougiName) {
    const ougi = Storage.ougi.getAll().find(o => o.name === row.ougiName);
    if (ougi) row.ougiId = ougi.id;
    else errors.push(`奥義「${row.ougiName}」が見つかりません`);
  }
  return errors;
}

function findCardDuplicate(row) {
  const all = Storage.cards.getAll();
  if (row.internalId) {
    const hit = all.find(c => c.internalId === row.internalId);
    if (hit) return { card: hit, reason: `ゲーム内ID「${row.internalId}」が重複` };
  }
  const hit = all.find(c => c.cardName === row.cardName && c.charName === row.charName);
  if (hit) return { card: hit, reason: 'カード名＋キャラクター名が重複' };
  return null;
}

/* --- カードプレビュー --- */
let _parsedCardRows = [];

function runCardPreview(text) {
  const rawRows = parseCSVText(text, CARD_CSV_COL);
  if (!rawRows.length) {
    alert('有効な行が見つかりませんでした。ヘッダー行を含む正しいCSVを入力してください。');
    return;
  }

  _parsedCardRows = rawRows.map(row => {
    const errors = validateCardRow(row);
    const dup    = errors.length === 0 ? findCardDuplicate(row) : null;
    return { data: row, errors, dup };
  });

  const cntOk  = _parsedCardRows.filter(r => r.errors.length === 0 && !r.dup).length;
  const cntDup = _parsedCardRows.filter(r => r.errors.length === 0 &&  r.dup).length;
  const cntErr = _parsedCardRows.filter(r => r.errors.length > 0).length;

  document.getElementById('csvPreviewSummary').innerHTML =
    `合計 ${_parsedCardRows.length} 行　` +
    `<span class="csv-cnt ok">正常 ${cntOk} 件</span>　` +
    `<span class="csv-cnt dup">重複 ${cntDup} 件</span>　` +
    `<span class="csv-cnt err">エラー ${cntErr} 件</span>`;

  const tbody = _parsedCardRows.map((r, i) => {
    let badge, note;
    if (r.errors.length > 0) {
      badge = '<span class="csv-badge err">エラー</span>';
      note  = r.errors.join(' ／ ');
    } else if (r.dup) {
      badge = '<span class="csv-badge dup">重複</span>';
      note  = r.dup.reason;
    } else {
      badge = '<span class="csv-badge ok">正常</span>';
      note  = '';
    }
    const cls = r.errors.length > 0 ? ' class="row-err"' : r.dup ? ' class="row-dup"' : '';
    return `<tr${cls}>
      <td>${i + 2}</td>
      <td>${badge}</td>
      <td>${esc(r.data.cardName  || '')}</td>
      <td>${esc(r.data.charName  || '')}</td>
      <td>${esc(r.data.rarity    || '')}</td>
      <td>${esc(r.data.attribute || '')}</td>
      <td class="csv-note">${esc(note)}</td>
    </tr>`;
  }).join('');

  document.getElementById('csvPreviewTable').innerHTML = `
    <thead><tr>
      <th>行</th><th>状態</th><th>カード名</th><th>キャラクター名</th><th>レア度</th><th>属性</th><th>備考</th>
    </tr></thead>
    <tbody>${tbody}</tbody>`;

  document.getElementById('csvImportBtn').disabled = (cntOk === 0 && cntDup === 0);
  document.getElementById('csvPreview').hidden = false;
  document.getElementById('csvResult').hidden  = true;
}

/* --- カードインポート実行 --- */
function executeCardImport() {
  const mode = document.getElementById('csvDupHandling').value;
  let imported = 0, skipped = 0, overwritten = 0, errored = 0;
  const toSave = [];

  _parsedCardRows.forEach(r => {
    if (r.errors.length > 0) { errored++; return; }

    const cardData = {
      internalId: r.data.internalId || undefined,
      cardName:   r.data.cardName,
      charName:   r.data.charName,
      rarity:     r.data.rarity,
      workName:   r.data.workName   || undefined,
      attribute:  r.data.attribute,
      power:      r.data.power      || '0',
      hp:         r.data.hp         || '0',
      skillId:    r.data.skillId    || undefined,
      ougiId:     r.data.ougiId     || undefined,
    };

    if (r.dup) {
      if (mode === 'skip') { skipped++; return; }
      toSave.push({ ...cardData, id: r.dup.card.id });
      overwritten++;
    } else {
      toSave.push(cardData);
      imported++;
    }
  });

  if (toSave.length > 0) {
    const ok = Storage.cards.saveAll(toSave);
    if (!ok) return;
  }

  _showImportResult('csvResult', 'csvPreview', imported, overwritten, skipped, errored);
  renderCardList();
  refreshWorkSuggestions();
  refreshTokutsuboSelect();
}

/* --- カードサンプルDL --- */
function downloadCardSampleCSV() {
  const header = 'ゲーム内ID,カード名,キャラクター名,レア度,作品,属性,脅迫力,耐久力,特技,奥義';
  const sample = ',サンプルカード,キャラA,SSR,サンプル作品,親愛,10000,10000,,';
  _downloadCSV(header + '\n' + sample, 'card_import_sample.csv');
}

/* ================================================================
   特技 CSV インポート
================================================================ */

const SKILL_CSV_COL = {
  '特技名':          'name',
  '最大特技Lv':      'maxSkillLv',
  '発動条件':        'conditionsStr',
  '発動対象タイプ':  'targetType',
  '発動対象値':      'targetValue',
  '脅迫力(初期値)%': 'threatPctInit',
  '脅迫力(最大値)%': 'threatPctMax',
  '脅迫力あがり幅%': 'threatRise',
  '耐久力(初期値)%': 'endurancePctInit',
  '耐久力(最大値)%': 'endurancePctMax',
  '耐久力あがり幅%': 'enduranceRise',
};

const COND_TYPE_MAP = {
  'キャラクター名': 'character',
  '作品':          'work',
  '属性':          'attribute',
};
const TARGET_TYPE_MAP = {
  '全体':          'all',
  'キャラクター名': 'character',
  '作品':          'work',
  '属性':          'attribute',
};

/** 発動条件文字列 → conditions 配列 */
function parseConditionsStr(str) {
  if (!str || !str.trim()) return [];
  return str.split(';').map(part => {
    const segs  = part.trim().split(':');
    const type  = COND_TYPE_MAP[segs[0]?.trim()];
    const value = segs[1]?.trim();
    const minCount = parseInt(segs[2], 10) || 1;
    if (!type || !value) return null;
    return { type, value, minCount };
  }).filter(Boolean);
}

/** 発動条件文字列のバリデーション（エラー文字列の配列を返す） */
function validateConditionsStr(str) {
  if (!str || !str.trim()) return [];
  const errors = [];
  str.split(';').forEach((part, i) => {
    const segs = part.trim().split(':');
    if (segs.length < 2 || !segs[1]?.trim()) {
      errors.push(`条件${i + 1}: フォーマット不正（例: キャラクター名:キャラA:2）`);
      return;
    }
    if (!COND_TYPE_MAP[segs[0]?.trim()]) {
      errors.push(`条件${i + 1}: タイプ「${segs[0]}」が無効（キャラクター名 / 作品 / 属性）`);
    }
  });
  return errors;
}

function validateSkillRow(row) {
  const errors = [];
  if (!row.name) errors.push('特技名は必須');

  errors.push(...validateConditionsStr(row.conditionsStr));

  if (row.targetType && row.targetType !== '全体') {
    if (!TARGET_TYPE_MAP[row.targetType]) {
      errors.push(`発動対象タイプ「${row.targetType}」が無効（全体 / キャラクター名 / 作品 / 属性）`);
    } else if (!row.targetValue) {
      errors.push('発動対象値が必要です');
    }
  }
  return errors;
}

function findSkillDuplicate(row) {
  const hit = Storage.skills.getAll().find(s => s.name === row.name);
  if (hit) return { item: hit, reason: `特技名「${row.name}」が重複` };
  return null;
}

function skillRowToData(row) {
  const targetTypeKey = TARGET_TYPE_MAP[row.targetType?.trim()] || 'all';
  return {
    name:             row.name,
    conditions:       parseConditionsStr(row.conditionsStr),
    target:           { type: targetTypeKey, value: targetTypeKey !== 'all' ? (row.targetValue || '') : '' },
    maxSkillLv:       parseInt(row.maxSkillLv, 10) || 1,
    threatPctInit:    parseFloat(row.threatPctInit)    || 0,
    threatPctMax:     parseFloat(row.threatPctMax)     || 0,
    threatRise:       parseFloat(row.threatRise)       || 0,
    endurancePctInit: parseFloat(row.endurancePctInit) || 0,
    endurancePctMax:  parseFloat(row.endurancePctMax)  || 0,
    enduranceRise:    parseFloat(row.enduranceRise)    || 0,
  };
}

/* --- 特技プレビュー --- */
let _parsedSkillRows = [];

function runSkillPreview(text) {
  const rawRows = parseCSVText(text, SKILL_CSV_COL);
  if (!rawRows.length) {
    alert('有効な行が見つかりませんでした。ヘッダー行を含む正しいCSVを入力してください。');
    return;
  }

  _parsedSkillRows = rawRows.map(row => {
    const errors = validateSkillRow(row);
    const dup    = errors.length === 0 ? findSkillDuplicate(row) : null;
    return { data: row, errors, dup };
  });

  const cntOk  = _parsedSkillRows.filter(r => r.errors.length === 0 && !r.dup).length;
  const cntDup = _parsedSkillRows.filter(r => r.errors.length === 0 &&  r.dup).length;
  const cntErr = _parsedSkillRows.filter(r => r.errors.length > 0).length;

  document.getElementById('skillCsvPreviewSummary').innerHTML =
    `合計 ${_parsedSkillRows.length} 行　` +
    `<span class="csv-cnt ok">正常 ${cntOk} 件</span>　` +
    `<span class="csv-cnt dup">重複 ${cntDup} 件</span>　` +
    `<span class="csv-cnt err">エラー ${cntErr} 件</span>`;

  const tbody = _parsedSkillRows.map((r, i) => {
    let badge, note;
    if (r.errors.length > 0) {
      badge = '<span class="csv-badge err">エラー</span>';
      note  = r.errors.join(' ／ ');
    } else if (r.dup) {
      badge = '<span class="csv-badge dup">重複</span>';
      note  = r.dup.reason;
    } else {
      badge = '<span class="csv-badge ok">正常</span>';
      note  = '';
    }
    const cls = r.errors.length > 0 ? ' class="row-err"' : r.dup ? ' class="row-dup"' : '';
    const condDisplay = r.data.conditionsStr || '常時発動';
    const targetDisplay = r.data.targetType
      ? (r.data.targetType + (r.data.targetValue ? `:${r.data.targetValue}` : ''))
      : '全体';
    return `<tr${cls}>
      <td>${i + 2}</td>
      <td>${badge}</td>
      <td>${esc(r.data.name || '')}</td>
      <td>${esc(condDisplay)}</td>
      <td>${esc(targetDisplay)}</td>
      <td class="csv-note">${esc(note)}</td>
    </tr>`;
  }).join('');

  document.getElementById('skillCsvPreviewTable').innerHTML = `
    <thead><tr>
      <th>行</th><th>状態</th><th>特技名</th><th>発動条件</th><th>発動対象</th><th>備考</th>
    </tr></thead>
    <tbody>${tbody}</tbody>`;

  document.getElementById('skillCsvImportBtn').disabled = (cntOk === 0 && cntDup === 0);
  document.getElementById('skillCsvPreview').hidden = false;
  document.getElementById('skillCsvResult').hidden  = true;
}

/* --- 特技インポート実行 --- */
function executeSkillImport() {
  const mode = document.getElementById('skillCsvDupHandling').value;
  let imported = 0, skipped = 0, overwritten = 0, errored = 0;
  const toSave = [];

  _parsedSkillRows.forEach(r => {
    if (r.errors.length > 0) { errored++; return; }

    const skillData = skillRowToData(r.data);

    if (r.dup) {
      if (mode === 'skip') { skipped++; return; }
      toSave.push({ ...skillData, id: r.dup.item.id });
      overwritten++;
    } else {
      toSave.push(skillData);
      imported++;
    }
  });

  if (toSave.length > 0) {
    const ok = Storage.skills.saveAll(toSave);
    if (!ok) return;
  }

  _showImportResult('skillCsvResult', 'skillCsvPreview', imported, overwritten, skipped, errored);
  renderSkillList();
  populateSkillSelect();
}

/* --- 特技サンプルDL --- */
function downloadSkillSampleCSV() {
  const header = '特技名,最大特技Lv,発動条件,発動対象タイプ,発動対象値,脅迫力(初期値)%,脅迫力(最大値)%,脅迫力あがり幅%,耐久力(初期値)%,耐久力(最大値)%,耐久力あがり幅%';
  const sample = 'サンプル特技,10,キャラクター名:キャラA:2;作品:作品B:1,キャラクター名,キャラA,10,20,1.1,5,10,0.5';
  _downloadCSV(header + '\n' + sample, 'skill_import_sample.csv');
}

/* ================================================================
   奥義 CSV インポート
================================================================ */

const OUGI_CSV_COL = {
  '奥義名': 'name',
  '説明':   'desc',
};

function validateOugiRow(row) {
  const errors = [];
  if (!row.name) errors.push('奥義名は必須');
  return errors;
}

function findOugiDuplicate(row) {
  const hit = Storage.ougi.getAll().find(o => o.name === row.name);
  if (hit) return { item: hit, reason: `奥義名「${row.name}」が重複` };
  return null;
}

/* --- 奥義プレビュー --- */
let _parsedOugiRows = [];

function runOugiPreview(text) {
  const rawRows = parseCSVText(text, OUGI_CSV_COL);
  if (!rawRows.length) {
    alert('有効な行が見つかりませんでした。ヘッダー行を含む正しいCSVを入力してください。');
    return;
  }

  _parsedOugiRows = rawRows.map(row => {
    const errors = validateOugiRow(row);
    const dup    = errors.length === 0 ? findOugiDuplicate(row) : null;
    return { data: row, errors, dup };
  });

  const cntOk  = _parsedOugiRows.filter(r => r.errors.length === 0 && !r.dup).length;
  const cntDup = _parsedOugiRows.filter(r => r.errors.length === 0 &&  r.dup).length;
  const cntErr = _parsedOugiRows.filter(r => r.errors.length > 0).length;

  document.getElementById('ougiCsvPreviewSummary').innerHTML =
    `合計 ${_parsedOugiRows.length} 行　` +
    `<span class="csv-cnt ok">正常 ${cntOk} 件</span>　` +
    `<span class="csv-cnt dup">重複 ${cntDup} 件</span>　` +
    `<span class="csv-cnt err">エラー ${cntErr} 件</span>`;

  const tbody = _parsedOugiRows.map((r, i) => {
    let badge, note;
    if (r.errors.length > 0) {
      badge = '<span class="csv-badge err">エラー</span>';
      note  = r.errors.join(' ／ ');
    } else if (r.dup) {
      badge = '<span class="csv-badge dup">重複</span>';
      note  = r.dup.reason;
    } else {
      badge = '<span class="csv-badge ok">正常</span>';
      note  = '';
    }
    const cls = r.errors.length > 0 ? ' class="row-err"' : r.dup ? ' class="row-dup"' : '';
    return `<tr${cls}>
      <td>${i + 2}</td>
      <td>${badge}</td>
      <td>${esc(r.data.name || '')}</td>
      <td>${esc(r.data.desc || '')}</td>
      <td class="csv-note">${esc(note)}</td>
    </tr>`;
  }).join('');

  document.getElementById('ougiCsvPreviewTable').innerHTML = `
    <thead><tr>
      <th>行</th><th>状態</th><th>奥義名</th><th>説明</th><th>備考</th>
    </tr></thead>
    <tbody>${tbody}</tbody>`;

  document.getElementById('ougiCsvImportBtn').disabled = (cntOk === 0 && cntDup === 0);
  document.getElementById('ougiCsvPreview').hidden = false;
  document.getElementById('ougiCsvResult').hidden  = true;
}

/* --- 奥義インポート実行 --- */
function executeOugiImport() {
  const mode = document.getElementById('ougiCsvDupHandling').value;
  let imported = 0, skipped = 0, overwritten = 0, errored = 0;
  const toSave = [];

  _parsedOugiRows.forEach(r => {
    if (r.errors.length > 0) { errored++; return; }

    const ougiData = {
      name: r.data.name,
      desc: r.data.desc || undefined,
    };

    if (r.dup) {
      if (mode === 'skip') { skipped++; return; }
      toSave.push({ ...ougiData, id: r.dup.item.id });
      overwritten++;
    } else {
      toSave.push(ougiData);
      imported++;
    }
  });

  if (toSave.length > 0) {
    const ok = Storage.ougi.saveAll(toSave);
    if (!ok) return;
  }

  _showImportResult('ougiCsvResult', 'ougiCsvPreview', imported, overwritten, skipped, errored);
  renderOugiList();
  populateOugiSelect();
}

/* --- 奥義サンプルDL --- */
function downloadOugiSampleCSV() {
  const header = '奥義名,説明';
  const sample = 'サンプル奥義,サンプルの説明文';
  _downloadCSV(header + '\n' + sample, 'ougi_import_sample.csv');
}

/* ================================================================
   共通ユーティリティ
================================================================ */

function _showImportResult(resultId, previewId, imported, overwritten, skipped, errored) {
  const parts = [];
  if (imported)    parts.push(`新規登録 ${imported} 件`);
  if (overwritten) parts.push(`上書き ${overwritten} 件`);
  if (skipped)     parts.push(`スキップ（重複） ${skipped} 件`);
  if (errored)     parts.push(`エラースキップ ${errored} 件`);
  const resultText = parts.join('　／　') || '0 件';

  const el = document.getElementById(resultId);
  el.textContent = resultText;
  el.hidden = false;
  document.getElementById(previewId).hidden = true;

  if (imported + overwritten > 0) showToast(`インポート（Firebase へ保存中...）：${resultText}`);
}

function _downloadCSV(content, filename) {
  const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), { href: url, download: filename });
  a.click();
  URL.revokeObjectURL(url);
}

/* ================================================================
   イベントリスナー — カード
================================================================ */

document.getElementById('csvSampleDownload').addEventListener('click', downloadCardSampleCSV);

document.getElementById('csvFile').addEventListener('change', () => {
  document.getElementById('csvText').value     = '';
  document.getElementById('csvPreview').hidden = true;
  document.getElementById('csvResult').hidden  = true;
});

document.getElementById('csvParseBtn').addEventListener('click', () => {
  const file = document.getElementById('csvFile').files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = e => runCardPreview(e.target.result);
    reader.readAsText(file, 'UTF-8');
    return;
  }
  const text = document.getElementById('csvText').value;
  if (!text.trim()) { alert('CSVファイルを選択するか、テキストを貼り付けてください'); return; }
  runCardPreview(text);
});

document.getElementById('csvImportBtn').addEventListener('click', executeCardImport);

/* ================================================================
   イベントリスナー — 特技
================================================================ */

document.getElementById('skillCsvSampleDownload').addEventListener('click', downloadSkillSampleCSV);

document.getElementById('skillCsvFile').addEventListener('change', () => {
  document.getElementById('skillCsvText').value     = '';
  document.getElementById('skillCsvPreview').hidden = true;
  document.getElementById('skillCsvResult').hidden  = true;
});

document.getElementById('skillCsvParseBtn').addEventListener('click', () => {
  const file = document.getElementById('skillCsvFile').files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = e => runSkillPreview(e.target.result);
    reader.readAsText(file, 'UTF-8');
    return;
  }
  const text = document.getElementById('skillCsvText').value;
  if (!text.trim()) { alert('CSVファイルを選択するか、テキストを貼り付けてください'); return; }
  runSkillPreview(text);
});

document.getElementById('skillCsvImportBtn').addEventListener('click', executeSkillImport);

/* ================================================================
   イベントリスナー — 奥義
================================================================ */

document.getElementById('ougiCsvSampleDownload').addEventListener('click', downloadOugiSampleCSV);

document.getElementById('ougiCsvFile').addEventListener('change', () => {
  document.getElementById('ougiCsvText').value     = '';
  document.getElementById('ougiCsvPreview').hidden = true;
  document.getElementById('ougiCsvResult').hidden  = true;
});

document.getElementById('ougiCsvParseBtn').addEventListener('click', () => {
  const file = document.getElementById('ougiCsvFile').files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = e => runOugiPreview(e.target.result);
    reader.readAsText(file, 'UTF-8');
    return;
  }
  const text = document.getElementById('ougiCsvText').value;
  if (!text.trim()) { alert('CSVファイルを選択するか、テキストを貼り付けてください'); return; }
  runOugiPreview(text);
});

document.getElementById('ougiCsvImportBtn').addEventListener('click', executeOugiImport);
