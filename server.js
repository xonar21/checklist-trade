const express = require('express');
const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const DATA_DIR = path.join(__dirname, 'data');
const DATA_PATH = path.join(DATA_DIR, 'checklists.json');

// Шаблон чек-листа (все стратегии из описания).
// Каждый элемент отдельно превращается в чекбокс (LONG/SHORT).
const TEMPLATE = [
  // 1) Торговля по ТРЕНДУ
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

  // 2) Зеркальный уровень
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

  // 3) Отскок от уровня (боковик)
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

  // 4) Пробой уровня (импульс)
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

  // 5) Отскок от плотности (стаканная механика)
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

function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_PATH)) {
    fs.writeFileSync(DATA_PATH, JSON.stringify({ checklists: [] }, null, 2), 'utf8');
  }
}

function loadStore() {
  ensureDataFile();
  const raw = fs.readFileSync(DATA_PATH, 'utf8');
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return { checklists: [] };
    if (!Array.isArray(parsed.checklists)) return { checklists: [] };
    return parsed;
  } catch {
    return { checklists: [] };
  }
}

function saveStore(store) {
  fs.writeFileSync(DATA_PATH, JSON.stringify(store, null, 2), 'utf8');
}

function buildChecklist(coin) {
  const now = new Date();
  return {
    id: randomUUID(),
    coin,
    createdAt: now.toISOString(),
    items: TEMPLATE.map((t) => ({
      id: randomUUID(),
      order: t.order,
      section: t.section,
      direction: t.direction,
      text: t.text,
      checked: false,
    })),
  };
}

function summarizeChecklist(c) {
  return { id: c.id, coin: c.coin, createdAt: c.createdAt };
}

app.get('/api/checklists', (_req, res) => {
  const store = loadStore();
  const checklists = store.checklists
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  res.json({ checklists: checklists.map(summarizeChecklist) });
});

app.post('/api/checklists', (req, res) => {
  const coin = typeof req.body?.coin === 'string' ? req.body.coin.trim() : '';
  if (!coin) return res.status(400).json({ error: 'coin is required' });

  const store = loadStore();
  const checklist = buildChecklist(coin);
  store.checklists.push(checklist);
  saveStore(store);

  res.status(201).json({ checklist });
});

app.get('/api/checklists/:id', (req, res) => {
  const id = req.params.id;
  const store = loadStore();
  const checklist = store.checklists.find((c) => c.id === id);
  if (!checklist) return res.status(404).json({ error: 'not found' });
  res.json({ checklist });
});

app.patch('/api/checklists/:id', (req, res) => {
  const id = req.params.id;
  const store = loadStore();
  const checklist = store.checklists.find((c) => c.id === id);
  if (!checklist) return res.status(404).json({ error: 'not found' });

  if (typeof req.body?.coin === 'string') {
    const coin = req.body.coin.trim();
    if (!coin) return res.status(400).json({ error: 'coin must not be empty' });
    checklist.coin = coin;
  }

  if (Array.isArray(req.body?.items)) {
    const byId = new Map(checklist.items.map((it) => [it.id, it]));
    for (const update of req.body.items) {
      const itemId = update?.id;
      if (!byId.has(itemId)) continue;
      const checked = update?.checked;
      if (typeof checked !== 'boolean') continue;
      byId.get(itemId).checked = checked;
    }
  }

  saveStore(store);
  res.json({ checklist });
});

app.delete('/api/checklists/:id', (req, res) => {
  const id = req.params.id;
  const store = loadStore();
  const before = store.checklists.length;
  store.checklists = store.checklists.filter((c) => c.id !== id);
  if (store.checklists.length === before) return res.status(404).json({ error: 'not found' });
  saveStore(store);
  res.json({ ok: true });
});

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Checklist app running at http://localhost:${PORT}`);
});

