(function () {
  "use strict";

  const script = document.currentScript;
  const currentLibrary = script?.dataset.library || "";
  const caseMap = window.__CASE_MAP__;

  if (!script || !caseMap?.libraries?.[currentLibrary]) return;

  const suiteRoot = new URL(".", script.src);
  const detailConfig = caseMap.details || {};
  const detailBase = detailConfig.base || "case-graph-shards";
  const detailVersion = detailConfig.version || "";
  const bucketChars = Number(detailConfig.bucketChars) || 2;
  const defaultRelatedLibrary = Object.freeze({
    demand: "traffic",
    traffic: "marketing",
    marketing: "monetization",
    monetization: "barrier",
    barrier: "case",
    case: "barrier",
  });
  const matchLabels = Object.freeze({
    "provided-entity-id": "已确认实体 ID",
    "relative-path-exact-title": "同源路径 · 标题一致",
    "relative-path-token-overlap": "同源路径 · 关键词匹配",
    "source-file-exact-title": "同名文件 · 标题一致",
    "source-file-token-overlap": "同名文件 · 关键词匹配",
    "title-only-exact": "标题一致",
    "single-library": "当前仅在一个库中收录",
  });
  const state = {
    activeEntityId: "",
    trigger: null,
    observer: null,
    openInline: null,
    shardPromises: new Map(),
  };
  const elements = {};

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }

  function init() {
    createDrawer();
    bindEvents();
    observeCards();
    decorateCards(document);
    openDeepLink();
  }

  function createDrawer() {
    const backdrop = document.createElement("div");
    backdrop.className = "case-bridge-backdrop";
    backdrop.hidden = true;

    const drawer = document.createElement("aside");
    drawer.className = "case-bridge-drawer";
    drawer.hidden = true;
    drawer.setAttribute("role", "dialog");
    drawer.setAttribute("aria-modal", "true");
    drawer.setAttribute("aria-hidden", "true");
    drawer.setAttribute("aria-labelledby", "caseBridgeTitle");

    const header = document.createElement("header");
    header.className = "case-bridge-header";
    const heading = document.createElement("div");
    heading.className = "case-bridge-heading";
    heading.append(createText("span", "案例全景", "case-bridge-kicker"));
    const title = createText("h2", "", "case-bridge-title");
    title.id = "caseBridgeTitle";
    heading.append(title);

    const closeButton = createText("button", "×", "case-bridge-close");
    closeButton.type = "button";
    closeButton.title = "关闭案例全景";
    closeButton.setAttribute("aria-label", "关闭案例全景");
    header.append(heading, closeButton);

    const body = document.createElement("div");
    body.className = "case-bridge-body";
    const status = createText("div", "", "case-bridge-status");
    status.setAttribute("aria-live", "polite");
    const dimensions = document.createElement("div");
    dimensions.className = "case-bridge-dimensions";
    const related = document.createElement("section");
    related.className = "case-bridge-related";
    body.append(status, dimensions, related);

    drawer.append(header, body);
    document.body.append(backdrop, drawer);
    Object.assign(elements, { backdrop, drawer, closeButton, title, status, dimensions, related });
  }

  function bindEvents() {
    document.addEventListener("click", (event) => {
      const inlineToggle = event.target.closest("[data-case-inline-toggle]");
      if (inlineToggle) {
        event.preventDefault();
        toggleInline(inlineToggle);
        return;
      }

      const inlineTab = event.target.closest("[data-case-inline-dimension]");
      if (inlineTab) {
        const panel = inlineTab.closest(".case-bridge-inline-panel");
        const entity = getEntity(panel?.dataset.caseEntity || "");
        if (panel && entity) renderInlineDimension(panel, entity, inlineTab.dataset.caseInlineDimension);
        return;
      }

      const trigger = event.target.closest("[data-case-bridge-trigger]");
      if (trigger) {
        event.preventDefault();
        state.trigger = trigger;
        openEntity(trigger.dataset.caseEntity);
        return;
      }

      const relatedButton = event.target.closest("[data-case-related]");
      if (relatedButton && elements.drawer.contains(relatedButton)) {
        openEntity(relatedButton.dataset.caseRelated);
        return;
      }

      const currentButton = event.target.closest("[data-case-locate]");
      if (currentButton && elements.drawer.contains(currentButton)) {
        locateCurrentEntity(currentButton.dataset.caseLocate, true);
      }
    });

    elements.closeButton.addEventListener("click", closeDrawer);
    elements.backdrop.addEventListener("click", closeDrawer);
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !elements.drawer.hidden) closeDrawer();
    });
  }

  function observeCards() {
    state.observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) decorateCards(node);
        });
      });
    });
    state.observer.observe(document.body, { childList: true, subtree: true });
  }

  function decorateCards(root) {
    const cards = [];
    if (root.matches?.(".case-card[data-case-record]")) cards.push(root);
    root.querySelectorAll?.(".case-card[data-case-record]").forEach((card) => cards.push(card));

    cards.forEach((card) => {
      if (card.dataset.caseBridgeReady === "true") return;
      card.dataset.caseBridgeReady = "true";

      const recordIndex = Number(card.dataset.caseRecord);
      const entityId = caseMap.recordToEntity?.[currentLibrary]?.[recordIndex];
      if (!entityId) return;

      const mask = caseMap.entityMask?.[entityId] || 0;
      const dimensionCount = countBits(mask);
      card.dataset.caseEntity = entityId;

      const section = document.createElement("section");
      section.className = "case-bridge-card";
      section.dataset.caseEntity = entityId;
      section.setAttribute("aria-label", "六库联动");

      const bar = document.createElement("div");
      bar.className = "case-bridge-card-bar";
      bar.append(createDimensionRail(mask));

      const actions = document.createElement("div");
      actions.className = "case-bridge-card-actions";
      const panelId = `caseBridgeInline-${currentLibrary}-${recordIndex}`;
      const inlineButton = createText("button", "展开关联", "case-bridge-inline-toggle");
      inlineButton.type = "button";
      inlineButton.dataset.caseInlineToggle = "true";
      inlineButton.dataset.caseEntity = entityId;
      inlineButton.setAttribute("aria-expanded", "false");
      inlineButton.setAttribute("aria-controls", panelId);
      inlineButton.title = "在当前卡片内查看其他库的关联摘要";

      const panoramaButton = document.createElement("button");
      panoramaButton.type = "button";
      panoramaButton.className = "case-bridge-trigger";
      panoramaButton.dataset.caseBridgeTrigger = "true";
      panoramaButton.dataset.caseEntity = entityId;
      panoramaButton.setAttribute("aria-haspopup", "dialog");
      panoramaButton.title = `查看该案例的 ${dimensionCount} 个知识维度`;
      panoramaButton.append(createText("span", "全景"), createText("b", `${dimensionCount}/6`));
      actions.append(inlineButton, panoramaButton);
      bar.append(actions);

      const panel = document.createElement("div");
      panel.id = panelId;
      panel.className = "case-bridge-inline-panel";
      panel.dataset.caseEntity = entityId;
      panel.hidden = true;
      section.append(bar, panel);

      const host = card.querySelector(":scope > .card-inner") || card;
      host.append(section);
    });
  }

  function createDimensionRail(mask) {
    const rail = document.createElement("div");
    rail.className = "case-bridge-rail";
    rail.setAttribute("aria-label", `已关联 ${countBits(mask)} 个知识维度`);
    caseMap.order.forEach((libraryKey, index) => {
      const library = caseMap.libraries[libraryKey];
      const available = Boolean(mask & (1 << index));
      const item = document.createElement("span");
      item.className = "case-bridge-rail-item";
      item.classList.toggle("is-available", available);
      item.classList.toggle("is-current", libraryKey === currentLibrary);
      item.style.setProperty("--case-bridge-color", library.color);
      item.title = `${library.label}：${available ? "已关联" : "暂无记录"}`;
      item.append(createText("i", ""), createText("span", library.label));
      rail.append(item);
    });
    return rail;
  }

  async function toggleInline(button) {
    const section = button.closest(".case-bridge-card");
    const panel = section?.querySelector(".case-bridge-inline-panel");
    if (!section || !panel) return;

    if (button.getAttribute("aria-expanded") === "true") {
      closeInline(section);
      return;
    }
    if (state.openInline?.isConnected) closeInline(state.openInline);

    state.openInline = section;
    section.classList.add("is-open");
    button.setAttribute("aria-expanded", "true");
    button.textContent = "收起关联";
    panel.hidden = false;
    panel.replaceChildren(createText("p", "正在读取关联摘要…", "case-bridge-inline-loading"));

    try {
      const entity = await loadEntity(button.dataset.caseEntity);
      if (button.getAttribute("aria-expanded") !== "true" || !section.isConnected) return;
      renderInlinePanel(panel, entity);
    } catch (error) {
      panel.replaceChildren(createText("p", error instanceof Error ? error.message : String(error), "case-bridge-inline-error"));
    }
  }

  function closeInline(section) {
    const button = section?.querySelector("[data-case-inline-toggle]");
    const panel = section?.querySelector(".case-bridge-inline-panel");
    section?.classList.remove("is-open");
    if (button) {
      button.setAttribute("aria-expanded", "false");
      button.textContent = "展开关联";
    }
    if (panel) panel.hidden = true;
    if (state.openInline === section) state.openInline = null;
  }

  function renderInlinePanel(panel, entity) {
    const match = createText("p", formatMatchLabel(entity), "case-bridge-inline-match");
    const tabs = document.createElement("div");
    tabs.className = "case-bridge-inline-tabs";
    tabs.setAttribute("role", "tablist");
    tabs.setAttribute("aria-label", "选择知识维度");

    caseMap.order.forEach((libraryKey) => {
      const library = caseMap.libraries[libraryKey];
      const count = entity.dimensions?.[libraryKey]?.length || 0;
      const tab = createText("button", `${library.label} ${count}`, "case-bridge-inline-tab");
      tab.type = "button";
      tab.dataset.caseInlineDimension = libraryKey;
      tab.setAttribute("role", "tab");
      tab.setAttribute("aria-selected", "false");
      tab.disabled = count === 0;
      tab.style.setProperty("--case-bridge-color", library.color);
      tabs.append(tab);
    });

    const body = document.createElement("div");
    body.className = "case-bridge-inline-body";
    panel.replaceChildren(match, tabs, body);
    const initialLibrary = pickInitialLibrary(entity);
    renderInlineDimension(panel, entity, initialLibrary);
  }

  function pickInitialLibrary(entity) {
    const preferred = defaultRelatedLibrary[currentLibrary];
    if (entity.dimensions?.[preferred]?.length) return preferred;
    return caseMap.order.find((libraryKey) => (
      libraryKey !== currentLibrary && entity.dimensions?.[libraryKey]?.length
    )) || currentLibrary;
  }

  function renderInlineDimension(panel, entity, libraryKey) {
    const library = caseMap.libraries[libraryKey];
    const body = panel.querySelector(".case-bridge-inline-body");
    if (!library || !body) return;

    panel.querySelectorAll("[data-case-inline-dimension]").forEach((tab) => {
      const active = tab.dataset.caseInlineDimension === libraryKey;
      tab.classList.toggle("is-active", active);
      tab.setAttribute("aria-selected", String(active));
    });

    const records = entity.dimensions?.[libraryKey] || [];
    body.replaceChildren();
    if (!records.length) {
      body.append(createText("p", `当前案例暂未匹配到${library.label}库记录。`, "case-bridge-inline-empty"));
      return;
    }

    const fragment = document.createDocumentFragment();
    records.slice(0, 3).forEach((record) => (
      fragment.append(createInlineRecord(record, libraryKey, library, panel.dataset.caseEntity))
    ));
    if (records.length > 3) {
      fragment.append(createText("p", `另有 ${records.length - 3} 条同维度记录，可在全景中继续查看。`, "case-bridge-inline-more"));
    }
    body.append(fragment);
  }

  function createInlineRecord(record, libraryKey, library, entityId) {
    const row = document.createElement("div");
    row.className = "case-bridge-inline-record";
    const header = document.createElement("div");
    header.className = "case-bridge-inline-record-header";
    const titleGroup = document.createElement("div");
    titleGroup.append(createText("strong", record.t));
    const meta = [record.c, record.s !== record.c ? record.s : "", record.d].filter(Boolean).join(" · ");
    if (meta) titleGroup.append(createText("span", meta));
    header.append(titleGroup);
    if (libraryKey !== currentLibrary) {
      const link = createText("a", `进入${library.label}库`, "case-bridge-inline-link");
      link.href = createCaseUrl(library.path, entityId);
      header.append(link);
    }
    row.append(header);

    const preview = document.createElement("dl");
    preview.className = "case-bridge-inline-preview";
    (record.p || []).forEach(([label, value]) => {
      const field = document.createElement("div");
      field.append(createText("dt", label), createText("dd", value));
      preview.append(field);
    });
    if (preview.childElementCount) row.append(preview);
    return row;
  }

  async function openEntity(entityId, options = {}) {
    if (!entityId) return;
    showDrawerLoading();
    try {
      const entity = await loadEntity(entityId);
      state.activeEntityId = entityId;
      renderEntity(entityId, entity);
      setCaseParameter(entityId);
      if (options.locate) await locateCurrentEntity(entityId, false);
      elements.closeButton.focus({ preventScroll: true });
    } catch (error) {
      elements.status.textContent = error instanceof Error ? error.message : String(error);
      elements.status.classList.add("is-error");
    }
  }

  function showDrawerLoading() {
    elements.drawer.hidden = false;
    elements.backdrop.hidden = false;
    requestAnimationFrame(() => {
      elements.drawer.classList.add("is-open");
      elements.backdrop.classList.add("is-open");
    });
    elements.drawer.setAttribute("aria-hidden", "false");
    document.body.classList.add("case-bridge-open");
    elements.title.textContent = "正在加载…";
    elements.status.textContent = "正在读取跨库案例索引";
    elements.status.classList.remove("is-error");
    elements.dimensions.replaceChildren();
    elements.related.replaceChildren();
  }

  function renderEntity(entityId, entity) {
    const availableCount = Object.keys(entity.dimensions || {}).length;
    elements.title.textContent = entity.title;
    elements.status.replaceChildren(
      createText("strong", `已覆盖 ${availableCount}/6 个维度`),
      createText("span", formatMatchLabel(entity))
    );
    elements.status.classList.remove("is-error");

    const fragment = document.createDocumentFragment();
    caseMap.order.forEach((libraryKey, orderIndex) => {
      const library = caseMap.libraries[libraryKey];
      const records = entity.dimensions?.[libraryKey] || [];
      const row = document.createElement("div");
      row.className = "case-bridge-dimension";
      row.classList.toggle("is-current", libraryKey === currentLibrary);
      row.classList.toggle("is-missing", records.length === 0);

      const marker = createText("span", String(orderIndex + 1), "case-bridge-marker");
      marker.style.setProperty("--case-bridge-color", library.color);
      const content = document.createElement("div");
      content.className = "case-bridge-dimension-content";
      const nameLine = document.createElement("div");
      nameLine.className = "case-bridge-dimension-name";
      nameLine.append(createText("strong", library.label));
      nameLine.append(createText("span", records.length ? `${records.length} 条记录` : "暂无记录"));
      content.append(nameLine);
      if (records.length) content.append(createText("p", summarizeRecord(records[0])));

      row.append(marker, content);
      if (records.length && libraryKey === currentLibrary) {
        const locateButton = createText("button", "定位", "case-bridge-action");
        locateButton.type = "button";
        locateButton.dataset.caseLocate = entityId;
        locateButton.title = "定位当前页面中的案例卡片";
        row.append(locateButton);
      } else if (records.length) {
        const link = createText("a", "查看", "case-bridge-action");
        link.href = createCaseUrl(library.path, entityId);
        link.title = `前往${library.label}库查看该案例`;
        row.append(link);
      }
      fragment.append(row);
    });
    elements.dimensions.replaceChildren(fragment);
    renderRelated(entity.relatedPreview || entity.related || []);
  }

  function summarizeRecord(record) {
    const preview = (record.p || []).slice(0, 2).map(([label, value]) => `${label}：${value}`);
    return preview.length ? preview.join(" · ") : record.t;
  }

  function renderRelated(relatedItems) {
    elements.related.replaceChildren();
    const normalized = relatedItems.map((item) => {
      if (typeof item === "string") {
        const entity = getEntity(item);
        return entity ? { id: item, title: entity.title, mask: entity.mask } : null;
      }
      return item;
    }).filter(Boolean);
    if (!normalized.length) return;

    elements.related.append(createText("h3", "同赛道相关案例"));
    elements.related.append(createText("p", "用于横向对照，不代表与当前案例是同一主体。", "case-bridge-related-note"));
    const list = document.createElement("div");
    list.className = "case-bridge-related-list";
    normalized.forEach((related) => {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.caseRelated = related.id;
      button.append(createText("span", related.title));
      button.append(createText("b", `${countBits(related.mask)}/6`));
      list.append(button);
    });
    elements.related.append(list);
  }

  async function locateCurrentEntity(entityId, closeAfter) {
    const entity = await loadEntity(entityId);
    const target = entity.dimensions?.[currentLibrary]?.[0];
    if (!target) return;

    const input = document.querySelector("#searchInput");
    if (input) {
      input.value = target.t;
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }
    const caseViewButton = document.querySelector('[data-view="cases"]');
    if (caseViewButton && caseViewButton.getAttribute("aria-pressed") !== "true") caseViewButton.click();

    await nextPaint();
    decorateCards(document);
    const card = [...document.querySelectorAll(".case-card[data-case-entity]")].find(
      (candidate) => candidate.dataset.caseEntity === entityId
    );
    if (card) {
      document.querySelectorAll(".case-bridge-spotlight").forEach((node) => node.classList.remove("case-bridge-spotlight"));
      card.classList.add("case-bridge-spotlight");
      card.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "center" });
    }
    if (closeAfter) closeDrawer();
  }

  function openDeepLink() {
    try {
      const entityId = new URL(window.location.href).searchParams.get("case") || "";
      if (entityId) openEntity(entityId, { locate: true });
    } catch (_error) {
      // file:// 下部分浏览器不允许读取完整历史状态，忽略即可。
    }
  }

  function getEntity(entityId) {
    return window.__CASE_GRAPH_ENTITIES__?.[entityId]
      || window.__CASE_GRAPH_DETAILS__?.entities?.[entityId]
      || null;
  }

  function loadEntity(entityId) {
    const cached = getEntity(entityId);
    if (cached) return Promise.resolve(cached);

    const digest = String(entityId).replace(/^c_/, "");
    const bucket = digest.slice(0, bucketChars);
    if (!/^[0-9a-f]+$/i.test(bucket)) return Promise.reject(new Error("案例实体编号无效"));
    if (state.shardPromises.has(bucket)) {
      return state.shardPromises.get(bucket).then(() => {
        const entity = getEntity(entityId);
        if (!entity) throw new Error("详情分片中未找到该案例");
        return entity;
      });
    }

    const promise = new Promise((resolve, reject) => {
      const detailScript = document.createElement("script");
      const base = detailBase.replace(/\/+$/, "");
      const url = new URL(`${base}/${bucket}.js`, suiteRoot);
      if (detailVersion) url.searchParams.set("v", detailVersion);
      detailScript.src = url.href;
      detailScript.async = true;
      detailScript.dataset.caseGraphShard = bucket;
      detailScript.addEventListener("load", resolve, { once: true });
      detailScript.addEventListener("error", () => reject(new Error("无法加载案例关联详情")), { once: true });
      document.head.append(detailScript);
    });
    state.shardPromises.set(bucket, promise);
    promise.catch(() => state.shardPromises.delete(bucket));
    return promise.then(() => {
      const entity = getEntity(entityId);
      if (!entity) throw new Error("详情分片中未找到该案例");
      return entity;
    });
  }

  function closeDrawer() {
    elements.drawer.classList.remove("is-open");
    elements.backdrop.classList.remove("is-open");
    elements.drawer.setAttribute("aria-hidden", "true");
    document.body.classList.remove("case-bridge-open");
    clearCaseParameter();
    window.setTimeout(() => {
      elements.drawer.hidden = true;
      elements.backdrop.hidden = true;
    }, prefersReducedMotion() ? 0 : 180);
    state.trigger?.focus?.({ preventScroll: true });
  }

  function createCaseUrl(path, entityId) {
    const url = new URL(path, suiteRoot);
    if (entityId) url.searchParams.set("case", entityId);
    return url.href;
  }

  function setCaseParameter(entityId) {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("case", entityId);
      history.replaceState(null, "", url);
    } catch (_error) {
      // file:// 下部分浏览器不允许改写历史记录，忽略即可。
    }
  }

  function clearCaseParameter() {
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete("case");
      history.replaceState(null, "", url);
    } catch (_error) {
      // 同上。
    }
  }

  function countBits(value) {
    let number = Number(value) || 0;
    let count = 0;
    while (number) {
      count += number & 1;
      number >>>= 1;
    }
    return count;
  }

  function formatMatchLabel(entity) {
    const label = matchLabels[entity.confidence] || "来源与标题联合匹配";
    if (!entity.confidence?.includes("token-overlap") || !entity.matchScore) return label;
    return `${label} ${Math.round(entity.matchScore * 100)}%`;
  }

  function nextPaint() {
    return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  }

  function prefersReducedMotion() {
    return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  }

  function createText(tagName, text, className = "") {
    const element = document.createElement(tagName);
    if (className) element.className = className;
    element.textContent = text;
    return element;
  }
})();
