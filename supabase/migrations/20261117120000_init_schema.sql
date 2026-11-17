-- =============================================================================
-- BuyFit — schéma de données (profil, photos, comptes marchands, historique).
--
-- Remplace apps/api/supabase/schema.sql. Colonnes en snake_case, champs camelCase
-- côté TS (packages/shared).
--
-- Qui écrit quoi :
--   - apps/web (clé anon + session utilisateur, soumis au RLS) : profil, photos,
--     déclaration d'un compte marchand (sans aucune référence H Company).
--   - apps/api (clé service_role, contourne le RLS) : captures, produits trouvés,
--     essayages, commandes, et références H Company des comptes marchands.
--
-- Règle d'or : AUCUN mot de passe marchand en base. merchant_accounts ne stocke
-- que l'identifiant d'un vault ou d'un browser profile H Company.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Types
-- -----------------------------------------------------------------------------
create type public.photo_type as enum ('face', 'pied');

-- Comment l'agent H Company accède au compte marchand.
create type public.merchant_auth_kind as enum ('vault', 'browser_profile');

-- Cycle de vie de la liaison d'un compte marchand.
--   en_attente : déclaré par l'utilisateur, pas encore relié à H Company
--   connecte   : référence H Company valide, l'agent peut acheter
--   expire     : la session marchande a expiré, il faut relier à nouveau
--   erreur     : la liaison a échoué
create type public.merchant_account_statut as enum ('en_attente', 'connecte', 'expire', 'erreur');

-- Identique à OrderStatutSchema (packages/shared/src/order.ts).
create type public.order_statut as enum (
  'en_attente',
  'en_cours',
  'confirmation_requise',
  'commandee',
  'echec'
);

-- -----------------------------------------------------------------------------
-- updated_at automatique
-- -----------------------------------------------------------------------------
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- profiles : 1 ligne par utilisateur, créée automatiquement à l'inscription
-- -----------------------------------------------------------------------------
create table public.profiles (
  user_id           uuid primary key references auth.users (id) on delete cascade,
  taille            jsonb not null default '{}'::jsonb,   -- Tailles : { haut, bas, pointure }
  mensurations      jsonb not null default '{}'::jsonb,   -- Mensurations : { hauteurCm, poitrineCm, tourDeTailleCm, hanchesCm }
  budget_max        numeric(10, 2) not null default 100 check (budget_max >= 0),
  devise            char(3) not null default 'EUR' check (devise = upper(devise)),
  marques_preferees text[] not null default '{}',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint profiles_taille_is_object check (jsonb_typeof(taille) = 'object'),
  constraint profiles_mensurations_is_object check (jsonb_typeof(mensurations) = 'object')
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Crée le profil vide dès qu'un compte auth est créé (email, Google…).
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id) values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- user_photos : photos de l'utilisateur dans le bucket privé `user-photos`
-- storage_path = "<user_id>/<fichier>" (chemin dans le bucket, pas une URL)
-- -----------------------------------------------------------------------------
create table public.user_photos (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles (user_id) on delete cascade,
  storage_path text not null unique,
  type         public.photo_type not null default 'pied',
  created_at   timestamptz not null default now(),
  constraint user_photos_path_in_user_folder check (storage_path like user_id::text || '/%')
);

create index user_photos_user_id_idx on public.user_photos (user_id, created_at);

-- -----------------------------------------------------------------------------
-- merchant_accounts : compte d'un utilisateur chez un marchand
-- ⚠️ Jamais de mot de passe : seulement la référence H Company (vault ou browser profile).
-- -----------------------------------------------------------------------------
create table public.merchant_accounts (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references public.profiles (user_id) on delete cascade,
  marchand             text not null check (length(trim(marchand)) > 0),   -- ex. "Zara"
  domaine              text not null check (domaine ~ '^[a-z0-9.-]+\.[a-z]{2,}$'), -- ex. "zara.com"
  email                text,                                               -- affichage seulement
  statut               public.merchant_account_statut not null default 'en_attente',
  auth_kind            public.merchant_auth_kind,
  h_vault_id           text,   -- vault H Company de l'utilisateur (un vault par utilisateur)
  h_vault_item_id      text,   -- entrée de ce vault pour ce marchand (email + mot de passe, chez H)
  h_browser_profile_id text,
  last_verified_at     timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint merchant_accounts_one_per_domain unique (user_id, domaine),
  -- La référence H Company correspond au mode choisi.
  constraint merchant_accounts_ref_matches_kind check (
    (auth_kind is null and h_vault_id is null and h_vault_item_id is null and h_browser_profile_id is null)
    or (auth_kind = 'vault' and h_vault_id is not null and h_vault_item_id is not null
        and h_browser_profile_id is null)
    or (auth_kind = 'browser_profile' and h_browser_profile_id is not null
        and h_vault_id is null and h_vault_item_id is null)
  ),
  -- Un compte "connecte" a forcément une référence H Company.
  constraint merchant_accounts_connected_has_ref check (statut <> 'connecte' or auth_kind is not null)
);

create index merchant_accounts_user_id_idx on public.merchant_accounts (user_id);

create trigger merchant_accounts_set_updated_at
  before update on public.merchant_accounts
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- captures : tenue capturée sur Pinterest (InspirationCapture)
-- -----------------------------------------------------------------------------
create table public.captures (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (user_id) on delete cascade,
  image_url   text not null,
  pin_url     text not null,
  captured_at timestamptz not null default now(),   -- InspirationCapture.capturedAt
  created_at  timestamptz not null default now(),
  constraint captures_id_user_unique unique (id, user_id)
);

create index captures_user_id_idx on public.captures (user_id, created_at desc);

-- -----------------------------------------------------------------------------
-- product_matches : produits équivalents trouvés pour une capture (ProductMatch)
-- user_id est recopié depuis la capture (cohérence garantie par la FK composite)
-- pour un RLS simple et rapide.
-- -----------------------------------------------------------------------------
create table public.product_matches (
  id                  uuid primary key default gen_random_uuid(),
  capture_id          uuid not null,
  user_id             uuid not null,
  external_id         text not null,                 -- ProductMatch.id (identifiant Bright Data / marchand)
  marque              text not null,
  nom                 text not null,
  prix                numeric(10, 2) not null check (prix >= 0),
  devise              char(3) not null check (devise = upper(devise)),
  url                 text not null,                 -- page produit chez le marchand
  image_url           text not null,
  tailles_disponibles text[] not null default '{}',
  score               numeric(4, 3) not null check (score between 0 and 1),
  rang                smallint not null default 0,   -- ordre d'affichage (0 = meilleur)
  created_at          timestamptz not null default now(),
  constraint product_matches_capture_fk
    foreign key (capture_id, user_id) references public.captures (id, user_id) on delete cascade,
  constraint product_matches_id_user_unique unique (id, user_id),
  constraint product_matches_capture_external_unique unique (capture_id, external_id)
);

create index product_matches_user_id_idx on public.product_matches (user_id);

-- -----------------------------------------------------------------------------
-- tryons : résultat d'essayage
-- result_storage_path = chemin dans le bucket privé `tryon-results` ("<user_id>/<fichier>").
-- On stocke le chemin, pas l'URL : les URLs signées expirent, on les régénère à la lecture.
-- -----------------------------------------------------------------------------
create table public.tryons (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references public.profiles (user_id) on delete cascade,
  product_match_id    uuid,
  user_photo_id       uuid references public.user_photos (id) on delete set null,
  garment_image_url   text not null,
  result_storage_path text unique,
  latency_ms          integer check (latency_ms >= 0),
  created_at          timestamptz not null default now(),
  constraint tryons_product_match_fk
    foreign key (product_match_id, user_id) references public.product_matches (id, user_id)
    on delete cascade,
  constraint tryons_path_in_user_folder
    check (result_storage_path is null or result_storage_path like user_id::text || '/%')
);

create index tryons_user_id_idx on public.tryons (user_id, created_at desc);

-- -----------------------------------------------------------------------------
-- orders : commande passée par l'agent H Company (OrderStatus)
-- product_id / product_url : ce que reçoit POST /order (contrat actuel).
-- product_match_id : lien vers l'historique, rempli quand l'API le connaît.
-- -----------------------------------------------------------------------------
create table public.orders (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references public.profiles (user_id) on delete cascade,
  product_match_id    uuid,
  merchant_account_id uuid references public.merchant_accounts (id) on delete set null,
  product_id          text not null,
  product_url         text not null,
  taille              text not null,
  statut              public.order_statut not null default 'en_attente',
  h_session_id        text,
  agent_view_url      text,
  message             text,
  confirmed           boolean not null default false,   -- feu vert explicite de l'utilisateur
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint orders_product_match_fk
    foreign key (product_match_id, user_id) references public.product_matches (id, user_id)
    on delete set null (product_match_id)
);

create index orders_user_id_idx on public.orders (user_id, created_at desc);
create unique index orders_h_session_id_key on public.orders (h_session_id) where h_session_id is not null;

create trigger orders_set_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

-- =============================================================================
-- Droits + Row Level Security
--
-- On part de zéro : anon n'a accès à rien, authenticated reçoit seulement ce dont
-- apps/web a besoin, et le RLS limite chaque requête aux lignes de l'utilisateur.
-- service_role (apps/api) garde tous les droits et contourne le RLS.
-- =============================================================================
revoke all on public.profiles, public.user_photos, public.merchant_accounts, public.captures,
  public.product_matches, public.tryons, public.orders
  from anon, authenticated;

grant all on public.profiles, public.user_photos, public.merchant_accounts, public.captures,
  public.product_matches, public.tryons, public.orders
  to service_role;

alter table public.profiles          enable row level security;
alter table public.user_photos       enable row level security;
alter table public.merchant_accounts enable row level security;
alter table public.captures          enable row level security;
alter table public.product_matches   enable row level security;
alter table public.tryons            enable row level security;
alter table public.orders            enable row level security;

-- profiles : lecture + modification de son profil (la création se fait par trigger).
grant select on public.profiles to authenticated;
grant insert (user_id, taille, mensurations, budget_max, devise, marques_preferees)
  on public.profiles to authenticated;
grant update (taille, mensurations, budget_max, devise, marques_preferees)
  on public.profiles to authenticated;

create policy "profiles_select_own" on public.profiles
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "profiles_insert_own" on public.profiles
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- user_photos : l'utilisateur gère ses propres photos.
grant select, delete on public.user_photos to authenticated;
grant insert (user_id, storage_path, type) on public.user_photos to authenticated;
grant update (type) on public.user_photos to authenticated;

create policy "user_photos_select_own" on public.user_photos
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "user_photos_insert_own" on public.user_photos
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "user_photos_update_own" on public.user_photos
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "user_photos_delete_own" on public.user_photos
  for delete to authenticated using ((select auth.uid()) = user_id);

-- merchant_accounts : l'utilisateur déclare / supprime un compte, mais ne peut PAS
-- écrire statut, auth_kind ni les références H Company (droits par colonne).
-- Sinon il pourrait pointer vers le vault d'un autre utilisateur. Seul le serveur
-- (service_role) relie un compte à H Company.
grant select, delete on public.merchant_accounts to authenticated;
grant insert (user_id, marchand, domaine, email) on public.merchant_accounts to authenticated;
grant update (email) on public.merchant_accounts to authenticated;

create policy "merchant_accounts_select_own" on public.merchant_accounts
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "merchant_accounts_insert_own" on public.merchant_accounts
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "merchant_accounts_update_own" on public.merchant_accounts
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "merchant_accounts_delete_own" on public.merchant_accounts
  for delete to authenticated using ((select auth.uid()) = user_id);

-- captures : historique écrit par l'API ; l'utilisateur lit et peut supprimer.
grant select, delete on public.captures to authenticated;
create policy "captures_select_own" on public.captures
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "captures_delete_own" on public.captures
  for delete to authenticated using ((select auth.uid()) = user_id);

-- product_matches : lecture seule.
grant select on public.product_matches to authenticated;
create policy "product_matches_select_own" on public.product_matches
  for select to authenticated using ((select auth.uid()) = user_id);

-- tryons : lecture + suppression.
grant select, delete on public.tryons to authenticated;
create policy "tryons_select_own" on public.tryons
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "tryons_delete_own" on public.tryons
  for delete to authenticated using ((select auth.uid()) = user_id);

-- orders : lecture seule. Statut et `confirmed` ne sont modifiables que par l'API,
-- pour que personne ne valide un paiement en écrivant directement en base.
grant select on public.orders to authenticated;
create policy "orders_select_own" on public.orders
  for select to authenticated using ((select auth.uid()) = user_id);

-- Les fonctions internes ne sont pas appelables via l'API REST.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.set_updated_at() from public, anon, authenticated;
