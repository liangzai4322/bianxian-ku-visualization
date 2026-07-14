"use strict";

const COLUMN_CONFIG = Object.freeze({
  "产品形态": Object.freeze({ label: "产品形态", rawKey: "产品形态", className: "field-product", theme: "product" }),
  "定价策略": Object.freeze({ label: "定价策略", rawKey: "定价策略", className: "field-price", theme: "price" }),
  "付费模型": Object.freeze({ label: "付费模型", rawKey: "付费模型", className: "field-model", theme: "model" }),
  "复购机制": Object.freeze({ label: "复购机制", rawKey: "复购机制", className: "field-repeat", theme: "repeat" }),
});
const FULL_DATA_SCRIPT = "data-20260704-130112.js";
const CASE_PAGE_SIZE = 30;
const FULL_DATA_GLOBAL = "MONETIZATION_DATA";
const RAW_INDEX_FIELD = "__rawIndex";
const EVIDENCE_FIELD = "证据/备注";
const UNCATEGORIZED = "未分类";
const DEFAULT_FOCUS_FIELD = "产品形态";
const FOCUS_FIELDS = Object.freeze(Object.keys(COLUMN_CONFIG));
const CATEGORY_COLORS = Object.freeze([
  "#2563eb",
  "#059669",
  "#b45309",
  "#7c3aed",
  "#dc2626",
  "#0891b2",
  "#4f46e5",
  "#15803d",
  "#c2410c",
  "#be123c",
  "#0f766e",
  "#9333ea",
]);
const COLLATOR = new Intl.Collator("zh-Hans-CN", { numeric: true, sensitivity: "base" });
const PERCENT_FORMATTER = new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 1 });

const state = {
  payload: null,
  records: [],
  filteredRecords: [],
  patterns: [],
  categoryColors: new Map(),
  search: "",
  category: "",
  subcategory: "",
  sort: "desc",
  focusField: DEFAULT_FOCUS_FIELD,
  view: "patterns",
  selectedPattern: null,
  visibleCaseCount: CASE_PAGE_SIZE,
  fullDataPromise: null,
  fullRecords: null,
  fullBySourceIndex: new Map(),
  fullByCompositeKey: new Map(),
};

const els = {};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init, { once: true });
} else {
  init();
}

function init() {
  try {
    cacheElements();
    bindEvents();

    state.payload = readPatternPayload();
    state.records = state.payload.records.map(normalizePatternRecord);
    assignCategoryColors();
    buildCategoryFilter();
    syncSubcategoryFilter();
    syncControls();
    applyFilters();
  } catch (error) {
    showFatalError(error);
  }
}

function cacheElements() {
  const ids = [
    "totalCount",
    "searchInput",
    "categoryFilter",
    "subcategoryFilter",
    "sortSelect",
    "focusControl",
    "resetFilters",
    "viewControl",
    "resultInfo",
    "loadingState",
    "patternView",
    "focusFieldName",
    "coverageValue",
    "patternList",
    "caseView",
    "caseHeading",
    "activePatternText",
    "backToPatterns",
    "cardGrid",
    "loadMoreButton",
    "emptyState",
    "errorState",
    "errorMessage",
  ];

  ids.forEach((id) => {
    const element = document.getElementById(id);
    if (!element) throw new Error(`页面缺少必要节点 #${id}`);
    els[id] = element;
  });

  els.emptyTitle = els.emptyState.querySelector("strong");
  els.emptyDescription = els.emptyState.querySelector("span");
  if (!els.emptyTitle || !els.emptyDescription) {
    throw new Error("空状态缺少标题或说明节点");
  }
}

function bindEvents() {
  els.searchInput.addEventListener("input", () => {
    state.search = normalizeSearch(els.searchInput.value);
    resetCasePage();
    applyFilters();
  });

  els.categoryFilter.addEventListener("change", () => {
    state.category = els.categoryFilter.value;
    state.subcategory = "";
    resetCasePage();
    syncSubcategoryFilter();
    applyFilters();
  });

  els.subcategoryFilter.addEventListener("change", () => {
    state.subcategory = els.subcategoryFilter.value;
    resetCasePage();
    applyFilters();
  });

  els.sortSelect.addEventListener("change", () => {
    state.sort = els.sortSelect.value === "asc" ? "asc" : "desc";
    resetCasePage();
    applyFilters();
  });

  els.focusControl.addEventListener("click", (event) => {
    const button = event.target.closest("[data-focus-field]");
    if (!button || !els.focusControl.contains(button)) return;

    const field = button.dataset.focusField;
    if (!FOCUS_FIELDS.includes(field) || field === state.focusField) return;

    state.focusField = field;
    state.selectedPattern = null;
    resetCasePage();
    applyFilters();
  });

  els.resetFilters.addEventListener("click", resetFilters);

  els.viewControl.addEventListener("click", (event) => {
    const button = event.target.closest("[data-view]");
    if (!button || !els.viewControl.contains(button)) return;

    const view = button.dataset.view;
    if (view !== "patterns" && view !== "cases") return;

    state.view = view;
    state.selectedPattern = null;
    resetCasePage();
    render();
  });

  els.patternList.addEventListener("click", (event) => {
    const row = event.target.closest("[data-pattern-tag]");
    if (!row || !els.patternList.contains(row)) return;
    selectPattern(row.dataset.patternTag);
  });

  els.patternList.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const row = event.target.closest("[data-pattern-tag]");
    if (!row || !els.patternList.contains(row)) return;
    event.preventDefault();
    selectPattern(row.dataset.patternTag);
  });

  els.backToPatterns.addEventListener("click", () => {
    if (state.selectedPattern) {
      state.selectedPattern = null;
      resetCasePage();
      render();
      return;
    }

    state.view = "patterns";
    resetCasePage();
    render();
  });

  els.loadMoreButton.addEventListener("click", () => {
    state.visibleCaseCount += CASE_PAGE_SIZE;
    renderCaseView(getActiveCaseRecords());
  });
}

function readPatternPayload() {
  const payload = window.__MONETIZATION_PATTERNS__;
  if (!payload || typeof payload !== "object") {
    throw new Error("未找到 window.__MONETIZATION_PATTERNS__，请确认轻量索引脚本已成功加载。");
  }
  if (!Array.isArray(payload.records)) {
    throw new Error("轻量模式索引结构无效：records 必须是数组。");
  }
  if (!payload.records.length) {
    throw new Error("轻量模式索引中没有案例记录。");
  }
  return payload;
}

function normalizePatternRecord(record, index) {
  const fields = {};
  FOCUS_FIELDS.forEach((field) => {
    const tags = record?.fields?.[field]?.canonicalTags;
    fields[field] = {
      canonicalTags: uniqueStrings(Array.isArray(tags) ? tags : []),
    };
  });

  const normalized = {
    id: cleanText(record?.id) || `monetization-${index + 1}`,
    sourceIndex: toPositiveNumber(record?.sourceIndex) || index + 1,
    title: cleanText(record?.title) || `未命名案例 ${index + 1}`,
    category: cleanText(record?.category) || UNCATEGORIZED,
    subcategory: cleanText(record?.subcategory) || UNCATEGORIZED,
    date: cleanText(record?.date),
    dateLabel: cleanText(record?.dateLabel),
    timestamp: Number(record?.timestamp) || 0,
    fields,
  };

  normalized.searchText = normalizeSearch([
    normalized.title,
    normalized.category,
    normalized.subcategory,
    normalized.date,
    normalized.dateLabel,
    ...FOCUS_FIELDS.flatMap((field) => normalized.fields[field].canonicalTags),
  ].join(" "));

  return normalized;
}

function assignCategoryColors() {
  state.categoryColors.clear();
  getCategoryCounts().forEach(([category], index) => {
    state.categoryColors.set(category, CATEGORY_COLORS[index % CATEGORY_COLORS.length]);
  });
}

function buildCategoryFilter() {
  const options = [["", "全部一级分类"]];
  getCategoryCounts().forEach(([category, count]) => {
    options.push([category, `${category}（${count}）`]);
  });
  fillSelect(els.categoryFilter, options);
}

function syncSubcategoryFilter() {
  state.subcategory = "";

  if (!state.category) {
    fillSelect(els.subcategoryFilter, [["", "请先选择一级分类"]]);
    els.subcategoryFilter.disabled = true;
    els.subcategoryFilter.setAttribute("aria-disabled", "true");
    els.subcategoryFilter.title = "选择一级分类后可用";
    return;
  }

  const counts = new Map();
  state.records.forEach((record) => {
    if (record.category !== state.category) return;
    counts.set(record.subcategory, (counts.get(record.subcategory) || 0) + 1);
  });

  const options = [["", "全部细分类别"]];
  [...counts.entries()]
    .sort(([a], [b]) => localeSort(a, b))
    .forEach(([subcategory, count]) => {
      options.push([subcategory, `${subcategory}（${count}）`]);
    });

  fillSelect(els.subcategoryFilter, options);
  els.subcategoryFilter.disabled = false;
  els.subcategoryFilter.setAttribute("aria-disabled", "false");
  els.subcategoryFilter.title = "";
}

function fillSelect(select, options) {
  const fragment = document.createDocumentFragment();
  options.forEach(([value, label]) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    fragment.append(option);
  });
  select.replaceChildren(fragment);
}

function getCategoryCounts() {
  const counts = new Map();
  state.records.forEach((record) => {
    counts.set(record.category, (counts.get(record.category) || 0) + 1);
  });
  return [...counts.entries()].sort(([a], [b]) => localeSort(a, b));
}

function resetFilters() {
  state.search = "";
  state.category = "";
  state.subcategory = "";
  state.sort = "desc";
  state.selectedPattern = null;
  resetCasePage();

  els.searchInput.value = "";
  els.categoryFilter.value = "";
  els.sortSelect.value = "desc";
  syncSubcategoryFilter();
  applyFilters();
}

function syncControls() {
  els.searchInput.value = state.search;
  els.categoryFilter.value = state.category;
  els.subcategoryFilter.value = state.subcategory;
  els.sortSelect.value = state.sort;

  els.focusControl.querySelectorAll("[data-focus-field]").forEach((button) => {
    const active = button.dataset.focusField === state.focusField;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });

  els.viewControl.querySelectorAll("[data-view]").forEach((button) => {
    const active = button.dataset.view === state.view;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });

  document.body.dataset.focusTheme = COLUMN_CONFIG[state.focusField].theme;
}

function applyFilters() {
  state.filteredRecords = state.records
    .filter((record) => {
      if (state.category && record.category !== state.category) return false;
      if (state.subcategory && record.subcategory !== state.subcategory) return false;
      if (state.search && !record.searchText.includes(state.search)) return false;
      return true;
    })
    .sort(compareRecordsByDate);

  state.patterns = aggregatePatterns(state.filteredRecords, state.focusField);
  render();
}

function compareRecordsByDate(a, b) {
  const aTime = Number(a.timestamp) || 0;
  const bTime = Number(b.timestamp) || 0;

  if (!aTime && bTime) return 1;
  if (aTime && !bTime) return -1;
  if (aTime !== bTime) return state.sort === "asc" ? aTime - bTime : bTime - aTime;
  return a.sourceIndex - b.sourceIndex;
}

function aggregatePatterns(records, field) {
  const aggregate = new Map();

  records.forEach((record) => {
    const tags = new Set(record.fields[field].canonicalTags);
    tags.forEach((tag) => {
      if (!aggregate.has(tag)) {
        aggregate.set(tag, { tag, records: [], categories: new Map() });
      }
      const entry = aggregate.get(tag);
      entry.records.push(record);
      entry.categories.set(record.category, (entry.categories.get(record.category) || 0) + 1);
    });
  });

  return [...aggregate.values()]
    .map((entry) => {
      const categoryEntries = [...entry.categories.entries()].sort(
        ([categoryA, countA], [categoryB, countB]) => countB - countA || localeSort(categoryA, categoryB),
      );
      const count = entry.records.length;
      return {
        tag: entry.tag,
        count,
        percentage: records.length ? count / records.length * 100 : 0,
        primaryCategory: categoryEntries[0]?.[0] || UNCATEGORIZED,
        representatives: entry.records.slice(0, 2),
      };
    })
    .sort((a, b) => b.count - a.count || localeSort(a.tag, b.tag));
}

function render() {
  els.loadingState.hidden = true;
  els.errorState.hidden = true;
  els.totalCount.textContent = String(state.payload.recordCount || state.records.length);
  els.focusFieldName.textContent = COLUMN_CONFIG[state.focusField].label;
  els.coverageValue.textContent = formatCoverage(state.focusField);
  syncControls();

  if (state.view === "patterns") {
    renderPatternView();
  } else {
    renderCaseView(getActiveCaseRecords());
  }
}

function renderPatternView() {
  els.caseView.hidden = true;
  els.cardGrid.replaceChildren();
  els.loadMoreButton.hidden = true;

  if (!state.filteredRecords.length) {
    els.patternView.hidden = true;
    els.patternList.replaceChildren();
    showEmpty("没有匹配结果", "调整搜索词、分类或清空筛选后再看。");
    els.resultInfo.textContent = "当前筛选范围没有案例";
    return;
  }

  if (!state.patterns.length) {
    els.patternView.hidden = true;
    els.patternList.replaceChildren();
    showEmpty("当前字段没有可排行模式", "请切换重点字段或调整筛选条件。");
    els.resultInfo.textContent = `筛选范围 ${state.filteredRecords.length} 条，暂无${state.focusField}规范标签`;
    return;
  }

  hideEmpty();
  els.patternView.hidden = false;
  renderPatternList();
  els.resultInfo.textContent = `筛选范围 ${state.filteredRecords.length} 条 · ${state.focusField}模式 ${state.patterns.length} 个`;
}

function renderPatternList() {
  const fragment = document.createDocumentFragment();

  state.patterns.forEach((pattern, index) => {
    const row = document.createElement("li");
    row.className = "pattern-row";
    row.dataset.patternTag = pattern.tag;
    row.tabIndex = 0;
    row.setAttribute("role", "button");
    row.setAttribute("aria-label", `查看${pattern.tag}模式的 ${pattern.count} 个案例`);

    const patternCell = document.createElement("span");
    patternCell.className = "pattern-name-cell";
    patternCell.append(
      createTextElement("span", String(index + 1), "pattern-rank"),
      createTextElement("strong", pattern.tag, "pattern-name"),
    );

    const metricCell = document.createElement("span");
    metricCell.className = "pattern-metric";
    const metricText = document.createElement("span");
    metricText.className = "pattern-metric-text";
    metricText.append(
      createTextElement("strong", String(pattern.count)),
      createTextElement("span", ` 条 · ${formatPercentage(pattern.percentage)}`),
    );
    const barTrack = document.createElement("span");
    barTrack.className = "pattern-bar-track";
    barTrack.setAttribute("aria-hidden", "true");
    const barFill = document.createElement("span");
    barFill.className = "pattern-bar-fill";
    barFill.style.width = `${clampPercentage(pattern.percentage)}%`;
    barTrack.append(barFill);
    metricCell.append(metricText, barTrack);

    const categoryCell = createTextElement("span", pattern.primaryCategory, "pattern-primary-category");

    const examplesCell = document.createElement("span");
    examplesCell.className = "pattern-examples";
    pattern.representatives.forEach((record) => {
      examplesCell.append(createTextElement("span", record.title, "pattern-example"));
    });

    const actionCell = createTextElement("span", "查看案例", "pattern-action");
    actionCell.setAttribute("aria-hidden", "true");

    row.append(patternCell, metricCell, categoryCell, examplesCell, actionCell);
    fragment.append(row);
  });

  els.patternList.replaceChildren(fragment);
}

function selectPattern(tag) {
  if (!state.patterns.some((pattern) => pattern.tag === tag)) return;
  state.selectedPattern = tag;
  state.view = "cases";
  resetCasePage();
  render();
  els.caseHeading.setAttribute("tabindex", "-1");
  els.caseHeading.focus({ preventScroll: true });
}

function getActiveCaseRecords() {
  if (!state.selectedPattern) return state.filteredRecords;
  return state.filteredRecords.filter((record) => (
    record.fields[state.focusField].canonicalTags.includes(state.selectedPattern)
  ));
}

function renderCaseView(caseRecords) {
  els.patternView.hidden = true;
  els.patternList.replaceChildren();
  updateCaseHeader(caseRecords.length);

  if (!caseRecords.length) {
    els.caseView.hidden = true;
    els.cardGrid.replaceChildren();
    els.loadMoreButton.hidden = true;
    showEmpty(
      state.selectedPattern ? "该模式下没有匹配案例" : "没有匹配结果",
      state.selectedPattern ? "调整筛选条件或清除当前模式后再看。" : "调整搜索词、分类或清空筛选后再看。",
    );
    els.resultInfo.textContent = state.selectedPattern
      ? `模式「${state.selectedPattern}」当前没有匹配案例`
      : "当前筛选范围没有案例";
    return;
  }

  hideEmpty();
  els.caseView.hidden = false;
  const visibleRecords = caseRecords.slice(0, state.visibleCaseCount);
  const fragment = document.createDocumentFragment();
  visibleRecords.forEach((record) => fragment.append(createCaseCard(record)));
  els.cardGrid.replaceChildren(fragment);

  const remaining = Math.max(0, caseRecords.length - visibleRecords.length);
  els.loadMoreButton.hidden = remaining === 0;
  els.loadMoreButton.textContent = remaining
    ? `显示更多（剩余 ${remaining} 条）`
    : "已显示全部案例";

  const scope = state.selectedPattern
    ? `模式「${state.selectedPattern}」命中 ${caseRecords.length} 条`
    : `筛选范围 ${caseRecords.length} 条`;
  els.resultInfo.textContent = `${scope} · 已显示 ${visibleRecords.length} 条`;
}

function updateCaseHeader(caseCount) {
  if (state.selectedPattern) {
    els.caseHeading.textContent = `${state.selectedPattern}案例`;
    els.activePatternText.textContent = `当前在「${state.focusField}」中选择该模式，共命中 ${caseCount} 条案例。`;
    els.backToPatterns.textContent = "清除模式";
    return;
  }

  els.caseHeading.textContent = "案例视图";
  els.activePatternText.textContent = `当前显示筛选范围内的全部 ${caseCount} 条案例。`;
  els.backToPatterns.textContent = "回到模式排行";
}

function createCaseCard(record) {
  const card = document.createElement("article");
  card.className = "case-card field-focus-active";
  const categoryColor = getCategoryColor(record.category);
  card.style.setProperty("--category-color", categoryColor);
  card.style.setProperty("--accent", categoryColor);
  card.style.setProperty("--accent-soft", withAlpha(categoryColor, 0.1));

  const meta = document.createElement("div");
  meta.className = "card-meta";
  meta.append(createPill(record.category));
  if (record.subcategory !== record.category) meta.append(createPill(record.subcategory));
  meta.append(createPill(formatDateLabel(record), "date-pill"));

  const title = createTextElement("h3", record.title, "case-title");
  const fields = document.createElement("dl");
  fields.className = "field-list canonical-field-list";
  getFocusOrderedFields().forEach((field) => {
    fields.append(createCanonicalField(field, record.fields[field].canonicalTags));
  });

  const detail = document.createElement("details");
  detail.className = "detail case-detail";
  const summary = createTextElement("summary", "查看原始四字段与依据");
  const detailContent = document.createElement("div");
  detailContent.className = "detail-content";
  detailContent.append(createTextElement("p", "展开后加载完整案例详情。", "detail-status"));
  detail.append(summary, detailContent);
  detail.addEventListener("toggle", () => {
    if (!detail.open || detail.dataset.requested === "true") return;
    detail.dataset.requested = "true";
    hydrateCaseDetail(record, detailContent);
  });

  card.append(meta, title, fields, detail);
  return card;
}

function createCanonicalField(field, tags) {
  const config = COLUMN_CONFIG[field];
  const wrapper = document.createElement("div");
  wrapper.className = `field canonical-field ${config.className}`;
  wrapper.classList.toggle("is-focused", field === state.focusField);
  wrapper.classList.toggle("is-dimmed", field !== state.focusField);

  const term = createTextElement("dt", config.label);
  const description = document.createElement("dd");
  const tokenList = document.createElement("span");
  tokenList.className = "token-list canonical-tags";
  const displayTags = tags.length ? tags : ["未识别"];
  displayTags.forEach((tag) => tokenList.append(createTextElement("span", tag, "field-token canonical-tag")));
  description.append(tokenList);
  wrapper.append(term, description);
  return wrapper;
}

function createPill(text, extraClass = "") {
  const value = cleanText(text) || UNCATEGORIZED;
  const pill = createTextElement("span", value, `pill ${extraClass}`.trim());
  if (value === UNCATEGORIZED) pill.classList.add("unknown-pill");
  return pill;
}

async function hydrateCaseDetail(record, container) {
  container.replaceChildren(createTextElement("p", "正在加载完整案例详情…", "detail-status loading"));

  try {
    await ensureFullData();
    const fullRecord = findFullRecord(record);
    if (!fullRecord) {
      throw new Error(`未能匹配完整记录（索引 ${record.sourceIndex}）`);
    }
    renderFullDetail(container, fullRecord);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    container.replaceChildren(createTextElement("p", `完整详情加载失败：${message}`, "detail-status error"));
  }
}

function ensureFullData() {
  if (state.fullDataPromise) return state.fullDataPromise;

  state.fullDataPromise = new Promise((resolve, reject) => {
    const complete = () => {
      try {
        const records = readFullRecordsFromWindow();
        if (!records) throw new Error(`脚本未提供 window.${FULL_DATA_GLOBAL} 数组`);
        indexFullRecords(records);
        resolve(records);
      } catch (error) {
        reject(error);
      }
    };

    if (readFullRecordsFromWindow()) {
      complete();
      return;
    }

    const configuredScript = cleanText(state.payload?.fullDataScript) || FULL_DATA_SCRIPT;
    const existingScript = document.querySelector("script[data-monetization-full-data]");
    if (existingScript) {
      existingScript.addEventListener("load", complete, { once: true });
      existingScript.addEventListener("error", () => reject(createFullDataLoadError(configuredScript)), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = configuredScript;
    script.async = true;
    script.dataset.monetizationFullData = "true";
    script.addEventListener("load", complete, { once: true });
    script.addEventListener("error", () => reject(createFullDataLoadError(configuredScript)), { once: true });
    document.head.append(script);
  });

  return state.fullDataPromise;
}

function readFullRecordsFromWindow() {
  const payload = window[FULL_DATA_GLOBAL];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.records)) return payload.records;
  if (Array.isArray(payload?.items)) return payload.items;
  return null;
}

function createFullDataLoadError(scriptName) {
  if (window.location.protocol === "file:") {
    return new Error(`无法读取 ${scriptName}，请确认它与页面位于同一目录。`);
  }
  return new Error(`无法加载完整详情脚本 ${scriptName}。`);
}

function indexFullRecords(records) {
  state.fullRecords = records;
  state.fullBySourceIndex.clear();
  state.fullByCompositeKey.clear();

  records.forEach((record) => {
    const sourceIndex = toPositiveNumber(record?.[RAW_INDEX_FIELD]);
    if (sourceIndex && !state.fullBySourceIndex.has(sourceIndex)) {
      state.fullBySourceIndex.set(sourceIndex, record);
    }

    const key = buildFullCompositeKey(record);
    if (!state.fullByCompositeKey.has(key)) state.fullByCompositeKey.set(key, []);
    state.fullByCompositeKey.get(key).push(record);
  });
}

function findFullRecord(record) {
  const indexed = state.fullBySourceIndex.get(record.sourceIndex);
  if (indexed) return indexed;

  const key = buildLightCompositeKey(record);
  const matches = state.fullByCompositeKey.get(key);
  if (matches?.length) return matches[0];

  return state.fullRecords?.find((candidate) => (
    cleanText(candidate?.["案例/来源"]) === record.title
    && normalizeDateToken(candidate?.["案例日期_ISO"] || candidate?.["案例日期"]) === normalizeDateToken(record.date || record.dateLabel)
  )) || null;
}

function buildFullCompositeKey(record) {
  return makeCompositeKey(
    record?.["案例/来源"],
    record?.["大分类"],
    record?.["细分赛道"],
    record?.["案例日期_ISO"] || record?.["案例日期"],
  );
}

function buildLightCompositeKey(record) {
  return makeCompositeKey(record.title, record.category, record.subcategory, record.date || record.dateLabel);
}

function makeCompositeKey(title, category, subcategory, date) {
  return [
    normalizeSearch(title),
    normalizeSearch(category || UNCATEGORIZED),
    normalizeSearch(subcategory || UNCATEGORIZED),
    normalizeDateToken(date),
  ].join("\u001f");
}

function renderFullDetail(container, record) {
  const rawFields = document.createElement("dl");
  rawFields.className = "raw-field-list";

  getFocusOrderedFields().forEach((field) => {
    const config = COLUMN_CONFIG[field];
    const wrapper = document.createElement("div");
    wrapper.className = `raw-field ${config.className}`;
    const term = createTextElement("dt", `${config.label}（原始）`);
    const value = cleanText(record?.[config.rawKey]);
    const description = createTextElement("dd", value || "未填写");
    if (!value) description.classList.add("muted");
    wrapper.append(term, description);
    rawFields.append(wrapper);
  });

  const evidence = document.createElement("section");
  evidence.className = "detail-evidence";
  evidence.append(createTextElement("h4", "依据或备注"));
  const evidenceValue = cleanText(record?.[EVIDENCE_FIELD]);
  const evidenceText = createTextElement("p", evidenceValue || "未填写依据或备注。");
  if (!evidenceValue) evidenceText.classList.add("muted");
  evidence.append(evidenceText);

  container.replaceChildren(rawFields, evidence);
}

function getFocusOrderedFields() {
  return [state.focusField, ...FOCUS_FIELDS.filter((field) => field !== state.focusField)];
}

function formatCoverage(field) {
  const value = Number(state.payload?.coverage?.[field]?.coverageRate);
  return `${PERCENT_FORMATTER.format(Number.isFinite(value) ? value : 0)}%`;
}

function formatPercentage(value) {
  return `${PERCENT_FORMATTER.format(Number(value) || 0)}%`;
}

function clampPercentage(value) {
  return Math.min(100, Math.max(0, Number(value) || 0));
}

function formatDateLabel(record) {
  return record.dateLabel || record.date.slice(0, 7) || "日期未知";
}

function getCategoryColor(category) {
  if (category === UNCATEGORIZED) return "#98a2b3";
  return state.categoryColors.get(category) || CATEGORY_COLORS[0];
}

function withAlpha(hex, alpha) {
  const value = cleanText(hex).replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(value)) return `rgba(37, 99, 235, ${alpha})`;
  const red = parseInt(value.slice(0, 2), 16);
  const green = parseInt(value.slice(2, 4), 16);
  const blue = parseInt(value.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function showEmpty(title, description) {
  els.emptyTitle.textContent = title;
  els.emptyDescription.textContent = description;
  els.emptyState.hidden = false;
}

function hideEmpty() {
  els.emptyState.hidden = true;
}

function showFatalError(error) {
  const message = error instanceof Error ? error.message : String(error);
  if (els.loadingState) els.loadingState.hidden = true;
  if (els.patternView) els.patternView.hidden = true;
  if (els.caseView) els.caseView.hidden = true;
  if (els.emptyState) els.emptyState.hidden = true;
  if (els.errorState) els.errorState.hidden = false;
  if (els.resultInfo) els.resultInfo.textContent = "轻量模式索引不可用";
  if (els.errorMessage) els.errorMessage.textContent = message;
}

function resetCasePage() {
  state.visibleCaseCount = CASE_PAGE_SIZE;
}

function createTextElement(tagName, text, className = "") {
  const element = document.createElement(tagName);
  if (className) element.className = className;
  element.textContent = text;
  return element;
}

function cleanText(value) {
  return String(value ?? "")
    .replace(/^\uFEFF/, "")
    .trim()
    .replace(/\s+/g, " ");
}

function normalizeSearch(value) {
  return cleanText(value).toLocaleLowerCase("zh-CN");
}

function normalizeDateToken(value) {
  const text = cleanText(value);
  const match = text.match(/(\d{4})\D?(\d{1,2})?/);
  if (!match) return normalizeSearch(text);
  return match[2] ? `${match[1]}-${match[2].padStart(2, "0")}` : match[1];
}

function uniqueStrings(values) {
  const seen = new Set();
  const result = [];
  values.forEach((value) => {
    const text = cleanText(value);
    if (!text || seen.has(text)) return;
    seen.add(text);
    result.push(text);
  });
  return result;
}

function toPositiveNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function localeSort(a, b) {
  return COLLATOR.compare(String(a), String(b));
}
