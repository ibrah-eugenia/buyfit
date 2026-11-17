-- =============================================================================
-- Test des fonctions réservées à l'API (migration 20261117120200_api_functions.sql).
-- Prérequis : `supabase db reset`. Résultat : NOTICE "API functions OK". Tout est annulé.
-- =============================================================================
begin;

-- ---------- Un utilisateur connecté ne peut PAS les appeler ----------
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
do $$
begin
  begin
    perform public.api_get_user_profile('b0000000-0000-4000-8000-000000000002');
    raise exception 'ECHEC: un utilisateur lit le profil complet d''un autre via la RPC';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.api_save_capture('a0000000-0000-4000-8000-000000000001', '{}', '[]');
    raise exception 'ECHEC: un utilisateur écrit une capture via la RPC';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- ---------- Ni la clé anon ----------
set local role anon;
do $$
begin
  perform public.api_get_user_profile('a0000000-0000-4000-8000-000000000001');
  raise exception 'ECHEC: anon appelle la RPC';
exception when insufficient_privilege then null;
end $$;
reset role;

-- ---------- service_role (apps/api) ----------
set local role service_role;
do $$
declare
  p jsonb;
  r jsonb;
begin
  p := public.api_get_user_profile('a0000000-0000-4000-8000-000000000001');
  if p is null then raise exception 'ECHEC: profil de démo introuvable'; end if;
  if p ->> 'budgetMax' <> '80.00' and p ->> 'budgetMax' <> '80' then
    raise exception 'ECHEC: budgetMax = %', p ->> 'budgetMax';
  end if;
  if p -> 'photoPaths' ->> 0 not like '%/pied-1.jpg' then
    raise exception 'ECHEC: la photo plein pied doit venir en premier (%)', p -> 'photoPaths';
  end if;
  if jsonb_array_length(p -> 'comptesMarchands') <> 1
     or p -> 'comptesMarchands' -> 0 ->> 'domaine' <> 'mango.com'
     or p -> 'comptesMarchands' -> 0 ->> 'vaultId' is null then
    raise exception 'ECHEC: seuls les comptes connectés (Mango) attendus : %', p -> 'comptesMarchands';
  end if;
  if p::text like '%item%' then raise exception 'ECHEC: l''id d''entrée de vault ne doit pas sortir'; end if;

  if public.api_get_user_profile('00000000-0000-4000-8000-00000000dead') is not null then
    raise exception 'ECHEC: profil inconnu doit renvoyer null';
  end if;

  r := public.api_save_capture(
    'a0000000-0000-4000-8000-000000000001',
    '{"imageUrl":"https://i.pinimg.com/x.jpg","pinUrl":"https://www.pinterest.com/pin/1/","capturedAt":"2026-11-17T10:00:00.000Z"}',
    '[{"id":"p-1","marque":"Zara","nom":"Jean","prix":39.95,"devise":"eur","url":"https://zara.com/p1","imageUrl":"https://zara.com/p1.jpg","tailleDisponibles":["38","40"],"score":0.9},
      {"id":"p-2","marque":"COS","nom":"Jean droit","prix":59,"devise":"EUR","url":"https://cos.com/p2","imageUrl":"https://cos.com/p2.jpg","score":0.7}]'
  );
  if jsonb_array_length(r -> 'matches') <> 2 or r -> 'matches' -> 0 ->> 'productId' <> 'p-1' then
    raise exception 'ECHEC: retour de api_save_capture : %', r;
  end if;
  if (select count(*) from public.product_matches where capture_id = (r ->> 'captureId')::uuid) <> 2 then
    raise exception 'ECHEC: produits non enregistrés';
  end if;
  if (select devise from public.product_matches where external_id = 'p-1' and capture_id = (r ->> 'captureId')::uuid) <> 'EUR' then
    raise exception 'ECHEC: devise non normalisée';
  end if;
  if (select tailles_disponibles from public.product_matches where external_id = 'p-2' and capture_id = (r ->> 'captureId')::uuid) <> '{}' then
    raise exception 'ECHEC: tailles absentes → tableau vide attendu';
  end if;

  -- Atomicité : un produit invalide annule aussi la capture.
  begin
    perform public.api_save_capture('a0000000-0000-4000-8000-000000000001',
      '{"imageUrl":"https://i.pinimg.com/y.jpg","pinUrl":"https://www.pinterest.com/pin/2/"}',
      '[{"id":"p-3","marque":"X","nom":"X","prix":10,"devise":"EUR","url":"https://x.test","imageUrl":"https://x.test/x.jpg","score":2}]');
    raise exception 'ECHEC: score > 1 accepté';
  exception when check_violation then null;
  end;
  if exists (select 1 from public.captures where image_url = 'https://i.pinimg.com/y.jpg') then
    raise exception 'ECHEC: capture orpheline après un produit invalide';
  end if;

  raise notice 'API functions OK';
end $$;

rollback;
