"use strict";

// 关键字段配置：控制列显隐、显示名和渲染区域，后续增删列优先改这里。
const COLUMN_CONFIG = {
  "库名": { display: false, label: "库名", area: "hidden" },
  "来源文件": { display: false, label: "来源文件", area: "hidden" },
  "归档日期": { display: false, label: "归档日期", area: "hidden" },
  "案例日期": { display: true, label: "案例日期", area: "title" },
  "大分类": { display: true, label: "大分类", area: "title" },
  "细分赛道": { display: true, label: "细分赛道", area: "title" },
  "案例/来源": { display: true, label: "案例/来源", area: "title" },
  "产品形态": { display: true, label: "产品形态", area: "body" },
  "定价策略": { display: true, label: "定价策略", area: "body" },
  "付费模型": { display: true, label: "付费模型", area: "body" },
  "复购机制": { display: true, label: "复购机制", area: "body" },
  "证据/备注": { display: true, label: "证据/备注", area: "detail" },
  "小分类": { display: false, label: "小分类", area: "hidden" },
};

const PAGE_SIZE = 72;
const BODY_FIELDS = ["产品形态", "定价策略", "付费模型", "复购机制"];
const DATA_JSON_URL = "data.json";
const CSV_URL = "变现库.csv";
const UNCATEGORIZED = "未分类";
const DATE_ISO_FIELD = "案例日期_ISO";
const DATE_TS_FIELD = "案例日期_TS";
const RAW_INDEX_FIELD = "__rawIndex";
const CATEGORY_COLORS = [
  "#2563eb",
  "#059669",
  "#d97706",
  "#7c3aed",
  "#dc2626",
  "#0891b2",
  "#4f46e5",
  "#16a34a",
  "#c2410c",
  "#be123c",
  "#0f766e",
  "#9333ea",
];
const FIELD_STYLE_CONFIG = {
  "产品形态": { className: "field-product" },
  "定价策略": { className: "field-price" },
  "付费模型": { className: "field-model" },
  "复购机制": { className: "field-repeat" },
};
const TOKEN_SPLIT_PATTERN = /\s*(?:\+|\/|、|；|;|｜|\|)\s*/;

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
  focusField: "产品形态",
  visibleCount: PAGE_SIZE,
};

const els = {};

document.addEventListener("DOMContentLoaded", init);

async function init() {
  cacheElements();
  bindEvents();

  try {
    state.items = await loadData();
    state.items = normalizeItems(state.items);
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
    const categoryButton = event.target.closest("[data-category]");
    const subcategoryButton = event.target.closest("[data-subcategory]");

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
      if (state.expandedCategories.has(category)) {
        state.expandedCategories.delete(category);
      } else {
        state.expandedCategories.add(category);
      }
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
  if (Array.isArray(window.MONETIZATION_DATA)) {
    return window.MONETIZATION_DATA;
  }

  if (window.location.protocol === "file:") {
    throw new Error("双击打开需要同目录存在 data.js。请先运行一次 python convert.py 生成 data.js。");
  }

  try {
    const response = await fetch(DATA_JSON_URL, { cache: "no-store" });
    if (!response.ok) throw new Error(`data.json 状态码 ${response.status}`);
    const data = await response.json();
    return Array.isArray(data) ? data : data.records || [];
  } catch (jsonError) {
    if (!window.CSVLoader) throw jsonError;
    try {
      return await window.CSVLoader.loadCsvData(CSV_URL, COLUMN_CONFIG);
    } catch (csvError) {
      throw new Error(
        `无法加载 data.json，也无法回退读取 CSV。请在本目录运行 python convert.py 后刷新，或用 python -m http.server 8000 启动本地服务器。原始错误：${csvError.message || jsonError.message}`,
      );
    }
  }
}

function normalizeItems(items) {
  const displayColumns = Object.keys(COLUMN_CONFIG).filter((column) => COLUMN_CONFIG[column].display);

  return items.map((item, index) => {
    const normalized = {
      [RAW_INDEX_FIELD]: Number(item[RAW_INDEX_FIELD] || index + 1),
    };

    displayColumns.forEach((column) => {
      normalized[column] = cleanText(item[column]);
    });

    normalized["大分类"] = normalized["大分类"] || UNCATEGORIZED;
    normalized["细分赛道"] = normalized["细分赛道"] || UNCATEGORIZED;
    normalized["案例/来源"] = normalized["案例/来源"] || "未命名案例";

    const parsedDate = window.CSVLoader?.parseCaseDate
      ? window.CSVLoader.parseCaseDate(normalized["案例日期"])
      : { iso: "", timestamp: 0 };

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
  const searchable = ["案例/来源", "产品形态", "定价策略", "付费模型", "复购机制", "证据/备注", "大分类", "细分赛道"];
  return searchable.map((column) => item[column] || "").join(" ").toLowerCase();
}

function buildCounts() {
  state.counts.clear();

  state.items.forEach((item) => {
    const category = item["大分类"] || UNCATEGORIZED;
    const subcategory = item["细分赛道"] || UNCATEGORIZED;

    if (!state.counts.has(category)) {
      state.counts.set(category, { total: 0, subcategories: new Map() });
    }

    const bucket = state.counts.get(category);
    bucket.total += 1;
    bucket.subcategories.set(subcategory, (bucket.subcategories.get(subcategory) || 0) + 1);
  });

  const firstCategory = [...state.counts.keys()][0];
  if (firstCategory) {
    state.expandedCategories.add(firstCategory);
  }
}

function assignCategoryColors() {
  [...state.counts.keys()].sort(localeSort).forEach((category, index) => {
    state.categoryColors.set(category, CATEGORY_COLORS[index % CATEGORY_COLORS.length]);
  });
}

function buildFilters() {
  fillSelect(els.categoryFilter, [["", "全部大分类"], ...getCategories().map((category) => [category, category])]);
  buildSubcategoryFilter();
}

function buildSubcategoryFilter() {
  let subcategories = [];

  if (state.category && state.counts.has(state.category)) {
    subcategories = [...state.counts.get(state.category).subcategories.keys()];
  } else {
    const merged = new Set();
    state.counts.forEach((bucket) => {
      bucket.subcategories.forEach((_, subcategory) => merged.add(subcategory));
    });
    subcategories = [...merged];
  }

  fillSelect(els.subcategoryFilter, [["", "全部细分赛道"], ...subcategories.sort(localeSort).map((name) => [name, name])]);
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
  if (state.category) {
    state.expandedCategories.add(state.category);
  }
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
    if (state.expandedCategories.has(category)) {
      group.classList.add("expanded");
    }
    group.style.setProperty("--category-color", getCategoryColor(category));

    const categoryButton = document.createElement("button");
    categoryButton.type = "button";
    categoryButton.className = "category-button";
    categoryButton.dataset.category = category;
    categoryButton.classList.toggle("active", state.category === category && !state.subcategory);
    categoryButton.setAttribute("aria-expanded", String(state.expandedCategories.has(category)));
    categoryButton.append(createTextSpan(category, "category-name"));
    categoryButton.append(createBadge(bucket.total));
    group.append(categoryButton);

    const list = document.createElement("div");
    list.className = "subcategory-list";
    [...bucket.subcategories.entries()].sort(([a], [b]) => localeSort(a, b)).forEach(([subcategory, count]) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "subcategory-button";
      button.dataset.parentCategory = category;
      button.dataset.subcategory = subcategory;
      button.classList.toggle("active", state.category === category && state.subcategory === subcategory);
      button.append(createTextSpan(subcategory, "subcategory-name"));
      button.append(createBadge(count));
      list.append(button);
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
  if (category === UNCATEGORIZED) return "#94a3b8";
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
  if (aTime !== bTime) {
    return state.sort === "asc" ? aTime - bTime : bTime - aTime;
  }
  return Number(a[RAW_INDEX_FIELD]) - Number(b[RAW_INDEX_FIELD]);
}

function renderCards() {
  els.errorState.hidden = true;
  els.cardGrid.classList.toggle("field-focus-mode", Boolean(state.focusField));
  const shownItems = state.filtered.slice(0, state.visibleCount);
  const fragment = document.createDocumentFragment();

  shownItems.forEach((item) => {
    fragment.append(createCard(item));
  });

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
  card.classList.toggle("field-focus-active", Boolean(state.focusField));
  card.style.setProperty("--category-color", getCategoryColor(item["大分类"]));
  card.style.setProperty("--accent", getCategoryColor(item["大分类"]));
  card.style.setProperty("--accent-soft", withAlpha(getCategoryColor(item["大分类"]), 0.1));

  const meta = document.createElement("div");
  meta.className = "card-meta";
  appendMetaPills(meta, item);
  meta.append(createPill(formatDateLabel(item), "date-pill"));
  card.append(meta);

  const title = document.createElement("h2");
  title.className = "case-title";
  title.textContent = item["案例/来源"];
  card.append(title);

  const fields = document.createElement("dl");
  fields.className = "field-list";
  getBodyFieldOrder().forEach((column) => {
    fields.append(createField(column, item[column]));
  });
  card.append(fields);

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

  if (categoryIsUnknown && subcategoryIsUnknown) {
    meta.append(createPill(UNCATEGORIZED, "unknown-pill"));
    return;
  }

  meta.append(createPill(category, categoryIsUnknown ? "unknown-pill" : ""));
  if (subcategory !== category && !subcategoryIsUnknown) {
    meta.append(createPill(subcategory));
  }
}

function createPill(text, extraClass = "") {
  const pill = document.createElement("span");
  pill.className = `pill ${extraClass}`.trim();
  pill.textContent = text || "未填写";
  return pill;
}

function createField(column, value) {
  const fieldStyle = FIELD_STYLE_CONFIG[column] || {};
  const wrapper = document.createElement("div");
  wrapper.className = `field ${fieldStyle.className || ""}`.trim();
  wrapper.classList.toggle("is-focused", state.focusField === column);
  wrapper.classList.toggle("is-dimmed", Boolean(state.focusField) && state.focusField !== column);

  const term = document.createElement("dt");
  term.textContent = COLUMN_CONFIG[column].label;

  const desc = document.createElement("dd");
  const text = cleanText(value);
  const tokens = splitFieldTokens(text);
  if (tokens.length > 1) {
    const tokenList = document.createElement("span");
    tokenList.className = "token-list";
    tokens.forEach((token) => {
      const chip = document.createElement("span");
      chip.className = "field-token";
      chip.textContent = token;
      tokenList.append(chip);
    });
    desc.append(tokenList);
  } else {
    desc.textContent = text || "未填写";
  }
  desc.classList.toggle("muted", !text);

  wrapper.append(term, desc);
  return wrapper;
}

function splitFieldTokens(text) {
  if (!text || text.length > 260) return [];
  return text
    .split(TOKEN_SPLIT_PATTERN)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2)
    .slice(0, 6);
}

function syncFocusButtons() {
  els.focusControl.querySelectorAll("[data-focus-field]").forEach((button) => {
    button.classList.toggle("active", button.dataset.focusField === state.focusField);
  });
}

function getBodyFieldOrder() {
  if (!state.focusField || !BODY_FIELDS.includes(state.focusField)) {
    return BODY_FIELDS;
  }
  return [state.focusField, ...BODY_FIELDS.filter((column) => column !== state.focusField)];
}

function formatDateLabel(item) {
  if (item[DATE_ISO_FIELD]) return item[DATE_ISO_FIELD].slice(0, 7);
  return item["案例日期"] || "日期未知";
}

function withAlpha(hex, alpha) {
  const match = String(hex).replace("#", "").match(/^([0-9a-f]{6})$/i);
  if (!match) return "rgba(37, 99, 235, 0.1)";
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
