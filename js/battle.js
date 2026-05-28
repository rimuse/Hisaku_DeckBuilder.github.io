/**
 * battle.js — バトルシミュレーションページ
 * 依存: deck.js (deck, lbBonus, slotHp, calcSkillActivations,
 *               calcTokutsuboBonus, calcCorrectionBonus, num, fmt)
 *       utils.js (num, fmt, showToast)
 */

/* ----------------------------------------------------------------
   ページ初期化
---------------------------------------------------------------- */
function initBattlePage() {
  _updateBattleDeckInfo();
}

/* ----------------------------------------------------------------
   デッキ総耐久力の取得（deck.js の計算ロジックを再利用）
---------------------------------------------------------------- */
function _calcDeckTotalHp() {
  const slots = deck.filter(Boolean);
  if (!slots.length) return 0;

  const activations = calcSkillActivations(slots);
  const skillHp   = activations.filter(a => a.active).reduce((s, a) => s + a.hpBuff, 0);
  const baseHp    = slots.reduce((s, slot) => s + num(slot.card.hp), 0);
  const lbHp      = slots.reduce((s, slot) => s + lbBonus(slot.card, slot.lbLv), 0);
  const { hp: tokuboHp } = calcTokutsuboBonus(slots);
  const { fukyoHp, tokkoHp: corrTokkoHp, newCardTokkoHp } = calcCorrectionBonus(slots);

  return baseHp + lbHp + skillHp + tokuboHp + fukyoHp + corrTokkoHp + newCardTokkoHp;
}

function _updateBattleDeckInfo() {
  const el = document.getElementById('battleDeckInfo');
  if (!el) return;
  const slots = deck.filter(Boolean);
  if (!slots.length) {
    el.innerHTML = '<span class="battle-deck-empty">デッキにカードが設定されていません。デッキシミュレーションでカードを選択してください。</span>';
  } else {
    el.innerHTML = `デッキ総耐久力: <strong class="battle-deck-hp">${fmt(_calcDeckTotalHp())}</strong>`;
  }
}

/* ----------------------------------------------------------------
   奥義発動回数シミュレーション
   1ターン目から始まり、毎ターン開始時に奥義条件をチェックして
   ダメージを減算。HP が 0 以下になるまで継続。
---------------------------------------------------------------- */
function _calcOugiCount(totalHp, dmgPerTurn) {
  if (totalHp <= 0 || dmgPerTurn <= 0) return 0;

  const THRESHOLDS  = [0.30, 0.10, 0.025]; // 1回目/2回目/3回目の発動HP割合
  let hp            = totalHp;
  let turn          = 0;
  let ougiCount     = 0;
  let minNextTurn   = 4; // 1回目は4ターン以降から

  while (hp > 0) {
    turn++;
    if (ougiCount < 3 && turn >= minNextTurn && hp <= THRESHOLDS[ougiCount] * totalHp) {
      ougiCount++;
      if (ougiCount === 3) return 3;
      minNextTurn = turn + 1; // 次の奥義は次のターン以降
    }
    hp -= dmgPerTurn;
  }
  return ougiCount;
}

/* ----------------------------------------------------------------
   総耐久を減らすことで奥義回数が増える HP 範囲を探索（効率的な実装）

   ステップ1: 各奥義閾値の補完比率（70%/90%/97.5%）を使い、
             境界付近の HP 候補を約 30 点生成する。
             境界 = totalHp × r が damage の整数倍に近い点 ⇒ hp = k×d/r
   ステップ2: 候補をシミュレーションして奥義回数が増える候補（シード）を特定
   ステップ3: シードから上下に走査し正確な境界を確定、[min, max] を返す
---------------------------------------------------------------- */
function _findBetterHpRange(totalHp, dmgPerTurn, originalCount) {
  if (originalCount >= 3 || dmgPerTurn <= 0 || totalHp <= 1) return null;

  // ステップ1: 境界HP候補を列挙
  // 各奥義の発動閾値 (30%/10%/2.5%) の補完値 = 1 - threshold
  const COMPLEMENTS = [0.70, 0.90, 0.975];
  const candidateSet = new Set();

  for (const r of COMPLEMENTS) {
    // totalHp × r を damage で割った商の近辺の整数倍を列挙
    const base = Math.floor(totalHp * r / dmgPerTurn) * dmgPerTurn;
    for (let k = -2; k <= 2; k++) {
      const mult = base + k * dmgPerTurn;
      if (mult <= 0) continue;
      // hp × r = mult となる hp を候補に追加（floor/ceil 両方）
      const hpExact = mult / r;
      for (const hp of [Math.floor(hpExact), Math.ceil(hpExact)]) {
        if (hp > 0 && hp < totalHp) candidateSet.add(hp);
      }
    }
  }

  // ステップ2: 候補をシミュレーションして奥義回数が増えるシードを抽出
  const betterSeeds = [...candidateSet]
    .filter(hp => _calcOugiCount(hp, dmgPerTurn) > originalCount);
  if (betterSeeds.length === 0) return null;

  // ステップ3: シードから上下に走査して正確な境界を確定
  // 範囲幅の上限は概ね dmgPerTurn × T1 × 0.11 程度なので 10 倍で十分
  const EXPAND = Math.min(100000, Math.ceil(dmgPerTurn * 10));
  let rangeMin = Math.min(...betterSeeds);
  let rangeMax = Math.max(...betterSeeds);

  for (const seed of betterSeeds) {
    for (let hp = seed + 1; hp < totalHp && hp <= seed + EXPAND; hp++) {
      if (_calcOugiCount(hp, dmgPerTurn) > originalCount) rangeMax = Math.max(rangeMax, hp);
      else break;
    }
    for (let hp = seed - 1; hp >= 1 && hp >= seed - EXPAND; hp--) {
      if (_calcOugiCount(hp, dmgPerTurn) > originalCount) rangeMin = Math.min(rangeMin, hp);
      else break;
    }
  }

  return { min: rangeMin, max: rangeMax };
}

/* ----------------------------------------------------------------
   チェック実行
---------------------------------------------------------------- */
function _runOugiChecker() {
  const dmgInput  = num(document.getElementById('battleDamage').value);
  const dmgLv     = num(document.getElementById('battleDamageLv').value);
  const fromLv    = num(document.getElementById('battleCheckFrom').value);
  const toLv      = num(document.getElementById('battleCheckTo').value);
  const resultEl  = document.getElementById('battleResult');

  if (!dmgInput || dmgInput <= 0)    { showToast('被ダメージを入力してください', true); return; }
  if (!dmgLv || dmgLv < 1)          { showToast('Lvを入力してください（1以上）', true); return; }
  if (!fromLv || fromLv < 1)        { showToast('チェック範囲の開始Lvを入力してください', true); return; }
  if (!toLv || toLv < fromLv)       { showToast('チェック範囲の終了Lvを正しく入力してください', true); return; }
  if (toLv - fromLv > 999)          { showToast('チェック範囲は1000Lv以内にしてください', true); return; }

  const totalHp = _calcDeckTotalHp();
  if (totalHp <= 0) { showToast('デッキにカードを設定してください', true); return; }

  // Lv1 基準ダメージ = input / √inputLv
  const baseDmg = dmgInput / Math.sqrt(dmgLv);

  // 各 Lv の結果を計算
  const perLv = [];
  for (let lv = fromLv; lv <= toLv; lv++) {
    const d     = Math.floor(baseDmg * Math.sqrt(lv));
    const count = d > 0 ? _calcOugiCount(totalHp, d) : 0;
    const hpR   = d > 0 ? _findBetterHpRange(totalHp, d, count) : null;
    const hpKey = hpR ? `${hpR.min}-${hpR.max}` : (count >= 3 ? 'max' : 'none');
    perLv.push({ lv, d, count, hpR, hpKey });
  }

  // 同じ (奥義回数, HP範囲キー) が連続するLvをまとめる
  const groups = [];
  let cur = null;
  for (const r of perLv) {
    const key = `${r.count}|${r.hpKey}`;
    if (!cur || cur.key !== key) {
      cur = { key, fromLv: r.lv, toLv: r.lv, count: r.count, hpR: r.hpR };
      groups.push(cur);
    } else {
      cur.toLv = r.lv;
    }
  }

  // テーブル描画
  let html = `
    <table class="battle-result-table">
      <thead>
        <tr>
          <th>Lv</th>
          <th>奥義発動回数</th>
          <th>奥義回数を増やせる総耐久</th>
        </tr>
      </thead>
      <tbody>`;

  for (const g of groups) {
    const lvStr    = g.fromLv === g.toLv
      ? `Lv ${g.fromLv}`
      : `Lv ${g.fromLv} 〜 ${g.toLv}`;
    const countStr = `${g.count}回`;
    let hpStr;
    if (g.count >= 3) {
      hpStr = '<span class="battle-hp-max">—</span>';
    } else if (g.hpR) {
      hpStr = `${fmt(g.hpR.min)} 〜 ${fmt(g.hpR.max)}`;
    } else {
      hpStr = '<span class="battle-hp-none">なし</span>';
    }
    html += `
        <tr>
          <td class="battle-lv-cell">${lvStr}</td>
          <td class="battle-count-cell">${countStr}</td>
          <td class="battle-hp-cell">${hpStr}</td>
        </tr>`;
  }

  html += `
      </tbody>
    </table>`;

  resultEl.innerHTML = html;
}

document.getElementById('battleCheckBtn').addEventListener('click', _runOugiChecker);
