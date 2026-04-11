/**
 * csv-import.js — CSVカードインポート機能
 * 依存: storage.js / utils.js / cards.js (renderCardList, refreshWorkSuggestions)
 *       deck.js (refreshTokutsuboSelect)
 */

/* ----------------------------------------------------------------
   列名 → プロパティ名マッピング
---------------------------------------------------------------- */
const CSV_COL = {
  'ゲーム内ID':    'internalId',
  'カード名':      'cardName',
  'キャラクター名': 'charName',
  'レア度':        'rarity',
  '作品':          'workName',
  '属性':          'attribute',
  '脅迫力':        'power',
  '耐久力':        'hp',
  'スキル':        'skillName',
  '奥義':          'ougiName',
};

const VALID_RARITIES   = new Set(['N', 'R', 'SR', 'SSR']);
const VALID_ATTRIBUTES = new Set(['親愛', '調教', '従順']);

/* ----------------------------------------------------------------
   CSVパーサー（RFC 4180 準拠・BOM 除去対応）
---------------------------------------------------------------- */
function parseCSVText(text) {
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
      const key = CSV_COL[h];
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

/* ----------------------------------------------------------------
   バリデーション & スキル / 奥義 名→ID 解決
---------------------------------------------------------------- */
function validateAndResolve(row) {
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
    else errors.push(`スキル「${row.skillName}」が見つかりません`);
  }
  if (row.ougiName) {
    const ougi = Storage.ougi.getAll().find(o => o.name === row.ougiName);
    if (ougi) row.ougiId = ougi.id;
    else errors.push(`奥義「${row.ougiName}」が見つかりません`);
  }
  return errors;
}

function findDuplicate(row) {
  const all = Storage.cards.getAll();
  if (row.internalId) {
    const hit = all.find(c => c.internalId === row.internalId);
    if (hit) return { card: hit, reason: `ゲーム内ID「${row.internalId}」が重複` };
  }
  const hit = all.find(c => c.cardName === row.cardName && c.charName === row.charName);
  if (hit) return { card: hit, reason: 'カード名＋キャラクター名が重複' };
  return null;
}

/* ----------------------------------------------------------------
   プレビュー生成
---------------------------------------------------------------- */
let _parsedRows = [];

function runPreview(text) {
  const rawRows = parseCSVText(text);
  if (!rawRows.length) {
    alert('有効な行が見つかりませんでした。ヘッダー行を含む正しいCSVを入力してください。');
    return;
  }

  _parsedRows = rawRows.map(row => {
    const errors = validateAndResolve(row);
    const dup    = errors.length === 0 ? findDuplicate(row) : null;
    return { data: row, errors, dup };
  });

  const cntOk  = _parsedRows.filter(r => r.errors.length === 0 && !r.dup).length;
  const cntDup = _parsedRows.filter(r => r.errors.length === 0 &&  r.dup).length;
  const cntErr = _parsedRows.filter(r => r.errors.length > 0).length;

  document.getElementById('csvPreviewSummary').innerHTML =
    `合計 ${_parsedRows.length} 行　` +
    `<span class="csv-cnt ok">正常 ${cntOk} 件</span>　` +
    `<span class="csv-cnt dup">重複 ${cntDup} 件</span>　` +
    `<span class="csv-cnt err">エラー ${cntErr} 件</span>`;

  const tbody = _parsedRows.map((r, i) => {
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

/* ----------------------------------------------------------------
   インポート実行
---------------------------------------------------------------- */
function executeImport() {
  const mode = document.getElementById('csvDupHandling').value;
  let imported = 0, skipped = 0, overwritten = 0, errored = 0;
  const toSave = [];

  _parsedRows.forEach(r => {
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

  /* 全件を1回の Firebase 書き込みにまとめる（onValue の多重発火を防ぐ） */
  if (toSave.length > 0) {
    const ok = Storage.cards.saveAll(toSave);
    if (!ok) return;   // 未認証 — Storage 側でエラートーストを表示済み
  }

  const parts = [];
  if (imported)    parts.push(`新規登録 ${imported} 件`);
  if (overwritten) parts.push(`上書き ${overwritten} 件`);
  if (skipped)     parts.push(`スキップ（重複） ${skipped} 件`);
  if (errored)     parts.push(`エラースキップ ${errored} 件`);

  const resultText = parts.join('　／　') || '0 件';

  const el = document.getElementById('csvResult');
  el.textContent = resultText;
  el.hidden = false;
  document.getElementById('csvPreview').hidden = true;

  /* 各一覧を更新 */
  renderCardList();
  refreshWorkSuggestions();
  refreshTokutsuboSelect();

  if (toSave.length > 0) showToast(`インポート（Firebase へ保存中...）：${resultText}`);
}

/* ----------------------------------------------------------------
   サンプルCSVダウンロード
---------------------------------------------------------------- */
function downloadSampleCSV() {
  const header = 'ゲーム内ID,カード名,キャラクター名,レア度,作品,属性,脅迫力,耐久力,スキル,奥義';
  const sample = ',サンプルカード,キャラA,SSR,サンプル作品,親愛,10000,10000,,';
  const blob = new Blob(['\uFEFF' + header + '\n' + sample], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), { href: url, download: 'card_import_sample.csv' });
  a.click();
  URL.revokeObjectURL(url);
}

/* ----------------------------------------------------------------
   イベントリスナー
---------------------------------------------------------------- */
document.getElementById('csvSampleDownload').addEventListener('click', downloadSampleCSV);

document.getElementById('csvFile').addEventListener('change', () => {
  document.getElementById('csvText').value     = '';
  document.getElementById('csvPreview').hidden = true;
  document.getElementById('csvResult').hidden  = true;
});

document.getElementById('csvParseBtn').addEventListener('click', () => {
  const file = document.getElementById('csvFile').files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = e => runPreview(e.target.result);
    reader.readAsText(file, 'UTF-8');
    return;
  }
  const text = document.getElementById('csvText').value;
  if (!text.trim()) { alert('CSVファイルを選択するか、テキストを貼り付けてください'); return; }
  runPreview(text);
});

document.getElementById('csvImportBtn').addEventListener('click', executeImport);
