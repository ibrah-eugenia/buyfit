-- =============================================================================
-- Buckets Storage privés.
--
-- Convention de chemin : "<user_id>/<fichier>". Le 1er dossier est l'id de
-- l'utilisateur, et les policies s'appuient dessus.
--
--   user-photos    : photos de l'utilisateur (face / plein pied). Gérées depuis apps/web.
--   tryon-results  : images d'essayage. Écrites par apps/api (service_role),
--                    seulement lisibles par leur propriétaire.
--
-- Buckets privés : pas d'URL publique. On lit via une URL signée à durée courte
-- (createSignedUrl), y compris pour envoyer la photo au service d'essayage.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('user-photos', 'user-photos', false, 10 * 1024 * 1024,
   array['image/jpeg', 'image/png', 'image/webp', 'image/heic']),
  ('tryon-results', 'tryon-results', false, 10 * 1024 * 1024,
   array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- user-photos : CRUD sur son propre dossier uniquement.
create policy "user_photos_bucket_select_own" on storage.objects
  for select to authenticated
  using (bucket_id = 'user-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "user_photos_bucket_insert_own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'user-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "user_photos_bucket_update_own" on storage.objects
  for update to authenticated
  using (bucket_id = 'user-photos' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'user-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "user_photos_bucket_delete_own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'user-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- tryon-results : lecture et suppression de ses propres résultats ; écriture par l'API seulement.
create policy "tryon_results_bucket_select_own" on storage.objects
  for select to authenticated
  using (bucket_id = 'tryon-results' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "tryon_results_bucket_delete_own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'tryon-results' and (storage.foldername(name))[1] = (select auth.uid())::text);
