/* 上岸练习室 · 行测个人版
 * 纯前端：数据在 data/bank.js，学习记录在 localStorage，可导出备份。
 * 不在代码中写死任何 API 密钥。
 */
(function () {
  'use strict';

  const BANK = window.BANK;
  if (!BANK) {
    document.getElementById('view').innerHTML =
      '<div class="card card-pad"><h2 class="page-title">题库未加载</h2>' +
      '<p class="muted">请确认 <code>data/bank.js</code> 与 index.html 在同一目录下；若直接双击打开仍报错，请改用本地服务器启动（见 README）。</p></div>';
    return;
  }

  /* ---------------- 基础工具 ---------------- */
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const now = () => Date.now();
  const todayKey = (d) => {
    const t = d ? new Date(d) : new Date();
    return t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0');
  };
  const uid = () => 's' + now().toString(36) + Math.random().toString(36).slice(2, 6);
  const pad2 = (n) => String(n).padStart(2, '0');
  const fmtTime = (ms) => {
    if (!ms || ms < 0) ms = 0;
    const s = Math.floor(ms / 1000);
    return pad2(Math.floor(s / 60)) + ':' + pad2(s % 60);
  };
  const fmtDur = (ms) => {
    if (!ms) return '0 秒';
    if (ms < 60000) return Math.max(1, Math.round(ms / 1000)) + ' 秒';
    const m = Math.round(ms / 60000);
    if (m < 60) return m + ' 分钟';
    return Math.floor(m / 60) + ' 小时 ' + (m % 60) + ' 分';
  };
  const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : 0);
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const sum = (arr, f) => arr.reduce((s, x) => s + (f ? f(x) : x), 0);
  const diffLabel = (d) => ({ 1: '基础', 2: '进阶', 3: '拔高' }[d] || '进阶');
  const diffDots = (d) => '●'.repeat(d) + '○'.repeat(3 - d);

  const MODULES = BANK.modules.slice().sort((a, b) => a.order - b.order);
  const MOD = Object.fromEntries(MODULES.map((m) => [m.id, m]));
  const POINT = Object.fromEntries(BANK.points.map((p) => [p.id, p]));
  const MATERIAL = Object.fromEntries((BANK.materials || []).map((m) => [m.id, m]));
  const QMAP = Object.fromEntries(BANK.questions.map((q) => [q.id, q]));
  const REASONS = ['概念不清', '计算失误', '审题偏差', '时间不够', '完全没思路'];

  /* ---------------- 状态 ---------------- */
  const SKEY = 'sas.state.v1';
  const CKEY = 'sas.current.v1';

  function defaults() {
    return {
      v: 1,
      createdAt: now(),
      lastActive: now(),
      settings: {
        goal: 20,
        instant: true,
        shuffle: true,
        theme: 'auto',
        ai: {
          provider: 'custom',
          cloudEndpoint: '',
          publishableKey: '',
          cloudModel: '',
          cloudModels: [],
          base: 'https://api.deepseek.com/v1',
          model: 'deepseek-chat',
          key: '',
          remember: true,
          priceIn: 2,
          priceOut: 8,
          dailyCalls: 40,
          maxTokens: 900,
          temperature: 0.4,
          proxy: 'auto'
        }
      },
      records: {},
      sessions: [],
      daily: {},
      aiUsage: { date: todayKey(), calls: 0, tin: 0, tout: 0, cost: 0 },
      aiChat: [],
      imported: [],
      importedMeta: { points: [], materials: [] },
      pending: [],
      lastPractice: null
    };
  }

  function loadState() {
    let raw = null;
    try { raw = localStorage.getItem(SKEY); } catch (e) { /* 隐私模式 */ }
    const base = defaults();
    if (!raw) return base;
    try {
      const s = JSON.parse(raw);
      const out = Object.assign(base, s);
      out.settings = Object.assign(base.settings, s.settings || {});
      out.settings.ai = Object.assign(base.settings.ai, (s.settings || {}).ai || {});
      out.records = s.records || {};
      out.sessions = s.sessions || [];
      out.daily = s.daily || {};
      out.aiUsage = Object.assign(base.aiUsage, s.aiUsage || {});
      out.aiChat = s.aiChat || [];
      out.imported = s.imported || [];
      out.importedMeta = Object.assign({ points: [], materials: [] }, s.importedMeta || {});
      out.pending = s.pending || [];
      return out;
    } catch (e) { return base; }
  }

  let S = loadState();
  let CURRENT = null;
  let SETUP = { modules: MODULES.map((m) => m.id), points: [], diff: [], count: 20, mode: 'special' };
  let TIMER = null;
  let QSTART = now();
  let AI_BUSY = false;
  let ROUTE = '#/home';

  function save() {
    S.lastActive = now();
    try { localStorage.setItem(SKEY, JSON.stringify(S)); } catch (e) { toast('保存失败：浏览器存储不可用或已满'); }
  }
  function saveCurrent() {
    try { CURRENT ? localStorage.setItem(CKEY, JSON.stringify(CURRENT)) : localStorage.removeItem(CKEY); } catch (e) {}
  }
  function loadCurrent() {
    try {
      const raw = localStorage.getItem(CKEY);
      if (!raw) return null;
      const c = JSON.parse(raw);
      if (!c || !c.qids || !c.qids.length) return null;
      if (c.qids.some((id) => !QMAP[id])) return null;
      return c;
    } catch (e) { return null; }
  }

  function rec(id) {
    if (!S.records[id]) {
      S.records[id] = { seen: 0, right: 0, wrong: 0, lastAt: 0, lastMs: 0, reasons: {}, note: '', fav: false, mastered: false, favAt: 0, wrongAt: 0 };
    }
    const r = S.records[id];
    r.reasons = r.reasons || {};
    return r;
  }
  function ensureToday() {
    const t = todayKey();
    if (S.aiUsage.date !== t) S.aiUsage = { date: t, calls: 0, tin: 0, tout: 0, cost: 0 };
    return t;
  }
  function dayStat(key) {
    const k = key || todayKey();
    if (!S.daily[k]) S.daily[k] = { answered: 0, right: 0, ms: 0 };
    return S.daily[k];
  }

  function streakDays() {
    let n = 0;
    const d = new Date();
    for (;;) {
      const k = todayKey(d);
      const st = S.daily[k];
      if (st && st.answered > 0) { n++; d.setDate(d.getDate() - 1); }
      else if (n === 0 && k === todayKey()) { d.setDate(d.getDate() - 1); }
      else break;
    }
    return n;
  }

  /* ---------------- 导入题库合并 ---------------- */
  (function mergeImported() {
    const meta = S.importedMeta || {};
    (meta.points || []).forEach((p) => {
      if (p && p.id && !POINT[p.id]) { BANK.points.push(p); POINT[p.id] = p; }
    });
    (meta.materials || []).forEach((m) => {
      if (m && m.id && !MATERIAL[m.id]) { BANK.materials.push(m); MATERIAL[m.id] = m; }
    });
    if (!S.imported || !S.imported.length) return;
    const ids = new Set(BANK.questions.map((q) => q.id));
    S.imported.forEach((q) => {
      if (!q || !q.id || ids.has(q.id)) return;
      if (!Array.isArray(q.options) || typeof q.answer !== 'number') return;
      const qq = Object.assign({ module: 'ziliao', point: 'zl-zonghe', difficulty: 2, explain: '', optionNotes: [], method: '', traps: [], materialId: null, calc: null, tags: [] }, q);
      qq.source = qq.source || '用户导入';
      qq.review = qq.review || { status: 'pending', note: '用户导入，未审核' };
      BANK.questions.push(qq);
      QMAP[qq.id] = qq;
      ids.add(qq.id);
    });
  })();

  /* ---------------- 主题 ---------------- */
  function applyTheme() {
    const t = S.settings.theme;
    const dark = t === 'dark' || (t === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    const meta = document.querySelector('meta[name=theme-color]');
    if (meta) meta.setAttribute('content', dark ? '#14161a' : '#f6f3ec');
  }
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (S.settings.theme === 'auto') applyTheme(); });

  /* ---------------- 导航 ---------------- */
  const NAV = [
    { go: '#/home', label: '今日', ic: '◉' },
    { go: '#/practice', label: '练习', ic: '✎' },
    { go: '#/exam', label: '模考', ic: '◷' },
    { go: '#/wrong', label: '错题本', ic: '✕' },
    { go: '#/fav', label: '收藏', ic: '★' },
    { go: '#/graph', label: '知识图谱', ic: '⌘' },
    { go: '#/stats', label: '统计', ic: '▤' },
    { go: '#/ai', label: 'AI 教师', ic: '✦' },
    { go: '#/settings', label: '设置', ic: '⚙' }
  ];
  const BNAV = [
    { go: '#/home', label: '今日', ic: '◉' },
    { go: '#/practice', label: '练习', ic: '✎' },
    { go: '#/exam', label: '模考', ic: '◷' },
    { go: '#/wrong', label: '错题', ic: '✕' },
    { go: '#/settings', label: '我的', ic: '☰' }
  ];

  function renderNav() {
    const cur = location.hash || '#/home';
    $('#nav').innerHTML = NAV.map((n) =>
      `<a class="nav-item ${cur.startsWith(n.go) ? 'active' : ''}" href="${n.go}"><span class="ic">${n.ic}</span>${n.label}</a>`
    ).join('') + '<div class="nav-sep"></div>' +
      `<a class="nav-item ${cur.startsWith('#/about') ? 'active' : ''}" href="#/about"><span class="ic">◈</span>关于与授权</a>`;
    $('#bottomnav').innerHTML = BNAV.map((n) =>
      `<a class="bn-item ${cur.startsWith(n.go) ? 'active' : ''}" href="${n.go}"><span class="ic">${n.ic}</span>${n.label}</a>`
    ).join('');
    $('#sideStreak').textContent = streakDays();
    $('#sideBank').textContent = `${BANK.questions.length} 题 · v${BANK.version}`;
  }

  /* ---------------- 通用片段 ---------------- */
  function pointName(id) { return (POINT[id] && POINT[id].name) || id; }
  function moduleName(id) { return (MOD[id] && MOD[id].name) || id; }
  function bar(v, color) { return `<div class="bar"><i style="width:${clamp(v, 0, 100)}%${color ? ';background:' + color : ''}"></i></div>`; }

  function breadcrumb(text, href) {
    return `<div class="small muted" style="margin-bottom:8px"><a href="${href || '#/home'}">← ${esc(text)}</a></div>`;
  }

  function materialHtml(m, collapsed) {
    if (!m) return '';
    let body = '';
    if (m.table) {
      body += '<div class="tablewrap"><table><thead><tr>' + m.table.head.map((h) => `<th>${esc(h)}</th>`).join('') + '</tr></thead><tbody>' +
        m.table.rows.map((r) => '<tr>' + r.map((c) => `<td>${esc(c)}</td>`).join('') + '</tr>').join('') + '</tbody></table></div>';
    }
    body += String(m.body || '').split('\n').filter(Boolean).map((p) => `<div>${esc(p)}</div>`).join('');
    if (m.note) body += `<div class="note">${esc(m.note)}</div>`;
    return `<section class="material ${collapsed ? 'collapsed' : ''}" id="material">
      <div class="spread"><h4>${esc(m.title)} <span class="tag">${esc(m.kind)}</span></h4>
      <button class="mat-toggle" data-action="toggle-material">${collapsed ? '展开' : '收起'}</button></div>
      <div class="mat-body">${body}</div>
    </section>`;
  }

  /* ---------------- 首页 ---------------- */
  function viewHome() {
    const st = dayStat();
    const goal = S.settings.goal || 20;
    const rate = pct(st.right, st.answered);
    const circumference = 2 * Math.PI * 50;
    const offset = circumference * (1 - clamp(st.answered / goal, 0, 1));
    const total = sum(Object.values(S.records), (r) => r.seen);
    const totalRight = sum(Object.values(S.records), (r) => r.right);

    const modCards = MODULES.map((m) => {
      const qs = BANK.questions.filter((q) => q.module === m.id);
      const rs = qs.map((q) => S.records[q.id]).filter((r) => r && r.seen);
      const done = rs.length;
      const acc = pct(sum(rs, (r) => r.right), sum(rs, (r) => r.seen));
      return `<a class="card mod-card" href="#/practice?m=${m.id}">
        <div class="mod-top"><span class="mod-name"><span class="mod-dot" style="background:${m.color}"></span>${esc(m.name)}</span>
        <span class="mod-pct mono">${done ? acc + '%' : '—'}</span></div>
        ${bar(done ? acc : 0, m.color)}
        <div class="mod-meta"><span>${done}/${qs.length} 题</span><span>${m.short}</span></div>
      </a>`;
    }).join('');

    const weak = weakPoints(3);
    const weakHtml = weak.length ? weak.map((w) => `<div class="weak-row">
        <div><div class="weak-name">${esc(w.name)}</div><div class="tiny muted">${esc(moduleName(w.module))} · 已练 ${w.n} 题</div></div>
        <div class="row"><span class="weak-val mono">${w.acc}%</span><a class="btn sm ghost" href="#/practice?p=${w.id}">去练</a></div>
      </div>`).join('') : `<div class="small muted">练几道题后，这里会显示需要补的知识点。</div>`;

    const recentWrong = Object.entries(S.records)
      .filter(([, r]) => r.wrong > 0 && !r.mastered)
      .sort((a, b) => b[1].wrongAt - a[1].wrongAt).slice(0, 3);
    const rwHtml = recentWrong.length ? recentWrong.map(([id, r]) => {
      const q = QMAP[id]; if (!q) return '';
      return `<a class="recent-row" href="#/quiz?review=${id}">
        <div style="min-width:0"><div class="weak-name" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(stripHtml(q.stem)).slice(0, 42)}</div>
        <div class="tiny muted">${esc(moduleName(q.module))} · 错 ${r.wrong} 次</div></div>
        <span class="tag bad">回顾</span></a>`;
    }).join('') : `<div class="small muted">暂无错题。保持住。</div>`;

    const resume = S.lastPractice && S.lastPractice.qids ? `<a class="btn ghost" href="#/quiz?resume=1">继续上次（${S.lastPractice.done}/${S.lastPractice.total}）</a>` : '';

    return `<div class="fade-in">
      <div class="page-head">
        <div>
          <div class="kicker">${new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' })}</div>
          <h1 class="page-title">今天也来两道？</h1>
          <div class="page-sub">累计 ${total} 题，正确率 ${pct(totalRight, total)}%${total ? '' : '，从资料分析开始最划算'}</div>
        </div>
        <div class="row">${resume}<a class="btn primary" href="#/practice">开始练习</a></div>
      </div>

      <section class="card hero">
        <div class="hero-main">
          <div class="kicker">今日目标 · ${goal} 题</div>
          <h2>${st.answered >= goal ? '今天的量，够了。' : st.answered ? '节奏不错，别停。' : '先做 10 道，找找手感。'}</h2>
          <p>${st.answered >= goal ? '可以复盘错题，或者去模考里练一次时间分配。' : `已完成 ${st.answered} 题，正确率 ${rate}%。建议先做资料分析，性价比最高。`}</p>
          <div class="row">
            <a class="btn primary" href="#/practice?m=ziliao">练资料分析</a>
            <a class="btn ghost" href="#/practice?mode=wrong">错题重练</a>
          </div>
        </div>
        <div class="hero-side">
          <div class="ring">
            <svg width="118" height="118" viewBox="0 0 118 118">
              <circle cx="59" cy="59" r="50" fill="none" stroke="var(--line)" stroke-width="7"></circle>
              <circle cx="59" cy="59" r="50" fill="none" stroke="var(--accent)" stroke-width="7"
                stroke-linecap="round" stroke-dasharray="${circumference}" stroke-dashoffset="${offset}"></circle>
            </svg>
            <div class="ring-label"><b>${st.answered}</b><span>/ ${goal} 题</span></div>
          </div>
          <div class="small muted">连续 ${streakDays()} 天</div>
        </div>
      </section>

      <div class="grid g3" style="margin-bottom:18px">${modCards}</div>

      <div class="grid g2">
        <section class="card card-pad">
          <div class="spread" style="margin-bottom:6px"><h3 class="card-title" style="margin:0">该补的洞</h3><a class="small muted" href="#/stats">全部统计 →</a></div>
          ${weakHtml}
        </section>
        <section class="card card-pad">
          <div class="spread" style="margin-bottom:6px"><h3 class="card-title" style="margin:0">最近错题</h3><a class="small muted" href="#/wrong">错题本 →</a></div>
          ${rwHtml}
        </section>
      </div>
    </div>`;
  }

  function weakPoints(limit) {
    const by = {};
    Object.entries(S.records).forEach(([id, r]) => {
      const q = QMAP[id]; if (!q || !r.seen) return;
      const k = q.point;
      by[k] = by[k] || { id: k, module: q.module, n: 0, right: 0 };
      by[k].n += r.seen; by[k].right += r.right;
    });
    return Object.values(by).filter((x) => x.n >= 2).map((x) => Object.assign(x, { name: pointName(x.id), acc: pct(x.right, x.n) }))
      .sort((a, b) => a.acc - b.acc).slice(0, limit || 99);
  }
  function stripHtml(s) { return String(s || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(); }

  /* ---------------- 练习设置 ---------------- */
  function viewPractice(params) {
    if (params.get('m')) { SETUP.modules = [params.get('m')]; SETUP.points = []; }
    if (params.get('p')) {
      const p = POINT[params.get('p')];
      if (p) { SETUP.modules = [p.module]; SETUP.points = [p.id]; }
    }
    if (params.get('mode')) SETUP.mode = params.get('mode');
    if (params.get('mode') === 'wrong') SETUP.modules = MODULES.map((m) => m.id);

    const pool = poolOf(SETUP);
    const pts = BANK.points.filter((p) => SETUP.modules.includes(p.module));
    const canStart = pool.length > 0;

    return `<div class="fade-in">
      ${breadcrumb('首页', '#/home')}
      <div class="page-head"><div><h1 class="page-title">练习</h1>
      <div class="page-sub">按模块、知识点、难度组合；当前题库 ${BANK.questions.length} 题</div></div></div>

      <section class="card card-pad" style="margin-bottom:14px">
        <div class="card-title">先选练法</div>
        <div class="row" style="margin-bottom:18px">
          ${[['special', '专项练习', '按知识点逐个击破'], ['seq', '顺序练习', '按课程顺序推进'], ['random', '随机练习', '打散顺序，检验手感']]
            .map(([k, n, d]) => `<button class="chip ${SETUP.mode === k ? 'on' : ''}" data-action="setup-mode" data-val="${k}" title="${d}">${n}</button>`).join('')}
        </div>

        <div class="card-title">模块</div>
        <div class="row" style="margin-bottom:18px">
          ${MODULES.map((m) => `<button class="chip ${SETUP.modules.includes(m.id) ? 'on' : ''}" data-action="setup-module" data-val="${m.id}">${esc(m.name)}</button>`).join('')}
          <button class="link small" data-action="setup-all" style="margin-left:4px">全选 / 全不选</button>
        </div>

        <div class="spread" style="margin-bottom:6px"><div class="card-title" style="margin:0">知识点</div>
          <button class="link small" data-action="setup-clear-points">清空</button></div>
        <div class="row" style="margin-bottom:18px;max-height:168px;overflow:auto">
          ${pts.length ? pts.map((p) => `<button class="chip ${SETUP.points.includes(p.id) ? 'on' : ''}" data-action="setup-point" data-val="${p.id}">${esc(p.name)}</button>`).join('') : '<span class="small muted">先选模块</span>'}
          ${pts.length ? '<span class="tiny muted" style="width:100%">不选任何知识点 = 该模块全部</span>' : ''}
        </div>

        <div class="grid g2">
          <div>
            <div class="card-title">难度</div>
            <div class="row">
              ${[[1, '基础'], [2, '进阶'], [3, '拔高']].map(([d, n]) => `<button class="chip ${SETUP.diff.includes(d) ? 'on' : ''}" data-action="setup-diff" data-val="${d}">${n}</button>`).join('')}
            </div>
          </div>
          <div>
            <div class="card-title">题量</div>
            <div class="row">
              ${[10, 20, 30, 50].map((n) => `<button class="chip ${SETUP.count === n ? 'on' : ''}" data-action="setup-count" data-val="${n}">${n} 题</button>`).join('')}
            </div>
          </div>
        </div>
      </section>

      <div class="spread">
        <div class="small muted">可选 <b class="mono">${pool.length}</b> 题，本次练 <b class="mono">${Math.min(SETUP.count, pool.length)}</b> 题${SETUP.mode === 'wrong' ? '（错题优先）' : ''}</div>
        <button class="btn primary" data-action="start-practice" ${canStart ? '' : 'disabled'}>开始练习 →</button>
      </div>
    </div>`;
  }

  function poolOf(cfg) {
    let qs = BANK.questions.filter((q) => cfg.modules.includes(q.module));
    if (cfg.points.length) qs = qs.filter((q) => cfg.points.includes(q.point));
    if (cfg.diff.length) qs = qs.filter((q) => cfg.diff.includes(q.difficulty));
    if (cfg.mode === 'wrong') {
      return qs.filter((q) => { const r = S.records[q.id]; return r && r.wrong > 0 && !r.mastered; });
    }
    return qs;
  }

  function startPractice(mode, opts) {
    const cfg = Object.assign({}, SETUP, opts || {});
    let qids;
    if (mode === 'review-one') {
      qids = [opts.id];
    } else if (mode === 'fav') {
      qids = BANK.questions.filter((q) => S.records[q.id] && S.records[q.id].fav).map((q) => q.id);
      if (!qids.length) return toast('还没有收藏的题目');
    } else {
      let qs = poolOf(cfg);
      if (!qs.length) return toast('这个组合暂时没有题目，放宽一点条件');
      if (cfg.mode === 'random' || (cfg.mode === 'special' && cfg.points.length === 0)) {
        qs = qs.slice().sort(() => Math.random() - 0.5);
      } else if (cfg.mode === 'wrong') {
        // poolOf 已把错题排在前面，保持顺序
      } else {
        qs = qs.slice().sort((a, b) => (MOD[a.module].order - MOD[b.module].order) || a.id.localeCompare(b.id));
      }
      qids = qs.slice(0, cfg.count).map((q) => q.id);
    }
    CURRENT = {
      id: uid(), mode: mode === 'review-one' ? 'review' : (mode === 'fav' ? 'fav' : cfg.mode),
      qids, i: 0, answers: {}, flags: {}, startTs: now(), lastTs: now(),
      limitSec: 0, moduleFilter: cfg.modules.join(','), done: 0, total: qids.length
    };
    QSTART = now();
    saveCurrent();
    go('#/quiz');
  }

  /* ---------------- 答题 ---------------- */
  function viewQuiz(params) {
    if (params.get('review')) {
      const id = params.get('review');
      if (QMAP[id]) {
        CURRENT = { id: uid(), mode: 'review', qids: [id], i: 0, answers: {}, flags: {}, startTs: now(), lastTs: now(), limitSec: 0, done: 0, total: 1 };
        saveCurrent();
        return renderQuiz();
      }
    }
    if (params.get('resume') === '1') {
      const c = loadCurrent();
      if (c) { CURRENT = c; QSTART = now(); return renderQuiz(); }
    }
    if (!CURRENT) {
      const c = loadCurrent();
      if (c) { CURRENT = c; QSTART = now(); return renderQuiz(); }
      return `<div class="card card-pad"><div class="empty"><b>没有进行中的练习</b><a class="btn primary" href="#/practice">去选一组题</a></div></div>`;
    }
    return renderQuiz();
  }

  function renderQuiz() {
    if (!CURRENT) return viewPractice(new URLSearchParams());
    const q = QMAP[CURRENT.qids[CURRENT.i]];
    if (!q) { CURRENT = null; return `<div class="card card-pad">题目已不存在，可能是题库版本变化。</div>`; }
    const chosen = CURRENT.answers[q.id];
    const answered = typeof chosen === 'number';
    const isMock = CURRENT.mode === 'mock';
    const showFb = answered && !isMock && (S.settings.instant || CURRENT.mode === 'review');
    const m = q.materialId ? MATERIAL[q.materialId] : null;
    const r = S.records[q.id] || {};

    const opts = q.options.map((o, i) => {
      let cls = 'opt';
      if (isMock) { if (chosen === i) cls += ' chosen'; }
      else if (showFb) {
        if (i === q.answer) cls += ' correct';
        else if (i === chosen) cls += ' wrong';
        else cls += ' dim';
      } else if (chosen === i) cls += ' chosen';
      return `<button class="${cls}" data-action="choose" data-val="${i}" ${answered && !isMock ? 'disabled' : ''}>
        <span class="key">${'ABCD'[i]}</span><span>${esc(o)}</span></button>`;
    }).join('');

    const progress = `第 ${CURRENT.i + 1} / ${CURRENT.qids.length} 题`;

    return `<div class="fade-in">
      <div class="quiz-head">
        <button class="btn sm ghost" data-action="quit-quiz">← 退出</button>
        <div class="quiz-progress">
          <div class="spread small muted" style="margin-bottom:4px"><span>${progress}</span><span>${CURRENT.mode === 'mock' ? '模考' : CURRENT.mode === 'wrong' ? '错题重练' : CURRENT.mode === 'fav' ? '收藏重练' : CURRENT.mode === 'review' ? '题目回顾' : '练习'}</span></div>
          ${bar(((CURRENT.i + (answered ? 1 : 0)) / CURRENT.qids.length) * 100)}
        </div>
        <div class="quiz-meta">
          ${isMock ? `<span class="timer" id="timer">${fmtTime(((CURRENT.limitSec || 2100) * 1000) - (now() - CURRENT.startTs))}</span>` : `<span class="timer" id="timer">${fmtTime(now() - (QSTART || now()))}</span>`}
          <button class="btn sm ghost" data-action="sheet">答题卡</button>
          ${isMock ? '<button class="btn sm soft" data-action="submit-exam">交卷</button>' : (CURRENT.mode === 'review' ? '' : '<button class="btn sm ghost" data-action="finish">结束</button>')}
        </div>
      </div>

      ${m ? materialHtml(m, !!CURRENT.matCollapsed) : ''}

      <section class="card qcard">
        <div class="q-top">
          <span class="q-no">${q.id.toUpperCase()}</span>
          <span class="tag">${esc(moduleName(q.module))}</span>
          <span class="tag">${esc(pointName(q.point))}</span>
          <span class="tag">${diffLabel(q.difficulty)} ${diffDots(q.difficulty)}</span>
          ${q.review && q.review.status === 'disputed' ? '<span class="tag warn">存疑</span>' : ''}
          ${q.review && q.review.status === 'pending' ? '<span class="tag warn">待审核</span>' : ''}
          <span style="flex:1"></span>
          <button class="btn sm ghost" data-action="fav" title="收藏">${r.fav ? '★ 已收藏' : '☆ 收藏'}</button>
        </div>
        <div class="q-stem">${q.stem}</div>
        <div class="opts">${opts}</div>
        ${showFb ? feedbackHtml(q, chosen, r) : ''}
        ${answered && !isMock && !S.settings.instant && CURRENT.mode !== 'review' ? `<div class="actions"><button class="btn sm" data-action="show-answer">查看答案与解析</button></div>` : ''}
      </section>

      <div class="quiz-foot">
        <button class="btn ghost" data-action="prev" ${CURRENT.i === 0 ? 'disabled' : ''}>上一题</button>
        <div class="mid">
          ${isMock ? `<button class="btn sm ghost" data-action="flag">${CURRENT.flags[q.id] ? '取消标记' : '标记'}</button>` : ''}
          <button class="btn sm ghost" data-action="open-ai">问 AI</button>
        </div>
        ${CURRENT.mode === 'review'
          ? '<button class="btn primary" data-action="review-back">返回</button>'
          : (CURRENT.i === CURRENT.qids.length - 1
            ? `<button class="btn primary" data-action="${isMock ? 'submit-exam' : 'finish'}">${isMock ? '交卷' : '完成'}</button>`
            : '<button class="btn primary" data-action="next">下一题 →</button>')}
      </div>
    </div>`;
  }

  function feedbackHtml(q, chosen, r) {
    const ok = chosen === q.answer;
    const notes = (q.optionNotes || []).map((t, i) =>
      `<li class="${i === q.answer ? 'right' : ''}"><b>${'ABCD'[i]}</b><span>${esc(t)}</span></li>`).join('');
    return `<div class="feedback">
      <div class="verdict ${ok ? 'ok' : 'no'}">${ok ? '✓ 答对了' : '✕ 答错了'} <span class="tag ${ok ? 'good' : 'bad'}">正确答案 ${'ABCD'[q.answer]}</span></div>
      <div class="fb-block"><h5>解析</h5><div class="fb-text">${esc(q.explain).replace(/\n/g, '<br>')}</div></div>
      ${notes ? `<div class="fb-block"><h5>选项分析</h5><ul class="opt-notes">${notes}</ul></div>` : ''}
      ${q.method ? `<div class="fb-block"><h5>方法</h5><div class="method-box">${esc(q.method)}</div></div>` : ''}
      ${(q.traps && q.traps.length) ? `<div class="fb-block"><h5>易错点</h5><div class="trap-box"><ul>${q.traps.map((t) => `<li>${esc(t)}</li>`).join('')}</ul></div></div>` : ''}
      ${q.calc ? `<div class="fb-block"><h5>验算</h5><div class="small muted mono">${esc(q.calc.expr)} ≈ ${esc(q.calc.value)}${q.review && q.review.status === 'verified' ? ' · 已由脚本复算' : ''}</div></div>` : ''}
      <div class="fb-block"><h5>来源与审核</h5><div class="small muted">${esc(q.source || '原创')} · ${esc((q.review && q.review.note) || '未标注')}</div></div>
      ${!ok ? `<div class="reason-box"><h5 style="font-size:11.5px;letter-spacing:.12em;color:var(--muted);margin:0 0 4px">记一下错因</h5>
        <div class="chips">${REASONS.map((x) => `<button class="chip ${r.reasons && r.reasons[x] ? 'on' : ''}" data-action="reason" data-val="${esc(x)}">${x}</button>`).join('')}</div></div>` : ''}
      <div class="fb-block">
        <h5>笔记</h5>
        <textarea class="input" rows="2" placeholder="记一句自己的话，比抄解析有用" data-action="note">${esc(r.note || '')}</textarea>
      </div>
      <div class="actions">
        <button class="btn sm soft" data-action="ask-explain">让 AI 讲透这题</button>
        <button class="btn sm ghost" data-action="ask-similar">生成同类题</button>
        ${r.fav ? '<button class="btn sm ghost" data-action="fav">取消收藏</button>' : '<button class="btn sm ghost" data-action="fav">收藏</button>'}
      </div>
    </div>`;
  }

  function choose(i) {
    if (!CURRENT) return;
    const q = QMAP[CURRENT.qids[CURRENT.i]];
    if (!q) return;
    if (CURRENT.mode === 'mock') {
      CURRENT.answers[q.id] = i;
      saveCurrent();
      render();
      return;
    }
    if (typeof CURRENT.answers[q.id] === 'number') return;
    CURRENT.answers[q.id] = i;
    const ms = now() - QSTART;
    commitAnswer(q, i, ms);
    if (S.settings.instant) render();
    else render();
  }

  function commitAnswer(q, chosen, ms) {
    const r = rec(q.id);
    r.seen += 1;
    r.lastAt = now();
    r.lastMs = ms;
    if (chosen === q.answer) r.right += 1;
    else { r.wrong += 1; r.wrongAt = now(); }
    const st = dayStat();
    st.answered += 1; st.ms += ms;
    if (chosen === q.answer) st.right += 1;
    CURRENT.done = Object.keys(CURRENT.answers).length;
    S.lastPractice = { qids: CURRENT.qids, done: CURRENT.done, total: CURRENT.qids.length, at: now() };
    save(); saveCurrent();
  }

  function nextQ() {
    if (!CURRENT) return;
    if (CURRENT.i < CURRENT.qids.length - 1) { CURRENT.i++; QSTART = now(); saveCurrent(); render(); }
    else finishPractice();
  }

  function finishPractice() {
    if (!CURRENT) return;
    const qids = CURRENT.qids.filter((id) => typeof CURRENT.answers[id] === 'number');
    if (!qids.length) { toast('这一题还没答，先选一个选项'); return; }
    const skipped = CURRENT.qids.length - qids.length;
    const items = qids.map((id) => {
      const q = QMAP[id];
      const chosen = CURRENT.answers[id];
      return { qid: id, chosen, right: chosen === q.answer, module: q.module, point: q.point };
    });
    const right = items.filter((x) => x.right).length;
    const timeMs = now() - CURRENT.startTs;
    const session = {
      id: CURRENT.id, mode: CURRENT.mode, at: CURRENT.startTs, timeMs,
      total: qids.length, right, items, skipped, moduleFilter: CURRENT.moduleFilter
    };
    S.sessions.unshift(session);
    if (S.sessions.length > 120) S.sessions.length = 120;
    S.lastResult = session;
    save();
    CURRENT = null; saveCurrent();
    go('#/result?last=1');
  }

  /* ---------------- 结果 ---------------- */
  function viewResult(params) {
    const session = params.get('mock')
      ? S.sessions.find((x) => x.mode === 'mock')
      : (params.get('last') ? S.lastResult : S.sessions[0]);
    if (!session) return `<div class="card card-pad"><div class="empty"><b>还没有练习记录</b><a class="btn primary" href="#/practice">开始第一组</a></div></div>`;
    const score = Math.round((session.right / session.total) * 1000) / 10;
    const byMod = {};
    session.items.forEach((it) => {
      byMod[it.module] = byMod[it.module] || { n: 0, right: 0 };
      byMod[it.module].n++; if (it.right) byMod[it.module].right++;
    });
    const modRows = Object.entries(byMod).map(([mid, v]) => `<div class="dist-row">
      <span class="nm">${esc(moduleName(mid))}</span>${bar(pct(v.right, v.n), MOD[mid] && MOD[mid].color)}
      <span class="vl mono">${v.right}/${v.n}</span></div>`).join('');
    const weak = weakPoints(4).filter((w) => session.items.some((it) => it.point === w.id));
    const wrong = session.items.filter((it) => !it.right);

    const wrongHtml = wrong.length ? wrong.map((it) => {
      const q = QMAP[it.qid];
      return `<div class="list-item">
        <div class="li-head"><div class="li-meta"><span class="tag">${esc(pointName(q.point))}</span><span>你选 ${it.chosen != null ? 'ABCD'[it.chosen] : '未答'} · 正确 ${'ABCD'[q.answer]}</span></div>
        <a class="btn sm ghost" href="#/quiz?review=${q.id}">看解析</a></div>
        <div class="li-title">${esc(stripHtml(q.stem)).slice(0, 80)}</div>
      </div>`;
    }).join('') : `<div class="empty"><b>全对</b>这组题没有错题。</div>`;

    return `<div class="fade-in">
      <div class="page-head"><div><div class="kicker">练习完成</div><h1 class="page-title">成绩单</h1>
      <div class="page-sub">${new Date(session.at).toLocaleString('zh-CN')} · 用时 ${fmtDur(session.timeMs)}${session.skipped ? ' · 跳过 ' + session.skipped + ' 题（不计入）' : ''}</div></div>
      <div class="row"><a class="btn ghost" href="#/practice">再来一组</a>${wrong.length ? `<button class="btn primary" data-action="retry-wrong">重练错题（${wrong.length}）</button>` : ''}</div></div>

      <section class="card score-hero" style="margin-bottom:14px">
        <div><div class="score-num">${score}<span style="font-size:18px">分</span></div><div class="score-cap">正确率 ${pct(session.right, session.total)}%</div></div>
        <div class="stat-grid">
          <div class="stat"><b>${session.right}/${session.total}</b><span>答对题数</span></div>
          <div class="stat"><b>${Math.round(session.timeMs / session.total / 1000)}s</b><span>平均每题</span></div>
          <div class="stat"><b>${fmtDur(session.timeMs)}</b><span>总用时</span></div>
        </div>
      </section>

      <div class="grid g2" style="margin-bottom:14px">
        <section class="card card-pad"><h3 class="card-title">各模块</h3>${modRows || '<div class="small muted">—</div>'}</section>
        <section class="card card-pad"><h3 class="card-title">薄弱知识点</h3>
          ${weak.length ? weak.map((w) => `<div class="weak-row"><div><div class="weak-name">${esc(w.name)}</div><div class="tiny muted">累计正确率 ${w.acc}%</div></div><a class="btn sm ghost" href="#/practice?p=${w.id}">去练</a></div>`).join('') : '<div class="small muted">这组没有明显薄弱点，或样本太少。</div>'}
        </section>
      </div>

      <section class="card"><div class="card-pad" style="padding-bottom:6px"><h3 class="card-title" style="margin:0">错题回顾</h3></div>${wrongHtml}</section>
    </div>`;
  }

  /* ---------------- 模考 ---------------- */
  function viewExam() {
    const last = S.sessions.find((x) => x.mode === 'mock');
    return `<div class="fade-in">
      <div class="page-head"><div><div class="kicker">限时训练</div><h1 class="page-title">模拟考试</h1>
      <div class="page-sub">按模块比例抽题，计时交卷，自动评分并给出薄弱点</div></div></div>

      <section class="card card-pad" style="margin-bottom:14px">
        <h3 class="card-title">组卷设置</h3>
        <div class="grid g3">
          <div class="field"><label>题量</label>
            <div class="row">${[20, 30, 40].map((n) => `<button class="chip ${(S.examCfg && S.examCfg.count === n) || (!S.examCfg && n === 30) ? 'on' : ''}" data-action="exam-count" data-val="${n}">${n} 题</button>`).join('')}</div>
          </div>
          <div class="field"><label>时长</label>
            <div class="row">${[25, 35, 45].map((n) => `<button class="chip ${(S.examCfg && S.examCfg.min === n) || (!S.examCfg && n === 35) ? 'on' : ''}" data-action="exam-min" data-val="${n}">${n} 分钟</button>`).join('')}</div>
          </div>
          <div class="field"><label>范围</label><div class="row">
            ${MODULES.map((m) => `<button class="chip ${!S.examCfg || !S.examCfg.off || !S.examCfg.off.includes(m.id) ? 'on' : ''}" data-action="exam-mod" data-val="${m.id}">${m.short}</button>`).join('')}
          </div></div>
        </div>
        <div class="spread" style="margin-top:6px">
          <div class="small muted">行测真实节奏约 50 秒/题；本卷按模块比例抽题。</div>
          <button class="btn primary" data-action="start-exam">开始模考</button>
        </div>
      </section>

      ${last ? `<section class="card card-pad">
        <div class="spread"><h3 class="card-title" style="margin:0">上一次模考</h3><a class="small muted" href="#/result?mock=1">查看报告 →</a></div>
        <div class="stat-grid" style="margin-top:10px">
          <div class="stat"><b>${Math.round((last.right / last.total) * 1000) / 10}</b><span>得分</span></div>
          <div class="stat"><b>${last.right}/${last.total}</b><span>答对</span></div>
          <div class="stat"><b>${fmtDur(last.timeMs)}</b><span>用时</span></div>
        </div>
      </section>` : `<div class="card card-pad small muted">还没有模考记录。第一次建议 30 题 / 35 分钟，先练时间分配。</div>`}
    </div>`;
  }

  function startExam() {
    const cfg = S.examCfg || { count: 30, min: 35, off: [] };
    const mods = MODULES.filter((m) => !cfg.off || !cfg.off.includes(m.id));
    if (!mods.length) return toast('至少选一个模块');
    const quota = Math.max(1, Math.round(cfg.count / mods.length));
    let picked = [];
    mods.forEach((m) => {
      const pool = BANK.questions.filter((q) => q.module === m.id).sort(() => Math.random() - 0.5);
      picked = picked.concat(pool.slice(0, quota));
    });
    if (picked.length < cfg.count) {
      const rest = BANK.questions.filter((q) => !picked.includes(q)).sort(() => Math.random() - 0.5);
      picked = picked.concat(rest.slice(0, cfg.count - picked.length));
    }
    picked = picked.slice(0, cfg.count).sort((a, b) => (MOD[a.module].order - MOD[b.module].order) || Math.random() - 0.5);
    CURRENT = {
      id: uid(), mode: 'mock', qids: picked.map((q) => q.id), i: 0, answers: {}, flags: {},
      startTs: now(), lastTs: now(), limitSec: cfg.min * 60, done: 0, total: picked.length,
      moduleFilter: mods.map((m) => m.id).join(',')
    };
    QSTART = now();
    saveCurrent();
    go('#/quiz');
  }

  function submitExam(force) {
    if (!CURRENT || CURRENT.mode !== 'mock') return;
    const unanswered = CURRENT.qids.filter((id) => typeof CURRENT.answers[id] !== 'number').length;
    if (!force && unanswered > 0) {
      return openModal('交卷确认', `<p>还有 <b>${unanswered}</b> 题没答。确定交卷吗？</p>`,
        `<button class="btn ghost" data-action="close-modal">再检查一下</button><button class="btn primary" data-action="submit-exam-force">确定交卷</button>`);
    }
    const qids = CURRENT.qids;
    qids.forEach((id) => {
      const q = QMAP[id];
      const chosen = CURRENT.answers[id];
      if (typeof chosen !== 'number') {
        const r = rec(id); r.seen++; r.lastAt = now();
        r.wrong++; r.wrongAt = now();
        const st = dayStat(); st.answered++;
        return;
      }
      commitAnswer(q, chosen, 0);
    });
    const items = qids.map((id) => {
      const q = QMAP[id]; const c = CURRENT.answers[id];
      return { qid: id, chosen: typeof c === 'number' ? c : null, right: c === q.answer, module: q.module, point: q.point };
    });
    const session = {
      id: CURRENT.id, mode: 'mock', at: CURRENT.startTs, timeMs: Math.min(now() - CURRENT.startTs, (CURRENT.limitSec || 2100) * 1000),
      total: qids.length, right: items.filter((x) => x.right).length, items, moduleFilter: CURRENT.moduleFilter
    };
    S.sessions.unshift(session);
    S.lastResult = session;
    save();
    CURRENT = null; saveCurrent();
    go('#/result?last=1');
  }

  /* ---------------- 错题本 / 收藏 ---------------- */
  function viewWrong() {
    const rows = Object.entries(S.records).filter(([, r]) => r.wrong > 0 && !r.mastered)
      .sort((a, b) => b[1].wrongAt - a[1].wrongAt);
    const byReason = {};
    rows.forEach(([id, r]) => Object.keys(r.reasons || {}).forEach((k) => { byReason[k] = (byReason[k] || 0) + (r.reasons[k] || 0); }));
    const reasonHtml = Object.entries(byReason).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<span class="tag">${esc(k)} ${v}</span>`).join('');

    return `<div class="fade-in">
      <div class="page-head"><div><h1 class="page-title">错题本</h1>
      <div class="page-sub">${rows.length} 题待消化 · 连续答对或手动标记后移出</div></div>
      <div class="row">${rows.length ? '<button class="btn primary" data-action="retry-all-wrong">全部重练</button>' : ''}</div></div>
      ${reasonHtml ? `<div class="row" style="margin-bottom:12px">${reasonHtml}</div>` : ''}
      ${rows.length ? `<section class="card">${rows.map(([id, r]) => {
        const q = QMAP[id]; if (!q) return '';
        return `<div class="list-item">
          <div class="li-head">
            <div class="li-meta"><span class="tag">${esc(moduleName(q.module))}</span><span class="tag">${esc(pointName(q.point))}</span>
            <span>错 ${r.wrong} 次 · ${new Date(r.wrongAt || r.lastAt).toLocaleDateString('zh-CN')}</span></div>
            <div class="row"><button class="btn sm ghost" data-action="master" data-val="${q.id}">已掌握</button>
            <a class="btn sm" href="#/quiz?review=${q.id}">重做</a></div>
          </div>
          <div class="li-title">${esc(stripHtml(q.stem)).slice(0, 90)}</div>
          <div class="tiny muted" style="margin-top:6px">正确答案 ${'ABCD'[q.answer]}${r.note ? ' · 笔记：' + esc(r.note) : ''}${Object.keys(r.reasons || {}).length ? ' · 错因：' + esc(Object.keys(r.reasons).join('、')) : ''}</div>
        </div>`;
      }).join('')}</section>` : `<div class="card"><div class="empty"><b>错题本还是空的</b>做错的题会自动进来，并记录错因和次数。</div></div>`}
    </div>`;
  }

  function viewFav() {
    const rows = Object.entries(S.records).filter(([, r]) => r.fav).sort((a, b) => (b[1].favAt || 0) - (a[1].favAt || 0));
    return `<div class="fade-in">
      <div class="page-head"><div><h1 class="page-title">收藏</h1><div class="page-sub">${rows.length} 题</div></div>
      ${rows.length ? '<button class="btn primary" data-action="practice-fav">练收藏题</button>' : ''}</div>
      ${rows.length ? `<section class="card">${rows.map(([id]) => {
        const q = QMAP[id]; if (!q) return '';
        return `<div class="list-item"><div class="li-head">
          <div class="li-meta"><span class="tag">${esc(moduleName(q.module))}</span><span class="tag">${esc(pointName(q.point))}</span></div>
          <div class="row"><button class="btn sm ghost" data-action="fav" data-val="${q.id}">取消收藏</button><a class="btn sm" href="#/quiz?review=${q.id}">重做</a></div></div>
          <div class="li-title">${esc(stripHtml(q.stem)).slice(0, 90)}</div></div>`;
      }).join('')}</section>` : `<div class="card"><div class="empty"><b>还没有收藏</b>题目右上角的星标，点一下就会存到这里。</div></div>`}
    </div>`;
  }

  /* ---------------- 知识图谱 ---------------- */
  function viewGraph() {
    return `<div class="fade-in">
      <div class="page-head"><div><div class="kicker">课程结构</div><h1 class="page-title">知识图谱</h1>
      <div class="page-sub">依据粉笔国考 980 行测讲义整理；每个知识点可追溯到课程与讲义页码</div></div></div>
      ${MODULES.map((m) => {
        const pts = BANK.points.filter((p) => p.module === m.id);
        if (!pts.length) return '';
        return `<section class="kg-mod">
          <div class="kg-mod-head"><h3>${esc(m.name)}</h3><span class="tiny muted">${pts.length} 个知识点</span></div>
          <div class="grid g2">${pts.map((p) => {
            const qs = BANK.questions.filter((q) => q.point === p.id);
            const rs = qs.map((q) => S.records[q.id]).filter((r) => r && r.seen);
            const acc = rs.length ? pct(sum(rs, (r) => r.right), sum(rs, (r) => r.seen)) : null;
            return `<a class="card point-card" href="#/point/${p.id}">
              <div class="pc-top"><h4>${esc(p.name)}</h4><div class="row"><span class="tiny muted mono">${acc === null ? '未练' : acc + '%'}</span><span class="mastery"><i style="width:${acc === null ? 0 : acc}%"></i></span></div></div>
              <div class="pc-meta">${esc(p.summary).slice(0, 52)}… · ${qs.length} 题</div></a>`;
          }).join('')}</div>
        </section>`;
      }).join('')}
    </div>`;
  }

  function viewPoint(id) {
    const p = POINT[id];
    if (!p) return `<div class="card card-pad">知识点不存在</div>`;
    const qs = BANK.questions.filter((q) => q.point === id);
    const rs = qs.map((q) => S.records[q.id]).filter((r) => r && r.seen);
    const acc = rs.length ? pct(sum(rs, (r) => r.right), sum(rs, (r) => r.seen)) : null;
    return `<div class="fade-in">
      ${breadcrumb('知识图谱', '#/graph')}
      <div class="page-head"><div><div class="kicker">${esc(moduleName(p.module))}</div><h1 class="page-title">${esc(p.name)}</h1>
      <div class="page-sub">${qs.length} 道题${acc === null ? '' : ' · 你的正确率 ' + acc + '%'}</div></div>
      <button class="btn primary" data-action="practice-point" data-val="${p.id}">练这个知识点</button></div>

      <section class="card card-pad" style="margin-bottom:14px">
        <h3 class="card-title">一句话概括</h3>
        <div class="fb-text">${esc(p.summary)}</div>
      </section>

      <div class="grid g2" style="margin-bottom:14px">
        <section class="card card-pad"><h3 class="card-title">方法</h3>
          <ul style="margin:0;padding-left:18px;line-height:1.9;font-size:14px">${p.methods.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></section>
        <section class="card card-pad"><h3 class="card-title">易错点</h3>
          <ul style="margin:0;padding-left:18px;line-height:1.9;font-size:14px">${p.traps.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></section>
      </div>

      <section class="card card-pad" style="margin-bottom:14px">
        <h3 class="card-title">课程出处</h3>
        ${(p.refs || []).map((r) => `<div class="ref"><b>${esc(r.course)}</b> · ${esc(r.teacher || '')} · ${esc(r.pdf || '')}${r.page && r.page !== '—' ? ' · 第 ' + esc(r.page) + ' 页' : ''}</div>`).join('') || '<div class="small muted">暂无</div>'}
        <div class="hint">出处对应百度网盘「我的资源 / G 粉笔国考980」下的讲义文件，可在资料索引中查看完整清单。</div>
      </section>

      <section class="card"><div class="card-pad" style="padding-bottom:8px"><h3 class="card-title" style="margin:0">相关题目</h3></div>
        ${qs.map((q) => `<div class="list-item"><div class="li-head">
          <div class="li-meta"><span class="mono">${q.id.toUpperCase()}</span><span>${diffLabel(q.difficulty)}</span>
          ${S.records[q.id] && S.records[q.id].seen ? `<span class="${S.records[q.id].right ? 'tag good' : 'tag bad'}">${S.records[q.id].right ? '做对过' : '做错过'}</span>` : ''}</div>
          <a class="btn sm ghost" href="#/quiz?review=${q.id}">练</a></div>
          <div class="li-title">${esc(stripHtml(q.stem)).slice(0, 80)}</div></div>`).join('')}
      </section>
    </div>`;
  }

  /* ---------------- 统计 ---------------- */
  function viewStats() {
    const recs = Object.entries(S.records).filter(([, r]) => r.seen);
    const totalSeen = sum(recs, ([, r]) => r.seen);
    const totalRight = sum(recs, ([, r]) => r.right);
    const totalMs = sum(recs, ([, r]) => r.lastMs || 0);
    const days = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const k = todayKey(d);
      days.push({ k, v: (S.daily[k] || {}).answered || 0, label: (d.getMonth() + 1) + '/' + d.getDate() });
    }
    const maxDay = Math.max(1, ...days.map((x) => x.v));

    const modRows = MODULES.map((m) => {
      const qs = BANK.questions.filter((q) => q.module === m.id);
      const rs = qs.map((q) => S.records[q.id]).filter((r) => r && r.seen);
      const n = sum(rs, (r) => r.seen), right = sum(rs, (r) => r.right);
      return `<div class="dist-row"><span class="nm">${esc(m.name)}</span>${bar(pct(right, n), m.color)}<span class="vl mono">${n ? pct(right, n) + '%' : '—'}</span></div>`;
    }).join('');

    const weak = weakPoints(8);
    const reasonAgg = {};
    recs.forEach(([, r]) => Object.keys(r.reasons || {}).forEach((k) => { reasonAgg[k] = (reasonAgg[k] || 0) + r.reasons[k]; }));
    const reasonRows = Object.entries(reasonAgg).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<div class="dist-row"><span class="nm">${esc(k)}</span>${bar(pct(v, sum(Object.values(reasonAgg))), 'var(--warn)')}<span class="vl mono">${v}</span></div>`).join('');

    return `<div class="fade-in">
      <div class="page-head"><div><h1 class="page-title">学习统计</h1><div class="page-sub">只统计这台设备上的记录；换设备请用备份恢复</div></div></div>
      <section class="card card-pad" style="margin-bottom:14px">
        <div class="stat-grid">
          <div class="stat"><b>${totalSeen}</b><span>累计答题</span></div>
          <div class="stat"><b>${pct(totalRight, totalSeen)}%</b><span>总正确率</span></div>
          <div class="stat"><b>${fmtDur(totalMs)}</b><span>累计用时（每题最近一次）</span></div>
        </div>
      </section>

      <section class="card card-pad" style="margin-bottom:14px">
        <div class="spread"><h3 class="card-title" style="margin:0">近 14 天</h3><span class="small muted">每天答题数</span></div>
        <div class="chart">${days.map((d) => `<div class="col" title="${d.k}：${d.v} 题"><i style="height:${Math.max(2, (d.v / maxDay) * 82)}px;opacity:${d.v ? .85 : .18}"></i><span>${d.label}</span></div>`).join('')}</div>
      </section>

      <div class="grid g2" style="margin-bottom:14px">
        <section class="card card-pad"><h3 class="card-title">模块正确率</h3>${modRows}</section>
        <section class="card card-pad"><h3 class="card-title">错因分布</h3>${reasonRows || '<div class="small muted">还没有记录错因。答错后在解析下方选一下，统计才有意义。</div>'}</section>
      </div>

      <section class="card card-pad">
        <h3 class="card-title">知识点掌握度</h3>
        ${weak.length ? weak.map((w) => `<div class="dist-row"><span class="nm">${esc(w.name)}</span>${bar(w.acc, w.acc < 60 ? 'var(--bad)' : w.acc < 80 ? 'var(--warn)' : 'var(--good)')}<span class="vl mono">${w.acc}% / ${w.n}题</span></div>`).join('') : '<div class="small muted">至少练 2 题的知识点才会出现在这里。</div>'}
      </section>
    </div>`;
  }

  /* ---------------- WorkBuddy 云模型 ---------------- */
  let WB_CLOUD = null;
  let WB_SIG = '';

  function loadScript(src) {
    return new Promise((res, rej) => {
      const abs = new URL(src, location.href).href;
      if (Array.from(document.scripts).some((x) => x.src === abs)) return res();
      const t = document.createElement('script');
      t.src = src;
      t.onload = () => res();
      t.onerror = () => rej(new Error('云 SDK 加载失败，请检查 vendor/wb-cloud-sdk.js 是否存在'));
      document.head.appendChild(t);
    });
  }

  async function ensureWB() {
    const ai = S.settings.ai;
    if (!ai.cloudEndpoint) throw new Error('还没填云服务 endpoint（形如 https://xxx.workbuddy.link）');
    if (!/^wbpk_/.test(ai.publishableKey || '')) throw new Error('publishableKey 应以 wbpk_ 开头，请从云服务面板复制完整值');
    const sig = ai.cloudEndpoint + '|' + ai.publishableKey;
    if (WB_CLOUD && WB_SIG === sig) return WB_CLOUD;
    if (!window.WorkBuddyCloud) await loadScript('vendor/wb-cloud-sdk.js');
    if (!window.WorkBuddyCloud || !window.WorkBuddyCloud.createWorkBuddyCloud) throw new Error('云 SDK 未正确加载');
    WB_CLOUD = window.WorkBuddyCloud.createWorkBuddyCloud({ endpoint: ai.cloudEndpoint, publishableKey: ai.publishableKey });
    WB_SIG = sig;
    return WB_CLOUD;
  }

  function wbErrText(e) {
    const code = (e && e.error && e.error.code) || '';
    const map = {
      auth_: '应用校验没通过：通常是当前域名不是这个应用的发布域名，或云服务未开通。',
      quota_: '额度不足或触发限流。积分用完需要去控制台处理，重试没用。',
      request_: '请求参数或模型对不上，检查模型 ID 是否还在目录里。',
      gateway_: '模型服务暂时不可用，过一会儿再试。',
      internal_: '服务内部错误。'
    };
    const k = Object.keys(map).find((x) => code.indexOf(x) === 0);
    return (e && e.message ? e.message + ' ' : '') + (k ? map[k] : '') + (code ? ' [' + code + ']' : '');
  }

  async function fetchWBModels() {
    const cloud = await ensureWB();
    const models = await cloud.llm.models.list();
    S.settings.ai.cloudModels = (models || []).map((m) => ({ id: m.id, name: m.name || m.id, disabled: m.disabled === true || m.enabled === false }));
    if (!S.settings.ai.cloudModel || !S.settings.ai.cloudModels.some((m) => m.id === S.settings.ai.cloudModel && !m.disabled)) {
      const first = S.settings.ai.cloudModels.find((m) => !m.disabled);
      S.settings.ai.cloudModel = first ? first.id : '';
    }
    save();
    return S.settings.ai.cloudModels;
  }

  async function sendWB(text, messages) {
    const ai = S.settings.ai;
    if (!ai.cloudModel) throw new Error('还没选云模型，先点“拉取模型列表”再选一个');
    const log = $('#chatlog');
    if (log) {
      log.insertAdjacentHTML('beforeend', '<div class="msg ai"><div class="av">师</div><div class="bd" id="liveMsg">思考中…</div></div>');
      log.scrollTop = log.scrollHeight;
    }
    const cloud = await ensureWB();
    let content = '';
    let usage = null;
    let streamErr = null;
    const stream = cloud.llm.chat.completions.create({
      model: ai.cloudModel,
      messages,
      stream: true,
      stream_options: { include_usage: true },
      temperature: Number(ai.temperature) || 0.4,
      max_tokens: Number(ai.maxTokens) || 900
    });
    try {
      for await (const chunk of stream) {
        const delta = chunk.choices && chunk.choices[0] && chunk.choices[0].delta;
        if (delta && delta.content) {
          content += delta.content;
          const el = $('#liveMsg');
          if (el) { el.textContent = content; if (log) log.scrollTop = log.scrollHeight; }
        }
        if (chunk.usage) usage = chunk.usage;
      }
    } catch (e) {
      streamErr = wbErrText(e);
    }
    if (streamErr) content = (content ? content + '\n\n' : '') + '（生成中断）' + streamErr;
    if (!content) content = '（模型没有返回正文，可能被内容策略拦截了）';
    const u = usage || {};
    S.aiUsage.calls += 1;
    S.aiUsage.tin += u.prompt_tokens || 0;
    S.aiUsage.tout += u.completion_tokens || 0;
    S.aiUsage.credits = (S.aiUsage.credits || 0) + (Number(u.credit) || 0);
    S.aiChat.push({ role: 'assistant', content, at: now() });
    save();
  }

  /* ---------------- AI 教师 ---------------- */
  async function callAI(messages) {
    const ai = S.settings.ai;
    if (!ai.model) throw new Error('还没填模型名称');
    const payload = { model: ai.model, messages, temperature: Number(ai.temperature) || 0.4, max_tokens: Number(ai.maxTokens) || 900 };
    const key = (ai.key || '').trim();
    const base = (ai.base || '').replace(/\/+$/, '');

    if (ai.proxy !== 'direct' && location.protocol.startsWith('http')) {
      try {
        const r = await fetch('api/ai/chat', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(Object.assign({ endpoint: base, key }, payload))
        });
        if (r.status === 404) throw new Error('__no_proxy__');
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(data.error || ('代理返回 ' + r.status));
        return data;
      } catch (e) {
        if (e.message !== '__no_proxy__' && !/Failed to fetch|NetworkError/i.test(e.message)) throw e;
        if (ai.proxy === 'proxy') throw new Error('本地代理不可用：请用 node server.js 启动，或把“请求方式”改为直连');
      }
    }
    if (!key) throw new Error('还没配置 API 密钥。请到「设置 → AI 模型」里填写，密钥只保存在本机浏览器。');
    let r;
    try {
      r = await fetch(base + '/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
        body: JSON.stringify(payload)
      });
    } catch (e) {
      throw new Error('直连失败（多为浏览器 CORS 限制）。请在电脑上用 node server.js 启动后访问 http://localhost:8787，或把请求方式设为“代理”。');
    }
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error((data.error && (data.error.message || data.error)) || ('接口返回 ' + r.status));
    return data;
  }

  function aiPrompt(q) {
    let sys = '你是“上岸练习室”的 AI 教师，服务对象是备考国考/省考的成年学习者。要求：\n' +
      '1. 用简体中文，先给结论再给理由，条理清晰，可以用少量 Markdown 强调。\n' +
      '2. 涉及计算必须写出算式与量级判断，不要只给答案。\n' +
      '3. 不确定、题目信息不足、或存在争议时，必须明确说“不确定/这题可能有争议”，不得编造答案、出处或数据。\n' +
      '4. 不夸大押题命中率，不承诺考试结果。\n' +
      '5. 若用户问的不是行测学习内容，简短说明你只负责本App的学习答疑。\n';
    if (q) {
      sys += '\n【当前题目】\n题干：' + stripHtml(q.stem) + '\n选项：' + q.options.map((o, i) => 'ABCD'[i] + '. ' + o).join('；') +
        '\n标准答案：' + 'ABCD'[q.answer] + '\n现有解析：' + q.explain + '\n考点：' + moduleName(q.module) + ' / ' + pointName(q.point) +
        '\n本题审核状态：' + ((q.review && q.review.status) || '未知') + '。若你认为答案或解析有问题，请直接指出并说明理由。';
    }
    return sys;
  }

  function aiCostEstimate(messages) {
    const ai = S.settings.ai;
    const chars = messages.map((m) => m.content).join('').length;
    const tin = Math.ceil(chars / 1.6) + 60;
    const tout = Number(ai.maxTokens) || 900;
    const cost = (tin / 1e6) * (Number(ai.priceIn) || 0) + (tout / 1e6) * (Number(ai.priceOut) || 0);
    return { tin, tout, cost };
  }

  function viewAI(params) {
    ensureToday();
    const ai = S.settings.ai;
    const ctxId = params.get('q');
    const ctxQ = ctxId ? QMAP[ctxId] : null;
    const u = S.aiUsage;
    const msgs = S.aiChat || [];
    const est = aiCostEstimate([{ role: 'system', content: aiPrompt(ctxQ) }]);
    const isWB = ai.provider === 'wb';
    const hasKey = isWB
      ? !!(ai.cloudEndpoint && ai.publishableKey && ai.cloudModel)
      : !!(ai.key || '').trim();
    return `<div class="fade-in">
      <div class="page-head"><div><div class="kicker">可以追问，但别全信</div><h1 class="page-title">AI 教师</h1>
      <div class="page-sub">${ctxQ ? '正在讲：' + esc(pointName(ctxQ.point)) + ' · ' + ctxQ.id.toUpperCase() : '选择一个题目进入，或直接提问'} ${ctxQ ? `<a class="link small" href="#/quiz?review=${ctxQ.id}">回到题目</a>` : ''}</div></div>
      <div class="row"><button class="btn sm ghost" data-action="ai-clear">清空对话</button><a class="btn sm ghost" href="#/settings">模型设置</a></div></div>

      ${!hasKey ? `<div class="card card-pad" style="margin-bottom:14px;border-color:var(--warn)">
        ${isWB
          ? '<b>云模型还没配好。</b><span class="small muted">去「设置 → AI 模型」填 endpoint 与 publishableKey，拉取模型列表后选一个。注意：云模型只在应用的发布域名下可用，localhost 会被 Origin 校验拒绝。</span>'
          : '<b>还没配密钥。</b><span class="small muted">去「设置 → AI 模型」填写服务地址、模型名和密钥。密钥只存在本机浏览器，不会上传到本 App 的服务器；也不要把密钥发到聊天里。</span>'}
      </div>` : ''}

      <section class="card card-pad">
        <div class="chat-log" id="chatlog">
          ${msgs.length ? msgs.map((m) => `<div class="msg ${m.role === 'assistant' ? 'ai' : 'user'}">
            <div class="av">${m.role === 'assistant' ? '师' : '我'}</div><div class="bd">${esc(m.content)}</div></div>`).join('')
            : `<div class="msg ai"><div class="av">师</div><div class="bd">我是这间练习室的 AI 教师。可以让我：\n· 把某个知识点讲成人话\n· 逐项分析这道题的错误选项\n· 换个生活化的例子\n· 出两道同类题练手\n\n我不确定的时候会说“不确定”，也不会替你编一个答案。</div></div>`}
        </div>
        <div class="sugg">
          ${(ctxQ ? ['这题考什么', '逐项分析选项', '为什么我选错了', '出两道同类题'] : ['资料分析怎么提速', '逻辑填空总在两个选项间犹豫', '帮我排一个 30 天计划'])
            .map((t) => `<button class="chip" data-action="ai-sugg" data-val="${esc(t)}">${esc(t)}</button>`).join('')}
        </div>
        <div class="ai-bar">
          <textarea class="input" id="aiInput" rows="2" placeholder="问点什么…（Enter 发送，Shift+Enter 换行）"></textarea>
          <button class="btn primary" data-action="ai-send" id="aiSend">发送</button>
        </div>
        <div class="cost-note">
          <span>今日 ${u.calls}/${ai.dailyCalls} 次</span>
          ${ai.provider === 'wb'
            ? `<span>本机累计消耗 ${(u.credits || 0).toFixed(2)} 积分</span><span>额度以控制台为准，SDK 不返回余额</span>`
            : `<span>本次预估 ${est.tin}+${est.tout} tokens ≈ ¥${est.cost.toFixed(4)}</span><span>价格按「元/百万 tokens」设置，仅作估算</span>`}
        </div>
      </section>
    </div>`;
  }

  async function sendAI(text) {
    if (AI_BUSY) return toast('上一条还在生成');
    text = (text || '').trim();
    if (!text) return;
    const ai = S.settings.ai;
    ensureToday();
    if (S.aiUsage.calls >= ai.dailyCalls) {
      return toast(`今日 AI 次数已用完（${ai.dailyCalls} 次），可在设置里调整限额`);
    }
    const qid = (location.hash.split('q=')[1] || '').split('&')[0];
    const ctxQ = qid && QMAP[qid] ? QMAP[qid] : null;
    const history = (S.aiChat || []).slice(-10).map((m) => ({ role: m.role, content: m.content }));
    const messages = [{ role: 'system', content: aiPrompt(ctxQ) }].concat(history, [{ role: 'user', content: text }]);
    if (ai.provider === 'wb') {
      S.aiChat = (S.aiChat || []).concat([{ role: 'user', content: text, at: now() }]);
      save();
      render();
      AI_BUSY = true;
      try {
        await sendWB(text, messages);
      } catch (e) {
        S.aiChat.push({ role: 'assistant', content: '（调用失败）' + wbErrText(e), at: now() });
        save();
      } finally {
        AI_BUSY = false;
        render();
        const lg = $('#chatlog'); if (lg) lg.scrollTop = lg.scrollHeight;
      }
      return;
    }
    S.aiChat = (S.aiChat || []).concat([{ role: 'user', content: text, at: now() }]);
    save();
    AI_BUSY = true;
    render();
    const log = $('#chatlog');
    if (log) { log.insertAdjacentHTML('beforeend', `<div class="msg ai" id="typing"><div class="av">师</div><div class="bd muted">思考中…</div></div>`); log.scrollTop = log.scrollHeight; }
    try {
      const data = await callAI(messages);
      const choice = (data.choices && data.choices[0]) || {};
      const content = (choice.message && choice.message.content) || '';
      if (!content) throw new Error('接口没有返回内容');
      S.aiChat.push({ role: 'assistant', content, at: now() });
      const u = data.usage || {};
      S.aiUsage.calls += 1;
      S.aiUsage.tin += u.prompt_tokens || 0;
      S.aiUsage.tout += u.completion_tokens || 0;
      const cost = ((u.prompt_tokens || 0) / 1e6) * (Number(ai.priceIn) || 0) + ((u.completion_tokens || 0) / 1e6) * (Number(ai.priceOut) || 0);
      S.aiUsage.cost = Math.round((S.aiUsage.cost + cost) * 1e6) / 1e6;
      save();
    } catch (e) {
      const hint = /CORS|NetworkError|Failed to fetch|直连失败/.test(e.message)
        ? '\n\n如果是网络或跨域问题：在电脑上运行 node server.js，用 http://localhost:8787 打开；手机上请使用已部署的地址。'
        : '';
      S.aiChat.push({ role: 'assistant', content: '（调用失败）' + e.message + hint, at: now() });
      save();
    } finally {
      AI_BUSY = false;
      render();
      const lg = $('#chatlog'); if (lg) lg.scrollTop = lg.scrollHeight;
    }
  }

  /* ---------------- 设置 ---------------- */
  function aiSettingsHtml() {
    const ai = S.settings.ai;
    const u = S.aiUsage;
    ensureToday();
    const isWB = ai.provider === 'wb';
    const models = ai.cloudModels || [];
    return `<div class="spread"><h3 class="card-title" style="margin:0">AI 模型</h3>
      <span class="tiny muted">今日 ${u.calls} 次 · ${u.tin + u.tout} tokens${isWB ? ' · 本机累计 ' + (u.credits || 0).toFixed(2) + ' 积分' : ' · ¥' + (u.cost || 0).toFixed(4)}</span></div>
      <p class="hint">两条路：自带密钥（任何 OpenAI 兼容接口，按量付费），或 WorkBuddy 云模型（用你账号的积分/额度，免密钥）。</p>
      <div class="seg" style="margin-bottom:14px">
        <button class="${!isWB ? 'on' : ''}" data-action="ai-provider" data-val="custom">自带 API 密钥</button>
        <button class="${isWB ? 'on' : ''}" data-action="ai-provider" data-val="wb">WorkBuddy 云模型（积分）</button>
      </div>`
      + (isWB ? `
      <div class="grid g2">
        <div class="field"><label>云服务 endpoint</label>
          <input class="input" value="${esc(ai.cloudEndpoint)}" data-set="ai.cloudEndpoint" placeholder="https://xxxx.workbuddy.link">
          <div class="hint">云服务面板里 publicConfig.endpoint，必须和发布域名一致。</div></div>
        <div class="field"><label>publishableKey</label>
          <input class="input" value="${esc(ai.publishableKey)}" data-set="ai.publishableKey" placeholder="wbpk_…" autocomplete="off">
          <div class="hint">应用级公开标识，不是密钥；服务端会校验 Origin。</div></div>
      </div>
      <div class="row" style="margin-bottom:12px">
        <button class="btn sm" data-action="wb-models">拉取模型列表</button>
        <span class="small muted">${models.length ? '已加载 ' + models.length + ' 个模型' : '还没拉取'}</span>
      </div>
      <div class="field"><label>云模型</label>
        <select class="input" data-set="ai.cloudModel">
          ${models.length ? models.map((m) => `<option value="${esc(m.id)}" ${ai.cloudModel === m.id ? 'selected' : ''} ${m.disabled ? 'disabled' : ''}>${esc(m.name)}${m.disabled ? '（不可用）' : ''}</option>`).join('') : '<option value="">先拉取模型列表</option>'}
        </select>
        <div class="hint">只支持流式调用；额度与余额没有接口，SDK 只回传单次 credit，余额请看控制台。</div>
      </div>
      <div class="row"><button class="btn sm" data-action="ai-test">测试云环境</button><span class="small muted" id="aiTestMsg"></span></div>
      ` : `
      <div class="grid g2">
        <div class="field"><label>接口地址（Base URL）</label><input class="input" value="${esc(ai.base)}" data-set="ai.base" placeholder="https://api.deepseek.com/v1"></div>
        <div class="field"><label>模型名称</label><input class="input" value="${esc(ai.model)}" data-set="ai.model" placeholder="deepseek-chat"></div>
      </div>
      <div class="field"><label>API 密钥</label>
        <input class="input" type="password" value="${ai.remember ? esc(ai.key) : ''}" data-set="ai.key" placeholder="sk-…（只存本机）" autocomplete="off">
        <div class="hint">不要发到聊天窗口，也不要写进代码。公共电脑上建议关闭“记住密钥”。</div>
      </div>
      <label class="row small" style="gap:8px;margin-bottom:12px"><input type="checkbox" ${ai.remember ? 'checked' : ''} data-set="ai.remember"> 记住密钥（关闭后刷新页面即清除）</label>
      <div class="grid g3">
        <div class="field"><label>输入价（元/百万 tokens）</label><input class="input" type="number" step="0.01" value="${ai.priceIn}" data-set="ai.priceIn"></div>
        <div class="field"><label>输出价（元/百万 tokens）</label><input class="input" type="number" step="0.01" value="${ai.priceOut}" data-set="ai.priceOut"></div>
        <div class="field"><label>请求方式</label>
          <select class="input" data-set="ai.proxy">
            <option value="auto" ${ai.proxy === 'auto' ? 'selected' : ''}>自动（优先本地代理）</option>
            <option value="proxy" ${ai.proxy === 'proxy' ? 'selected' : ''}>只走代理（server.js）</option>
            <option value="direct" ${ai.proxy === 'direct' ? 'selected' : ''}>浏览器直连</option>
          </select></div>
      </div>
      <div class="row"><button class="btn sm" data-action="ai-test">测试连接</button><span class="small muted" id="aiTestMsg"></span></div>
      `) + `
      <div class="grid g3" style="margin-top:12px">
        <div class="field"><label>温度</label><input class="input" type="number" step="0.1" min="0" max="1.5" value="${ai.temperature}" data-set="ai.temperature"></div>
        <div class="field"><label>最大输出 tokens</label><input class="input" type="number" min="200" max="4000" value="${ai.maxTokens}" data-set="ai.maxTokens"></div>
        <div class="field"><label>每日调用上限</label><input class="input" type="number" min="0" value="${ai.dailyCalls}" data-set="ai.dailyCalls"></div>
      </div>`;
  }

  function viewSettings() {
    const ai = S.settings.ai;
    const u = S.aiUsage;
    const imported = S.imported.length;
    return `<div class="fade-in">
      <div class="page-head"><div><h1 class="page-title">设置</h1><div class="page-sub">记录存在本机浏览器；定期导出备份</div></div></div>

      <section class="card card-pad" style="margin-bottom:14px">
        <h3 class="card-title">学习</h3>
        <div class="grid g2">
          <div class="field"><label>每日目标题量</label><input class="input" type="number" min="5" max="200" value="${S.settings.goal}" data-set="goal"></div>
          <div class="field"><label>主题</label>
            <div class="seg">${[['auto', '跟随系统'], ['light', '浅色'], ['dark', '深色']].map(([k, n]) => `<button class="${S.settings.theme === k ? 'on' : ''}" data-action="theme-set" data-val="${k}">${n}</button>`).join('')}</div>
          </div>
        </div>
        <label class="row small" style="gap:8px;margin-top:4px"><input type="checkbox" ${S.settings.instant ? 'checked' : ''} data-set="instant"> 答完立即显示解析（关闭后需手动点“查看答案”）</label>
      </section>

      <section class="card card-pad" style="margin-bottom:14px">
        ${aiSettingsHtml()}
      </section>

      <section class="card card-pad" style="margin-bottom:14px">
        <h3 class="card-title">数据</h3>
        <div class="row">
          <button class="btn" data-action="export-backup">导出学习备份</button>
          <button class="btn" data-action="import-backup">导入备份</button>
          <button class="btn" data-action="import-bank">导入题库</button>
          <button class="btn ghost" data-action="export-bank-tpl">下载题库模板</button>
        </div>
        <div class="hint">备份含学习记录、设置、收藏与错题（不含密钥）。已导入的题目 ${imported} 道；待审核 ${S.pending.length} 条。</div>
        <div class="row" style="margin-top:12px">
          <button class="btn sm ghost" data-action="clear-records">清空学习记录</button>
          <button class="btn sm ghost" data-action="reset-all">恢复出厂设置</button>
        </div>
      </section>

      <section class="card card-pad">
        <h3 class="card-title">题库</h3>
        <div class="small muted" style="line-height:1.9">
          版本 v${esc(BANK.version)}（${esc(BANK.updated)}）· ${BANK.questions.length} 题 · ${BANK.points.length} 个知识点<br>
          审核状态：${['verified', 'reviewed', 'pending', 'disputed'].map((s) => `${s} ${BANK.questions.filter((q) => q.review && q.review.status === s).length}`).join(' · ')}<br>
          ${esc(BANK.notice)}
        </div>
      </section>
    </div>`;
  }

  /* ---------------- 关于 ---------------- */
  function viewAbout() {
    return `<div class="fade-in">
      ${breadcrumb('首页', '#/home')}
      <div class="page-head"><div><h1 class="page-title">关于与授权</h1><div class="page-sub">第一阶段：个人学习使用</div></div></div>
      <section class="card card-pad" style="margin-bottom:14px;line-height:1.9">
        <h3 class="card-title">内容来源</h3>
        <p>本 App 的课程结构、考点归类与解题方法，参考百度网盘「我的资源 / G 粉笔国考980」中的视频摘要与讲义（2026 国考版）。题目为原创模拟题，未复制讲义中的真题与解析原文。</p>
        <p>课程、讲义、真题的著作权归原机构与作者所有。当前仅用于个人学习，<b>不得用于商业用途</b>；如后续商业化，需重新核查课程、题目、解析等素材的授权，不能因为网上公开就默认可以商用。</p>
        <h3 class="card-title" style="margin-top:18px">记录与隐私</h3>
        <p>学习记录保存在浏览器 localStorage，不上传服务器。AI 请求会发送到你配置的模型服务商；密钥只存在本机，不写入源码、不随备份导出。</p>
        <h3 class="card-title" style="margin-top:18px">版本</h3>
        <p>v1.0 · 行测 104 题 · 2026-11-02</p>
      </section>
    </div>`;
  }

  /* ---------------- 弹层 / 提示 ---------------- */
  let toastTimer = null;
  function toast(msg) {
    const el = $('#toast');
    el.textContent = msg;
    el.classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('on'), 2200);
  }
  function openModal(title, body, foot) {
    $('#modal').innerHTML = `<div class="modal-head"><h3>${esc(title)}</h3><button class="btn sm ghost" data-action="close-modal">✕</button></div>
      <div class="modal-body">${body}</div><div class="modal-foot">${foot || '<button class="btn" data-action="close-modal">关闭</button>'}</div>`;
    $('#mask').classList.add('on');
  }
  function closeModal() { $('#mask').classList.remove('on'); }

  function sheetHtml() {
    if (!CURRENT) return '';
    const cells = CURRENT.qids.map((id, i) => {
      const done = typeof CURRENT.answers[id] === 'number';
      const cls = ['sheet-cell', done ? 'done' : '', CURRENT.flags[id] ? 'flag' : '', i === CURRENT.i ? 'cur' : ''].join(' ');
      return `<button class="${cls}" data-action="jump" data-val="${i}">${i + 1}</button>`;
    }).join('');
    return `<div class="small muted" style="margin-bottom:10px">已答 ${Object.keys(CURRENT.answers).length} / ${CURRENT.qids.length}${CURRENT.mode === 'mock' ? ' · 交卷后统一判分' : ''}</div>
      <div class="sheet-grid">${cells}</div>`;
  }

  /* ---------------- 备份 / 导入 ---------------- */
  function download(name, text, type) {
    const blob = new Blob([text], { type: type || 'application/json;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  function exportBackup() {
    const copy = JSON.parse(JSON.stringify(S));
    copy.settings.ai.key = '';
    const data = { type: 'sas-backup', version: 1, exportedAt: new Date().toISOString(), bankVersion: BANK.version, state: copy };
    download('上岸练习室-备份-' + todayKey() + '.json', JSON.stringify(data, null, 2));
    toast('备份已导出（不含密钥）');
  }

  function importBackup() {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = '.json,application/json';
    inp.onchange = () => {
      const f = inp.files[0]; if (!f) return;
      const fr = new FileReader();
      fr.onload = () => {
        try {
          const d = JSON.parse(fr.result);
          const st = d.state || d;
          if (!st.records || !st.settings) throw new Error('不是有效的备份文件');
          if (!confirm('导入会覆盖当前学习记录，确定继续？')) return;
          const key = S.settings.ai.key;
          S = Object.assign(defaults(), st);
          S.settings = Object.assign(defaults().settings, st.settings || {});
          S.settings.ai = Object.assign(defaults().settings.ai, (st.settings || {}).ai || {});
          S.settings.ai.key = key;
          S.imported = st.imported || S.imported;
          save(); applyTheme(); go('#/home'); toast('备份已恢复');
        } catch (e) { toast('导入失败：' + e.message); }
      };
      fr.readAsText(f);
    };
    inp.click();
  }

  function importBank() {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = '.json,application/json';
    inp.onchange = () => {
      const f = inp.files[0]; if (!f) return;
      const fr = new FileReader();
      fr.onload = () => {
        try {
          const d = JSON.parse(fr.result);
          const list = Array.isArray(d) ? d : (d.questions || []);
          if (!Array.isArray(list) || !list.length) throw new Error('没有找到 questions 数组');
          const newPoints = (d.points || []).filter((p) => p && p.id && !POINT[p.id]);
          const newMats = (d.materials || []).filter((m) => m && m.id && !MATERIAL[m.id]);
          const bad = [];
          const ok = [];
          list.forEach((q, i) => {
            if (!q.id || !Array.isArray(q.options) || q.options.length < 2 || typeof q.answer !== 'number' || q.answer < 0 || q.answer >= q.options.length || !q.stem) {
              bad.push(i + 1); return;
            }
            if (QMAP[q.id]) { bad.push(i + 1 + '(重复ID)'); return; }
            ok.push(q);
          });
          if (!ok.length) throw new Error('没有通过校验的题目（需要 id / stem / options / answer）');
          S.imported = (S.imported || []).concat(ok);
          if (newPoints.length) {
            S.importedMeta = S.importedMeta || { points: [], materials: [] };
            S.importedMeta.points = (S.importedMeta.points || []).concat(newPoints);
            newPoints.forEach((p) => { BANK.points.push(p); POINT[p.id] = p; });
          }
          if (newMats.length) {
            S.importedMeta = S.importedMeta || { points: [], materials: [] };
            S.importedMeta.materials = (S.importedMeta.materials || []).concat(newMats);
            newMats.forEach((m) => { BANK.materials.push(m); MATERIAL[m.id] = m; });
          }
          save();
          // 合并到内存题库
          ok.forEach((q) => {
            const qq = Object.assign({ module: 'ziliao', point: 'zl-zonghe', difficulty: 2, explain: '', optionNotes: [], method: '', traps: [], materialId: null, calc: null, tags: [] }, q);
            qq.review = qq.review || { status: 'pending', note: '用户导入，未审核' };
            qq.source = qq.source || '用户导入';
            BANK.questions.push(qq); QMAP[qq.id] = qq;
          });
          toast(`导入 ${ok.length} 题${newPoints.length ? '、' + newPoints.length + ' 个知识点' : ''}${newMats.length ? '、' + newMats.length + ' 份材料' : ''}${bad.length ? '，跳过 ' + bad.length + ' 题' : ''}`);
          render();
        } catch (e) { toast('导入失败：' + e.message); }
      };
      fr.readAsText(f);
    };
    inp.click();
  }

  function exportBankTemplate() {
    const tpl = {
      version: '1.0', notice: '把 questions 数组填好后，在设置里导入。answer 是选项下标（0=A）。',
      questions: [{
        id: 'my-001', module: 'ziliao', point: 'zl-bz', difficulty: 2,
        stem: '题干文字，可含 <b>HTML</b>', options: ['选项A', '选项B', '选项C', '选项D'], answer: 1,
        explain: '解析文字', optionNotes: ['A错在哪', 'B对在哪', 'C错在哪', 'D错在哪'],
        method: '方法一句话', traps: ['易错点'], materialId: null,
        review: { status: 'pending', note: '自建题，待审核' }, source: '自编'
      }]
    };
    download('题库导入模板.json', JSON.stringify(tpl, null, 2));
  }

  /* ---------------- 事件 ---------------- */
  function go(hash) { if (location.hash === hash) render(); else location.hash = hash; }

  function render() {
    const raw = location.hash || '#/home';
    ROUTE = raw;
    const [path, qs] = raw.split('?');
    const params = new URLSearchParams(qs || '');
    let html = '';
    document.body.classList.remove('fade-in');

    if (path === '#/home' || path === '' || path === '#/') html = viewHome();
    else if (path === '#/practice') html = viewPractice(params);
    else if (path === '#/quiz') html = viewQuiz(params);
    else if (path === '#/result') html = viewResult(params);
    else if (path === '#/exam') html = viewExam();
    else if (path === '#/wrong') html = viewWrong();
    else if (path === '#/fav') html = viewFav();
    else if (path === '#/graph') html = viewGraph();
    else if (path.startsWith('#/point/')) html = viewPoint(path.replace('#/point/', ''));
    else if (path === '#/stats') html = viewStats();
    else if (path === '#/ai') html = viewAI(params);
    else if (path === '#/settings') html = viewSettings();
    else if (path === '#/about') html = viewAbout();
    else html = viewHome();

    $('#view').innerHTML = html;
    renderNav();
    startTimer();
    window.scrollTo({ top: 0, behavior: 'instant' in window ? 'auto' : 'auto' });
  }

  function startTimer() {
    clearInterval(TIMER);
    if (!location.hash.startsWith('#/quiz') || !CURRENT) return;
    const el = $('#timer');
    if (!el) return;
    const isMock = CURRENT.mode === 'mock';
    TIMER = setInterval(() => {
      const t = $('#timer');
      if (!t) return clearInterval(TIMER);
      if (isMock) {
        const left = (CURRENT.limitSec || 2100) * 1000 - (now() - CURRENT.startTs);
        t.textContent = fmtTime(Math.max(0, left));
        t.classList.toggle('danger', left < 300000);
        if (left <= 0) { clearInterval(TIMER); toast('时间到，自动交卷'); submitExam(true); }
      } else {
        t.textContent = fmtTime(now() - (QSTART || now()));
      }
    }, 1000);
  }

  document.addEventListener('click', (e) => {
    if (e.target && e.target.id === 'mask') { closeModal(); return; }
    const a = e.target.closest('[data-action]');
    const goEl = e.target.closest('[data-go]');
    if (goEl) { e.preventDefault(); go(goEl.getAttribute('data-go')); return; }
    if (!a) return;
    const act = a.getAttribute('data-action');
    const val = a.getAttribute('data-val');

    switch (act) {
      case 'theme': {
        S.settings.theme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        save(); applyTheme(); render(); break;
      }
      case 'theme-set': S.settings.theme = val; save(); applyTheme(); render(); break;
      case 'close-modal': closeModal(); break;
      case 'toggle-material': {
        if (!CURRENT) break;
        CURRENT.matCollapsed = !CURRENT.matCollapsed; saveCurrent(); render(); break;
      }
      case 'setup-mode': SETUP.mode = val; render(); break;
      case 'setup-module': {
        const i = SETUP.modules.indexOf(val);
        if (i >= 0) SETUP.modules.splice(i, 1); else SETUP.modules.push(val);
        SETUP.points = SETUP.points.filter((p) => SETUP.modules.includes(POINT[p].module));
        if (!SETUP.modules.length) SETUP.modules = MODULES.map((m) => m.id);
        render(); break;
      }
      case 'setup-all': SETUP.modules = SETUP.modules.length === MODULES.length ? [] : MODULES.map((m) => m.id); if (!SETUP.modules.length) SETUP.modules = MODULES.map((m) => m.id); SETUP.points = []; render(); break;
      case 'setup-point': {
        const i = SETUP.points.indexOf(val);
        if (i >= 0) SETUP.points.splice(i, 1); else SETUP.points.push(val);
        render(); break;
      }
      case 'setup-clear-points': SETUP.points = []; render(); break;
      case 'setup-diff': {
        const d = Number(val); const i = SETUP.diff.indexOf(d);
        if (i >= 0) SETUP.diff.splice(i, 1); else SETUP.diff.push(d);
        render(); break;
      }
      case 'setup-count': SETUP.count = Number(val); render(); break;
      case 'start-practice': startPractice(SETUP.mode); break;
      case 'choose': choose(Number(val)); break;
      case 'next': nextQ(); break;
      case 'prev': if (CURRENT && CURRENT.i > 0) { CURRENT.i--; QSTART = now(); saveCurrent(); render(); } break;
      case 'finish': finishPractice(); break;
      case 'review-back': {
        CURRENT = null; saveCurrent();
        go(document.referrer && document.referrer.indexOf(location.origin) === 0 ? '#/home' : '#/graph');
        break;
      }
      case 'quit-quiz': {
        if (!CURRENT) break;
        openModal('退出练习', '<p>进度已自动保存，下次可继续。</p>', '<button class="btn ghost" data-action="close-modal">继续做题</button><button class="btn primary" data-action="quit-confirm">退出</button>');
        break;
      }
      case 'quit-confirm': closeModal(); CURRENT = null; saveCurrent(); go('#/home'); break;
      case 'sheet': openModal('答题卡', sheetHtml(), '<button class="btn" data-action="close-modal">继续答题</button>'); break;
      case 'jump': {
        if (!CURRENT) break;
        CURRENT.i = Number(val); QSTART = now(); saveCurrent(); closeModal(); render(); break;
      }
      case 'flag': {
        if (!CURRENT) break;
        const q = QMAP[CURRENT.qids[CURRENT.i]];
        CURRENT.flags[q.id] = !CURRENT.flags[q.id]; saveCurrent(); render(); break;
      }
      case 'show-answer': S.settings.instant = true; save(); render(); break;
      case 'fav': {
        let id = val;
        if (!id && CURRENT) id = CURRENT.qids[CURRENT.i];
        if (!id) break;
        const r = rec(id); r.fav = !r.fav; if (r.fav) r.favAt = now();
        save(); render(); toast(r.fav ? '已收藏' : '已取消收藏'); break;
      }
      case 'reason': {
        if (!CURRENT) break;
        const q = QMAP[CURRENT.qids[CURRENT.i]];
        const r = rec(q.id);
        r.reasons[val] = r.reasons[val] ? 0 : 1;
        save(); render(); break;
      }
      case 'master': {
        const r = rec(val); r.mastered = true; save(); render(); toast('已移出错题本'); break;
      }
      case 'retry-wrong': {
        const ids = (S.lastResult ? S.lastResult.items : []).filter((x) => !x.right).map((x) => x.qid);
        if (!ids.length) return;
        CURRENT = { id: uid(), mode: 'wrong', qids: ids, i: 0, answers: {}, flags: {}, startTs: now(), lastTs: now(), limitSec: 0, done: 0, total: ids.length };
        QSTART = now(); saveCurrent(); go('#/quiz'); break;
      }
      case 'retry-all-wrong': {
        const ids = Object.entries(S.records).filter(([, r]) => r.wrong > 0 && !r.mastered).map(([id]) => id);
        if (!ids.length) return;
        CURRENT = { id: uid(), mode: 'wrong', qids: ids, i: 0, answers: {}, flags: {}, startTs: now(), lastTs: now(), limitSec: 0, done: 0, total: ids.length };
        QSTART = now(); saveCurrent(); go('#/quiz'); break;
      }
      case 'practice-fav': startPractice('fav'); break;
      case 'practice-point': {
        const p = POINT[val];
        SETUP.modules = [p.module]; SETUP.points = [p.id]; SETUP.diff = []; SETUP.count = 20; SETUP.mode = 'special';
        go('#/practice'); setTimeout(() => startPractice('special'), 30); break;
      }
      case 'exam-count': S.examCfg = Object.assign({ count: 30, min: 35, off: [] }, S.examCfg, { count: Number(val) }); save(); render(); break;
      case 'exam-min': S.examCfg = Object.assign({ count: 30, min: 35, off: [] }, S.examCfg, { min: Number(val) }); save(); render(); break;
      case 'exam-mod': {
        S.examCfg = Object.assign({ count: 30, min: 35, off: [] }, S.examCfg);
        const i = S.examCfg.off.indexOf(val);
        if (i >= 0) S.examCfg.off.splice(i, 1); else S.examCfg.off.push(val);
        save(); render(); break;
      }
      case 'start-exam': startExam(); break;
      case 'submit-exam': submitExam(false); break;
      case 'submit-exam-force': closeModal(); submitExam(true); break;
      case 'open-ai': {
        const q = QMAP[CURRENT.qids[CURRENT.i]];
        go('#/ai?q=' + q.id); break;
      }
      case 'ask-explain': {
        const q = QMAP[CURRENT.qids[CURRENT.i]];
        go('#/ai?q=' + q.id);
        setTimeout(() => sendAI('请把这道题讲透：考点是什么、每个选项为什么对/错、我下次遇到同类题该按什么步骤做。'), 60);
        break;
      }
      case 'ask-similar': {
        const q = QMAP[CURRENT.qids[CURRENT.i]];
        go('#/ai?q=' + q.id);
        setTimeout(() => sendAI('请出 2 道同考点、同难度的原创练习题（不要用真题），先只给题目和选项，我做完再看答案。'), 60);
        break;
      }
      case 'ai-provider': S.settings.ai.provider = val; save(); render(); break;
      case 'wb-models': {
        (async () => {
          try {
            const ms = await fetchWBModels();
            render();
            toast(ms.length ? `已加载 ${ms.length} 个模型` : '目录为空，可能云服务未开通');
          } catch (e) { toast('拉取失败：' + wbErrText(e).slice(0, 70)); }
        })();
        break;
      }
      case 'ai-sugg': sendAI(val); break;
      case 'ai-send': {
        const inp = $('#aiInput'); sendAI(inp ? inp.value : ''); break;
      }
      case 'ai-clear': S.aiChat = []; save(); render(); break;
      case 'ai-test': testAI(a); break;
      case 'export-backup': exportBackup(); break;
      case 'import-backup': importBackup(); break;
      case 'import-bank': importBank(); break;
      case 'export-bank-tpl': exportBankTemplate(); break;
      case 'clear-records': {
        openModal('清空学习记录', '<p>将删除答题记录、错题、收藏与统计，题库不受影响。建议先导出备份。</p>',
          '<button class="btn ghost" data-action="close-modal">取消</button><button class="btn primary" data-action="clear-records-2">确认清空</button>');
        break;
      }
      case 'clear-records-2': {
        S.records = {}; S.sessions = []; S.daily = {}; S.lastPractice = null; S.lastResult = null;
        save(); closeModal(); render(); toast('记录已清空'); break;
      }
      case 'reset-all': {
        openModal('恢复出厂设置', '<p>将清空全部本地数据（含导入题库与 AI 设置）。确定？</p>',
          '<button class="btn ghost" data-action="close-modal">取消</button><button class="btn primary" data-action="reset-all-2">确定重置</button>');
        break;
      }
      case 'reset-all-2': {
        localStorage.removeItem(SKEY); localStorage.removeItem(CKEY);
        S = defaults(); save(); applyTheme(); closeModal(); go('#/home'); toast('已重置'); break;
      }
    }
  });

  document.addEventListener('change', (e) => {
    const el = e.target.closest('[data-set]');
    if (!el) return;
    const path = el.getAttribute('data-set');
    let v = el.type === 'checkbox' ? el.checked : el.value;
    if (el.type === 'number') v = Number(v);
    if (path === 'goal') S.settings.goal = clamp(Number(v) || 20, 5, 200);
    else if (path === 'instant') S.settings.instant = !!v;
    else if (path.startsWith('ai.')) {
      const k = path.slice(3);
      if (k === 'remember' && !v) { S.settings.ai.remember = false; S.settings.ai.key = ''; }
      else S.settings.ai[k] = v;
      if (k === 'cloudEndpoint' || k === 'publishableKey') { WB_CLOUD = null; WB_SIG = ''; }
      if (k === 'provider') render();
    }
    save();
    if (path === 'goal' || path === 'instant') render();
  });

  document.addEventListener('input', (e) => {
    const el = e.target.closest('[data-action="note"]');
    if (!el || !CURRENT) return;
    const q = QMAP[CURRENT.qids[CURRENT.i]];
    const r = rec(q.id); r.note = el.value; save();
  });

  document.addEventListener('keydown', (e) => {
    if (e.target.id === 'aiInput' && e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault(); sendAI(e.target.value); return;
    }
    if (location.hash.startsWith('#/quiz') && !/INPUT|TEXTAREA/.test(document.activeElement.tagName)) {
      const k = e.key.toUpperCase();
      if ('ABCD'.includes(k)) { const i = 'ABCD'.indexOf(k); if (CURRENT && i < QMAP[CURRENT.qids[CURRENT.i]].options.length) choose(i); }
      if (e.key === 'ArrowRight') nextQ();
      if (e.key === 'ArrowLeft' && CURRENT && CURRENT.i > 0) { CURRENT.i--; QSTART = now(); saveCurrent(); render(); }
    }
  });

  window.addEventListener('hashchange', render);

  async function testAI(btn) {
    const msg = $('#aiTestMsg');
    if (msg) msg.textContent = '测试中…';
    if (S.settings.ai.provider === 'wb') {
      try {
        const ms = await fetchWBModels();
        if (msg) msg.textContent = ms.length ? `✓ 云环境可用，${ms.length} 个模型` : '△ 目录为空，可能云服务未开通';
        render();
        toast(ms.length ? '云环境可用' : '目录为空');
      } catch (e) {
        const t = wbErrText(e);
        if (msg) msg.textContent = '✕ ' + t.slice(0, 80);
        toast('云环境不可用：' + t.slice(0, 50));
      }
      return;
    }
    try {
      const data = await callAI([{ role: 'system', content: '你是连通性测试助手。' }, { role: 'user', content: '请只回复：连接成功' }]);
      const c = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
      if (msg) msg.textContent = '✓ ' + (c || '连接成功').slice(0, 40);
      toast('AI 连接成功');
    } catch (e) {
      if (msg) msg.textContent = '✕ ' + e.message.slice(0, 80);
      toast('连接失败：' + e.message.slice(0, 50));
    }
  }

  /* ---------------- 启动 ---------------- */
  applyTheme();
  render();
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    // 预留离线缓存位；当前不注册，避免缓存旧题库
  }
})();
