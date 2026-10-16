// Server senza dipendenze:  node server.js   →  http://localhost:3000
process.env.TZ = process.env.TZ || 'Europe/Rome';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { createStore } = require('./lib/store');
const { sendReminders, sendCampaign, campaignHtml, startScheduler, isoDate } = require('./lib/mail');
const { createTestData, removeTestData } = require('./lib/seed');

/* ---------- configurazione (.env) ---------- */
try {
  for (const l of fs.readFileSync(path.join(__dirname, '.env'), 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(l);
    if (m && !l.trim().startsWith('#') && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
} catch {}
const env = process.env;
const PORT = env.PORT || 3000;
const HOST = env.HOST || '127.0.0.1';
const PUBLIC = path.join(__dirname, 'public');
const CATS = ['uomo', 'donna', 'estetica'];

/* ---------- dati iniziali ---------- */
const uid = () => Date.now().toString(36) + crypto.randomBytes(4).toString('hex');
const SERVICES = {
  uomo: [['Taglio', 15, 30], ['Barba', 8, 30], ['Taglio + barba', 20, 45], ['Rasatura con panno caldo', 12, 30]],
  donna: [['Taglio', 25, 45], ['Piega', 18, 30], ['Colore', 45, 90], ['Colpi di sole', 70, 120], ['Trattamento ristrutturante', 30, 40]],
  estetica: [['Manicure', 20, 45], ['Smalto semipermanente', 25, 60], ['Ricostruzione unghie', 45, 90], ['Pedicure', 25, 60], ['Pulizia viso', 35, 60], ['Ceretta gambe', 20, 30], ['Ceretta sopracciglia', 8, 15]],
};
const SEED_STAFF = [
  { id: 'enrico', name: 'Enrico Grasso', role: 'Titolare · Hair stylist', bio: 'Taglio, colore e piega per donna e uomo, con una passione speciale per il taglio femminile.', active: true, is_owner: true, boss_id: '', sort: 1, cats: ['donna', 'uomo'] },
  { id: 'grazia', name: 'Grazia Di Mauro', role: 'Titolare · Estetista e Nail artist', bio: 'Nail art, ricostruzione unghie e trattamenti estetici per il tuo benessere.', active: true, is_owner: true, boss_id: '', sort: 2, cats: ['estetica'] },
  { id: 'soraya', name: 'Soraya', role: 'Hair stylist', bio: 'Lavora con Enrico: taglio, colore e piega.', active: true, is_owner: false, boss_id: 'enrico', sort: 3, cats: ['donna'] },
  { id: 'chiara', name: 'Chiara', role: 'Hair stylist', bio: 'Lavora con Enrico: taglio, colore e piega.', active: true, is_owner: false, boss_id: 'enrico', sort: 4, cats: ['donna'] },
  { id: 'alessia', name: 'Alessia', role: 'Estetista', bio: 'Lavora con Grazia: manicure, pedicure e trattamenti estetici.', active: true, is_owner: false, boss_id: 'grazia', sort: 5, cats: ['estetica'] },
];
const day = (o, c) => ({ closed: !o, open: o || '09:00', close: c || '19:30' });
const SEED_SHOP = {
  name: 'Voglia di', tagline: 'Parrucchieri · Estetica', currency: '€', city: 'Catania',
  address: 'Via Messina 441, 95126 Catania (CT)', phone: '+39 095 094 0857', whatsapp: '', email: '',
  instagram: 'https://www.instagram.com/vogliadiparrucchieri_enrico_/', facebook: '', maps: 'https://maps.app.goo.gl/k7CNoWfwgGCtBmof7',
  hours: [day(), day(), day('09:00', '19:30'), day('09:00', '19:30'), day('09:00', '19:30'), day('09:00', '20:00'), day('09:00', '20:00')],
  closures: [], slot_step: 30, subPrice: 32, subUses: 4, reminder_hour: 10,
  wa_template: 'Ciao {nome}, ti ricordo il tuo appuntamento di domani {data} alle {ora} ({servizio}) da {negozio}. A domani!',
  bd_template: 'Ciao {nome}, tanti auguri di buon compleanno! 🎂 Il team di {negozio}',
};

async function seed(store) {
  if (!store.get('settings', 'shop')) await store.insert('settings', { id: 'shop', value: SEED_SHOP });
  if (!store.rows('staff').length) {
    for (const s of SEED_STAFF) {
      const { cats, ...row } = s;
      await store.insert('staff', { photo: '', ...row });
      for (const c of cats) for (const [n, p, m] of SERVICES[c])
        await store.insert('services', { id: uid(), staff_id: s.id, category: c, name: n, price: p, minutes: m, active: true });
    }
  }
  // collega le dipendenti già esistenti al loro titolare
  for (const t of SEED_STAFF) {
    const row = store.get('staff', t.id);
    if (row && t.boss_id && !row.is_owner && !row.boss_id) await store.update('staff', t.id, { boss_id: t.boss_id });
  }
  const cur = store.get('settings', 'shop');
  if (cur && cur.value.currency === '$') await store.update('settings', 'shop', { value: { ...cur.value, currency: '€' } });
  // sostituisce i dati d'esempio ancora presenti con quelli reali del salone (non tocca nulla di ciò che è già stato modificato)
  if (cur) {
    const v = { ...cur.value }, ph = { city: 'La tua città', address: 'Via Esempio 1, 00000 Città', phone: '+39 000 000 0000', whatsapp: '390000000000', email: 'info@esempio.it' };
    let changed = false;
    for (const k of Object.keys(ph)) if (v[k] === ph[k]) { v[k] = SEED_SHOP[k]; changed = true; }
    for (const k of ['instagram', 'maps']) if (v[k] === undefined) { v[k] = SEED_SHOP[k]; changed = true; }
    if (v.facebook === undefined) { v.facebook = ''; changed = true; }
    if (changed) await store.update('settings', 'shop', { value: v });
  }
  // account: due titolari + pannello owner
  for (const [username, staff_id] of [['Errico10', 'enrico'], ['Grazia86', 'grazia']]) {
    const a = store.get('admins', username);
    if (!a) await store.insert('admins', { id: username, username, pass: null, staff_id, role: 'titolare' });
    else if (!a.role) await store.update('admins', username, { role: 'titolare' });
  }
  if (!store.get('admins', 'owner'))
    await store.insert('admins', { id: 'owner', username: 'owner', pass: hashPw(env.PASS_owner || 'owner1020'), staff_id: '', role: 'owner' });
}

/* ---------- utilità ---------- */
const json = (res, code, obj, headers = {}) => {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
  res.end(JSON.stringify(obj));
};
const fail = (code, msg) => Object.assign(new Error(msg), { code });
function readBody(req, max = 8e6) {
  return new Promise((ok, ko) => {
    let s = '';
    req.on('data', c => { s += c; if (s.length > max) { ko(fail(413, 'Richiesta troppo grande')); req.destroy(); } });
    req.on('end', () => { try { ok(s ? JSON.parse(s) : {}); } catch { ko(fail(400, 'JSON non valido')); } });
  });
}
const hits = new Map();
function limited(ip, key, max, ms) {
  const k = ip + key, now = Date.now();
  const l = (hits.get(k) || []).filter(t => now - t < ms);
  if (l.length >= max) { hits.set(k, l); return true; }
  l.push(now); hits.set(k, l); return false;
}
const hashPw = (pw, salt = crypto.randomBytes(16).toString('hex')) => salt + ':' + crypto.scryptSync(pw, salt, 32).toString('hex');
function checkPw(pw, stored) {
  if (!stored) return false;
  const [salt, h] = stored.split(':');
  const a = Buffer.from(h, 'hex'), b = crypto.scryptSync(pw, salt, 32);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
const toMin = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const fromMin = n => String(Math.floor(n / 60)).padStart(2, '0') + ':' + String(n % 60).padStart(2, '0');
const validDate = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(new Date(s + 'T12:00:00'));
const validTime = s => typeof s === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
const clean = (s, n) => String(s ?? '').replace(/[<>]/g, '').trim().slice(0, n);

/* ---------- sessioni firmate (cookie) ---------- */
let SECRET;
function initSecret(store) {
  SECRET = env.SESSION_SECRET;
  if (!SECRET) {
    const m = store.get('settings', 'secret');
    if (m) SECRET = m.value.v;
    else { SECRET = crypto.randomBytes(32).toString('hex'); store.insert('settings', { id: 'secret', value: { v: SECRET } }); }
  }
}
const sign = p => crypto.createHmac('sha256', SECRET).update(p).digest('hex');
function makeToken(user) {
  const p = Buffer.from(JSON.stringify({ u: user, e: Date.now() + 14 * 864e5 })).toString('base64url');
  return p + '.' + sign(p);
}
function readToken(req) {
  const m = /(?:^|; )sid=([\w-]+\.[a-f0-9]+)/.exec(req.headers.cookie || '');
  if (!m) return null;
  const [p, s] = m[1].split('.');
  const good = sign(p);
  if (s.length !== good.length || !crypto.timingSafeEqual(Buffer.from(s), Buffer.from(good))) return null;
  try { const d = JSON.parse(Buffer.from(p, 'base64url').toString()); return d.e > Date.now() ? d.u : null; } catch { return null; }
}
const cookie = (v, age) => `sid=${v}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${age}${env.NODE_ENV === 'production' ? '; Secure' : ''}`;

/* ---------- campi consentiti per tabella ---------- */
const FIELDS = {
  staff: { name: 's:60', role: 's:80', bio: 's:400', photo: 's:300', active: 'b', sort: 'n', boss_id: 's:40' },
  services: { staff_id: 's:40', category: 'c', name: 's:80', price: 'n', minutes: 'n', active: 'b' },
  clients: { name: 's:80', phone: 's:30', email: 's:120', birthday: 'd?', notes: 's:2000' },
  appointments: {
    client_id: 's:40', client_name: 's:80', staff_id: 's:40', service_id: 's:40', service_name: 's:80', category: 'c', price: 'n', minutes: 'n',
    date: 'd', time: 't', status: 'status', notes: 's:1000', seen: 'b', from_sub: 'b', wa_sent: 'b', reminder_email_sent: 'b',
  },
  subscriptions: { client_id: 's:40', staff_id: 's:40', start_date: 'd', price: 'n', total: 'n', uses: 'a' },
  gallery: { url: 's:300', caption: 's:120', sort: 'n' },
};
const REQUIRED = { staff: ['name'], services: ['staff_id', 'category', 'name'], clients: ['name'], appointments: ['staff_id', 'date', 'time'], subscriptions: ['client_id', 'start_date'], gallery: ['url'] };
function coerce(type, v) {
  const [t, len] = type.split(':');
  if (t === 's') return clean(v, +len);
  if (t === 'n') { v = Number(v); if (!isFinite(v) || v < 0 || v > 1e6) throw fail(400, 'Numero non valido'); return v; }
  if (t === 'b') return !!v;
  if (t === 'c') { if (!CATS.includes(v)) throw fail(400, 'Categoria non valida'); return v; }
  if (t === 'd') { if (!validDate(v)) throw fail(400, 'Data non valida'); return v; }
  if (t === 'd?') { if (v && !validDate(v)) throw fail(400, 'Data non valida'); return v || ''; }
  if (t === 't') { if (!validTime(v)) throw fail(400, 'Ora non valida'); return v; }
  if (t === 'status') { if (!['booked', 'done', 'cancelled', 'noshow'].includes(v)) throw fail(400, 'Stato non valido'); return v; }
  if (t === 'a') { if (!Array.isArray(v) || v.some(x => !validDate(x))) throw fail(400, 'Elenco date non valido'); return v; }
}
function pick(table, data) {
  const out = {};
  for (const [k, type] of Object.entries(FIELDS[table])) if (data[k] !== undefined) out[k] = coerce(type, data[k]);
  return out;
}

/* ---------- disponibilità ---------- */
// tutti gli orari del giorno per un operatore, con stato (ok = prenotabile)
function allSlots(store, staffId, date, minutes) {
  const shop = store.get('settings', 'shop').value;
  const closure = (shop.closures || []).find(c => c.date === date);
  if (closure) return [];
  const h = shop.hours[new Date(date + 'T12:00:00').getDay()];
  if (!h || h.closed) return [];
  const busy = store.rows('appointments')
    .filter(a => a.staff_id === staffId && a.date === date && (a.status === 'booked' || a.status === 'done'))
    .map(a => [toMin(a.time), toMin(a.time) + (a.minutes || 30)]);
  const now = new Date(), isToday = date === isoDate(now), nowMin = now.getHours() * 60 + now.getMinutes();
  const step = Math.max(10, +shop.slot_step || 30), out = [];
  for (let t = toMin(h.open); t + minutes <= toMin(h.close); t += step) {
    let ok = true, reason = '';
    if (isToday && t < nowMin + 15) { ok = false; reason = 'passato'; }
    else if (busy.some(([s, e]) => t < e && t + minutes > s)) { ok = false; reason = 'occupato'; }
    out.push({ time: fromMin(t), ok, reason });
  }
  return out;
}
const freeSlots = (store, staffId, date, minutes) => allSlots(store, staffId, date, minutes).filter(x => x.ok).map(x => x.time);

// servizi prenotabili con quel nome/categoria (un operatore preciso oppure "any" = chiunque lo faccia)
function eligible(store, cat, name, staffId) {
  const n = String(name || '').trim().toLowerCase();
  return store.rows('services')
    .filter(v => v.active && v.category === cat && v.name.trim().toLowerCase() === n && (staffId === 'any' || v.staff_id === staffId))
    .map(v => ({ svc: v, st: store.get('staff', v.staff_id) }))
    .filter(x => x.st && x.st.active)
    .sort((a, b) => a.st.sort - b.st.sort);
}
const bookingCode = () => Array.from(crypto.randomBytes(6), b => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[b % 32]).join('');

/* ---------- ruoli e permessi ---------- */
// owner = vede tutto · titolare = vede sé stesso e i propri dipendenti · dipendente = solo i propri appuntamenti
const roleOf = a => a.role || 'titolare';
function teamIds(store, a) {
  const r = roleOf(a);
  if (r === 'owner') return store.rows('staff').map(s => s.id);
  if (r === 'dipendente') return [a.staff_id];
  return [a.staff_id, ...store.rows('staff').filter(s => s.boss_id === a.staff_id).map(s => s.id)];
}
const findAdmin = (store, name) => { const n = String(name || '').toLowerCase(); return n ? store.rows('admins').find(a => a.username.toLowerCase() === n) : undefined; };
const forbid = () => fail(403, 'Non hai il permesso per questa operazione');

// cosa vede ciascun ruolo
function bootstrapFor(store, admin, shop, env) {
  const r = roleOf(admin), ids = teamIds(store, admin);
  const staff = [...store.rows('staff')].filter(s => ids.includes(s.id)).sort((a, b) => a.sort - b.sort)
    .map(s => ({ ...s, account: (store.rows('admins').find(a => a.staff_id === s.id && roleOf(a) === 'dipendente') || {}).username || '' }));
  const base = {
    me: { username: admin.username, staff_id: admin.staff_id, role: r },
    staff, services: store.rows('services').filter(v => ids.includes(v.staff_id)),
    appointments: store.rows('appointments').filter(a => ids.includes(a.staff_id)),
  };
  if (r === 'dipendente') {
    const { subPrice, subUses, ...lite } = shop;
    return {
      ...base, shop: lite, subscriptions: [], gallery: [],
      services: base.services.map(({ price, ...v }) => v),
      appointments: base.appointments.map(({ price, ...a }) => a),
      clients: store.rows('clients').map(({ id, name, phone, email, birthday }) => ({ id, name, phone, email, birthday, notes: '' })),
      status: {},
    };
  }
  return {
    ...base, shop, clients: store.rows('clients'),
    subscriptions: store.rows('subscriptions').filter(x => ids.includes(x.staff_id) || (r === 'owner' && !x.staff_id)),
    gallery: [...store.rows('gallery')].sort((a, b) => a.sort - b.sort),
    status: { supabase: store.isSupabase, storage: store.adapter, resend: !!env.RESEND_API_KEY, from: env.RESEND_FROM || '' },
  };
}
// controlla che l'utente possa scrivere su quella riga
function authorize(store, admin, table, method, id, row) {
  const r = roleOf(admin);
  if (r === 'owner') return;
  const ids = teamIds(store, admin), existing = id ? store.get(table, id) : null;
  const inTeam = sid => { if (!ids.includes(sid)) throw forbid(); };
  if (r === 'dipendente' && !(table === 'appointments' || (table === 'clients' && method === 'POST'))) throw forbid();
  if (['appointments', 'subscriptions', 'services'].includes(table)) {
    if (existing) inTeam(existing.staff_id);
    if (row.staff_id !== undefined) inTeam(row.staff_id);
  }
  if (table === 'staff') {
    if (existing) inTeam(existing.id);
    if (method === 'DELETE' && existing && existing.id === admin.staff_id) throw forbid();
  }
}

/* ---------- caricamento immagini ---------- */
async function upload(store, dataUrl) {
  const m = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl || '');
  if (!m) throw fail(400, 'Immagine non valida (JPG, PNG o WEBP)');
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length > 5e6) throw fail(413, 'Immagine troppo grande (max 5 MB)');
  const ext = m[1] === 'jpeg' ? 'jpg' : m[1];
  const name = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}.${ext}`;
  if (store.isSupabase) {
    const base = env.SUPABASE_URL.replace(/\/$/, '');
    const r = await fetch(`${base}/storage/v1/object/media/${name}`, {
      method: 'POST', body: buf,
      headers: { apikey: env.SUPABASE_SERVICE_KEY, Authorization: 'Bearer ' + env.SUPABASE_SERVICE_KEY, 'Content-Type': 'image/' + m[1] },
    });
    if (!r.ok) throw fail(502, 'Caricamento su Supabase Storage fallito: ' + (await r.text()).slice(0, 150));
    return `${base}/storage/v1/object/public/media/${name}`;
  }
  fs.mkdirSync(path.join(PUBLIC, 'uploads'), { recursive: true });
  fs.writeFileSync(path.join(PUBLIC, 'uploads', name), buf);
  return '/uploads/' + name;
}

/* ---------- API ---------- */
async function api(store, req, res, url) {
  const ip = (ON_VERCEL && String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()) || req.socket.remoteAddress;
  const route = req.method + ' ' + url.pathname;
  const shop = store.get('settings', 'shop').value;

  /* --- pubbliche --- */
  if (route === 'GET /api/public') {
    const { subPrice, subUses, wa_template, bd_template, reminder_hour, slot_step, ...pub } = shop;
    const staff = store.rows('staff').filter(s => s.active).sort((a, b) => a.sort - b.sort);
    // cache sulla CDN di Vercel: la home non interroga Supabase a ogni visita (le modifiche appaiono entro ~30 s)
    return json(res, 200, {
      shop: pub,
      staff: staff.map(({ id, name, role, bio, photo, is_owner }) => ({ id, name, role, bio, photo, is_owner })),
      services: store.rows('services').filter(s => s.active && staff.some(t => t.id === s.staff_id))
        .map(({ id, staff_id, category, name, price, minutes }) => ({ id, staff_id, category, name, price, minutes })),
      gallery: [...store.rows('gallery')].sort((a, b) => a.sort - b.sort || (a.created_at || '').localeCompare(b.created_at || '')).map(({ id, url, caption }) => ({ id, url, caption })),
    }, { 'Cache-Control': 'public, max-age=0, s-maxage=30, stale-while-revalidate=300' });
  }
  if (route === 'GET /api/slots') {
    const sid = url.searchParams.get('staff') || 'any', date = url.searchParams.get('date');
    const cat = url.searchParams.get('cat'), name = url.searchParams.get('name');
    if (!CATS.includes(cat) || !validDate(date)) throw fail(400, 'Dati non validi');
    const el = eligible(store, cat, name, sid);
    if (!el.length) throw fail(400, 'Servizio non disponibile');
    const map = new Map();
    for (const { svc, st } of el)
      for (const x of allSlots(store, st.id, date, svc.minutes || 30)) {
        const cur = map.get(x.time);
        if (!cur || (!cur.ok && x.ok)) map.set(x.time, x);
      }
    return json(res, 200, { slots: [...map.values()].sort((a, b) => a.time.localeCompare(b.time)) });
  }
  if (route === 'POST /api/book') {
    if (limited(ip, 'book', 8, 3600e3)) throw fail(429, 'Troppe richieste, riprova più tardi');
    const b = await readBody(req);
    const first = clean(b.name, 40), last = clean(b.surname, 40), phone = clean(b.phone, 30), email = clean(b.email, 120).toLowerCase();
    const name = (first + ' ' + last).trim();
    if (first.length < 2 || last.length < 2 || phone.replace(/\D/g, '').length < 6) throw fail(400, 'Inserisci nome, cognome e telefono validi');
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw fail(400, 'Email non valida');
    if (!validDate(b.date) || !validTime(b.time) || !CATS.includes(b.category)) throw fail(400, 'Dati non validi');
    const horizon = new Date(); horizon.setDate(horizon.getDate() + 120);
    if (b.date < isoDate(new Date()) || b.date > isoDate(horizon)) throw fail(400, 'Data non prenotabile');
    const note = clean(b.notes, 300);
    return store.lock(async () => {
      // "any" = primo operatore libero in quell'orario
      const pick = eligible(store, b.category, b.service_name, String(b.staff_id || 'any'))
        .find(({ svc, st }) => freeSlots(store, st.id, b.date, svc.minutes || 30).includes(b.time));
      if (!pick) throw fail(409, 'Orario non più disponibile, scegline un altro');
      const { svc, st } = pick;
      const digits = phone.replace(/\D/g, '');
      let c = store.rows('clients').find(x => (x.phone || '').replace(/\D/g, '') === digits);
      if (!c) c = await store.insert('clients', { id: uid(), name, phone, email, birthday: '', notes: 'Cliente da prenotazione online', created_at: new Date().toISOString() });
      else if (email && !c.email) await store.update('clients', c.id, { email });
      const code = bookingCode();
      await store.insert('appointments', {
        id: uid(), client_id: c.id, client_name: c.name, staff_id: st.id, service_id: svc.id, service_name: svc.name,
        category: svc.category, price: svc.price, minutes: svc.minutes || 30, date: b.date, time: b.time,
        status: 'booked', source: 'online', notes: note, seen: false, from_sub: false, wa_sent: false, reminder_email_sent: false,
        booking_code: code, created_at: new Date().toISOString(),
      });
      return json(res, 200, { ok: true, code, staff: st.name, price: svc.price, minutes: svc.minutes || 30 });
    });
  }

  /* --- login --- */
  if (route === 'GET /api/login-state') {
    const a = findAdmin(store, url.searchParams.get('username'));
    return json(res, 200, { needsSetup: !!a && !a.pass && !env['PASS_' + a.username] });
  }
  if (route === 'POST /api/login') {
    if (limited(ip, 'login', 10, 600e3)) throw fail(429, 'Troppi tentativi, attendi qualche minuto');
    const b = await readBody(req);
    const a = findAdmin(store, b.username);
    if (!a || typeof b.password !== 'string') throw fail(401, 'Account o password errati');
    if (!a.pass) {
      const preset = env['PASS_' + a.username];
      if (preset ? b.password !== preset : b.password.length < 8) throw fail(400, preset ? 'Password errata' : 'Scegli una password di almeno 8 caratteri');
      await store.update('admins', a.id, { pass: hashPw(b.password) });
    } else if (!checkPw(b.password, a.pass)) throw fail(401, 'Account o password errati');
    return json(res, 200, { ok: true, role: roleOf(a) }, { 'Set-Cookie': cookie(makeToken(a.username), 14 * 86400) });
  }
  if (route === 'POST /api/logout') return json(res, 200, { ok: true }, { 'Set-Cookie': cookie('', 0) });

  /* --- area riservata --- */
  const username = readToken(req);
  const admin = username && store.get('admins', username);
  const role = admin ? roleOf(admin) : null;
  if (url.pathname.startsWith('/api/admin') || route === 'GET /api/me') {
    if (!admin) throw fail(401, 'Non autorizzato');
    if (req.method !== 'GET' && (req.headers.origin && new URL(req.headers.origin).host !== req.headers.host)) throw fail(403, 'Origine non consentita');
  }
  if (route === 'GET /api/me') return json(res, 200, { username: admin.username, staff_id: admin.staff_id, role });
  if (role === 'dipendente') { // i dipendenti: solo appuntamenti (e la propria password)
    const okRoute = route === 'GET /api/admin/bootstrap' || route === 'POST /api/admin/password' || route === 'POST /api/admin/clients'
      || /^(POST|PATCH) \/api\/admin\/appointments(\/[\w-]+)?$/.test(route);
    if (!okRoute) throw forbid();
  }

  if (route === 'GET /api/admin/bootstrap') return json(res, 200, bootstrapFor(store, admin, shop, env));
  if (route === 'PUT /api/admin/shop') {
    const b = await readBody(req), v = { ...shop };
    for (const k of ['name', 'tagline', 'city', 'address', 'phone', 'email', 'currency']) if (typeof b[k] === 'string') v[k] = clean(b[k], 120);
    if (typeof b.whatsapp === 'string') v.whatsapp = b.whatsapp.replace(/\D/g, '').slice(0, 20);
    for (const k of ['instagram', 'facebook', 'maps']) if (typeof b[k] === 'string') v[k] = /^https:\/\/[^\s<>"']+$/.test(b[k].trim()) ? b[k].trim().slice(0, 300) : '';
    for (const k of ['wa_template', 'bd_template']) if (typeof b[k] === 'string') v[k] = clean(b[k], 500);
    for (const k of ['subPrice', 'subUses', 'reminder_hour', 'slot_step']) if (b[k] !== undefined) v[k] = coerce('n', b[k]);
    if (Array.isArray(b.hours) && b.hours.length === 7)
      v.hours = b.hours.map(h => ({ closed: !!h.closed, open: validTime(h.open) ? h.open : '09:00', close: validTime(h.close) ? h.close : '19:30' }));
    if (Array.isArray(b.closures)) v.closures = b.closures.filter(c => validDate(c.date)).slice(0, 200).map(c => ({ date: c.date, label: clean(c.label, 60) }));
    await store.update('settings', 'shop', { value: v });
    return json(res, 200, { ok: true });
  }
  if (route === 'POST /api/admin/upload') {
    const b = await readBody(req, 9e6);
    return json(res, 200, { url: await upload(store, b.dataUrl) });
  }
  if (route === 'POST /api/admin/password') {
    const b = await readBody(req);
    if (!checkPw(String(b.old || ''), admin.pass) || String(b.new || '').length < 8) throw fail(400, 'Password attuale errata o nuova troppo corta (min. 8)');
    await store.update('admins', admin.id, { pass: hashPw(b.new) });
    return json(res, 200, { ok: true });
  }
  if (route === 'POST /api/admin/reminders/run') {
    const b = await readBody(req);
    return json(res, 200, await sendReminders(store, env, validDate(b.date) ? b.date : undefined));
  }
  // email libere ai clienti (schermata "Email")
  if (route === 'POST /api/admin/email/preview') {
    const b = await readBody(req);
    return json(res, 200, { html: campaignHtml(shop, String(b.message || '').slice(0, 5000) || ' ', { name: 'Maria Rossi' }) });
  }
  if (route === 'POST /api/admin/email/send') {
    if (limited(ip, 'mail', 30, 600e3)) throw fail(429, 'Troppi invii, attendi qualche minuto');
    const b = await readBody(req);
    const clientIds = Array.isArray(b.clientIds) ? b.clientIds.map(String) : [];
    return json(res, 200, await sendCampaign(store, env, { subject: b.subject, message: b.message, clientIds, testTo: b.testTo ? String(b.testTo).trim() : '' }));
  }
  // dati di prova (solo owner): 50 clienti con appuntamenti passati/futuri e abbonamenti
  if (route === 'POST /api/admin/test-data') {
    if (role !== 'owner') throw forbid();
    const b = await readBody(req);
    if (b.action === 'remove') return json(res, 200, { removed: await removeTestData(store) });
    return json(res, 200, { created: await createTestData(store) });
  }

  // accesso di un dipendente (creato dal titolare o dall'owner)
  const am = /^\/api\/admin\/staff\/([\w-]+)\/account$/.exec(url.pathname);
  if (am && (req.method === 'PUT' || req.method === 'DELETE')) {
    const st = store.get('staff', am[1]);
    if (!st) throw fail(404, 'Non trovato');
    if (!teamIds(store, admin).includes(st.id) || (role === 'titolare' && st.id === admin.staff_id)) throw forbid();
    if (st.is_owner) throw fail(400, 'Gli accessi dei titolari non si gestiscono da qui');
    const acc = store.rows('admins').find(a => a.staff_id === st.id && roleOf(a) === 'dipendente');
    if (req.method === 'DELETE') { if (acc) await store.remove('admins', acc.id); return json(res, 200, { ok: true }); }
    const b = await readBody(req), u = String(b.username || '').trim(), pw = String(b.password || '');
    if (!/^[A-Za-z0-9_.-]{3,30}$/.test(u)) throw fail(400, 'Account: 3-30 caratteri (lettere, numeri, . _ -)');
    if (store.rows('admins').some(a => a.id !== acc?.id && a.username.toLowerCase() === u.toLowerCase())) throw fail(400, 'Questo nome account è già usato');
    if ((!acc || !acc.pass || pw) && pw.length < 8) throw fail(400, 'Password di almeno 8 caratteri');
    const pass = pw ? hashPw(pw) : acc.pass;
    if (acc) await store.remove('admins', acc.id);
    await store.insert('admins', { id: u, username: u, pass, staff_id: st.id, role: 'dipendente' });
    return json(res, 200, { ok: true });
  }

  // CRUD generico
  const m = /^\/api\/admin\/(\w+)(?:\/([\w-]+))?$/.exec(url.pathname);
  if (m && FIELDS[m[1]]) {
    const table = m[1], id = m[2];
    if (req.method === 'POST' && !id) {
      const row = pick(table, await readBody(req));
      if (role === 'dipendente' && table === 'appointments') row.staff_id = admin.staff_id;
      if (table === 'staff') { if (role === 'titolare') row.boss_id = admin.staff_id; row.is_owner = false; }
      if (table === 'subscriptions' && role !== 'owner' && row.staff_id === undefined) row.staff_id = admin.staff_id;
      for (const k of REQUIRED[table]) if (row[k] === undefined || row[k] === '') throw fail(400, 'Campo mancante: ' + k);
      authorize(store, admin, table, 'POST', null, row);
      const defaults = {
        staff: { role: '', bio: '', photo: '', active: true, is_owner: false, boss_id: '', sort: store.rows('staff').length + 1 },
        services: { price: 0, minutes: 30, active: true },
        clients: { phone: '', email: '', birthday: '', notes: '' },
        appointments: { client_id: '', client_name: '', service_id: '', service_name: '', category: 'uomo', price: 0, minutes: 30, status: 'booked', source: 'admin', notes: '', seen: true, from_sub: false, wa_sent: false, reminder_email_sent: false, booking_code: '' },
        subscriptions: { staff_id: '', price: 0, total: 4, uses: [] },
        gallery: { caption: '', sort: store.rows('gallery').length + 1 },
      }[table];
      const full = { id: uid(), ...defaults, ...row, created_at: new Date().toISOString() };
      if (table === 'appointments' && role === 'dipendente') { delete row.price; full.price = store.get('services', full.service_id)?.price || 0; full.from_sub = false; }
      if (table === 'appointments' && full.client_id) full.client_name = store.get('clients', full.client_id)?.name || full.client_name;
      await store.insert(table, full);
      return json(res, 200, { row: role === 'dipendente' ? { ...full, price: undefined } : full });
    }
    if (req.method === 'PATCH' && id) {
      const patch = pick(table, await readBody(req));
      if (!store.get(table, id)) throw fail(404, 'Non trovato');
      if (table === 'staff' && role !== 'owner') delete patch.boss_id;
      if (role === 'dipendente') {
        delete patch.price; delete patch.from_sub;
        if (patch.staff_id !== undefined) patch.staff_id = admin.staff_id;
        if (patch.service_id) patch.price = store.get('services', patch.service_id)?.price || 0;
      }
      authorize(store, admin, table, 'PATCH', id, patch);
      const row = await store.update(table, id, patch);
      return json(res, 200, { row: role === 'dipendente' ? { ...row, price: undefined } : row });
    }
    if (req.method === 'DELETE' && id) {
      authorize(store, admin, table, 'DELETE', id, {});
      if (table === 'staff') {
        const s = store.get('staff', id);
        if (s?.is_owner) throw fail(400, 'I titolari non si possono eliminare');
        if (store.rows('appointments').some(a => a.staff_id === id)) throw fail(400, 'Ha appuntamenti: disattivalo invece di eliminarlo');
        for (const sv of store.rows('services').filter(x => x.staff_id === id)) await store.remove('services', sv.id);
        for (const ac of store.rows('admins').filter(x => x.staff_id === id && roleOf(x) === 'dipendente')) await store.remove('admins', ac.id);
      }
      if (!(await store.remove(table, id))) throw fail(404, 'Non trovato');
      return json(res, 200, { ok: true });
    }
  }
  throw fail(404, 'Non trovato');
}

/* ---------- file statici ---------- */
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };
function serve(req, res, url) {
  let p = decodeURIComponent(url.pathname);
  if (p === '/admin' || p === '/owner') p += '/';
  if (p.endsWith('/')) p += 'index.html';
  else if (!path.extname(p)) p += '.html';
  const f = path.join(PUBLIC, path.normalize(p));
  if (!f.startsWith(PUBLIC + path.sep)) { res.writeHead(403); return res.end(); }
  fs.readFile(f, (e, buf) => {
    if (e) {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      return fs.readFile(path.join(PUBLIC, '404.html'), (e2, page) => res.end(e2 ? '<meta charset=utf-8><h1>404</h1><p>Pagina non trovata.</p><a href="/">Torna alla home</a>' : page));
    }
    const ext = path.extname(f);
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff',
      'Cache-Control': p.startsWith('/uploads/') ? 'public, max-age=86400' : 'no-cache',
      ...(p.startsWith('/admin') || p.startsWith('/owner') ? { 'X-Robots-Tag': 'noindex' } : {}),
    });
    res.end(buf);
  });
}

/* ---------- avvio ---------- */
const ON_VERCEL = !!env.VERCEL;
async function openStore() {
  const store = await createStore(env, path.join(__dirname, 'data'));
  await seed(store);
  initSecret(store);
  return store;
}
async function handle(store, req, res) {
  const url = new URL(req.url, 'http://x');
  try {
    if (url.pathname.startsWith('/api/')) {
      if (req.method !== 'GET' && !(req.headers['content-type'] || '').includes('application/json')) throw fail(415, 'Content-Type non valido');
      return await api(store, req, res, url);
    }
    serve(req, res, url);
  } catch (e) {
    if (!e.code) console.error(e);
    json(res, e.code || 500, { error: e.code ? e.message : 'Errore del server' });
  }
}

if (ON_VERCEL) {
  // Serverless: ogni richiesta rilegge i dati da Supabase (le istanze non condividono la memoria).
  module.exports = async (req, res) => {
    const url = new URL(req.url, 'http://x');
    if (!url.pathname.startsWith('/api/')) return serve(req, res, url);
    try {
      if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_KEY) throw fail(500, 'Database non configurato: imposta SUPABASE_URL e SUPABASE_SERVICE_KEY su Vercel');
      if (url.pathname === '/api/cron/reminders') {
        if (env.CRON_SECRET && req.headers.authorization !== 'Bearer ' + env.CRON_SECRET) throw fail(401, 'Non autorizzato');
        const store = await openStore();
        return json(res, 200, env.RESEND_API_KEY ? await sendReminders(store, env) : { configured: false });
      }
      const store = await openStore();
      return await handle(store, req, res);
    } catch (e) {
      if (!e.code) console.error(e);
      json(res, e.code || 500, { error: e.code ? e.message : 'Errore del server' });
    }
  };
} else {
  (async () => {
    const store = await openStore();
    http.createServer((req, res) => handle(store, req, res)).listen(PORT, HOST, () => {
      const h = HOST === '0.0.0.0' ? 'localhost' : HOST;
      console.log(`Database:   ${store.adapter}\nSito:       http://${h}:${PORT}\nGestionale: http://${h}:${PORT}/admin\nOwner:      http://${h}:${PORT}/owner`);
    });
    startScheduler(store, env);
    process.on('SIGINT', () => { store.flush(); process.exit(0); });
    process.on('SIGTERM', () => { store.flush(); process.exit(0); });
  })().catch(e => { console.error('Avvio fallito:', e.message); if (/column|boss_id|role|booking_code/i.test(e.message)) console.error('→ Esegui di nuovo supabase/schema.sql nello SQL Editor di Supabase (aggiunge le nuove colonne).'); process.exit(1); });
}
