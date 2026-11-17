-- =============================================================================
-- Test d'isolation RLS : l'utilisateur A (démo) ne peut ni lire ni modifier les
-- données de B, et ne peut pas écrire les champs réservés au serveur.
--
-- Prérequis : `supabase db reset` (migrations + seed.sql).
-- Lancer :    psql "$(supabase status -o env | grep DB_URL | cut -d= -f2- | tr -d '"')" -f supabase/tests/rls_isolation.sql
--             (ou coller le fichier dans le SQL editor de Supabase Studio)
-- Résultat :  "RLS OK" en NOTICE, sinon une erreur "ECHEC: …". Tout est annulé à la fin.
-- =============================================================================
begin;

-- ---------- Session de A ----------
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}', true);

do $$
declare
  a constant uuid := 'a0000000-0000-4000-8000-000000000001';
  b constant uuid := 'b0000000-0000-4000-8000-000000000002';
  n int;
begin
  -- 1. A ne voit que ses lignes, dans toutes les tables.
  if (select count(*) from public.profiles where user_id <> a) > 0 then raise exception 'ECHEC: profiles de B visibles'; end if;
  if (select count(*) from public.user_photos where user_id <> a) > 0 then raise exception 'ECHEC: user_photos de B visibles'; end if;
  if (select count(*) from public.merchant_accounts where user_id <> a) > 0 then raise exception 'ECHEC: merchant_accounts de B visibles'; end if;
  if (select count(*) from public.captures where user_id <> a) > 0 then raise exception 'ECHEC: captures de B visibles'; end if;
  if (select count(*) from public.product_matches where user_id <> a) > 0 then raise exception 'ECHEC: product_matches de B visibles'; end if;
  if (select count(*) from public.tryons where user_id <> a) > 0 then raise exception 'ECHEC: tryons de B visibles'; end if;
  if (select count(*) from public.orders where user_id <> a) > 0 then raise exception 'ECHEC: orders de B visibles'; end if;

  -- … et voit bien les siennes (sinon le test ci-dessus ne prouve rien).
  if (select count(*) from public.profiles) <> 1 then raise exception 'ECHEC: A ne voit pas son profil'; end if;
  if (select count(*) from public.product_matches) <> 3 then raise exception 'ECHEC: A ne voit pas ses 3 produits'; end if;
  if (select count(*) from public.orders) <> 1 then raise exception 'ECHEC: A ne voit pas sa commande'; end if;

  -- 2. A ne peut pas modifier ni supprimer les lignes de B (0 ligne touchée).
  update public.profiles set budget_max = 1 where user_id = b;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'ECHEC: A modifie le profil de B'; end if;

  delete from public.captures where user_id = b;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'ECHEC: A supprime les captures de B'; end if;

  delete from public.merchant_accounts where user_id = b;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'ECHEC: A supprime les comptes marchands de B'; end if;

  -- 3. A ne peut pas créer de ligne au nom de B.
  begin
    insert into public.user_photos (user_id, storage_path, type) values (b, b::text || '/pirate.jpg', 'pied');
    raise exception 'ECHEC: A insère une photo au nom de B';
  exception when insufficient_privilege then null;
  end;

  begin
    insert into public.merchant_accounts (user_id, marchand, domaine) values (b, 'Zara', 'zara.com');
    raise exception 'ECHEC: A déclare un compte marchand au nom de B';
  exception when insufficient_privilege then null;
  end;

  -- 4. Champs réservés au serveur : références H Company, statuts, commandes.
  begin
    update public.merchant_accounts set h_vault_id = 'vault_de_quelqu_un_d_autre', auth_kind = 'vault', statut = 'connecte'
    where user_id = a;
    raise exception 'ECHEC: A écrit une référence H Company';
  exception when insufficient_privilege then null;
  end;

  begin
    update public.merchant_accounts set h_vault_item_id = 'item_de_quelqu_un_d_autre' where user_id = a;
    raise exception 'ECHEC: A écrit une entrée de vault H Company';
  exception when insufficient_privilege then null;
  end;

  begin
    insert into public.merchant_accounts (user_id, marchand, domaine, h_vault_id) values (a, 'COS', 'cos.com', 'vault_x');
    raise exception 'ECHEC: A insère une référence H Company';
  exception when insufficient_privilege then null;
  end;

  begin
    update public.orders set confirmed = true, statut = 'commandee' where user_id = a;
    raise exception 'ECHEC: A modifie une commande';
  exception when insufficient_privilege then null;
  end;

  begin
    insert into public.captures (user_id, image_url, pin_url) values (a, 'https://x.test/a.jpg', 'https://x.test/');
    raise exception 'ECHEC: A écrit directement une capture';
  exception when insufficient_privilege then null;
  end;

  -- 5. Ce que A a le droit de faire passe bien.
  update public.profiles set budget_max = 90 where user_id = a;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'ECHEC: A ne peut pas modifier son profil'; end if;

  insert into public.merchant_accounts (user_id, marchand, domaine, email) values (a, 'COS', 'cos.com', 'demo@buyfit.test');
  insert into public.user_photos (user_id, storage_path, type) values (a, a::text || '/pied-2.jpg', 'pied');

  -- 6. Storage : A ne lit / n'écrit que dans son dossier.
  begin
    insert into storage.objects (bucket_id, name) values ('user-photos', b::text || '/pirate.jpg');
    raise exception 'ECHEC: A écrit dans le dossier Storage de B';
  exception when insufficient_privilege then null;
  end;

  begin
    insert into storage.objects (bucket_id, name) values ('tryon-results', a::text || '/faux.png');
    raise exception 'ECHEC: A écrit dans tryon-results (réservé à l''API)';
  exception when insufficient_privilege then null;
  end;

  insert into storage.objects (bucket_id, name) values ('user-photos', a::text || '/pied-2.jpg');

  raise notice 'Session A : OK';
end $$;

-- ---------- Visiteur non connecté (clé anon) ----------
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

do $$
begin
  begin
    perform 1 from public.profiles limit 1;
    raise exception 'ECHEC: anon lit profiles';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.orders limit 1;
    raise exception 'ECHEC: anon lit orders';
  exception when insufficient_privilege then null;
  end;
  if (select count(*) from storage.objects where bucket_id in ('user-photos', 'tryon-results')) > 0 then
    raise exception 'ECHEC: anon voit des fichiers privés';
  end if;
  raise notice 'Session anon : OK';
end $$;

-- ---------- Intégrité : un produit ne peut pas être rattaché à la capture d'un autre ----------
reset role;
do $$
begin
  begin
    insert into public.product_matches (capture_id, user_id, external_id, marque, nom, prix, devise, url, image_url, score)
    values ('b3000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001',
            'x', 'X', 'X', 1, 'EUR', 'https://x.test', 'https://x.test/x.jpg', 0.5);
    raise exception 'ECHEC: produit de A rattaché à la capture de B';
  exception when foreign_key_violation then null;
  end;
  begin
    insert into public.merchant_accounts (user_id, marchand, domaine, statut)
    values ('a0000000-0000-4000-8000-000000000001', 'H&M', 'hm.com', 'connecte');
    raise exception 'ECHEC: compte "connecte" sans référence H Company';
  exception when check_violation then null;
  end;
  begin
    insert into public.merchant_accounts (user_id, marchand, domaine, auth_kind, h_vault_id)
    values ('a0000000-0000-4000-8000-000000000001', 'H&M', 'hm.com', 'vault', 'v-1');
    raise exception 'ECHEC: vault sans entrée (h_vault_item_id) accepté';
  exception when check_violation then null;
  end;
  raise notice 'Intégrité : OK';
  raise notice 'RLS OK';
end $$;

rollback;
