/* Security boundary for untrusted question banks, backups and sync payloads. */
(function () {
  'use strict';
  const HTML = 'http://www.w3.org/1999/xhtml';
  const SVG = 'http://www.w3.org/2000/svg';
  const htmlTags = new Set('b strong i em u s sub sup p br div span ul ol li table thead tbody tr th td figure figcaption blockquote'.split(' '));
  const svgTags = new Set('svg g path rect circle ellipse line polyline polygon text tspan title desc'.split(' '));
  const svgAttrs = new Set('viewBox x y x1 y1 x2 y2 cx cy r rx ry width height d points transform fill stroke stroke-width stroke-linecap stroke-linejoin stroke-dasharray stroke-dashoffset opacity fill-opacity stroke-opacity fill-rule text-anchor dominant-baseline font-size font-weight'.split(' '));
  const shapeClasses = new Set('figrow figitem figbox fig'.split(' '));
  const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const object = (v) => v !== null && typeof v === 'object' && !Array.isArray(v) ? v : {};
  // Quantity limits belong at explicit import admission, never at migration.
  // Validate every existing item so saving cannot discard valid history.
  const array = (v) => Array.isArray(v) ? v : [];
  const text = (v, max = 20000) => typeof v === 'string' ? v.slice(0, max) : '';
  const number = (v, fallback = 0, max = 1e15) => typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(max, v)) : fallback;
  const strings = (v, max = 100) => array(v, max).filter((x) => typeof x === 'string').map((x) => text(x));
  const validId = (v) => typeof v === 'string' && /^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/.test(v) && v !== 'prototype' && !(v in Object.prototype);
  const ids = (v) => array(v, 5000).filter(validId);
  const clone = (v) => JSON.parse(JSON.stringify(v));

  // Parse only in an inert template. Rebuild a tiny vocabulary of inert HTML and
  // SVG primitives; never copy event handlers, style, URLs, IDs or data-action.
  function safeStem(value) {
    const input = document.createElement('template');
    input.innerHTML = text(value, 100000);
    const output = document.createElement('div');
    let remaining = 10000;
    function copy(node, parent, depth) {
      if (--remaining < 0 || depth > 40) return;
      if (node.nodeType === 3) { parent.appendChild(document.createTextNode(node.textContent)); return; }
      if (node.nodeType !== 1) return;
      const tag = node.localName;
      const svg = node.namespaceURI === SVG;
      if (svg ? !svgTags.has(tag) : node.namespaceURI !== HTML || !htmlTags.has(tag)) return;
      if (svg && tag !== 'svg' && parent.namespaceURI !== SVG) return;
      const clean = svg ? document.createElementNS(SVG, tag) : document.createElement(tag);
      for (const attr of node.attributes) {
        const name = attr.name;
        const value = attr.value;
        if (name === 'class') {
          const classes = value.split(/\s+/).filter((x) => shapeClasses.has(x));
          if (classes.length) clean.setAttribute('class', classes.join(' '));
        } else if (svg && svgAttrs.has(name) && !attr.namespaceURI) {
          // Only literal drawing data. No paint servers, CSS variables or URLs.
          if (/url|var|expression|[<>"'\\:;]/i.test(value) || value.length > 10000) continue;
          if ((name === 'fill' || name === 'stroke') && !/^(?:none|currentColor|transparent|[a-z]+|#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\))$/i.test(value)) continue;
          clean.setAttribute(name, value);
        } else if (!svg && ['colspan', 'rowspan'].includes(name) && /^(?:[1-9]|[1-9][0-9])$/.test(value)) {
          clean.setAttribute(name, value);
        }
      }
      for (const child of node.childNodes) copy(child, clean, depth + 1);
      parent.appendChild(clean);
    }
    for (const node of input.content.childNodes) copy(node, output, 0);
    return output.innerHTML;
  }

  function normalizeImport(input, bank) {
    const d = object(input);
    const modules = new Set(bank.modules.map((m) => m.id));
    const pointMap = new Map(bank.points.map((p) => [p.id, p.module]));
    const materialIds = new Set(bank.materials.map((m) => m.id));
    const questionIds = new Set(bank.questions.map((q) => q.id));
    const points = [];
    const materials = [];
    const questions = [];
    let rejected = 0;
    for (const raw of array(d.points, Infinity)) {
      const p = object(raw);
      if (!validId(p.id) || pointMap.has(p.id) || !modules.has(p.module) || !text(p.name)) continue;
      points.push({ id: p.id, module: p.module, name: text(p.name, 200), summary: text(p.summary), methods: strings(p.methods), traps: strings(p.traps), refs: array(p.refs, 100).map((r) => ({ course: text(object(r).course), teacher: text(object(r).teacher), pdf: text(object(r).pdf), page: text(object(r).page) })) });
      pointMap.set(p.id, p.module);
    }
    for (const raw of array(d.materials, Infinity)) {
      const m = object(raw);
      if (!validId(m.id) || materialIds.has(m.id)) continue;
      const clean = { id: m.id, title: text(m.title, 200), kind: text(m.kind, 100), body: text(m.body, 100000), note: text(m.note) };
      if (Array.isArray(object(m.table).head) && Array.isArray(object(m.table).rows)) {
        clean.table = { head: strings(m.table.head, 100), rows: array(m.table.rows, 1000).map((row) => array(row, 100).map((cell) => typeof cell === 'number' && Number.isFinite(cell) ? String(cell) : text(cell))) };
      }
      materials.push(clean); materialIds.add(m.id);
    }
    const source = Array.isArray(input) ? input : d.questions;
    for (const raw of array(source, Infinity)) {
      const q = object(raw);
      const module = q.module == null ? 'ziliao' : q.module;
      const point = q.point == null ? 'zl-zonghe' : q.point;
      if (!validId(q.id) || questionIds.has(q.id) || !modules.has(module) || !pointMap.has(point) || pointMap.get(point) !== module || typeof q.stem !== 'string' || !q.stem.trim() || q.stem.length > 100000 || !Array.isArray(q.options) || q.options.length < 2 || q.options.length > 4 || !q.options.every((o) => typeof o === 'string' && o.length <= 20000) || !Number.isInteger(q.answer) || q.answer < 0 || q.answer >= q.options.length || (q.difficulty != null && ![1, 2, 3].includes(q.difficulty))) {
        rejected++; continue;
      }
      const review = object(q.review);
      const calc = object(q.calc);
      questions.push({ id: q.id, module, point, difficulty: q.difficulty || 2, stem: safeStem(q.stem), options: q.options.slice(), answer: q.answer, explain: text(q.explain), optionNotes: strings(q.optionNotes, 4), method: text(q.method), traps: strings(q.traps), tags: strings(q.tags), materialId: materialIds.has(q.materialId) ? q.materialId : null, source: text(q.source) || '用户导入', review: { status: ['verified', 'reviewed', 'pending', 'disputed'].includes(review.status) ? review.status : 'pending', note: text(review.note) || '用户导入，未审核' }, calc: q.calc && typeof q.calc === 'object' ? { expr: text(calc.expr), value: typeof calc.value === 'number' && Number.isFinite(calc.value) ? calc.value : text(calc.value) } : null });
      questionIds.add(q.id);
    }
    return { questions, points, materials, rejected };
  }

  function safeMap(value, keyCheck, convert, max = Infinity) {
    const out = {};
    for (const [key, raw] of Object.entries(object(value)).slice(0, max)) {
      if (keyCheck(key)) out[key] = convert(object(raw));
    }
    return out;
  }
  function numbers(raw, keys) { return Object.fromEntries(keys.map((key) => [key, number(raw[key])])); }
  function normalizeState(input, base, bank) {
    const s = object(input);
    const out = clone(base);
    const settings = object(s.settings);
    out.createdAt = number(s.createdAt, base.createdAt);
    out.lastActive = number(s.lastActive, base.lastActive);
    out.settings.goal = Math.max(5, number(settings.goal, base.settings.goal, 200));
    out.settings.instant = settings.instant !== false;
    out.settings.shuffle = settings.shuffle !== false;
    out.settings.theme = ['auto', 'light', 'dark'].includes(settings.theme) ? settings.theme : 'auto';
    const ai = object(settings.ai);
    for (const key of ['base', 'model', 'key', 'cloudEndpoint', 'publishableKey', 'cloudModel']) if (typeof ai[key] === 'string') out.settings.ai[key] = text(ai[key], 4000);
    for (const key of ['priceIn', 'priceOut', 'dailyCalls', 'maxTokens', 'temperature']) out.settings.ai[key] = number(ai[key], base.settings.ai[key], key === 'temperature' ? 2 : 1e6);
    out.settings.ai.remember = ai.remember !== false;
    out.settings.ai.provider = ai.provider === 'wb' ? 'wb' : 'custom';
    out.settings.ai.proxy = ['auto', 'proxy', 'direct'].includes(ai.proxy) ? ai.proxy : 'auto';
    out.settings.ai.cloudModels = array(ai.cloudModels, 200).map((m) => ({ id: text(object(m).id, 200), name: text(object(m).name, 200), disabled: object(m).disabled === true }));
    if (!out.settings.ai.remember) out.settings.ai.key = '';
    const cloud = object(s.cloud);
    out.cloud.enabled = cloud.enabled === true;
    out.cloud.auto = cloud.auto !== false;
    for (const key of ['url', 'key', 'code', 'lastError']) out.cloud[key] = text(cloud[key], 4000);
    for (const key of ['lastSync', 'remoteAt']) out.cloud[key] = number(cloud[key]);
    const imported = normalizeImport({ questions: s.imported, points: object(s.importedMeta).points, materials: object(s.importedMeta).materials }, bank);
    out.imported = imported.questions;
    out.importedMeta = { points: imported.points, materials: imported.materials };
    const knownIds = new Set(bank.questions.concat(out.imported).map((q) => q.id));
    out.records = safeMap(s.records, (id) => validId(id) && knownIds.has(id), (r) => ({ ...numbers(r, ['seen', 'right', 'wrong', 'lastAt', 'lastMs', 'favAt', 'wrongAt']), note: text(r.note), fav: r.fav === true, mastered: r.mastered === true, reasons: Object.fromEntries(['概念不清', '计算失误', '审题偏差', '时间不够', '完全没思路'].map((reason) => [reason, number(object(r.reasons)[reason])]).filter(([, count]) => count > 0)) }));
    out.daily = safeMap(s.daily, (key) => /^\d{4}-\d{2}-\d{2}$/.test(key), (r) => numbers(r, ['answered', 'right', 'ms']));
    const normalizeSession = (raw) => {
      const r = object(raw);
      return { id: validId(r.id) ? r.id : '', mode: ['mock', 'review', 'wrong', 'fav', 'special', 'seq', 'random'].includes(r.mode) ? r.mode : 'special', ...numbers(r, ['at', 'timeMs', 'total', 'right', 'skipped']), moduleFilter: text(r.moduleFilter, 200), items: array(r.items, 5000).filter((it) => knownIds.has(object(it).qid)).map((it) => ({ qid: it.qid, chosen: Number.isInteger(it.chosen) && it.chosen >= 0 && it.chosen < 4 ? it.chosen : null, right: it.right === true, module: validId(it.module) ? it.module : '', point: validId(it.point) ? it.point : '' })) };
    };
    out.sessions = array(s.sessions, 120).map(normalizeSession);
    if (s.lastResult) out.lastResult = normalizeSession(s.lastResult);
    const usage = object(s.aiUsage);
    out.aiUsage = { ...numbers(usage, ['calls', 'tin', 'tout', 'cost', 'credits']), date: /^\d{4}-\d{2}-\d{2}$/.test(usage.date) ? usage.date : base.aiUsage.date };
    out.aiChat = array(s.aiChat, 200).filter((m) => ['user', 'assistant'].includes(object(m).role)).map((m) => ({ role: m.role, content: text(m.content, 100000), at: number(m.at) }));
    out.pending = array(s.pending, 5000).map((p) => text(typeof p === 'string' ? p : JSON.stringify(p)));
    if (s.lastPractice) out.lastPractice = { qids: ids(object(s.lastPractice).qids).filter((id) => knownIds.has(id)), ...numbers(object(s.lastPractice), ['done', 'total']) };
    if (s.examCfg) out.examCfg = { count: [20, 30, 40].includes(object(s.examCfg).count) ? s.examCfg.count : 30, min: [25, 35, 45].includes(object(s.examCfg).min) ? s.examCfg.min : 35, off: ids(object(s.examCfg).off).filter((id) => bank.modules.some((m) => m.id === id)) };
    return out;
  }

  function persistedState(state) {
    const copy = clone(state);
    if (!copy.settings.ai.remember) copy.settings.ai.key = '';
    return copy;
  }
  function currentPractice(value, questions) {
    const c = object(value);
    const qids = ids(c.qids);
    if (!qids.length || qids.length !== array(c.qids, 5000).length || qids.some((id) => !own(questions, id))) return null;
    const answers = {};
    const flags = {};
    for (const id of qids) {
      const answer = object(c.answers)[id];
      if (Number.isInteger(answer) && answer >= 0 && answer < questions[id].options.length) answers[id] = answer;
      if (object(c.flags)[id] === true) flags[id] = true;
    }
    return { id: validId(c.id) ? c.id : 'restored-practice', mode: ['mock', 'review', 'wrong', 'fav', 'special', 'seq', 'random'].includes(c.mode) ? c.mode : 'special', qids, answers, flags, i: Math.min(qids.length - 1, Math.floor(number(c.i))), ...numbers(c, ['startTs', 'lastTs', 'limitSec', 'done']), total: qids.length, moduleFilter: text(c.moduleFilter, 200), matCollapsed: c.matCollapsed === true };
  }
  function learningPayload(state) {
    const copy = clone(state);
    // Connection credentials and destinations are device-local, never portable.
    delete copy.settings.ai;
    delete copy.cloud;
    return copy;
  }
  function restoreState(incoming, current, base, bank) {
    const raw = object(incoming);
    if (!own(raw, 'records') || !own(raw, 'settings') || !raw.records || !raw.settings || Array.isArray(raw.records) || Array.isArray(raw.settings) || typeof raw.records !== 'object' || typeof raw.settings !== 'object') throw new Error('不是有效的学习备份');
    const restored = normalizeState(raw, base, bank);
    restored.settings.ai = clone(current.settings.ai);
    restored.cloud = clone(current.cloud);
    restored.lastPractice = null;
    return restored;
  }
  function endpoint(value) {
    try {
      const u = new URL(value);
      if (u.username || u.password || u.search || u.hash) return '';
      const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(u.hostname);
      if (u.protocol !== 'https:' && !(u.protocol === 'http:' && loopback)) return '';
      return u.href.replace(/\/+$/, '');
    } catch (e) { return ''; }
  }
  window.SAS_SECURITY = Object.freeze({ validId, safeNumber: number, safeStem, normalizeImport, normalizeState, currentPractice, persistedState, learningPayload, restoreState, endpoint });
})();
