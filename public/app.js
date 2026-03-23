const el = (id) => document.getElementById(id);

const createForm = el("createForm");
const coinInput = el("coinInput");
const checklistList = el("checklistList");
const emptyState = el("emptyState");

const detail = el("detail");
const coinEditInput = el("coinEditInput");
const createdAt = el("createdAt");
const saveTitleBtn = el("saveTitleBtn");
const copyReportBtn = el("copyReportBtn");
const deleteBtn = el("deleteBtn");
const deleteAllChecklistsBtn = el("deleteAllChecklistsBtn");
const copyAllChecklistsBtn = el("copyAllChecklistsBtn");
const sectionsEl = el("sections");
const coinNotes = el("coinNotes");
const setupVerdictEl = el("setupVerdict");
const setupVerdictBody = el("setupVerdictBody");
const themeToggleBtn = el("themeToggleBtn");
const workflowStage0Btn = el("workflowStage0Btn");
const workflowStepsBtn = el("workflowStepsBtn");
const weekDaysBtn = el("weekDaysBtn");
const densitySignalBtn = el("densitySignalBtn");
const btcCorrelationInput = el("btcCorrelationInput");

let current = null;
let saveTimer = null;
let dirty = false;

function setTheme(theme) {
  document.body.dataset.theme = theme;
  try {
    localStorage.setItem("theme", theme);
  } catch {
    // ignore
  }

  if (themeToggleBtn) {
    themeToggleBtn.textContent =
      theme === "dark" ? "Светлая тема" : "Тёмная тема";
  }
}

(() => {
  try {
    const saved = localStorage.getItem("theme");
    const prefersLight =
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: light)").matches;
    const initial = saved || (prefersLight ? "light" : "dark");
    setTheme(initial);
  } catch {
    // ignore
  }

  if (themeToggleBtn) {
    themeToggleBtn.addEventListener("click", () => {
      const nextTheme =
        document.body.dataset.theme === "light" ? "dark" : "light";
      setTheme(nextTheme);
    });
  }
})();

const STORAGE_KEY = "checklists-v2";

const DROP_GROUPS = new Set(["map-tf", "map-btc", "liq-dist"]);

let store = { checklists: [] };

function loadLocalStore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { checklists: [] };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return { checklists: [] };
    if (!Array.isArray(parsed.checklists)) return { checklists: [] };
    return parsed;
  } catch {
    return { checklists: [] };
  }
}

function saveLocalStore() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // ignore
  }
}

function uuid() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** Кэш id тега → подсказка из шаблона (для старых чек-листов без поля hint). */
let tagHintByIdCache = null;

function getTagHintFromTemplate(tagId) {
  if (!tagHintByIdCache) {
    tagHintByIdCache = new Map();
    const T = globalThis.CHECKLIST_TEMPLATE_BLOCKS;
    if (T && Array.isArray(T)) {
      for (const b of T) {
        for (const g of b.groups || []) {
          for (const t of g.tags || []) {
            if (t.id && t.hint) tagHintByIdCache.set(t.id, t.hint);
          }
        }
      }
    }
  }
  return tagHintByIdCache.get(tagId) || "";
}

/** Кэш id тега → URL превью-картинки из шаблона. */
let tagHintImageByIdCache = null;

/** Кэш id группы → подсказка под заголовком группы (из шаблона). */
let groupHintByIdCache = null;

function getGroupHintFromTemplate(groupId) {
  if (!groupHintByIdCache) {
    groupHintByIdCache = new Map();
    const T = globalThis.CHECKLIST_TEMPLATE_BLOCKS;
    if (T && Array.isArray(T)) {
      for (const b of T) {
        for (const g of b.groups || []) {
          if (g.id && g.groupHint) groupHintByIdCache.set(g.id, g.groupHint);
        }
      }
    }
  }
  return groupHintByIdCache.get(groupId) || "";
}

/** Кэш order блока → HTML подсказки на шапке блока (из шаблона). */
let blockHintHtmlByOrderCache = null;

function getBlockHintHtmlFromTemplate(order) {
  if (blockHintHtmlByOrderCache == null) {
    blockHintHtmlByOrderCache = new Map();
    const T = globalThis.CHECKLIST_TEMPLATE_BLOCKS;
    if (T && Array.isArray(T)) {
      for (const b of T) {
        if (b.order != null && b.blockHintHtml)
          blockHintHtmlByOrderCache.set(b.order, b.blockHintHtml);
      }
    }
  }
  return blockHintHtmlByOrderCache.get(order) || "";
}

function getTagHintImageFromTemplate(tagId) {
  if (!tagHintImageByIdCache) {
    tagHintImageByIdCache = new Map();
    const T = globalThis.CHECKLIST_TEMPLATE_BLOCKS;
    if (T && Array.isArray(T)) {
      for (const b of T) {
        for (const g of b.groups || []) {
          for (const t of g.tags || []) {
            if (t.id && t.hintImage)
              tagHintImageByIdCache.set(t.id, t.hintImage);
          }
        }
      }
    }
  }
  return tagHintImageByIdCache.get(tagId) || "";
}

/** Десктоп с мышью: подсказки по ПКМ, без hover. Иначе — hover (mouseenter) на сенсоре/без fine pointer. */
function isDesktopFinePointer() {
  return window.matchMedia("(hover: hover) and (pointer: fine)").matches;
}

/** Безопасный URL для файлов с кириллицей в имени. */
function publicImageUrl(path) {
  if (!path || typeof path !== "string") return "";
  const p = path.startsWith("/") ? path : `/${path}`;
  const parts = p.split("/").filter(Boolean);
  return `/${parts.map(encodeURIComponent).join("/")}`;
}

let tagTooltipEl = null;
/** @type {HTMLElement | null} */
let tagTooltipAnchor = null;
/** Элемент, относительно которого считается rect (например заголовок блока, а подсветка — вся шапка). */
let tagTooltipPositionEl = null;
/** @type { 'center' | 'left' } */
let tagTooltipAlign = "center";
let tagTooltipScrollHandler = null;
/** @type {ReturnType<typeof setTimeout> | null} */
let tagTooltipHideTimer = null;

function cancelHideTagTooltip() {
  if (tagTooltipHideTimer) {
    clearTimeout(tagTooltipHideTimer);
    tagTooltipHideTimer = null;
  }
}

function scheduleHideTagTooltip() {
  cancelHideTagTooltip();
  tagTooltipHideTimer = setTimeout(() => {
    tagTooltipHideTimer = null;
    hideTagTooltip();
  }, 220);
}

function ensureTagTooltip() {
  if (tagTooltipEl) return tagTooltipEl;
  const box = document.createElement("div");
  box.className = "tagTooltip";
  box.setAttribute("role", "tooltip");
  const img = document.createElement("img");
  img.className = "tagTooltipImg";
  img.alt = "";
  const text = document.createElement("div");
  text.className = "tagTooltipText";
  text.hidden = true;
  box.appendChild(img);
  box.appendChild(text);
  box.addEventListener("mouseenter", cancelHideTagTooltip);
  box.addEventListener("mouseleave", () => {
    cancelHideTagTooltip();
    hideTagTooltip();
  });
  document.body.appendChild(box);
  tagTooltipEl = box;
  return tagTooltipEl;
}

function positionTagTooltip() {
  const box = tagTooltipEl;
  if (!box || !tagTooltipAnchor || !box.classList.contains("is-visible"))
    return;
  const posEl = tagTooltipPositionEl || tagTooltipAnchor;
  const r = posEl.getBoundingClientRect();
  const margin = 8;
  const vv = window.visualViewport;
  const vw = vv ? vv.width : window.innerWidth;
  const vh = vv ? vv.height : window.innerHeight;
  const vvx = vv ? vv.offsetLeft : 0;
  const vvy = vv ? vv.offsetTop : 0;
  const textEl = box.querySelector(".tagTooltipText");
  const rich = textEl && textEl.classList.contains("tagTooltipText--rich");
  const maxW = Math.min(rich ? 480 : 420, vw - margin * 2);
  box.style.maxWidth = `${maxW}px`;
  const w = box.offsetWidth || 1;
  const h = box.offsetHeight || 1;
  let left = tagTooltipAlign === "left" ? r.left : r.left + r.width / 2 - w / 2;
  left = Math.max(vvx + margin, Math.min(left, vvx + vw - w - margin));
  let top = r.bottom + margin;
  if (top + h > vvy + vh - margin) {
    top = r.top - margin - h;
  }
  if (top < vvy + margin) top = vvy + margin;
  box.style.left = `${left}px`;
  box.style.top = `${top}px`;
}

/**
 * @param {HTMLElement} anchor — подсветка (чип или шапка блока)
 * @param {{
 *   imagePath?: string,
 *   textHint?: string,
 *   htmlHint?: string,
 *   positionEl?: HTMLElement,
 *   align?: 'center' | 'left',
 * }} payload
 */
function showTagTooltip(anchor, payload) {
  const imagePath = payload.imagePath && String(payload.imagePath).trim();
  const textHint = payload.textHint && String(payload.textHint).trim();
  const htmlHint = payload.htmlHint && String(payload.htmlHint).trim();
  if (!imagePath && !textHint && !htmlHint) return;

  if (tagTooltipAnchor && tagTooltipAnchor !== anchor) {
    tagTooltipAnchor.classList.remove("hintAnchorActive");
  }
  tagTooltipAnchor = anchor;
  tagTooltipAnchor.classList.add("hintAnchorActive");
  tagTooltipPositionEl = payload.positionEl || null;
  tagTooltipAlign = payload.align === "left" ? "left" : "center";

  const box = ensureTagTooltip();
  const img = box.querySelector(".tagTooltipImg");
  const textEl = box.querySelector(".tagTooltipText");

  if (imagePath) {
    img.hidden = false;
    const url = publicImageUrl(imagePath);
    img.src = url;
    img.alt = (anchor.textContent && anchor.textContent.trim()) || "Пример";
    img.onload = () => positionTagTooltip();
  } else {
    img.hidden = true;
    img.removeAttribute("src");
  }

  if (htmlHint) {
    textEl.hidden = false;
    textEl.textContent = "";
    textEl.innerHTML = htmlHint;
    textEl.classList.add("tagTooltipText--rich");
  } else if (textHint) {
    textEl.hidden = false;
    textEl.innerHTML = "";
    textEl.textContent = textHint;
    textEl.classList.remove("tagTooltipText--rich");
  } else {
    textEl.hidden = true;
    textEl.textContent = "";
    textEl.innerHTML = "";
    textEl.classList.remove("tagTooltipText--rich");
  }

  box.classList.add("is-visible");
  requestAnimationFrame(() => positionTagTooltip());
  if (!tagTooltipScrollHandler) {
    tagTooltipScrollHandler = () => positionTagTooltip();
    window.addEventListener("scroll", tagTooltipScrollHandler, true);
    window.addEventListener("resize", tagTooltipScrollHandler);
  }
}

function hideTagTooltip() {
  cancelHideTagTooltip();
  if (tagTooltipAnchor) {
    tagTooltipAnchor.classList.remove("hintAnchorActive");
    tagTooltipAnchor = null;
  }
  tagTooltipPositionEl = null;
  tagTooltipAlign = "center";
  if (tagTooltipEl) {
    const te = tagTooltipEl.querySelector(".tagTooltipText");
    if (te) {
      te.textContent = "";
      te.innerHTML = "";
      te.classList.remove("tagTooltipText--rich");
    }
    tagTooltipEl.classList.remove("is-visible");
  }
}

document.addEventListener(
  "mousedown",
  (e) => {
    if (!tagTooltipEl || !tagTooltipEl.classList.contains("is-visible")) return;
    if (e.button !== 0) return;
    if (tagTooltipEl.contains(/** @type {Node} */ (e.target))) return;
    hideTagTooltip();
  },
  true,
);

function buildBlocksFromTemplate() {
  const T = globalThis.CHECKLIST_TEMPLATE_BLOCKS;
  if (!T || !Array.isArray(T)) {
    console.error("CHECKLIST_TEMPLATE_BLOCKS не загружен");
    return [];
  }
  return T.map((b) => ({
    id: uuid(),
    order: b.order,
    title: b.title,
    goal: b.goal,
    ...(b.blockHintHtml ? { blockHintHtml: b.blockHintHtml } : {}),
    groups: b.groups.map((g) => ({
      id: g.id,
      label: g.label,
      ...(g.groupHint ? { groupHint: g.groupHint } : {}),
      tags: g.tags.map((t) => ({
        id: t.id,
        label: t.label,
        ...(t.hint ? { hint: t.hint } : {}),
        ...(t.hintImage ? { hintImage: t.hintImage } : {}),
      })),
      selected: [],
    })),
  }));
}

function migrateLegacyChecklistInner(c) {
  if (c.blocks && Array.isArray(c.blocks) && c.blocks.length) {
    if (c.items === undefined) return c;
    const { items, ...rest } = c;
    return rest;
  }
  const { items, ...rest } = c;
  return { ...rest, blocks: buildBlocksFromTemplate() };
}

function clampGroupSelected(g) {
  const valid = new Set((g.tags || []).map((t) => t.id));
  const sel = (g.selected || []).filter((id) => valid.has(id));
  return sel.length <= 1 ? sel : [sel[0]];
}

/** Корреляция с BTC: только целое 0–100 или пусто (строка в данных чек-листа). */
function normalizeBtcCorrelationStored(v) {
  if (v == null || v === "") return "";
  const digits = String(v).replace(/\D/g, "");
  if (digits === "") return "";
  const n = parseInt(digits, 10);
  if (Number.isNaN(n)) return "";
  return String(Math.min(100, n));
}

function normalizeChecklistShape(c) {
  let notes = typeof c.notes === "string" ? c.notes : "";
  const btcCorrelation = normalizeBtcCorrelationStored(c.btcCorrelation);
  let blocks = c.blocks;
  if (Array.isArray(blocks)) {
    const fromBlocks = blocks
      .map((b) => b.notes)
      .filter(Boolean)
      .join("\n\n");
    if (!notes && fromBlocks) notes = fromBlocks;
    blocks = blocks.map((b) => {
      const { logic, notes: _bn, ...rest } = b;
      const groups = (b.groups || [])
        .filter((g) => !DROP_GROUPS.has(g.id))
        .map((g) => ({ ...g, selected: clampGroupSelected(g) }));
      return { ...rest, groups };
    });
  }
  const { items, ...rest } = c;
  return { ...rest, notes, blocks, btcCorrelation };
}

function migrateChecklistEntry(c) {
  return normalizeChecklistShape(migrateLegacyChecklistInner(c));
}

function buildChecklist(coin) {
  const now = new Date();
  return {
    id: uuid(),
    coin,
    createdAt: now.toISOString(),
    notes: "",
    btcCorrelation: "",
    blocks: buildBlocksFromTemplate(),
  };
}

function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString("ru-RU", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Поля для отчёта: из объекта чек-листа или с учётом открытой формы (текущий выбранный). */
function getChecklistExportFields(c) {
  const live = current && c.id === current.id;
  const coin = live
    ? (coinEditInput?.value || c.coin || "").trim() || "—"
    : (c.coin || "").trim() || "—";
  const notesRaw = live
    ? (coinNotes?.value ?? c.notes ?? "").trim()
    : (c.notes || "").trim();
  const btcCorr = live
    ? normalizeBtcCorrelationStored(
        btcCorrelationInput?.value != null
          ? btcCorrelationInput.value
          : c.btcCorrelation,
      )
    : normalizeBtcCorrelationStored(c.btcCorrelation);
  return { coin, notesRaw, btcCorr };
}

/** Текстовый отчёт по одному чек-листу (блоки из переданного объекта). */
function buildChecklistReportFromChecklist(c) {
  const { coin, notesRaw, btcCorr } = getChecklistExportFields(c);
  const created = formatDate(c.createdAt) || "—";
  const lines = [];
  lines.push(`Монета          ${coin}`);
  lines.push(`Дата и время    ${created}`);
  lines.push("");
  lines.push("ОПИСАНИЕ");
  lines.push(notesRaw || "—");
  lines.push("");
  lines.push("КОРРЕЛЯЦИЯ С BTC");
  lines.push(btcCorr ? `${btcCorr}%` : "—");
  lines.push("");
  lines.push("ВЫБРАННЫЕ ТЕГИ");

  const blocks = (c.blocks || []).slice().sort((a, b) => a.order - b.order);
  for (const block of blocks) {
    lines.push("");
    lines.push(`▸ ${block.title}`);
    for (const g of block.groups || []) {
      const sel = Array.isArray(g.selected) ? g.selected : [];
      let value = "не выбрано";
      if (sel.length) {
        const labels = [];
        for (const sid of sel) {
          const tag = (g.tags || []).find((t) => t.id === sid);
          labels.push(tag ? tag.label : sid);
        }
        value = labels.join(", ");
      }
      lines.push(`  • ${g.label}`);
      lines.push(`      ${value}`);
    }
  }

  return lines.join("\n");
}

/** Текстовый отчёт для буфера обмена: монета, время, описание, теги по блокам. */
function buildChecklistReport() {
  if (!current) return "";
  return buildChecklistReportFromChecklist(current);
}

/** JSON-объект одного чек-листа для разбора ИИ. */
function checklistToExportJson(c) {
  const { coin, notesRaw, btcCorr } = getChecklistExportFields(c);
  const blocks = (c.blocks || []).slice().sort((a, b) => a.order - b.order);
  const btcNum = btcCorr === "" ? NaN : Number.parseInt(btcCorr, 10);
  return {
    id: c.id,
    coin,
    createdAt: c.createdAt,
    notes: notesRaw,
    btcCorrelationPercent:
      btcCorr === "" || Number.isNaN(btcNum) ? null : btcNum,
    blocks: blocks.map((block) => ({
      order: block.order,
      title: block.title,
      goal: block.goal || "",
      groups: (block.groups || []).map((g) => {
        const sel = Array.isArray(g.selected) ? g.selected : [];
        const labels = sel.map((sid) => {
          const tag = (g.tags || []).find((t) => t.id === sid);
          return tag ? tag.label : sid;
        });
        return { label: g.label, selectedTagLabels: labels };
      }),
    })),
  };
}

/** Все чек-листы: текстовые отчёты + JSON-массив в конце. */
function buildAllChecklistsExport() {
  const sorted = store.checklists
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const exportedAt = new Date().toISOString();
  const parts = [];
  parts.push("# Trading Checklists — экспорт");
  parts.push("format: checklist-trade-export-v1");
  parts.push(`exportedAt: ${exportedAt}`);
  parts.push(`count: ${sorted.length}`);
  parts.push("");
  parts.push(
    "Ниже — человекочитаемые отчёты по каждой монете, затем единый JSON-массив `checklists` для автоматического разбора (ИИ).",
  );
  parts.push("");

  sorted.forEach((c, idx) => {
    const { coin } = getChecklistExportFields(c);
    parts.push("═".repeat(72));
    parts.push(`## ${idx + 1} / ${sorted.length} — ${coin}`);
    parts.push("═".repeat(72));
    parts.push(buildChecklistReportFromChecklist(c));
    parts.push("");
  });

  parts.push("─".repeat(72));
  parts.push("JSON");
  parts.push("─".repeat(72));
  const payload = {
    exportVersion: 1,
    exportedAt,
    count: sorted.length,
    checklists: sorted.map((c) => checklistToExportJson(c)),
  };
  parts.push(JSON.stringify(payload, null, 2));
  return parts.join("\n");
}

async function copyTextToClipboard(text) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fallback
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
    return true;
  } catch {
    return false;
  }
}

async function copyChecklistReport() {
  if (!current || !copyReportBtn) return;
  const text = buildChecklistReport();
  const prevLabel = copyReportBtn.textContent;
  const done = () => {
    copyReportBtn.textContent = "Скопировано в буфер";
    copyReportBtn.disabled = true;
    window.setTimeout(() => {
      copyReportBtn.textContent = prevLabel;
      copyReportBtn.disabled = false;
    }, 2000);
  };

  const ok = await copyTextToClipboard(text);
  if (!ok) {
    copyReportBtn.textContent = "Не удалось скопировать";
    window.setTimeout(() => {
      copyReportBtn.textContent = prevLabel;
    }, 2000);
    return;
  }
  done();
}

async function copyAllChecklistsExport() {
  if (!store.checklists.length || !copyAllChecklistsBtn) return;
  const text = buildAllChecklistsExport();
  const btn = copyAllChecklistsBtn;
  const prevTitle = btn.getAttribute("title") || "";
  const ok = await copyTextToClipboard(text);
  if (!ok) {
    btn.setAttribute("title", "Не удалось скопировать");
    window.setTimeout(() => btn.setAttribute("title", prevTitle), 2000);
    return;
  }
  btn.setAttribute("title", "Скопировано");
  btn.disabled = true;
  window.setTimeout(() => {
    btn.setAttribute("title", prevTitle || "Скопировать все отчёты");
    btn.disabled = store.checklists.length === 0;
  }, 1600);
}

function renderList(checklists) {
  checklistList.innerHTML = "";
  if (!checklists.length || !current) {
    emptyState.hidden = false;
    detail.hidden = true;
  } else {
    emptyState.hidden = true;
    detail.hidden = false;
  }

  for (const c of checklists) {
    const item = document.createElement("div");
    item.className = "listItem" + (current?.id === c.id ? " active" : "");
    item.dataset.id = c.id;

    const title = document.createElement("div");
    title.className = "listItemTitle";
    title.textContent = c.coin;

    const meta = document.createElement("div");
    meta.className = "listItemMeta";
    meta.textContent = formatDate(c.createdAt);

    item.appendChild(title);
    item.appendChild(meta);

    item.addEventListener("click", () => selectChecklist(c.id));
    checklistList.appendChild(item);
  }
}

function refreshList() {
  const sorted = store.checklists
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  renderList(sorted);
  const empty = store.checklists.length === 0;
  if (deleteAllChecklistsBtn) deleteAllChecklistsBtn.disabled = empty;
  if (copyAllChecklistsBtn) copyAllChecklistsBtn.disabled = empty;
}

function selectChecklist(id) {
  current = store.checklists.find((c) => c.id === id) || null;
  if (!current) return;

  dirty = false;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = null;

  emptyState.hidden = true;
  detail.hidden = false;
  coinEditInput.value = current.coin;
  createdAt.textContent = `Создан: ${formatDate(current.createdAt)}`;
  if (coinNotes) coinNotes.value = current.notes || "";
  if (btcCorrelationInput)
    btcCorrelationInput.value = normalizeBtcCorrelationStored(
      current.btcCorrelation,
    );
  renderBlocks(current);
  refreshList();
}

/** В группе не более одного выбранного тега; повторный клик по тому же тегу снимает выбор. */
function toggleTag(group, tagId) {
  const i = group.selected.indexOf(tagId);
  if (i >= 0) {
    group.selected = [];
  } else {
    group.selected = [tagId];
  }
}

function collectSelectedTagIds(checklist) {
  const ids = [];
  for (const b of checklist.blocks || []) {
    for (const g of b.groups || []) {
      const sel = g.selected;
      if (!Array.isArray(sel)) continue;
      for (const id of sel) {
        if (typeof id === "string" && id.length) ids.push(id);
      }
    }
  }
  return ids;
}

function getScoreTradingSetup() {
  if (
    typeof globalThis !== "undefined" &&
    typeof globalThis.scoreTradingSetup === "function"
  ) {
    return globalThis.scoreTradingSetup;
  }
  if (
    typeof window !== "undefined" &&
    typeof window.scoreTradingSetup === "function"
  ) {
    return window.scoreTradingSetup;
  }
  return null;
}

function updateSetupVerdict() {
  if (!setupVerdictEl || !setupVerdictBody) return;
  const scoreFn = getScoreTradingSetup();
  if (!current || !scoreFn) {
    setupVerdictEl.hidden = true;
    return;
  }

  const result = scoreFn(collectSelectedTagIds(current));
  setupVerdictEl.hidden = false;
  setupVerdictEl.className = "setupVerdict " + result.status;

  setupVerdictBody.replaceChildren();

  const meta = document.createElement("div");
  meta.className = "setupVerdictMeta";
  const statusLabel =
    result.status === "danger"
      ? "Вход запрещён"
      : result.status === "warning"
        ? "Внимание"
        : "Сценарий";
  const scoreNum = typeof result.score === "number" ? result.score : 0;
  const tail =
    result.status === "success"
      ? result.actionType || "—"
      : result.status === "warning"
        ? result.actionType && result.actionType !== "None"
          ? "грязный сетап / конфликт контекста"
          : "сценарий не собран (нужна полная комбинация тегов для базы 50 баллов)"
        : "сработал красный флаг";
  meta.textContent = `${statusLabel} · ${scoreNum} баллов · ${tail}`;

  const msg = document.createElement("div");
  msg.className = "setupVerdictMessage";
  msg.textContent = result.message;

  setupVerdictBody.appendChild(meta);
  setupVerdictBody.appendChild(msg);

  const da = result.deepAnalysis;
  if (da && typeof da === "object") {
    const deepEl = document.createElement("div");
    deepEl.className = "setupVerdictDeep";
    const tier = document.createElement("div");
    tier.className = "setupVerdictDeepLine";
    tier.textContent = `Риск: ${da.riskTier}. Исполнение: ${da.orderType}.`;
    deepEl.appendChild(tier);
    if (da.invalidationPoint) {
      const inv = document.createElement("div");
      inv.className = "setupVerdictDeepLine";
      inv.textContent = `Инвалидация: ${da.invalidationPoint}`;
      deepEl.appendChild(inv);
    }
    if (da.archetype) {
      const ar = document.createElement("div");
      ar.className = "setupVerdictDeepLine setupVerdictArchetype";
      ar.textContent = `Архетип: ${da.archetype}`;
      deepEl.appendChild(ar);
    }
    if (da.stopStrategy) {
      const st = document.createElement("div");
      st.className = "setupVerdictDeepLine";
      st.textContent = `Стоп-логика: ${da.stopStrategy}`;
      deepEl.appendChild(st);
    }
    if (da.volumeQuality) {
      const vq = document.createElement("div");
      vq.className = "setupVerdictDeepLine";
      vq.textContent = `Качество энергии (OI × лента): ${da.volumeQuality}`;
      deepEl.appendChild(vq);
    }
    setupVerdictBody.appendChild(deepEl);
  }

  if (result.details?.notes?.length) {
    const nt = document.createElement("div");
    nt.className = "setupVerdictMods";
    nt.textContent = result.details.notes.join(" ");
    setupVerdictBody.appendChild(nt);
  }

  if (result.details?.modifiers?.length) {
    const mods = document.createElement("div");
    mods.className = "setupVerdictMods";
    mods.textContent =
      "Модификаторы: " +
      result.details.modifiers
        .map((m) => `${m.label} (${m.delta > 0 ? "+" : ""}${m.delta})`)
        .join("; ");
    setupVerdictBody.appendChild(mods);
  }
}

function renderBlocks(checklist) {
  hideTagTooltip();
  sectionsEl.innerHTML = "";

  const blocks = (checklist.blocks || [])
    .slice()
    .sort((a, b) => a.order - b.order);

  for (const block of blocks) {
    const card = document.createElement("div");
    card.className = "sectionCard";

    const head = document.createElement("div");
    head.className = "blockHead";

    const title = document.createElement("div");
    title.className = "sectionTitle";
    title.textContent = block.title;

    const goal = document.createElement("div");
    goal.className = "blockGoal";
    goal.textContent = block.goal;

    head.appendChild(title);
    head.appendChild(goal);
    card.appendChild(head);

    const blockHintHtml =
      (block.blockHintHtml && String(block.blockHintHtml)) ||
      getBlockHintHtmlFromTemplate(block.order);
    if (blockHintHtml) {
      head.classList.add("blockHead--blockHint");
      head.setAttribute(
        "aria-label",
        `${block.title}. Подсказка по контексту: правая кнопка мыши на десктопе; на сенсоре — наведение`,
      );
      const openBlockHint = () =>
        showTagTooltip(head, {
          htmlHint: blockHintHtml,
          positionEl: title,
          align: "left",
        });
      head.addEventListener("contextmenu", (e) => {
        if (!isDesktopFinePointer()) return;
        e.preventDefault();
        openBlockHint();
      });
      head.addEventListener("mouseenter", () => {
        if (isDesktopFinePointer()) return;
        openBlockHint();
      });
      head.addEventListener("mouseleave", () => {
        if (isDesktopFinePointer()) return;
        scheduleHideTagTooltip();
      });
      // Без focus: иначе левый клик по шапке давал фокус и открывал подсказку.
    }

    const body = document.createElement("div");
    body.className = "sectionBody blockBody";

    for (const group of block.groups || []) {
      const row = document.createElement("div");
      row.className = "tagGroup";

      const glabel = document.createElement("div");
      glabel.className = "tagGroupLabel";
      glabel.textContent = group.label;
      row.appendChild(glabel);

      const groupHintText =
        (group.groupHint && String(group.groupHint)) ||
        getGroupHintFromTemplate(group.id);
      if (groupHintText) {
        const gHint = document.createElement("div");
        gHint.className = "tagGroupHint";
        gHint.textContent = groupHintText;
        row.appendChild(gHint);
      }

      const chips = document.createElement("div");
      chips.className = "tagChips";

      for (const tag of group.tags || []) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.dataset.tagId = tag.id;
        btn.className =
          "tagChip" + (group.selected.includes(tag.id) ? " active" : "");
        btn.textContent = tag.label;
        const hint =
          getTagHintFromTemplate(tag.id) ||
          (tag.hint && String(tag.hint)) ||
          "";
        if (hint) {
          btn.setAttribute("aria-description", hint);
        }
        // Шаблон важнее сохранённого hintImage (в localStorage могли остаться старые пути с кириллицей/пробелами).
        const imgPath =
          getTagHintImageFromTemplate(tag.id) ||
          (tag.hintImage && String(tag.hintImage)) ||
          "";
        if (imgPath) btn.classList.add("tagChip--hasImageHint");
        if (hint && !imgPath) btn.classList.add("tagChip--hasTextHint");
        if (hint || imgPath) {
          const openTooltip = () =>
            showTagTooltip(btn, { imagePath: imgPath, textHint: hint });
          btn.addEventListener("contextmenu", (e) => {
            if (!isDesktopFinePointer()) return;
            e.preventDefault();
            openTooltip();
          });
          btn.addEventListener("mouseenter", () => {
            if (isDesktopFinePointer()) return;
            openTooltip();
          });
          btn.addEventListener("mouseleave", () => {
            if (isDesktopFinePointer()) return;
            scheduleHideTagTooltip();
          });
          // Не вешаем focus/blur: левый клик фокусирует кнопку и открывал бы подсказку.
          // На десктопе подсказка только по ПКМ; на тач — hover (mouseenter) без фокуса.
        }
        btn.addEventListener("click", () => {
          toggleTag(group, tag.id);
          chips.querySelectorAll("button.tagChip").forEach((ch) => {
            const tid = ch.dataset.tagId;
            ch.className =
              "tagChip" + (group.selected.includes(tid) ? " active" : "");
          });
          schedulePersist();
          updateSetupVerdict();
        });
        chips.appendChild(btn);
      }
      row.appendChild(chips);
      body.appendChild(row);
    }

    card.appendChild(body);
    sectionsEl.appendChild(card);
  }

  updateSetupVerdict();
}

function schedulePersist() {
  if (!current) return;
  dirty = true;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    if (!dirty || !current) return;
    dirty = false;
    saveLocalStore();
  }, 300);
}

/** @type {HTMLElement | null} */
let workflowOverlayEl = null;
/** @type {HTMLElement | null} */
let stage0OverlayEl = null;
/** @type {HTMLElement | null} */
let weekDaysOverlayEl = null;
/** @type {HTMLElement | null} */
let densitySignalOverlayEl = null;

function buildWeekDaysModalInnerHTML() {
  return `
<div class="workflowPanelScroll">
  <section class="workflowStage workflowStage--yellow" aria-labelledby="wd-s1">
    <h3 class="workflowStageTitle" id="wd-s1">📉 1. Ликвидность и объёмы</h3>
    <p class="workflowP">В выходные банки и биржи закрыты, объёмы торгов падают в <strong>2–3 раза</strong>.</p>
    <p class="workflowP"><strong>Что это значит:</strong> «Жирные» зоны на CoinGlass в выходные на самом деле гораздо <em>тоньше</em>, чем в будни. Их легче пробить случайным рыночным ордером.</p>
    <p class="workflowAction"><strong>Твоё действие:</strong> будь осторожен с тегом <strong>Heavy</strong>. В субботу то, что кажется «бетонной стеной», может быть разобрано за пару секунд — потому что в стакане нет глубины.</p>
  </section>

  <section class="workflowStage workflowStage--blue" aria-labelledby="wd-s2">
    <h3 class="workflowStageTitle" id="wd-s2">🔄 2. Стратегия: Range vs Breakout</h3>
    <p class="workflowP">Это самый важный пункт для твоего интерфейса.</p>
    <ul class="workflowList">
      <li><strong>Будни:</strong> хорошо работают <strong>Breakout</strong> (пробои). Есть объёмы, есть «сила», которая толкает цену сквозь уровни.</li>
      <li><strong>Выходные:</strong> идеальное время для <strong>Range</strong> (боковик) и <strong>SFP</strong> (ложный пробой).</li>
    </ul>
    <p class="workflowP"><strong>Почему:</strong> у маркетмейкеров нет цели вести цену в новый тренд — им выгодно просто «пилить» толпу в обе стороны, собирая ликвидность сверху и снизу.</p>
    <p class="workflowP workflowP--warn"><strong>ЗАПРЕТ:</strong> старайся не торговать пробои (<strong>Breakout</strong>) в выходные. В <strong>80%</strong> случаев это будет «закол» и мгновенный возврат обратно в канал.</p>
  </section>

  <section class="workflowStage workflowStage--purple" aria-labelledby="wd-s3">
    <h3 class="workflowStageTitle" id="wd-s3">🤖 3. Власть ботов</h3>
    <p class="workflowP">Когда людей в рынке мало, доминируют алгоритмы. Они обожают «рисовать» красивые технические фигуры, чтобы заманить ритейл.</p>
    <p class="workflowP"><strong>Ловушка:</strong> в выходные часто рисуют идеальный «восходящий треугольник» или «флаг». Как только толпа начинает в него прыгать — боты бьют по рынку в обратную сторону.</p>
    <p class="workflowAction"><strong>Твоё действие:</strong> в выходные тег <strong>Absorption</strong> (поглощение) в Tiger Trade становится в <strong>2 раза</strong> важнее. Если видишь, что цену «заманивают» к уровню, а в кластерах идёт поглощение — это твой сигнал на разворот.</p>
  </section>

  <section class="workflowMatrix" aria-labelledby="wd-table">
    <h3 class="workflowMatrixTitle" id="wd-table">Таблица-фильтр: будни vs выходные</h3>
    <div class="workflowTableWrap">
      <table class="workflowTable workflowTable--weekDays">
        <thead>
          <tr>
            <th scope="col">Параметр</th>
            <th scope="col">Будни (Пн–Пт)</th>
            <th scope="col">Выходные (Сб–Вс)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">Приоритет тега</th>
            <td>Breakout / Trend</td>
            <td>Range / SFP (закол)</td>
          </tr>
          <tr>
            <th scope="row">Лента (Tape)</th>
            <td>Агрессивная, направленная</td>
            <td>«Дырявая», хаотичная</td>
          </tr>
          <tr>
            <th scope="row">Ликвидации</th>
            <td>Работают как «магнит» и «ускоритель»</td>
            <td>Часто работают как «финальная точка» (разворот)</td>
          </tr>
          <tr>
            <th scope="row">Корреляция с BTC</th>
            <td>Высокая, но понятная</td>
            <td>Часто «рассинхрон» или полная привязка</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</div>`;
}

function ensureWeekDaysModal() {
  if (weekDaysOverlayEl) return weekDaysOverlayEl;
  const overlay = document.createElement("div");
  overlay.id = "weekDaysOverlay";
  overlay.className = "workflowOverlay";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-labelledby", "weekDaysModalTitle");
  overlay.innerHTML = `
    <div class="workflowPanel workflowPanel--weekDays">
      <div class="workflowPanelHead">
        <h2 class="workflowPanelTitle" id="weekDaysModalTitle">Дни недели</h2>
        <button type="button" class="workflowCloseBtn" aria-label="Закрыть">×</button>
      </div>
      <div class="workflowPanelBody"></div>
    </div>`;
  const body = overlay.querySelector(".workflowPanelBody");
  if (body) body.innerHTML = buildWeekDaysModalInnerHTML();
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeWeekDaysModal();
  });
  overlay
    .querySelector(".workflowCloseBtn")
    ?.addEventListener("click", closeWeekDaysModal);
  document.body.appendChild(overlay);
  weekDaysOverlayEl = overlay;
  return overlay;
}

function openWeekDaysModal() {
  if (stage0OverlayEl?.classList?.contains("is-open")) closeStage0Modal();
  if (workflowOverlayEl?.classList?.contains("is-open")) closeWorkflowModal();
  if (densitySignalOverlayEl?.classList?.contains("is-open"))
    closeDensitySignalModal();
  ensureWeekDaysModal();
  weekDaysOverlayEl?.classList.add("is-open");
  document.body.classList.add("workflowModalOpen");
  weekDaysOverlayEl?.querySelector(".workflowCloseBtn")?.focus();
}

function closeWeekDaysModal() {
  weekDaysOverlayEl?.classList.remove("is-open");
  if (
    !workflowOverlayEl?.classList?.contains("is-open") &&
    !stage0OverlayEl?.classList?.contains("is-open") &&
    !densitySignalOverlayEl?.classList?.contains("is-open")
  ) {
    document.body.classList.remove("workflowModalOpen");
  }
  weekDaysBtn?.focus();
}

function buildDensitySignalModalInnerHTML() {
  return `
<div class="workflowPanelScroll">
  <section class="workflowStage workflowStage--red" aria-labelledby="ds-s0">
    <h3 class="workflowStageTitle" id="ds-s0">🛑 СТОП-СИГНАЛ: ИЛЛЮЗИЯ ПЛОТНОСТИ</h3>
    <p class="workflowP">Ты видишь гигантскую плотность в стакане. Прежде чем кликнуть <strong>Buy</strong> или <strong>Sell</strong>, ответь на 3 вопроса:</p>
  </section>

  <section class="workflowStage workflowStage--yellow" aria-labelledby="ds-s1">
    <h3 class="workflowStageTitle" id="ds-s1">1. Где реальное топливо?</h3>
    <p class="workflowP">Плотность в стакане — это намерение. Ее уберут за 1 миллисекунду до касания (спуфинг).</p>
    <p class="workflowP">Зона ликвидаций на CoinGlass — это неизбежность.</p>
    <p class="workflowP workflowP--warn"><strong>Правило:</strong> если за плотностью нет жирной зоны чужих стопов — пробоя не будет. Тебя заманят в сделку и размажут встречным объемом. Нет ликвидаций = нет импульса.</p>
  </section>

  <section class="workflowStage workflowStage--purple" aria-labelledby="ds-s2">
    <h3 class="workflowStageTitle" id="ds-s2">2. Кому выгодна моя сделка прямо сейчас?</h3>
    <p class="workflowP">Толпа всегда торгует очевидное. Все видят эту стену в Tiger Trade.</p>
    <p class="workflowP">Крупный капитал специально ставит эту плотность, чтобы ты поверил в уровень, зашел в позицию и стал для него ликвидностью (<strong>Liquidity Grab</strong>).</p>
    <p class="workflowAction"><strong>Действие:</strong> не позволяй китам закрывать свои позиции об твои стопы.</p>
  </section>

  <section class="workflowStage workflowStage--blue" aria-labelledby="ds-s3">
    <h3 class="workflowStageTitle" id="ds-s3">3. Был ли захват ликвидности?</h3>
    <ul class="workflowList">
      <li>Кусают плотность? Жди.</li>
      <li>Пробили плотность? Жди.</li>
      <li>Цена нырнула в зону ликвидаций, снесла чужие стопы, лента сошла с ума (Market Buys), а в кластерах надулся пузырь (Imbalance), но цена встала? <strong>ВОТ ТВОЯ ТОЧКА ВХОДА.</strong></li>
    </ul>
  </section>

  <section class="workflowStage workflowStage--green" aria-labelledby="ds-s4">
    <h3 class="workflowStageTitle" id="ds-s4">Твоя мантра скальпера</h3>
    <p class="workflowP"><strong>«Я торгую только чужую боль (ликвидации), а не картинки в стакане (плотности). Плотность — это мой щит для стоп-лосса, но никогда не триггер для входа».</strong></p>
  </section>
</div>`;
}

function ensureDensitySignalModal() {
  if (densitySignalOverlayEl) return densitySignalOverlayEl;
  const overlay = document.createElement("div");
  overlay.id = "densitySignalOverlay";
  overlay.className = "workflowOverlay";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-labelledby", "densitySignalModalTitle");
  overlay.innerHTML = `
    <div class="workflowPanel workflowPanel--weekDays">
      <div class="workflowPanelHead">
        <h2 class="workflowPanelTitle" id="densitySignalModalTitle">Плотности</h2>
        <button type="button" class="workflowCloseBtn" aria-label="Закрыть">×</button>
      </div>
      <div class="workflowPanelBody"></div>
    </div>`;
  const body = overlay.querySelector(".workflowPanelBody");
  if (body) body.innerHTML = buildDensitySignalModalInnerHTML();
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeDensitySignalModal();
  });
  overlay
    .querySelector(".workflowCloseBtn")
    ?.addEventListener("click", closeDensitySignalModal);
  document.body.appendChild(overlay);
  densitySignalOverlayEl = overlay;
  return overlay;
}

function openDensitySignalModal() {
  if (stage0OverlayEl?.classList?.contains("is-open")) closeStage0Modal();
  if (workflowOverlayEl?.classList?.contains("is-open")) closeWorkflowModal();
  if (weekDaysOverlayEl?.classList?.contains("is-open")) closeWeekDaysModal();
  ensureDensitySignalModal();
  densitySignalOverlayEl?.classList.add("is-open");
  document.body.classList.add("workflowModalOpen");
  densitySignalOverlayEl?.querySelector(".workflowCloseBtn")?.focus();
}

function closeDensitySignalModal() {
  densitySignalOverlayEl?.classList.remove("is-open");
  if (
    !workflowOverlayEl?.classList?.contains("is-open") &&
    !stage0OverlayEl?.classList?.contains("is-open") &&
    !weekDaysOverlayEl?.classList?.contains("is-open")
  ) {
    document.body.classList.remove("workflowModalOpen");
  }
  densitySignalBtn?.focus();
}

function buildStage0ModalInnerHTML() {
  const tf = (s) => `<span class="workflowTf">${s}</span>`;
  return `
<div class="workflowPanelScroll">
  <section class="workflowStage workflowStage--purple" aria-labelledby="wf-s0">
    <h3 class="workflowStageTitle" id="wf-s0">🟣 ЭТАП 0: Поводырь (BTC Context &amp; Корреляция)</h3>
    <p class="workflowP"><strong>Цель:</strong> Понять, кто ведёт цену — Биток или сама монета.</p>

    <p class="workflowAction"><strong>Действие 1 (Корреляция):</strong></p>
    <ul class="workflowList workflowList--tight">
      <li><strong>&gt; 75%:</strong> Монета ходит за BTC. Торгуем только синхронно с ним.</li>
      <li><strong>&lt; 40%:</strong> Монета в игре (In Play). Забываем про BTC, торгуем альткоин как самостоятельный актив.</li>
    </ul>

    <p class="workflowAction workflowAction--spaced"><strong>Действие 2 (Статус BTC на ${tf("M5")}/${tf("H1")}):</strong></p>
    <ul class="workflowList">
      <li><strong>BTC летит (импульс):</strong> Не торгуем отскоки на альткоинах (снесут). Ищем сделки только по тренду BTC.</li>
      <li><strong>BTC в боковике/затух:</strong> Идеальное время для скальпинга. Альткоины начинают отрабатывать свои собственные локальные уровни и плотности.</li>
      <li><strong>BTC делает ложный пробой (закол уровня):</strong> Лучший момент для входа в альткоин в сторону отката.</li>
    </ul>
  </section>
</div>`;
}

function ensureStage0Modal() {
  if (stage0OverlayEl) return stage0OverlayEl;
  const overlay = document.createElement("div");
  overlay.id = "stage0Overlay";
  overlay.className = "workflowOverlay";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-labelledby", "stage0ModalTitle");
  overlay.innerHTML = `
    <div class="workflowPanel workflowPanel--stage0">
      <div class="workflowPanelHead">
        <h2 class="workflowPanelTitle" id="stage0ModalTitle">Этап 0 — Поводырь</h2>
        <button type="button" class="workflowCloseBtn" aria-label="Закрыть">×</button>
      </div>
      <div class="workflowPanelBody"></div>
    </div>`;
  const body = overlay.querySelector(".workflowPanelBody");
  if (body) body.innerHTML = buildStage0ModalInnerHTML();
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeStage0Modal();
  });
  overlay
    .querySelector(".workflowCloseBtn")
    ?.addEventListener("click", closeStage0Modal);
  document.body.appendChild(overlay);
  stage0OverlayEl = overlay;
  return overlay;
}

function openStage0Modal() {
  if (workflowOverlayEl?.classList?.contains("is-open")) closeWorkflowModal();
  if (weekDaysOverlayEl?.classList?.contains("is-open")) closeWeekDaysModal();
  if (densitySignalOverlayEl?.classList?.contains("is-open"))
    closeDensitySignalModal();
  ensureStage0Modal();
  stage0OverlayEl?.classList.add("is-open");
  document.body.classList.add("workflowModalOpen");
  stage0OverlayEl?.querySelector(".workflowCloseBtn")?.focus();
}

function closeStage0Modal() {
  stage0OverlayEl?.classList.remove("is-open");
  if (
    !workflowOverlayEl?.classList?.contains("is-open") &&
    !weekDaysOverlayEl?.classList?.contains("is-open") &&
    !densitySignalOverlayEl?.classList?.contains("is-open")
  ) {
    document.body.classList.remove("workflowModalOpen");
  }
  workflowStage0Btn?.focus();
}

function buildWorkflowModalInnerHTML() {
  const tf = (s) => `<span class="workflowTf">${s}</span>`;
  return `
<div class="workflowPanelScroll">
  <section class="workflowStage workflowStage--green" aria-labelledby="wf-s1">
    <h3 class="workflowStageTitle" id="wf-s1">🟢 ЭТАП 1: Анализ контекста (Scalpboard)</h3>
    <p class="workflowP"><strong>Цель:</strong> определить «Игру» (Map).</p>
    <p class="workflowP"><strong>Таймфрейм:</strong> ${tf("H1")} (1–2 суток) → ${tf("M15")} (последние 3–4 часа).</p>
    <p class="workflowAction"><strong>Действие:</strong> смотрим структуру.</p>
    <ul class="workflowList">
      <li>Вижу лесенку вверх? → тег <strong>Long Trend</strong>.</li>
      <li>Вижу коридор (минимум 2 касания границ)? → тег <strong>Range</strong>.</li>
      <li>Цена «липнет» к уровню без откатов? → тег <strong>Breakout</strong>.</li>
    </ul>
  </section>

  <section class="workflowStage workflowStage--yellow" aria-labelledby="wf-s2">
    <h3 class="workflowStageTitle" id="wf-s2">🟡 ЭТАП 2: Ликвидации (CoinGlass Liq Heatmap)</h3>
    <p class="workflowP"><strong>Цель:</strong> найти «Топливо» (Fuel).</p>
    <p class="workflowP"><strong>Таймфрейм:</strong> ${tf("5m")} (ближайшие зоны).</p>
    <p class="workflowAction"><strong>Действие:</strong> ищем яркие жёлтые полосы.</p>
    <ul class="workflowList">
      <li>Жирная зона сверху? → тег <strong>Liquidation Top</strong> + <strong>Heavy</strong>.</li>
      <li>Зоны с обеих сторон канала? → тег <strong>Both Sides</strong>.</li>
      <li>Зона только что появилась? → тег <strong>Fresh</strong>.</li>
    </ul>
  </section>

  <section class="workflowStage workflowStage--blue" aria-labelledby="wf-s3">
    <h3 class="workflowStageTitle" id="wf-s3">🔵 ЭТАП 3: Энергия (CoinGlass Live Data)</h3>
    <p class="workflowP"><strong>Цель:</strong> проверить «Силу» (Engine).</p>
    <p class="workflowP"><strong>Таймфрейм:</strong> ${tf("5m")} (последние 6–10 свечей).</p>
    <p class="workflowAction"><strong>Действие:</strong> смотрим дельту OI и значение Funding.</p>
    <ul class="workflowList">
      <li>OI растёт последние 30 мин? → тег <strong>OI Rising</strong>.</li>
      <li>Funding &gt; 0,05%? → тег <strong>Positive</strong> (лонгисты перегреты).</li>
      <li>Funding &lt; −0,05%? → тег <strong>Negative</strong> (шортисты в ловушке).</li>
    </ul>
  </section>

  <section class="workflowStage workflowStage--red" aria-labelledby="wf-s4">
    <h3 class="workflowStageTitle" id="wf-s4">🔴 ЭТАП 4: Точка входа (Tiger Trade)</h3>
    <p class="workflowP"><strong>Цель:</strong> найти «Триггер» (Trigger).</p>
    <p class="workflowP"><strong>Таймфрейм:</strong> ${tf("M1")} (момент касания зоны).</p>
    <p class="workflowAction"><strong>Действие:</strong> анализ стакана, ленты и кластера.</p>
    <ul class="workflowList">
      <li>Стоит крупная лимитка? → тег <strong>Real Wall</strong>.</li>
      <li>Лента замедлилась перед зоной? → тег <strong>Exhaustion</strong>.</li>
      <li>Огромный объём в хвосте свечи не пускает цену? → тег <strong>Absorption</strong>.</li>
    </ul>
  </section>

  <section class="workflowMatrix" aria-labelledby="wf-matrix">
    <h3 class="workflowMatrixTitle" id="wf-matrix">Сводка: шаги 1–2 + шаги 3–4 → действие</h3>
    <p class="workflowMatrixHint">Если на шагах <strong>1–2</strong> видишь условие из первого столбца <em>и</em> на шагах <strong>3–4</strong> — из второго:</p>
    <div class="workflowTableWrap">
      <table class="workflowTable">
        <thead>
          <tr>
            <th scope="col">Шаги 1–2</th>
            <th scope="col">Шаги 3–4</th>
            <th scope="col">Твоё действие</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Trend Long + Liq Bottom</td>
            <td>OI Falling + Absorption</td>
            <td><strong>ВХОД (Long)</strong> — дозаправка.</td>
          </tr>
          <tr>
            <td>Range + Liq Top/Bottom</td>
            <td>OI Falling + Exhaustion</td>
            <td><strong>ВХОД (отскок)</strong> — ложный пробой.</td>
          </tr>
          <tr>
            <td>Breakout + Liq Top</td>
            <td>OI Rising + Aggressive Tape</td>
            <td><strong>ВХОД (Long)</strong> — пробой на сквиз.</td>
          </tr>
          <tr>
            <td>Trend Long + Liq Top</td>
            <td>OI Rising + Aggressive Tape</td>
            <td><strong>PASS (пропуск)</strong> — это магнит, шортить нельзя.</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</div>`;
}

function ensureWorkflowModal() {
  if (workflowOverlayEl) return workflowOverlayEl;
  const overlay = document.createElement("div");
  overlay.id = "workflowOverlay";
  overlay.className = "workflowOverlay";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-labelledby", "workflowModalTitle");
  overlay.innerHTML = `
    <div class="workflowPanel">
      <div class="workflowPanelHead">
        <h2 class="workflowPanelTitle" id="workflowModalTitle">Последовательность действий</h2>
        <button type="button" class="workflowCloseBtn" aria-label="Закрыть">×</button>
      </div>
      <div class="workflowPanelBody"></div>
    </div>`;
  const body = overlay.querySelector(".workflowPanelBody");
  if (body) body.innerHTML = buildWorkflowModalInnerHTML();
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeWorkflowModal();
  });
  overlay
    .querySelector(".workflowCloseBtn")
    ?.addEventListener("click", closeWorkflowModal);
  document.body.appendChild(overlay);
  workflowOverlayEl = overlay;
  return overlay;
}

function openWorkflowModal() {
  if (stage0OverlayEl?.classList?.contains("is-open")) closeStage0Modal();
  if (weekDaysOverlayEl?.classList?.contains("is-open")) closeWeekDaysModal();
  if (densitySignalOverlayEl?.classList?.contains("is-open"))
    closeDensitySignalModal();
  ensureWorkflowModal();
  workflowOverlayEl?.classList.add("is-open");
  document.body.classList.add("workflowModalOpen");
  workflowOverlayEl?.querySelector(".workflowCloseBtn")?.focus();
}

function closeWorkflowModal() {
  workflowOverlayEl?.classList.remove("is-open");
  if (
    !stage0OverlayEl?.classList?.contains("is-open") &&
    !weekDaysOverlayEl?.classList?.contains("is-open") &&
    !densitySignalOverlayEl?.classList?.contains("is-open")
  ) {
    document.body.classList.remove("workflowModalOpen");
  }
  workflowStepsBtn?.focus();
}

if (workflowStage0Btn) {
  workflowStage0Btn.addEventListener("click", () => openStage0Modal());
}

if (workflowStepsBtn) {
  workflowStepsBtn.addEventListener("click", () => openWorkflowModal());
}

if (weekDaysBtn) {
  weekDaysBtn.addEventListener("click", () => openWeekDaysModal());
}

if (densitySignalBtn) {
  densitySignalBtn.addEventListener("click", () => openDensitySignalModal());
}

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    if (stage0OverlayEl?.classList?.contains("is-open")) {
      e.preventDefault();
      closeStage0Modal();
      return;
    }
    if (workflowOverlayEl?.classList?.contains("is-open")) {
      e.preventDefault();
      closeWorkflowModal();
      return;
    }
    if (weekDaysOverlayEl?.classList?.contains("is-open")) {
      e.preventDefault();
      closeWeekDaysModal();
      return;
    }
    if (densitySignalOverlayEl?.classList?.contains("is-open")) {
      e.preventDefault();
      closeDensitySignalModal();
      return;
    }
    hideTagTooltip();
  }
});

if (coinNotes) {
  coinNotes.addEventListener("input", () => {
    if (!current) return;
    current.notes = coinNotes.value;
    schedulePersist();
  });
}

if (btcCorrelationInput) {
  btcCorrelationInput.addEventListener("input", () => {
    if (!current) return;
    const sanitized = normalizeBtcCorrelationStored(btcCorrelationInput.value);
    if (btcCorrelationInput.value !== sanitized)
      btcCorrelationInput.value = sanitized;
    current.btcCorrelation = sanitized;
    schedulePersist();
  });
}

createForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const coin = coinInput.value.trim();
  if (!coin) return;

  coinInput.disabled = true;

  const checklist = buildChecklist(coin);
  store.checklists.push(checklist);
  current = checklist;

  emptyState.hidden = true;
  detail.hidden = false;
  coinEditInput.value = current.coin;
  createdAt.textContent = `Создан: ${formatDate(current.createdAt)}`;
  if (coinNotes) coinNotes.value = current.notes || "";
  if (btcCorrelationInput) btcCorrelationInput.value = "";
  renderBlocks(current);
  dirty = false;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = null;

  saveLocalStore();
  refreshList();
  coinInput.value = "";
  coinInput.disabled = false;
});

saveTitleBtn.addEventListener("click", () => {
  if (!current) return;
  const coin = coinEditInput.value.trim();
  if (!coin) return;

  current.coin = coin;
  coinEditInput.value = current.coin;
  createdAt.textContent = `Создан: ${formatDate(current.createdAt)}`;
  saveLocalStore();
  refreshList();
});

if (copyReportBtn) {
  copyReportBtn.addEventListener("click", () => {
    copyChecklistReport();
  });
}

deleteBtn.addEventListener("click", () => {
  if (!current) return;
  const coin = current.coin;
  const ok = confirm(`Удалить чек‑лист "${coin}"?`);
  if (!ok) return;

  deleteBtn.disabled = true;

  store.checklists = store.checklists.filter((c) => c.id !== current.id);
  current = null;
  detail.hidden = true;
  emptyState.hidden = false;
  sectionsEl.innerHTML = "";
  if (setupVerdictEl) setupVerdictEl.hidden = true;

  dirty = false;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = null;

  saveLocalStore();
  refreshList();
  deleteBtn.disabled = false;
});

if (copyAllChecklistsBtn) {
  copyAllChecklistsBtn.addEventListener("click", () => {
    copyAllChecklistsExport();
  });
}

if (deleteAllChecklistsBtn) {
  deleteAllChecklistsBtn.addEventListener("click", () => {
    const n = store.checklists.length;
    if (!n) return;
    const ok = confirm(
      `Удалить все чек‑листы (${n} шт.)? Данные из локального хранилища будут стёрты; отменить это действие нельзя.`,
    );
    if (!ok) return;

    deleteAllChecklistsBtn.disabled = true;
    hideTagTooltip();

    store.checklists = [];
    current = null;
    detail.hidden = true;
    emptyState.hidden = false;
    sectionsEl.innerHTML = "";
    if (setupVerdictEl) setupVerdictEl.hidden = true;
    if (coinNotes) coinNotes.value = "";
    if (coinEditInput) coinEditInput.value = "";
    if (btcCorrelationInput) btcCorrelationInput.value = "";

    dirty = false;
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = null;

    saveLocalStore();
    refreshList();
  });
}

store = loadLocalStore();
const legacyV1 = (() => {
  try {
    const raw = localStorage.getItem("checklists-v1");
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
})();

if (
  (!store.checklists || !store.checklists.length) &&
  legacyV1 &&
  Array.isArray(legacyV1.checklists) &&
  legacyV1.checklists.length
) {
  store = {
    checklists: legacyV1.checklists.map(migrateChecklistEntry),
  };
  saveLocalStore();
} else {
  let changed = false;
  store.checklists = store.checklists.map((c) => {
    const m = migrateChecklistEntry(c);
    if (m !== c) changed = true;
    return m;
  });
  if (changed) saveLocalStore();
}

refreshList();
