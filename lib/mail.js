// Promemoria via email con Resend (https://resend.com). Funziona appena imposti RESEND_API_KEY.
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const isoDate = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const tomorrow = () => { const d = new Date(); d.setDate(d.getDate() + 1); return isoDate(d); };
const longDate = s => new Date(s + 'T12:00:00').toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });
// gli indirizzi @example.* (usati nei dati di prova) non sono consegnabili: li scartiamo per non rovinare la reputazione del mittente
const validEmail = e => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e || '') && !/@example\.[a-z]+$/i.test(e);
const resendUrl = env => (env.RESEND_API_URL || 'https://api.resend.com').replace(/\/$/, '');
const BRAND = 'Voglia di parrucchieri';
const DEFAULT_FROM = BRAND + ' <onboarding@resend.dev>';
const siteUrl = () => (process.env.SITE_URL || 'https://www.vogliadiparrucchieri.shop').replace(/\/$/, '');
const addrOf = from => (/<([^>]+)>/.exec(from || '') || [, from])[1];
// intestazione scura (il logo ha parti bianche) con logo: l'immagine deve avere un URL pubblico assoluto
const header = () => `<div style="background:#1a1a1a;padding:22px;text-align:center"><img src="${siteUrl()}/assets/img/logo.png" alt="${BRAND}" width="170" style="display:inline-block;max-width:170px;height:auto;border:0"></div>`;
// versione testuale + reply-to: aiutano a non finire nello spam
const extras = (shop, from, text) => {
  const rt = (shop.email && validEmail(shop.email) ? shop.email : '') || addrOf(from);
  return { text, reply_to: rt };
};
const footerText = shop => `${BRAND}${shop.address ? ' - ' + shop.address : ''}${shop.phone ? ' - Tel. ' + shop.phone : ''}`;

/* ---------- email libere ai clienti (dalla schermata "Email" del pannello) ---------- */
const fill = (t, v) => String(t).replace(/\{(\w+)\}/g, (_, k) => v[k] ?? '');
const campaignText = (shop, message, client) =>
  fill(message, { nome: (client?.name || '').split(' ')[0], negozio: BRAND }) + '\n\n--\n' + footerText(shop) +
  '\nRicevi questa email perche sei nostro cliente. Se non vuoi piu riceverne, rispondi a questo messaggio.';
function campaignHtml(shop, message, client) {
  const body = esc(fill(message, { nome: (client?.name || '').split(' ')[0], negozio: BRAND })).replace(/\r?\n/g, '<br>');
  return `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#1a1a1a;line-height:1.55">
  ${header()}
  <div style="font-size:15px;padding:24px 8px 0">${body}</div>
  <hr style="border:none;border-top:1px solid #e7e1d8;margin:28px 0 14px">
  <p style="color:#777;font-size:12px;margin:0">${esc(BRAND)}${shop.address ? ' · ' + esc(shop.address) : ''}${shop.phone ? '<br>Tel. ' + esc(shop.phone) : ''}<br>
  Ricevi questa email perché sei nostro cliente. Se non vuoi più riceverne, rispondi a questo messaggio o contattaci.</p></div>`;
}
async function resendBatch(env, payload) {
  const r = await fetch(resendUrl(env) + '/emails/batch', {
    method: 'POST', headers: { Authorization: 'Bearer ' + env.RESEND_API_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  });
  if (!r.ok) throw new Error(r.status + ' ' + (await r.text()).slice(0, 200));
}
// Invia la stessa email (personalizzata con {nome}) a una lista di clienti. Max 500 destinatari per richiesta.
async function sendCampaign(store, env, { subject, message, clientIds, testTo }) {
  if (!env.RESEND_API_KEY) return { configured: false, sent: 0, skipped: 0, errors: [] };
  const shop = store.get('settings', 'shop').value, from = env.RESEND_FROM || DEFAULT_FROM;
  const sub = String(subject || '').trim().slice(0, 150), msg = String(message || '').trim().slice(0, 5000);
  if (!sub || !msg) throw Object.assign(new Error('Scrivi oggetto e messaggio'), { code: 400 });
  let targets, skipped = 0;
  if (testTo) {
    if (!validEmail(testTo)) throw Object.assign(new Error('Indirizzo email di prova non valido'), { code: 400 });
    targets = [{ name: 'Test', email: testTo }];
  } else {
    const seen = new Set();
    targets = [];
    for (const id of [...new Set(clientIds || [])].slice(0, 500)) {
      const c = store.get('clients', id), k = (c?.email || '').trim().toLowerCase();
      if (!c || !validEmail(k) || seen.has(k)) { skipped++; continue; }
      seen.add(k); targets.push({ name: c.name, email: c.email.trim() });
    }
  }
  let sent = 0;
  const errors = [];
  for (let i = 0; i < targets.length; i += 100) {
    const chunk = targets.slice(i, i + 100);
    try {
      await resendBatch(env, chunk.map(c => ({
        from, to: [c.email], subject: testTo ? '[TEST] ' + sub : sub, html: campaignHtml(shop, msg, c),
        headers: { 'List-Unsubscribe': `<mailto:${addrOf(from)}?subject=Annulla%20iscrizione>` },
        ...extras(shop, from, campaignText(shop, msg, c)),
      })));
      sent += chunk.length;
    } catch (e) { errors.push(`Invio di ${chunk.length} email fallito: ${e.message}`); }
  }
  return { configured: true, sent, skipped, errors };
}

function reminderHtml(shop, a, staffName) {
  return `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#1a1a1a">
  ${header()}
  <p style="margin-top:22px">Ciao <b>${esc((a.client_name || '').split(' ')[0])}</b>,<br>ti ricordiamo il tuo appuntamento di <b>domani</b>:</p>
  <div style="border:1px solid #e7e1d8;padding:16px;background:#fdfcfb">
    <b>${esc(longDate(a.date))}</b> alle <b>${esc(a.time)}</b><br>
    ${esc(a.service_name)}${staffName ? ' con ' + esc(staffName) : ''}
  </div>
  <p>${esc(shop.address)}<br>Per disdire o spostare chiamaci al ${esc(shop.phone)}.</p>
  <p style="color:#777;font-size:12px">A domani!<br>${esc(BRAND)}</p></div>`;
}
const reminderText = (shop, a, staffName) =>
  `Ciao ${(a.client_name || '').split(' ')[0]},\nti ricordiamo il tuo appuntamento di domani:\n\n${longDate(a.date)} alle ${a.time}\n${a.service_name}${staffName ? ' con ' + staffName : ''}\n\n${shop.address || ''}\nPer disdire o spostare chiamaci al ${shop.phone || ''}.\n\nA domani!\n${BRAND}`;

// Invia i promemoria per gli appuntamenti di domani che non lo hanno ancora ricevuto.
async function sendReminders(store, env, date = tomorrow()) {
  const key = env.RESEND_API_KEY;
  if (!key) return { configured: false, sent: 0, noEmail: 0, errors: [], date };
  const shop = store.get('settings', 'shop').value;
  const from = env.RESEND_FROM || DEFAULT_FROM;
  let sent = 0, noEmail = 0;
  const errors = [];
  const list = store.rows('appointments').filter(a => a.status === 'booked' && a.date === date && !a.reminder_email_sent);
  for (const a of list) {
    const c = store.get('clients', a.client_id);
    if (!c || !validEmail(c.email)) { noEmail++; continue; }
    try {
      const r = await fetch(resendUrl(env) + '/emails', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from, to: [c.email],
          subject: `Promemoria: domani alle ${a.time} da ${BRAND}`,
          html: reminderHtml(shop, a, store.get('staff', a.staff_id)?.name),
          ...extras(shop, from, reminderText(shop, a, store.get('staff', a.staff_id)?.name)),
        }),
      });
      if (!r.ok) throw new Error(r.status + ' ' + (await r.text()).slice(0, 200));
      await store.update('appointments', a.id, { reminder_email_sent: true });
      sent++;
    } catch (e) { errors.push(`${c.name}: ${e.message}`); }
  }
  return { configured: true, sent, noEmail, errors, date };
}

// Controlla ogni 15 minuti: una volta al giorno, dall'ora impostata, invia i promemoria.
function startScheduler(store, env) {
  if (!env.RESEND_API_KEY) { console.log('Promemoria email: disattivati (manca RESEND_API_KEY)'); return; }
  const tick = async () => {
    try {
      const shop = store.get('settings', 'shop').value;
      const now = new Date(), today = isoDate(now);
      const meta = store.get('settings', 'meta');
      if (now.getHours() < (+shop.reminder_hour || 10) || (meta && meta.value.last_reminder === today)) return;
      const r = await sendReminders(store, env);
      console.log('Promemoria email:', JSON.stringify(r));
      const value = { ...(meta ? meta.value : {}), last_reminder: today };
      if (meta) await store.update('settings', 'meta', { value });
      else await store.insert('settings', { id: 'meta', value });
    } catch (e) { console.error('Scheduler promemoria:', e.message); }
  };
  setInterval(tick, 15 * 60 * 1000);
  setTimeout(tick, 5000);
  console.log('Promemoria email: attivi');
}

module.exports = { sendReminders, sendCampaign, campaignHtml, startScheduler, tomorrow, isoDate };
