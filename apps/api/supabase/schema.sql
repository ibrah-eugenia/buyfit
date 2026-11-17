-- Schéma Supabase minimal pour apps/api. À coller dans le SQL editor de Supabase.
-- Les noms de colonnes suivent packages/shared (snake_case côté SQL).

create table if not exists public.profiles (
  id                text primary key,             -- = auth.users.id une fois l'auth branchée
  photos            text[]  not null default '{}',
  taille            jsonb   not null default '{}', -- { haut, bas, pointure }
  mensurations      jsonb   not null default '{}', -- { hauteurCm, poitrineCm, tourDeTailleCm, hanchesCm }
  budget_max        numeric not null default 100,
  devise            text    not null default 'EUR',
  marques_preferees text[]  not null default '{}',
  comptes_marchands jsonb   not null default '[]', -- CompteMarchand[] — JAMAIS de mot de passe
  created_at        timestamptz not null default now()
);

create table if not exists public.orders (
  id             uuid primary key default gen_random_uuid(),
  user_id        text not null references public.profiles(id),
  product_id     text not null,
  product_url    text not null,
  taille         text not null,
  h_session_id   text,
  agent_view_url text,
  statut         text not null default 'en_attente'
                 check (statut in ('en_attente','en_cours','confirmation_requise','commandee','echec')),
  confirmed      boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- RLS activé : l'API utilise la clé service_role (bypass RLS). Le front (apps/web) passe
-- par la clé anon + policies ci-dessous.
alter table public.profiles enable row level security;
alter table public.orders   enable row level security;

create policy "profil: lecture/écriture par son propriétaire" on public.profiles
  for all using (auth.uid()::text = id) with check (auth.uid()::text = id);

create policy "commandes: lecture par son propriétaire" on public.orders
  for select using (auth.uid()::text = user_id);

insert into public.profiles (id, photos, taille, budget_max, marques_preferees, comptes_marchands)
values ('demo-user',
        '{https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=768}',
        '{"haut":"M","bas":"38","pointure":"39"}', 80,
        '{Zara,Mango,COS}', '[{"marchand":"Zara","domaine":"zara.com"}]')
on conflict (id) do nothing;
