// =============================================================
// mine.js … 「📋 マイ銘柄」：気になる銘柄・持っている銘柄を登録して、情報を調べる
// 登録した銘柄・株数・買値は、このスマホのブラウザの中（localStorage）だけに保存されます。
// GitHub やインターネットには送りません（調べるボタンは、外のサイトを開くだけです）。
// =============================================================

const MINE_KEY = 'kabu.mine';

const Mine = {
  items: [], // { id, code, name, market, sector, kind: 'hold' | 'watch', shares, cost, date, now, memo }
  stocks: null, // 銘柄一覧（data/stocks.json）
  stocksAsOf: '',
  loading: null,

  load() {
    try { const s = JSON.parse(localStorage.getItem(MINE_KEY) || 'null'); if (s && Array.isArray(s.items)) this.items = s.items; } catch { /* 保存できない環境でも使える */ }
  },
  save() {
    try { localStorage.setItem(MINE_KEY, JSON.stringify({ items: this.items })); } catch { toast('保存できませんでした（容量不足など）'); }
  },
  // 銘柄一覧は大きいので、検索するときに初めて読み込む
  loadStocks() {
    if (this.stocks) return Promise.resolve(this.stocks);
    if (!this.loading) {
      this.loading = fetch(LOCAL_BASE + 'stocks.json').then((r) => r.json()).then((d) => {
        this.stocks = d.rows.map(([code, name, market, sector]) => ({ code, name, market, sector, key: normKey(name) }));
        this.stocksAsOf = d.asOf || '';
        return this.stocks;
      }).catch(() => { this.loading = null; return []; });
    }
    return this.loading;
  },
  add(s, kind) {
    const have = this.items.find((x) => x.code === s.code && x.kind === kind);
    if (have) { toast('もう登録されています'); return have; }
    const it = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), code: s.code, name: s.name, market: s.market || '', sector: s.sector || '', kind, shares: '', cost: '', date: kind === 'hold' ? todayStr() : '', now: '', memo: '' };
    this.items.push(it);
    this.save();
    return it;
  },
};

const MARKET_JA = { P: 'プライム', S: 'スタンダード', G: 'グロース', ETF: 'ETF', REIT: 'REIT', PRO: 'PRO', 他: '' };

// 全角・半角、ひらがな・カタカナの違いをならして比べる
function normKey(s) {
  return String(s || '').normalize('NFKC').toLowerCase()
    .replace(/[ぁ-ゖ]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60))
    .replace(/[\s・()（）]/g, '');
}

function searchStocks(q) {
  const k = normKey(q);
  if (!k || !Mine.stocks) return [];
  const code = k.toUpperCase();
  const starts = []; const rest = [];
  for (const s of Mine.stocks) {
    if (s.code.startsWith(code) || s.key.startsWith(k)) starts.push(s);
    else if (s.key.includes(k)) rest.push(s);
    if (starts.length >= 30) break;
  }
  return [...starts, ...rest].slice(0, 30);
}

// 今日のニュース（おすすめ・トピックス・裏話）にその銘柄が出てくるか
function mentionsToday(it) {
  const d = state.data; if (!d) return [];
  const short = it.name.replace(/(株式会社|ホールディングス|グループ|フィナンシャル)/g, '').slice(0, 6);
  const hit = (t) => t && (t.includes(it.code) || (short.length >= 2 && t.includes(short)));
  const where = [];
  if ((d.picks || []).some((p) => String(p.code).split(/[\s/]+/).includes(it.code) || hit(p.name))) where.push('おすすめ');
  if ((d.topics || []).some((t) => hit(t.title) || hit(t.body))) where.push('トピックス');
  if ((d.stories || []).some((t) => hit(t.title) || hit(t.body))) where.push('裏話');
  if ((d.events || []).some((t) => hit(t.title))) where.push('予定');
  return where;
}

// 調べるためのリンク（外のサイトを開くだけ。登録した情報は送りません）
function infoLinks(it) {
  const c = encodeURIComponent(it.code);
  const n = encodeURIComponent((it.name.replace(/(株式会社|ホールディングス|グループ|フィナンシャル・?)/g, '').trim() || it.name) + ' 株');
  return [
    { icon: '📈', label: '株価とチャート（Yahoo!ファイナンス）', url: `https://finance.yahoo.co.jp/quote/${c}.T` },
    { icon: '📰', label: 'この会社のニュース（株探）', url: `https://kabutan.jp/stock/news?code=${c}` },
    { icon: '📊', label: '株価・決算のまとめ（株探）', url: `https://kabutan.jp/stock/?code=${c}` },
    { icon: '🗂', label: '業績の移り変わり（IR BANK）', url: `https://irbank.net/${c}` },
    { icon: '💬', label: 'みんなの予想・配当（みんかぶ）', url: `https://minkabu.jp/stock/${c}` },
    { icon: '🔎', label: 'Googleニュースで探す', url: `https://news.google.com/search?q=${n}&hl=ja&gl=JP&ceid=JP:ja` },
  ];
}

const num = (v) => { const n = Number(String(v ?? '').replace(/[,，円¥\s]/g, '')); return Number.isFinite(n) ? n : 0; };

function mineCard(it) {
  const where = mentionsToday(it);
  const shares = num(it.shares); const cost = num(it.cost); const now = num(it.now);
  const invest = shares * cost;
  let pl = '';
  if (it.kind === 'hold' && shares && cost && now) {
    const diff = (now - cost) * shares; const pct = (now / cost - 1) * 100;
    pl = `<div class="pl ${diff >= 0 ? 'plus' : 'minus'}">今 ${yen(now)} なら ${diff >= 0 ? '+' : '−'}${yen(Math.abs(diff))}（${diff >= 0 ? '+' : ''}${pct.toFixed(1)}%）</div>`;
  }
  return `<article class="mine-card">
    <div class="mine-head"><b>${esc(it.name)}</b> <span class="pick-code">${esc(it.code)}${it.market && MARKET_JA[it.market] ? ' ・ ' + esc(MARKET_JA[it.market]) : ''}${it.sector ? ' ・ ' + esc(it.sector) : ''}</span></div>
    ${where.length ? `<div class="mine-news">🗞 今日のニュースに登場：${esc(where.join('・'))}</div>` : ''}
    ${it.kind === 'hold' ? `<div class="mine-nums">${shares ? `${shares}株` : '株数 未入力'}${cost ? ` × 買値 ${yen(cost)} ＝ <b>${yen(invest)}</b>` : ''}${it.date ? `<small>（${esc(it.date)} 買い）</small>` : ''}</div>${pl}` : ''}
    ${it.memo ? `<div class="mine-memo">📝 ${esc(it.memo)}</div>` : ''}
    <div class="mine-actions">
      <button type="button" class="btn small" data-mine-info="${esc(it.id)}">🔍 調べる</button>
      <button type="button" class="btn small" data-mine-edit="${esc(it.id)}">✏️ ${it.kind === 'hold' ? '株数・買値' : 'メモ'}</button>
      ${it.kind === 'watch' ? `<button type="button" class="btn small" data-mine-buy="${esc(it.id)}">🧺 買った</button>` : ''}
      <button type="button" class="btn small" data-mine-del="${esc(it.id)}">🗑</button>
    </div>
  </article>`;
}

function viewMine() {
  const hold = Mine.items.filter((x) => x.kind === 'hold');
  const watch = Mine.items.filter((x) => x.kind === 'watch');
  const totalInvest = hold.reduce((s, x) => s + num(x.shares) * num(x.cost), 0);
  return `
    <section class="panel">
      <h2>🔎 銘柄を探して登録</h2>
      <input type="search" id="mineQ" placeholder="会社名かコード（例：トヨタ、7203）" autocomplete="off">
      <div id="mineResults" class="mine-results"><p class="small muted">名前の一部やコードを入れると候補が出ます。</p></div>
      <details class="mine-manual"><summary>一覧にない銘柄を手で追加する</summary>
        <div class="manual-row"><input id="manCode" placeholder="コード（例：285A）"><input id="manName" placeholder="会社名"></div>
        <div class="chips"><button type="button" class="chip" data-mine-manual="watch">⭐ 気になるに追加</button><button type="button" class="chip" data-mine-manual="hold">🧺 持っているに追加</button></div>
      </details>
    </section>

    <h2 class="sec-title">🧺 持っている銘柄（${hold.length}）</h2>
    ${hold.length ? `<div class="mine-total">買ったお金の合計：<b>${yen(totalInvest)}</b></div>${hold.map(mineCard).join('')}` : '<p class="muted small">「探して登録」で 🧺 を押すと、ここに入ります。</p>'}

    <h2 class="sec-title">⭐ 気になる銘柄（${watch.length}）</h2>
    ${watch.length ? watch.map(mineCard).join('') : '<p class="muted small">「探して登録」で ⭐ を押すと、ここに入ります。</p>'}

    <section class="panel">
      <h2>💾 マイ銘柄のバックアップ</h2>
      <p class="small muted">🔒 登録した銘柄・株数・買値は、このスマホの中だけに保存されます（GitHub やインターネットには載りません）。機種変更のときは書き出して、新しいスマホで読み込んでください。</p>
      <div class="chips">
        <button type="button" class="chip" data-act="mineExport">📥 書き出す</button>
        <label class="chip file-chip">📂 読み込む<input type="file" id="mineImport" accept=".json,application/json" hidden></label>
      </div>
    </section>`;
}

function renderMineResults() {
  const box = $('#mineResults'); const q = $('#mineQ'); if (!box || !q) return;
  if (!q.value.trim()) { box.innerHTML = '<p class="small muted">名前の一部やコードを入れると候補が出ます。</p>'; return; }
  if (!Mine.stocks) { box.innerHTML = '<p class="small muted">銘柄一覧を読み込み中…</p>'; Mine.loadStocks().then(renderMineResults); return; }
  const list = searchStocks(q.value);
  box.innerHTML = list.length ? list.map((s) => {
    const inHold = Mine.items.some((x) => x.code === s.code && x.kind === 'hold');
    const inWatch = Mine.items.some((x) => x.code === s.code && x.kind === 'watch');
    return `<div class="res-row"><div><b>${esc(s.name)}</b><br><span class="pick-code">${esc(s.code)} ・ ${esc(MARKET_JA[s.market] || '')}${s.sector ? ' ・ ' + esc(s.sector) : ''}</span></div>
      <div class="res-btns"><button type="button" class="chip ${inWatch ? 'on' : ''}" data-mine-add="watch" data-code="${esc(s.code)}">⭐</button><button type="button" class="chip ${inHold ? 'on' : ''}" data-mine-add="hold" data-code="${esc(s.code)}">🧺</button></div></div>`;
  }).join('') + `<p class="small muted">⭐＝気になる　🧺＝持っている　（一覧は${Mine.stocksAsOf ? `${Mine.stocksAsOf.slice(0, 4)}年${Number(Mine.stocksAsOf.slice(4, 6))}月` : ''}時点。最近上場した会社は「手で追加」から）</p>`
    : '<p class="small muted">見つかりませんでした。漢字・カタカナを変えるか、コードで探してください。最近上場した会社は「手で追加」からどうぞ。</p>';
}

function openMineInfo(it) {
  openSheet(`<h2>🔍 ${esc(it.name)}（${esc(it.code)}）を調べる</h2>
    <p class="small muted">外のサイトが開きます。登録した株数や買値は送られません。</p>
    <div class="link-list">${infoLinks(it).map((l) => `<a class="btn block" href="${esc(l.url)}" target="_blank" rel="noopener">${l.icon} ${esc(l.label)}</a>`).join('')}</div>
    <p class="small muted">見るポイント：①株価が上向きか（スイングなら上昇トレンドか）②最近のニュース ③決算の数字が増えているか ④配当はいくらか</p>
    <div class="sheet-actions"><button type="button" class="btn" data-act="close">閉じる</button></div>`);
}

function openMineEdit(it) {
  const hold = it.kind === 'hold';
  openSheet(`<h2>✏️ ${esc(it.name)}</h2>
    ${hold ? `<div class="goal-form">
      <label>株数<input type="number" inputmode="numeric" min="0" id="meShares" value="${esc(it.shares)}"><span>株</span></label>
      <label>買った値段（1株）<input type="number" inputmode="decimal" min="0" id="meCost" value="${esc(it.cost)}"><span>円</span></label>
      <label>買った日<input type="date" id="meDate" value="${esc(it.date)}"><span></span></label>
      <label>今の株価（わかれば）<input type="number" inputmode="decimal" min="0" id="meNow" value="${esc(it.now)}"><span>円</span></label>
    </div>` : ''}
    <label class="small muted" for="meMemo">メモ（買った理由・売る目安など）</label>
    <textarea id="meMemo" rows="3" class="memo-box" placeholder="例：上昇トレンド。○○円を下回ったら売る">${esc(it.memo)}</textarea>
    <div class="sheet-actions"><button type="button" class="btn" data-act="close">やめる</button><button type="button" class="btn primary" data-mine-save="${esc(it.id)}">保存</button></div>`);
}

function exportMine() {
  const file = new File([JSON.stringify({ kind: 'kabu-mine-backup', version: 1, exportedAt: new Date().toISOString(), items: Mine.items }, null, 1)],
    'kabu-mine-' + todayStr().replace(/-/g, '') + '.json', { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = file.name;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  toast('書き出しました（GitHubには入れないでね）');
}

async function importMine(file) {
  if (!file) return;
  try {
    const d = JSON.parse(await file.text());
    if (!d || d.kind !== 'kabu-mine-backup' || !Array.isArray(d.items)) throw new Error('マイ銘柄のバックアップではありません');
    if (!confirm(`${d.items.length}件の銘柄を読み込みます。今の登録（${Mine.items.length}件）は置き換わります。よろしいですか？`)) return;
    Mine.items = d.items.filter((x) => x && x.code && x.name);
    Mine.save(); render(); toast('読み込みました');
  } catch (err) { alert('読み込めませんでした：' + err.message); }
}

// 読み上げ用
function mineScript() {
  const out = [];
  const hold = Mine.items.filter((x) => x.kind === 'hold'); const watch = Mine.items.filter((x) => x.kind === 'watch');
  out.push({ section: 'マイ銘柄', text: `マイ銘柄です。持っている銘柄が${hold.length}つ、気になる銘柄が${watch.length}つです。` });
  [...hold, ...watch].forEach((it) => {
    const w = mentionsToday(it);
    out.push({ section: it.name, text: `${it.name}。${w.length ? `今日のニュースの、${w.join('と')}に出てきます。` : '今日のニュースには出てきません。'}${it.memo ? 'メモ。' + it.memo : ''}` });
  });
  return out;
}

// 画面の操作（app.js の click から呼ばれる）。処理したら true を返す
function mineClick(t) {
  const d = t.dataset;
  const find = (id) => Mine.items.find((x) => x.id === id);
  if (d.mineAdd) {
    const s = (Mine.stocks || []).find((x) => x.code === d.code); if (!s) return true;
    Mine.add(s, d.mineAdd); toast(`${d.mineAdd === 'hold' ? '🧺 持っている' : '⭐ 気になる'}に追加しました`);
    const q = $('#mineQ').value; render(); const qi = $('#mineQ'); if (qi) { qi.value = q; renderMineResults(); }
    return true;
  }
  if (d.mineManual) {
    const code = ($('#manCode').value || '').normalize('NFKC').trim().toUpperCase(); const name = ($('#manName').value || '').trim();
    if (!/^[0-9A-Z]{4}$/.test(code) || !name) { toast('4けたのコードと会社名を入れてください'); return true; }
    Mine.add({ code, name }, d.mineManual); toast('追加しました'); render(); return true;
  }
  if (d.mineInfo) { const it = find(d.mineInfo); if (it) openMineInfo(it); return true; }
  if (d.mineEdit) { const it = find(d.mineEdit); if (it) openMineEdit(it); return true; }
  if (d.mineBuy) {
    const it = find(d.mineBuy); if (!it) return true;
    const h = Mine.add({ code: it.code, name: it.name, market: it.market, sector: it.sector }, 'hold');
    if (it.memo && !h.memo) h.memo = it.memo;
    Mine.items = Mine.items.filter((x) => x !== it); Mine.save(); render(); openMineEdit(h); return true;
  }
  if (d.mineDel) {
    const it = find(d.mineDel); if (!it || !confirm(`「${it.name}」を消しますか？`)) return true;
    Mine.items = Mine.items.filter((x) => x !== it); Mine.save(); render(); return true;
  }
  if (d.mineSave) {
    const it = find(d.mineSave); if (!it) return true;
    if (it.kind === 'hold') { it.shares = $('#meShares').value; it.cost = $('#meCost').value; it.date = $('#meDate').value; it.now = $('#meNow').value; }
    it.memo = $('#meMemo').value.trim();
    Mine.save(); closeSheet(); render(); toast('保存しました'); return true;
  }
  if (d.act === 'mineExport') { exportMine(); return true; }
  return false;
}
