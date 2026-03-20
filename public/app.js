const el = (id) => document.getElementById(id);

const createForm = el('createForm');
const coinInput = el('coinInput');
const checklistList = el('checklistList');
const emptyState = el('emptyState');

const detail = el('detail');
const coinEditInput = el('coinEditInput');
const createdAt = el('createdAt');
const saveTitleBtn = el('saveTitleBtn');
const deleteBtn = el('deleteBtn');
const sectionsEl = el('sections');
const themeToggleBtn = el('themeToggleBtn');

let current = null; // выбранный чек-лист
let pendingItems = new Map(); // itemId -> checked
let saveTimer = null;

function setTheme(theme) {
  document.body.dataset.theme = theme;
  try {
    localStorage.setItem('theme', theme);
  } catch {
    // если localStorage недоступен — просто применим без сохранения
  }

  if (themeToggleBtn) {
    themeToggleBtn.textContent = theme === 'dark' ? 'Светлая тема' : 'Тёмная тема';
  }
}

// Инициализация темы
(() => {
  try {
    const saved = localStorage.getItem('theme');
    const prefersLight = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
    const initial = saved || (prefersLight ? 'light' : 'dark');
    setTheme(initial);
  } catch {
    // fallback: ничего не делаем, CSS по умолчанию уже тёмный
  }

  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
      const nextTheme = document.body.dataset.theme === 'light' ? 'dark' : 'light';
      setTheme(nextTheme);
    });
  }
})();

// -------------------------
// Local storage persistence
// -------------------------
const STORAGE_KEY = 'checklists-v1';

// Шаблон чек-листа (все стратегии из описания).
// Каждый элемент отдельно превращается в чекбокс (LONG/SHORT).
const TEMPLATE = [
  { order: 1, section: '1. Торговля по ТРЕНДУ', direction: 'LONG', text: 'Вход на откате' },
  { order: 1, section: '1. Торговля по ТРЕНДУ', direction: 'SHORT', text: 'Вход на отскоке' },
  { order: 1, section: '1. Торговля по ТРЕНДУ', direction: 'LONG', text: 'Максимумы и минимумы растут (H1/M15)' },
  { order: 1, section: '1. Торговля по ТРЕНДУ', direction: 'SHORT', text: 'Максимумы и минимумы падают (H1/M15)' },
  { order: 1, section: '1. Торговля по ТРЕНДУ', direction: 'LONG', text: 'BTC растет или стоит в боковике' },
  { order: 1, section: '1. Торговля по ТРЕНДУ', direction: 'SHORT', text: 'BTC падает или стоит в боковике' },
  { order: 1, section: '1. Торговля по ТРЕНДУ', direction: 'LONG', text: 'Зона ликвидаций: снизу (желтое пятно под текущей ценой)' },
  { order: 1, section: '1. Торговля по ТРЕНДУ', direction: 'SHORT', text: 'Зона ликвидаций: сверху (желтое пятно над текущей ценой)' },
  { order: 1, section: '1. Торговля по ТРЕНДУ', direction: 'LONG', text: 'OI: падает на коррекции вниз (выход лонгов)' },
  { order: 1, section: '1. Торговля по ТРЕНДУ', direction: 'SHORT', text: 'OI: падает на коррекции вверх (выход шортов)' },
  { order: 1, section: '1. Торговля по ТРЕНДУ', direction: 'LONG', text: 'Кластеры: крупные покупки (зеленые) в хвосте свечи' },
  { order: 1, section: '1. Торговля по ТРЕНДУ', direction: 'SHORT', text: 'Кластеры: крупные продажи (красные) в хвосте свечи' },
  { order: 1, section: '1. Торговля по ТРЕНДУ', direction: 'LONG', text: 'Фандинг: отрицательный (усиление для роста)' },
  { order: 1, section: '1. Торговля по ТРЕНДУ', direction: 'SHORT', text: 'Фандинг: положительный (усиление для падения)' },

  { order: 2, section: '2. Зеркальный уровень (ретест)', direction: 'LONG', text: 'Уровень стал поддержкой' },
  { order: 2, section: '2. Зеркальный уровень (ретест)', direction: 'SHORT', text: 'Уровень стал сопротивлением' },
  { order: 2, section: '2. Зеркальный уровень (ретест)', direction: 'LONG', text: 'Действие: пробили уровень вверх, возвращаемся к нему' },
  { order: 2, section: '2. Зеркальный уровень (ретест)', direction: 'SHORT', text: 'Действие: пробили уровень вниз, возвращаемся к нему' },
  { order: 2, section: '2. Зеркальный уровень (ретест)', direction: 'LONG', text: 'Зона ликвидаций: плотная зона на уровне или на 0.5% ниже него' },
  { order: 2, section: '2. Зеркальный уровень (ретест)', direction: 'SHORT', text: 'Зона ликвидаций: плотная зона на уровне или на 0.5% выше него' },
  { order: 2, section: '2. Зеркальный уровень (ретест)', direction: 'LONG', text: 'Лента (Tiger): замедление продаж при подходе к уровню' },
  { order: 2, section: '2. Зеркальный уровень (ретест)', direction: 'SHORT', text: 'Лента (Tiger): замедление покупок при подходе к уровню' },
  { order: 2, section: '2. Зеркальный уровень (ретест)', direction: 'LONG', text: 'Плотность: плотность под нами (на покупку)' },
  { order: 2, section: '2. Зеркальный уровень (ретест)', direction: 'SHORT', text: 'Плотность: плотность над нами (на продажу)' },
  { order: 2, section: '2. Зеркальный уровень (ретест)', direction: 'LONG', text: 'Вход: сетка — 1-й ордер на уровне, 4 ордера глубже' },
  { order: 2, section: '2. Зеркальный уровень (ретест)', direction: 'SHORT', text: 'Вход: сетка — 1-й ордер на уровне, 4 ордера глубже' },

  { order: 3, section: '3. Отскок от уровня (боковик)', direction: 'LONG', text: 'Флэт: жесткий боковик (флэт)' },
  { order: 3, section: '3. Отскок от уровня (боковик)', direction: 'SHORT', text: 'Флэт: жесткий боковик (флэт)' },
  { order: 3, section: '3. Отскок от уровня (боковик)', direction: 'LONG', text: 'От нижней границы' },
  { order: 3, section: '3. Отскок от уровня (боковик)', direction: 'SHORT', text: 'От верхней границы' },
  { order: 3, section: '3. Отскок от уровня (боковик)', direction: 'LONG', text: 'Зона ликвидаций: снизу за нижней границей боковика' },
  { order: 3, section: '3. Отскок от уровня (боковик)', direction: 'SHORT', text: 'Зона ликвидаций: сверху за верхней границей боковика' },
  { order: 3, section: '3. Отскок от уровня (боковик)', direction: 'LONG', text: 'Манипуляция: сквиз вниз за уровень — сбор ликвидаций' },
  { order: 3, section: '3. Отскок от уровня (боковик)', direction: 'SHORT', text: 'Манипуляция: сквиз вверх за уровень — сбор ликвидаций' },
  { order: 3, section: '3. Отскок от уровня (боковик)', direction: 'LONG', text: 'OI: резкий провал OI вниз в момент сквиза' },
  { order: 3, section: '3. Отскок от уровня (боковик)', direction: 'SHORT', text: 'OI: резкий провал OI вниз в момент сквиза' },
  { order: 3, section: '3. Отскок от уровня (боковик)', direction: 'LONG', text: 'Реакция: быстрый возврат цены выше уровня' },
  { order: 3, section: '3. Отскок от уровня (боковик)', direction: 'SHORT', text: 'Реакция: быстрый возврат цены ниже уровня' },

  { order: 4, section: '4. Пробой уровня (импульс)', direction: 'LONG', text: 'Пробой вверх' },
  { order: 4, section: '4. Пробой уровня (импульс)', direction: 'SHORT', text: 'Пробой вниз' },
  { order: 4, section: '4. Пробой уровня (импульс)', direction: 'LONG', text: 'Поджатие: свечи жмутся к сопротивлению' },
  { order: 4, section: '4. Пробой уровня (импульс)', direction: 'SHORT', text: 'Поджатие: свечи жмутся к поддержке' },
  { order: 4, section: '4. Пробой уровня (импульс)', direction: 'LONG', text: 'Зона ликвидаций: за уровнем (сверху) огромная желтая зона' },
  { order: 4, section: '4. Пробой уровня (импульс)', direction: 'SHORT', text: 'Зона ликвидаций: за уровнем (снизу) огромная желтая зона' },
  { order: 4, section: '4. Пробой уровня (импульс)', direction: 'LONG', text: 'OI: растет при подходе к уровню' },
  { order: 4, section: '4. Пробой уровня (импульс)', direction: 'SHORT', text: 'OI: растет при подходе к уровню' },
  { order: 4, section: '4. Пробой уровня (импульс)', direction: 'LONG', text: 'Фандинг: сильно отрицательный (шортистов зажали)' },
  { order: 4, section: '4. Пробой уровня (импульс)', direction: 'SHORT', text: 'Фандинг: сильно положительный (лонгистов зажали)' },
  { order: 4, section: '4. Пробой уровня (импульс)', direction: 'LONG', text: 'Лента: "полёт" зеленых принтов, плотность съедают' },
  { order: 4, section: '4. Пробой уровня (импульс)', direction: 'SHORT', text: 'Лента: "полёт" красных принтов, плотность съедают' },

  { order: 5, section: '5. Отскок от плотности (стакан)', direction: 'LONG', text: 'Покупаем от лимита' },
  { order: 5, section: '5. Отскок от плотности (стакан)', direction: 'SHORT', text: 'Продаем от лимита' },
  { order: 5, section: '5. Отскок от плотности (стакан)', direction: 'LONG', text: 'Плотность: огромная заявка в стакане снизу' },
  { order: 5, section: '5. Отскок от плотности (стакан)', direction: 'SHORT', text: 'Плотность: огромная заявка в стакане сверху' },
  { order: 5, section: '5. Отскок от плотности (стакан)', direction: 'LONG', text: 'Главный риск: ликвидации снизу (если они есть — не входим)' },
  { order: 5, section: '5. Отскок от плотности (стакан)', direction: 'SHORT', text: 'Главный риск: ликвидации сверху (если они есть — не входим)' },
  { order: 5, section: '5. Отскок от плотности (стакан)', direction: 'LONG', text: 'Лента: мелкие красные продажи не могут пробить лимит' },
  { order: 5, section: '5. Отскок от плотности (стакан)', direction: 'SHORT', text: 'Лента: мелкие зеленые покупки не могут пробить лимит' },
  { order: 5, section: '5. Отскок от плотности (стакан)', direction: 'LONG', text: 'OI: статичен или падает' },
  { order: 5, section: '5. Отскок от плотности (стакан)', direction: 'SHORT', text: 'OI: статичен или падает' },
  { order: 5, section: '5. Отскок от плотности (стакан)', direction: 'LONG', text: 'Стоп: сразу за плотностью (разъели — выходим)' },
  { order: 5, section: '5. Отскок от плотности (стакан)', direction: 'SHORT', text: 'Стоп: сразу за плотностью (разъели — выходим)' },
];

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
    // Если localStorage недоступен/заполнен — пользователь потеряет сохранения.
    // Но UI продолжит работать.
  }
}

function uuid() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  // fallback без зависимости от пакетов
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function buildChecklist(coin) {
  const now = new Date();
  return {
    id: uuid(),
    coin,
    createdAt: now.toISOString(),
    items: TEMPLATE.map((t) => ({
      id: uuid(),
      order: t.order,
      section: t.section,
      direction: t.direction,
      text: t.text,
      checked: false,
    })),
  };
}

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString('ru-RU', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
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
}

function selectChecklist(id) {
  current = store.checklists.find((c) => c.id === id) || null;
  if (!current) return;

  // Сброс pending
  pendingItems = new Map();
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = null;

  emptyState.hidden = true;
  detail.hidden = false;
  coinEditInput.value = current.coin;
  createdAt.textContent = `Создан: ${formatDate(current.createdAt)}`;
  renderSections(current);
}

function renderSections(checklist) {
  sectionsEl.innerHTML = '';

  const sorted = (checklist.items || []).slice().sort((a, b) => {
    const ao = a.order - b.order;
    if (ao !== 0) return ao;
    return a.direction.localeCompare(b.direction);
  });

  const sections = new Map();
  for (const it of sorted) {
    const key = it.order + '|' + it.section;
    if (!sections.has(key)) sections.set(key, { order: it.order, section: it.section, items: [] });
    sections.get(key).items.push(it);
  }

  const sectionCards = Array.from(sections.values()).sort((a, b) => a.order - b.order);
  for (const s of sectionCards) {
    const card = document.createElement('div');
    card.className = 'sectionCard';

    const title = document.createElement('div');
    title.className = 'sectionTitle';
    title.textContent = s.section;
    card.appendChild(title);

    const body = document.createElement('div');
    body.className = 'sectionBody sectionBodyTwoCol';

    const longCol = document.createElement('div');
    longCol.className = 'strategyCol';

    const shortCol = document.createElement('div');
    shortCol.className = 'strategyCol';

    const longHeader = document.createElement('div');
    longHeader.className = 'colHeader long';
    longHeader.textContent = 'LONG';

    const shortHeader = document.createElement('div');
    shortHeader.className = 'colHeader short';
    shortHeader.textContent = 'SHORT';

    longCol.appendChild(longHeader);
    shortCol.appendChild(shortHeader);

    for (const it of s.items) {
      const row = document.createElement('div');
      row.className = 'checkRow';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = !!it.checked;
      checkbox.id = it.id;

      const label = document.createElement('label');
      label.setAttribute('for', it.id);

      const pill = document.createElement('span');
      pill.className = 'dirPill ' + (it.direction === 'LONG' ? 'long' : 'short');
      pill.textContent = it.direction;

      const text = document.createElement('span');
      text.textContent = ' ' + it.text;

      label.appendChild(pill);
      label.appendChild(text);

      checkbox.addEventListener('change', () => {
        it.checked = checkbox.checked;
        pendingItems.set(it.id, checkbox.checked);
        scheduleSaveItems();
      });

      row.appendChild(checkbox);
      row.appendChild(label);

      if (it.direction === 'LONG') longCol.appendChild(row);
      else shortCol.appendChild(row);
    }

    body.appendChild(longCol);
    body.appendChild(shortCol);
    card.appendChild(body);
    sectionsEl.appendChild(card);
  }
}

function scheduleSaveItems() {
  if (!current) return;
  if (saveTimer) clearTimeout(saveTimer);

  saveTimer = setTimeout(() => {
    if (!pendingItems.size) return;
    pendingItems = new Map();
    saveLocalStore();
  }, 250);
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
  renderSections(current);
  pendingItems = new Map();
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

  pendingItems = new Map();
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = null;

  saveLocalStore();
  refreshList();
  deleteBtn.disabled = false;
});

// initial load
store = loadLocalStore();
refreshList();

