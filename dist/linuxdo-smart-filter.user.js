// ==UserScript==
// @name         LinuxDo Smart Filter
// @name:zh-CN   LinuxDo 智能降噪过滤器
// @namespace    https://github.com/EveSunMaple
// @version      0.1.0
// @description  Filter low-value topics on linux.do by category/tags/title triage, with whitelist protection for quality posts
// @description:zh-CN  按板块/标签/标题内容分诊过滤 linux.do 低信息量主题，优质帖保护高亮，支持预设与自定义规则
// @author       EveSunMaple
// @match        https://linux.do/*
// @run-at       document-start
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @grant        GM_addStyle
// @noframes
// @updateURL    https://raw.githubusercontent.com/EveSunMaple/linuxdo-smart-filter/main/dist/linuxdo-smart-filter.user.js
// @downloadURL  https://raw.githubusercontent.com/EveSunMaple/linuxdo-smart-filter/main/dist/linuxdo-smart-filter.user.js
// ==/UserScript==

"use strict";
(() => {
  // src/context.ts
  var current = null;
  function setApp(a) {
    current = a;
  }
  function app() {
    if (!current) throw new Error("app not initialized");
    return current;
  }

  // src/classify.ts
  var ASCII_WORD = /^[a-z0-9.+#-]+$/;
  function escapeRe(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
  function matchesWord(titleLower, word) {
    const w = word.toLowerCase();
    if (ASCII_WORD.test(w)) {
      return new RegExp(`(^|[^a-z0-9])${escapeRe(w)}($|[^a-z0-9])`).test(titleLower);
    }
    return titleLower.includes(w);
  }
  function collect(titleLower, words) {
    const hits = [];
    for (const w of words) {
      if (w && matchesWord(titleLower, w)) hits.push(w);
    }
    return hits;
  }
  function extractSignals(topic, lex) {
    const title = String(topic.title || "").trim();
    const lower = title.toLowerCase();
    const askHits = collect(lower, lex.ask);
    if (/[?？]\s*$/.test(title) || /[吗嘛呢]\s*[?？]?$/.test(title)) askHits.push("问句结尾");
    return {
      title,
      titleLen: [...title].length,
      askHits,
      buzzHits: collect(lower, lex.buzz),
      shieldHits: collect(lower, lex.shield)
    };
  }
  function hasTag(topic, names) {
    const set = new Set(names.map((s) => s.toLowerCase()));
    for (const t of topic.tags || []) {
      if (t?.name && set.has(t.name.toLowerCase())) return t.name;
    }
    return null;
  }

  // src/page.ts
  var HOME_ROUTES = ["latest", "new", "unseen", "hot", "top", "read"];
  function pageContext(href) {
    try {
      const url = new URL(href, "https://linux.do/");
      const catParam = /[?&]category=(\d+)/i.exec(url.search);
      if (catParam) {
        const id = parseInt(catParam[1], 10);
        const f = (/[?&]order=([a-z]+)/i.exec(url.search) || [])[1] || "latest";
        return { kind: "category", categoryId: id, filter: f.toLowerCase(), key: `cat:${id}:${f.toLowerCase()}` };
      }
      if (url.pathname === "/" || url.pathname === "") return { kind: "home", route: "latest", key: "home:latest" };
      const hm = new RegExp(`^/(${HOME_ROUTES.join("|")})(\\.json)?(/.*)?$`, "i").exec(url.pathname);
      if (hm) {
        const route = hm[1].toLowerCase();
        return { kind: "home", route, key: `home:${route}` };
      }
      const cm = /^\/c\/[^/]+(?:\/[^/]+)?\/(\d+)(?:\/l\/([a-z]+))?/i.exec(url.pathname);
      if (cm) {
        const id = parseInt(cm[1], 10);
        const f = (cm[2] || "latest").toLowerCase();
        return { kind: "category", categoryId: id, filter: f, key: `cat:${id}:${f}` };
      }
      return { kind: "other", key: "other" };
    } catch {
      return { kind: "other", key: "other" };
    }
  }
  function isFilterablePage(pg) {
    return pg.kind === "home" || pg.kind === "category";
  }
  function buildCategoryMap(categories) {
    if (!Array.isArray(categories)) return null;
    const byId = /* @__PURE__ */ new Map();
    const byName = /* @__PURE__ */ new Map();
    const childrenOf = /* @__PURE__ */ new Map();
    for (const c of categories) {
      if (!c || typeof c.id !== "number" || typeof c.name !== "string") continue;
      const rec = {
        id: c.id,
        name: c.name,
        slug: typeof c.slug === "string" ? c.slug : "",
        parentId: typeof c.parent_category_id === "number" ? c.parent_category_id : null
      };
      byId.set(rec.id, rec);
      if (!byName.has(rec.name)) byName.set(rec.name, []);
      byName.get(rec.name)?.push(rec);
    }
    for (const rec of byId.values()) {
      if (rec.parentId == null) continue;
      if (!childrenOf.has(rec.parentId)) childrenOf.set(rec.parentId, []);
      childrenOf.get(rec.parentId)?.push(rec.id);
    }
    if (!byId.size) return null;
    return { byId, byName, childrenOf };
  }
  function resolveCategoryNames(names, map) {
    const ids = /* @__PURE__ */ new Set();
    const missing = [];
    if (!map) return { ids, missing: [...names] };
    for (const name of names) {
      const cands = map.byName.get(name);
      if (!cands?.length) {
        missing.push(name);
        continue;
      }
      const root = cands.find((c) => c.parentId === null) || cands[0];
      const stack = [root.id];
      while (stack.length) {
        const id = stack.pop();
        if (ids.has(id)) continue;
        ids.add(id);
        for (const child of map.childrenOf.get(id) || []) stack.push(child);
      }
    }
    return { ids, missing };
  }
  function categoryNameOf(map, id) {
    const rec = map?.byId.get(id);
    return rec ? rec.name : `#${id}`;
  }
  function categoryHref(map, id) {
    const rec = map?.byId.get(id);
    if (!rec) return "#";
    const parts = [rec.slug || "category"];
    let cur = rec;
    while (cur.parentId != null) {
      const parent = map?.byId.get(cur.parentId);
      if (!parent) break;
      parts.unshift(parent.slug || "category");
      cur = parent;
    }
    return `/c/${parts.join("/")}/${rec.id}`;
  }

  // src/engine.ts
  function expandIds(ids, map) {
    const out = /* @__PURE__ */ new Set();
    if (!map) {
      for (const id of ids) out.add(id);
      return out;
    }
    const stack = [...ids];
    while (stack.length) {
      const id = stack.pop();
      if (out.has(id)) continue;
      out.add(id);
      for (const ch of map.childrenOf.get(id) || []) stack.push(ch);
    }
    return out;
  }
  function compileOne(rule, index, map) {
    const compiled2 = { rule, ruleIndex: index, categoryIds: null, scopeIds: null, regexes: [] };
    const w = rule.when || {};
    const hasAnyCondition = w.categoryNames && w.categoryNames.length > 0 || w.tagsAny && w.tagsAny.length > 0 || w.tagsNone && w.tagsNone.length > 0 || w.minAsk != null || w.minBuzz != null || w.minShield != null || w.titleMaxLen != null || w.titleMinLen != null || w.titleRegexAny && w.titleRegexAny.length > 0;
    if (!hasAnyCondition) {
      compiled2.compileError = "规则没有任何匹配条件";
      return compiled2;
    }
    if (w.categoryNames?.length) {
      const { ids, missing } = resolveCategoryNames(w.categoryNames, map);
      if (!map) {
        compiled2.compileError = "板块映射未就绪";
        return compiled2;
      }
      if (missing.length) {
        compiled2.compileError = `找不到板块：${missing.join("、")}`;
        return compiled2;
      }
      compiled2.categoryIds = ids;
    }
    const scope = rule.scope;
    if (scope && scope.type === "category") {
      if (!map) {
        compiled2.compileError = "板块映射未就绪";
        return compiled2;
      }
      compiled2.scopeIds = expandIds(scope.categoryIds || [], map);
    }
    for (const src of w.titleRegexAny || []) {
      try {
        compiled2.regexes.push(new RegExp(src, "i"));
      } catch (_e) {
        compiled2.compileError = `正则无效：${src}`;
        return compiled2;
      }
    }
    return compiled2;
  }
  function compileRules(rules, map) {
    const compiled2 = [];
    const errors = /* @__PURE__ */ new Map();
    rules.forEach((rule, index) => {
      const c = compileOne(rule, index, map);
      compiled2.push(c);
      if (c.compileError) errors.set(rule.id, c.compileError);
    });
    return { rules: compiled2, errors };
  }
  function ruleAppliesToPage(c, pg) {
    const scope = c.rule.scope;
    if (!scope || scope.type === "global") return true;
    if (pg.kind === "other") return false;
    if (scope.type === "home") return pg.kind === "home";
    if (scope.type === "category") {
      if (scope.includeHome && pg.kind === "home") return true;
      if (pg.kind !== "category" || pg.categoryId == null) return false;
      return c.scopeIds ? c.scopeIds.has(pg.categoryId) : false;
    }
    return false;
  }
  function pageHasActiveRule(state, pg) {
    return state.rules.some((c) => c.rule.enabled && !c.compileError && ruleAppliesToPage(c, pg));
  }
  function matchRule(c, topic, sig) {
    if (c.compileError) return false;
    const w = c.rule.when || {};
    if (c.categoryIds && !c.categoryIds.has(topic.category_id)) return false;
    if (w.tagsAny?.length) {
      if (!hasTag(topic, w.tagsAny)) return false;
    }
    if (w.tagsNone?.length) {
      if (hasTag(topic, w.tagsNone)) return false;
    }
    if (w.minAsk != null && sig.askHits.length < w.minAsk) return false;
    if (w.minBuzz != null && sig.buzzHits.length < w.minBuzz) return false;
    if (w.minShield != null && sig.shieldHits.length < w.minShield) return false;
    if (w.titleMaxLen != null && sig.titleLen > w.titleMaxLen) return false;
    if (w.titleMinLen != null && sig.titleLen < w.titleMinLen) return false;
    if (c.regexes.length) {
      if (!c.regexes.some((re) => re.test(sig.title))) return false;
    }
    return true;
  }
  function fmtHits(hits) {
    const shown = hits.slice(0, 4);
    return `×${hits.length}（${shown.join("、")}${hits.length > shown.length ? "…" : ""}）`;
  }
  function buildReason(c, topic, sig) {
    const parts = [];
    const w = c.rule.when || {};
    if (w.tagsAny?.length) {
      const tag = hasTag(topic, w.tagsAny);
      if (tag) parts.push(`标签「${tag}」`);
    }
    if (c.categoryIds) parts.push("板块命中");
    if (w.minAsk != null && sig.askHits.length) parts.push(`提问词 ${fmtHits(sig.askHits)}`);
    if (w.minBuzz != null && sig.buzzHits.length) parts.push(`主题词 ${fmtHits(sig.buzzHits)}`);
    if (w.minShield != null && sig.shieldHits.length) parts.push(`优质词 ${fmtHits(sig.shieldHits)}`);
    if (w.titleMaxLen != null || w.titleMinLen != null) parts.push(`标题长度 ${sig.titleLen}`);
    if (c.regexes.length) parts.push("标题正则");
    return parts.join(" + ") || "条件命中";
  }
  function decide(topic, state, pg, ctx) {
    const ex = ctx.exemptions;
    if (ex.topicIds.includes(topic.id)) return { kind: "keep" };
    const lower = String(topic.title || "").toLowerCase();
    if (ex.titleKeywords.some((k) => k && lower.includes(k.toLowerCase()))) return { kind: "keep" };
    const sig = extractSignals(topic, ctx.lex);
    for (const c of state.rules) {
      if (c.rule.mode !== "filter" || c.rule.shieldable !== false || !c.rule.enabled || c.compileError) continue;
      if (!ruleAppliesToPage(c, pg)) continue;
      if (!matchRule(c, topic, sig)) continue;
      return {
        kind: "filter",
        rule: c.rule,
        ruleIndex: c.ruleIndex,
        reason: buildReason(c, topic, sig),
        signals: sig
      };
    }
    for (const c of state.rules) {
      if (c.rule.mode !== "highlight" || !c.rule.enabled || c.compileError) continue;
      if (!ruleAppliesToPage(c, pg)) continue;
      if (!matchRule(c, topic, sig)) continue;
      return {
        kind: "highlight",
        rule: c.rule,
        ruleIndex: c.ruleIndex,
        color: c.rule.color || "#2f9e44",
        reason: buildReason(c, topic, sig),
        signals: sig
      };
    }
    for (const c of state.rules) {
      if (c.rule.mode !== "filter" || c.rule.shieldable === false || !c.rule.enabled || c.compileError) continue;
      if (!ruleAppliesToPage(c, pg)) continue;
      if (!matchRule(c, topic, sig)) continue;
      if (sig.shieldHits.length > 0) continue;
      return {
        kind: "filter",
        rule: c.rule,
        ruleIndex: c.ruleIndex,
        reason: buildReason(c, topic, sig),
        signals: sig
      };
    }
    return { kind: "keep" };
  }

  // src/intercept.ts
  var BUCKET_MAX = 1e3;
  var buckets = /* @__PURE__ */ new Map();
  var pageHighlights = /* @__PURE__ */ new Map();
  var currentPage = pageContext(location.href);
  var host = null;
  var nativeFetch = null;
  var preloadDone = false;
  var domRaf = 0;
  function bucketFor(key) {
    let b = buckets.get(key);
    if (!b) {
      b = { map: /* @__PURE__ */ new Map(), order: [] };
      buckets.set(key, b);
    }
    return b;
  }
  function addToBucket(key, entry) {
    const b = bucketFor(key);
    if (b.map.has(entry.topic.id)) return false;
    b.map.set(entry.topic.id, entry);
    b.order.push(entry.topic.id);
    while (b.order.length > BUCKET_MAX) {
      const old = b.order.shift();
      b.map.delete(old);
    }
    return true;
  }
  function currentFilteredEntries() {
    const b = buckets.get(currentPage.key);
    if (!b) return [];
    const out = [];
    for (const id of b.order) {
      const e = b.map.get(id);
      if (e) out.push(e);
    }
    return out;
  }
  function filteredCount() {
    return currentFilteredEntries().length;
  }
  function getCurrentPage() {
    return currentPage;
  }
  function syncCurrentPage() {
    currentPage = pageContext(location.href);
  }
  function processTopicList(pg, obj) {
    if (!host) return null;
    const rec = obj;
    const tl = rec.topic_list;
    if (!tl || !Array.isArray(tl.topics)) return null;
    const state = host.getState();
    const cfg = host.getConfig();
    const ctx = { lex: cfg.lexicons, exemptions: cfg.exemptions };
    const highlights = [];
    const kept = [];
    let filtered = 0;
    for (const raw of tl.topics) {
      const topic = raw;
      if (!topic || typeof topic.id !== "number") {
        kept.push(topic);
        continue;
      }
      const d = decideTopic(topic, state, pg, ctx);
      if (d.kind === "filter") {
        addToBucket(pg.key, { topic, ruleName: d.rule.name, reason: d.reason, time: Date.now() });
        filtered++;
        if (cfg.debug) host.log("过滤", topic.title, "=>", d.rule.name, d.reason);
      } else if (d.kind === "highlight") {
        highlights.push({ topic, color: d.color, rank: d.ruleIndex });
        if (cfg.debug) host.log("高亮", topic.title, "=>", d.rule.name, d.reason);
      } else {
        kept.push(topic);
      }
    }
    highlights.sort((a, b) => a.rank - b.rank);
    if (highlights.length) {
      let hlMap = pageHighlights.get(pg.key);
      if (!hlMap) {
        hlMap = /* @__PURE__ */ new Map();
        pageHighlights.set(pg.key, hlMap);
      }
      for (const h of highlights) hlMap.set(h.topic.id, h.color);
    }
    tl.topics = [...highlights.map((h) => h.topic), ...kept];
    if (filtered > 0) {
      host.onBucketChange();
      if (pg.key === currentPage.key) scheduleDomPass();
    }
    return { kept: kept.length, filtered, highlights: highlights.length };
  }
  function decideTopic(topic, state, pg, ctx) {
    return decide(topic, state, pg, ctx);
  }
  function looksLikeTopicList(text) {
    return text.indexOf('"topic_list"') !== -1 && text.indexOf('"topics"') !== -1;
  }
  function scheduleDomPass() {
    if (domRaf) return;
    domRaf = requestAnimationFrame(() => {
      domRaf = 0;
      domPass();
    });
  }
  var domDecided = /* @__PURE__ */ new Map();
  function decidedFor(key) {
    let m = domDecided.get(key);
    if (!m) {
      m = /* @__PURE__ */ new Map();
      domDecided.set(key, m);
    }
    return m;
  }
  function hideRow(row) {
    if (row.dataset.ldfHidden) return;
    row.dataset.ldfHidden = "1";
    row.style.display = "none";
  }
  function paintRow(row, color) {
    if (!row.classList.contains("ldf-highlight")) row.classList.add("ldf-highlight");
    row.style.setProperty("--ldf-hl", color);
  }
  function getDomTopic(row) {
    const id = parseInt(row.getAttribute("data-topic-id") || "", 10);
    if (!Number.isFinite(id)) return null;
    const titleEl = row.querySelector("a.raw-topic-link, a.title, .topic-list-item-title");
    const title = (titleEl?.textContent || "").replace(/\s+/g, " ").trim();
    if (!title) return null;
    const catAttr = row.getAttribute("data-category-id");
    const categoryId = catAttr ? parseInt(catAttr, 10) : 0;
    const tags = [];
    row.querySelectorAll("a.discourse-tag").forEach((a) => {
      const name = a.getAttribute("data-tag-name") || (a.textContent || "").trim();
      if (name && !tags.some((t) => t.name === name)) tags.push({ name });
    });
    const intOf = (sel) => {
      const el = row.querySelector(sel);
      if (!el) return void 0;
      const n = parseInt((el.textContent || "").replace(/[^\d]/g, ""), 10);
      return Number.isFinite(n) ? n : void 0;
    };
    const replies = intOf(".posts .number, .posts-map .number");
    const views = intOf(".views .number");
    return {
      id,
      title,
      category_id: Number.isFinite(categoryId) ? categoryId : 0,
      tags,
      posts_count: replies != null ? replies + 1 : void 0,
      views
    };
  }
  function domPass() {
    if (!host) return;
    const cfg = host.getConfig();
    if (!cfg.masterEnabled) return;
    const state = host.getState();
    if (!pageHasActiveRule(state, currentPage)) return;
    const bucket = buckets.get(currentPage.key);
    const hlMap = pageHighlights.get(currentPage.key);
    const decided = decidedFor(currentPage.key);
    let bucketChanged = false;
    document.querySelectorAll("tr[data-topic-id]").forEach((row) => {
      const id = parseInt(row.getAttribute("data-topic-id") || "", 10);
      if (!Number.isFinite(id)) return;
      if (bucket?.map.has(id)) {
        hideRow(row);
        return;
      }
      if (hlMap?.has(id)) {
        paintRow(row, hlMap.get(id));
        return;
      }
      const known = decided.get(id);
      if (known) {
        if (known.kind === "filter") hideRow(row);
        else if (known.kind === "highlight") paintRow(row, known.color || "#2f9e44");
        return;
      }
      const topic = getDomTopic(row);
      if (!topic) return;
      const d = decide(topic, state, currentPage, { lex: cfg.lexicons, exemptions: cfg.exemptions });
      if (d.kind === "filter") {
        decided.set(id, { kind: "filter" });
        addToBucket(currentPage.key, { topic, ruleName: d.rule.name, reason: d.reason, time: Date.now() });
        bucketChanged = true;
        hideRow(row);
        if (cfg.debug) host?.log("DOM兜底过滤", topic.title, "=>", d.rule.name, d.reason);
      } else if (d.kind === "highlight") {
        decided.set(id, { kind: "highlight", color: d.color });
        let m = pageHighlights.get(currentPage.key);
        if (!m) {
          m = /* @__PURE__ */ new Map();
          pageHighlights.set(currentPage.key, m);
        }
        m.set(id, d.color);
        paintRow(row, d.color);
      } else {
        decided.set(id, { kind: "keep" });
      }
    });
    if (bucketChanged) host.onBucketChange();
    if (bucket?.order.length) {
      const body = document.querySelector(".topic-list-body");
      if (body) {
        const rows = body.querySelectorAll("tr[data-topic-id]");
        const allHidden = rows.length > 0 && Array.from(rows).every((r) => r.dataset.ldfHidden === "1" || r.style.display === "none");
        if (body.children.length === 0 || allHidden) showSelfEmptyNotice(currentPage.key, bucket.order.length);
      }
    }
  }
  var selfEmptyShown = /* @__PURE__ */ new Set();
  function showSelfEmptyNotice(key, count) {
    if (selfEmptyShown.has(key)) return;
    selfEmptyShown.add(key);
    window.dispatchEvent(new CustomEvent("ldf:self-empty", { detail: { count } }));
  }
  function rewritePreload(script) {
    if (!host || preloadDone) return;
    const text = script.textContent;
    if (!text || text.indexOf('"topic_list"') === -1) return;
    try {
      const outer = JSON.parse(text);
      const siteRaw = outer.site;
      if (siteRaw) {
        const site = typeof siteRaw === "string" ? JSON.parse(siteRaw) : siteRaw;
        const map = buildCategoryMap(site?.categories);
        if (map) {
          host.setCatMap(map);
          host.onCatMapReady();
        }
      }
      const pg = pageContext(location.href);
      currentPage = pg;
      if (isFilterablePage(pg) && pageHasActiveRule(host.getState(), pg)) {
        const tlRaw = outer.topic_list;
        const tl = typeof tlRaw === "string" ? JSON.parse(tlRaw) : tlRaw;
        const r = processTopicList(pg, { topic_list: tl });
        if (r && typeof tlRaw === "string") outer.topic_list = JSON.stringify(tl);
        if (r) host.log("预载改写", pg.key, r);
      }
      script.textContent = JSON.stringify(outer);
      preloadDone = true;
    } catch (e) {
      host.log("预载改写失败", e);
    }
  }
  function hookPreload() {
    const existing = document.querySelector("script#data-preloaded");
    if (existing) rewritePreload(existing);
    if (preloadDone) return;
    const observer = new MutationObserver((mutations) => {
      if (preloadDone) {
        observer.disconnect();
        return;
      }
      for (const m of mutations) {
        for (const node of Array.from(m.addedNodes)) {
          if (!(node instanceof Element)) continue;
          if (node.matches("script#data-preloaded")) rewritePreload(node);
          else {
            const s = node.querySelector("script#data-preloaded");
            if (s) rewritePreload(s);
          }
        }
      }
    });
    observer.observe(document.documentElement || document, { childList: true, subtree: true });
  }
  function hookFetch() {
    if (typeof nativeFetch !== "function") return;
    const native = nativeFetch;
    window.fetch = function(input, init) {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      const pg = pageContext(url);
      if (!host || !isFilterablePage(pg) || !pageHasActiveRule(host.getState(), pg)) {
        return native.apply(this, [input, init]);
      }
      return native.apply(this, [input, init]).then((resp) => {
        const ct = resp.headers.get("content-type") || "";
        if (ct.indexOf("json") === -1) return resp;
        return resp.clone().text().then((text) => {
          if (!looksLikeTopicList(text)) return resp;
          try {
            const obj = JSON.parse(text);
            const r = processTopicList(pg, obj);
            if (!r) return resp;
            return new Response(JSON.stringify(obj), {
              status: resp.status,
              statusText: resp.statusText,
              headers: resp.headers
            });
          } catch (e) {
            host?.log("fetch 过滤失败", e);
            return resp;
          }
        });
      });
    };
  }
  function hookXHR() {
    const XHR = window.XMLHttpRequest;
    const open = XHR.prototype.open;
    const send = XHR.prototype.send;
    const descText = Object.getOwnPropertyDescriptor(XHR.prototype, "responseText");
    const descResp = Object.getOwnPropertyDescriptor(XHR.prototype, "response");
    XHR.prototype.open = function(method, url, ...rest) {
      this.__ldfUrl = String(url);
      return open.apply(this, [method, url, ...rest]);
    };
    XHR.prototype.send = function(...args) {
      const pg = pageContext(this.__ldfUrl || "");
      if (host && descText && isFilterablePage(pg) && pageHasActiveRule(host.getState(), pg)) {
        const xhr = this;
        const install = () => {
          if (xhr.__ldfCache !== void 0) return;
          try {
            Object.defineProperty(xhr, "responseText", {
              configurable: true,
              get() {
                const orig = descText.get?.call(xhr);
                if (xhr.__ldfCache !== void 0) return xhr.__ldfCache;
                if (!looksLikeTopicList(orig)) {
                  xhr.__ldfCache = orig;
                  return orig;
                }
                try {
                  const obj = JSON.parse(orig);
                  const r = processTopicList(pg, obj);
                  if (!r) {
                    xhr.__ldfCache = orig;
                    return orig;
                  }
                  xhr.__ldfCache = JSON.stringify(obj);
                  return xhr.__ldfCache;
                } catch (e) {
                  host?.log("XHR 过滤失败", e);
                  xhr.__ldfCache = orig;
                  return orig;
                }
              }
            });
            if (descResp) {
              Object.defineProperty(xhr, "response", {
                configurable: true,
                get() {
                  if (xhr.responseType === "" || xhr.responseType === "text") return xhr.responseText;
                  return descResp.get?.call(xhr);
                }
              });
            }
          } catch (e) {
            host?.log("XHR responseText 劫持失败", e);
          }
        };
        xhr.addEventListener("readystatechange", () => {
          if (xhr.readyState === 4) install();
        });
      }
      return send.apply(this, args);
    };
  }
  function hookDom() {
    const observer = new MutationObserver(() => scheduleDomPass());
    const start = () => observer.observe(document.body, { childList: true, subtree: true });
    if (document.body) start();
    else document.addEventListener("DOMContentLoaded", start, { once: true });
  }
  function hookHistory() {
    const wrap = (fn) => function(...args) {
      const r = fn.apply(this, args);
      syncCurrentPage();
      scheduleDomPass();
      return r;
    };
    history.pushState = wrap(history.pushState);
    history.replaceState = wrap(history.replaceState);
    window.addEventListener("popstate", () => {
      syncCurrentPage();
      scheduleDomPass();
    });
  }
  async function ensureCatMapFallback(h) {
    if (h.getCatMap()) return;
    try {
      const resp = await (nativeFetch || fetch)("/site.json", { headers: { Accept: "application/json" } });
      const site = await resp.json();
      const map = buildCategoryMap(site?.categories);
      if (map) {
        h.setCatMap(map);
        h.onCatMapReady();
        h.log("已从 /site.json 载入板块映射");
      }
    } catch (e) {
      h.log("拉取 /site.json 失败", e);
    }
  }
  async function installInterceptors(h) {
    host = h;
    nativeFetch = window.fetch ? window.fetch.bind(window) : null;
    hookFetch();
    hookXHR();
    hookPreload();
    hookDom();
    hookHistory();
    syncCurrentPage();
    const boot2 = () => {
      if (!preloadDone) {
        const s = document.querySelector("script#data-preloaded");
        if (s) rewritePreload(s);
      }
      void ensureCatMapFallback(h);
      scheduleDomPass();
    };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot2, { once: true });
    else boot2();
  }

  // src/lexicons.ts
  var ASK_WORDS = [
    "求助",
    "求推荐",
    "求教",
    "求问",
    "求救",
    "求方案",
    "求个",
    "求解",
    "请教",
    "请问",
    "咨询",
    "问一下",
    "想问",
    "想请教",
    "问问",
    "不懂就问",
    "寻求",
    "有没有",
    "有人知道",
    "有人用过",
    "谁知道",
    "谁能",
    "哪位",
    "大佬",
    "大佬们",
    "各位佬",
    "佬们",
    "高手",
    "大神",
    "彦祖",
    "怎么",
    "怎么办",
    "咋办",
    "咋弄",
    "如何",
    "如何选",
    "该如何",
    "该选",
    "选哪个",
    "哪个好",
    "哪种",
    "该不该",
    "要不要",
    "值不值",
    "划算吗",
    "值得吗",
    "是不是",
    "能不能",
    "可不可以",
    "可以吗",
    "行不行",
    "对吗",
    "对不对",
    "正常吗",
    "合理吗",
    "靠谱吗",
    "好使吗",
    "能用吗",
    "怎么样",
    "为什么",
    "为啥",
    "急",
    "在线等",
    "有偿",
    "悬赏",
    "推荐",
    "建议",
    "方案",
    "支招"
  ];
  var BUZZ_WORDS = [
    "账号",
    "账户",
    "小号",
    "主号",
    "号商",
    "独享",
    "共享",
    "拼车",
    "开车",
    "上车",
    "车位",
    "发车",
    "订阅",
    "续费",
    "充值",
    "白嫖",
    "薅",
    "羊毛",
    "额度",
    "降智",
    "封号",
    "被封",
    "风控",
    "砍单",
    "退订",
    "退款",
    "折扣",
    "卡密",
    "兑换码",
    "邀请码",
    "邀请链接",
    "优惠",
    "优惠券",
    "价格",
    "涨价",
    "降价",
    "性价比",
    "采购",
    "购买",
    "买号",
    "卖号",
    "出号",
    "收号",
    "代购",
    "代充",
    "kyc",
    "实名",
    "身份证",
    "护照",
    "手机号",
    "接码",
    "验证码",
    "邮箱",
    "银行卡",
    "支付",
    "绑定",
    "解绑",
    "注册",
    "注销",
    "老号",
    "新号",
    "免费号",
    "试用",
    "中转",
    "镜像",
    "套餐",
    "会员",
    "vip",
    "代理",
    "机场",
    "节点",
    "梯子",
    "流量",
    "包月",
    "包年"
  ];
  var SHIELD_WORDS = [
    "开源",
    "已开源",
    "开源项目",
    "github",
    "gitlab",
    "gitee",
    "repo",
    "仓库",
    "源码",
    "项目地址",
    "发布",
    "上线",
    "自荐",
    "分享",
    "教程",
    "指南",
    "文档",
    "手册",
    "攻略",
    "踩坑",
    "避坑",
    "实测",
    "测评",
    "评测",
    "对比",
    "复盘",
    "总结",
    "原理",
    "深入",
    "解析",
    "剖析",
    "分析",
    "架构",
    "设计",
    "实现",
    "从零",
    "手把手",
    "保姆级",
    "复现",
    "论文",
    "翻译",
    "更新日志",
    "更新",
    "版本",
    "release",
    "changelog",
    "pr",
    "issue",
    "bug",
    "修复",
    "优化",
    "性能",
    "部署",
    "docker",
    "自建",
    "自部署",
    "自动化",
    "插件",
    "扩展",
    "工具",
    "脚本",
    "小工具",
    "工作流",
    "mcp",
    "最佳实践",
    "案例",
    "经验"
  ];
  function defaultLexicons() {
    return {
      ask: [...ASK_WORDS],
      buzz: [...BUZZ_WORDS],
      shield: [...SHIELD_WORDS]
    };
  }

  // src/presets.ts
  var RULE_COLORS = ["#2f9e44", "#1971c2", "#f08c00", "#e8590c", "#9c36b5", "#0c8599"];
  function defaultPresets() {
    return [
      {
        id: "preset-tag-pure",
        name: "纯水标签硬过滤",
        preset: true,
        enabled: true,
        mode: "filter",
        shieldable: false,
        when: { tagsAny: ["纯水", "灌水", "无意义"] }
      },
      {
        id: "preset-tag-promo",
        name: "推广/福利标签过滤",
        preset: true,
        enabled: true,
        mode: "filter",
        when: { tagsAny: ["公益推广", "广告", "抽奖"] }
      },
      {
        id: "preset-dev-ask",
        name: "开发调优·求助降噪",
        preset: true,
        enabled: true,
        mode: "filter",
        when: { categoryNames: ["开发调优"], minAsk: 2 }
      },
      {
        id: "preset-ai-ask",
        name: "AI标签·求助降噪",
        preset: true,
        enabled: true,
        mode: "filter",
        when: { tagsAny: ["人工智能", "快问快答"], minAsk: 1 }
      },
      {
        id: "preset-account-ask",
        name: "账号/消费咨询降噪",
        preset: true,
        enabled: true,
        mode: "filter",
        when: { minAsk: 1, minBuzz: 1 }
      },
      {
        id: "preset-buzz-stack",
        name: "主题词堆叠降噪",
        preset: true,
        enabled: true,
        mode: "filter",
        when: { minBuzz: 2, titleMaxLen: 24 }
      },
      {
        id: "preset-short-ask",
        name: "短问句降噪（谨慎）",
        preset: true,
        enabled: false,
        mode: "filter",
        when: { categoryNames: ["开发调优", "搞七捻三"], minAsk: 1, titleMaxLen: 14 }
      },
      {
        id: "preset-shield-word",
        name: "优质信号保护高亮",
        preset: true,
        enabled: true,
        mode: "highlight",
        color: "#2f9e44",
        when: { minShield: 1 }
      },
      {
        id: "preset-shield-tag",
        name: "开源/教程标签保护高亮",
        preset: true,
        enabled: true,
        mode: "highlight",
        color: "#1971c2",
        when: { tagsAny: ["开源", "开源项目", "教程", "分享", "资源分享"] }
      }
    ];
  }
  function newRuleId() {
    return `rule-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  }

  // src/store.ts
  var KEY = "ldf_config_v1";
  var CONFIG_VERSION = 1;
  var cached = null;
  function readRaw() {
    try {
      if (typeof GM_getValue === "function") return GM_getValue(KEY, null);
    } catch {
    }
    try {
      const s = localStorage.getItem(KEY);
      return s ? JSON.parse(s) : null;
    } catch {
      return null;
    }
  }
  function writeRaw(cfg) {
    try {
      if (typeof GM_setValue === "function") {
        GM_setValue(KEY, cfg);
        return;
      }
    } catch {
    }
    try {
      localStorage.setItem(KEY, JSON.stringify(cfg));
    } catch {
    }
  }
  function normalizeExemptions(x) {
    const e = x ?? {};
    return {
      topicIds: Array.isArray(e.topicIds) ? e.topicIds.filter((n) => typeof n === "number") : [],
      titleKeywords: Array.isArray(e.titleKeywords) ? e.titleKeywords.filter((s) => typeof s === "string") : []
    };
  }
  function normalizeLexicons(x) {
    const def = defaultLexicons();
    const l = x ?? {};
    const pick = (v, d) => Array.isArray(v) && v.length ? v.filter((s) => typeof s === "string" && s.trim().length > 0) : d;
    return { ask: pick(l.ask, def.ask), buzz: pick(l.buzz, def.buzz), shield: pick(l.shield, def.shield) };
  }
  function normalizeRules(x) {
    const presets = defaultPresets();
    const raw = Array.isArray(x) ? x : [];
    const valid = raw.filter((r) => r && typeof r === "object" && typeof r.id === "string" && r.id.length > 0);
    const byId = new Map(valid.map((r) => [r.id, r]));
    for (const p of presets) {
      if (!byId.has(p.id)) valid.push(p);
    }
    return valid;
  }
  function createDefaultConfig() {
    return {
      version: CONFIG_VERSION,
      masterEnabled: true,
      debug: false,
      rules: defaultPresets(),
      lexicons: defaultLexicons(),
      exemptions: { topicIds: [], titleKeywords: [] }
    };
  }
  function loadConfig() {
    if (cached) return cached;
    const raw = readRaw();
    if (!raw || typeof raw !== "object") {
      cached = createDefaultConfig();
      return cached;
    }
    const r = raw;
    cached = {
      version: CONFIG_VERSION,
      masterEnabled: r.masterEnabled !== false,
      debug: r.debug === true,
      rules: normalizeRules(r.rules),
      lexicons: normalizeLexicons(r.lexicons),
      exemptions: normalizeExemptions(r.exemptions)
    };
    return cached;
  }
  function saveConfig() {
    if (cached) writeRaw(cached);
  }
  function getConfig() {
    return loadConfig();
  }
  function resetPresets() {
    const cfg = loadConfig();
    cfg.rules = [...cfg.rules.filter((r) => !r.preset), ...defaultPresets()];
    saveConfig();
  }
  function resetLexicons() {
    const cfg = loadConfig();
    cfg.lexicons = defaultLexicons();
    saveConfig();
  }
  function exportJSON() {
    return JSON.stringify(loadConfig(), null, 2);
  }
  function importJSON(text) {
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      return { ok: false, error: `JSON 解析失败：${e.message}` };
    }
    if (!parsed || typeof parsed !== "object") return { ok: false, error: "内容不是对象" };
    const r = parsed;
    if (!Array.isArray(r.rules) && !r.lexicons && !r.exemptions) {
      return { ok: false, error: "缺少 rules / lexicons / exemptions 字段" };
    }
    const cfg = loadConfig();
    if (Array.isArray(r.rules)) cfg.rules = normalizeRules(r.rules);
    if (r.lexicons) cfg.lexicons = normalizeLexicons(r.lexicons);
    if (r.exemptions) cfg.exemptions = normalizeExemptions(r.exemptions);
    if (typeof r.masterEnabled === "boolean") cfg.masterEnabled = r.masterEnabled;
    if (typeof r.debug === "boolean") cfg.debug = r.debug;
    saveConfig();
    return { ok: true };
  }

  // src/ui/common.ts
  function injectStyles(css) {
    let styleEl = null;
    try {
      styleEl = GM_addStyle(css);
    } catch {
      styleEl = null;
    }
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.textContent = css;
      (document.head || document.documentElement).appendChild(styleEl);
    }
  }
  function escHtml(s) {
    return String(s ?? "").replace(
      /[&<>"]/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]
    );
  }
  function escAttr(s) {
    return escHtml(s);
  }
  function toast(msg, ms = 2800) {
    let host2 = document.getElementById("ldf-toast-host");
    if (!host2) {
      host2 = document.createElement("div");
      host2.id = "ldf-toast-host";
      document.body.appendChild(host2);
    }
    const el = document.createElement("div");
    el.className = "ldf-toast";
    el.textContent = msg;
    host2.appendChild(el);
    requestAnimationFrame(() => el.classList.add("ldf-toast-in"));
    setTimeout(() => {
      el.classList.remove("ldf-toast-in");
      setTimeout(() => el.remove(), 250);
    }, ms);
  }
  function splitList(text) {
    return text.split(/[\n,，、]+/).map((s) => s.trim()).filter((s) => s.length > 0);
  }

  // src/ui/drawer.ts
  var drawer = null;
  function build() {
    if (drawer) return drawer;
    const el = document.createElement("div");
    el.id = "ldf-drawer";
    el.innerHTML = '<div class="ldf-drawer-overlay"></div><div class="ldf-drawer-panel"><div class="ldf-drawer-header"><span>已过滤 <b class="ldf-drawer-count">0</b></span><button class="ldf-drawer-close" type="button">×</button></div><div class="ldf-drawer-body"></div></div>';
    document.body.appendChild(el);
    drawer = el;
    el.querySelector(".ldf-drawer-overlay")?.addEventListener("click", closeDrawer);
    el.querySelector(".ldf-drawer-close")?.addEventListener("click", closeDrawer);
    return el;
  }
  function render() {
    if (!drawer) return;
    const entries = app().getFiltered();
    const map = app().getCatMap();
    drawer.querySelector(".ldf-drawer-count").textContent = String(entries.length);
    const body = drawer.querySelector(".ldf-drawer-body");
    if (!entries.length) {
      body.innerHTML = '<div class="ldf-drawer-empty">当前页面暂无被过滤的主题。</div>';
      return;
    }
    body.innerHTML = entries.map((e, i) => {
      const t = e.topic;
      const cat = categoryNameOf(map, t.category_id);
      const catLink = categoryHref(map, t.category_id);
      const tags = (t.tags || []).map((x) => `<span class="ldf-item-badge">${escHtml(x.name)}</span>`).join(" ");
      const replies = Math.max(0, (t.posts_count || 0) - 1);
      return '<div class="ldf-item" data-idx="' + i + '"><a class="ldf-item-title" target="_blank" rel="noopener" href="/t/topic/' + t.id + '/1">' + escHtml(t.title) + '</a><div class="ldf-item-meta"><a class="ldf-item-cat" href="' + catLink + '" target="_blank" rel="noopener">' + escHtml(cat) + "</a>" + tags + "<span>回复 " + replies + " · 浏览 " + (t.views || 0) + '</span></div><div class="ldf-item-reason">命中「' + escHtml(e.ruleName) + "」" + (e.reason ? ` · ${escHtml(e.reason)}` : "") + '</div><div class="ldf-item-actions"><button type="button" class="ldf-btn ldf-exempt" data-id="' + t.id + '">豁免此帖</button></div></div>';
    }).join("");
    body.querySelectorAll(".ldf-exempt").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = parseInt(btn.dataset.id || "", 10);
        if (Number.isFinite(id)) {
          app().exemptTopic(id);
          btn.disabled = true;
          btn.textContent = "已豁免";
        }
      });
    });
  }
  var savedOverflow = null;
  function openDrawer() {
    const el = build();
    render();
    el.classList.add("ldf-open");
    if (savedOverflow === null) savedOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    requestAnimationFrame(() => el.classList.add("ldf-on"));
  }
  function closeDrawer() {
    if (!drawer) return;
    drawer.classList.remove("ldf-on");
    if (savedOverflow !== null) {
      document.body.style.overflow = savedOverflow;
      savedOverflow = null;
    }
    setTimeout(() => {
      if (drawer && !drawer.classList.contains("ldf-on")) drawer.classList.remove("ldf-open");
    }, 200);
  }

  // src/ui/settings.ts
  var modal = null;
  var tab = "rules";
  var editing = null;
  var isNewRule = false;
  function parents() {
    const map = app().getCatMap();
    if (!map) return [];
    const out = [];
    map.byId.forEach((c) => {
      if (c.parentId === null) out.push(c);
    });
    out.sort((a, b) => a.name.localeCompare(b.name, "zh"));
    return out;
  }
  function summarize(rule) {
    const w = rule.when || {};
    const parts = [];
    if (w.categoryNames?.length) parts.push(`板块：${w.categoryNames.join("/")}`);
    if (w.tagsAny?.length) parts.push(`标签含：${w.tagsAny.join("/")}`);
    if (w.tagsNone?.length) parts.push(`标签不含：${w.tagsNone.join("/")}`);
    if (w.minAsk != null) parts.push(`提问词≥${w.minAsk}`);
    if (w.minBuzz != null) parts.push(`主题词≥${w.minBuzz}`);
    if (w.minShield != null) parts.push(`优质词≥${w.minShield}`);
    if (w.titleMinLen != null || w.titleMaxLen != null)
      parts.push(`标题长度 ${w.titleMinLen ?? 0}~${w.titleMaxLen ?? "∞"}`);
    if (w.titleRegexAny?.length) parts.push(`正则×${w.titleRegexAny.length}`);
    const scope = rule.scope;
    if (scope && scope.type !== "global") {
      const scopeText = scope.type === "home" ? "仅首页流" : "仅板块页" + ((scope.categoryIds || []).length ? `（${(scope.categoryIds || []).map((id) => categoryNameOf(app().getCatMap(), id)).join("/")}）` : "") + (scope.includeHome ? "+首页" : "");
      parts.push(`作用域：${scopeText}`);
    }
    return parts.join(" · ") || "无条件";
  }
  function buildModal() {
    if (modal) return modal;
    const el = document.createElement("div");
    el.id = "ldf-modal";
    document.body.appendChild(el);
    el.addEventListener("click", (e) => {
      if (e.target === el) closeSettings();
    });
    modal = el;
    return el;
  }
  function openSettings() {
    buildModal();
    tab = "rules";
    editing = null;
    renderBox();
    modal?.classList.add("ldf-open");
  }
  function closeSettings() {
    if (modal) modal.classList.remove("ldf-open");
  }
  function refreshAll() {
    app().save();
    renderBox();
    window.dispatchEvent(new Event("ldf:refresh"));
  }
  function renderBox() {
    if (!modal) return;
    const inEditor = editing !== null;
    modal.innerHTML = '<div class="ldf-modal-box">' + renderHeader() + (inEditor ? "" : renderTabs()) + '<div class="ldf-modal-body">' + (inEditor ? renderEditor() : tab === "rules" ? renderRulesTab() : tab === "lexicons" ? renderLexiconsTab() : renderDataTab()) + "</div>" + renderFooter(inEditor) + "</div>";
    bindBox(inEditor);
  }
  function renderHeader() {
    return '<div class="ldf-modal-header"><div><div class="ldf-modal-title">' + (editing ? isNewRule ? "新建规则" : "编辑规则" : "LinuxDo 智能降噪过滤器") + '</div><div class="ldf-modal-sub">' + (editing ? "配置匹配条件与作用范围" : "按板块 / 标签 / 标题内容分诊，命中保护信号的帖子不会被过滤") + '</div></div><button type="button" class="ldf-modal-close" data-act="close">✕</button></div>';
  }
  function renderTabs() {
    const t = (key, label) => '<button type="button" class="ldf-tab' + (tab === key ? " ldf-on" : "") + '" data-tab="' + key + '">' + label + "</button>";
    return `<div class="ldf-tabs">${t("rules", "规则")}${t("lexicons", "词库")}${t("data", "数据")}</div>`;
  }
  function renderRulesTab() {
    const cfg = getConfig();
    const errors = app().ruleErrors();
    const rows = cfg.rules.map((r, i) => {
      const err = errors.get(r.id);
      const modeChip = r.mode === "highlight" ? '<span class="ldf-chip ldf-highlight">保护</span><span class="ldf-dot" style="background:' + escAttr(r.color || "#2f9e44") + '"></span>' : '<span class="ldf-chip ldf-filter">过滤</span>';
      return '<div class="ldf-rule-row" data-id="' + escAttr(r.id) + '"><label class="ldf-switch"><input type="checkbox" data-act="toggle"' + (r.enabled ? " checked" : "") + '><span class="ldf-slider"></span></label><div class="ldf-rule-main"><div class="ldf-rule-name"><span class="ldf-chip">#' + (i + 1) + "</span>" + modeChip + escHtml(r.name) + (r.preset ? '<span class="ldf-chip">预设</span>' : "") + (err ? `<span class="ldf-chip ldf-err" title="${escAttr(err)}">⚠ ${escHtml(err)}</span>` : "") + '</div><div class="ldf-rule-sub">' + escHtml(summarize(r)) + '</div></div><button type="button" class="ldf-mini" data-act="up"' + (i === 0 ? " disabled" : "") + '>↑</button><button type="button" class="ldf-mini" data-act="down"' + (i === cfg.rules.length - 1 ? " disabled" : "") + '>↓</button><button type="button" class="ldf-btn" data-act="edit">编辑</button>' + (r.preset ? "" : '<button type="button" class="ldf-btn ldf-danger" data-act="del">删除</button>') + "</div>";
    }).join("");
    return '<div class="ldf-toolbar"><button type="button" class="ldf-btn ldf-primary" data-act="add">+ 新建规则</button><span class="ldf-spacer"></span><button type="button" class="ldf-btn" data-act="reset-presets">恢复默认预设</button></div>' + (rows || '<div class="ldf-drawer-empty">暂无规则</div>') + '<div class="ldf-hint">规则按顺序判定：保护（高亮）规则优先于过滤规则；顺序影响保护色的优先级。修改后点击右下角「刷新页面」完全生效。</div>';
  }
  function renderLexiconsTab() {
    const lex = getConfig().lexicons;
    return '<div class="ldf-field"><label>提问词库（每行一个，也支持逗号分隔）</label><textarea class="ldf-textarea" id="ldf-lex-ask">' + escHtml(lex.ask.join("\n")) + '</textarea><div class="ldf-hint">标题命中这些词视为「求助/咨询」信号，如：求助、请问、有没有、推荐……</div></div><div class="ldf-field"><label>主题词库（账号 / 消费 / 风控类）</label><textarea class="ldf-textarea" id="ldf-lex-buzz">' + escHtml(lex.buzz.join("\n")) + '</textarea><div class="ldf-hint">如：账号、额度、KYC、拼车、降智…… 与提问词组合时降噪效果最好。</div></div><div class="ldf-field"><label>保护词库（优质内容信号）</label><textarea class="ldf-textarea" id="ldf-lex-shield">' + escHtml(lex.shield.join("\n")) + '</textarea><div class="ldf-hint">标题命中这些词的帖子会被视为优质内容，任何可保护的过滤规则都不会误杀它，如：开源、教程、实测、避坑……</div></div><div class="ldf-inline"><button type="button" class="ldf-btn ldf-primary" data-act="save-lex">保存词库</button><button type="button" class="ldf-btn" data-act="reset-lex">恢复默认词库</button></div>';
  }
  function renderDataTab() {
    const cfg = getConfig();
    return '<div class="ldf-field"><label>导出配置</label><textarea class="ldf-textarea" id="ldf-export" readonly>' + escHtml(exportJSON()) + '</textarea><div class="ldf-inline"><button type="button" class="ldf-btn" data-act="copy-export">复制导出内容</button><span class="ldf-hint">可粘贴保存，或在其他浏览器 / 设备导入。</span></div></div><div class="ldf-field"><label>导入配置</label><textarea class="ldf-textarea" id="ldf-import" placeholder="粘贴导出的 JSON 后点击导入"></textarea><div class="ldf-inline"><button type="button" class="ldf-btn" data-act="import">导入并覆盖</button></div></div><div class="ldf-field"><label>豁免名单</label><div class="ldf-hint">被豁免的主题 ID（每行一个）：</div><textarea class="ldf-textarea" id="ldf-ex-ids" style="min-height:60px">' + escHtml((cfg.exemptions.topicIds || []).join("\n")) + '</textarea><div class="ldf-hint" style="margin-top:8px">标题关键词豁免（包含这些词的标题不会被过滤）：</div><textarea class="ldf-textarea" id="ldf-ex-words" style="min-height:60px">' + escHtml((cfg.exemptions.titleKeywords || []).join("\n")) + '</textarea><div class="ldf-inline" style="margin-top:8px"><button type="button" class="ldf-btn ldf-primary" data-act="save-ex">保存豁免名单</button><button type="button" class="ldf-btn" data-act="clear-ex">清空豁免</button></div></div>';
  }
  function renderEditor() {
    const r = editing;
    const w = r.when || {};
    const map = app().getCatMap();
    const parentList = parents();
    const catPicker = (cls, selected) => {
      if (!map) return '<div class="ldf-hint">板块映射未就绪（刷新页面后自动加载）</div>';
      return '<div class="ldf-cat-list">' + parentList.map(
        (c) => '<label class="ldf-cat-item"><input type="checkbox" class="' + cls + '" value="' + escAttr(c.name) + '"' + (selected.includes(c.name) ? " checked" : "") + ">" + escHtml(c.name) + "</label>"
      ).join("") + "</div>";
    };
    const scope = r.scope || { type: "global" };
    const scopeCatPicker = map && parentList.length ? '<div class="ldf-cat-list" id="ldf-e-scopecats" style="display:' + (scope.type === "category" ? "flex" : "none") + '">' + parentList.map(
      (c) => '<label class="ldf-cat-item"><input type="checkbox" class="ldf-e-scopecat" value="' + c.id + '"' + ((scope.categoryIds || []).includes(c.id) ? " checked" : "") + ">" + escHtml(c.name) + "</label>"
    ).join("") + '</div><label class="ldf-cat-item" id="ldf-e-includehome-wrap" style="display:' + (scope.type === "category" ? "inline-flex" : "none") + ';margin-top:6px"><input type="checkbox" id="ldf-e-includehome"' + (scope.includeHome ? " checked" : "") + "> 同时作用于首页流</label>" : "";
    return '<div class="ldf-field"><label>规则名称</label><input class="ldf-input" id="ldf-e-name" value="' + escAttr(r.name) + '" placeholder="例如：开发调优·求助降噪"></div><div class="ldf-field"><label>规则类型</label><div class="ldf-inline"><div class="ldf-seg"><label><input type="radio" name="ldf-e-mode" value="filter"' + (r.mode === "filter" ? " checked" : "") + '><span>过滤</span></label><label><input type="radio" name="ldf-e-mode" value="highlight"' + (r.mode === "highlight" ? " checked" : "") + '><span>保护高亮</span></label></div><label id="ldf-e-color-wrap" style="display:' + (r.mode === "highlight" ? "inline-flex" : "none") + ';align-items:center;gap:6px;font-size:13px">颜色 <input type="color" id="ldf-e-color" value="' + escAttr(r.color || RULE_COLORS[0]) + '"></label></div><div class="ldf-hint">过滤 = 从列表移除；保护高亮 = 永不误杀并标记颜色。</div></div><div class="ldf-field"><label>作用域（规则在哪些页面生效）</label><div class="ldf-inline"><div class="ldf-seg"><label><input type="radio" name="ldf-e-scope" value="global"' + (scope.type === "global" ? " checked" : "") + '><span>全局</span></label><label><input type="radio" name="ldf-e-scope" value="home"' + (scope.type === "home" ? " checked" : "") + '><span>仅首页流</span></label><label><input type="radio" name="ldf-e-scope" value="category"' + (scope.type === "category" ? " checked" : "") + "><span>指定板块页</span></label></div></div>" + scopeCatPicker + '</div><div class="ldf-field"><label>条件 · 所属板块（勾选后自动包含子板块）</label>' + catPicker("ldf-e-cat", w.categoryNames || []) + '</div><div class="ldf-field"><label>条件 · 标签</label><div class="ldf-inline"><input class="ldf-input" id="ldf-e-tagsany" style="flex:1;min-width:200px" placeholder="包含任一标签（逗号分隔），如：人工智能, 快问快答" value="' + escAttr((w.tagsAny || []).join(", ")) + '"><input class="ldf-input" id="ldf-e-tagsnone" style="flex:1;min-width:200px" placeholder="不包含标签（逗号分隔）" value="' + escAttr((w.tagsNone || []).join(", ")) + '"></div></div><div class="ldf-field"><label>条件 · 标题信号（留空 = 不限制）</label><div class="ldf-inline">提问词 ≥ <input class="ldf-input ldf-num" id="ldf-e-minask" type="number" min="0" value="' + escAttr(w.minAsk ?? "") + '">主题词 ≥ <input class="ldf-input ldf-num" id="ldf-e-minbuzz" type="number" min="0" value="' + escAttr(w.minBuzz ?? "") + '">优质词 ≥ <input class="ldf-input ldf-num" id="ldf-e-minshield" type="number" min="0" value="' + escAttr(w.minShield ?? "") + '">标题长度 <input class="ldf-input ldf-num" id="ldf-e-minlen" type="number" min="0" placeholder="最小" value="' + escAttr(w.titleMinLen ?? "") + '"> ~ <input class="ldf-input ldf-num" id="ldf-e-maxlen" type="number" min="0" placeholder="最大" value="' + escAttr(w.titleMaxLen ?? "") + '"></div><div class="ldf-hint">信号计数来自「词库」标签页中对应词库的命中数（去重后的词数）。</div></div><div class="ldf-field"><label>条件 · 标题正则（每行一条，满足任意一条即可）</label><textarea class="ldf-textarea" id="ldf-e-regex" placeholder="例如：^求推荐">' + escHtml((w.titleRegexAny || []).join("\n")) + '</textarea></div><div class="ldf-inline"><button type="button" class="ldf-btn ldf-primary" data-act="save-rule">保存规则</button><button type="button" class="ldf-btn" data-act="cancel-rule">取消</button>' + (isNewRule ? "" : '<button type="button" class="ldf-btn ldf-danger" data-act="del-in-editor">删除规则</button>') + "</div>";
  }
  function renderFooter(inEditor) {
    const cfg = getConfig();
    return '<div class="ldf-modal-footer"><div class="ldf-footer-left"><label class="ldf-cat-item"><input type="checkbox" id="ldf-f-master"' + (cfg.masterEnabled ? " checked" : "") + '> 启用降噪</label><label class="ldf-cat-item"><input type="checkbox" id="ldf-f-debug"' + (cfg.debug ? " checked" : "") + "> 调试日志</label></div>" + (inEditor ? "" : '<div class="ldf-inline"><button type="button" class="ldf-btn" data-act="reload">刷新页面</button><button type="button" class="ldf-btn ldf-primary" data-act="close">完成</button></div>') + "</div>";
  }
  function findRule(id) {
    return getConfig().rules.find((r) => r.id === id);
  }
  function bindBox(inEditor) {
    const box = modal;
    box.querySelector('[data-act="close"]')?.addEventListener("click", closeSettings);
    box.querySelectorAll("[data-tab]").forEach((b) => {
      b.addEventListener("click", () => {
        tab = b.dataset.tab;
        renderBox();
      });
    });
    box.querySelector("#ldf-f-master")?.addEventListener("change", (e) => {
      getConfig().masterEnabled = e.target.checked;
      app().save();
      toast(`降噪总开关已${e.target.checked ? "启用" : "关闭"}，刷新页面后生效`);
    });
    box.querySelector("#ldf-f-debug")?.addEventListener("change", (e) => {
      getConfig().debug = e.target.checked;
      app().save();
    });
    box.querySelector('[data-act="reload"]')?.addEventListener("click", () => location.reload());
    if (inEditor) {
      bindEditor();
      return;
    }
    if (tab === "rules") bindRulesTab();
    else if (tab === "lexicons") bindLexiconsTab();
    else bindDataTab();
  }
  function bindRulesTab() {
    const box = modal;
    box.querySelector('[data-act="add"]')?.addEventListener("click", () => {
      const hlCount = getConfig().rules.filter((r) => r.mode === "highlight").length;
      editing = {
        id: newRuleId(),
        name: "",
        mode: "filter",
        enabled: true,
        shieldable: true,
        scope: { type: "global" },
        when: {},
        color: RULE_COLORS[hlCount % RULE_COLORS.length]
      };
      isNewRule = true;
      renderBox();
    });
    box.querySelector('[data-act="reset-presets"]')?.addEventListener("click", () => {
      if (!confirm("将恢复全部预设为默认状态（自定义规则保留），确定？")) return;
      resetPresets();
      app().recompile();
      renderBox();
      toast("预设已恢复");
    });
    box.querySelectorAll(".ldf-rule-row").forEach((row) => {
      const id = row.dataset.id;
      row.querySelector('[data-act="toggle"]')?.addEventListener("change", (e) => {
        const r = findRule(id);
        if (r) {
          r.enabled = e.target.checked;
          app().save();
        }
      });
      row.querySelector('[data-act="edit"]')?.addEventListener("click", () => {
        const r = findRule(id);
        if (r) {
          editing = JSON.parse(JSON.stringify(r));
          isNewRule = false;
          renderBox();
        }
      });
      row.querySelector('[data-act="del"]')?.addEventListener("click", () => {
        const r = findRule(id);
        if (r && confirm(`删除规则「${r.name}」？`)) {
          const cfg = getConfig();
          cfg.rules = cfg.rules.filter((x) => x.id !== id);
          refreshAll();
        }
      });
      const move = (dir) => {
        const cfg = getConfig();
        const i = cfg.rules.findIndex((x) => x.id === id);
        const j = i + dir;
        if (i < 0 || j < 0 || j >= cfg.rules.length) return;
        const tmp = cfg.rules[i];
        cfg.rules[i] = cfg.rules[j];
        cfg.rules[j] = tmp;
        refreshAll();
      };
      row.querySelector('[data-act="up"]')?.addEventListener("click", () => move(-1));
      row.querySelector('[data-act="down"]')?.addEventListener("click", () => move(1));
    });
  }
  function bindEditor() {
    const box = modal;
    box.querySelectorAll('input[name="ldf-e-mode"]').forEach((radio) => {
      radio.addEventListener("change", () => {
        const wrap = box.querySelector("#ldf-e-color-wrap");
        if (wrap) wrap.style.display = radio.value === "highlight" && radio.checked ? "inline-flex" : "none";
      });
    });
    box.querySelectorAll('input[name="ldf-e-scope"]').forEach((radio) => {
      radio.addEventListener("change", () => {
        const isCat = (box.querySelector('input[name="ldf-e-scope"]:checked')?.value || "") === "category";
        const cats = box.querySelector("#ldf-e-scopecats");
        const home = box.querySelector("#ldf-e-includehome-wrap");
        if (cats) cats.style.display = isCat ? "flex" : "none";
        if (home) home.style.display = isCat ? "inline-flex" : "none";
      });
    });
    box.querySelector('[data-act="save-rule"]')?.addEventListener("click", saveEditor);
    box.querySelector('[data-act="cancel-rule"]')?.addEventListener("click", () => {
      editing = null;
      renderBox();
    });
    box.querySelector('[data-act="del-in-editor"]')?.addEventListener("click", () => {
      const id = editing?.id;
      if (!confirm(`删除规则「${editing?.name}」？`)) return;
      const cfg = getConfig();
      cfg.rules = cfg.rules.filter((x) => x.id !== id);
      app().recompile();
      editing = null;
      refreshAll();
    });
  }
  function saveEditor() {
    const box = modal;
    const name = (box.querySelector("#ldf-e-name")?.value || "").trim() || "未命名规则";
    const mode = box.querySelector('input[name="ldf-e-mode"]:checked')?.value || "filter";
    const color = box.querySelector("#ldf-e-color")?.value || RULE_COLORS[0];
    const scopeType = box.querySelector('input[name="ldf-e-scope"]:checked')?.value || "global";
    const scopeCats = Array.from(box.querySelectorAll(".ldf-e-scopecat:checked")).map(
      (i) => parseInt(i.value, 10)
    );
    const includeHome = box.querySelector("#ldf-e-includehome")?.checked === true;
    const when = {};
    const cats = Array.from(box.querySelectorAll(".ldf-e-cat:checked")).map((i) => i.value);
    if (cats.length) when.categoryNames = cats;
    const tagsAny = splitList(box.querySelector("#ldf-e-tagsany")?.value || "");
    if (tagsAny.length) when.tagsAny = tagsAny;
    const tagsNone = splitList(box.querySelector("#ldf-e-tagsnone")?.value || "");
    if (tagsNone.length) when.tagsNone = tagsNone;
    const num = (sel) => {
      const v = box.querySelector(sel)?.value;
      if (v == null || v === "") return void 0;
      const n = parseInt(v, 10);
      return Number.isFinite(n) && n >= 0 ? n : void 0;
    };
    const minAsk = num("#ldf-e-minask");
    if (minAsk != null) when.minAsk = minAsk;
    const minBuzz = num("#ldf-e-minbuzz");
    if (minBuzz != null) when.minBuzz = minBuzz;
    const minShield = num("#ldf-e-minshield");
    if (minShield != null) when.minShield = minShield;
    const minLen = num("#ldf-e-minlen");
    if (minLen != null) when.titleMinLen = minLen;
    const maxLen = num("#ldf-e-maxlen");
    if (maxLen != null) when.titleMaxLen = maxLen;
    const regexLines = (box.querySelector("#ldf-e-regex")?.value || "").split("\n").map((s) => s.trim()).filter((s) => s.length > 0);
    if (regexLines.length) {
      for (const line of regexLines) {
        try {
          new RegExp(line);
        } catch (e) {
          toast(`正则无效：${line}（${e.message}）`);
          return;
        }
      }
      when.titleRegexAny = regexLines;
    }
    const hasCondition = when.categoryNames && when.categoryNames.length > 0 || when.tagsAny && when.tagsAny.length > 0 || when.tagsNone && when.tagsNone.length > 0 || when.minAsk != null || when.minBuzz != null || when.minShield != null || when.titleMaxLen != null || when.titleMinLen != null || when.titleRegexAny && when.titleRegexAny.length > 0;
    if (!hasCondition) {
      toast("请至少设置一个匹配条件");
      return;
    }
    if (scopeType === "category" && scopeCats.length === 0 && !includeHome) {
      toast("作用域选择「指定板块页」时，至少勾选一个板块或勾选首页");
      return;
    }
    const rule = { ...editing, name, mode, color, when };
    if (scopeType === "global") rule.scope = { type: "global" };
    else if (scopeType === "home") rule.scope = { type: "home" };
    else rule.scope = { type: "category", categoryIds: scopeCats, includeHome };
    const cfg = getConfig();
    const idx = cfg.rules.findIndex((x) => x.id === rule.id);
    if (idx >= 0) cfg.rules[idx] = rule;
    else cfg.rules.push(rule);
    app().save();
    app().recompile();
    editing = null;
    isNewRule = false;
    renderBox();
    if (rule.preset) toast("预设已修改，刷新页面后生效");
    else toast("规则已保存，刷新页面后生效");
  }
  function bindLexiconsTab() {
    const box = modal;
    box.querySelector('[data-act="save-lex"]')?.addEventListener("click", () => {
      const cfg = getConfig();
      cfg.lexicons = {
        ask: splitList(box.querySelector("#ldf-lex-ask")?.value || ""),
        buzz: splitList(box.querySelector("#ldf-lex-buzz")?.value || ""),
        shield: splitList(box.querySelector("#ldf-lex-shield")?.value || "")
      };
      app().save();
      app().recompile();
      toast("词库已保存，刷新页面后生效");
    });
    box.querySelector('[data-act="reset-lex"]')?.addEventListener("click", () => {
      if (!confirm("恢复默认词库？当前词库修改将丢失。")) return;
      resetLexicons();
      app().recompile();
      renderBox();
      toast("词库已恢复默认");
    });
  }
  function bindDataTab() {
    const box = modal;
    box.querySelector('[data-act="copy-export"]')?.addEventListener("click", async () => {
      const ta = box.querySelector("#ldf-export");
      if (!ta) return;
      ta.select();
      try {
        const ok = document.execCommand("copy");
        if (ok) {
          toast("已复制到剪贴板");
          return;
        }
      } catch {
      }
      try {
        await navigator.clipboard.writeText(ta.value);
        toast("已复制到剪贴板");
      } catch {
        toast("复制失败，请手动全选复制");
      }
    });
    box.querySelector('[data-act="import"]')?.addEventListener("click", () => {
      const text = box.querySelector("#ldf-import")?.value || "";
      if (!text.trim()) {
        toast("请先粘贴 JSON");
        return;
      }
      const r = importJSON(text);
      if (!r.ok) {
        toast(`导入失败：${r.error}`);
        return;
      }
      app().recompile();
      renderBox();
      toast("配置已导入，刷新页面后生效");
    });
    box.querySelector('[data-act="save-ex"]')?.addEventListener("click", () => {
      const cfg = getConfig();
      cfg.exemptions.topicIds = splitList(box.querySelector("#ldf-ex-ids")?.value || "").map((s) => parseInt(s, 10)).filter((n) => Number.isFinite(n));
      cfg.exemptions.titleKeywords = splitList(box.querySelector("#ldf-ex-words")?.value || "");
      app().save();
      toast("豁免名单已保存");
    });
    box.querySelector('[data-act="clear-ex"]')?.addEventListener("click", () => {
      const cfg = getConfig();
      cfg.exemptions = { topicIds: [], titleKeywords: [] };
      app().save();
      renderBox();
      toast("豁免已清空");
    });
  }

  // src/ui/styles.ts
  var CSS = `
:root {
  --ldf-bg: #ffffff;
  --ldf-fg: #1f2328;
  --ldf-muted: #6b7280;
  --ldf-border: #e5e7eb;
  --ldf-accent: #2563eb;
  --ldf-danger: #dc2626;
  --ldf-chip: #f3f4f6;
  --ldf-shadow: 0 12px 40px rgba(0,0,0,.18);
}
@media (prefers-color-scheme: dark) {
  :root {
    --ldf-bg: #1b1d21;
    --ldf-fg: #e6e8eb;
    --ldf-muted: #9aa1ab;
    --ldf-border: #34383f;
    --ldf-accent: #4f8dfd;
    --ldf-danger: #f87171;
    --ldf-chip: #2a2e34;
    --ldf-shadow: 0 12px 40px rgba(0,0,0,.55);
  }
}
.ldf-topbar-mount { display: inline-flex; align-items: center; list-style: none; }
.ldf-topbar-mount.ldf-floating { position: fixed; right: 14px; bottom: 14px; z-index: 99990; background: var(--ldf-bg); border: 1px solid var(--ldf-border); border-radius: 999px; padding: 6px 8px; box-shadow: var(--ldf-shadow); }
.ldf-topbar-group { display: inline-flex; align-items: center; gap: 6px; }
.ldf-btn { font: inherit; font-size: 13px; color: var(--ldf-fg); background: var(--ldf-bg); border: 1px solid var(--ldf-border); border-radius: 8px; padding: 5px 10px; cursor: pointer; }
.ldf-btn:hover { border-color: var(--ldf-accent); }
.ldf-btn.ldf-primary { background: var(--ldf-accent); border-color: var(--ldf-accent); color: #fff; }
.ldf-btn.ldf-danger { color: var(--ldf-danger); }
.ldf-icon-btn { width: 32px; height: 32px; display: inline-flex; align-items: center; justify-content: center; border-radius: 50%; border: 1px solid transparent; background: transparent; color: var(--ldf-fg); cursor: pointer; }
.ldf-icon-btn:hover { background: var(--ldf-chip); }
.ldf-count-btn { font: inherit; font-size: 12.5px; color: var(--ldf-fg); background: var(--ldf-chip); border: 1px solid var(--ldf-border); border-radius: 999px; padding: 4px 12px; cursor: pointer; white-space: nowrap; }
.ldf-count-btn:hover { border-color: var(--ldf-accent); }
#ldf-drawer { position: fixed; inset: 0; z-index: 99995; display: none; }
#ldf-drawer.ldf-open { display: block; }
.ldf-drawer-overlay { position: absolute; inset: 0; background: rgba(0,0,0,.4); opacity: 0; transition: opacity .18s; }
#ldf-drawer.ldf-on .ldf-drawer-overlay { opacity: 1; }
.ldf-drawer-panel { position: absolute; top: 0; right: 0; bottom: 0; width: min(440px, 100vw); background: var(--ldf-bg); color: var(--ldf-fg); box-shadow: var(--ldf-shadow); display: flex; flex-direction: column; transform: translateX(24px); opacity: 0; transition: transform .18s, opacity .18s; }
#ldf-drawer.ldf-on .ldf-drawer-panel { transform: none; opacity: 1; }
.ldf-drawer-header { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; border-bottom: 1px solid var(--ldf-border); font-size: 15px; }
.ldf-drawer-header b { color: var(--ldf-accent); }
.ldf-drawer-close { border: 0; background: transparent; color: var(--ldf-muted); font-size: 20px; cursor: pointer; line-height: 1; }
.ldf-drawer-body { flex: 1; overflow-y: auto; padding: 8px 0; }
.ldf-drawer-empty { padding: 32px 16px; text-align: center; color: var(--ldf-muted); font-size: 14px; }
.ldf-item { padding: 10px 16px; border-bottom: 1px solid var(--ldf-border); }
.ldf-item-title { color: var(--ldf-fg); font-size: 14px; font-weight: 600; text-decoration: none; line-height: 1.45; display: block; }
.ldf-item-title:hover { color: var(--ldf-accent); }
.ldf-item-meta { margin-top: 4px; font-size: 12px; color: var(--ldf-muted); display: flex; flex-wrap: wrap; gap: 4px 8px; align-items: center; }
.ldf-item-meta a { color: var(--ldf-muted); text-decoration: none; }
.ldf-item-cat { border: 1px solid var(--ldf-border); border-radius: 4px; padding: 0 5px; }
.ldf-item-reason { margin-top: 5px; font-size: 12px; color: var(--ldf-muted); background: var(--ldf-chip); border-radius: 6px; padding: 4px 8px; display: inline-block; }
.ldf-item-actions { margin-top: 6px; display: flex; gap: 8px; }
.ldf-item-actions .ldf-btn { font-size: 12px; padding: 3px 8px; }
.ldf-item-badge { font-size: 11px; border-radius: 4px; padding: 0 4px; background: var(--ldf-chip); }
#ldf-modal { position: fixed; inset: 0; z-index: 99999; display: none; background: rgba(0,0,0,.45); align-items: flex-start; justify-content: center; padding: 36px 14px 14px; overflow-y: auto; }
#ldf-modal.ldf-open { display: flex; }
.ldf-modal-box { width: min(760px, 100%); background: var(--ldf-bg); color: var(--ldf-fg); border-radius: 14px; box-shadow: var(--ldf-shadow); display: flex; flex-direction: column; max-height: calc(100vh - 60px); overflow: hidden; }
.ldf-modal-header { display: flex; align-items: center; justify-content: space-between; padding: 14px 18px; border-bottom: 1px solid var(--ldf-border); }
.ldf-modal-title { font-size: 16px; font-weight: 700; }
.ldf-modal-sub { font-size: 12px; color: var(--ldf-muted); margin-top: 2px; }
.ldf-modal-close { border: 0; background: transparent; color: var(--ldf-muted); font-size: 20px; cursor: pointer; line-height: 1; }
.ldf-tabs { display: flex; gap: 4px; padding: 10px 18px 0; border-bottom: 1px solid var(--ldf-border); }
.ldf-tab { border: 0; background: transparent; color: var(--ldf-muted); font: inherit; font-size: 13.5px; padding: 8px 12px; cursor: pointer; border-bottom: 2px solid transparent; }
.ldf-tab.ldf-on { color: var(--ldf-accent); border-bottom-color: var(--ldf-accent); }
.ldf-modal-body { padding: 14px 18px; overflow-y: auto; }
.ldf-toolbar { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-bottom: 12px; }
.ldf-toolbar .ldf-spacer { flex: 1; }
.ldf-rule-row { display: flex; align-items: center; gap: 10px; padding: 10px 10px; border: 1px solid var(--ldf-border); border-radius: 10px; margin-bottom: 8px; flex-wrap: wrap; }
.ldf-rule-main { flex: 1; min-width: 200px; }
.ldf-rule-name { font-size: 14px; font-weight: 600; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.ldf-rule-sub { font-size: 12px; color: var(--ldf-muted); margin-top: 3px; word-break: break-all; }
.ldf-chip { font-size: 11px; border-radius: 5px; padding: 1px 6px; background: var(--ldf-chip); color: var(--ldf-muted); }
.ldf-chip.ldf-filter { color: #b45309; }
.ldf-chip.ldf-highlight { color: #15803d; }
.ldf-chip.ldf-err { color: var(--ldf-danger); }
.ldf-dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; }
.ldf-switch { position: relative; width: 36px; height: 20px; flex: none; }
.ldf-switch input { opacity: 0; width: 0; height: 0; }
.ldf-slider { position: absolute; inset: 0; background: var(--ldf-chip); border: 1px solid var(--ldf-border); border-radius: 999px; cursor: pointer; transition: background .15s; }
.ldf-slider::after { content: ''; position: absolute; top: 2px; left: 2px; width: 14px; height: 14px; border-radius: 50%; background: var(--ldf-muted); transition: transform .15s, background .15s; }
.ldf-switch input:checked + .ldf-slider { background: color-mix(in srgb, var(--ldf-accent) 30%, transparent); border-color: var(--ldf-accent); }
.ldf-switch input:checked + .ldf-slider::after { transform: translateX(16px); background: var(--ldf-accent); }
.ldf-mini { border: 1px solid var(--ldf-border); background: var(--ldf-bg); color: var(--ldf-muted); border-radius: 6px; width: 26px; height: 26px; cursor: pointer; font-size: 12px; }
.ldf-mini:hover { color: var(--ldf-accent); border-color: var(--ldf-accent); }
.ldf-mini:disabled { opacity: .35; cursor: default; }
.ldf-field { margin-bottom: 14px; }
.ldf-field > label { display: block; font-size: 13px; font-weight: 600; margin-bottom: 6px; }
.ldf-hint { font-size: 12px; color: var(--ldf-muted); margin-top: 4px; line-height: 1.5; }
.ldf-input, .ldf-select, .ldf-textarea { width: 100%; box-sizing: border-box; font: inherit; font-size: 13.5px; color: var(--ldf-fg); background: var(--ldf-bg); border: 1px solid var(--ldf-border); border-radius: 8px; padding: 7px 10px; }
.ldf-textarea { min-height: 90px; resize: vertical; font-family: ui-monospace, monospace; font-size: 12.5px; line-height: 1.6; }
.ldf-input:focus, .ldf-select:focus, .ldf-textarea:focus { outline: none; border-color: var(--ldf-accent); }
.ldf-inline { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
.ldf-inline .ldf-num { width: 76px; }
.ldf-cat-list { display: flex; flex-wrap: wrap; gap: 6px 14px; padding: 8px 10px; border: 1px solid var(--ldf-border); border-radius: 8px; max-height: 160px; overflow-y: auto; }
.ldf-cat-item { font-size: 13px; display: inline-flex; align-items: center; gap: 5px; }
.ldf-seg { display: inline-flex; border: 1px solid var(--ldf-border); border-radius: 8px; overflow: hidden; }
.ldf-seg label { font-size: 13px; padding: 5px 12px; cursor: pointer; color: var(--ldf-muted); }
.ldf-seg input { display: none; }
.ldf-seg input:checked + span { color: var(--ldf-accent); font-weight: 600; }
.ldf-seg label:has(input:checked) { background: var(--ldf-chip); }
.ldf-modal-footer { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 12px 18px; border-top: 1px solid var(--ldf-border); flex-wrap: wrap; }
.ldf-footer-left { font-size: 12px; color: var(--ldf-muted); display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
#ldf-toast-host { position: fixed; left: 50%; bottom: 40px; transform: translateX(-50%); z-index: 100000; display: flex; flex-direction: column; gap: 8px; align-items: center; pointer-events: none; }
.ldf-toast { background: #111827; color: #f9fafb; font-size: 13px; border-radius: 8px; padding: 9px 14px; opacity: 0; transform: translateY(8px); transition: opacity .2s, transform .2s; max-width: min(560px, 90vw); }
.ldf-toast.ldf-toast-in { opacity: 1; transform: none; }
tr.ldf-highlight > td { box-shadow: inset 3px 0 0 var(--ldf-hl, #2f9e44); }
tr.ldf-highlight .title { color: inherit; }
.ldf-selfempty td { padding: 26px 12px !important; text-align: center; color: var(--ldf-muted); font-size: 13.5px; }
.ldf-selfempty a { color: var(--ldf-accent); margin-left: 6px; }
@media (max-width: 640px) {
  #ldf-modal { padding: 0; }
  .ldf-modal-box { max-height: 100vh; min-height: 100vh; border-radius: 0; width: 100%; }
  .ldf-drawer-panel { width: 100vw; }
}
`;

  // src/ui/topbar.ts
  var GEAR_SVG = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>';
  var group = null;
  var mountEl = null;
  var countBtn = null;
  var floating = false;
  function findHeaderContainer() {
    const candidates = [
      "ul.d-header-icons",
      ".d-header .header-buttons",
      ".d-header .icons",
      ".d-header-icons",
      ".header-buttons"
    ];
    for (const sel of candidates) {
      const el = document.querySelector(sel);
      if (el && el.getBoundingClientRect().width > 0) return el;
    }
    for (const sel of candidates) {
      const el = document.querySelector(sel);
      if (el) return el;
    }
    return null;
  }
  function buildGroup() {
    if (group) return;
    group = document.createElement("div");
    group.className = "ldf-topbar-group";
    const gear = document.createElement("button");
    gear.type = "button";
    gear.className = "ldf-icon-btn";
    gear.title = "LinuxDo 智能降噪设置";
    gear.setAttribute("aria-label", "设置");
    gear.innerHTML = GEAR_SVG;
    gear.addEventListener("click", () => app().openSettings());
    countBtn = document.createElement("button");
    countBtn.type = "button";
    countBtn.className = "ldf-count-btn";
    countBtn.addEventListener("click", () => {
      const page = getCurrentPage();
      if (isFilterablePage(page)) app().openDrawer();
      else app().openSettings();
    });
    group.appendChild(gear);
    group.appendChild(countBtn);
  }
  function debugLog(...args) {
    try {
      if (app().getConfig().debug) console.log("%c[LD-SF]", "color:#3aa", ...args);
    } catch {
    }
  }
  function makeMount(isLi) {
    const el = document.createElement(isLi ? "li" : "div");
    el.className = "ldf-topbar-mount";
    if (group) el.appendChild(group);
    return el;
  }
  function mountTo(container) {
    if (container) {
      mountEl = makeMount(container instanceof HTMLUListElement);
      container.appendChild(mountEl);
      if (floating) {
        floating = false;
        mountEl.classList.remove("ldf-floating");
      }
      debugLog("顶栏按钮已挂载到站点导航栏");
    } else {
      if (!mountEl) mountEl = makeMount(false);
      floating = true;
      mountEl.classList.add("ldf-floating");
      (document.body || document.documentElement).appendChild(mountEl);
      debugLog("未找到可见的站点导航栏，顶栏按钮使用浮动模式");
    }
    updateCount();
    requestAnimationFrame(() => {
      if (!mountEl || floating) return;
      const rect = mountEl.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) {
        floating = true;
        mountEl.classList.add("ldf-floating");
        (document.body || document.documentElement).appendChild(mountEl);
        debugLog("导航栏容器不可见，顶栏按钮切换为浮动模式");
      }
    });
  }
  function ensureTopbar() {
    try {
      buildGroup();
      const container = findHeaderContainer();
      const targetContainer = container && container.getBoundingClientRect().width > 0 ? container : null;
      const alreadyMounted = mountEl !== null && document.contains(mountEl) && (targetContainer ? mountEl.parentElement === targetContainer : mountEl.parentElement === document.body && floating);
      if (alreadyMounted) {
        updateCount();
        return;
      }
      mountEl?.remove();
      mountTo(targetContainer);
    } catch (e) {
      console.error("[LD-SF] 挂载顶栏按钮失败", e);
    }
  }
  function updateCount() {
    if (!countBtn) return;
    syncCurrentPage();
    const page = getCurrentPage();
    const n = filteredCount();
    countBtn.textContent = isFilterablePage(page) ? `已过滤 (${n})` : "LinuxDo 降噪";
    countBtn.title = isFilterablePage(page) ? "查看本页被过滤的主题" : "打开降噪设置";
  }
  function onSelfEmpty(e) {
    const detail = e.detail;
    const tryInsert = () => {
      const body = document.querySelector(".topic-list-body");
      if (!body || body.querySelector(".ldf-selfempty")) return;
      const rows = body.querySelectorAll("tr[data-topic-id]");
      const allHidden = rows.length > 0 && Array.from(rows).every((r) => r.style.display === "none" || r.dataset.ldfHidden === "1");
      if (!allHidden && body.children.length > 0) {
        setTimeout(tryInsert, 300);
        return;
      }
      const tr = document.createElement("tr");
      tr.className = "ldf-selfempty";
      tr.innerHTML = '<td colspan="5">本页 ' + escHtml(detail.count) + ' 条主题全部被过滤。<a href="#" class="ldf-open-drawer">查看已过滤</a></td>';
      body.appendChild(tr);
      tr.querySelector(".ldf-open-drawer")?.addEventListener("click", (ev) => {
        ev.preventDefault();
        app().openDrawer();
      });
    };
    tryInsert();
  }
  function installTopbarListeners() {
    window.addEventListener("ldf:self-empty", onSelfEmpty);
    window.addEventListener("ldf:refresh", updateCount);
    const remountIfLost = () => {
      if (!mountEl || !document.contains(mountEl)) ensureTopbar();
    };
    let raf = 0;
    const startObserving = () => {
      const mo = new MutationObserver(() => {
        if (raf) return;
        raf = requestAnimationFrame(() => {
          raf = 0;
          remountIfLost();
        });
      });
      mo.observe(document.body, { childList: true, subtree: true });
    };
    if (document.body) startObserving();
    else document.addEventListener("DOMContentLoaded", startObserving, { once: true });
    setInterval(ensureTopbar, 3e3);
  }

  // src/main.ts
  var catMap = null;
  var compiled = { rules: [], errors: /* @__PURE__ */ new Map() };
  function recompile() {
    const cfg = getConfig();
    compiled = compileRules(cfg.masterEnabled ? cfg.rules : [], catMap);
  }
  function boot() {
    injectStyles(CSS);
    loadConfig();
    recompile();
    const appImpl = {
      getConfig,
      save() {
        saveConfig();
        recompile();
        updateCount();
      },
      recompile,
      getCatMap: () => catMap,
      getFiltered: () => currentFilteredEntries(),
      exemptTopic(id) {
        const cfg = getConfig();
        if (!cfg.exemptions.topicIds.includes(id)) cfg.exemptions.topicIds.push(id);
        saveConfig();
        toast("已豁免此帖：下次刷新后不再被过滤");
      },
      openDrawer,
      openSettings,
      toast,
      refreshCount: () => updateCount(),
      ruleErrors: () => compiled.errors
    };
    setApp(appImpl);
    const host2 = {
      getConfig,
      getState: () => compiled,
      getCatMap: () => catMap,
      setCatMap(m) {
        catMap = m;
      },
      onCatMapReady() {
        recompile();
      },
      onBucketChange() {
        updateCount();
      },
      log: (...args) => {
        if (getConfig().debug) console.log("%c[LD-SF]", "color:#3aa", ...args);
      }
    };
    installTopbarListeners();
    void installInterceptors(host2);
    const onReady = () => {
      syncCurrentPage();
      ensureTopbar();
      if (getConfig().debug) console.log("%c[LD-SF]", "color:#3aa", `启动完成 v${"0.1.0"}`);
    };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", onReady, { once: true });
    else onReady();
    try {
      GM_registerMenuCommand("打开 LinuxDo 智能降噪设置", openSettings);
      GM_registerMenuCommand("查看已过滤列表", openDrawer);
      GM_registerMenuCommand("暂停 / 启用降噪", () => {
        const cfg = getConfig();
        cfg.masterEnabled = !cfg.masterEnabled;
        saveConfig();
        recompile();
        updateCount();
        toast(`降噪已${cfg.masterEnabled ? "启用" : "暂停"}，刷新页面后生效`);
      });
    } catch {
    }
  }
  boot();
})();
