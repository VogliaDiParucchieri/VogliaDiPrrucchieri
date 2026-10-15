// Promemoria via email con Resend (https://resend.com). Funziona appena imposti RESEND_API_KEY.
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const isoDate = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const tomorrow = () => { const d = new Date(); d.setDate(d.getDate() + 1); return isoDate(d); };
const longDate = s => new Date(s + 'T12:00:00').toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });
const validEmail = e => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e || '');

function reminderHtml(shop, a, staffName) {
  return `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#1a1a1a">
  <h2 style="font-family:Georgia,serif;margin-bottom:4px">${esc(shop.name)}</h2>
  <p>Ciao <b>${esc((a.client_name || '').split(' ')[0])}</b>,<br>ti ricordiamo il tuo appuntamento di <b>domani</b>:</p>
  <div style="border:1px solid #e7e1d8;padding:16px;background:#fdfcfb">
    <b>${esc(longDate(a.date))}</b> alle <b>${esc(a.time)}</b><br>
    ${esc(a.service_name)}${staffName ? ' con ' + esc(staffName) : ''}
  </div>
  <p>${esc(shop.address)}<br>Per disdire o spostare chiamaci al ${esc(shop.phone)}.</p>
  <p style="color:#777;font-size:12px">A domani!</p></div>`;
}

// Invia i promemoria per gli appuntamenti di domani che non lo hanno ancora ricevuto.
async function sendReminders(store, env, date = tomorrow()) {
  const key = env.RESEND_API_KEY;
  if (!key) return { configured: false, sent: 0, noEmail: 0, errors: [], date };
  const shop = store.get('settings', 'shop').value;
  const from = env.RESEND_FROM || 'Barber Studio <onboarding@resend.dev>';
  let sent = 0, noEmail = 0;
  const errors = [];
  const list = store.rows('appointments').filter(a => a.status === 'booked' && a.date === date && !a.reminder_email_sent);
  for (const a of list) {
    const c = store.get('clients', a.client_id);
    if (!c || !validEmail(c.email)) { noEmail++; continue; }
    try {
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from, to: [c.email],
          subject: `Promemoria: domani alle ${a.time} da ${shop.name}`,
          html: reminderHtml(shop, a, store.get('staff', a.staff_id)?.name),
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

module.exports = { sendReminders, startScheduler, tomorrow, isoDate };
