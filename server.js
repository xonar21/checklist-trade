const express = require('express');
const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');
const { CHECKLIST_TEMPLATE_BLOCKS } = require('./public/checklist-template.js');

const app = express();
app.use(express.json({ limit: '1mb' }));
// Превью тегов: public/images/*.png → URL /images/*.png
app.use(express.static(path.join(__dirname, 'public')));

const DATA_DIR = path.join(__dirname, 'data');
const DATA_PATH = path.join(DATA_DIR, 'checklists.json');

const DROP_GROUPS = new Set(['map-tf', 'map-btc', 'liq-dist']);

function buildBlocksFromTemplate() {
  return CHECKLIST_TEMPLATE_BLOCKS.map((b) => ({
    id: randomUUID(),
    order: b.order,
    title: b.title,
    goal: b.goal,
    groups: b.groups.map((g) => ({
      id: g.id,
      label: g.label,
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

function buildChecklist(coin) {
  const now = new Date();
  return {
    id: randomUUID(),
    coin,
    createdAt: now.toISOString(),
    notes: '',
    blocks: buildBlocksFromTemplate(),
  };
}

function migrateLegacyChecklist(c) {
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

function normalizeChecklistShape(c) {
  let notes = typeof c.notes === 'string' ? c.notes : '';
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
  return { ...rest, notes, blocks };
}

function checklistNeedsResave(c) {
  if (typeof c.notes !== 'string') return true;
  if (c.blocks?.some((b) => b.logic != null || b.notes != null)) return true;
  if (c.blocks?.some((b) => b.groups?.some((g) => DROP_GROUPS.has(g.id)))) return true;
  if (c.blocks?.some((b) => b.groups?.some((g) => (g.selected?.length || 0) > 1))) return true;
  return false;
}

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
    const needsSave = parsed.checklists.some(
      (c) =>
        Array.isArray(c.items) ||
        !c.blocks ||
        !c.blocks.length ||
        checklistNeedsResave(c)
    );
    parsed.checklists = parsed.checklists.map((c) => normalizeChecklistShape(migrateLegacyChecklist(c)));
    if (needsSave) saveStore(parsed);
    return parsed;
  } catch {
    return { checklists: [] };
  }
}

function saveStore(store) {
  fs.writeFileSync(DATA_PATH, JSON.stringify(store, null, 2), 'utf8');
}

function applyBlockPatch(checklist, incomingBlocks) {
  if (!Array.isArray(incomingBlocks)) return;
  const byId = new Map(checklist.blocks.map((b) => [b.id, b]));
  for (const ib of incomingBlocks) {
    const b = byId.get(ib?.id);
    if (!b) continue;
    if (!Array.isArray(ib.groups)) continue;
    const gmap = new Map(b.groups.map((g) => [g.id, g]));
    for (const ig of ib.groups) {
      const g = gmap.get(ig?.id);
      if (!g || !Array.isArray(ig.selected)) continue;
      const valid = new Set(g.tags.map((t) => t.id));
      const filtered = ig.selected.filter((id) => typeof id === 'string' && valid.has(id));
      g.selected = filtered.length ? [filtered[0]] : [];
    }
  }
}

function summarizeChecklist(c) {
  return { id: c.id, coin: c.coin, createdAt: c.createdAt };
}

app.get('/api/checklists', (_req, res) => {
  const store = loadStore();
  const checklists = store.checklists.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
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

  if (typeof req.body?.notes === 'string') {
    checklist.notes = req.body.notes;
  }

  if (Array.isArray(req.body?.blocks)) {
    applyBlockPatch(checklist, req.body.blocks);
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
