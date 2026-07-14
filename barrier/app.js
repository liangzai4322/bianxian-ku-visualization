const LIBRARY_CONFIG = {
  "slug": "barrier",
  "title": "壁垒库",
  "subtitle": "竞争壁垒雷达",
  "kicker": "Barrier Radar",
  "description": "按壁垒类型、建立周期和可攻破性判断防守质量。",
  "csvFile": "壁垒库.csv",
  "styleName": "Linear",
  "globalName": "__BARRIER_LIBRARY_DATA__",
  "pageSize": 100,
  "uncategorized": "未分类",
  "titleField": "案例名称",
  "dateField": "案例日期",
  "categoryField": "大分类",
  "subcategoryField": "细分赛道",
  "coreFields": [
    "壁垒类型",
    "壁垒描述",
    "建立周期",
    "可攻破性"
  ],
  "supportFields": [],
  "fieldStyles": {
    "壁垒类型": {
      "className": "field-a",
      "label": "壁垒类型",
      "hint": "防守结构"
    },
    "壁垒描述": {
      "className": "field-b",
      "label": "壁垒描述",
      "hint": "护城河细节"
    },
    "建立周期": {
      "className": "field-c",
      "label": "建立周期",
      "hint": "形成成本"
    },
    "可攻破性": {
      "className": "field-d",
      "label": "可攻破性",
      "hint": "突破难度"
    }
  },
  "tokenSeed": [
    "资源",
    "信任",
    "数据",
    "供应链",
    "渠道",
    "品牌",
    "长期",
    "短期",
    "难",
    "低"
  ],
  "columnConfig": {
    "库名": {
      "label": "库名",
      "area": "hidden",
      "show": false
    },
    "来源文件": {
      "label": "来源文件",
      "area": "hidden",
      "show": false
    },
    "案例名称": {
      "label": "案例名称",
      "area": "meta",
      "show": true
    },
    "大分类": {
      "label": "大分类",
      "area": "meta",
      "show": true
    },
    "细分赛道": {
      "label": "细分赛道",
      "area": "meta",
      "show": true
    },
    "案例日期": {
      "label": "案例日期",
      "area": "meta",
      "show": true
    },
    "壁垒类型": {
      "label": "壁垒类型",
      "area": "core",
      "show": true
    },
    "壁垒描述": {
      "label": "壁垒描述",
      "area": "core",
      "show": true
    },
    "建立周期": {
      "label": "建立周期",
      "area": "core",
      "show": true
    },
    "可攻破性": {
      "label": "可攻破性",
      "area": "core",
      "show": true
    },
    "小分类": {
      "label": "小分类",
      "area": "hidden",
      "show": false
    }
  },
  "theme": {
    "design": "Linear",
    "body_class": "theme-linear",
    "accent": "#5e6ad2",
    "accent_2": "#22d3ee",
    "canvas": "#010102",
    "surface": "#0f1011",
    "surface_2": "#17181c",
    "text": "#f7f8f8",
    "muted": "#a1a1aa",
    "line": "#27272f",
    "shadow": "0 16px 40px rgba(0, 0, 0, 0.36)"
  }
};
const COLUMN_CONFIG = LIBRARY_CONFIG.columnConfig;
const PAGE_SIZE = LIBRARY_CONFIG.pageSize;
const UNCATEGORIZED = LIBRARY_CONFIG.uncategorized;
const TITLE_FIELD = LIBRARY_CONFIG.titleField;
const DATE_FIELD = LIBRARY_CONFIG.dateField;
const CATEGORY_FIELD = LIBRARY_CONFIG.categoryField;
const SUBCATEGORY_FIELD = LIBRARY_CONFIG.subcategoryField;
const CORE_FIELDS = LIBRARY_CONFIG.coreFields;
const SUPPORT_FIELDS = LIBRARY_CONFIG.supportFields;
const FIELD_STYLE_CONFIG = LIBRARY_CONFIG.fieldStyles;
const DATE_ISO_FIELD = "案例日期_ISO";
const DATE_TS_FIELD = "案例日期_TS";
const RAW_INDEX_FIELD = "__rawIndex";
const TOKEN_SPLIT_PATTERN = /\s*(?:,|，|、|\+|\/|；|;|｜|\||→|->|：|:|\n)\s*/;

const MONTHS = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3,
  apr: 4, april: 4, may: 5, jun: 6, june: 6, jul: 7, july: 7,
  aug: 8, august: 8, sep: 9, sept: 9, september: 9,
  oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
};

const CATEGORY_COLORS = [
  "#2563eb", "#10b981", "#f97316", "#e11d48", "#8b5cf6",
  "#06b6d4", "#84cc16", "#f59e0b", "#ec4899", "#14b8a6",
];

const TAG_COLORS = buildTagColors(LIBRARY_CONFIG.tokenSeed || []);

const state = {
  allItems: [],
  filteredItems: [],
  categoryStats: new Map(),
  category: "",
  subcategory: "",
  search: "",
  sort: "desc",
  visibleCount: PAGE_SIZE,
  focusField: CORE_FIELDS[0] || "",
  viewMode: "grouped",
  expanded: new Set(),
};

const els = {};

document.addEventListener("DOMContentLoaded", init);

async function init() {
  cacheElements();
  bindEvents();
  syncFocusButtons();
  try {
    state.allItems = await loadData();
    buildStats();
    buildFilters();
    renderCategoryTree();
    applyFilters();
  } catch (error) {
    showError(error);
  }
}

function cacheElements() {
  els.totalCount = document.querySelector("#totalCount");
  els.categoryTree = document.querySelector("#categoryTree");
  els.searchInput = document.querySelector("#searchInput");
  els.categoryFilter = document.querySelector("#categoryFilter");
  els.subcategoryFilter = document.querySelector("#subcategoryFilter");
  els.sortSelect = document.querySelector("#sortSelect");
  els.focusControl = document.querySelector("#focusControl");
  els.viewModeToggle = document.querySelector("#viewModeToggle");
  els.resultInfo = document.querySelector("#resultInfo");
  els.clearButton = document.querySelector("#clearButton");
  els.cardGrid = document.querySelector("#cardGrid");
  els.emptyState = document.querySelector("#emptyState");
  els.errorState = document.querySelector("#errorState");
  els.errorMessage = document.querySelector("#errorMessage");
  els.loadMoreButton = document.querySelector("#loadMoreButton");
  els.resetButton = document.querySelector("[data-reset-filter]");
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
    syncExpandedCategory();
    buildSubcategoryFilter();
    renderCategoryTree();
    applyFilters();
  });

  els.subcategoryFilter.addEventListener("change", () => {
    state.subcategory = els.subcategoryFilter.value;
    state.visibleCount = PAGE_SIZE;
    renderCategoryTree();
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

  els.clearButton.addEventListener("click", clearFilters);
  els.resetButton.addEventListener("click", clearFilters);

  els.categoryTree.addEventListener("click", (event) => {
    const subcategoryButton = event.target.closest("[data-subcategory]");
    const categoryButton = event.target.closest("[data-category]");
    if (subcategoryButton) {
      state.category = subcategoryButton.dataset.parentCategory;
      state.subcategory = subcategoryButton.dataset.subcategory;
      state.visibleCount = PAGE_SIZE;
      state.expanded.add(state.category);
      syncFilterControls();
      renderCategoryTree();
      applyFilters();
      return;
    }
    if (categoryButton) {
      const category = categoryButton.dataset.category;
      state.category = state.category === category && !state.subcategory ? "" : category;
      state.subcategory = "";
      state.visibleCount = PAGE_SIZE;
      syncExpandedCategory();
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
  const globalPayload = window[LIBRARY_CONFIG.globalName];
  if (globalPayload && Array.isArray(globalPayload.items)) {
    return normalizeItems(globalPayload.items);
  }

  try {
    const response = await fetch("data.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`JSON 加载失败：${response.status}`);
    const json = await response.json();
    return normalizeItems(Array.isArray(json) ? json : json.items || []);
  } catch (jsonError) {
    const response = await fetch(`../${LIBRARY_CONFIG.csvFile}`, { cache: "no-store" });
    if (!response.ok) throw jsonError;
    return normalizeItems(parseCsv(await response.text()));
  }
}

function normalizeItems(rows) {
  return rows.map((row, index) => {
    const item = { ...row };
    Object.keys(COLUMN_CONFIG).forEach((field) => {
      item[field] = cleanText(item[field]);
    });
    item[TITLE_FIELD] = item[TITLE_FIELD] || `未命名案例 ${index + 1}`;
    item[CATEGORY_FIELD] = item[CATEGORY_FIELD] || UNCATEGORIZED;
    item[SUBCATEGORY_FIELD] = item[SUBCATEGORY_FIELD] || UNCATEGORIZED;
    if (!item[DATE_ISO_FIELD] || !item[DATE_TS_FIELD]) {
      const parsed = parseCaseDate(item[DATE_FIELD]);
      item[DATE_ISO_FIELD] = parsed.iso;
      item[DATE_TS_FIELD] = parsed.timestamp;
    }
    item[RAW_INDEX_FIELD] = Number.isFinite(Number(item[RAW_INDEX_FIELD])) ? Number(item[RAW_INDEX_FIELD]) : index;
    return item;
  });
}

function buildStats() {
  state.categoryStats = new Map();
  state.allItems.forEach((item) => {
    const category = item[CATEGORY_FIELD] || UNCATEGORIZED;
    const subcategory = item[SUBCATEGORY_FIELD] || UNCATEGORIZED;
    if (!state.categoryStats.has(category)) {
      state.categoryStats.set(category, { count: 0, subcategories: new Map(), color: CATEGORY_COLORS[state.categoryStats.size % CATEGORY_COLORS.length] });
    }
    const cat = state.categoryStats.get(category);
    cat.count += 1;
    cat.subcategories.set(subcategory, (cat.subcategories.get(subcategory) || 0) + 1);
  });
  els.totalCount.textContent = String(state.allItems.length);
}

function buildFilters() {
  buildCategoryFilter();
  buildSubcategoryFilter();
}

function buildCategoryFilter() {
  els.categoryFilter.replaceChildren(createOption("", "全部大分类"));
  getSortedCategories().forEach(([category, stats]) => {
    els.categoryFilter.append(createOption(category, `${category} (${stats.count})`));
  });
}

function buildSubcategoryFilter() {
  els.subcategoryFilter.replaceChildren(createOption("", "全部细分赛道"));
  const categories = state.category ? [[state.category, state.categoryStats.get(state.category)]] : getSortedCategories();
  const seen = new Map();
  categories.forEach(([, stats]) => {
    if (!stats) return;
    stats.subcategories.forEach((count, subcategory) => {
      seen.set(subcategory, (seen.get(subcategory) || 0) + count);
    });
  });
  [...seen.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "zh-Hans-CN"))
    .forEach(([subcategory, count]) => {
      els.subcategoryFilter.append(createOption(subcategory, `${subcategory} (${count})`));
    });
}

function createOption(value, label) {
  const option = document.createElement("option");
  option.value = value;
  option.textContent = label;
  return option;
}

function renderCategoryTree() {
  els.categoryTree.replaceChildren();
  els.resetButton.classList.toggle("active", !state.category && !state.subcategory);
  getSortedCategories().forEach(([category, stats]) => {
    const group = document.createElement("div");
    group.className = "category-group";

    const button = document.createElement("button");
    button.type = "button";
    button.className = "category-button";
    button.dataset.category = category;
    button.classList.toggle("active", state.category === category && !state.subcategory);
    button.style.setProperty("--category-color", stats.color);
    button.innerHTML = `<span>${escapeHtml(category)}</span><b class="count">${stats.count}</b>`;
    group.append(button);

    const expanded = state.expanded.has(category) || state.category === category;
    if (expanded) {
      const list = document.createElement("div");
      list.className = "subcategory-list";
      [...stats.subcategories.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "zh-Hans-CN"))
        .forEach(([subcategory, count]) => {
          const subButton = document.createElement("button");
          subButton.type = "button";
          subButton.className = "subcategory-button";
          subButton.dataset.parentCategory = category;
          subButton.dataset.subcategory = subcategory;
          subButton.classList.toggle("active", state.category === category && state.subcategory === subcategory);
          subButton.innerHTML = `<span>${escapeHtml(subcategory)}</span><b class="count">${count}</b>`;
          list.append(subButton);
        });
      group.append(list);
    }
    els.categoryTree.append(group);
  });
}

function getSortedCategories() {
  return [...state.categoryStats.entries()].sort((a, b) => b[1].count - a[1].count || a[0].localeCompare(b[0], "zh-Hans-CN"));
}

function syncExpandedCategory() {
  if (state.category) state.expanded.add(state.category);
}

function syncFilterControls() {
  els.categoryFilter.value = state.category;
  buildSubcategoryFilter();
  els.subcategoryFilter.value = state.subcategory;
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

function clearFilters() {
  state.category = "";
  state.subcategory = "";
  state.search = "";
  state.visibleCount = PAGE_SIZE;
  els.searchInput.value = "";
  syncFilterControls();
  renderCategoryTree();
  applyFilters();
}

function applyFilters() {
  const search = state.search;
  state.filteredItems = state.allItems
    .filter((item) => {
      if (state.category && item[CATEGORY_FIELD] !== state.category) return false;
      if (state.subcategory && item[SUBCATEGORY_FIELD] !== state.subcategory) return false;
      if (!search) return true;
      return buildSearchText(item).includes(search);
    })
    .sort(sortByDate);
  renderCards();
}

function sortByDate(a, b) {
  const diff = Number(a[DATE_TS_FIELD] || 0) - Number(b[DATE_TS_FIELD] || 0);
  if (diff !== 0) return state.sort === "asc" ? diff : -diff;
  return Number(a[RAW_INDEX_FIELD] || 0) - Number(b[RAW_INDEX_FIELD] || 0);
}

function buildSearchText(item) {
  return [TITLE_FIELD, CATEGORY_FIELD, SUBCATEGORY_FIELD, DATE_FIELD, ...CORE_FIELDS, ...SUPPORT_FIELDS]
    .map((field) => item[field] || "")
    .join(" ")
    .toLowerCase();
}

function renderCards() {
  els.cardGrid.replaceChildren();
  const visible = state.filteredItems.slice(0, state.visibleCount);
  const fragment = document.createDocumentFragment();
  visible.forEach((item) => fragment.append(createCard(item)));
  els.cardGrid.append(fragment);

  els.resultInfo.textContent = `当前 ${state.filteredItems.length} 条 · 已显示 ${visible.length} 条`;
  els.emptyState.hidden = state.filteredItems.length > 0;
  els.errorState.hidden = true;
  els.loadMoreButton.hidden = visible.length >= state.filteredItems.length;
}

function createCard(item) {
  const card = document.createElement("article");
  card.className = "case-card";
  card.dataset.caseRecord = String(item[RAW_INDEX_FIELD]);
  card.classList.toggle("merged-view", state.viewMode === "merged");
  const categoryStats = state.categoryStats.get(item[CATEGORY_FIELD]);
  card.style.setProperty("--category-color", categoryStats?.color || LIBRARY_CONFIG.theme.accent);

  const inner = document.createElement("div");
  inner.className = "card-inner";

  const meta = document.createElement("div");
  meta.className = "card-meta";
  appendMetaPills(meta, item);
  meta.append(createPill(formatDateLabel(item), "date-pill"));
  inner.append(meta);

  const title = document.createElement("h2");
  title.className = "case-title";
  title.textContent = item[TITLE_FIELD];
  inner.append(title);

  if (state.viewMode === "merged") {
    inner.append(createMergedSummary(item));
  } else {
    const fields = document.createElement("dl");
    fields.className = "field-list";
    getBodyFieldOrder().forEach((column) => fields.append(createField(column, item[column])));
    inner.append(fields);
  }

  const details = createSupportDetails(item);
  if (details) inner.append(details);

  card.append(inner);
  return card;
}

function appendMetaPills(meta, item) {
  const category = item[CATEGORY_FIELD] || UNCATEGORIZED;
  const subcategory = item[SUBCATEGORY_FIELD] || UNCATEGORIZED;
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

function createField(column, value) {
  const fieldStyle = FIELD_STYLE_CONFIG[column] || {};
  const wrapper = document.createElement("div");
  wrapper.className = `field ${fieldStyle.className || ""}`.trim();
  wrapper.classList.toggle("is-focused", state.focusField === column);
  wrapper.classList.toggle("is-dimmed", Boolean(state.focusField) && state.focusField !== column);

  const term = document.createElement("dt");
  term.textContent = COLUMN_CONFIG[column]?.label || column;
  if (fieldStyle.hint) {
    const hint = document.createElement("small");
    hint.textContent = fieldStyle.hint;
    term.append(hint);
  }

  const desc = document.createElement("dd");
  const text = cleanText(value);
  const tags = getFieldTags(text, column);
  if (tags.length) {
    tags.forEach((tag) => desc.append(createToken(tag)));
  } else {
    desc.textContent = text || "未填写";
  }
  wrapper.append(term, desc);
  return wrapper;
}

function createMergedSummary(item) {
  const summary = document.createElement("p");
  summary.className = "merged-summary";
  summary.textContent = buildMergedSentence(item);
  return summary;
}

function buildMergedSentence(item) {
  if (LIBRARY_CONFIG.slug === "demand") {
    return [
      `这个需求来自${valueOrUnknown(item["目标人群"])}`,
      `核心痛点是${valueOrUnknown(item["核心痛点"])}`,
      `典型需求场景是${valueOrUnknown(item["需求场景"])}`,
      `需求强度为${valueOrUnknown(item["需求强度"])}`,
    ].join("，") + "。";
  }
  if (LIBRARY_CONFIG.slug === "barrier") {
    return [
      `这个案例的主要壁垒是${valueOrUnknown(item["壁垒类型"])}`,
      `壁垒描述为${valueOrUnknown(item["壁垒描述"])}`,
      `建立周期是${valueOrUnknown(item["建立周期"])}`,
      `可攻破性判断为${valueOrUnknown(item["可攻破性"])}`,
    ].join("，") + "。";
  }
  if (LIBRARY_CONFIG.slug === "case") {
    return [
      `这个案例所在行业/赛道是${valueOrUnknown(item["行业/赛道"])}`,
      `核心反常识点是${valueOrUnknown(item["核心反常识点"])}`,
      `壁垒强度评级为${valueOrUnknown(item["壁垒强度评级"])}`,
      `案例来源是${valueOrUnknown(item["案例来源(文件地址/文章链接)"])}`,
    ].join("，") + "。";
  }
  return CORE_FIELDS.map((field) => `${COLUMN_CONFIG[field]?.label || field}是${valueOrUnknown(item[field])}`).join("，") + "。";
}

function valueOrUnknown(value) {
  return cleanText(value) || "未填写";
}

function createSupportDetails(item) {
  const rows = SUPPORT_FIELDS
    .filter((field) => !CORE_FIELDS.includes(field))
    .map((field) => [COLUMN_CONFIG[field]?.label || field, cleanText(item[field])])
    .filter(([, value]) => value);
  if (!rows.length) return null;
  const detail = document.createElement("details");
  detail.className = "detail";
  const summary = document.createElement("summary");
  summary.textContent = rows.map(([label]) => label).join(" / ");
  detail.append(summary);
  rows.forEach(([label, value]) => {
    const p = document.createElement("p");
    p.textContent = `${label}：${value}`;
    detail.append(p);
  });
  return detail;
}

function getBodyFieldOrder() {
  if (!state.focusField || !CORE_FIELDS.includes(state.focusField)) return CORE_FIELDS;
  return [state.focusField, ...CORE_FIELDS.filter((column) => column !== state.focusField)];
}

function getFieldTags(text, column) {
  if (!text) return [];
  const splitTokens = text
    .split(TOKEN_SPLIT_PATTERN)
    .map((token) => token.trim())
    .filter((token) => token.length >= 1 && token.length <= 24);

  const seeded = (LIBRARY_CONFIG.tokenSeed || []).filter((token) => text.includes(token));
  const compact = splitTokens.length > 1 ? splitTokens : extractCompactPhrases(text, column);
  const limit = column === state.focusField ? 9 : 6;
  return [...new Set([...seeded, ...compact])].filter(Boolean).slice(0, limit);
}

function extractCompactPhrases(text, column) {
  const shortText = text.replace(/[。！？!?]/g, "，");
  const phrases = shortText
    .split(/，|、|；|;|\s+/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 2 && item.length <= 22);
  if (phrases.length) return phrases;
  if (text.length <= 24) return [text];
  if (column === state.focusField) return [text.slice(0, 22), text.slice(22, 44)].filter(Boolean);
  return [text.slice(0, 24)];
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

function createPill(text, extraClass = "") {
  const pill = document.createElement("span");
  pill.className = `pill ${extraClass}`.trim();
  pill.textContent = text || "未填写";
  return pill;
}

function buildTagColors(seed) {
  const colors = {};
  seed.forEach((token) => {
    colors[token] = tagColorFromText(token);
  });
  return colors;
}

function tagColorFromText(text) {
  const hue = stableHue(text);
  return [`hsl(${hue}, 72%, 34%)`, `hsl(${hue}, 88%, 94%)`];
}

function stableHue(text) {
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) hash = (hash * 31 + text.charCodeAt(i)) % 360;
  return hash;
}

function formatDateLabel(item) {
  if (item[DATE_ISO_FIELD]) return item[DATE_ISO_FIELD].slice(0, 7);
  return item[DATE_FIELD] || "日期未知";
}

function parseCaseDate(value) {
  const text = cleanText(value);
  if (!text) return { iso: "", timestamp: 0 };
  const normalized = text.replace(/[_/. ]+/g, "-");
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
  if (!match) return `rgba(37, 99, 235, ${alpha})`;
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
      } else {
        inQuotes = !inQuotes;
      }
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
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }
    cell += char;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  const headers = (rows.shift() || []).map((header) => cleanText(header));
  return rows
    .filter((values) => values.some((value) => cleanText(value)))
    .map((values) => {
      const item = {};
      headers.forEach((header, index) => {
        item[header] = cleanText(values[index]);
      });
      return item;
    });
}

function cleanText(value) {
  return String(value ?? "").replace(/^\uFEFF/, "").replace(/\s+/g, " ").trim();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
