-- Incolla tutto questo nel "SQL Editor" di Supabase ed esegui (Run).
-- Le tabelle sono protette (RLS attiva, nessuna policy): solo il server, con la
-- service_role key, può leggerle e scriverle. NON usare mai la service key nel browser.

create table if not exists staff (
  id text primary key,
  name text not null,
  role text default '',
  bio text default '',
  photo text default '',
  active boolean default true,
  is_owner boolean default false,
  boss_id text default '',          -- titolare di cui è dipendente (vuoto per i titolari)
  sort integer default 0,
  created_at timestamptz default now()
);

create table if not exists services (
  id text primary key,
  staff_id text not null,
  category text not null check (category in ('uomo','donna','estetica')),
  name text not null,
  price numeric default 0,
  minutes integer default 30,
  active boolean default true,
  created_at timestamptz default now()
);

create table if not exists clients (
  id text primary key,
  name text not null,
  phone text default '',
  email text default '',
  birthday text default '',
  notes text default '',
  created_at timestamptz default now()
);

create table if not exists appointments (
  id text primary key,
  client_id text,
  client_name text default '',
  staff_id text not null,
  service_id text default '',
  service_name text default '',
  category text default 'uomo',
  price numeric default 0,
  minutes integer default 30,
  date text not null,               -- AAAA-MM-GG
  time text not null,               -- HH:MM
  status text default 'booked',     -- booked | done | cancelled | noshow
  source text default 'admin',      -- admin | online
  notes text default '',
  seen boolean default true,
  from_sub boolean default false,
  wa_sent boolean default false,
  reminder_email_sent boolean default false,
  booking_code text default '',     -- codice mostrato al cliente dopo la prenotazione online
  created_at timestamptz default now()
);
create index if not exists appointments_date_idx on appointments (date);

create table if not exists subscriptions (
  id text primary key,
  client_id text not null,
  staff_id text default '',
  start_date text not null,
  price numeric default 0,
  total integer default 4,
  uses jsonb default '[]'::jsonb,   -- elenco date di utilizzo
  created_at timestamptz default now()
);

create table if not exists gallery (
  id text primary key,
  url text not null,
  caption text default '',
  sort integer default 0,
  created_at timestamptz default now()
);

create table if not exists settings (
  id text primary key,              -- 'shop', 'meta'
  value jsonb not null default '{}'::jsonb
);

create table if not exists admins (
  id text primary key,              -- username
  username text not null,
  pass text,                        -- hash scrypt (vuoto = da impostare al primo accesso)
  staff_id text default '',         -- vuoto per l'owner
  role text default 'titolare'      -- titolare | dipendente | owner
);

-- Se avevi già creato le tabelle, queste righe aggiungono le colonne nuove (puoi rieseguire tutto senza problemi):
alter table staff add column if not exists boss_id text default '';
alter table appointments add column if not exists booking_code text default '';
alter table admins add column if not exists role text default 'titolare';
alter table admins alter column staff_id drop not null;
alter table admins alter column staff_id set default '';

alter table staff enable row level security;
alter table services enable row level security;
alter table clients enable row level security;
alter table appointments enable row level security;
alter table subscriptions enable row level security;
alter table gallery enable row level security;
alter table settings enable row level security;
alter table admins enable row level security;

-- Bucket per le foto della galleria e del team (pubblico in lettura):
insert into storage.buckets (id, name, public) values ('media', 'media', true)
on conflict (id) do nothing;
