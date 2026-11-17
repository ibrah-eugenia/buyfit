-- =============================================================================
-- Fonctions réservées à apps/api (clé service_role). Voir docs/data-access.md.
--
-- Elles évitent à l'API de reconstruire le profil à partir de 3 tables, et d'enregistrer
-- une capture et ses produits en plusieurs requêtes non atomiques.
-- Non appelables avec la clé anon ni par un utilisateur connecté.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Profil complet d'un utilisateur, au format proche de UserProfile (packages/shared).
-- Différence : `photoPaths` contient des chemins du bucket privé `user-photos` (photos
-- plein pied d'abord), que l'API transforme en URLs signées (createSignedUrl).
-- comptesMarchands : seulement les comptes utilisables (statut `connecte`).
-- Renvoie null si l'utilisateur n'existe pas.
-- -----------------------------------------------------------------------------
create function public.api_get_user_profile(p_user_id uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'id', p.user_id,
    'photoPaths', coalesce((
      select jsonb_agg(ph.storage_path order by (ph.type = 'pied') desc, ph.created_at)
      from public.user_photos ph
      where ph.user_id = p.user_id
    ), '[]'::jsonb),
    'taille', p.taille,
    'mensurations', p.mensurations,
    'budgetMax', p.budget_max,
    'devise', p.devise,
    'marquesPreferees', to_jsonb(p.marques_preferees),
    'comptesMarchands', coalesce((
      select jsonb_agg(
        jsonb_strip_nulls(jsonb_build_object(
          'id', m.id,
          'marchand', m.marchand,
          'domaine', m.domaine,
          'email', m.email,
          'vaultId', m.h_vault_id
        ))
        order by m.marchand
      )
      from public.merchant_accounts m
      where m.user_id = p.user_id and m.statut = 'connecte'
    ), '[]'::jsonb)
  )
  from public.profiles p
  where p.user_id = p_user_id
$$;

-- -----------------------------------------------------------------------------
-- Enregistre une capture et ses produits en une transaction.
--   p_capture : InspirationCapture  { imageUrl, pinUrl, capturedAt }
--   p_matches : ProductMatch[]      { id, marque, nom, prix, devise, url, imageUrl,
--                                     tailleDisponibles, score }  (ordre = rang)
-- Renvoie { captureId, matches: [{ matchId, productId }] } : matchId (uuid en base) sert à
-- relier ensuite essayages et commandes (tryons.product_match_id, orders.product_match_id).
-- -----------------------------------------------------------------------------
create function public.api_save_capture(p_user_id uuid, p_capture jsonb, p_matches jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_capture_id uuid;
  v_matches jsonb;
begin
  if jsonb_typeof(p_matches) is distinct from 'array' then
    raise exception 'p_matches doit être un tableau JSON' using errcode = '22023';
  end if;

  insert into public.captures (user_id, image_url, pin_url, captured_at)
  values (
    p_user_id,
    p_capture ->> 'imageUrl',
    p_capture ->> 'pinUrl',
    coalesce((p_capture ->> 'capturedAt')::timestamptz, now())
  )
  returning id into v_capture_id;

  with inserted as (
    insert into public.product_matches (
      capture_id, user_id, external_id, marque, nom, prix, devise, url, image_url,
      tailles_disponibles, score, rang
    )
    select
      v_capture_id,
      p_user_id,
      m.value ->> 'id',
      m.value ->> 'marque',
      m.value ->> 'nom',
      (m.value ->> 'prix')::numeric,
      upper(m.value ->> 'devise'),
      m.value ->> 'url',
      m.value ->> 'imageUrl',
      coalesce(
        array(select jsonb_array_elements_text(coalesce(m.value -> 'tailleDisponibles', '[]'::jsonb))),
        '{}'
      ),
      (m.value ->> 'score')::numeric,
      (m.ordinality - 1)::smallint
    from jsonb_array_elements(p_matches) with ordinality as m (value, ordinality)
    returning id, external_id, rang
  )
  select coalesce(
    jsonb_agg(jsonb_build_object('matchId', id, 'productId', external_id) order by rang),
    '[]'::jsonb
  )
  into v_matches
  from inserted;

  return jsonb_build_object('captureId', v_capture_id, 'matches', v_matches);
end;
$$;

revoke execute on function public.api_get_user_profile(uuid) from public, anon, authenticated;
revoke execute on function public.api_save_capture(uuid, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.api_get_user_profile(uuid) to service_role;
grant execute on function public.api_save_capture(uuid, jsonb, jsonb) to service_role;
