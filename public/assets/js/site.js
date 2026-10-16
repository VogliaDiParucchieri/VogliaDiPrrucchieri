/* Sito pubblico: header, footer e pagine (home, servizi, team, galleria, prenota, contatti) */
const CATS = { uomo: 'Uomo', donna: 'Donna', estetica: 'Estetica' };
const DAYS = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
let D = null; // dati pubblici
const money = n => (D?.shop.currency || '$') + (Math.round(n * 100) / 100).toLocaleString('it-IT');
const page = document.body.dataset.page;
const initial = s => esc((s || '?').trim()[0]?.toUpperCase());
const avatar = s => `<div class="av" ${s.photo ? `style="background-image:url('${esc(s.photo)}')"` : ''}>${s.photo ? '' : initial(s.name)}</div>`;

const PAGES = [['/', 'Home', 'home'], ['/servizi', 'Servizi', 'servizi'], ['/team', 'Team', 'team'], ['/galleria', 'Galleria', 'galleria'], ['/contatti', 'Contatti', 'contatti']];

/* ---------- animazioni: apertura del sito (una volta per sessione) e dissolvenza tra le pagine ---------- */
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
try {
  if (!reduceMotion && page === 'home' && !sessionStorage.getItem('intro')) {
    sessionStorage.setItem('intro', '1');
    const el = document.createElement('div');
    el.className = 'intro';
    el.innerHTML = '<img src="/assets/img/logo.png" alt=""><i></i>';
    document.body.append(el);
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 700); }, 1500);
  }
} catch { }
document.addEventListener('click', e => {
  const a = e.target.closest?.('a[href]');
  if (!a || e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || reduceMotion) return;
  const u = new URL(a.href, location.href);
  if (u.origin !== location.origin || a.target === '_blank' || a.hasAttribute('download') || /^\/(admin|owner|api)(\/|$)/.test(u.pathname)) return;
  if (u.pathname === location.pathname && u.search === location.search) return;
  e.preventDefault();
  document.body.classList.add('leaving');
  setTimeout(() => { location.href = u.href; }, 280);
});
addEventListener('pageshow', e => { if (e.persisted) document.body.classList.remove('leaving'); });

fetch('/api/public').then(r => r.json()).then(d => { D = d; start(); })
  .catch(() => { $('#main').innerHTML = '<div class="wrap" style="padding:120px 24px;text-align:center"><h2>Servizio momentaneamente non disponibile</h2><p class="mu" style="margin:10px 0 26px">Stiamo avendo un problema tecnico. Riprova tra qualche minuto.</p><button class="bt" onclick="location.reload()">Riprova</button></div>'; });

function start() {
  const s = D.shop;
  document.title = (page === 'home' ? '' : ({ servizi: 'Servizi', team: 'Il team', galleria: 'Galleria', prenota: 'Prenota', contatti: 'Contatti' }[page] + ' · ')) + s.name;
  $('#hdr').innerHTML = `<header class="hd"><div class="in"><a class="logo" href="/"><img src="/assets/img/logo.png" alt="${esc(s.name)} ${esc(s.tagline)}"></a>
    <button class="burger" aria-label="Menu" onclick="document.querySelector('.nav').classList.toggle('open')">☰</button>
    <nav class="nav">${PAGES.map(([h, l, k]) => `<a href="${h}" class="${page === k ? 'on' : ''}">${l}</a>`).join('')}<a class="bt sm" style="color:#fff" href="/prenota">Prenota</a></nav></div></header>`;
  $('#ftr').innerHTML = `<footer class="ft"><div class="wrap"><div class="g">
    <div><img class="flogo" src="/assets/img/logo.png" alt="${esc(s.name)}"><p>${esc(s.tagline)}<br>${esc(s.address)}</p></div>
    <div><h4>Pagine</h4>${PAGES.map(([h, l]) => `<a href="${h}">${l}</a>`).join('')}<a href="/prenota">Prenota</a></div>
    <div><h4>Contatti</h4><a href="tel:${esc(s.phone.replace(/\s/g, ''))}">${esc(s.phone)}</a><a href="mailto:${esc(s.email)}">${esc(s.email)}</a><a href="https://wa.me/${esc(s.whatsapp)}" target="_blank" rel="noopener">WhatsApp</a></div></div>
    <div class="c"><span>© ${new Date().getFullYear()} ${esc(s.name)}</span><a href="/admin" style="display:inline;margin:0">Area riservata</a></div></div></footer>`;
  ({ home, servizi, team, galleria, prenota, contatti }[page] || (() => { }))();
  const io = new IntersectionObserver(e => e.forEach(x => { if (x.isIntersecting) { x.target.classList.add('in'); io.unobserve(x.target); } }), { threshold: .08 });
  document.querySelectorAll('.fade').forEach(el => io.observe(el));
}

/* ---------- blocchi riutilizzabili ---------- */
const hoursHtml = () => {
  const t = new Date().getDay();
  return `<div class="hrs">${[1, 2, 3, 4, 5, 6, 0].map(i => { const h = D.shop.hours[i]; return `<div class="r ${i === t ? 'today' : ''}"><span>${DAYS[i]}</span><span class="${h.closed ? 'cl' : ''}">${h.closed ? 'Chiuso' : h.open + ' – ' + h.close}</span></div>`; }).join('')}</div>`;
};
const teamHtml = () => D.staff.length ? `<div class="team">${D.staff.map(s => `<div class="tm fade">${avatar(s)}<h3>${esc(s.name)}</h3><div class="role">${esc(s.role)}</div>${s.bio ? `<p>${esc(s.bio)}</p>` : ''}<a class="bt o sm" href="/prenota?staff=${s.id}">Prenota con ${esc(s.name)}</a></div>`).join('')}</div>` : '';
function galleryHtml(list) {
  if (!list.length) return '<div class="empty">La galleria sarà presto aggiornata con i nostri lavori.</div>';
  return `<div class="gal">${list.map((g, i) => `<div class="ph fade" onclick="lightbox(${i})"><img loading="lazy" src="${esc(g.url)}" alt="${esc(g.caption || 'Lavoro del salone')}">${g.caption ? `<span>${esc(g.caption)}</span>` : ''}</div>`).join('')}</div>`;
}
function lightbox(i) {
  const g = D.gallery[i], el = document.createElement('div');
  el.className = 'lb'; el.innerHTML = `<img src="${esc(g.url)}" alt="">`;
  el.onclick = () => el.remove(); document.body.append(el);
  document.addEventListener('keydown', function k(e) { if (e.key === 'Escape') { el.remove(); document.removeEventListener('keydown', k); } });
}
function serviceLists(cat) {
  // i prezzi sono uguali per tutti gli operatori: un solo elenco, senza duplicati
  const seen = new Set();
  const l = D.services.filter(x => {
    if (x.category !== cat || seen.has(x.name.toLowerCase())) return false;
    seen.add(x.name.toLowerCase());
    return true;
  });
  if (!l.length) return '<div class="empty" style="grid-column:1/-1">Nessun servizio in questa categoria.</div>';
  return `<div class="sv fade" style="grid-column:1/-1;max-width:640px;margin:0 auto;width:100%">
    ${l.map(x => `<div class="r"><span>${esc(x.name)}<small>${x.minutes} minuti</small></span><b>${money(x.price)}</b></div>`).join('')}</div>`;
}

/* ---------- pagine ---------- */
function home() {
  const s = D.shop, cats = Object.keys(CATS).filter(c => D.services.some(x => x.category === c));
  $('#main').innerHTML = `
  <section class="hero"><div class="wrap"><div>
    <div class="eb">${esc(s.city)}</div>
    <h1>Voglia di<br><em>sentirti</em> al meglio.</h1>
    <p>Parrucchieri per donna e uomo, estetica e nail art in un unico posto. Scegli il servizio, il giorno e l'orario: prenoti in pochi secondi.</p>
    <a class="bt" href="/prenota">Prenota ora</a> <a class="bt o" href="/servizi">Scopri i servizi</a></div><div class="pole"></div></div></section>
  <div class="perks"><div><b>Prenotazione online</b><span>Orari sempre aggiornati, 24 ore su 24</span></div>
    <div><b>Professioniste e professionisti</b><span>Hair stylist ed estetiste qualificate</span></div><div><b>Capelli · Unghie · Estetica</b><span>Tutto il benessere in un unico posto</span></div></div>
  <section class="sec"><div class="wrap ctr"><div class="eb">Listino</div><h2 class="title">I nostri servizi</h2>
    <p class="lead">Una selezione dei trattamenti più richiesti. Il listino completo è nella pagina Servizi.</p>
    <div class="cols" style="text-align:left">${cats.map(c => {
      const l = D.services.filter(x => x.category === c).slice(0, 4);
      return `<div class="sv fade"><h3><span>${CATS[c]}</span><a href="/servizi">Tutti →</a></h3>${l.map(x => `<div class="r"><span>${esc(x.name)}<small>${x.minutes} minuti</small></span><b>${money(x.price)}</b></div>`).join('')}</div>`;
    }).join('')}</div></div></section>
  <section class="sec alt"><div class="wrap ctr"><div class="eb">Chi siamo</div><h2 class="title">Il nostro team</h2><p class="lead">Persone, prima ancora che professionisti.</p>${teamHtml()}</div></section>
  ${D.gallery.length ? `<section class="sec"><div class="wrap ctr"><div class="eb">Galleria</div><h2 class="title">I nostri lavori</h2><div style="text-align:left">${galleryHtml(D.gallery.slice(0, 6))}</div><p style="margin-top:30px"><a class="bt o" href="/galleria">Vedi tutta la galleria</a></p></div></section>` : ''}
  <section class="sec dark"><div class="wrap cta"><h2>Pronto per un nuovo look?</h2><p>Scegli il tuo orario, ci pensiamo noi al resto.</p><a class="bt" href="/prenota">Prenota il tuo appuntamento</a></div></section>
  <section class="sec"><div class="wrap ct"><div><div class="eb">Quando trovarci</div><h2 class="title" style="font-size:34px">Orari</h2>${hoursHtml()}</div>
    <div class="info"><div class="eb">Dove siamo</div><h2 class="title" style="font-size:34px">Contatti</h2>
    <p><b>Indirizzo</b>${esc(s.address)}</p><p><b>Telefono</b><a href="tel:${esc(s.phone.replace(/\s/g, ''))}">${esc(s.phone)}</a></p>
    <a class="bt o sm" href="https://maps.google.com/?q=${encodeURIComponent(s.address)}" target="_blank" rel="noopener">Indicazioni</a></div></div></section>`;
}

function servizi() {
  const cats = Object.keys(CATS).filter(c => D.services.some(x => x.category === c));
  const want = new URLSearchParams(location.search).get('cat');
  let cur = cats.includes(want) ? want : cats[0];
  $('#main').innerHTML = `<div class="page-hd"><div class="eb">Listino</div><h1>I nostri servizi</h1></div>
   <section class="sec"><div class="wrap"><div class="tabs" id="tb"></div><div class="cols" id="sl"></div>
   <p class="ctr" style="margin-top:40px"><a class="bt" href="/prenota">Prenota ora</a></p></div></section>`;
  const draw = () => {
    $('#tb').innerHTML = cats.map(c => `<button class="${c === cur ? 'on' : ''}" data-c="${c}">${CATS[c]}</button>`).join('');
    $('#tb').querySelectorAll('button').forEach(b => b.onclick = () => { cur = b.dataset.c; draw(); });
    $('#sl').innerHTML = serviceLists(cur);
    document.querySelectorAll('.fade').forEach(el => el.classList.add('in'));
  };
  draw();
}

function team() {
  $('#main').innerHTML = `<div class="page-hd"><div class="eb">Chi siamo</div><h1>Il nostro team</h1></div>
   <section class="sec"><div class="wrap">${teamHtml() || '<div class="empty">Presto online.</div>'}</div></section>`;
}

function galleria() {
  $('#main').innerHTML = `<div class="page-hd"><div class="eb">Portfolio</div><h1>Galleria</h1></div><section class="sec"><div class="wrap">${galleryHtml(D.gallery)}</div></section>`;
}

function contatti() {
  const s = D.shop;
  $('#main').innerHTML = `<div class="page-hd"><div class="eb">Dove siamo</div><h1>Contatti</h1></div>
   <section class="sec"><div class="wrap ct"><div class="info">
    <p><b>Indirizzo</b>${esc(s.address)}</p><p><b>Telefono</b><a href="tel:${esc(s.phone.replace(/\s/g, ''))}">${esc(s.phone)}</a></p>
    <p><b>Email</b><a href="mailto:${esc(s.email)}">${esc(s.email)}</a></p>
    <a class="bt" href="https://maps.google.com/?q=${encodeURIComponent(s.address)}" target="_blank" rel="noopener">Indicazioni</a>
    <a class="bt o" href="https://wa.me/${esc(s.whatsapp)}" target="_blank" rel="noopener">WhatsApp</a></div>
   <div><h2 class="title" style="font-size:30px;margin-bottom:10px">Orari di apertura</h2>${hoursHtml()}</div></div></section>`;
}

/* ---------- prenotazione guidata (4 passi: servizio → operatore → giorno e ora → dati) ---------- */
let B = { step: 1 };
const rangeTxt = (a, b, f) => a === b ? f(a) : 'da ' + f(Math.min(a, b));
function svcGroups() {
  const m = new Map();
  D.services.filter(x => !B.pre || x.staff_id === B.pre).forEach(x => {
    const k = x.category + '|' + x.name.trim().toLowerCase();
    if (!m.has(k)) m.set(k, { key: k, category: x.category, name: x.name, items: [] });
    m.get(k).items.push(x);
  });
  return [...m.values()].map(g => ({
    ...g, staff: g.items.map(i => D.staff.find(s => s.id === i.staff_id)).filter(Boolean),
    pmin: Math.min(...g.items.map(i => +i.price)), pmax: Math.max(...g.items.map(i => +i.price)),
    mmin: Math.min(...g.items.map(i => +i.minutes)), mmax: Math.max(...g.items.map(i => +i.minutes)),
  }));
}
const curGroup = () => svcGroups().find(g => g.key === B.svc);
const staffOf = () => B.staff === 'any' ? null : D.staff.find(s => s.id === B.staff);
const staffName = () => B.staff === 'any' ? 'Primo disponibile' : staffOf()?.name;
const priceTxt = g => rangeTxt(g.pmin, g.pmax, money);
const minTxt = g => g.mmin === g.mmax ? g.mmin + ' minuti' : g.mmin + '–' + g.mmax + ' minuti';
function prenota() {
  $('#main').innerHTML = `<div class="page-hd"><div class="eb">Appuntamenti</div><h1>Prenota online</h1><p class="mu" style="margin:10px 0 0">Prenotazione in 4 passi, sempre disponibile.</p></div><section class="sec"><div class="wrap"><div class="bk2" id="bk"></div></div></section>`;
  const q = new URLSearchParams(location.search);
  if (D.staff.some(s => s.id === q.get('staff'))) B.pre = q.get('staff');
  wizard();
}
const navSteps = () => `<div class="stp">${['Servizio', 'Operatore', 'Giorno e ora', 'Dati'].map((l, i) => `<span class="${i + 1 === B.step ? 'on' : i + 1 < B.step ? 'done' : ''}"><b>${i + 1}</b>${l}</span>`).join('')}</div>`;
const head = (n, t, sub, back, backLbl) => `${navSteps()}<div class="bh"><div><h2>Passo ${n}: ${t}</h2><p>${sub}</p></div>${back ? `<button class="lnk" onclick="B.step=${back};wizard()">← ${backLbl}</button>` : ''}</div>`;
const backBtn = n => `<div style="margin-top:22px"><button class="bt o sm" onclick="B.step=${n};wizard()">← Indietro</button></div>`;
const longDate = s => new Date(s + 'T12:00').toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });
const photoOf = (s, big) => `<div class="pf ${big ? 'big' : ''}" ${s.photo ? `style="background-image:url('${esc(s.photo)}')"` : ''}>${s.photo ? '' : initial(s.name)}</div>`;
function wizard() {
  const el = $('#bk');
  if (B.step === 1) {
    const groups = svcGroups(), cats = Object.keys(CATS).filter(c => groups.some(g => g.category === c));
    const c = cats.includes(B.cat) ? B.cat : cats[0];
    el.innerHTML = head(1, 'Seleziona il servizio', B.pre ? `Prenotazione con <b>${esc(D.staff.find(s => s.id === B.pre)?.name)}</b>` : 'Scegli il trattamento: ti guidiamo passo dopo passo.', 0, '') +
      (B.pre ? `<button class="lnk" style="margin-bottom:14px" onclick="B.pre=null;B.svc=null;wizard()">× Vedi i servizi di tutto il team</button>` : '') +
      (cats.length > 1 ? `<div class="tabs" style="justify-content:flex-start;margin-bottom:18px">${cats.map(k => `<button class="${k === c ? 'on' : ''}" onclick="B.cat='${k}';wizard()">${CATS[k]}</button>`).join('')}</div>` : '') +
      `<div class="cards c3">${groups.filter(g => g.category === c).map(g => `<div class="cd ${B.svc === g.key ? 'on' : ''}" onclick="pickSvc('${g.key}')">
        <div><div class="ct"><h3>${esc(g.name)}</h3><span class="pc">${priceTxt(g)}</span></div>
        <p>${g.staff.length ? 'Con ' + g.staff.map(s => esc(s.name.split(' ')[0])).join(', ') : ''}</p></div>
        <div class="cf"><span>◷ ${minTxt(g)}</span><i>${B.svc === g.key ? 'Selezionato' : 'Scegli'}</i></div></div>`).join('') || '<div class="empty" style="grid-column:1/-1">Nessun servizio disponibile.</div>'}</div>`;
  } else if (B.step === 2) {
    const g = curGroup(), many = g.staff.length > 1;
    el.innerHTML = head(2, 'Scegli il tuo operatore', `Servizio: <b>${esc(g.name)}</b> (${minTxt(g)} • ${priceTxt(g)})`, 1, 'Cambia servizio') +
      `<div class="cards c4">${many ? `<div class="cd ctr2 ${B.staff === 'any' ? 'on' : ''}" onclick="pickStaff('any')"><div><div class="pf big any">✦</div><h3>Nessuna preferenza</h3><small>Primo disponibile</small>
         <p>Massima flessibilità: ti assegniamo il primo professionista libero.</p></div><i>${B.staff === 'any' ? 'Selezionato' : 'Scegli'}</i></div>` : ''}
       ${g.staff.map(s => `<div class="cd ctr2 ${B.staff === s.id ? 'on' : ''}" onclick="pickStaff('${s.id}')"><div>${photoOf(s, 1)}<h3>${esc(s.name)}</h3><small>${esc(s.role)}</small>
         <p>${esc(s.bio || '')}</p><p class="pc2">${money(g.items.find(i => i.staff_id === s.id).price)} · ${g.items.find(i => i.staff_id === s.id).minutes} min</p></div><i>${B.staff === s.id ? 'Selezionato' : 'Scegli'}</i></div>`).join('')}</div>` + backBtn(1);
  } else if (B.step === 3) {
    const g = curGroup(), days = [], now = new Date();
    for (let i = 0; i < 28; i++) days.push(new Date(now.getFullYear(), now.getMonth(), now.getDate() + i));
    const why = d => { const cl = (D.shop.closures || []).find(c => c.date === iso(d)); return cl ? (cl.label || 'Chiuso') : D.shop.hours[d.getDay()].closed ? 'Chiuso' : ''; };
    el.innerHTML = head(3, 'Seleziona giorno e orario', `Operatore: <b>${esc(staffName())}</b> • Servizio: <b>${esc(g.name)}</b> (${minTxt(g)})`, 2, 'Cambia operatore') +
      `<label class="lb2">1. Scegli il giorno</label><div class="dys">${days.map(d => `<button type="button" ${why(d) ? 'disabled' : ''} class="${B.date === iso(d) ? 'on' : ''}" onclick="B.date='${iso(d)}';B.slot=null;wizard()">
        <small>${d.toLocaleDateString('it-IT', { weekday: 'short' })}</small><b>${d.getDate()}</b><small>${why(d) || d.toLocaleDateString('it-IT', { month: 'short' })}</small></button>`).join('')}</div>
      <div class="bx"><div class="bxh"><div><label class="lb2" style="margin:0">2. Scegli l'orario${B.date ? ' · ' + esc(longDate(B.date)) : ''}</label><p>Orari ogni ${D.shop.slot_step || 30} minuti.</p></div>
        <div class="lg"><span class="dot g"></span>Disponibile <span class="dot r"></span>Occupato</div></div><div id="sl">${B.date ? '<p class="mu">Verifica disponibilità in corso…</p>' : '<p class="mu">Scegli un giorno per vedere gli orari.</p>'}</div></div>` + backBtn(2);
    if (B.date) loadSlots(g);
  } else if (B.step === 4) {
    const g = curGroup();
    el.innerHTML = head(4, 'Riepilogo e dati personali', 'Controlla i dettagli e inserisci i tuoi recapiti per la conferma.', 3, 'Modifica orario') +
      `<div class="two"><div class="bx"><h3 class="sh">Dettagli prenotazione</h3>
        ${[['Trattamento', g.name], ['Operatore', staffName()], ['Data', longDate(B.date)], ['Orario di inizio', B.slot], ['Durata prevista', minTxt(g)], ['Luogo', D.shop.address]].map(([k, v]) => `<div class="kv"><span>${k}:</span><b>${esc(v)}</b></div>`).join('')}
        <div class="tot"><span>Prezzo totale al salone</span><b>${priceTxt(g)}</b></div><p class="mu sm2">Pagamento diretto in negozio (contanti o carta)</p></div>
       <div class="bx"><h3 class="sh">I tuoi dati di contatto</h3><div id="be" class="down err"></div>
        <div class="row2"><div><label class="lb2">Nome *</label><input id="bn" autocomplete="given-name" maxlength="40" placeholder="Mario"></div><div><label class="lb2">Cognome *</label><input id="bs" autocomplete="family-name" maxlength="40" placeholder="Rossi"></div></div>
        <label class="lb2">Numero di telefono (per conferma e promemoria) *</label><input id="bp" type="tel" autocomplete="tel" maxlength="30" placeholder="+39 340 1234567">
        <label class="lb2">Indirizzo email (facoltativo)</label><input id="bm" type="email" autocomplete="email" maxlength="120" placeholder="mario.rossi@example.com">
        <label class="lb2">Note per l'operatore (facoltativo)</label><textarea id="bt" rows="2" maxlength="300" placeholder="Es. lunghezza desiderata, pelle sensibile…"></textarea>
        <button class="bt" style="width:100%;margin-top:18px" id="bgo" onclick="send()">Conferma definitiva prenotazione</button></div></div>` + backBtn(3);
  } else {
    const g = curGroup(), r = B.done;
    el.innerHTML = `<div class="okbox2"><div class="tick">✓</div><span class="lb2" style="text-align:center">Prenotazione confermata</span><h2>Ti aspettiamo in salone!</h2>
      <p class="mu">Il tuo appuntamento è stato registrato con successo.</p>
      <div class="code"><small>Codice prenotazione</small><b>${esc(r.code)}</b><span>Comunicalo se ci contatti per modificare o disdire.</span></div>
      <div class="bx" style="text-align:left">${[['Cliente', B.who], ['Servizio', g.name], ['Operatore', r.staff], ['Data e ora', longDate(B.date) + ' alle ' + B.slot], ['Prezzo', money(r.price)], ['Luogo', D.shop.address]].map(([k, v]) => `<div class="kv"><span>${k}:</span><b>${esc(v)}</b></div>`).join('')}</div>
      <p class="mu">Per disdire o spostare chiamaci al ${esc(D.shop.phone)}.</p>
      <button class="bt" onclick="B={step:1,pre:B.pre};wizard()">Nuova prenotazione</button></div>`;
  }
  scrollTo({ top: Math.max(0, el.getBoundingClientRect().top + scrollY - 100), behavior: 'smooth' });
}
function pickSvc(k) {
  B.svc = k; B.date = null; B.slot = null;
  const g = curGroup();
  if (B.pre) { B.staff = B.pre; B.step = 3; } else if (g.staff.length === 1) { B.staff = g.staff[0].id; B.step = 2; } else B.step = 2;
  wizard();
}
function pickStaff(id) { B.staff = id; B.date = null; B.slot = null; B.step = 3; wizard(); }
async function loadSlots(g) {
  const url = `/api/slots?staff=${encodeURIComponent(B.staff)}&date=${B.date}&cat=${g.category}&name=${encodeURIComponent(g.name)}`;
  const r = await fetch(url).then(r => r.json()).catch(() => ({}));
  const box = $('#sl'); if (!box) return;
  box.innerHTML = r.slots && r.slots.length
    ? `<div class="slots2">${r.slots.map(s => `<button type="button" ${s.ok ? '' : 'disabled'} class="${s.ok ? 'ok' : 'ko'} ${B.slot === s.time ? 'on' : ''}" title="${s.ok ? 'Disponibile alle ' + s.time : 'Non disponibile (' + (s.reason || 'occupato') + ')'}" onclick="B.slot='${s.time}';B.step=4;wizard()"><span class="dot ${s.ok ? 'g' : 'r'}"></span>${s.time}</button>`).join('')}</div>`
    : '<div class="empty" style="border:0">Nessun orario di apertura disponibile per la data selezionata.<br><small>Il negozio potrebbe essere chiuso per riposo settimanale o festività.</small></div>';
}
async function send() {
  const v = id => $(id).value.trim();
  $('#bgo').disabled = true; $('#be').textContent = '';
  const g = curGroup();
  try {
    const r = await fetch('/api/book', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ staff_id: B.staff, category: g.category, service_name: g.name, date: B.date, time: B.slot, name: v('#bn'), surname: v('#bs'), phone: v('#bp'), email: v('#bm'), notes: v('#bt') }) });
    const j = await r.json();
    if (r.ok) { B.done = j; B.who = v('#bn') + ' ' + v('#bs'); B.step = 5; wizard(); return; }
    $('#bgo').disabled = false; $('#be').textContent = j.error || 'Errore';
    if (r.status === 409) setTimeout(() => { B.step = 3; B.slot = null; wizard(); }, 1500);
  } catch { $('#bgo').disabled = false; $('#be').textContent = 'Connessione assente, riprova.'; }
}
