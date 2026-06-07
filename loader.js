"use strict";

// 纯前端 CSV 回退方案：不依赖外部库，支持逗号、引号、换行和 UTF-8 BOM。
(function () {
  const DATE_ISO_FIELD = "案例日期_ISO";
  const DATE_TS_FIELD = "案例日期_TS";
  const RAW_INDEX_FIELD = "__rawIndex";
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

  function cleanCell(value) {
    return String(value ?? "")
      .replace(/^\uFEFF/, "")
      .trim()
      .replace(/\s+/g, " ");
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
        if (char === "\r" && next === "\n") {
          i += 1;
        }
        row.push(cell);
        if (row.some((value) => value !== "")) {
          rows.push(row);
        }
        row = [];
        cell = "";
        continue;
      }

      cell += char;
    }

    row.push(cell);
    if (row.some((value) => value !== "")) {
      rows.push(row);
    }
    return rows;
  }

  function buildIsoDate(year, month) {
    if (!Number.isFinite(year) || !Number.isFinite(month) || year < 2000 || month < 1 || month > 12) {
      return { iso: "", timestamp: 0 };
    }
    const iso = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-01`;
    return { iso, timestamp: Math.floor(Date.UTC(year, month - 1, 1) / 1000) };
  }

  function parseCaseDate(value) {
    const text = cleanCell(value);
    if (!text) return { iso: "", timestamp: 0 };

    const normalized = text.replace(/[_/.]/g, "-").replace(/\s+/g, "-");
    let match = normalized.match(/^(\d{4})-(\d{1,2})(?:-\d{1,2})?$/);
    if (match) {
      return buildIsoDate(Number(match[1]), Number(match[2]));
    }

    match = normalized.match(/^(\d{2})-(\d{1,2})(?:-\d{1,2})?$/);
    if (match) {
      return buildIsoDate(2000 + Number(match[1]), Number(match[2]));
    }

    match = normalized.match(/^(\d{2,4})-([A-Za-z]+)$/) || normalized.match(/^([A-Za-z]+)-(\d{2,4})$/);
    if (match) {
      const firstIsYear = /^\d+$/.test(match[1]);
      let year = Number(firstIsYear ? match[1] : match[2]);
      if (year < 100) year += 2000;
      const monthKey = String(firstIsYear ? match[2] : match[1]).toLowerCase();
      return buildIsoDate(year, MONTHS[monthKey] || 0);
    }

    match = text.match(/^(\d{2,4})年(\d{1,2})月/);
    if (match) {
      let year = Number(match[1]);
      if (year < 100) year += 2000;
      return buildIsoDate(year, Number(match[2]));
    }

    return { iso: "", timestamp: 0 };
  }

  function normalizeRows(rows, columnConfig) {
    if (!rows.length) return [];

    const headers = rows[0].map(cleanCell);
    const displayColumns = Object.keys(columnConfig).filter((column) => columnConfig[column].display);

    return rows.slice(1).map((sourceRow, index) => {
      const raw = {};
      headers.forEach((header, columnIndex) => {
        raw[header] = cleanCell(sourceRow[columnIndex] ?? "");
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

  async function loadCsvData(url, columnConfig) {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`CSV 加载失败：${response.status}`);
    }
    const text = await response.text();
    return normalizeRows(parseCsv(text), columnConfig);
  }

  window.CSVLoader = {
    loadCsvData,
    parseCsv,
    normalizeRows,
    parseCaseDate,
  };
})();
