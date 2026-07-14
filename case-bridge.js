(function () {
  "use strict";

  const script = document.currentScript;
  const currentLibrary = script?.dataset.library || "";
  const detailsSource = script?.dataset.detailsSrc || "case-graph-details.js";
  const caseMap = window.__CASE_MAP__;

  if (!script || !caseMap?.libraries?.[currentLibrary]) return;

  const suiteRoot = new URL(".", script.src);
  const state = {
    detailsPromise: null,
    activeEntityId: "",
    trigger: null,
    observer: null,
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

    Object.assign(elements, {
      backdrop,
      drawer,
      closeButton,
      title,
      status,
      dimensions,
      related,
    });
  }

  function bindEvents() {
    document.addEventListener("click", (event) => {
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

      card.dataset.caseEntity = entityId;
      const dimensionCount = countBits(caseMap.entityMask?.[entityId] || 0);
      const button = document.createElement("button");
      button.type = "button";
      button.className = "case-bridge-trigger";
      button.dataset.caseBridgeTrigger = "true";
      button.dataset.caseEntity = entityId;
      button.setAttribute("aria-haspopup", "dialog");
      button.title = dimensionCount > 1 ? `查看该案例的 ${dimensionCount} 个知识维度` : "查看案例全景与相关案例";
      button.append(createText("span", "全景"));
      button.append(createText("b", `${dimensionCount}/6`));

      const meta = card.querySelector(".card-meta");
      if (meta) meta.append(button);
      else card.prepend(button);
    });
  }

  async function openEntity(entityId, options = {}) {
    if (!entityId) return;
    showDrawerLoading();

    try {
      const details = await ensureDetails();
      const entity = details.entities?.[entityId];
      if (!entity) throw new Error("未找到该案例的全景记录");

      state.activeEntityId = entityId;
      renderEntity(entityId, entity, details.entities);
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

  function renderEntity(entityId, entity, allEntities) {
    const availableCount = Object.keys(entity.dimensions || {}).length;
    elements.title.textContent = entity.title;
    elements.status.replaceChildren(
      createText("strong", `已覆盖 ${availableCount}/6 个维度`),
      createText(
        "span",
        entity.confidence === "exact-normalized-title" ? "确定性标题匹配" : "当前仅在一个库中收录"
      )
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
      if (records.length) {
        content.append(createText("p", records[0].t));
      }

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

    renderRelated(entity.related || [], allEntities);
  }

  function renderRelated(relatedIds, allEntities) {
    elements.related.replaceChildren();
    if (!relatedIds.length) return;

    elements.related.append(createText("h3", "同赛道相关案例"));
    elements.related.append(createText("p", "用于横向对照，不代表与当前案例是同一主体。", "case-bridge-related-note"));
    const list = document.createElement("div");
    list.className = "case-bridge-related-list";
    relatedIds.forEach((relatedId) => {
      const related = allEntities[relatedId];
      if (!related) return;
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.caseRelated = relatedId;
      button.append(createText("span", related.title));
      button.append(createText("b", `${Object.keys(related.dimensions || {}).length}/6`));
      list.append(button);
    });
    elements.related.append(list);
  }

  async function locateCurrentEntity(entityId, closeAfter) {
    const details = await ensureDetails();
    const entity = details.entities?.[entityId];
    const target = entity?.dimensions?.[currentLibrary]?.[0];
    if (!target) return;

    const input = document.querySelector("#searchInput");
    if (input) {
      input.value = target.t;
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }

    const caseViewButton = document.querySelector('[data-view="cases"]');
    if (caseViewButton?.getAttribute("aria-pressed") !== "true") caseViewButton?.click();

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
    let entityId = "";
    try {
      entityId = new URL(window.location.href).searchParams.get("case") || "";
    } catch (_error) {
      return;
    }
    if (entityId) openEntity(entityId, { locate: true });
  }

  function ensureDetails() {
    if (window.__CASE_GRAPH_DETAILS__?.entities) return Promise.resolve(window.__CASE_GRAPH_DETAILS__);
    if (state.detailsPromise) return state.detailsPromise;

    state.detailsPromise = new Promise((resolve, reject) => {
      const detailsScript = document.createElement("script");
      detailsScript.src = new URL(detailsSource, script.src).href;
      detailsScript.async = true;
      detailsScript.addEventListener("load", () => {
        if (window.__CASE_GRAPH_DETAILS__?.entities) resolve(window.__CASE_GRAPH_DETAILS__);
        else reject(new Error("全景详情脚本已加载，但数据结构无效"));
      });
      detailsScript.addEventListener("error", () => reject(new Error("无法加载案例全景详情")));
      document.head.append(detailsScript);
    });
    return state.detailsPromise;
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
    url.searchParams.set("case", entityId);
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
