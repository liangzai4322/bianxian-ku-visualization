"use strict";

// 字段配置集中放在顶部，后续增删列优先改这里。
const COLUMN_CONFIG = {
  "库名": { display: false, label: "库名", area: "hidden" },
  "来源文件": { display: false, label: "来源文件", area: "hidden" },
  "归档日期": { display: false, label: "归档日期", area: "hidden" },
  "案例日期": { display: true, label: "案例日期", area: "title" },
  "大分类": { display: true, label: "大分类", area: "title" },
  "细分赛道": { display: true, label: "细分赛道", area: "title" },
  "案例/来源": { display: true, label: "案例/来源", area: "title" },
  "卖点提炼方式": { display: true, label: "卖点提炼方式", area: "body" },
  "文案结构": { display: true, label: "文案结构", area: "body" },
  "信任建立方法": { display: true, label: "信任建立方法", area: "body" },
  "转化关键动作": { display: true, label: "转化关键动作", area: "body" },
  "证据/备注": { display: true, label: "证据/备注", area: "detail" },
  "小分类": { display: false, label: "小分类", area: "hidden" },
};

const PAGE_SIZE = 100;
const BODY_FIELDS = ["卖点提炼方式", "文案结构", "信任建立方法", "转化关键动作"];
const DATA_JSON_URL = "marketing-data.json";
const CSV_URL = "营销库.csv";
const UNCATEGORIZED = "未分类";
const DATE_ISO_FIELD = "案例日期_ISO";
const DATE_TS_FIELD = "案例日期_TS";
const RAW_INDEX_FIELD = "__rawIndex";
const TOKEN_SPLIT_PATTERN = /\s*(?:,|，|、|\+|\/|；|;|｜|\||→|->|：|:)\s*/;

const CATEGORY_COLORS = [
  "#f97316",
  "#e11d48",
  "#dc2626",
  "#d97706",
  "#ea580c",
  "#be123c",
  "#7c3aed",
  "#2563eb",
  "#16a34a",
  "#0891b2",
];

const FIELD_STYLE_CONFIG = {
  "卖点提炼方式": { className: "field-selling" },
  "文案结构": { className: "field-copy" },
  "信任建立方法": { className: "field-trust" },
  "转化关键动作": { className: "field-action" },
};

const MARKETING_TAGS = [
  ["痛点放大", /痛点|焦虑|问题|痛|困扰|难点|需求/],
  ["结果承诺", /结果|收益|增长|提升|效率|回本|爆发|成交|转化|GMV|利润/],
  ["证据展示", /证据|截图|实测|案例|数据|样例|复现|公开|展示|记录/],
  ["对比测评", /对比|测评|差异|反差|前后|竞品|替代|优势/],
  ["场景化", /场景|人群|适合|使用|生活|工作|实操|落地/],
  ["流程拆解", /流程|步骤|拆解|路径|方法论|教程|SOP|清单/],
  ["故事化", /故事|经历|复盘|从.*到|亲历|过程|背景/],
  ["免费资源", /免费|资料|模板|工具|源码|赠送|领取|福利/],
  ["低门槛", /低价|低门槛|小白|零基础|不用|无需|简单|一键/],
  ["稀缺限时", /限时|名额|稀缺|仅限|截止|活动|优惠|折扣/],
  ["权威背书", /权威|专家|官方|资质|认证|机构|品牌|头部/],
  ["用户证言", /用户|学员|客户|读者|评价|反馈|证言|口碑/],
  ["数据化", /\\d|数据|百分比|倍|万|千|ROI|转化率|阅读量/],
  ["行动号召", /点赞|评论|私信|扫码|下单|购买|领取|关注|预约|咨询|报名/],
  ["社群承接", /社群|私域|微信|群|朋友圈|知识星球|公众号/],
];

const TAG_COLORS = {
  "痛点放大": ["#be123c", "#ffe4e6"],
  "结果承诺": ["#c2410c", "#ffedd5"],
  "证据展示": ["#0369a1", "#e0f2fe"],
  "对比测评": ["#7c2d12", "#fed7aa"],
  "场景化": ["#047857", "#d1fae5"],
  "流程拆解": ["#4338ca", "#e0e7ff"],
  "故事化": ["#7e22ce", "#f3e8ff"],
  "免费资源": ["#15803d", "#dcfce7"],
  "低门槛": ["#0f766e", "#ccfbf1"],
  "稀缺限时": ["#b45309", "#fef3c7"],
  "权威背书": ["#1d4ed8", "#dbeafe"],
  "用户证言": ["#be185d", "#fce7f3"],
  "数据化": ["#0e7490", "#cffafe"],
  "行动号召": ["#dc2626", "#fee2e2"],
  "社群承接": ["#16a34a", "#dcfce7"],
};

const MONTHS = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

const state = {
  items: [],
  filtered: [],
  counts: new Map(),
  categoryColors: new Map(),
  expandedCategories: new Set(),
  search: "",
  category: "",
  subcategory: "",
  sort: "desc",
  focusField: "卖点提炼方式",
  viewMode: "grouped",
  visibleCount: PAGE_SIZE,
};

const els = {};

document.addEventListener("DOMContentLoaded", init);

async function init() {
  cacheElements();
  bindEvents();

  try {
    state.items = normalizeItems(await loadData());
    buildCounts();
    assignCategoryColors();
    buildFilters();
    renderCategoryTree();
    applyFilters();
  } catch (error) {
    showError(error);
  }
}

function cacheElements() {
  els.totalCount = document.querySelector("#totalCount");
  els.searchInput = document.querySelector("#searchInput");
  els.categoryFilter = document.querySelector("#categoryFilter");
  els.subcategoryFilter = document.querySelector("#subcategoryFilter");
  els.sortSelect = document.querySelector("#sortSelect");
  els.focusControl = document.querySelector("#focusControl");
  els.viewModeToggle = document.querySelector("#viewModeToggle");
  els.clearFilters = document.querySelector("#clearFilters");
  els.categoryTree = document.querySelector("#categoryTree");
  els.resultInfo = document.querySelector("#resultInfo");
  els.cardGrid = document.querySelector("#cardGrid");
  els.emptyState = document.querySelector("#emptyState");
  els.errorState = document.querySelector("#errorState");
  els.errorMessage = document.querySelector("#errorMessage");
  els.loadMoreButton = document.querySelector("#loadMoreButton");
}

function bindEvents() {
  els.searchInput.addEventListener("input", () => {
    state.search = els.searchInput.value.trim().toLowerCase();
    state.visibleCount = PAGE_SIZE;
    applyFilters();
  });

  els.categoryFilter.addEventListener("change", () => {
    state.category = els.categoryFilter.value;
    state.subcategory = "";
    state.visibleCount = PAGE_SIZE;
    buildSubcategoryFilter();
    syncExpandedCategory();
    applyFilters();
  });

  els.subcategoryFilter.addEventListener("change", () => {
    state.subcategory = els.subcategoryFilter.value;
    state.visibleCount = PAGE_SIZE;
    applyFilters();
  });

  els.sortSelect.addEventListener("change", () => {
    state.sort = els.sortSelect.value;
    state.visibleCount = PAGE_SIZE;
    applyFilters();
  });

  els.focusControl.addEventListener("click", (event) => {
    const button = event.target.closest("[data-focus-field]");
    if (!button) return;
    state.focusField = button.dataset.focusField;
    syncFocusButtons();
    renderCards();
  });

  els.viewModeToggle.addEventListener("click", () => {
    state.viewMode = state.viewMode === "grouped" ? "merged" : "grouped";
    syncViewModeToggle();
    renderCards();
  });

  els.clearFilters.addEventListener("click", () => {
    state.search = "";
    state.category = "";
    state.subcategory = "";
    state.visibleCount = PAGE_SIZE;
    els.searchInput.value = "";
    buildFilters();
    renderCategoryTree();
    applyFilters();
  });

  els.categoryTree.addEventListener("click", (event) => {
    const subcategoryButton = event.target.closest("[data-subcategory]");
    const categoryButton = event.target.closest("[data-category]");

    if (subcategoryButton) {
      state.category = subcategoryButton.dataset.parentCategory;
      state.subcategory = subcategoryButton.dataset.subcategory;
      state.expandedCategories.add(state.category);
      state.visibleCount = PAGE_SIZE;
      syncFilterControls();
      renderCategoryTree();
      applyFilters();
      return;
    }

    if (categoryButton) {
      const category = categoryButton.dataset.category;
      state.category = category;
      state.subcategory = "";
      if (state.expandedCategories.has(category)) state.expandedCategories.delete(category);
      else state.expandedCategories.add(category);
      state.visibleCount = PAGE_SIZE;
      syncFilterControls();
      renderCategoryTree();
      applyFilters();
    }
  });

  els.loadMoreButton.addEventListener("click", () => {
    state.visibleCount += PAGE_SIZE;
    renderCards();
  });
}

async function loadData() {
  if (Array.isArray(window.MARKETING_DATA)) return window.MARKETING_DATA;
  if (window.location.protocol === "file:") {
    throw new Error("双击打开需要同目录存在 marketing-data.js。请先运行一次 python marketing-convert.py。");
  }

  try {
    const response = await fetch(DATA_JSON_URL, { cache: "no-store" });
    if (!response.ok) throw new Error(`marketing-data.json 状态码 ${response.status}`);
    const data = await response.json();
    return Array.isArray(data) ? data : data.records || [];
  } catch (jsonError) {
    try {
      return await loadCsvData(CSV_URL);
    } catch (csvError) {
      throw new Error(`无法加载数据：${csvError.message || jsonError.message}`);
    }
  }
}

function normalizeItems(items) {
  const displayColumns = Object.keys(COLUMN_CONFIG).filter((column) => COLUMN_CONFIG[column].display);
  return items.map((item, index) => {
    const normalized = { [RAW_INDEX_FIELD]: Number(item[RAW_INDEX_FIELD] || index + 1) };
    displayColumns.forEach((column) => {
      normalized[column] = cleanText(item[column]);
    });
    normalized["大分类"] = normalized["大分类"] || UNCATEGORIZED;
    normalized["细分赛道"] = normalized["细分赛道"] || UNCATEGORIZED;
    normalized["案例/来源"] = normalized["案例/来源"] || "未命名案例";
    const parsedDate = parseCaseDate(normalized["案例日期"]);
    normalized[DATE_ISO_FIELD] = cleanText(item[DATE_ISO_FIELD]) || parsedDate.iso;
    normalized[DATE_TS_FIELD] = Number(item[DATE_TS_FIELD] || parsedDate.timestamp || 0);
    normalized.__searchText = buildSearchText(normalized);
    return normalized;
  });
}

function cleanText(value) {
  return String(value ?? "")
    .replace(/^\uFEFF/, "")
    .trim()
    .replace(/\s+/g, " ");
}

function buildSearchText(item) {
  return ["案例/来源", "卖点提炼方式", "文案结构", "信任建立方法", "转化关键动作", "证据/备注", "大分类", "细分赛道"]
    .map((column) => item[column] || "")
    .join(" ")
    .toLowerCase();
}

function buildCounts() {
  state.counts.clear();
  state.items.forEach((item) => {
    const category = item["大分类"] || UNCATEGORIZED;
    const subcategory = item["细分赛道"] || UNCATEGORIZED;
    if (!state.counts.has(category)) state.counts.set(category, { total: 0, subcategories: new Map() });
    const bucket = state.counts.get(category);
    bucket.total += 1;
    bucket.subcategories.set(subcategory, (bucket.subcategories.get(subcategory) || 0) + 1);
  });
  const firstCategory = [...state.counts.keys()].sort(localeSort)[0];
  if (firstCategory) state.expandedCategories.add(firstCategory);
}

function assignCategoryColors() {
  [...state.counts.keys()].sort(localeSort).forEach((category, index) => {
    state.categoryColors.set(category, category === UNCATEGORIZED ? "#94a3b8" : CATEGORY_COLORS[index % CATEGORY_COLORS.length]);
  });
}

function buildFilters() {
  fillSelect(els.categoryFilter, [["", "全部大分类"], ...getCategories().map((category) => [category, category])]);
  buildSubcategoryFilter();
}

function buildSubcategoryFilter() {
  const names = new Set();
  if (state.category && state.counts.has(state.category)) {
    state.counts.get(state.category).subcategories.forEach((_, name) => names.add(name));
  } else {
    state.counts.forEach((bucket) => bucket.subcategories.forEach((_, name) => names.add(name)));
  }
  fillSelect(els.subcategoryFilter, [["", "全部细分赛道"], ...[...names].sort(localeSort).map((name) => [name, name])]);
  els.subcategoryFilter.value = state.subcategory;
}

function fillSelect(select, options) {
  select.replaceChildren();
  options.forEach(([value, label]) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    select.append(option);
  });
}

function syncFilterControls() {
  els.categoryFilter.value = state.category;
  buildSubcategoryFilter();
  els.subcategoryFilter.value = state.subcategory;
}

function syncExpandedCategory() {
  if (state.category) state.expandedCategories.add(state.category);
  renderCategoryTree();
}

function getCategories() {
  return [...state.counts.keys()].sort(localeSort);
}

function localeSort(a, b) {
  return String(a).localeCompare(String(b), "zh-Hans-CN");
}

function renderCategoryTree() {
  const fragment = document.createDocumentFragment();
  getCategories().forEach((category) => {
    const bucket = state.counts.get(category);
    const group = document.createElement("section");
    group.className = "category-group";
    group.classList.toggle("expanded", state.expandedCategories.has(category));
    group.style.setProperty("--category-color", getCategoryColor(category));

    const button = document.createElement("button");
    button.type = "button";
    button.className = "category-button";
    button.dataset.category = category;
    button.classList.toggle("active", state.category === category && !state.subcategory);
    button.setAttribute("aria-expanded", String(state.expandedCategories.has(category)));
    button.append(createTextSpan(category, "category-name"), createBadge(bucket.total));
    group.append(button);

    const list = document.createElement("div");
    list.className = "subcategory-list";
    [...bucket.subcategories.entries()].sort(([a], [b]) => localeSort(a, b)).forEach(([subcategory, count]) => {
      const child = document.createElement("button");
      child.type = "button";
      child.className = "subcategory-button";
      child.dataset.parentCategory = category;
      child.dataset.subcategory = subcategory;
      child.classList.toggle("active", state.category === category && state.subcategory === subcategory);
      child.append(createTextSpan(subcategory, "subcategory-name"), createBadge(count));
      list.append(child);
    });
    group.append(list);
    fragment.append(group);
  });
  els.categoryTree.replaceChildren(fragment);
}

function createTextSpan(text, className) {
  const span = document.createElement("span");
  span.className = className;
  span.textContent = text;
  return span;
}

function createBadge(count) {
  const badge = document.createElement("span");
  badge.className = "badge";
  badge.textContent = count;
  return badge;
}

function getCategoryColor(category) {
  return state.categoryColors.get(category) || CATEGORY_COLORS[0];
}

function applyFilters() {
  state.filtered = state.items
    .filter((item) => {
      if (state.category && item["大分类"] !== state.category) return false;
      if (state.subcategory && item["细分赛道"] !== state.subcategory) return false;
      if (state.search && !item.__searchText.includes(state.search)) return false;
      return true;
    })
    .sort(sortByDate);
  els.totalCount.textContent = state.items.length;
  renderCategoryTree();
  renderCards();
}

function sortByDate(a, b) {
  const aTime = Number(a[DATE_TS_FIELD] || 0);
  const bTime = Number(b[DATE_TS_FIELD] || 0);
  if (!aTime && bTime) return 1;
  if (aTime && !bTime) return -1;
  if (aTime !== bTime) return state.sort === "asc" ? aTime - bTime : bTime - aTime;
  return Number(a[RAW_INDEX_FIELD]) - Number(b[RAW_INDEX_FIELD]);
}

function renderCards() {
  els.errorState.hidden = true;
  els.cardGrid.classList.toggle("field-focus-mode", Boolean(state.focusField));
  const shownItems = state.filtered.slice(0, state.visibleCount);
  const fragment = document.createDocumentFragment();
  shownItems.forEach((item) => fragment.append(createCard(item)));
  els.cardGrid.replaceChildren(fragment);
  els.emptyState.hidden = state.filtered.length !== 0;
  els.loadMoreButton.hidden = state.visibleCount >= state.filtered.length;
  els.resultInfo.textContent = buildResultInfo(shownItems.length);
}

function buildResultInfo(shownCount) {
  const parts = [`当前 ${state.filtered.length} 条`];
  if (state.category) parts.push(state.category);
  if (state.subcategory) parts.push(state.subcategory);
  if (state.search) parts.push(`关键词：${state.search}`);
  if (state.filtered.length > shownCount) parts.push(`已显示 ${shownCount} 条`);
  return parts.join(" · ");
}

function createCard(item) {
  const card = document.createElement("article");
  card.className = "case-card";
  card.classList.toggle("merged-view", state.viewMode === "merged");
  card.classList.toggle("field-focus-active", Boolean(state.focusField));
  card.style.setProperty("--category-color", getCategoryColor(item["大分类"]));

  const meta = document.createElement("div");
  meta.className = "card-meta";
  appendMetaPills(meta, item);
  meta.append(createPill(formatDateLabel(item), "date-pill"));
  card.append(meta);

  const title = document.createElement("h2");
  title.className = "case-title";
  title.textContent = item["案例/来源"];
  card.append(title);

  if (state.viewMode === "merged") {
    card.append(createMergedSummary(item));
  } else {
    const fields = document.createElement("dl");
    fields.className = "field-list";
    getBodyFieldOrder().forEach((column) => fields.append(createField(column, item[column])));
    card.append(fields);
  }

  if (item["证据/备注"]) {
    const detail = document.createElement("details");
    detail.className = "detail";
    const summary = document.createElement("summary");
    summary.textContent = "证据/备注";
    const text = document.createElement("p");
    text.textContent = item["证据/备注"];
    detail.append(summary, text);
    card.append(detail);
  }
  return card;
}

function appendMetaPills(meta, item) {
  const category = item["大分类"] || UNCATEGORIZED;
  const subcategory = item["细分赛道"] || UNCATEGORIZED;
  const categoryIsUnknown = category === UNCATEGORIZED;
  const subcategoryIsUnknown = subcategory === UNCATEGORIZED;
  const showUnknownContext = state.category === UNCATEGORIZED || state.subcategory === UNCATEGORIZED;

  if (categoryIsUnknown && subcategoryIsUnknown) {
    if (showUnknownContext) meta.append(createPill(UNCATEGORIZED, "unknown-pill"));
    return;
  }

  if (!categoryIsUnknown || showUnknownContext) {
    meta.append(createPill(category, categoryIsUnknown ? "unknown-pill" : ""));
  }
  if (subcategory !== category && (!subcategoryIsUnknown || showUnknownContext)) {
    meta.append(createPill(subcategory, subcategoryIsUnknown ? "unknown-pill" : ""));
  }
}

function createPill(text, extraClass = "") {
  const pill = document.createElement("span");
  pill.className = `pill ${extraClass}`.trim();
  pill.textContent = text || "未填写";
  return pill;
}

function createField(column, value) {
  const wrapper = document.createElement("div");
  const fieldStyle = FIELD_STYLE_CONFIG[column] || {};
  wrapper.className = `field ${fieldStyle.className || ""}`.trim();
  wrapper.classList.toggle("is-focused", state.focusField === column);
  wrapper.classList.toggle("is-dimmed", Boolean(state.focusField) && state.focusField !== column);

  const term = document.createElement("dt");
  term.textContent = COLUMN_CONFIG[column].label;

  const desc = document.createElement("dd");
  const text = cleanText(value);
  const tags = getMarketingTags(text, column);
  if (tags.length) {
    const tokenList = document.createElement("span");
    tokenList.className = "token-list";
    tags.forEach((tag) => tokenList.append(createToken(tag)));
    desc.append(tokenList);
    if (text && state.focusField === column) {
      const note = document.createElement("span");
      note.className = "field-note";
      note.textContent = text;
      desc.append(note);
    }
  } else {
    desc.textContent = text || "未填写";
  }
  desc.classList.toggle("muted", !text);
  wrapper.append(term, desc);
  return wrapper;
}

function createMergedSummary(item) {
  const summary = document.createElement("p");
  summary.className = "merged-summary";
  summary.textContent = [
    `这个营销案例用${valueOrUnknown(item["卖点提炼方式"])}提炼卖点`,
    `文案结构是${valueOrUnknown(item["文案结构"])}`,
    `通过${valueOrUnknown(item["信任建立方法"])}建立信任`,
    `最后用${valueOrUnknown(item["转化关键动作"])}完成转化`,
  ].join("，") + "。";
  return summary;
}

function valueOrUnknown(value) {
  return cleanText(value) || "未填写";
}

function getMarketingTags(text, column) {
  if (!text) return [];
  const detected = MARKETING_TAGS.filter(([, pattern]) => pattern.test(text)).map(([label]) => label);
  const splitTokens = text
    .split(TOKEN_SPLIT_PATTERN)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2 && token.length <= 18);
  const merged = [...detected, ...splitTokens].filter(Boolean);
  const limit = column === "卖点提炼方式" ? 7 : 5;
  return [...new Set(merged)].slice(0, limit);
}

function createToken(token) {
  const chip = document.createElement("span");
  chip.className = "field-token";
  chip.textContent = token;
  const [color, bg] = TAG_COLORS[token] || tagColorFromText(token);
  chip.style.setProperty("--token-color", color);
  chip.style.setProperty("--token-bg", bg);
  chip.style.setProperty("--token-line", withAlpha(color, 0.28));
  return chip;
}

function tagColorFromText(text) {
  const hue = stableHue(text);
  return [`hsl(${hue}, 72%, 34%)`, `hsl(${hue}, 86%, 94%)`];
}

function stableHue(text) {
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) hash = (hash * 31 + text.charCodeAt(i)) % 360;
  return hash;
}

function syncFocusButtons() {
  els.focusControl.querySelectorAll("[data-focus-field]").forEach((button) => {
    button.classList.toggle("active", button.dataset.focusField === state.focusField);
  });
}

function syncViewModeToggle() {
  const isMerged = state.viewMode === "merged";
  els.viewModeToggle.setAttribute("aria-pressed", String(isMerged));
  els.viewModeToggle.querySelector("[data-mode-label]").textContent = isMerged ? "合并模式" : "分组模式";
  els.viewModeToggle.querySelector("small").textContent = isMerged ? "切换分组" : "切换合并";
}

function getBodyFieldOrder() {
  if (!state.focusField || !BODY_FIELDS.includes(state.focusField)) return BODY_FIELDS;
  return [state.focusField, ...BODY_FIELDS.filter((column) => column !== state.focusField)];
}

function formatDateLabel(item) {
  if (item[DATE_ISO_FIELD]) return item[DATE_ISO_FIELD].slice(0, 7);
  return item["案例日期"] || "日期未知";
}

function parseCaseDate(value) {
  const text = cleanText(value);
  if (!text) return { iso: "", timestamp: 0 };
  const normalized = text.replace(/[_/.]/g, "-").replace(/\s+/g, "-");
  let match = normalized.match(/^(\d{4})-(\d{1,2})(?:-\d{1,2})?$/);
  if (match) return buildIsoDate(Number(match[1]), Number(match[2]));
  match = normalized.match(/^(\d{2})-(\d{1,2})(?:-\d{1,2})?$/);
  if (match) return buildIsoDate(2000 + Number(match[1]), Number(match[2]));
  match = normalized.match(/^(\d{2,4})-([A-Za-z]+)$/) || normalized.match(/^([A-Za-z]+)-(\d{2,4})$/);
  if (match) {
    const firstIsYear = /^\d+$/.test(match[1]);
    let year = Number(firstIsYear ? match[1] : match[2]);
    if (year < 100) year += 2000;
    const month = MONTHS[String(firstIsYear ? match[2] : match[1]).toLowerCase()] || 0;
    return buildIsoDate(year, month);
  }
  match = text.match(/^(\d{2,4})年(\d{1,2})月/);
  if (match) {
    let year = Number(match[1]);
    if (year < 100) year += 2000;
    return buildIsoDate(year, Number(match[2]));
  }
  return { iso: "", timestamp: 0 };
}

function buildIsoDate(year, month) {
  if (!Number.isFinite(year) || !Number.isFinite(month) || year < 2000 || month < 1 || month > 12) {
    return { iso: "", timestamp: 0 };
  }
  const iso = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-01`;
  return { iso, timestamp: Math.floor(Date.UTC(year, month - 1, 1) / 1000) };
}

function withAlpha(color, alpha) {
  if (color.startsWith("hsl(")) return color.replace("hsl(", "hsla(").replace(")", `, ${alpha})`);
  const match = color.replace("#", "").match(/^([0-9a-f]{6})$/i);
  if (!match) return `rgba(249, 115, 22, ${alpha})`;
  const value = match[1];
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function showError(error) {
  els.cardGrid.replaceChildren();
  els.emptyState.hidden = true;
  els.loadMoreButton.hidden = true;
  els.errorState.hidden = false;
  els.resultInfo.textContent = "未能加载数据";
  els.errorMessage.textContent = error.message || String(error);
}

async function loadCsvData(url) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`CSV 加载失败：${response.status}`);
  return normalizeCsvRows(parseCsv(await response.text()));
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (char === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        i += 1;
      } else inQuotes = !inQuotes;
      continue;
    }
    if (char === "," && !inQuotes) {
      row.push(cell);
      cell = "";
      continue;
    }
    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(cell);
      if (row.some((value) => value !== "")) rows.push(row);
      row = [];
      cell = "";
      continue;
    }
    cell += char;
  }
  row.push(cell);
  if (row.some((value) => value !== "")) rows.push(row);
  return rows;
}

function normalizeCsvRows(rows) {
  if (!rows.length) return [];
  const headers = rows[0].map(cleanText);
  const displayColumns = Object.keys(COLUMN_CONFIG).filter((column) => COLUMN_CONFIG[column].display);
  return rows.slice(1).map((sourceRow, index) => {
    const raw = {};
    headers.forEach((header, columnIndex) => {
      raw[header] = cleanText(sourceRow[columnIndex] ?? "");
    });
    const item = { [RAW_INDEX_FIELD]: index + 1 };
    displayColumns.forEach((column) => {
      item[column] = raw[column] || "";
    });
    const parsedDate = parseCaseDate(item["案例日期"]);
    item[DATE_ISO_FIELD] = parsedDate.iso;
    item[DATE_TS_FIELD] = parsedDate.timestamp;
    return item;
  });
}
