// =============================================================
// learn.js … 「🎓 学ぶ」タブ（毎日の授業・クイズ・目標の計算・NISA/iDeCo/かぶミニのガイド）
// 読んだ授業と目標の数字は、このスマホのブラウザの中（localStorage）だけに保存されます。
// =============================================================

const LEARN_KEY = 'kabu.learn';

const Learn = {
  // read: 読み終えた授業の番号, day: 今日の授業を決めた日, current: 今日の授業の番号
  st: { read: [], day: '', current: 0, view: null, answered: {}, goal: { gain: 300000, years: 10, init: 50000, rate: 4 } },

  load() {
    try {
      const s = JSON.parse(localStorage.getItem(LEARN_KEY) || 'null');
      if (s) this.st = { ...this.st, ...s, goal: { ...this.st.goal, ...(s.goal || {}) } };
    } catch { /* 保存できない環境でも使える */ }
    // 1日1つ：日付が変わったら、まだ読んでいない一番前の授業を「今日の授業」にする
    const today = todayStr();
    if (this.st.day !== today) {
      const next = LESSONS.findIndex((_, i) => !this.st.read.includes(i));
      this.st.current = next === -1 ? (this.st.current + 1) % LESSONS.length : next;
      this.st.day = today;
      this.st.answered = {};
      this.save();
    }
    this.st.view = this.st.current;
  },
  save() {
    const { view, ...keep } = this.st;
    try { localStorage.setItem(LEARN_KEY, JSON.stringify(keep)); } catch { /* 保存できなくても表示は続ける */ }
  },
  markRead(i) {
    if (!this.st.read.includes(i)) this.st.read.push(i);
    this.save();
  },
};

// 目標：「◯年で◯円増やす」のに毎月いくら積み立てればいいか（毎月複利で計算）
function goalPlan(g) {
  const n = Math.round(g.years * 12);
  const i = g.rate / 100 / 12;
  const grow = i ? Math.pow(1 + i, n) : 1;
  const annuity = i ? (grow - 1) / i : n; // 毎月1円ずつ積み立てた時の最後の金額
  const initGain = g.init * (grow - 1);
  const monthly = Math.max(0, (g.gain - initGain) / Math.max(annuity - n, 1e-9));
  const yearly = [];
  for (let y = 1; y <= g.years; y++) {
    const k = y * 12; const gk = i ? Math.pow(1 + i, k) : 1;
    const total = g.init * gk + monthly * (i ? (gk - 1) / i : k);
    const paid = g.init + monthly * k;
    yearly.push({ y, total, paid });
  }
  const last = yearly[yearly.length - 1] || { total: g.init, paid: g.init };
  return { monthly, total: last.total, paid: last.paid, gain: last.total - last.paid, yearly, noNeed: initGain >= g.gain };
}

const GUIDES = [
  { id: 'kabumini', icon: '🟢', title: 'かぶミニ（楽天証券の1株から買えるしくみ）', items: [
    '1株から買えるので、株価3,000円の会社も約3,000円で株主になれる',
    '手数料は基本0円。リアルタイム取引（取引時間中にすぐ買える）は約0.22％のスプレッドが上乗せされる',
    '寄付取引（夕方〜翌朝に注文→翌朝いちばんの値段で買える）はスプレッドもかからない。急がないならこちら',
    'NISA口座でも使える。楽天ポイントでも買える',
    '配当は1株からもらえる。株主優待はたいてい100株以上が条件',
    '使える銘柄・手数料のくわしい条件は、楽天証券のアプリや公式ページで確認してね',
  ] },
  { id: 'nisa', icon: '🟦', title: 'NISA（もうけに税金がかからない箱）', items: [
    'ふつうはもうけに約20％の税金。NISAの中なら0円',
    'つみたて投資枠：年120万円まで（長期向けの投資信託をコツコツ）',
    '成長投資枠：年240万円まで（株・かぶミニ・投資信託）',
    '一生で使える合計は1,800万円。売った分の枠は翌年に復活',
    '注意：NISAで出た損はほかの口座のもうけと相殺できない → 長く持つものを入れる',
    '2027年から0〜17歳の「こどもNISA」（つみたて枠・年60万円まで）が始まる予定',
  ] },
  { id: 'ideco', icon: '🟧', title: 'iDeCo（自分で作る年金）', items: [
    '毎月の掛金が全額「所得控除」→ 所得税・住民税が安くなる',
    '受け取りは原則60歳から。それまで引き出せない',
    '口座の管理手数料が毎月少しかかる',
    '2026年12月〜2027年1月ごろから、掛金の上限が引き上げられ、70歳まで加入できるようになる予定',
    'おすすめの順番：生活費の貯金 → NISA → 余裕ができたらiDeCo',
  ] },
  { id: 'swing', icon: '📈', title: 'スイングトレード（窪田剛さんの考え方を参考に）', items: [
    '数日〜数週間持って、株価の“波”に乗る。仕事があっても夜にチャートを見て注文できる',
    '「安いから買う」ではなく「上がっている流れ（上昇トレンド）に乗る」',
    '谷と谷を結んだ下値支持線が“床”。床の近くで上向いたら買いの候補、床を割ったら流れが変わったサイン',
    '移動平均線から離れすぎた株は追いかけない。ひと休み（押し目）を待つ',
    '損は小さいうちに切る。買う前に「ここまで下がったら売る」を決めておく',
    '紹介記事では「＋10％で利益確定、損切りは資金の2〜3％まで」という目安も（5万円なら1回の損は1,000〜1,500円まで）',
    'くわしくは窪田剛さんの著書『株の学校』（高橋書店）など',
  ] },
  { id: 'day', icon: '⚡', title: 'デイトレードの参考になる人', items: [
    'テスタさん：日本でとくに有名な個人トレーダー。初心者向けに『マンガでわかるテスタの株式投資』（2024年）',
    'cisさん：伝説的なトレーダー。考え方の本『一人の力で日経平均を動かせる男の投資哲学』',
    'デイトレ入門書なら『世界一やさしい デイトレードの教科書 1年生』（2025年）など',
    '共通する教え：負けを小さく、ルールを守る、熱くならない',
    '5万円から始めるなら、デイトレは「見て学ぶ」から。かぶミニはスプレッドがあるので、何度も売り買いするデイトレには向かない',
  ] },
];

function viewLearn() {
  const st = Learn.st;
  const i = st.view ?? st.current;
  const L = LESSONS[i];
  const ch = LESSON_CHAPTERS.find((c) => c.id === L.ch);
  const done = st.read.length;
  const isToday = i === st.current;
  const ans = st.answered[i];
  const g = st.goal;
  const plan = goalPlan(g);
  const tax = Math.round(plan.gain * 0.20315);
  return `
    <section class="lesson-card">
      <div class="lc-top"><span class="badge b-long">${isToday ? '🎓 今日の授業' : '📖 授業'}</span>
        <span class="small muted">第${i + 1}回／全${LESSONS.length}回 ・ ${esc(ch ? ch.title : '')}</span></div>
      <h2 class="lc-title">${esc(L.title)}</h2>
      <p class="lc-body">${esc(L.body)}</p>
      <div class="lc-point">💡 ${esc(L.point)}</div>
      <div class="quiz">
        <div class="q">❓ ${esc(L.quiz.q)}</div>
        ${L.quiz.choices.map((c, k) => {
          const cls = ans == null ? '' : k === L.quiz.a ? 'right' : k === ans ? 'wrong' : 'dim';
          return `<button type="button" class="qc ${cls}" data-quiz="${k}" ${ans != null ? 'disabled' : ''}>${'ABC'[k]}. ${esc(c)}</button>`;
        }).join('')}
        ${ans != null ? `<div class="qa">${ans === L.quiz.a ? '⭕ 正解！' : '❌ おしい！'} ${esc(L.quiz.why)}</div>` : ''}
      </div>
      <div class="progress"><span style="width:${Math.round(done / LESSONS.length * 100)}%"></span></div>
      <div class="small muted">読んだ授業：${done}／${LESSONS.length}　毎日1つずつ読むと、約${LESSONS.length}日で一周します。</div>
      <div class="lc-nav">
        <button type="button" class="btn" data-lesson="${i - 1}" ${i === 0 ? 'disabled' : ''}>◀ 前</button>
        <button type="button" class="btn" data-act="lessonList">📚 一覧</button>
        <button type="button" class="btn" data-lesson="${i + 1}" ${i === LESSONS.length - 1 ? 'disabled' : ''}>次 ▶</button>
      </div>
    </section>

    <section class="panel">
      <h2>🎯 目標の計算</h2>
      <div class="goal-form">
        <label>増やしたい金額<input type="number" inputmode="numeric" min="1000" step="10000" data-goal="gain" value="${g.gain}"><span>円</span></label>
        <label>期間<input type="number" inputmode="numeric" min="1" max="40" data-goal="years" value="${g.years}"><span>年</span></label>
        <label>最初に入れるお金<input type="number" inputmode="numeric" min="0" step="10000" data-goal="init" value="${g.init}"><span>円</span></label>
        <label>1年で増える割合（想定）<input type="number" inputmode="decimal" min="0" max="15" step="0.5" data-goal="rate" value="${g.rate}"><span>％</span></label>
      </div>
      <div class="goal-result">
        ${plan.noNeed ? `<b>最初のお金だけで目標に届く計算です 🎉</b>` : `毎月 <b>約${yen(Math.ceil(plan.monthly / 100) * 100)}</b> ずつ積み立てると…`}
        <div>${g.years}年後に 約${yen(plan.total)}（入れたお金 約${yen(plan.paid)}、増えた分 <b>約${yen(plan.gain)}</b>）</div>
        <div class="small">NISAなら増えた分に税金0円。ふつうの口座だと約${yen(tax)}の税金がかかります。</div>
      </div>
      <div class="goal-bars">${plan.yearly.map((r) => `<div class="gb"><span class="gb-paid" style="height:${Math.round(r.paid / plan.total * 100)}%"></span><span class="gb-gain" style="height:${Math.max(0, Math.round((r.total - r.paid) / plan.total * 100))}%"></span><small>${r.y}</small></div>`).join('')}</div>
      <p class="small muted">■ 入れたお金　■ 増えた分（年ごと）。年4〜5％は世界の株の長い目で見た平均に近い想定ですが、毎年その通りになるわけではありません。下がる年もあります。</p>
    </section>

    <section class="panel">
      <h2>📚 ガイド</h2>
      ${GUIDES.map((gd) => `<details class="guide"><summary>${gd.icon} ${esc(gd.title)}</summary><ul>${gd.items.map((t) => `<li>${esc(t)}</li>`).join('')}</ul></details>`).join('')}
      <p class="small muted">制度の数字は2026年10月時点で調べたものです。始めるときは証券会社・金融庁・iDeCo公式サイトで最新の条件を確認してください。</p>
    </section>`;
}

function openLessonList() {
  const st = Learn.st;
  openSheet(`<h2>📚 授業の一覧</h2>
    ${LESSON_CHAPTERS.map((c) => `<h3>${esc(c.title)}</h3><div class="lesson-list">${LESSONS.map((L, i) => L.ch === c.id
      ? `<button type="button" class="ll ${i === st.current ? 'cur' : ''}" data-lesson="${i}">${st.read.includes(i) ? '✅' : '⬜'} 第${i + 1}回 ${esc(L.title)}</button>` : '').join('')}</div>`).join('')}
    <div class="sheet-actions"><button type="button" class="btn" data-act="close">閉じる</button></div>`);
}

// 読み上げ用の文章
function learnScript() {
  const i = Learn.st.view ?? Learn.st.current;
  const L = LESSONS[i];
  return [
    { section: `第${i + 1}回`, text: `${i === Learn.st.current ? '今日の授業、' : ''}第${i + 1}回。${L.title}。` },
    { section: L.title, text: L.body },
    { section: 'まとめ', text: `ひと言でいうと、${L.point}。` },
    { section: 'クイズ', text: `クイズです。${L.quiz.q}。${L.quiz.choices.map((c, k) => `${'エービーシー'.slice(k * 2, k * 2 + 2)}、${c}`).join('。')}。` },
  ];
}

// 画面の操作（app.js の click から呼ばれる）。処理したら true を返す
function learnClick(t) {
  if (t.dataset.lesson != null) {
    const i = Number(t.dataset.lesson);
    if (i >= 0 && i < LESSONS.length) { Learn.st.view = i; closeSheet(); render(); window.scrollTo(0, 0); }
    return true;
  }
  if (t.dataset.quiz != null) {
    const i = Learn.st.view ?? Learn.st.current;
    Learn.st.answered[i] = Number(t.dataset.quiz);
    Learn.markRead(i);
    render();
    return true;
  }
  if (t.dataset.act === 'lessonList') { openLessonList(); return true; }
  return false;
}

function learnInput(el) {
  const k = el.dataset.goal; if (!k) return false;
  const v = Number(el.value);
  if (!Number.isFinite(v) || v < 0) return true;
  Learn.st.goal[k] = k === 'years' ? Math.min(40, Math.max(1, Math.round(v))) : v;
  Learn.save();
  const y = window.scrollY;
  render();
  window.scrollTo(0, y);
  return true;
}
