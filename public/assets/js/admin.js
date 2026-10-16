/* Pannello admin: shell, utilità e tutte le sezioni */
const PAGE = document.body.dataset.page;
const PANEL = document.body.dataset.panel || 'admin'; // 'admin' (titolari e dipendenti) oppure 'owner'
const BASE = '/' + PANEL;
const CATS = { uomo: 'Uomo', donna: 'Donna', estetica: 'Estetica' };
const DAYS = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
const NAV = [
  ['index', '🏠', 'Dashboard'], ['appuntamenti', '📅', 'Appuntamenti'], ['clienti', '👥', 'Clienti'], ['abbonamenti', '🎟️', 'Abbonamenti'],
  ['guadagni', '💰', 'Guadagni'], ['storico', '📈', 'Storico'], ['messaggi', '💬', 'Promemoria'], ['email', '✉️', 'Email ai clienti'], null,
  ['servizi', '✂️', 'Servizi e prezzi'], ['team', '🧑‍🤝‍🧑', 'Team e dipendenti'], ['galleria', '🖼️', 'Galleria'], ['impostazioni', '⚙️', 'Impostazioni'],
];
const NAV_EMP = [['appuntamenti', '📅', 'Appuntamenti']]; // i dipendenti vedono solo gli appuntamenti
const TITLES = { index: 'Dashboard', appuntamenti: 'Appuntamenti', clienti: 'Clienti', abbonamenti: 'Abbonamenti', guadagni: 'Guadagni', storico: 'Storico', messaggi: 'Promemoria', email: 'Email ai clienti', servizi: 'Servizi e prezzi', team: 'Team e dipendenti', galleria: 'Galleria', impostazioni: 'Impostazioni' };
let A = null;
let scope = (() => { try { return localStorage.getItem('scope_' + PANEL) || (PANEL === 'owner' ? 'all' : 'mine'); } catch { return 'mine'; } })();

/* ---------- utilità ---------- */
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const today = () => iso(new Date());
const pd = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addD = (s, n) => { const d = pd(s); d.setDate(d.getDate() + n); return iso(d); };
const addM = (s, n) => { const d = pd(s); d.setDate(1); d.setMonth(d.getMonth() + n); return iso(d); };
const fdate = s => s ? pd(s).toLocaleDateString('it-IT') : '';
const ldate = s => pd(s).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const monday = s => addD(s, -((pd(s).getDay() + 6) % 7));
const money = n => (A?.shop.currency || '$') + (Math.round(n * 100) / 100).toLocaleString('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const toMin = t => +t.slice(0, 2) * 60 + +t.slice(3);
const fromMin = n => String(Math.floor(n / 60) % 24).padStart(2, '0') + ':' + String(n % 60).padStart(2, '0');
const cli = id => A.clients.find(c => c.id === id);
const cname = id => cli(id)?.name || '(eliminato)';
const staffOf = id => A.staff.find(s => s.id === id);
const meId = () => A.me.staff_id || A.staff.find(s => s.is_owner)?.id || A.staff[0]?.id;
const bossOf = id => { const s = staffOf(id); return s ? (s.boss_id || s.id) : ''; };
const sname = id => staffOf(id)?.name || '—';
const toast = (m, err) => { const t = document.createElement('div'); t.className = 'toast' + (err ? ' err' : ''); t.textContent = m; document.body.append(t); setTimeout(() => t.remove(), err ? 4500 : 2200); };

async function api(method, url, body) {
  const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  let j = {}; try { j = await r.json(); } catch { }
  if (r.status === 401 && PAGE !== 'login') { location.href = BASE + '/login'; throw new Error('Sessione scaduta'); }
  if (!r.ok) throw new Error(j.error || 'Errore (' + r.status + ')');
  return j;
}
async function load() {
  const d = await api('GET', '/api/admin/bootstrap');
  A = { me: d.me, emp: d.me.role === 'dipendente', owner: d.me.role === 'owner', shop: d.shop, staff: d.staff, services: d.services, clients: d.clients, appts: d.appointments, subs: d.subscriptions, gallery: d.gallery, status: d.status };
}
// esegue un'azione, ricarica i dati e ridisegna
async function act(fn) {
  try { await fn(); await load(); draw(); } catch (e) { toast(e.message, true); }
}
function modal(title, html, onOk, okLabel = 'Salva') {
  const ov = document.createElement('div'); ov.className = 'ov';
  ov.innerHTML = `<div class="md"><h2>${title}</h2>${html}<div style="margin-top:14px">${onOk ? `<button class="btn" id="mok">${okLabel}</button>` : ''}<button class="btn sec" id="mno">${onOk ? 'Annulla' : 'Chiudi'}</button></div></div>`;
  ov.onclick = e => { if (e.target === ov) ov.remove(); };
  document.body.append(ov);
  $('#mno').onclick = () => ov.remove();
  if (onOk) $('#mok').onclick = async () => { try { if (await onOk(ov)) { ov.remove(); await load(); draw(); } } catch (e) { toast(e.message, true); } };
  return ov;
}
const validScope = () => { if (A.emp) scope = 'mine'; else if (scope === 'mine' && !A.me.staff_id) scope = 'all'; else if (!['mine', 'all'].includes(scope) && !staffOf(scope)) scope = A.owner ? 'all' : 'mine'; };
const ids = () => scope === 'all' ? A.staff.map(s => s.id) : scope === 'mine' ? [meId()] : [scope];
const inScope = a => ids().includes(a.staff_id);
const scopeLabel = () => scope === 'all' ? (A.owner ? 'tutto il negozio' : 'il mio team') : sname(scope === 'mine' ? meId() : scope);
function waUrl(phone, msg) {
  let n = String(phone || '').replace(/[^\d+]/g, '');
  if (!n) return null;
  if (n.startsWith('+')) n = n.slice(1); else if (n.startsWith('00')) n = n.slice(2); else if (n.length <= 10) n = '39' + n;
  return 'https://wa.me/' + n + '?text=' + encodeURIComponent(msg);
}
const fillT = (t, v) => String(t).replace(/\{(\w+)\}/g, (_, k) => v[k] ?? '');
const selOpts = (list, cur, label = x => x.name) => list.map(x => `<option value="${x.id}" ${x.id === cur ? 'selected' : ''}>${esc(label(x))}</option>`).join('');
const activeSub = cid => A.subs.find(s => s.client_id === cid && s.uses.length < s.total);

/* ---------- guadagni: calcoli ---------- */
function txs(idl = ids(), withLoose = scope === 'all') {
  const t = [];
  A.appts.filter(a => a.status === 'done' && idl.includes(a.staff_id)).forEach(a => t.push({ d: a.date, a: +a.price, staff: a.staff_id, boss: bossOf(a.staff_id), cat: a.category, label: a.service_name, client: a.client_name || cname(a.client_id), kind: 'servizio' }));
  A.subs.filter(s => idl.includes(s.staff_id) || (!s.staff_id && withLoose)).forEach(s => t.push({ d: s.start_date, a: +s.price, staff: s.staff_id, boss: bossOf(s.staff_id), cat: 'abbonamento', label: 'Abbonamento', client: cname(s.client_id), kind: 'abbonamento' }));
  return t;
}
// incassi di ogni titolare (con il proprio team): Enrico e Grazia sempre distinti
function teamTable() {
  const T = txs(A.staff.map(s => s.id), true), t = today(), wk = monday(t), mo = t.slice(0, 8) + '01', yr = t.slice(0, 4) + '-01-01';
  const sum = (f, filt) => T.filter(x => x.d >= f && x.d <= t && filt(x)).reduce((s, x) => s + x.a, 0);
  const bosses = [...A.staff.filter(s => s.is_owner), { id: '', name: 'Non assegnato' }].filter(b => b.id || T.some(x => !x.boss));
  const row = (label, filt, cls = '') => `<tr class="${cls}"><td>${label}</td>${[t, wk, mo, yr].map(f => `<td style="text-align:right">${money(sum(f, filt))}</td>`).join('')}</tr>`;
  return `<div class="card"><h2>Incassi per titolare</h2><div class="tw"><table><tr><th></th><th style="text-align:right">Oggi</th><th style="text-align:right">Settimana</th><th style="text-align:right">Mese</th><th style="text-align:right">Anno</th></tr>
   ${bosses.map(b => row(`<b>${esc(b.name)}</b>${b.id ? ' <span class="mu">(con il suo team)</span>' : ''}`, x => x.boss === b.id, 'b') +
     A.staff.filter(s => s.boss_id === b.id && b.id).map(s => row(`<span class="mu">&nbsp;&nbsp;↳ ${esc(s.name)}</span>`, x => x.staff === s.id)).join('')).join('')}
   ${row(A.owner ? '<b>Totale negozio</b>' : '<b>Totale team</b>', () => true, 'b')}</table></div></div>`;
}
const sumR = (T, f, t) => T.filter(x => x.d >= f && x.d <= t).reduce((s, x) => s + x.a, 0);
function period(mode, ref) {
  const T = txs(); let from, to, pf, pt, label, bars = [];
  const bar = (l, f, t, hl, tt) => bars.push({ l, v: sumR(T, f, t), hl, t: tt || l });
  if (mode === 'giorno') {
    from = to = ref; pf = pt = addD(ref, -1); label = ldate(ref);
    for (let i = 6; i >= 0; i--) { const d = addD(ref, -i); bar(pd(d).toLocaleDateString('it-IT', { weekday: 'short' }) + ' ' + pd(d).getDate(), d, d, d === ref, fdate(d)); }
  } else if (mode === 'settimana') {
    from = monday(ref); to = addD(from, 6); pf = addD(from, -7); pt = addD(from, -1); label = `${fdate(from)} – ${fdate(to)}`;
    for (let i = 0; i < 7; i++) { const d = addD(from, i); bar(pd(d).toLocaleDateString('it-IT', { weekday: 'short' }) + ' ' + pd(d).getDate(), d, d, d === today(), fdate(d)); }
  } else if (mode === 'mese') {
    const d = pd(ref); from = iso(new Date(d.getFullYear(), d.getMonth(), 1)); to = iso(new Date(d.getFullYear(), d.getMonth() + 1, 0));
    pf = iso(new Date(d.getFullYear(), d.getMonth() - 1, 1)); pt = iso(new Date(d.getFullYear(), d.getMonth(), 0));
    label = d.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
    for (let i = 1; i <= +to.slice(8); i++) { const dd = from.slice(0, 8) + String(i).padStart(2, '0'); bar(String(i), dd, dd, dd === today(), fdate(dd)); }
  } else {
    const y = pd(ref).getFullYear(); from = y + '-01-01'; to = y + '-12-31'; pf = (y - 1) + '-01-01'; pt = (y - 1) + '-12-31'; label = String(y);
    for (let m = 0; m < 12; m++) { const f = iso(new Date(y, m, 1)), t = iso(new Date(y, m + 1, 0)); bar(new Date(y, m, 1).toLocaleDateString('it-IT', { month: 'short' }), f, t, false, new Date(y, m, 1).toLocaleDateString('it-IT', { month: 'long' })); }
  }
  return { T, from, to, pf, pt, label, bars, cur: sumR(T, from, to), prev: sumR(T, pf, pt) };
}
function delta(c, p) {
  if (!p && !c) return '<span class="mu">nessun dato</span>';
  if (!p) return '<span class="up">▲ nuovo</span>';
  const x = (c - p) / p * 100;
  return `<span class="${x >= 0 ? 'up' : 'down'}">${x >= 0 ? '▲' : '▼'} ${Math.abs(x).toFixed(0)}%</span>`;
}
function barChart(items, h = 200) {
  const W = 680, pt = 22, pb = 26, n = items.length, max = Math.max(1, ...items.map(i => i.v)), bw = W / n, ih = h - pt - pb;
  let s = `<svg class="chart" viewBox="0 0 ${W} ${h}" role="img">`;
  for (let g = 0; g <= 3; g++) { const y = pt + ih - ih * g / 3; s += `<line x1="0" x2="${W}" y1="${y}" y2="${y}" stroke="#e7e1d8"/>`; if (g) s += `<text x="2" y="${y - 3}">${Math.round(max * g / 3)}</text>`; }
  items.forEach((it, i) => {
    const bh = it.v / max * ih, x = i * bw + bw * .18, w = bw * .64, y = pt + ih - bh;
    s += `<rect x="${x}" y="${y}" width="${w}" height="${Math.max(bh, 1)}" fill="${it.hl ? '#B08A4A' : '#1A1A1A'}"><title>${esc(it.t || it.l)}: ${money(it.v)}</title></rect>`;
    if (n <= 14 && it.v > 0) s += `<text class="v" x="${x + w / 2}" y="${y - 5}" text-anchor="middle">${Math.round(it.v)}</text>`;
    if (n <= 16 || i % Math.ceil(n / 16) === 0) s += `<text x="${x + w / 2}" y="${h - 8}" text-anchor="middle">${esc(it.l)}</text>`;
  });
  return s + '</svg>';
}
function breakdown(T, f, t) {
  const L = T.filter(x => x.d >= f && x.d <= t), tot = L.reduce((s, x) => s + x.a, 0) || 1;
  const by = (key, name) => { const m = {}; L.forEach(x => m[x[key]] = (m[x[key]] || 0) + x.a); return Object.entries(m).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<div style="margin:8px 0"><div style="display:flex;justify-content:space-between"><span>${esc(name(k))}</span><b>${money(v)}</b></div><div class="bar"><i style="width:${v / tot * 100}%"></i></div></div>`).join('') || '<div class="mu">—</div>'; };
  return { op: by('staff', k => k ? sname(k) : 'Altro'), cat: by('cat', k => CATS[k] || 'Abbonamenti'), n: L.length };
}

/* ---------- shell ---------- */
function shell(html) {
  const mine = staffOf(meId());
  validScope();
  const nav = A.emp ? NAV_EMP : NAV;
  const scopeSel = A.emp ? '' : `<label style="margin:0">Mostra:</label><select id="scope" onchange="setScope(this.value)">${A.me.staff_id ? `<option value="mine" ${scope === 'mine' ? 'selected' : ''}>I miei (${esc(mine?.name || '')})</option>` : ''}<option value="all" ${scope === 'all' ? 'selected' : ''}>${A.owner ? 'Tutto il negozio' : 'Il mio team'}</option>
      ${A.staff.filter(s => s.id !== A.me.staff_id).map(s => `<option value="${s.id}" ${scope === s.id ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select>`;
  $('#app').innerHTML = `<div class="shell"><aside class="side" id="side"><div class="brand"><img src="/assets/img/logo.png" alt="${esc(A.shop.name)}"><small>${A.owner ? 'Pannello owner' : A.emp ? 'Area dipendenti' : 'Pannello admin'}</small></div>
    ${nav.map(n => n ? `<a href="${BASE}/${n[0] === 'index' ? '' : n[0]}" class="${PAGE === n[0] ? 'on' : ''}"><span>${n[1]}</span>${n[2]}</a>` : '<hr>').join('')}<hr><a href="/" target="_blank">🌐 Vedi il sito</a></aside>
    <div class="main"><div class="top"><div style="display:flex;gap:12px;align-items:center"><button class="menu" onclick="toggleMenu()">☰</button><h1>${TITLES[PAGE]}</h1></div>
     <div class="r">${scopeSel}<span class="mu">${esc(A.me.username)}</span><button class="btn sec sm" onclick="pwModal()">🔑</button><button class="btn sec sm" onclick="logout()">Esci</button></div></div>
    <div class="content">${html}</div></div></div>`;
}
function toggleMenu() {
  const s = $('#side'); s.classList.toggle('open');
  const sc = document.querySelector('.scrim'); if (sc) sc.remove(); else if (s.classList.contains('open')) { const d = document.createElement('div'); d.className = 'scrim'; d.onclick = toggleMenu; document.body.append(d); }
}
function setScope(v) { scope = v; try { localStorage.setItem('scope_' + PANEL, v); } catch { } draw(); }
async function logout() { await api('POST', '/api/logout').catch(() => { }); location.href = BASE + '/login'; }
function pwModal() {
  modal('Cambia password', '<label>Password attuale</label><input id="pw_o" type="password"><label>Nuova password (min. 8)</label><input id="pw_n" type="password">', async () => { await api('POST', '/api/admin/password', { old: $('#pw_o').value, new: $('#pw_n').value }); toast('Password aggiornata'); return true; }, 'Aggiorna');
}

/* ---------- DASHBOARD ---------- */
function pgIndex() {
  const t = today(), P = period('giorno', t), idl = ids();
  const mine = A.appts.filter(inScope);
  const todayL = mine.filter(a => a.date === t && a.status !== 'cancelled').sort((a, b) => a.time.localeCompare(b.time));
  const expected = todayL.filter(a => a.status === 'booked').reduce((s, a) => s + +a.price, 0);
  const fresh = mine.filter(a => a.source === 'online' && !a.seen && a.status === 'booked');
  const wk = period('settimana', t), mo = period('mese', t);
  const bd = birthdays();
  return `
  ${fresh.length ? `<div class="card" style="border-color:var(--gold)"><h2>🔔 Nuove prenotazioni online (${fresh.length}) <button class="btn sec sm" onclick="markSeen()">Segna come viste</button></h2>${fresh.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)).map(apRow).join('')}</div>` : ''}
  <div class="grid" style="margin-bottom:18px">
   <div class="card stat" style="margin:0"><div class="l">Incasso di oggi</div><div class="v">${money(P.cur)}</div><div>${delta(P.cur, P.prev)} <span class="mu">vs ieri (${money(P.prev)})</span></div></div>
   <div class="card stat" style="margin:0"><div class="l">Ancora da incassare oggi</div><div class="v">${money(expected)}</div><div class="mu">${todayL.filter(a => a.status === 'booked').length} appuntamenti da completare</div></div>
   <div class="card stat" style="margin:0"><div class="l">Questa settimana</div><div class="v">${money(wk.cur)}</div><div>${delta(wk.cur, wk.prev)} <span class="mu">vs scorsa</span></div></div>
   <div class="card stat" style="margin:0"><div class="l">Questo mese</div><div class="v">${money(mo.cur)}</div><div>${delta(mo.cur, mo.prev)} <span class="mu">vs scorso</span></div></div>
  </div>
  <div class="grid2">
   <div class="card"><h2>Agenda di oggi <a class="btn sec sm" href="${BASE}/appuntamenti">Apri →</a></h2>${todayL.length ? todayL.map(apRow).join('') : '<div class="mu">Nessun appuntamento oggi</div>'}</div>
   <div>
    <div class="card"><h2>🎂 Compleanni (30 giorni)</h2>${bd.length ? bd.map(b => `<div class="item"><div><b>${esc(b.c.name)}</b> <span class="mu">${b.age} anni</span><br><span class="mu">${b.diff === 0 ? 'OGGI!' : b.diff === 1 ? 'domani' : 'tra ' + b.diff + ' giorni'} · ${fdate(b.c.birthday).slice(0, 5)}</span></div>
      <button class="btn wa sm" onclick="waBirthday('${b.c.id}')">Auguri WhatsApp</button></div>`).join('') : '<div class="mu">Nessun compleanno in arrivo</div>'}</div>
    <div class="card"><h2>Riepilogo</h2><div class="grid">
     <div class="stat"><div class="l">Clienti</div><div class="v">${A.clients.length}</div></div>
     <div class="stat"><div class="l">Abbonamenti attivi</div><div class="v">${A.subs.filter(s => s.uses.length < s.total).length}</div></div></div></div>
   </div></div>
  <div class="card"><h2>Ultimi 7 giorni · ${esc(scopeLabel())}</h2>${barChart(P.bars)}</div>
  ${A.owner || A.staff.some(s => s.boss_id === A.me.staff_id) ? teamTable() : ''}`;
}
function birthdays() {
  const t = pd(today()), out = [];
  A.clients.forEach(c => {
    if (!c.birthday) return;
    const [y, m, d] = c.birthday.split('-').map(Number);
    let n = new Date(t.getFullYear(), m - 1, d); if (n < t) n = new Date(t.getFullYear() + 1, m - 1, d);
    const diff = Math.round((n - t) / 864e5);
    if (diff <= 30) out.push({ c, diff, age: n.getFullYear() - y });
  });
  return out.sort((a, b) => a.diff - b.diff);
}
function waBirthday(id) {
  const c = cli(id), u = waUrl(c.phone, fillT(A.shop.bd_template, { nome: c.name.split(' ')[0], negozio: A.shop.name }));
  if (!u) return toast('Nessun numero di telefono', true); window.open(u, '_blank');
}
function markSeen() { act(async () => { for (const a of A.appts.filter(x => x.source === 'online' && !x.seen)) await api('PATCH', '/api/admin/appointments/' + a.id, { seen: true }); }); }

/* ---------- APPUNTAMENTI ---------- */
const STATUS = { booked: ['Prenotato', ''], done: ['Completato', 'ok'], cancelled: ['Annullato', 'gr'], noshow: ['Non venuto', 'ko'] };
function apRow(a) {
  const st = STATUS[a.status];
  return `<div class="item"><div><b>${a.time}–${fromMin(toMin(a.time) + (a.minutes || 30))}</b> · ${esc(a.client_name || cname(a.client_id))}
   ${a.source === 'online' ? '<span class="tag new">online</span>' : ''} <span class="tag ${st[1]}">${st[0]}</span><br>
   <span class="mu">${esc(a.service_name)} · ${A.emp ? '' : (a.from_sub ? 'abbonamento' : money(a.price)) + ' · '}${esc(sname(a.staff_id))} · ${fdate(a.date)}${a.notes ? ' · 📝 ' + esc(a.notes) : ''}</span></div>
   <div class="act">${a.status === 'booked' ? `<button class="btn sm" onclick="setStatus('${a.id}','done')">Completa</button>` : `<button class="btn sec sm" onclick="setStatus('${a.id}','booked')">Riapri</button>`}
   ${a.status === 'booked' ? `<button class="btn sec sm" onclick="setStatus('${a.id}','noshow')">No-show</button><button class="btn sec sm" onclick="setStatus('${a.id}','cancelled')">Annulla</button>` : ''}
   <button class="btn sec sm" onclick="apptModal('${a.id}')">Modifica</button>
   <button class="btn wa sm" onclick="waAppt('${a.id}')">WA</button>
   <button class="btn del sm" onclick="delAppt('${a.id}')">✕</button></div></div>`;
}
const APP = { mode: 'giorno', date: today() };
function pgAppuntamenti() {
  const list = A.appts.filter(inScope);
  let body;
  if (APP.mode === 'giorno') {
    const l = list.filter(a => a.date === APP.date).sort((a, b) => a.time.localeCompare(b.time));
    body = `<div class="nav2"><button class="btn sec" onclick="APP.date=addD(APP.date,-1);draw()">◀</button><b>${ldate(APP.date)}</b><button class="btn sec" onclick="APP.date=addD(APP.date,1);draw()">▶</button>
      <button class="btn sec sm" onclick="APP.date=today();draw()">Oggi</button><input type="date" value="${APP.date}" style="width:auto;margin:0" onchange="APP.date=this.value||today();draw()"></div>
      <div class="card">${l.length ? l.map(apRow).join('') : '<div class="mu">Nessun appuntamento in questo giorno</div>'}</div>`;
  } else {
    const t = today(), l = list.filter(a => a.date >= t && a.status === 'booked').sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
    const days = [...new Set(l.map(a => a.date))];
    body = days.length ? days.map(d => `<div class="card"><h2>${ldate(d)}</h2>${l.filter(a => a.date === d).map(apRow).join('')}</div>`).join('') : '<div class="card mu">Nessun appuntamento in programma</div>';
  }
  return `<div class="tabs"><button class="${APP.mode === 'giorno' ? 'on' : ''}" onclick="APP.mode='giorno';draw()">Giorno</button><button class="${APP.mode === 'prossimi' ? 'on' : ''}" onclick="APP.mode='prossimi';draw()">Tutti i prossimi</button>
   <button class="btn" style="margin-left:auto" onclick="apptModal()">+ Nuovo appuntamento</button></div>${body}`;
}
function apptModal(id, pre = {}) {
  const a = id ? A.appts.find(x => x.id === id) : null;
  const staffId = a?.staff_id || pre.staff_id || (scope !== 'all' && scope !== 'mine' ? scope : meId());
  const clientOpts = [...A.clients].sort((x, y) => x.name.localeCompare(y.name));
  const html = `<label>Cliente</label>
   <input id="f_cs" placeholder="🔍 Cerca cliente…" oninput="filterClients()">
   <select id="f_cl" size="1"><option value="">— Nuovo cliente (compila sotto) —</option>${clientOpts.map(c => `<option value="${c.id}" ${(a?.client_id || pre.client_id) === c.id ? 'selected' : ''}>${esc(c.name)}${c.phone ? ' · ' + esc(c.phone) : ''}</option>`).join('')}</select>
   <div class="row" id="f_new"><input id="f_nn" placeholder="Nome nuovo cliente"><input id="f_np" placeholder="Telefono"></div>
   <div class="row"><div><label>Operatore</label><select id="f_st" onchange="fillSvc()">${selOpts(A.staff.filter(s => s.active || s.id === staffId), staffId)}</select></div>
   <div><label>Servizio</label><select id="f_sv" onchange="svcPicked()"></select></div></div>
   <div class="row"><div><label>Data</label><input id="f_d" type="date" value="${a?.date || pre.date || APP.date || today()}"></div><div><label>Ora</label><input id="f_t" type="time" value="${a?.time || '09:00'}"></div>
   <div ${A.emp ? 'class="hide"' : ''}><label>Prezzo</label><input id="f_p" type="number" min="0" step="0.5" value="${a?.price ?? 0}"></div><div><label>Minuti</label><input id="f_m" type="number" min="10" step="5" value="${a?.minutes ?? 30}"></div></div>
   <label>Note</label><input id="f_n" value="${esc(a?.notes || '')}">`;
  modal(a ? 'Modifica appuntamento' : 'Nuovo appuntamento', html, async () => {
    let cid = $('#f_cl').value;
    if (!cid) {
      const nm = $('#f_nn').value.trim(); if (!nm) throw new Error('Scegli un cliente o inserisci il nome');
      cid = (await api('POST', '/api/admin/clients', { name: nm, phone: $('#f_np').value.trim() })).row.id;
    }
    const sv = $('#f_sv').value, st = $('#f_st').value, date = $('#f_d').value, time = $('#f_t').value, minutes = +$('#f_m').value || 30;
    const fromSub = sv === 'sub';
    if (fromSub && !activeSub(cid) && !(a && a.from_sub)) throw new Error('Il cliente non ha un abbonamento attivo');
    const svc = A.services.find(x => x.id === sv);
    const clash = A.appts.find(x => x.id !== id && x.staff_id === st && x.date === date && ['booked', 'done'].includes(x.status) && toMin(time) < toMin(x.time) + (x.minutes || 30) && toMin(time) + minutes > toMin(x.time));
    if (clash && !confirm(`${sname(st)} ha già un appuntamento alle ${clash.time} (${clash.client_name}). Aggiungere comunque?`)) return false;
    const data = {
      client_id: cid, staff_id: st, service_id: svc?.id || '', service_name: svc ? svc.name : (a?.service_name || 'Abbonamento'), category: svc?.category || a?.category || 'uomo',
      price: fromSub ? 0 : +$('#f_p').value || 0, minutes, date, time, notes: $('#f_n').value.trim(), from_sub: fromSub,
    };
    if (fromSub && !svc) { data.service_name = 'Abbonamento'; }
    if (id) await api('PATCH', '/api/admin/appointments/' + id, data);
    else await api('POST', '/api/admin/appointments', data);
    return true;
  });
  fillSvc(a); svcPicked(true); $('#f_cl').onchange = () => $('#f_new').classList.toggle('hide', !!$('#f_cl').value);
  $('#f_new').classList.toggle('hide', !!$('#f_cl').value);
}
function filterClients() {
  const q = $('#f_cs').value.toLowerCase(), sel = $('#f_cl');
  [...sel.options].forEach((o, i) => { if (i) o.hidden = q && !o.textContent.toLowerCase().includes(q); });
  const first = [...sel.options].find((o, i) => i && !o.hidden); if (q && first) { sel.value = first.value; sel.onchange(); }
}
function fillSvc(a) {
  const st = $('#f_st').value, sel = $('#f_sv');
  const list = A.services.filter(s => s.staff_id === st && s.active);
  sel.innerHTML = Object.keys(CATS).map(c => { const l = list.filter(s => s.category === c); return l.length ? `<optgroup label="${CATS[c]}">${l.map(s => `<option value="${s.id}">${esc(s.name)}${A.emp ? '' : ' — ' + money(s.price)} · ${s.minutes}′</option>`).join('')}</optgroup>` : ''; }).join('') + (A.emp ? '' : '<option value="sub">🎟️ Usa abbonamento</option>');
  if (a) sel.value = a.from_sub ? 'sub' : a.service_id || sel.value;
  if (!a) svcPicked();
}
function svcPicked(keep) {
  const v = $('#f_sv').value, s = A.services.find(x => x.id === v);
  if (keep && $('#f_p').value !== '0' && $('#f_p').value !== '') return;
  if (v === 'sub') { $('#f_p').value = 0; return; }
  if (s) { $('#f_p').value = s.price; $('#f_m').value = s.minutes; }
}
function setStatus(id, status) {
  act(async () => {
    const a = A.appts.find(x => x.id === id);
    if (status === 'done' && a.from_sub) {
      const s = activeSub(a.client_id); if (!s) throw new Error('Abbonamento non più attivo');
      await api('PATCH', '/api/admin/subscriptions/' + s.id, { uses: [...s.uses, a.date] });
    }
    if (a.status === 'done' && a.from_sub && status !== 'done') {
      const s = A.subs.find(x => x.client_id === a.client_id && x.uses.includes(a.date));
      if (s) { const u = [...s.uses]; u.splice(u.indexOf(a.date), 1); await api('PATCH', '/api/admin/subscriptions/' + s.id, { uses: u }); }
    }
    await api('PATCH', '/api/admin/appointments/' + id, { status, seen: true });
  });
}
function delAppt(id) { if (confirm("Eliminare l'appuntamento?")) act(() => api('DELETE', '/api/admin/appointments/' + id)); }
function waAppt(id) {
  const a = A.appts.find(x => x.id === id), c = cli(a.client_id);
  const u = c && waUrl(c.phone, fillT(A.shop.wa_template, { nome: (c.name || '').split(' ')[0], data: ldate(a.date), ora: a.time, servizio: a.service_name, negozio: A.shop.name }));
  if (!u) return toast('Nessun numero di telefono', true);
  window.open(u, '_blank'); api('PATCH', '/api/admin/appointments/' + id, { wa_sent: true }).then(load).then(draw).catch(() => { });
}

/* ---------- CLIENTI ---------- */
const CL = { sel: null, q: '' };
function pgClienti() {
  const q = CL.q.toLowerCase();
  const list = A.clients.filter(c => !q || c.name.toLowerCase().includes(q) || (c.phone || '').includes(q) || (c.email || '').toLowerCase().includes(q)).sort((a, b) => a.name.localeCompare(b.name));
  if (CL.sel && CL.sel !== 'new' && !cli(CL.sel)) CL.sel = null;
  return `<div class="card"><h2>Seleziona cliente <button class="btn" onclick="CL.sel='new';draw()">+ Nuovo cliente</button></h2>
   <input id="cq" placeholder="🔍 Cerca per nome, telefono o email" value="${esc(CL.q)}" oninput="CL.q=this.value;redrawKeep('cq')">
   <select id="csel" onchange="CL.sel=this.value||null;draw()"><option value="">— Clienti (${list.length}) —</option>${list.map(c => `<option value="${c.id}" ${c.id === CL.sel ? 'selected' : ''}>${esc(c.name)}${c.phone ? ' · ' + esc(c.phone) : ''}</option>`).join('')}</select></div>
   ${CL.sel === 'new' ? clientForm(null) : CL.sel ? clientDetail(cli(CL.sel)) : ''}`;
}
function redrawKeep(id) { const p = $('#' + id).selectionStart; draw(); const e = $('#' + id); e.focus(); e.setSelectionRange(p, p); }
function clientForm(c) {
  return `<div class="card"><h2>${c ? esc(c.name) : 'Nuovo cliente'}</h2>
   <div class="row"><div><label>Nome e cognome</label><input id="c_n" value="${esc(c?.name)}"></div><div><label>Data di nascita</label><input id="c_b" type="date" value="${esc(c?.birthday)}"></div></div>
   <div class="row"><div><label>Telefono (WhatsApp)</label><input id="c_p" type="tel" value="${esc(c?.phone)}"></div><div><label>Email (promemoria)</label><input id="c_e" type="email" value="${esc(c?.email)}"></div></div>
   <label>📝 Note cliente</label><textarea id="c_t" rows="4">${esc(c?.notes)}</textarea>
   <button class="btn" onclick="saveClient('${c?.id || ''}')">${c ? 'Salva modifiche' : 'Crea cliente'}</button>
   ${c ? `<button class="btn wa" onclick="waClient('${c.id}')">WhatsApp</button><button class="btn del" onclick="delClient('${c.id}')">Elimina</button>` : `<button class="btn sec" onclick="CL.sel=null;draw()">Annulla</button>`}</div>`;
}
function clientDetail(c) {
  const s = activeSub(c.id), hist = A.appts.filter(a => a.client_id === c.id).sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
  const subs = A.subs.filter(x => x.client_id === c.id), spent = hist.filter(a => a.status === 'done').reduce((t, a) => t + +a.price, 0) + subs.reduce((t, x) => t + +x.price, 0);
  return clientForm(c) + `<div class="card"><h2>🎟️ Abbonamento</h2>
   ${s ? `<b>${s.total - s.uses.length}</b> utilizzi rimasti su ${s.total} · acquistato il ${fdate(s.start_date)} <button class="btn sm" onclick="useSub('${s.id}')">Segna utilizzo</button>`
      : `<div class="mu" style="margin-bottom:8px">Nessun abbonamento attivo</div><button class="btn" onclick="sellSub('${c.id}')">Vendi abbonamento ${money(A.shop.subPrice)}</button>`}
   ${subs.length ? '<h3>Date di utilizzo</h3>' + subs.map(x => `<div class="mu">Acquisto ${fdate(x.start_date)} (${money(x.price)}): ${x.uses.length ? x.uses.map(fdate).join(', ') : 'nessun utilizzo'}</div>`).join('') : ''}</div>
  <div class="card"><h2>Storico <span class="mu">Speso in totale: ${money(spent)}</span></h2>
   ${hist.length ? hist.map(a => `<div class="item"><div>${fdate(a.date)} ${a.time} · ${esc(a.service_name)} <span class="mu">con ${esc(sname(a.staff_id))}</span></div><div>${a.from_sub ? 'abb.' : money(a.price)} <span class="tag ${STATUS[a.status][1]}">${STATUS[a.status][0]}</span></div></div>`).join('') : '<div class="mu">Nessun appuntamento</div>'}
   <button class="btn sec" style="margin-top:10px" onclick="apptModal(null,{client_id:'${c.id}'})">+ Nuovo appuntamento per ${esc(c.name.split(' ')[0])}</button></div>`;
}
function saveClient(id) {
  const name = $('#c_n').value.trim(); if (!name) return toast('Inserisci il nome', true);
  const data = { name, birthday: $('#c_b').value, phone: $('#c_p').value.trim(), email: $('#c_e').value.trim(), notes: $('#c_t').value };
  act(async () => { if (id) await api('PATCH', '/api/admin/clients/' + id, data); else CL.sel = (await api('POST', '/api/admin/clients', data)).row.id; toast('Salvato'); });
}
function delClient(id) { if (confirm('Eliminare il cliente? Gli appuntamenti e gli incassi restano.')) act(async () => { await api('DELETE', '/api/admin/clients/' + id); CL.sel = null; }); }
function waClient(id) { const c = cli(id), u = waUrl(c.phone, `Ciao ${c.name.split(' ')[0]}, `); if (!u) return toast('Nessun numero di telefono', true); window.open(u, '_blank'); }

/* ---------- ABBONAMENTI ---------- */
function sellSub(cid) {
  if (!cid) return toast('Scegli un cliente', true);
  if (activeSub(cid)) return toast('Il cliente ha già un abbonamento attivo', true);
  act(() => api('POST', '/api/admin/subscriptions', { client_id: cid, staff_id: meId(), start_date: today(), price: A.shop.subPrice, total: A.shop.subUses, uses: [] }));
}
function useSub(id) {
  const s = A.subs.find(x => x.id === id);
  modal('Segna utilizzo abbonamento', `<p>${esc(cname(s.client_id))} · rimasti ${s.total - s.uses.length} utilizzi</p><label>Data di utilizzo</label><input id="u_d" type="date" value="${today()}">`,
    async () => { const d = $('#u_d').value; if (!d) throw new Error('Scegli la data'); await api('PATCH', '/api/admin/subscriptions/' + id, { uses: [...s.uses, d] }); return true; }, 'Conferma');
}
function pgAbbonamenti() {
  const list = [...A.subs].sort((a, b) => b.start_date.localeCompare(a.start_date));
  return `<div class="card"><h2>Vendi abbonamento</h2><div class="row"><select id="sc">${selOpts([...A.clients].sort((a, b) => a.name.localeCompare(b.name)), '')}</select>
   <button class="btn" onclick="sellSub($('#sc').value)">Vendi a ${money(A.shop.subPrice)} · ${A.shop.subUses} utilizzi al mese</button></div></div>
   <div class="card"><h2>Abbonamenti</h2>${list.length ? list.map(s => { const act = s.uses.length < s.total; return `<div class="item"><div><b>${esc(cname(s.client_id))}</b> ${act ? '<span class="tag ok">attivo</span>' : '<span class="tag gr">esaurito</span>'}<br>
    <span class="mu">Acquistato ${fdate(s.start_date)} · usati ${s.uses.length}/${s.total}${s.uses.length ? ' · ' + s.uses.map(fdate).join(', ') : ''}</span></div>
    <div class="act">${act ? `<button class="btn sm" onclick="useSub('${s.id}')">Segna utilizzo</button>` : ''}<button class="btn del sm" onclick="delSub('${s.id}')">✕</button></div></div>`; }).join('') : '<div class="mu">Nessun abbonamento venduto</div>'}</div>`;
}
function delSub(id) { if (confirm('Eliminare questo abbonamento? Verrà tolto anche dagli incassi.')) act(() => api('DELETE', '/api/admin/subscriptions/' + id)); }

/* ---------- GUADAGNI (giornaliero di default) ---------- */
const G = { mode: 'giorno', ref: today() };
function pgGuadagni() {
  const P = period(G.mode, G.ref), bk = breakdown(P.T, P.from, P.to);
  const unit = { giorno: 1, settimana: 7 }[G.mode];
  const shift = n => G.mode === 'mese' ? `G.ref=addM(G.ref,${n});draw()` : G.mode === 'anno' ? `G.ref=addM(G.ref,${12 * n});draw()` : `G.ref=addD(G.ref,${unit * n});draw()`;
  const prevName = { giorno: 'giorno precedente', settimana: 'settimana precedente', mese: 'mese precedente', anno: 'anno precedente' }[G.mode];
  const L = P.T.filter(x => x.d >= P.from && x.d <= P.to).sort((a, b) => b.d.localeCompare(a.d));
  return `<div class="tabs">${[['giorno', 'Giornaliero'], ['settimana', 'Settimanale'], ['mese', 'Mensile'], ['anno', 'Annuale']].map(([k, l]) => `<button class="${G.mode === k ? 'on' : ''}" onclick="G.mode='${k}';draw()">${l}</button>`).join('')}</div>
  <div class="nav2"><button class="btn sec" onclick="${shift(-1)}">◀</button><b>${esc(P.label)}</b><button class="btn sec" onclick="${shift(1)}">▶</button><button class="btn sec sm" onclick="G.ref=today();draw()">Oggi</button></div>
  <div class="grid" style="margin-bottom:18px">
   <div class="card stat" style="margin:0"><div class="l">Incasso · ${esc(scopeLabel())}</div><div class="v">${money(P.cur)}</div><div class="mu">${bk.n} operazioni</div></div>
   <div class="card stat" style="margin:0"><div class="l">${prevName}</div><div class="v">${money(P.prev)}</div><div>${delta(P.cur, P.prev)} <span class="mu">${P.cur >= P.prev ? '+' : '−'}${money(Math.abs(P.cur - P.prev))}</span></div></div>
   <div class="card stat" style="margin:0"><div class="l">Media per operazione</div><div class="v">${money(bk.n ? P.cur / bk.n : 0)}</div></div></div>
  ${A.owner || A.staff.some(s => s.boss_id === A.me.staff_id) ? teamTable() : ''}
  <div class="card"><h2>Andamento</h2>${barChart(P.bars)}</div>
  <div class="grid2"><div class="card"><h2>Per operatore</h2>${bk.op}</div><div class="card"><h2>Per categoria</h2>${bk.cat}</div></div>
  <div class="card"><h2>Operazioni del periodo</h2>${L.length ? `<div class="tw"><table><tr><th>Data</th><th>Cliente</th><th>Servizio</th><th>Operatore</th><th style="text-align:right">Importo</th></tr>${L.slice(0, 200).map(x => `<tr><td>${fdate(x.d)}</td><td>${esc(x.client)}</td><td>${esc(x.label)}</td><td>${esc(x.staff ? sname(x.staff) : '—')}</td><td style="text-align:right"><b>${money(x.a)}</b></td></tr>`).join('')}</table></div>` : '<div class="mu">Nessun incasso in questo periodo</div>'}</div>`;
}

/* ---------- STORICO ---------- */
const H = { range: '90', gran: 'giorno', cat: '', q: '' };
function pgStorico() {
  let T = txs();
  const t = today(), from = H.range === 'all' ? '0000-00-00' : H.range === '365' ? addD(t, -365) : addD(t, -(+H.range));
  T = T.filter(x => x.d >= from && x.d <= t && (!H.cat || x.cat === H.cat) && (!H.q || (x.client + ' ' + x.label).toLowerCase().includes(H.q.toLowerCase())));
  const key = d => H.gran === 'giorno' ? d : H.gran === 'settimana' ? monday(d) : d.slice(0, 7);
  const g = {}; T.forEach(x => g[key(x.d)] = (g[key(x.d)] || 0) + x.a);
  const keys = Object.keys(g).sort().slice(-30);
  const bars = keys.map(k => ({ l: H.gran === 'mese' ? new Date(k + '-01T12:00').toLocaleDateString('it-IT', { month: 'short', year: '2-digit' }) : fdate(k).slice(0, 5), v: g[k], t: H.gran === 'mese' ? k : H.gran === 'settimana' ? 'Sett. dal ' + fdate(k) : fdate(k) }));
  const tot = T.reduce((s, x) => s + x.a, 0), L = [...T].sort((a, b) => b.d.localeCompare(a.d));
  const best = bars.length ? bars.reduce((m, b) => b.v > m.v ? b : m) : null;
  return `<div class="card"><div class="row">
   <div><label>Periodo</label><select onchange="H.range=this.value;draw()">${[['30', 'Ultimi 30 giorni'], ['90', 'Ultimi 90 giorni'], ['365', 'Ultimi 12 mesi'], ['all', 'Tutto lo storico']].map(([v, l]) => `<option value="${v}" ${H.range === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
   <div><label>Raggruppa per</label><select onchange="H.gran=this.value;draw()">${[['giorno', 'Giorno'], ['settimana', 'Settimana'], ['mese', 'Mese']].map(([v, l]) => `<option value="${v}" ${H.gran === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
   <div><label>Categoria</label><select onchange="H.cat=this.value;draw()"><option value="">Tutte</option>${Object.entries({ ...CATS, abbonamento: 'Abbonamenti' }).map(([k, l]) => `<option value="${k}" ${H.cat === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
   <div><label>Cerca cliente / servizio</label><input id="hq" value="${esc(H.q)}" oninput="H.q=this.value;redrawKeep('hq')"></div></div></div>
  <div class="grid" style="margin-bottom:18px"><div class="card stat" style="margin:0"><div class="l">Totale · ${esc(scopeLabel())}</div><div class="v">${money(tot)}</div><div class="mu">${T.length} operazioni</div></div>
   <div class="card stat" style="margin:0"><div class="l">Media per operazione</div><div class="v">${money(T.length ? tot / T.length : 0)}</div></div>
   <div class="card stat" style="margin:0"><div class="l">Miglior ${H.gran}</div><div class="v">${best ? money(best.v) : '—'}</div><div class="mu">${best ? esc(best.t) : ''}</div></div></div>
  <div class="card"><h2>Andamento ${H.gran === 'giorno' ? 'giornaliero' : H.gran === 'settimana' ? 'settimanale' : 'mensile'} <span class="mu">ultimi ${bars.length}</span></h2>${bars.length ? barChart(bars, 230) : '<div class="mu">Nessun dato nel periodo</div>'}</div>
  <div class="card"><h2>Storico operazioni <button class="btn sec sm" onclick="exportCsv()">⬇ Esporta CSV</button></h2>
   ${L.length ? `<div class="tw"><table><tr><th>Data</th><th>Cliente</th><th>Servizio</th><th>Operatore</th><th style="text-align:right">Importo</th></tr>${L.slice(0, 300).map(x => `<tr><td>${fdate(x.d)}</td><td>${esc(x.client)}</td><td>${esc(x.label)}</td><td>${esc(x.staff ? sname(x.staff) : '—')}</td><td style="text-align:right"><b>${money(x.a)}</b></td></tr>`).join('')}</table></div>${L.length > 300 ? `<p class="mu">Mostrate le prime 300 di ${L.length} (l'export le include tutte).</p>` : ''}` : '<div class="mu">Nessuna operazione</div>'}</div>`;
}
function exportCsv() {
  const t = today(), from = H.range === 'all' ? '0000-00-00' : addD(t, -(+H.range));
  const L = txs().filter(x => x.d >= from && x.d <= t && (!H.cat || x.cat === H.cat) && (!H.q || (x.client + ' ' + x.label).toLowerCase().includes(H.q.toLowerCase()))).sort((a, b) => a.d.localeCompare(b.d));
  const q = v => '"' + String(v).replace(/"/g, '""') + '"';
  const csv = 'Data,Cliente,Servizio,Operatore,Categoria,Importo\n' + L.map(x => [x.d, q(x.client), q(x.label), q(x.staff ? sname(x.staff) : ''), x.cat, x.a].join(',')).join('\n');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv' })); a.download = 'storico-incassi.csv'; a.click();
}

/* ---------- PROMEMORIA (email Resend + WhatsApp) ---------- */
const M = { date: (() => addD(today(), 1))() };
function pgMessaggi() {
  const l = A.appts.filter(a => a.date === M.date && a.status === 'booked' && inScope(a)).sort((a, b) => a.time.localeCompare(b.time));
  const withMail = l.filter(a => cli(a.client_id)?.email);
  return `<div class="card"><h2>Promemoria appuntamenti</h2>
   <div class="row"><div><label>Giorno degli appuntamenti</label><input type="date" value="${M.date}" onchange="M.date=this.value||addD(today(),1);draw()"></div></div>
   <p class="mu">Il giorno prima di ogni appuntamento il server invia in automatico una <b>email</b> (tramite Resend) a chi ha lasciato l'indirizzo, alle ${A.shop.reminder_hour}:00. Il messaggio <b>WhatsApp</b> invece lo invii tu: premi il pulsante, si apre WhatsApp con il testo già scritto e premi invio.</p>
   <p>${A.status.resend ? '<span class="tag ok">Email attive (Resend configurato)</span>' : '<span class="tag ko">Email non attive: manca RESEND_API_KEY nel file .env</span>'}
   ${A.status.resend ? `<button class="btn sm" onclick="runReminders()">Invia ora le email del ${fdate(M.date)} (${withMail.filter(a => !a.reminder_email_sent).length})</button>` : ''}</p></div>
  <div class="card"><h2>${ldate(M.date)} · ${l.length} appuntamenti</h2>${l.length ? l.map(a => {
    const c = cli(a.client_id), hasM = !!c?.email;
    return `<div class="item"><div><b>${a.time}</b> · ${esc(a.client_name || cname(a.client_id))} <span class="mu">${esc(a.service_name)} · ${esc(sname(a.staff_id))}</span><br>
     ${a.reminder_email_sent ? '<span class="tag ok">email inviata</span>' : hasM ? '<span class="tag">email da inviare</span>' : '<span class="tag gr">nessuna email</span>'}
     ${a.wa_sent ? '<span class="tag ok">WhatsApp inviato</span>' : ''} <span class="mu">${esc(c?.phone || 'nessun telefono')}</span></div>
     <button class="btn wa" onclick="waAppt('${a.id}')">Invia WhatsApp</button></div>`;
  }).join('') : '<div class="mu">Nessun appuntamento in questo giorno</div>'}</div>`;
}
async function runReminders() {
  try {
    const r = await api('POST', '/api/admin/reminders/run', { date: M.date });
    toast(`Inviate ${r.sent} email` + (r.noEmail ? ` · ${r.noEmail} senza email` : '') + (r.errors.length ? ` · ${r.errors.length} errori` : ''), r.errors.length > 0);
    if (r.errors.length) alert(r.errors.join('\n'));
    await load(); draw();
  } catch (e) { toast(e.message, true); }
}

/* ---------- EMAIL AI CLIENTI (Resend) ---------- */
const E = { subject: '', message: 'Ciao {nome},\n\n\n\nA presto,\n{negozio}', mode: 'all', sel: new Set(), q: '', test: '', busy: false, res: null };
const emailOk = c => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(c.email || '') && !/@example\.[a-z]+$/i.test(c.email);
const EMAIL_MODES = { all: 'Tutti i clienti con email', sub: 'Clienti con abbonamento attivo', next: 'Clienti con un appuntamento in arrivo', pick: 'Scelgo io i destinatari' };
function emailPool() { return A.clients.filter(emailOk).sort((a, b) => a.name.localeCompare(b.name)); }
function emailTargets() {
  const pool = emailPool(), t = today();
  if (E.mode === 'sub') return pool.filter(c => activeSub(c.id));
  if (E.mode === 'next') { const ids = new Set(A.appts.filter(a => a.status === 'booked' && a.date >= t).map(a => a.client_id)); return pool.filter(c => ids.has(c.id)); }
  if (E.mode === 'pick') return pool.filter(c => E.sel.has(c.id));
  return pool;
}
function emailList() {
  const q = E.q.trim().toLowerCase(), l = emailPool().filter(c => !q || (c.name + ' ' + c.email).toLowerCase().includes(q));
  return l.map(c => `<label class="item" style="cursor:pointer;margin:0;padding:8px 0"><span style="display:flex;gap:10px;align-items:center"><input type="checkbox" style="width:auto;margin:0" ${E.sel.has(c.id) ? 'checked' : ''} onchange="emailPick('${c.id}',this.checked)"><b>${esc(c.name)}</b> <span class="mu">${esc(c.email)}</span></span></label>`).join('') || '<div class="mu">Nessun cliente con email</div>';
}
function emailCount() { const n = emailTargets().length; const c = $('#ecount'), b = $('#esend'); if (c) c.textContent = n; if (b) { b.textContent = `Invia a ${n} client${n === 1 ? 'e' : 'i'}`; b.disabled = !n || E.busy; } }
function emailPick(id, on) { on ? E.sel.add(id) : E.sel.delete(id); emailCount(); }
function emailPickAll(on) { const q = E.q.trim().toLowerCase(); emailPool().filter(c => !q || (c.name + ' ' + c.email).toLowerCase().includes(q)).forEach(c => on ? E.sel.add(c.id) : E.sel.delete(c.id)); $('#elist').innerHTML = emailList(); emailCount(); }
let pvTimer;
function emailPreview() {
  clearTimeout(pvTimer);
  pvTimer = setTimeout(async () => { try { const r = await api('POST', '/api/admin/email/preview', { message: E.message }); const f = $('#epv'); if (f) f.srcdoc = r.html; } catch { } }, 350);
}
function pgEmail() {
  const pool = emailPool(), noMail = A.clients.length - pool.length;
  setTimeout(() => { emailCount(); emailPreview(); }, 0);
  return `${A.status.resend ? '' : '<div class="card"><h2>Email non attive</h2><p>Per inviare email serve la chiave di Resend: imposta <b>RESEND_API_KEY</b> e <b>RESEND_FROM</b> nelle variabili d\'ambiente di Vercel e rifai il deploy.</p></div>'}
  <div class="card"><h2>Scrivi l'email</h2>
   <p class="mu">${A.status.resend ? `<span class="tag ok">Resend attivo</span> Mittente: <b>${esc(A.status.from || 'onboarding@resend.dev (di prova: consegna solo al tuo indirizzo Resend)')}</b>` : ''}</p>
   <label>Oggetto</label><input id="e_sub" maxlength="150" value="${esc(E.subject)}" placeholder="Es. Novità e promozioni di ${esc(A.shop.name)}" oninput="E.subject=this.value">
   <label>Messaggio <span class="mu">— usa {nome} per il nome del cliente e {negozio} per il nome del salone</span></label>
   <textarea id="e_msg" rows="9" maxlength="5000" oninput="E.message=this.value;emailPreview()">${esc(E.message)}</textarea>
   <h3>Anteprima</h3><iframe id="epv" style="width:100%;height:330px;border:1px solid var(--bd);background:#fff" title="Anteprima email"></iframe></div>
  <div class="card"><h2>Destinatari <span class="tag"><span id="ecount">0</span> selezionati</span></h2>
   <select onchange="E.mode=this.value;draw()">${Object.entries(EMAIL_MODES).map(([k, l]) => `<option value="${k}" ${E.mode === k ? 'selected' : ''}>${l}</option>`).join('')}</select>
   <p class="mu">${pool.length} clienti hanno un'email valida${noMail ? ` · ${noMail} non hanno un'email (o è di prova) e vengono saltati` : ''}. Ogni cliente riceve un'email personale: gli altri destinatari non si vedono.</p>
   ${E.mode === 'pick' ? `<div class="row"><input id="e_q" placeholder="Cerca per nome o email" value="${esc(E.q)}" oninput="E.q=this.value;$('#elist').innerHTML=emailList()"><button class="btn sec sm" style="flex:0;white-space:nowrap" onclick="emailPickAll(true)">Seleziona tutti</button><button class="btn sec sm" style="flex:0;white-space:nowrap" onclick="emailPickAll(false)">Nessuno</button></div>
    <div id="elist" style="max-height:300px;overflow:auto;border:1px solid var(--bd);padding:4px 12px">${emailList()}</div>` : ''}</div>
  <div class="card"><h2>Invia</h2>
   <div class="row"><div><label>Prima prova a te: invia un'email di test a</label><input id="e_test" type="email" placeholder="tuaemail@esempio.it" value="${esc(E.test)}" oninput="E.test=this.value"></div><button class="btn sec" style="flex:0;white-space:nowrap" onclick="emailSend(true)" ${A.status.resend ? '' : 'disabled'}>Invia test</button></div>
   <button class="btn" id="esend" onclick="emailSend(false)" ${A.status.resend ? '' : 'disabled'}>Invia</button>
   ${E.res ? `<p style="margin-top:12px">${E.res.errors.length ? '<span class="tag ko">Errore</span>' : '<span class="tag ok">Fatto</span>'} Inviate <b>${E.res.sent}</b> email${E.res.skipped ? ` · ${E.res.skipped} saltate (senza email valida)` : ''}.</p>${E.res.errors.map(e => `<div class="down">${esc(e)}</div>`).join('')}` : ''}</div>`;
}
async function emailSend(test) {
  if (!E.subject.trim() || !E.message.trim()) return toast('Scrivi oggetto e messaggio', true);
  const body = { subject: E.subject, message: E.message };
  if (test) { if (!E.test.trim()) return toast('Scrivi il tuo indirizzo email', true); body.testTo = E.test.trim(); }
  else {
    const t = emailTargets(); if (!t.length) return toast('Nessun destinatario', true);
    if (!confirm(`Inviare questa email a ${t.length} client${t.length === 1 ? 'e' : 'i'}?`)) return;
    body.clientIds = t.map(c => c.id);
  }
  E.busy = true; emailCount();
  try { E.res = await api('POST', '/api/admin/email/send', body); toast(E.res.errors.length ? 'Invio con errori' : 'Email inviate', E.res.errors.length > 0); }
  catch (e) { toast(e.message, true); }
  E.busy = false; draw();
}

/* ---------- SERVIZI E PREZZI ---------- */
const SV = { staff: null };
function pgServizi() {
  if (!SV.staff || !staffOf(SV.staff)) SV.staff = meId();
  const st = staffOf(SV.staff), list = A.services.filter(s => s.staff_id === st.id);
  return `<div class="tabs">${A.staff.map(s => `<button class="${s.id === st.id ? 'on' : ''}" onclick="SV.staff='${s.id}';draw()">${esc(s.name)}${s.active ? '' : ' (non attivo)'}</button>`).join('')}</div>
  <div class="card"><h2>Listino di ${esc(st.name)}</h2><p class="mu">Ogni operatore ha il proprio listino con prezzi propri. Le voci attive si vedono e si prenotano dal sito.</p>
   ${Object.entries(CATS).map(([k, l]) => {
    const rows = list.filter(s => s.category === k);
    return `<h3>${l}</h3><div class="tw"><table><tr><th>Servizio</th><th style="width:110px">Prezzo</th><th style="width:100px">Minuti</th><th style="width:70px">Attivo</th><th style="width:50px"></th></tr>
     ${rows.map(s => `<tr><td><input value="${esc(s.name)}" onchange="svPatch('${s.id}','name',this.value)"></td><td><input type="number" min="0" step="0.5" value="${s.price}" onchange="svPatch('${s.id}','price',this.value)"></td>
      <td><input type="number" min="10" step="5" value="${s.minutes}" onchange="svPatch('${s.id}','minutes',this.value)"></td><td><input type="checkbox" ${s.active ? 'checked' : ''} onchange="svPatch('${s.id}','active',this.checked)"></td>
      <td><button class="btn del sm" onclick="svDel('${s.id}')">✕</button></td></tr>`).join('') || '<tr><td colspan="5" class="mu">Nessun servizio</td></tr>'}</table></div>
     <div class="row" style="margin-top:8px"><input id="sn_${k}" placeholder="Nuovo servizio"><input id="sp_${k}" type="number" min="0" step="0.5" placeholder="Prezzo"><input id="sm_${k}" type="number" min="10" step="5" placeholder="Minuti (30)"><button class="btn sec" onclick="svAdd('${k}')">Aggiungi a ${l}</button></div>`;
  }).join('')}</div>
  <div class="card"><h2>Copia listino</h2><div class="row"><select id="cp">${selOpts(A.staff.filter(s => s.id !== st.id), '')}</select><button class="btn sec" onclick="svCopy()">Copia qui i servizi mancanti</button></div></div>`;
}
const svPatch = (id, f, v) => act(() => api('PATCH', '/api/admin/services/' + id, { [f]: v }));
const svDel = id => { if (confirm('Eliminare il servizio?')) act(() => api('DELETE', '/api/admin/services/' + id)); };
function svAdd(k) {
  const name = $('#sn_' + k).value.trim(); if (!name) return toast('Inserisci il nome', true);
  act(() => api('POST', '/api/admin/services', { staff_id: SV.staff, category: k, name, price: +$('#sp_' + k).value || 0, minutes: +$('#sm_' + k).value || 30, active: true }));
}
function svCopy() {
  const src = $('#cp').value; if (!src) return;
  act(async () => {
    const have = new Set(A.services.filter(s => s.staff_id === SV.staff).map(s => s.category + '|' + s.name));
    for (const s of A.services.filter(x => x.staff_id === src && !have.has(x.category + '|' + x.name)))
      await api('POST', '/api/admin/services', { staff_id: SV.staff, category: s.category, name: s.name, price: s.price, minutes: s.minutes, active: s.active });
  });
}

/* ---------- TEAM ---------- */
async function pickImage(file, max = 1600) {
  const img = await new Promise((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ko(new Error('Immagine non leggibile')); i.src = URL.createObjectURL(file); });
  const k = Math.min(1, max / Math.max(img.width, img.height)), c = document.createElement('canvas');
  c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  return api('POST', '/api/admin/upload', { dataUrl: c.toDataURL('image/jpeg', .85) }).then(r => r.url);
}
function pgTeam() {
  const boss = id => staffOf(id)?.name || '';
  return `<div class="card"><h2>Team <button class="btn" onclick="addStaff()">+ Aggiungi dipendente/a</button></h2>
   <p class="mu">${A.owner ? 'Come owner vedi tutto il personale e puoi assegnare ogni dipendente a un titolare.' : 'Aggiungi i tuoi dipendenti e dai loro un <b>accesso</b> (account + password): potranno vedere solo gli <b>appuntamenti</b>, mai gli incassi.'}
   Ognuno ha il proprio listino (sezione Servizi e prezzi). Se è <b>attivo</b> compare sul sito e si può prenotare.</p></div>
  ${A.staff.map(s => `<div class="card"><div style="display:flex;gap:18px;flex-wrap:wrap">
    <div><div class="photo" ${s.photo ? `style="background-image:url('${esc(s.photo)}')"` : ''}>${s.photo ? '' : esc(s.name[0])}</div>
     <label class="btn sec sm" style="display:inline-block;margin-top:8px;cursor:pointer">📷 Foto<input type="file" accept="image/*" hidden onchange="staffPhoto('${s.id}',this.files[0])"></label>
     ${s.photo ? `<button class="btn sec sm" onclick="stPatch('${s.id}','photo','')">✕</button>` : ''}</div>
    <div style="flex:1;min-width:260px"><div class="row"><div><label>Nome</label><input value="${esc(s.name)}" onchange="stPatch('${s.id}','name',this.value)"></div>
     <div><label>Ruolo</label><input value="${esc(s.role)}" onchange="stPatch('${s.id}','role',this.value)"></div></div>
     <label>Presentazione (sito)</label><textarea rows="2" onchange="stPatch('${s.id}','bio',this.value)">${esc(s.bio)}</textarea>
     <label style="display:inline-flex;align-items:center;font-size:14px;color:var(--tx)"><input type="checkbox" ${s.active ? 'checked' : ''} onchange="stPatch('${s.id}','active',this.checked)">Attivo (visibile sul sito e prenotabile)</label>
     ${s.is_owner ? '<span class="tag" style="margin-left:10px">titolare</span>' : `<button class="btn del sm" style="float:right" onclick="delStaff('${s.id}')">Elimina</button>`}
     ${!s.is_owner ? `<div class="item" style="margin-top:10px"><div>🔑 ${s.account ? `Accesso: <b>${esc(s.account)}</b> <span class="mu">(vede solo gli appuntamenti)</span>` : '<span class="mu">Nessun accesso al gestionale</span>'}${A.owner && s.boss_id ? `<br><span class="mu">Dipendente di ${esc(boss(s.boss_id))}</span>` : ''}</div>
       <div class="act"><button class="btn sec sm" onclick="accModal('${s.id}')">${s.account ? 'Cambia accesso' : 'Crea accesso'}</button>${s.account ? `<button class="btn del sm" onclick="accDel('${s.id}')">Rimuovi</button>` : ''}</div></div>` : ''}</div></div></div>`).join('')}`;
}
function accModal(id) {
  const s = staffOf(id);
  modal('Accesso di ' + esc(s.name), `<p class="mu">Il dipendente entra da <b>${location.origin}/admin</b> e vede solo i propri appuntamenti.</p>
   <label>Nome account</label><input id="ac_u" value="${esc(s.account || '')}" autocomplete="off" placeholder="es. luca.rossi">
   <label>${s.account ? 'Nuova password (lascia vuoto per non cambiarla)' : 'Password (min. 8 caratteri)'}</label><input id="ac_p" type="password" autocomplete="new-password">`,
    async () => { await api('PUT', '/api/admin/staff/' + id + '/account', { username: $('#ac_u').value, password: $('#ac_p').value }); toast('Accesso salvato'); return true; });
}
const accDel = id => { if (confirm("Rimuovere l'accesso? La persona resta nel team ma non potrà più entrare.")) act(() => api('DELETE', '/api/admin/staff/' + id + '/account')); };
const stPatch = (id, f, v) => act(async () => { await api('PATCH', '/api/admin/staff/' + id, { [f]: v }); toast('Salvato'); });
function staffPhoto(id, file) { if (!file) return; act(async () => { const url = await pickImage(file, 800); await api('PATCH', '/api/admin/staff/' + id, { photo: url }); }); }
function addStaff() {
  const bosses = A.staff.filter(x => x.is_owner);
  modal('Nuovo dipendente/a', `<label>Nome</label><input id="n_n"><label>Ruolo</label><input id="n_r" placeholder="es. Estetista">
   ${A.owner ? `<label>Dipendente di</label><select id="n_b">${selOpts(bosses, bosses[0]?.id)}</select>` : ''}
   <h3>Accesso al gestionale (facoltativo)</h3><label>Nome account</label><input id="n_u" autocomplete="off"><label>Password (min. 8)</label><input id="n_p" type="password" autocomplete="new-password">`, async () => {
    const name = $('#n_n').value.trim(); if (!name) throw new Error('Inserisci il nome');
    const u = $('#n_u').value.trim(), pw = $('#n_p').value;
    if (u && pw.length < 8) throw new Error('Password di almeno 8 caratteri');
    const row = (await api('POST', '/api/admin/staff', { name, role: $('#n_r').value.trim(), active: true, ...(A.owner ? { boss_id: $('#n_b').value } : {}) })).row;
    if (u) await api('PUT', '/api/admin/staff/' + row.id + '/account', { username: u, password: pw });
    return true;
  }, 'Crea');
}
function delStaff(id) { if (confirm('Eliminare questa persona e il suo listino?')) act(() => api('DELETE', '/api/admin/staff/' + id)); }

/* ---------- GALLERIA ---------- */
function pgGalleria() {
  return `<label class="drop" style="display:block">📷 <b>Trascina qui le foto</b> oppure clicca per sceglierle<br><span class="mu">JPG, PNG o WEBP · si ridimensionano da sole</span>
   <input type="file" accept="image/*" multiple hidden onchange="galUp(this.files)"></label>
  ${A.gallery.length ? `<div class="gal">${A.gallery.map((g, i) => `<div class="g"><img src="${esc(g.url)}" alt=""><input placeholder="Didascalia" value="${esc(g.caption)}" onchange="galCap('${g.id}',this.value)">
   <div style="display:flex;gap:4px"><button class="btn sec sm" ${i ? '' : 'disabled'} onclick="galMove(${i},-1)">◀</button><button class="btn sec sm" ${i < A.gallery.length - 1 ? '' : 'disabled'} onclick="galMove(${i},1)">▶</button>
   <button class="btn del sm" style="margin-left:auto" onclick="galDel('${g.id}')">Elimina</button></div></div>`).join('')}</div>` : '<div class="card mu">Nessuna foto. Carica i lavori del salone: compariranno nella pagina Galleria del sito.</div>'}`;
}
function galUp(files) {
  act(async () => { let n = A.gallery.length; for (const f of files) { const url = await pickImage(f); await api('POST', '/api/admin/gallery', { url, sort: ++n }); } toast('Foto caricate'); });
}
const galCap = (id, v) => act(() => api('PATCH', '/api/admin/gallery/' + id, { caption: v }));
const galDel = id => { if (confirm('Eliminare la foto?')) act(() => api('DELETE', '/api/admin/gallery/' + id)); };
function galMove(i, d) {
  const a = A.gallery[i], b = A.gallery[i + d]; if (!b) return;
  act(async () => { const sa = i + 1, sb = i + d + 1; await api('PATCH', '/api/admin/gallery/' + a.id, { sort: sb }); await api('PATCH', '/api/admin/gallery/' + b.id, { sort: sa }); });
}
document.addEventListener('dragover', e => e.preventDefault());
document.addEventListener('drop', e => { if (PAGE === 'galleria' && e.dataTransfer.files.length) { e.preventDefault(); galUp(e.dataTransfer.files); } });

/* ---------- IMPOSTAZIONI ---------- */
function pgImpostazioni() {
  const s = A.shop;
  return `<div class="card"><h2>Dati del negozio</h2><p class="mu">Compaiono sul sito pubblico.</p>
   <div class="row"><div><label>Nome</label><input id="s_name" value="${esc(s.name)}"></div><div><label>Sottotitolo</label><input id="s_tagline" value="${esc(s.tagline)}"></div></div>
   <div class="row"><div><label>Città</label><input id="s_city" value="${esc(s.city)}"></div><div><label>Email</label><input id="s_email" value="${esc(s.email)}"></div></div>
   <label>Indirizzo</label><input id="s_address" value="${esc(s.address)}">
   <div class="row"><div><label>Telefono</label><input id="s_phone" value="${esc(s.phone)}"></div><div><label>WhatsApp (cifre con prefisso, es. 39333…)</label><input id="s_whatsapp" value="${esc(s.whatsapp)}"></div><div><label>Valuta</label><input id="s_currency" value="${esc(s.currency)}" maxlength="3"></div></div>
   <h3>Orari di apertura</h3>
   ${[1, 2, 3, 4, 5, 6, 0].map(i => { const h = s.hours[i]; return `<div class="item"><span style="width:100px">${DAYS[i]}</span><label style="display:flex;align-items:center"><input type="checkbox" id="h_c${i}" ${h.closed ? 'checked' : ''}>chiuso</label>
    <span><input type="time" id="h_o${i}" value="${h.open}" style="width:120px;display:inline"> – <input type="time" id="h_f${i}" value="${h.close}" style="width:120px;display:inline"></span></div>`; }).join('')}
   <h3>Giorni di chiusura (ferie, festivi)</h3><div id="clos">${(s.closures || []).map((c, i) => `<div class="row" style="margin-bottom:4px"><input type="date" class="cl_d" value="${c.date}"><input class="cl_l" value="${esc(c.label)}" placeholder="Motivo"><button class="btn del sm" style="flex:0" onclick="this.parentElement.remove()">✕</button></div>`).join('')}</div>
   <button class="btn sec sm" onclick="addClosure()">+ Aggiungi giorno di chiusura</button>
   <h3>Prenotazioni e abbonamenti</h3><div class="row"><div><label>Intervallo orari (minuti)</label><input id="s_slot" type="number" min="10" step="5" value="${s.slot_step}"></div>
    <div><label>Prezzo abbonamento</label><input id="s_sp" type="number" min="0" value="${s.subPrice}"></div><div><label>Utilizzi inclusi</label><input id="s_su" type="number" min="1" value="${s.subUses}"></div></div>
   <h3>Messaggi</h3><div class="row"><div><label>Ora invio email promemoria</label><input id="s_rh" type="number" min="0" max="23" value="${s.reminder_hour}"></div></div>
   <label>Testo WhatsApp promemoria <span class="mu">({nome} {data} {ora} {servizio} {negozio})</span></label><textarea id="s_wa" rows="3">${esc(s.wa_template)}</textarea>
   <label>Testo WhatsApp auguri compleanno <span class="mu">({nome} {negozio})</span></label><textarea id="s_bd" rows="2">${esc(s.bd_template)}</textarea>
   <button class="btn" onclick="saveShop()">Salva impostazioni</button></div>
  <div class="card"><h2>Cambia password</h2><div class="row"><div><label>Password attuale</label><input id="pw_o" type="password"></div><div><label>Nuova password (min. 8)</label><input id="pw_n" type="password"></div></div>
   <button class="btn" onclick="chPw()">Aggiorna password</button></div>
  <div class="card"><h2>Stato del sistema</h2><p>Database: <b>${esc(A.status.storage)}</b> ${A.status.supabase ? '<span class="tag ok">Supabase collegato</span>' : '<span class="tag ko">modalità locale: imposta SUPABASE_URL e SUPABASE_SERVICE_KEY nel file .env</span>'}</p>
   <p>Email promemoria: ${A.status.resend ? '<span class="tag ok">Resend attivo</span>' : '<span class="tag ko">non attive (manca RESEND_API_KEY)</span>'}</p></div>
  ${A.owner ? `<div class="card"><h2>Dati di prova</h2><p class="mu">Per provare il gestionale: crea <b>50 clienti</b> registrati con <b>30 appuntamenti già fatti</b> (giorni passati), <b>10 appuntamenti</b> nei prossimi giorni e <b>10 abbonamenti</b>. Sono segnati "DATI DI PROVA" e le loro email sono finte, quindi non partono email vere. Se li crei di nuovo vengono rigenerati con date aggiornate.</p>
   <button class="btn" onclick="testData('create')">Crea dati di prova</button> <button class="btn del" onclick="testData('remove')">Elimina dati di prova</button></div>` : ''}`;
}
function testData(action) {
  if (action === 'remove' && !confirm('Eliminare tutti i clienti, appuntamenti e abbonamenti di prova?')) return;
  act(async () => {
    const r = await api('POST', '/api/admin/test-data', { action });
    if (action === 'remove') toast(`Eliminati ${r.removed.clients} clienti, ${r.removed.appointments} appuntamenti, ${r.removed.subscriptions} abbonamenti`);
    else toast(`Creati ${r.created.clients} clienti · ${r.created.passati} appuntamenti passati · ${r.created.futuri} in arrivo · ${r.created.abbonamenti} abbonamenti`);
  });
}
function addClosure() {
  const d = document.createElement('div'); d.className = 'row'; d.style.marginBottom = '4px';
  d.innerHTML = `<input type="date" class="cl_d"><input class="cl_l" placeholder="Motivo"><button class="btn del sm" style="flex:0" onclick="this.parentElement.remove()">✕</button>`;
  $('#clos').append(d);
}
function saveShop() {
  const b = { hours: [], closures: [] };
  for (const k of ['name', 'tagline', 'city', 'address', 'phone', 'whatsapp', 'email', 'currency']) b[k] = $('#s_' + k).value;
  for (let i = 0; i < 7; i++) b.hours.push({ closed: $('#h_c' + i).checked, open: $('#h_o' + i).value, close: $('#h_f' + i).value });
  document.querySelectorAll('#clos .row').forEach(r => { const d = r.querySelector('.cl_d').value; if (d) b.closures.push({ date: d, label: r.querySelector('.cl_l').value }); });
  Object.assign(b, { slot_step: $('#s_slot').value, subPrice: $('#s_sp').value, subUses: $('#s_su').value, reminder_hour: $('#s_rh').value, wa_template: $('#s_wa').value, bd_template: $('#s_bd').value });
  act(async () => { await api('PUT', '/api/admin/shop', b); toast('Impostazioni salvate'); });
}
function chPw() {
  api('POST', '/api/admin/password', { old: $('#pw_o').value, new: $('#pw_n').value }).then(() => { toast('Password aggiornata'); $('#pw_o').value = $('#pw_n').value = ''; }).catch(e => toast(e.message, true));
}

/* ---------- login e avvio ---------- */
function pgLogin() {
  const own = PANEL === 'owner';
  $('#app').innerHTML = `<div id="login"><div class="card"><h2 style="font-size:28px;margin-bottom:4px">${own ? 'Pannello owner' : 'Area riservata'}</h2><p class="mu" style="margin-top:0">${own ? 'Accesso riservato al proprietario' : 'Accesso per titolari e dipendenti'}</p>
   ${own ? '<input id="lu" type="hidden" value="owner">' : '<label>Account</label><input id="lu" autocomplete="username" autocapitalize="none" onchange="loginState()" onkeydown="if(event.key===\'Enter\')$(\'#lp\').focus()">'}
   <label id="lpl">Password</label><input id="lp" type="password" autocomplete="current-password" onkeydown="if(event.key==='Enter')doLogin()">
   <button class="btn" onclick="doLogin()">Accedi</button><a class="btn sec" href="/" style="text-decoration:none;display:inline-block">← Sito</a>
   <div id="lerr" class="down" style="margin-top:10px"></div></div></div>`;
}
async function loginState() {
  const u = $('#lu').value.trim(); if (!u) return;
  const r = await api('GET', '/api/login-state?username=' + encodeURIComponent(u)).catch(() => ({}));
  $('#lpl').textContent = r.needsSetup ? 'Primo accesso: scegli una password (min. 8 caratteri)' : 'Password'; $('#lerr').textContent = '';
}
const homeFor = role => role === 'owner' ? '/owner/' : '/admin/';
async function doLogin() {
  try {
    const r = await api('POST', '/api/login', { username: $('#lu').value.trim(), password: $('#lp').value });
    if (PANEL === 'owner' && r.role !== 'owner') { await api('POST', '/api/logout').catch(() => { }); throw new Error('Questo accesso è riservato al pannello owner'); }
    location.href = homeFor(r.role);
  } catch (e) { $('#lerr').textContent = e.message; }
}

const PAGES = { index: pgIndex, appuntamenti: pgAppuntamenti, clienti: pgClienti, abbonamenti: pgAbbonamenti, guadagni: pgGuadagni, storico: pgStorico, messaggi: pgMessaggi, email: pgEmail, servizi: pgServizi, team: pgTeam, galleria: pgGalleria, impostazioni: pgImpostazioni };
function draw() {
  const y = scrollY; const f = document.activeElement?.id;
  shell(PAGES[PAGE]());
  scrollTo(0, y);
}
(async () => {
  if (PAGE === 'login') {
    try { const me = await api('GET', '/api/me'); if ((me.role === 'owner') === (PANEL === 'owner')) { location.href = homeFor(me.role); return; } } catch { }
    return pgLogin();
  }
  try { await load(); } catch { return; }
  if (A.owner && PANEL !== 'owner') return void (location.href = '/owner/');
  if (!A.owner && PANEL === 'owner') return void (location.href = '/admin/');
  if (A.emp && PAGE !== 'appuntamenti') return void (location.href = '/admin/appuntamenti');
  draw();
  setInterval(async () => { // aggiorna le prenotazioni online in arrivo, senza disturbare chi sta scrivendo
    if (document.hidden || document.querySelector('.ov')) return;
    const a = document.activeElement; if (a && /INPUT|TEXTAREA|SELECT/.test(a.tagName)) return;
    try { const n = A.appts.length; await load(); if (A.appts.length !== n) { draw(); toast('Nuove prenotazioni'); } } catch { }
  }, 20000);
})();
