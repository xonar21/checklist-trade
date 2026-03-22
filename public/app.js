const el = (id) => document.getElementById(id);

const createForm = el('createForm');
const coinInput = el('coinInput');
const checklistList = el('checklistList');
const emptyState = el('emptyState');

const detail = el('detail');
const coinEditInput = el('coinEditInput');
const createdAt = el('createdAt');
const saveTitleBtn = el('saveTitleBtn');
const copyReportBtn = el('copyReportBtn');
const deleteBtn = el('deleteBtn');
const deleteAllChecklistsBtn = el('deleteAllChecklistsBtn');
const sectionsEl = el('sections');
const coinNotes = el('coinNotes');
const setupVerdictEl = el('setupVerdict');
const setupVerdictBody = el('setupVerdictBody');
const themeToggleBtn = el('themeToggleBtn');
const workflowStage0Btn = el('workflowStage0Btn');
const workflowStepsBtn = el('workflowStepsBtn');
const btcCorrelationInput = el('btcCorrelationInput');

let current = null;
let saveTimer = null;
let dirty = false;

function setTheme(theme) {
  document.body.dataset.theme = theme;
  try {
    localStorage.setItem('theme', theme);
  } catch {
    // ignore
  }

  if (themeToggleBtn) {
    themeToggleBtn.textContent = theme === 'dark' ? 'Светлая тема' : 'Тёмная тема';
  }
}

(() => {
  try {
    const saved = localStorage.getItem('theme');
    const prefersLight = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
    const initial = saved || (prefersLight ? 'light' : 'dark');
    setTheme(initial);
  } catch {
    // ignore
  }

  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
      const nextTheme = document.body.dataset.theme === 'light' ? 'dark' : 'light';
      setTheme(nextTheme);
    });
  }
})();

const STORAGE_KEY = 'checklists-v2';

const DROP_GROUPS = new Set(['map-tf', 'map-btc', 'liq-dist']);

let store = { checklists: [] };

function loadLocalStore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { checklists: [] };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return { checklists: [] };
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
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
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
  return tagHintByIdCache.get(tagId) || '';
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
  return groupHintByIdCache.get(groupId) || '';
}

/** Кэш order блока → HTML подсказки на шапке блока (из шаблона). */
let blockHintHtmlByOrderCache = null;

function getBlockHintHtmlFromTemplate(order) {
  if (blockHintHtmlByOrderCache == null) {
    blockHintHtmlByOrderCache = new Map();
    const T = globalThis.CHECKLIST_TEMPLATE_BLOCKS;
    if (T && Array.isArray(T)) {
      for (const b of T) {
        if (b.order != null && b.blockHintHtml) blockHintHtmlByOrderCache.set(b.order, b.blockHintHtml);
      }
    }
  }
  return blockHintHtmlByOrderCache.get(order) || '';
}

function getTagHintImageFromTemplate(tagId) {
  if (!tagHintImageByIdCache) {
    tagHintImageByIdCache = new Map();
    const T = globalThis.CHECKLIST_TEMPLATE_BLOCKS;
    if (T && Array.isArray(T)) {
      for (const b of T) {
        for (const g of b.groups || []) {
          for (const t of g.tags || []) {
            if (t.id && t.hintImage) tagHintImageByIdCache.set(t.id, t.hintImage);
          }
        }
      }
    }
  }
  return tagHintImageByIdCache.get(tagId) || '';
}

/** Десктоп с мышью: подсказки по ПКМ, без hover. Иначе — hover (mouseenter) на сенсоре/без fine pointer. */
function isDesktopFinePointer() {
  return window.matchMedia('(hover: hover) and (pointer: fine)').matches;
}

/** Безопасный URL для файлов с кириллицей в имени. */
function publicImageUrl(path) {
  if (!path || typeof path !== 'string') return '';
  const p = path.startsWith('/') ? path : `/${path}`;
  const parts = p.split('/').filter(Boolean);
  return `/${parts.map(encodeURIComponent).join('/')}`;
}

let tagTooltipEl = null;
/** @type {HTMLElement | null} */
let tagTooltipAnchor = null;
/** Элемент, относительно которого считается rect (например заголовок блока, а подсветка — вся шапка). */
let tagTooltipPositionEl = null;
/** @type { 'center' | 'left' } */
let tagTooltipAlign = 'center';
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
  const box = document.createElement('div');
  box.className = 'tagTooltip';
  box.setAttribute('role', 'tooltip');
  const img = document.createElement('img');
  img.className = 'tagTooltipImg';
  img.alt = '';
  const text = document.createElement('div');
  text.className = 'tagTooltipText';
  text.hidden = true;
  box.appendChild(img);
  box.appendChild(text);
  box.addEventListener('mouseenter', cancelHideTagTooltip);
  box.addEventListener('mouseleave', () => {
    cancelHideTagTooltip();
    hideTagTooltip();
  });
  document.body.appendChild(box);
  tagTooltipEl = box;
  return tagTooltipEl;
}

function positionTagTooltip() {
  const box = tagTooltipEl;
  if (!box || !tagTooltipAnchor || !box.classList.contains('is-visible')) return;
  const posEl = tagTooltipPositionEl || tagTooltipAnchor;
  const r = posEl.getBoundingClientRect();
  const margin = 8;
  const vv = window.visualViewport;
  const vw = vv ? vv.width : window.innerWidth;
  const vh = vv ? vv.height : window.innerHeight;
  const vvx = vv ? vv.offsetLeft : 0;
  const vvy = vv ? vv.offsetTop : 0;
  const textEl = box.querySelector('.tagTooltipText');
  const rich = textEl && textEl.classList.contains('tagTooltipText--rich');
  const maxW = Math.min(rich ? 480 : 420, vw - margin * 2);
  box.style.maxWidth = `${maxW}px`;
  const w = box.offsetWidth || 1;
  const h = box.offsetHeight || 1;
  let left =
    tagTooltipAlign === 'left' ? r.left : r.left + r.width / 2 - w / 2;
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
    tagTooltipAnchor.classList.remove('hintAnchorActive');
  }
  tagTooltipAnchor = anchor;
  tagTooltipAnchor.classList.add('hintAnchorActive');
  tagTooltipPositionEl = payload.positionEl || null;
  tagTooltipAlign = payload.align === 'left' ? 'left' : 'center';

  const box = ensureTagTooltip();
  const img = box.querySelector('.tagTooltipImg');
  const textEl = box.querySelector('.tagTooltipText');

  if (imagePath) {
    img.hidden = false;
    const url = publicImageUrl(imagePath);
    img.src = url;
    img.alt = (anchor.textContent && anchor.textContent.trim()) || 'Пример';
    img.onload = () => positionTagTooltip();
  } else {
    img.hidden = true;
    img.removeAttribute('src');
  }

  if (htmlHint) {
    textEl.hidden = false;
    textEl.textContent = '';
    textEl.innerHTML = htmlHint;
    textEl.classList.add('tagTooltipText--rich');
  } else if (textHint) {
    textEl.hidden = false;
    textEl.innerHTML = '';
    textEl.textContent = textHint;
    textEl.classList.remove('tagTooltipText--rich');
  } else {
    textEl.hidden = true;
    textEl.textContent = '';
    textEl.innerHTML = '';
    textEl.classList.remove('tagTooltipText--rich');
  }

  box.classList.add('is-visible');
  requestAnimationFrame(() => positionTagTooltip());
  if (!tagTooltipScrollHandler) {
    tagTooltipScrollHandler = () => positionTagTooltip();
    window.addEventListener('scroll', tagTooltipScrollHandler, true);
    window.addEventListener('resize', tagTooltipScrollHandler);
  }
}

function hideTagTooltip() {
  cancelHideTagTooltip();
  if (tagTooltipAnchor) {
    tagTooltipAnchor.classList.remove('hintAnchorActive');
    tagTooltipAnchor = null;
  }
  tagTooltipPositionEl = null;
  tagTooltipAlign = 'center';
  if (tagTooltipEl) {
    const te = tagTooltipEl.querySelector('.tagTooltipText');
    if (te) {
      te.textContent = '';
      te.innerHTML = '';
      te.classList.remove('tagTooltipText--rich');
    }
    tagTooltipEl.classList.remove('is-visible');
  }
}

document.addEventListener(
  'mousedown',
  (e) => {
    if (!tagTooltipEl || !tagTooltipEl.classList.contains('is-visible')) return;
    if (e.button !== 0) return;
    if (tagTooltipEl.contains(/** @type {Node} */ (e.target))) return;
    hideTagTooltip();
  },
  true
);

function buildBlocksFromTemplate() {
  const T = globalThis.CHECKLIST_TEMPLATE_BLOCKS;
  if (!T || !Array.isArray(T)) {
    console.error('CHECKLIST_TEMPLATE_BLOCKS не загружен');
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
  if (v == null || v === '') return '';
  const digits = String(v).replace(/\D/g, '');
  if (digits === '') return '';
  const n = parseInt(digits, 10);
  if (Number.isNaN(n)) return '';
  return String(Math.min(100, n));
}

function normalizeChecklistShape(c) {
  let notes = typeof c.notes === 'string' ? c.notes : '';
  const btcCorrelation = normalizeBtcCorrelationStored(c.btcCorrelation);
  let blocks = c.blocks;
  if (Array.isArray(blocks)) {
    const fromBlocks = blocks.map((b) => b.notes).filter(Boolean).join('\n\n');
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
    notes: '',
    btcCorrelation: '',
    blocks: buildBlocksFromTemplate(),
  };
}

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString('ru-RU', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

/** Текстовый отчёт для буфера обмена: монета, время, описание, теги по блокам. */
function buildChecklistReport() {
  if (!current) return '';
  const coin = (coinEditInput?.value || current.coin || '').trim() || '—';
  const created = formatDate(current.createdAt) || '—';
  const notesRaw = (coinNotes?.value ?? current.notes ?? '').trim();
  const lines = [];
  lines.push(`Монета          ${coin}`);
  lines.push(`Дата и время    ${created}`);
  lines.push('');
  lines.push('ОПИСАНИЕ');
  lines.push(notesRaw || '—');
  lines.push('');
  lines.push('КОРРЕЛЯЦИЯ С BTC');
  const btcCorr = normalizeBtcCorrelationStored(
    btcCorrelationInput?.value != null ? btcCorrelationInput.value : current.btcCorrelation
  );
  lines.push(btcCorr ? `${btcCorr}%` : '—');
  lines.push('');
  lines.push('ВЫБРАННЫЕ ТЕГИ');

  const blocks = (current.blocks || []).slice().sort((a, b) => a.order - b.order);
  for (const block of blocks) {
    lines.push('');
    lines.push(`▸ ${block.title}`);
    for (const g of block.groups || []) {
      const sel = Array.isArray(g.selected) ? g.selected : [];
      let value = 'не выбрано';
      if (sel.length) {
        const labels = [];
        for (const sid of sel) {
          const tag = (g.tags || []).find((t) => t.id === sid);
          labels.push(tag ? tag.label : sid);
        }
        value = labels.join(', ');
      }
      lines.push(`  • ${g.label}`);
      lines.push(`      ${value}`);
    }
  }

  return lines.join('\n');
}

async function copyChecklistReport() {
  if (!current || !copyReportBtn) return;
  const text = buildChecklistReport();
  const prevLabel = copyReportBtn.textContent;
  const done = () => {
    copyReportBtn.textContent = 'Скопировано в буфер';
    copyReportBtn.disabled = true;
    window.setTimeout(() => {
      copyReportBtn.textContent = prevLabel;
      copyReportBtn.disabled = false;
    }, 2000);
  };

  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      throw new Error('no clipboard');
    }
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    } catch {
      copyReportBtn.textContent = 'Не удалось скопировать';
      window.setTimeout(() => {
        copyReportBtn.textContent = prevLabel;
      }, 2000);
      return;
    }
  }
  done();
}

function renderList(checklists) {
  checklistList.innerHTML = '';
  if (!checklists.length || !current) {
    emptyState.hidden = false;
    detail.hidden = true;
  } else {
    emptyState.hidden = true;
    detail.hidden = false;
  }

  for (const c of checklists) {
    const item = document.createElement('div');
    item.className = 'listItem' + (current?.id === c.id ? ' active' : '');
    item.dataset.id = c.id;

    const title = document.createElement('div');
    title.className = 'listItemTitle';
    title.textContent = c.coin;

    const meta = document.createElement('div');
    meta.className = 'listItemMeta';
    meta.textContent = formatDate(c.createdAt);

    item.appendChild(title);
    item.appendChild(meta);

    item.addEventListener('click', () => selectChecklist(c.id));
    checklistList.appendChild(item);
  }
}

function refreshList() {
  const sorted = store.checklists.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  renderList(sorted);
  if (deleteAllChecklistsBtn) {
    deleteAllChecklistsBtn.disabled = store.checklists.length === 0;
  }
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
  if (coinNotes) coinNotes.value = current.notes || '';
  if (btcCorrelationInput) btcCorrelationInput.value = normalizeBtcCorrelationStored(current.btcCorrelation);
  renderBlocks(current);
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
        if (typeof id === 'string' && id.length) ids.push(id);
      }
    }
  }
  return ids;
}

function getScoreTradingSetup() {
  if (typeof globalThis !== 'undefined' && typeof globalThis.scoreTradingSetup === 'function') {
    return globalThis.scoreTradingSetup;
  }
  if (typeof window !== 'undefined' && typeof window.scoreTradingSetup === 'function') {
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
  setupVerdictEl.className = 'setupVerdict ' + result.status;

  setupVerdictBody.replaceChildren();

  const meta = document.createElement('div');
  meta.className = 'setupVerdictMeta';
  const statusLabel =
    result.status === 'danger'
      ? 'Вход запрещён'
      : result.status === 'warning'
        ? 'Внимание'
        : 'Сценарий';
  const scoreNum = typeof result.score === 'number' ? result.score : 0;
  const tail =
    result.status === 'success'
      ? result.actionType || '—'
      : result.status === 'warning'
        ? result.actionType && result.actionType !== 'None'
          ? 'грязный сетап / конфликт контекста'
          : 'сценарий не собран (нужна полная комбинация тегов для базы 50 баллов)'
        : 'сработал красный флаг';
  meta.textContent = `${statusLabel} · ${scoreNum} баллов · ${tail}`;

  const msg = document.createElement('div');
  msg.className = 'setupVerdictMessage';
  msg.textContent = result.message;

  setupVerdictBody.appendChild(meta);
  setupVerdictBody.appendChild(msg);

  const da = result.deepAnalysis;
  if (da && typeof da === 'object') {
    const deepEl = document.createElement('div');
    deepEl.className = 'setupVerdictDeep';
    const tier = document.createElement('div');
    tier.className = 'setupVerdictDeepLine';
    tier.textContent = `Риск: ${da.riskTier}. Исполнение: ${da.orderType}.`;
    deepEl.appendChild(tier);
    if (da.invalidationPoint) {
      const inv = document.createElement('div');
      inv.className = 'setupVerdictDeepLine';
      inv.textContent = `Инвалидация: ${da.invalidationPoint}`;
      deepEl.appendChild(inv);
    }
    if (da.archetype) {
      const ar = document.createElement('div');
      ar.className = 'setupVerdictDeepLine setupVerdictArchetype';
      ar.textContent = `Архетип: ${da.archetype}`;
      deepEl.appendChild(ar);
    }
    if (da.stopStrategy) {
      const st = document.createElement('div');
      st.className = 'setupVerdictDeepLine';
      st.textContent = `Стоп-логика: ${da.stopStrategy}`;
      deepEl.appendChild(st);
    }
    if (da.volumeQuality) {
      const vq = document.createElement('div');
      vq.className = 'setupVerdictDeepLine';
      vq.textContent = `Качество энергии (OI × лента): ${da.volumeQuality}`;
      deepEl.appendChild(vq);
    }
    setupVerdictBody.appendChild(deepEl);
  }

  if (result.details?.notes?.length) {
    const nt = document.createElement('div');
    nt.className = 'setupVerdictMods';
    nt.textContent = result.details.notes.join(' ');
    setupVerdictBody.appendChild(nt);
  }

  if (result.details?.modifiers?.length) {
    const mods = document.createElement('div');
    mods.className = 'setupVerdictMods';
    mods.textContent =
      'Модификаторы: ' +
      result.details.modifiers.map((m) => `${m.label} (${m.delta > 0 ? '+' : ''}${m.delta})`).join('; ');
    setupVerdictBody.appendChild(mods);
  }
}

function renderBlocks(checklist) {
  hideTagTooltip();
  sectionsEl.innerHTML = '';

  const blocks = (checklist.blocks || []).slice().sort((a, b) => a.order - b.order);

  for (const block of blocks) {
    const card = document.createElement('div');
    card.className = 'sectionCard';

    const head = document.createElement('div');
    head.className = 'blockHead';

    const title = document.createElement('div');
    title.className = 'sectionTitle';
    title.textContent = block.title;

    const goal = document.createElement('div');
    goal.className = 'blockGoal';
    goal.textContent = block.goal;

    head.appendChild(title);
    head.appendChild(goal);
    card.appendChild(head);

    const blockHintHtml =
      (block.blockHintHtml && String(block.blockHintHtml)) || getBlockHintHtmlFromTemplate(block.order);
    if (blockHintHtml) {
      head.classList.add('blockHead--blockHint');
      head.setAttribute(
        'aria-label',
        `${block.title}. Подсказка по контексту: правая кнопка мыши на десктопе; на сенсоре — наведение`
      );
      const openBlockHint = () =>
        showTagTooltip(head, {
          htmlHint: blockHintHtml,
          positionEl: title,
          align: 'left',
        });
      head.addEventListener('contextmenu', (e) => {
        if (!isDesktopFinePointer()) return;
        e.preventDefault();
        openBlockHint();
      });
      head.addEventListener('mouseenter', () => {
        if (isDesktopFinePointer()) return;
        openBlockHint();
      });
      head.addEventListener('mouseleave', () => {
        if (isDesktopFinePointer()) return;
        scheduleHideTagTooltip();
      });
      // Без focus: иначе левый клик по шапке давал фокус и открывал подсказку.
    }

    const body = document.createElement('div');
    body.className = 'sectionBody blockBody';

    for (const group of block.groups || []) {
      const row = document.createElement('div');
      row.className = 'tagGroup';

      const glabel = document.createElement('div');
      glabel.className = 'tagGroupLabel';
      glabel.textContent = group.label;
      row.appendChild(glabel);

      const groupHintText = (group.groupHint && String(group.groupHint)) || getGroupHintFromTemplate(group.id);
      if (groupHintText) {
        const gHint = document.createElement('div');
        gHint.className = 'tagGroupHint';
        gHint.textContent = groupHintText;
        row.appendChild(gHint);
      }

      const chips = document.createElement('div');
      chips.className = 'tagChips';

      for (const tag of group.tags || []) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.dataset.tagId = tag.id;
        btn.className = 'tagChip' + (group.selected.includes(tag.id) ? ' active' : '');
        btn.textContent = tag.label;
        const hint = getTagHintFromTemplate(tag.id) || (tag.hint && String(tag.hint)) || '';
        if (hint) {
          btn.setAttribute('aria-description', hint);
        }
        // Шаблон важнее сохранённого hintImage (в localStorage могли остаться старые пути с кириллицей/пробелами).
        const imgPath = getTagHintImageFromTemplate(tag.id) || (tag.hintImage && String(tag.hintImage)) || '';
        if (imgPath) btn.classList.add('tagChip--hasImageHint');
        if (hint && !imgPath) btn.classList.add('tagChip--hasTextHint');
        if (hint || imgPath) {
          const openTooltip = () => showTagTooltip(btn, { imagePath: imgPath, textHint: hint });
          btn.addEventListener('contextmenu', (e) => {
            if (!isDesktopFinePointer()) return;
            e.preventDefault();
            openTooltip();
          });
          btn.addEventListener('mouseenter', () => {
            if (isDesktopFinePointer()) return;
            openTooltip();
          });
          btn.addEventListener('mouseleave', () => {
            if (isDesktopFinePointer()) return;
            scheduleHideTagTooltip();
          });
          // Не вешаем focus/blur: левый клик фокусирует кнопку и открывал бы подсказку.
          // На десктопе подсказка только по ПКМ; на тач — hover (mouseenter) без фокуса.
        }
        btn.addEventListener('click', () => {
          toggleTag(group, tag.id);
          chips.querySelectorAll('button.tagChip').forEach((ch) => {
            const tid = ch.dataset.tagId;
            ch.className = 'tagChip' + (group.selected.includes(tid) ? ' active' : '');
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

    <p class="workflowAction workflowAction--spaced"><strong>Действие 2 (Статус BTC на ${tf('M5')}/${tf('H1')}):</strong></p>
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
  const overlay = document.createElement('div');
  overlay.id = 'stage0Overlay';
  overlay.className = 'workflowOverlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'stage0ModalTitle');
  overlay.innerHTML = `
    <div class="workflowPanel workflowPanel--stage0">
      <div class="workflowPanelHead">
        <h2 class="workflowPanelTitle" id="stage0ModalTitle">Этап 0 — Поводырь</h2>
        <button type="button" class="workflowCloseBtn" aria-label="Закрыть">×</button>
      </div>
      <div class="workflowPanelBody"></div>
    </div>`;
  const body = overlay.querySelector('.workflowPanelBody');
  if (body) body.innerHTML = buildStage0ModalInnerHTML();
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeStage0Modal();
  });
  overlay.querySelector('.workflowCloseBtn')?.addEventListener('click', closeStage0Modal);
  document.body.appendChild(overlay);
  stage0OverlayEl = overlay;
  return overlay;
}

function openStage0Modal() {
  if (workflowOverlayEl?.classList?.contains('is-open')) closeWorkflowModal();
  ensureStage0Modal();
  stage0OverlayEl?.classList.add('is-open');
  document.body.classList.add('workflowModalOpen');
  stage0OverlayEl?.querySelector('.workflowCloseBtn')?.focus();
}

function closeStage0Modal() {
  stage0OverlayEl?.classList.remove('is-open');
  if (!workflowOverlayEl?.classList?.contains('is-open')) {
    document.body.classList.remove('workflowModalOpen');
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
    <p class="workflowP"><strong>Таймфрейм:</strong> ${tf('H1')} (1–2 суток) → ${tf('M15')} (последние 3–4 часа).</p>
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
    <p class="workflowP"><strong>Таймфрейм:</strong> ${tf('5m')} (ближайшие зоны).</p>
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
    <p class="workflowP"><strong>Таймфрейм:</strong> ${tf('5m')} (последние 6–10 свечей).</p>
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
    <p class="workflowP"><strong>Таймфрейм:</strong> ${tf('M1')} (момент касания зоны).</p>
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
  const overlay = document.createElement('div');
  overlay.id = 'workflowOverlay';
  overlay.className = 'workflowOverlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'workflowModalTitle');
  overlay.innerHTML = `
    <div class="workflowPanel">
      <div class="workflowPanelHead">
        <h2 class="workflowPanelTitle" id="workflowModalTitle">Последовательность действий</h2>
        <button type="button" class="workflowCloseBtn" aria-label="Закрыть">×</button>
      </div>
      <div class="workflowPanelBody"></div>
    </div>`;
  const body = overlay.querySelector('.workflowPanelBody');
  if (body) body.innerHTML = buildWorkflowModalInnerHTML();
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeWorkflowModal();
  });
  overlay.querySelector('.workflowCloseBtn')?.addEventListener('click', closeWorkflowModal);
  document.body.appendChild(overlay);
  workflowOverlayEl = overlay;
  return overlay;
}

function openWorkflowModal() {
  if (stage0OverlayEl?.classList?.contains('is-open')) closeStage0Modal();
  ensureWorkflowModal();
  workflowOverlayEl?.classList.add('is-open');
  document.body.classList.add('workflowModalOpen');
  workflowOverlayEl?.querySelector('.workflowCloseBtn')?.focus();
}

function closeWorkflowModal() {
  workflowOverlayEl?.classList.remove('is-open');
  if (!stage0OverlayEl?.classList?.contains('is-open')) {
    document.body.classList.remove('workflowModalOpen');
  }
  workflowStepsBtn?.focus();
}

if (workflowStage0Btn) {
  workflowStage0Btn.addEventListener('click', () => openStage0Modal());
}

if (workflowStepsBtn) {
  workflowStepsBtn.addEventListener('click', () => openWorkflowModal());
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (stage0OverlayEl?.classList?.contains('is-open')) {
      e.preventDefault();
      closeStage0Modal();
      return;
    }
    if (workflowOverlayEl?.classList?.contains('is-open')) {
      e.preventDefault();
      closeWorkflowModal();
      return;
    }
    hideTagTooltip();
  }
});

if (coinNotes) {
  coinNotes.addEventListener('input', () => {
    if (!current) return;
    current.notes = coinNotes.value;
    schedulePersist();
  });
}

if (btcCorrelationInput) {
  btcCorrelationInput.addEventListener('input', () => {
    if (!current) return;
    const sanitized = normalizeBtcCorrelationStored(btcCorrelationInput.value);
    if (btcCorrelationInput.value !== sanitized) btcCorrelationInput.value = sanitized;
    current.btcCorrelation = sanitized;
    schedulePersist();
  });
}

createForm.addEventListener('submit', (e) => {
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
  if (coinNotes) coinNotes.value = current.notes || '';
  if (btcCorrelationInput) btcCorrelationInput.value = '';
  renderBlocks(current);
  dirty = false;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = null;

  saveLocalStore();
  refreshList();
  coinInput.value = '';
  coinInput.disabled = false;
});

saveTitleBtn.addEventListener('click', () => {
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
  copyReportBtn.addEventListener('click', () => {
    copyChecklistReport();
  });
}

deleteBtn.addEventListener('click', () => {
  if (!current) return;
  const coin = current.coin;
  const ok = confirm(`Удалить чек‑лист "${coin}"?`);
  if (!ok) return;

  deleteBtn.disabled = true;

  store.checklists = store.checklists.filter((c) => c.id !== current.id);
  current = null;
  detail.hidden = true;
  emptyState.hidden = false;
  sectionsEl.innerHTML = '';
  if (setupVerdictEl) setupVerdictEl.hidden = true;

  dirty = false;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = null;

  saveLocalStore();
  refreshList();
  deleteBtn.disabled = false;
});

if (deleteAllChecklistsBtn) {
  deleteAllChecklistsBtn.addEventListener('click', () => {
    const n = store.checklists.length;
    if (!n) return;
    const ok = confirm(
      `Удалить все чек‑листы (${n} шт.)? Данные из локального хранилища будут стёрты; отменить это действие нельзя.`
    );
    if (!ok) return;

    deleteAllChecklistsBtn.disabled = true;
    hideTagTooltip();

    store.checklists = [];
    current = null;
    detail.hidden = true;
    emptyState.hidden = false;
    sectionsEl.innerHTML = '';
    if (setupVerdictEl) setupVerdictEl.hidden = true;
    if (coinNotes) coinNotes.value = '';
    if (coinEditInput) coinEditInput.value = '';
    if (btcCorrelationInput) btcCorrelationInput.value = '';

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
    const raw = localStorage.getItem('checklists-v1');
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
})();

if ((!store.checklists || !store.checklists.length) && legacyV1 && Array.isArray(legacyV1.checklists) && legacyV1.checklists.length) {
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
