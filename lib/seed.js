// Dati di prova per testare il gestionale: 50 clienti registrati, di cui
//  - 30 con un appuntamento già fatto (giorni passati)
//  - 10 con un appuntamento nei prossimi giorni
//  - 10 con un abbonamento
// Tutte le righe hanno id che inizia con "test-", così si possono eliminare in un colpo solo.
const PREFIX = 'test-';
const NOMI = ['Giulia', 'Marco', 'Sara', 'Luca', 'Chiara', 'Alessandro', 'Martina', 'Davide', 'Elena', 'Simone', 'Francesca', 'Matteo', 'Valentina', 'Andrea', 'Federica', 'Giuseppe', 'Roberta', 'Salvatore', 'Federico', 'Alessia', 'Antonio', 'Laura', 'Fabio', 'Silvia', 'Riccardo'];
const COGNOMI = ['Rossi', 'Russo', 'Ferrari', 'Esposito', 'Bianchi', 'Romano', 'Colombo', 'Ricci', 'Marino', 'Greco', 'Bruno', 'Gallo', 'Conti', 'De Luca', 'Costa', 'Giordano', 'Mancini', 'Rizzo', 'Lombardi', 'Moretti', 'Barbieri', 'Fontana', 'Santoro', 'Mariani', 'Rinaldi'];

const pad = n => String(n).padStart(2, '0');
const iso = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const toMin = t => +t.slice(0, 2) * 60 + +t.slice(3);
const fromMin = n => pad(Math.floor(n / 60)) + ':' + pad(n % 60);
const isTest = r => String(r.id).startsWith(PREFIX);

async function removeTestData(store) {
  const out = {};
  for (const t of ['appointments', 'subscriptions', 'clients']) out[t] = await store.removeWhere(t, isTest);
  return out;
}

async function createTestData(store) {
  await removeTestData(store);
  const shop = store.get('settings', 'shop').value;
  const closed = d => shop.hours?.[d.getDay()]?.closed || (shop.closures || []).some(c => c.date === iso(d));
  const staff = store.rows('staff').filter(s => s.active).sort((a, b) => a.sort - b.sort);
  const svcOf = id => store.rows('services').filter(v => v.staff_id === id && v.active);
  const withSvc = staff.filter(s => svcOf(s.id).length);
  if (!withSvc.length) throw Object.assign(new Error('Nessun servizio attivo: aggiungi almeno un servizio'), { code: 400 });

  const today = new Date(); today.setHours(12, 0, 0, 0);
  const now = new Date().toISOString();

  /* --- 50 clienti --- */
  const clients = [];
  for (let i = 0; i < 50; i++) {
    const nome = NOMI[i % NOMI.length], cogn = COGNOMI[(i * 7 + Math.floor(i / 25)) % COGNOMI.length];
    clients.push({
      id: PREFIX + 'c' + pad(i + 1), name: nome + ' ' + cogn,
      phone: '33' + String(31000000 + i * 7919).slice(0, 8),
      email: (nome + '.' + cogn).toLowerCase().replace(/[^a-z.]/g, '') + (i + 1) + '@example.com',
      birthday: `${1968 + (i * 5) % 36}-${pad(1 + (i * 5) % 12)}-${pad(1 + (i * 11) % 28)}`,
      notes: 'DATI DI PROVA', created_at: now,
    });
  }

  /* --- appuntamenti (nessuna sovrapposizione per operatore) --- */
  const used = new Set();
  const slot = (st, svc, date) => {
    const h = shop.hours[date.getDay()], step = +shop.slot_step || 30, d = iso(date);
    for (let m = toMin(h.open); m + svc.minutes <= toMin(h.close); m += step) {
      const k = st.id + d + m;
      if (!used.has(k)) { used.add(k); return fromMin(m); }
    }
    return null;
  };
  const pickDay = (from, dir) => { let d = from; while (closed(d)) d = addDays(d, dir); return d; };
  const makeAppt = (i, client, date, extra) => {
    for (let k = 0; k < withSvc.length; k++) {
      const st = withSvc[(i + k) % withSvc.length], list = svcOf(st.id), svc = list[i % list.length];
      const time = slot(st, svc, date);
      if (!time) continue;
      return {
        id: PREFIX + 'a' + pad(i + 1), client_id: client.id, client_name: client.name, staff_id: st.id, service_id: svc.id,
        service_name: svc.name, category: svc.category, price: svc.price, minutes: svc.minutes,
        date: iso(date), time, status: 'booked', source: 'admin', notes: '', seen: true, from_sub: false, wa_sent: false,
        reminder_email_sent: false, booking_code: '', created_at: now, ...extra,
      };
    }
    return null;
  };
  const appts = [];
  // 30 già fatti: sparsi negli ultimi ~35 giorni
  for (let i = 0; i < 30; i++) {
    const a = makeAppt(i, clients[i], pickDay(addDays(today, -(1 + Math.floor(i * 1.15))), -1), { status: 'done' });
    if (a) appts.push(a);
  }
  // 10 in arrivo: dai prossimi giorni, la metà "online" ancora da vedere
  for (let j = 0; j < 10; j++) {
    const i = 30 + j, online = j % 2 === 0;
    const a = makeAppt(i, clients[i], pickDay(addDays(today, 1 + Math.floor(j * 0.9)), 1),
      online ? { source: 'online', seen: false, booking_code: 'T' + pad(j + 1) + 'PROVA' } : {});
    if (a) appts.push(a);
  }

  /* --- 10 abbonamenti --- */
  const total = +shop.subUses || 4, subs = [];
  for (let j = 0; j < 10; j++) {
    const i = 40 + j, st = withSvc[j % withSvc.length], start = addDays(today, -(4 + j * 4));
    const k = [0, 1, 2, 3, total, 1, 2, 0, total, 3][j] % (total + 1); // utilizzi già fatti (alcuni abbonamenti sono esauriti)
    const uses = [];
    for (let u = 0; u < k; u++) { const d = addDays(start, 2 + u * 3); if (d <= today) uses.push(iso(d)); }
    subs.push({ id: PREFIX + 's' + pad(j + 1), client_id: clients[i].id, staff_id: st.id, start_date: iso(start), price: +shop.subPrice || 0, total, uses, created_at: now });
  }

  await store.insertMany('clients', clients);
  await store.insertMany('appointments', appts);
  await store.insertMany('subscriptions', subs);
  return { clients: clients.length, passati: appts.filter(a => a.status === 'done').length, futuri: appts.filter(a => a.status === 'booked').length, abbonamenti: subs.length };
}

module.exports = { createTestData, removeTestData, PREFIX };
