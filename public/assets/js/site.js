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
const avatar = s => `<div class="av">${s.photo ? `<img loading="lazy" decoding="async" width="400" height="500" src="${esc(s.photo)}" alt="${esc(s.name)}, ${esc(s.role || 'team')}">` : initial(s.name)}</div>`;

// dati di contatto: i campi vuoti o d'esempio (solo zeri / @esempio.it) non vengono mostrati
const hasNum = v => /[1-9]/.test(v || '');
const hasMail = s => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.email || '') && !/@esempio\./i.test(s.email);
const mapsUrl = s => s.maps || 'https://maps.google.com/?q=' + encodeURIComponent(s.address);
const phoneLink = s => hasNum(s.phone) ? `<a href="tel:${esc(s.phone.replace(/[^\d+]/g, ''))}">${esc(s.phone)}</a>` : '';
const mailLink = s => hasMail(s) ? `<a href="mailto:${esc(s.email)}">${esc(s.email)}</a>` : '';
const waLink = s => hasNum(s.whatsapp) ? `<a href="https://wa.me/${esc(s.whatsapp)}" target="_blank" rel="noopener">WhatsApp</a>` : '';
const socialLinks = s => (s.instagram ? `<a href="${esc(s.instagram)}" target="_blank" rel="noopener">Instagram</a>` : '') + (s.facebook ? `<a href="${esc(s.facebook)}" target="_blank" rel="noopener">Facebook</a>` : '');

const PAGES = [['/', 'Home', 'home'], ['/servizi', 'Servizi', 'servizi'], ['/team', 'Team', 'team'], ['/galleria', 'Galleria', 'galleria'], ['/contatti', 'Contatti', 'contatti']];

/* ---------- animazioni: apertura del sito (una volta per sessione) e dissolvenza tra le pagine ---------- */
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
try {
  if (!reduceMotion && page === 'home' && !sessionStorage.getItem('intro')) {
    sessionStorage.setItem('intro', '1');
    const el = document.createElement('div');
    el.className = 'intro';
    el.innerHTML = '<b class="cu l"></b><b class="cu r"></b><div class="mk"><div class="glow"></div><img src="/assets/img/logo.png" alt=""><i></i></div>';
    document.body.append(el);
    document.documentElement.classList.add('introing');
    let gone = false;
    const end = () => {
      if (gone) return; gone = true;
      el.classList.add('out');
      setTimeout(() => { el.remove(); document.documentElement.classList.remove('introing'); }, 1100);
    };
    el.addEventListener('click', end);
    setTimeout(end, 2000);
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

if ('serviceWorker' in navigator) addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => { }));
Promise.all([fetch('/api/public').then(r => r.json()), fetch('/api/account/me').then(r => r.json()).catch(() => ({}))]).then(([d, m]) => { D = d; ME = m.account || null; MYAPPTS = m.appointments || []; start(); })
  .catch(() => { $('#main').innerHTML = '<div class="wrap" style="padding:120px 24px;text-align:center"><h2>Servizio momentaneamente non disponibile</h2><p class="mu" style="margin:10px 0 26px">Stiamo avendo un problema tecnico. Riprova tra qualche minuto.</p><button class="bt" onclick="location.reload()">Riprova</button></div>'; });

function start() {
  const s = D.shop;
  seo(s);
  $('#hdr').innerHTML = `<header class="hd"><div class="in"><a class="logo" href="/"><img src="/assets/img/logo.png" width="640" height="326" alt="${esc(s.name)} ${esc(s.tagline)} a ${esc(s.city)}"></a>
    <button class="burger" aria-label="Menu" onclick="document.querySelector('.nav').classList.toggle('open')">☰</button>
    <nav class="nav">${PAGES.map(([h, l, k]) => `<a href="${h}" class="${page === k ? 'on' : ''}">${l}</a>`).join('')}<a href="/account" class="${page === 'account' ? 'on' : ''}" data-acc>${accLabel()}</a><a class="bt sm" style="color:#fff" href="/prenota">Prenota</a></nav></div></header>`;
  $('#ftr').innerHTML = `<footer class="ft"><div class="wrap"><div class="g">
    <div><img class="flogo" src="/assets/img/logo.png" width="640" height="326" loading="lazy" alt="${esc(s.name)}"><p>${esc(s.tagline)}<br>${esc(s.address)}</p></div>
    <div><h4>Pagine</h4>${PAGES.map(([h, l]) => `<a href="${h}">${l}</a>`).join('')}<a href="/prenota">Prenota</a></div>
    <div><h4>Contatti</h4>${phoneLink(s)}${mailLink(s)}${waLink(s)}${socialLinks(s)}</div></div>
    <div class="c"><span>© ${new Date().getFullYear()} ${esc(s.name)}</span><a href="/admin" style="display:inline;margin:0">Area riservata</a></div></div></footer>`;
  document.body.insertAdjacentHTML('beforeend', bottomNav());
  ({ home, servizi, team, galleria, prenota, contatti, account }[page] || (() => { }))();
  const io = new IntersectionObserver(e => e.forEach(x => { if (x.isIntersecting) { x.target.classList.add('in'); io.unobserve(x.target); } }), { threshold: .08 });
  document.querySelectorAll('.fade').forEach(el => io.observe(el));
}

/* ---------- SEO: dati strutturati schema.org (HairSalon) generati dalle impostazioni del salone ---------- */
function seo(s) {
  try {
    const dn = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'], o = location.origin;
    const m = /^(.*?),\s*(\d{5})\s+([^()]+?)(?:\s*\((\w{2})\))?\s*$/.exec(s.address || '');
    const ld = {
      '@context': 'https://schema.org', '@type': 'HairSalon', '@id': o + '/#salone', name: s.name + ' ' + s.tagline, url: o + '/',
      image: o + '/assets/img/team.jpg', logo: o + '/assets/img/logo.png', priceRange: '€€', areaServed: s.city,
      address: m ? { '@type': 'PostalAddress', streetAddress: m[1], postalCode: m[2], addressLocality: m[3].trim(), addressRegion: m[4] || '', addressCountry: 'IT' } : { '@type': 'PostalAddress', streetAddress: s.address, addressLocality: s.city, addressCountry: 'IT' },
      openingHoursSpecification: [0, 1, 2, 3, 4, 5, 6].filter(i => s.hours[i] && !s.hours[i].closed).map(i => ({ '@type': 'OpeningHoursSpecification', dayOfWeek: dn[i], opens: s.hours[i].open, closes: s.hours[i].close })),
      hasMap: mapsUrl(s), sameAs: [s.instagram, s.facebook].filter(Boolean),
    };
    if (hasNum(s.phone)) ld.telephone = s.phone;
    if (hasMail(s)) ld.email = s.email;
    const el = document.createElement('script'); el.type = 'application/ld+json'; el.textContent = JSON.stringify(ld);
    document.head.append(el);
  } catch { }
}

/* ---------- blocchi riutilizzabili ---------- */
const hoursHtml = () => {
  const t = new Date().getDay();
  return `<div class="hrs">${[1, 2, 3, 4, 5, 6, 0].map(i => { const h = D.shop.hours[i]; return `<div class="r ${i === t ? 'today' : ''}"><span>${DAYS[i]}</span><span class="${h.closed ? 'cl' : ''}">${h.closed ? 'Chiuso' : h.open + ' – ' + h.close}</span></div>`; }).join('')}</div>`;
};
const teamHtml = () => D.staff.length ? `<div class="team" style="--cd:${D.staff.length <= 4 ? D.staff.length : Math.ceil(D.staff.length / 2)}">${D.staff.map(s => `<div class="tm fade">${avatar(s)}<h3>${esc(s.name)}</h3><div class="role">${esc(s.role)}</div>${s.bio ? `<p>${esc(s.bio)}</p>` : ''}<a class="bt o sm" href="/prenota?staff=${s.id}">Prenota con ${esc(s.name.split(' ')[0])}</a></div>`).join('')}</div>` : '';
function galleryHtml(list) {
  if (!list.length) return '<div class="empty">La galleria sarà presto aggiornata con i nostri lavori.</div>';
  return `<div class="gal">${list.map((g, i) => `<div class="ph fade" onclick="lightbox(${i})"><img loading="lazy" decoding="async" src="${esc(g.url)}" alt="${esc(g.caption || 'Lavoro realizzato nel salone ' + D.shop.name + ' a ' + D.shop.city)}">${g.caption ? `<span>${esc(g.caption)}</span>` : ''}</div>`).join('')}</div>`;
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
    <a class="bt" href="/prenota">Prenota ora</a> <a class="bt o" href="/servizi">Scopri i servizi</a></div><div class="hero-ph"><div class="frame"><img src="/assets/img/team.jpg" width="960" height="868" alt="Enrico e Grazia, il team di ${esc(s.name)}" fetchpriority="high"></div><span class="badge">Enrico &amp; Grazia</span></div></div></section>
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
    <p><b>Indirizzo</b>${esc(s.address)}</p>${s.phone && hasNum(s.phone) ? `<p><b>Telefono</b><a href="tel:${esc(s.phone.replace(/[^\d+]/g, ''))}">${esc(s.phone)}</a></p>` : ''}
    <a class="bt o sm" href="${esc(mapsUrl(s))}" target="_blank" rel="noopener">Indicazioni</a></div></div></section>`;
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
    <p><b>Indirizzo</b>${esc(s.address)}</p>${s.phone && hasNum(s.phone) ? `<p><b>Telefono</b><a href="tel:${esc(s.phone.replace(/[^\d+]/g, ''))}">${esc(s.phone)}</a></p>` : ''}
    ${hasMail(s) ? `<p><b>Email</b><a href="mailto:${esc(s.email)}">${esc(s.email)}</a></p>` : ''}
    <a class="bt" href="${esc(mapsUrl(s))}" target="_blank" rel="noopener">Indicazioni</a>
    ${hasNum(s.whatsapp) ? `<a class="bt o" href="https://wa.me/${esc(s.whatsapp)}" target="_blank" rel="noopener">WhatsApp</a>` : ''}${s.instagram ? `<a class="bt o" href="${esc(s.instagram)}" target="_blank" rel="noopener">Instagram</a>` : ''}${s.facebook ? `<a class="bt o" href="${esc(s.facebook)}" target="_blank" rel="noopener">Facebook</a>` : ''}</div>
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
       <div class="bx"><h3 class="sh">I tuoi dati di contatto</h3>${accBanner()}<div id="be" class="down err"></div>
        <div class="row2"><div><label class="lb2">Nome *</label><input id="bn" autocomplete="given-name" maxlength="40" placeholder="Mario" value="${esc(ME?.name || '')}"></div><div><label class="lb2">Cognome *</label><input id="bs" autocomplete="family-name" maxlength="40" placeholder="Rossi" value="${esc(ME?.surname || '')}"></div></div>
        <label class="lb2">Numero di telefono (per conferma e promemoria) *</label><input id="bp" type="tel" autocomplete="tel" maxlength="30" placeholder="+39 340 1234567" value="${esc(ME?.phone || '')}">
        <label class="lb2">Indirizzo email (per la conferma) *</label><input id="bm" type="email" required autocomplete="email" maxlength="120" placeholder="mario.rossi@example.com" value="${esc(ME?.email || '')}">
        <label class="lb2">Note per l'operatore (facoltativo)</label><textarea id="bt" rows="2" maxlength="300" placeholder="Es. lunghezza desiderata, pelle sensibile…"></textarea>
        ${accCreate()}
        <button class="bt" style="width:100%;margin-top:18px" id="bgo" onclick="send()">Conferma definitiva prenotazione</button></div></div>` + backBtn(3);
  } else {
    const g = curGroup(), r = B.done;
    el.innerHTML = `<div class="okbox2"><div class="tick">✓</div><span class="lb2" style="text-align:center">Prenotazione confermata</span><h2>Ti aspettiamo in salone!</h2>
      <p class="mu">Il tuo appuntamento è stato registrato con successo.</p>
      <div class="code"><small>Codice prenotazione</small><b>${esc(r.code)}</b><span>Comunicalo se ci contatti per modificare o disdire.</span></div>
      <div class="bx" style="text-align:left">${[['Cliente', B.who], ['Servizio', g.name], ['Operatore', r.staff], ['Data e ora', longDate(B.date) + ' alle ' + B.slot], ['Prezzo', money(r.price)], ['Luogo', D.shop.address]].map(([k, v]) => `<div class="kv"><span>${k}:</span><b>${esc(v)}</b></div>`).join('')}</div>
      ${calBox()}
      ${B.acct === 'new' ? '<div class="acc-note ok">✓ Account creato: resti collegato su questo dispositivo e i tuoi dati saranno già compilati la prossima volta.</div>' : B.acct ? `<div class="acc-note">${esc(B.acct)}</div>` : ME ? '<div class="acc-note ok">Trovi questo appuntamento nel <a href="/account" style="text-decoration:underline">tuo account</a>.</div>' : ''}
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

/* ---------- account clienti: accesso che resta attivo + prenotazione con dati precompilati ---------- */
let ME = null, MYAPPTS = [];
const AUTH = { mode: 'login', cb: null };
const accLabel = () => ME ? esc(ME.name.split(' ')[0]) : 'Accedi';
const syncNav = () => document.querySelectorAll('[data-acc]').forEach(e => { e.textContent = ME ? ME.name.split(' ')[0] : 'Accedi'; });
const ICON = {
  user: '<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/></svg>',
  img: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2.5"/><circle cx="9" cy="10" r="1.8"/><path d="m21 16-5-5-8 9"/></svg>',
  cal: '<svg viewBox="0 0 24 24"><rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M8 3v4M16 3v4M3.5 10h17m-11 5 2 2 4-4"/></svg>',
  cut: '<svg viewBox="0 0 24 24"><circle cx="6" cy="6.5" r="2.8"/><circle cx="6" cy="17.5" r="2.8"/><path d="M8.2 8.2 20 18M8.2 15.8 20 6"/></svg>',
  users: '<svg viewBox="0 0 24 24"><circle cx="9" cy="8.5" r="3.5"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6M16 5.2a3.5 3.5 0 0 1 0 6.6M18 14.3c2.2.7 3.5 2.6 3.5 5.7"/></svg>',
};
// menu fisso in basso (telefono): Accedi · Galleria · [Prenota] · Servizi · Team
function bottomNav() {
  const it = (h, k, l, ic, acc) => `<a href="${h}" class="${page === k ? 'on' : ''}">${ic}<span ${acc ? 'data-acc' : ''}>${l}</span></a>`;
  return `<nav class="bn" aria-label="Menu principale">${it('/account', 'account', accLabel(), ICON.user, 1)}${it('/galleria', 'galleria', 'Galleria', ICON.img)}
    <a href="/prenota" class="bk ${page === 'prenota' ? 'on' : ''}"><i>${ICON.cal}</i><span>Prenota</span></a>${it('/servizi', 'servizi', 'Servizi', ICON.cut)}${it('/team', 'team', 'Team', ICON.users)}</nav>`;
}
async function refreshMe() {
  const m = await fetch('/api/account/me').then(r => r.json()).catch(() => ({}));
  ME = m.account || null; MYAPPTS = m.appointments || []; syncNav();
}
const authBox0 = mode => `<div class="acc-tabs"><button type="button" class="${mode === 'login' ? 'on' : ''}" onclick="authMode('login')">Accedi</button><button type="button" class="${mode === 'reg' ? 'on' : ''}" onclick="authMode('reg')">Crea account</button></div><div id="ae" class="down err"></div>
  ${mode === 'login'
    ? `<label class="lb2">Telefono o email</label><input id="al" autocomplete="username" maxlength="120" placeholder="+39 340 1234567">
       <label class="lb2">Password</label><input id="ap" type="password" autocomplete="current-password" maxlength="100" onkeydown="if(event.key==='Enter')doAuth('login')">
       <label class="rem"><input type="checkbox" id="ar" checked> Resta connesso su questo dispositivo</label>
       <button class="bt" type="button" style="width:100%;margin-top:14px" id="ago" onclick="doAuth('login')">Accedi</button>
       <button type="button" class="lnk forgot" onclick="authMode('forgot')">Password dimenticata?</button>`
    : `<div class="row2"><div><label class="lb2">Nome *</label><input id="rn" autocomplete="given-name" maxlength="40"></div><div><label class="lb2">Cognome *</label><input id="rs" autocomplete="family-name" maxlength="40"></div></div>
       <label class="lb2">Telefono *</label><input id="rp" type="tel" autocomplete="tel" maxlength="30" placeholder="+39 340 1234567">
       <label class="lb2">Email *</label><input id="rm" type="email" required autocomplete="email" maxlength="120">
       <label class="lb2">Password * (min. 8 caratteri)</label><input id="rw" type="password" autocomplete="new-password" maxlength="100" onkeydown="if(event.key==='Enter')doAuth('reg')">
       <label class="rem"><input type="checkbox" id="ar" checked> Resta connesso su questo dispositivo</label>
       <button class="bt" type="button" style="width:100%;margin-top:14px" id="ago" onclick="doAuth('reg')">Crea il mio account</button>`}`;
function authMode(m) { AUTH.mode = m; const b = $('#authbox'); if (b) b.innerHTML = authBox(m); }
async function doAuth(kind) {
  const v = id => ($(id)?.value || '').trim(), btn = $('#ago'), er = $('#ae');
  const body = kind === 'login' ? { id: v('#al'), password: $('#ap').value, remember: $('#ar').checked }
    : { name: v('#rn'), surname: v('#rs'), phone: v('#rp'), email: v('#rm'), password: $('#rw').value, remember: $('#ar').checked };
  btn.disabled = true; er.textContent = '';
  try {
    const r = await fetch('/api/account/' + (kind === 'login' ? 'login' : 'register'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { er.textContent = j.error || 'Errore'; btn.disabled = false; return; }
    await refreshMe();
    const cb = AUTH.cb; closeAuth();
    if (cb) cb(); else if (page === 'account') drawAccount();
  } catch { er.textContent = 'Connessione assente, riprova.'; btn.disabled = false; }
}
function openAuth(cb) {
  AUTH.cb = cb || null; closeAuth();
  const o = document.createElement('div'); o.className = 'amd'; o.id = 'amd';
  o.innerHTML = `<div class="amd-in" role="dialog" aria-modal="true"><button class="x" type="button" aria-label="Chiudi" onclick="closeAuth()">×</button><h3>Il tuo account</h3>
    <p class="mu" style="margin:6px 0 14px">Accedi o crea un account: i tuoi dati si compilano da soli e resti collegato.</p><div id="authbox">${authBox(AUTH.mode)}</div></div>`;
  o.addEventListener('click', e => { if (e.target === o) closeAuth(); });
  document.body.append(o);
}
function closeAuth() { document.getElementById('amd')?.remove(); }
async function logout() {
  await fetch('/api/account/logout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }).catch(() => { });
  ME = null; MYAPPTS = []; syncNav();
  if (page === 'account') drawAccount(); else if (page === 'prenota' && B.step === 4) wizard();
}
const STLAB = { booked: 'Confermato', done: 'Completato', noshow: 'Non presentato' };
const apptCard = a => `<div class="apt"><div class="d"><b>${+a.date.slice(8)}</b><small>${new Date(a.date + 'T12:00').toLocaleDateString('it-IT', { month: 'short' })}</small></div>
  <div class="in"><b>${esc(a.service_name)}</b><span>${esc(longDate(a.date))} · ${a.time}${a.staff ? ' · con ' + esc(a.staff) : ''}</span>${calMini(a)}</div><em class="stt ${a.status}">${STLAB[a.status] || ''}</em></div>`;
function account() {
  $('#main').innerHTML = `<div class="page-hd"><div class="eb">Area clienti</div><h1>Il tuo account</h1></div><section class="sec"><div class="wrap"><div class="acc" id="accv"></div></div></section>`;
  drawAccount();
}
function drawAccount() {
  const el = $('#accv'); if (!el) return;
  if (RESET) { el.innerHTML = resetCard(); return; }
  if (!ME) {
    el.innerHTML = `<div class="bx acc-in"><h3 class="sh">Accedi o registrati</h3><p class="mu" style="margin:0 0 6px">Con un account i tuoi dati si compilano da soli quando prenoti e resti collegato su questo telefono.</p><div id="authbox">${authBox(AUTH.mode)}</div></div>`;
    return;
  }
  const t = iso(new Date()), isUp = a => a.date >= t && a.status === 'booked';
  const up = MYAPPTS.filter(isUp).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)), past = MYAPPTS.filter(a => !isUp(a));
  el.innerHTML = `<div class="two"><div class="bx"><h3 class="sh">Ciao ${esc(ME.name)} 👋</h3><div id="pe" class="err down"></div>
    <div class="row2"><div><label class="lb2">Nome</label><input id="pn" value="${esc(ME.name)}" maxlength="40"></div><div><label class="lb2">Cognome</label><input id="ps" value="${esc(ME.surname)}" maxlength="40"></div></div>
    <label class="lb2">Telefono</label><input id="pp" type="tel" value="${esc(ME.phone)}" maxlength="30"><label class="lb2">Email</label><input id="pm" type="email" value="${esc(ME.email)}" maxlength="120">
    <button class="bt" type="button" style="width:100%;margin-top:16px" onclick="saveProfile()">Salva i miei dati</button>
    <button class="bt o" type="button" style="width:100%;margin-top:10px" onclick="logout()">Esci</button><p class="mu sm2" style="text-align:center">Resti collegato su questo dispositivo finché non esci.</p></div>
    <div><div class="bx" style="margin-top:0"><h3 class="sh">Prossimi appuntamenti</h3>${up.length ? up.map(apptCard).join('') : '<p class="mu" style="margin:0 0 14px">Nessun appuntamento in programma.</p><a class="bt" href="/prenota">Prenota ora</a>'}
      <p class="mu sm2" style="margin-top:12px">Per spostare o disdire chiamaci al ${esc(D.shop.phone)}.</p></div>
    ${past.length ? `<div class="bx"><h3 class="sh">Storico</h3>${past.slice(0, 10).map(apptCard).join('')}</div>` : ''}</div></div>`;
}
async function saveProfile() {
  const v = id => $(id).value.trim(), er = $('#pe'); er.textContent = '';
  const r = await fetch('/api/account/me', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: v('#pn'), surname: v('#ps'), phone: v('#pp'), email: v('#pm') }) }).catch(() => null);
  const j = r ? await r.json().catch(() => ({})) : {};
  if (!r || !r.ok) { er.textContent = j.error || 'Connessione assente, riprova.'; return; }
  ME = j.account; syncNav(); drawAccount();
  const o = document.querySelector('#accv .bx h3'); if (o) o.insertAdjacentHTML('afterend', '<div class="okmsg">✓ Dati salvati</div>');
}
// blocchi usati nel passo 4 della prenotazione
const accBanner = () => ME
  ? `<div class="acc-note ok">✓ Prenoti come <b>${esc(ME.name)} ${esc(ME.surname)}</b> · <button type="button" class="lnk" onclick="logout()">Non sei tu?</button></div>`
  : `<div class="acc-note">Hai già un account? <button type="button" class="lnk" onclick="openAuth(wizard)">Accedi</button> e i dati si compilano da soli.</div>`;
const accCreate = () => ME ? '' : `<label class="rem" style="margin-top:14px"><input type="checkbox" id="bacc" onchange="$('#bpwb').classList.toggle('hide',!this.checked)"> Crea un account per non reinserire i dati la prossima volta</label>
  <div id="bpwb" class="hide"><label class="lb2">Scegli una password (min. 8 caratteri)</label><input id="bpw" type="password" autocomplete="new-password" maxlength="100"></div>`;
async function send() {
  const v = id => $(id).value.trim(), err = m => { $('#bgo').disabled = false; $('#be').textContent = m; };
  $('#bgo').disabled = true; $('#be').textContent = '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v('#bm'))) return err('Inserisci un indirizzo email valido');
  const wantAcc = !ME && !!$('#bacc')?.checked, pw = $('#bpw')?.value || '';
  if (wantAcc && pw.length < 8) return err("Per creare l'account scegli una password di almeno 8 caratteri");
  const g = curGroup(), data = { name: v('#bn'), surname: v('#bs'), phone: v('#bp'), email: v('#bm') };
  try {
    const r = await fetch('/api/book', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ staff_id: B.staff, category: g.category, service_name: g.name, date: B.date, time: B.slot, ...data, notes: v('#bt') }) });
    const j = await r.json();
    if (r.ok) {
      B.done = j; B.who = data.name + ' ' + data.surname; B.step = 5; B.acct = '';
      B.ev = { title: g.name + ' · ' + D.shop.name, date: B.date, time: B.slot, minutes: j.minutes || 30, location: D.shop.address, uid: j.code,
        desc: 'Operatore: ' + j.staff + '\nCodice prenotazione: ' + j.code + '\nPer spostare o disdire chiama ' + D.shop.phone };
      if (wantAcc) { // crea l'account con gli stessi dati e resta collegato
        const a = await fetch('/api/account/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...data, password: pw, remember: true }) })
          .then(async x => ({ ok: x.ok, j: await x.json().catch(() => ({})) })).catch(() => ({ ok: false, j: {} }));
        if (a.ok) { await refreshMe(); B.acct = 'new'; } else B.acct = a.j.error || 'Account non creato';
      } else if (ME) await refreshMe();
      wizard(); return;
    }
    err(j.error || 'Errore');
    if (r.status === 409) setTimeout(() => { B.step = 3; B.slot = null; wizard(); }, 1500);
  } catch { err('Connessione assente, riprova.'); }
}

/* ---------- recupero password ---------- */
let RESET = new URLSearchParams(location.search).get('reset') || '';
const authBox = mode => mode === 'forgot' ? forgotBox() : authBox0(mode);
const forgotBox = () => `<div class="acc-tabs"><button type="button" onclick="authMode('login')">Accedi</button><button type="button" onclick="authMode('reg')">Crea account</button></div>
  <h4 class="fh">Recupera la password</h4><p class="mu" style="margin:0 0 4px">Scrivi l'email del tuo account: ti inviamo un link per sceglierne una nuova.</p><div id="ae" class="down err"></div>
  <label class="lb2">Email</label><input id="fe" type="email" autocomplete="email" maxlength="120" onkeydown="if(event.key==='Enter')doForgot()">
  <button class="bt" type="button" style="width:100%;margin-top:14px" id="ago" onclick="doForgot()">Invia il link</button>
  <button type="button" class="lnk forgot" onclick="authMode('login')">← Torna all'accesso</button>`;
async function doForgot() {
  const em = ($('#fe')?.value || '').trim(), btn = $('#ago'), er = $('#ae');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(em)) { er.textContent = 'Inserisci un indirizzo email valido'; return; }
  btn.disabled = true; er.textContent = '';
  try {
    const r = await fetch('/api/account/forgot', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: em }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { er.textContent = j.error || 'Errore'; btn.disabled = false; return; }
    $('#authbox').innerHTML = `<div class="acc-note ok" style="margin-top:14px">✓ Se esiste un account con <b>${esc(em)}</b>, ti abbiamo inviato un link per scegliere una nuova password. Controlla anche la cartella spam: il link vale 1 ora.</div>
      <button type="button" class="lnk forgot" onclick="authMode('login')">← Torna all'accesso</button>`;
  } catch { er.textContent = 'Connessione assente, riprova.'; btn.disabled = false; }
}
const resetCard = () => `<div class="bx acc-in"><h3 class="sh">Scegli una nuova password</h3><div id="ae" class="down err"></div>
  <label class="lb2">Nuova password (min. 8 caratteri)</label><input id="nw" type="password" autocomplete="new-password" maxlength="100">
  <label class="lb2">Ripeti la password</label><input id="nw2" type="password" autocomplete="new-password" maxlength="100" onkeydown="if(event.key==='Enter')doReset()">
  <button class="bt" type="button" style="width:100%;margin-top:16px" id="ago" onclick="doReset()">Salva e accedi</button></div>`;
async function doReset() {
  const pw = $('#nw').value, er = $('#ae'), btn = $('#ago');
  if (pw.length < 8) { er.textContent = 'La password deve avere almeno 8 caratteri'; return; }
  if (pw !== $('#nw2').value) { er.textContent = 'Le due password non coincidono'; return; }
  btn.disabled = true; er.textContent = '';
  try {
    const r = await fetch('/api/account/reset', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: RESET, password: pw }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      er.innerHTML = esc(j.error || 'Errore') + (r.status === 400 && /link/.test(j.error || '') ? ' <button type="button" class="lnk forgot" onclick="RESET=\'\';AUTH.mode=\'forgot\';history.replaceState(null,\'\',\'/account\');drawAccount()">Richiedi un nuovo link</button>' : '');
      btn.disabled = false; return;
    }
    RESET = ''; history.replaceState(null, '', '/account');
    await refreshMe(); drawAccount();
    document.querySelector('#accv .bx h3')?.insertAdjacentHTML('afterend', '<div class="okmsg">✓ Password aggiornata: sei collegato.</div>');
  } catch { er.textContent = 'Connessione assente, riprova.'; btn.disabled = false; }
}

/* ---------- aggiungi al calendario (Google Calendar e file .ics per Apple / Outlook) ---------- */
const calStamp = (date, time, plus = 0) => {
  const [y, m, d] = date.split('-').map(Number), [h, mi] = time.split(':').map(Number), t = new Date(y, m - 1, d, h, mi + plus), p = n => String(n).padStart(2, '0');
  return '' + t.getFullYear() + p(t.getMonth() + 1) + p(t.getDate()) + 'T' + p(t.getHours()) + p(t.getMinutes()) + '00';
};
const calEv = key => {
  if (key === 'new') return B.ev;
  const a = MYAPPTS.find(x => x.id === key); if (!a) return null;
  return { title: a.service_name + ' · ' + D.shop.name, date: a.date, time: a.time, minutes: a.minutes || 30, location: D.shop.address, uid: a.code || a.id,
    desc: (a.staff ? 'Operatore: ' + a.staff + '\n' : '') + (a.code ? 'Codice prenotazione: ' + a.code + '\n' : '') + 'Per spostare o disdire chiama ' + D.shop.phone };
};
const gcalUrl = ev => 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + encodeURIComponent(ev.title) + '&dates=' + calStamp(ev.date, ev.time) + '/' + calStamp(ev.date, ev.time, ev.minutes)
  + '&details=' + encodeURIComponent(ev.desc) + '&location=' + encodeURIComponent(ev.location) + '&ctz=Europe%2FRome';
function dlIcs(key) {
  const ev = calEv(key); if (!ev) return;
  const e = s => String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
  const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Voglia di//Prenotazioni//IT', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'BEGIN:VEVENT',
    'UID:' + (ev.uid || Date.now()) + '@vogliadi', 'DTSTAMP:' + new Date().toISOString().replace(/[-:]|\.\d{3}/g, ''),
    'DTSTART:' + calStamp(ev.date, ev.time), 'DTEND:' + calStamp(ev.date, ev.time, ev.minutes),
    'SUMMARY:' + e(ev.title), 'LOCATION:' + e(ev.location), 'DESCRIPTION:' + e(ev.desc), 'STATUS:CONFIRMED',
    'BEGIN:VALARM', 'TRIGGER:-P1D', 'ACTION:DISPLAY', 'DESCRIPTION:Domani hai un appuntamento', 'END:VALARM',
    'BEGIN:VALARM', 'TRIGGER:-PT1H', 'ACTION:DISPLAY', 'DESCRIPTION:Appuntamento tra un\'ora', 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'];
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([L.join('\r\n')], { type: 'text/calendar;charset=utf-8' }));
  a.download = 'appuntamento-voglia-di.ics'; document.body.append(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 3000);
}
const calBox = () => B.ev ? `<div class="calbox"><b>📅 Aggiungi al calendario</b><div class="calbtns"><a class="bt o sm" target="_blank" rel="noopener" href="${gcalUrl(B.ev)}">Google Calendar</a><button class="bt o sm" type="button" onclick="dlIcs('new')">Apple / Outlook</button></div></div>` : '';
const calMini = a => a.status === 'booked' && a.date >= iso(new Date()) && calEv(a.id)
  ? `<span class="calmini">📅 <a href="${gcalUrl(calEv(a.id))}" target="_blank" rel="noopener">Google</a> · <button type="button" class="lnk" onclick="dlIcs('${a.id}')">Apple / Outlook</button></span>` : '';
