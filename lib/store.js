// Livello dati. Tutto vive in memoria (veloce) e ogni modifica viene scritta su:
//  - Supabase (se SUPABASE_URL e SUPABASE_SERVICE_KEY sono impostate)
//  - altrimenti su data/db.json (modalità locale di prova)
const fs = require('fs');
const path = require('path');

const TABLES = ['staff', 'services', 'clients', 'appointments', 'subscriptions', 'gallery', 'settings', 'admins'];

/* ---------- adattatore file locale ---------- */
function localAdapter(dir) {
  const file = path.join(dir, 'db.json');
  let timer = null, snapshot = null;
  const flush = () => {
    const tmp = file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(snapshot));
    fs.renameSync(tmp, file);
  };
  return {
    name: 'locale (data/db.json)',
    async loadAll() {
      try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return {}; }
    },
    bind(mem) { snapshot = mem; },
    async insert() { this.touch(); },
    async update() { this.touch(); },
    async remove() { this.touch(); },
    touch() { clearTimeout(timer); timer = setTimeout(flush, 100); },
    flushNow() { clearTimeout(timer); if (snapshot) flush(); },
  };
}

/* ---------- adattatore Supabase (REST, nessuna dipendenza) ---------- */
function supabaseAdapter(url, key) {
  const base = url.replace(/\/$/, '') + '/rest/v1/';
  const headers = { apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' };
  const call = async (method, p, body, extra = {}) => {
    const r = await fetch(base + p, { method, headers: { ...headers, ...extra }, body: body ? JSON.stringify(body) : undefined });
    if (!r.ok) throw new Error(`Supabase ${method} ${p.split('?')[0]} → ${r.status} ${(await r.text()).slice(0, 300)}`);
    return r;
  };
  return {
    name: 'Supabase',
    async loadAll() {
      const out = {};
      await Promise.all(TABLES.map(async t => {
        out[t] = [];
        for (let from = 0; ; from += 1000) {
          const r = await call('GET', `${t}?select=*`, null, { Range: `${from}-${from + 999}`, 'Range-Unit': 'items' });
          const rows = await r.json();
          out[t].push(...rows);
          if (rows.length < 1000) break;
        }
      }));
      return out;
    },
    bind() {},
    insert: (t, row) => call('POST', t, row, { Prefer: 'return=minimal' }),
    update: (t, id, patch) => call('PATCH', `${t}?id=eq.${encodeURIComponent(id)}`, patch, { Prefer: 'return=minimal' }),
    remove: (t, id) => call('DELETE', `${t}?id=eq.${encodeURIComponent(id)}`),
    flushNow() {},
  };
}

async function createStore(env, dir) {
  const useSb = env.SUPABASE_URL && env.SUPABASE_SERVICE_KEY;
  const adapter = useSb ? supabaseAdapter(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY) : localAdapter(dir);
  const loaded = await adapter.loadAll();
  const mem = {};
  for (const t of TABLES) mem[t] = Array.isArray(loaded[t]) ? loaded[t] : [];
  adapter.bind(mem);

  // coda: le scritture avvengono una alla volta, nell'ordine in cui arrivano
  let chain = Promise.resolve();
  const lock = fn => { const r = chain.then(fn); chain = r.catch(() => {}); return r; };

  return {
    adapter: adapter.name,
    isSupabase: !!useSb,
    rows: t => mem[t],
    get: (t, id) => mem[t].find(r => r.id === id),
    lock,
    async insert(t, row) { await adapter.insert(t, row); mem[t].push(row); return row; },
    async update(t, id, patch) {
      const row = mem[t].find(r => r.id === id);
      if (!row) return null;
      await adapter.update(t, id, patch);
      Object.assign(row, patch);
      return row;
    },
    async remove(t, id) {
      const i = mem[t].findIndex(r => r.id === id);
      if (i < 0) return false;
      await adapter.remove(t, id);
      mem[t].splice(i, 1);
      return true;
    },
    flush: () => adapter.flushNow(),
  };
}

module.exports = { createStore, TABLES };
