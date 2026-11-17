-- =============================================================================
-- Seed local (supabase db reset). DONNÉES DE TEST UNIQUEMENT, jamais en production.
--
-- Deux utilisateurs (connexion email + mot de passe sur la plateforme) :
--   demo@buyfit.test    / demo-buyfit-2026   → utilisateur de démo complet
--   autre@buyfit.test   / autre-buyfit-2026  → 2e utilisateur, sert aux tests RLS (A ne voit pas B)
--
-- Les ids sont fixes pour que l'API, l'extension et les tests puissent s'y référer.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Comptes auth (le trigger on_auth_user_created crée les profils vides)
-- -----------------------------------------------------------------------------
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
)
values
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-4000-8000-000000000001',
   'authenticated', 'authenticated', 'demo@buyfit.test',
   extensions.crypt('demo-buyfit-2026', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{"prenom":"Léa"}', now(), now(),
   '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'b0000000-0000-4000-8000-000000000002',
   'authenticated', 'authenticated', 'autre@buyfit.test',
   extensions.crypt('autre-buyfit-2026', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{"prenom":"Sam"}', now(), now(),
   '', '', '', '');

insert into auth.identities (
  id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at
)
values
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001',
   'email', '{"sub":"a0000000-0000-4000-8000-000000000001","email":"demo@buyfit.test","email_verified":true}',
   now(), now(), now()),
  (gen_random_uuid(), 'b0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000002',
   'email', '{"sub":"b0000000-0000-4000-8000-000000000002","email":"autre@buyfit.test","email_verified":true}',
   now(), now(), now());

-- -----------------------------------------------------------------------------
-- Profils
-- -----------------------------------------------------------------------------
update public.profiles
set taille = '{"haut":"M","bas":"38","pointure":"39"}',
    mensurations = '{"hauteurCm":168,"poitrineCm":88,"tourDeTailleCm":70,"hanchesCm":96}',
    budget_max = 80,
    devise = 'EUR',
    marques_preferees = '{Zara,Mango,COS}'
where user_id = 'a0000000-0000-4000-8000-000000000001';

update public.profiles
set taille = '{"haut":"L","bas":"42","pointure":"43"}',
    budget_max = 150,
    marques_preferees = '{Uniqlo}'
where user_id = 'b0000000-0000-4000-8000-000000000002';

-- -----------------------------------------------------------------------------
-- Photos (lignes seulement : les fichiers sont à déposer dans le bucket user-photos
-- au même chemin, voir docs/data-access.md)
-- -----------------------------------------------------------------------------
insert into public.user_photos (id, user_id, storage_path, type)
values
  ('a1000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001',
   'a0000000-0000-4000-8000-000000000001/pied-1.jpg', 'pied'),
  ('a1000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001',
   'a0000000-0000-4000-8000-000000000001/face-1.jpg', 'face'),
  ('b1000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002',
   'b0000000-0000-4000-8000-000000000002/pied-1.jpg', 'pied');

-- -----------------------------------------------------------------------------
-- Comptes marchands : Zara déclaré mais pas encore relié à H Company,
-- Mango relié via un vault (id factice). Jamais de mot de passe.
-- -----------------------------------------------------------------------------
insert into public.merchant_accounts
  (id, user_id, marchand, domaine, email, statut, auth_kind, h_vault_id, h_vault_item_id, last_verified_at)
values
  ('a2000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001',
   'Zara', 'zara.com', 'demo@buyfit.test', 'en_attente', null, null, null, null),
  ('a2000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001',
   'Mango', 'mango.com', 'demo@buyfit.test', 'connecte', 'vault',
   'mock-vault-demo', 'mock-item-demo-mango', now()),
  ('b2000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002',
   'Uniqlo', 'uniqlo.com', 'autre@buyfit.test', 'en_attente', null, null, null, null);

-- -----------------------------------------------------------------------------
-- Historique : 1 capture, 3 produits, 1 essayage, 1 commande
-- -----------------------------------------------------------------------------
insert into public.captures (id, user_id, image_url, pin_url, captured_at)
values
  ('a3000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001',
   'https://i.pinimg.com/originals/ab/cd/ef/demo-look.jpg',
   'https://www.pinterest.com/pin/123456/', now() - interval '2 days'),
  ('b3000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002',
   'https://i.pinimg.com/originals/12/34/56/autre-look.jpg',
   'https://www.pinterest.com/pin/654321/', now() - interval '1 day');

insert into public.product_matches
  (id, capture_id, user_id, external_id, marque, nom, prix, devise, url, image_url,
   tailles_disponibles, score, rang)
values
  ('a4000000-0000-4000-8000-000000000001', 'a3000000-0000-4000-8000-000000000001',
   'a0000000-0000-4000-8000-000000000001', 'zara-blazer-oversize-2761',
   'Zara', 'Blazer oversize en laine', 69.95, 'EUR',
   'https://www.zara.com/fr/fr/blazer-oversize-p02761.html',
   'https://static.zara.net/photos/demo/blazer.jpg', '{XS,S,M,L}', 0.91, 0),
  ('a4000000-0000-4000-8000-000000000002', 'a3000000-0000-4000-8000-000000000001',
   'a0000000-0000-4000-8000-000000000001', 'mango-blazer-structure-8812',
   'Mango', 'Blazer structuré', 59.99, 'EUR',
   'https://shop.mango.com/fr/femme/blazers/blazer-structure_8812.html',
   'https://st.mngbcn.com/demo/blazer.jpg', '{S,M,L}', 0.86, 1),
  ('a4000000-0000-4000-8000-000000000003', 'a3000000-0000-4000-8000-000000000001',
   'a0000000-0000-4000-8000-000000000001', 'cos-blazer-laine-1190',
   'COS', 'Blazer droit en laine', 79.00, 'EUR',
   'https://www.cos.com/fr-fr/femme/blazers/blazer-droit-1190.html',
   'https://media.cos.com/demo/blazer.jpg', '{34,36,38,40}', 0.78, 2),
  ('b4000000-0000-4000-8000-000000000001', 'b3000000-0000-4000-8000-000000000001',
   'b0000000-0000-4000-8000-000000000002', 'uniqlo-surchemise-4401',
   'Uniqlo', 'Surchemise en flanelle', 39.90, 'EUR',
   'https://www.uniqlo.com/fr/fr/product/surchemise-4401.html',
   'https://image.uniqlo.com/demo/surchemise.jpg', '{M,L,XL}', 0.84, 0);

insert into public.tryons
  (id, user_id, product_match_id, user_photo_id, garment_image_url, result_storage_path, latency_ms)
values
  ('a5000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001',
   'a4000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000001',
   'https://st.mngbcn.com/demo/blazer.jpg',
   'a0000000-0000-4000-8000-000000000001/a5000000-0000-4000-8000-000000000001.png', 8200);

insert into public.orders
  (id, user_id, product_match_id, merchant_account_id, product_id, product_url, taille,
   statut, h_session_id, agent_view_url, message, confirmed, created_at, updated_at)
values
  ('a6000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001',
   'a4000000-0000-4000-8000-000000000002', 'a2000000-0000-4000-8000-000000000002',
   'mango-blazer-structure-8812',
   'https://shop.mango.com/fr/femme/blazers/blazer-structure_8812.html', 'M',
   'commandee', 'mock-session-demo-0001', null, 'Commande mock validée (n° MOCK-1234).', true,
   now() - interval '2 days', now() - interval '2 days'),
  ('b6000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002',
   'b4000000-0000-4000-8000-000000000001', null,
   'uniqlo-surchemise-4401', 'https://www.uniqlo.com/fr/fr/product/surchemise-4401.html', 'L',
   'confirmation_requise', 'mock-session-autre-0001', null, 'Panier prêt : confirme l''achat.', false,
   now() - interval '1 day', now() - interval '1 day');
