# Sito + gestionale per Enrico & Grazia

Nessuna installazione: serve solo Node.js (v18+).

    node server.js

- Sito:        http://localhost:3000
- Pannello:    http://localhost:3000/admin   titolari e dipendenti
- Owner:       http://localhost:3000/owner   solo il proprietario

## Chi può fare cosa
| Accesso | Account | Cosa vede |
|---|---|---|
| **Owner** | `owner` (password iniziale `owner1020`, cambiala con l'icona 🔑) | Tutto: incassi di tutti, tabella *Incassi per titolare* (Enrico / Grazia / ogni dipendente), tutte le funzioni |
| **Titolare** | `Errico10`, `Grazia86` (password scelta al primo accesso) | Solo i **propri** incassi e quelli dei **propri dipendenti** (Enrico non vede Grazia e viceversa). Crea i dipendenti e dà loro un accesso dalla sezione *Team* |
| **Dipendente** | creato dal titolare (o dall'owner) | Solo gli **appuntamenti** propri, senza prezzi né incassi. I permessi sono controllati dal server, non solo nascosti nel browser |

Soraya e Chiara sono collegate a Enrico, Alessia a Grazia. L'owner può cambiare il titolare di riferimento quando aggiunge un dipendente.

## Struttura
    barber-sito/
    ├── server.js            avvio, API, prenotazioni, login, caricamento foto
    ├── lib/
    │   ├── store.js         database (Supabase oppure file locale)
    │   └── mail.js          promemoria email con Resend
    ├── supabase/
    │   └── schema.sql       tabelle da creare su Supabase
    ├── public/              tutto ciò che vede il browser
    │   ├── index, servizi, team, galleria, prenota, contatti (.html)   sito
    │   ├── admin/           pannello titolari/dipendenti (una pagina per sezione)
    │   ├── owner/           pannello owner (stesse pagine, vede tutto)
    │   ├── assets/
    │   │   ├── css/         site.css, admin.css
    │   │   ├── js/          site.js, admin.js
    │   │   └── img/         logo.png, swirl.png, favicon.png
    │   └── uploads/         foto caricate dal pannello (galleria, team)
    ├── data/
    │   ├── db.json          dati in modalità locale (senza Supabase)
    │   └── backups/         copie di sicurezza
    ├── .env.example         copia in .env per configurare Supabase e Resend
    └── README.md

## 1. Collegare Supabase
1. Crea un progetto su https://supabase.com
2. **SQL Editor** → incolla il contenuto di `supabase/schema.sql` → Run (crea tabelle e bucket `media` per le foto; se avevi già le tabelle aggiunge le colonne nuove: si può rieseguire)
3. **Project Settings → API**: copia *Project URL* e la chiave **service_role**
4. Copia `.env.example` in `.env` e incolla i due valori
5. Riavvia `node server.js`: deve scrivere `Database: Supabase`

La chiave service_role resta solo sul server (mai nel browser). Le tabelle hanno RLS attiva e nessuna policy: dall'esterno non sono leggibili.

## Prenotazione online
Pagina `/prenota` in 4 passi: **Servizio → Operatore** (o *Nessuna preferenza* = primo libero) **→ Giorno e orario** (verde libero, rosso occupato) **→ Dati** (nome, cognome, telefono, email, note). A fine prenotazione il cliente riceve un codice.

## 2. Attivare le email (Resend)
1. Crea un account su https://resend.com, crea una API key e (per scrivere ai clienti) verifica il tuo dominio
2. In `.env` imposta `RESEND_API_KEY` e `RESEND_FROM`
3. Riavvia: `Promemoria email: attivi`. Ogni giorno, dall'ora scelta in *Impostazioni*, parte l'email per gli appuntamenti di domani (solo se il cliente ha lasciato l'email). Dalla sezione *Promemoria* puoi anche inviarle a mano.

## WhatsApp
Nessuna API: in *Promemoria* ogni appuntamento ha il pulsante **Invia WhatsApp**: si apre WhatsApp con il testo già scritto (modificabile in *Impostazioni*) e premi tu invio.

## Messa online
Il server va ospitato su un servizio Node (Render, Railway, Fly.io, VPS…). Imposta le variabili del `.env` nel pannello del servizio, `HOST=0.0.0.0` e `NODE_ENV=production` (con https). Con Supabase i dati restano al sicuro anche se il server si riavvia; le foto vanno su Supabase Storage.
