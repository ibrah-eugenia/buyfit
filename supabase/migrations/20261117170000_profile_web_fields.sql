-- Champs du profil saisis sur le site (onboarding / réglages) et absents du schéma initial :
-- genre, poids, morphologie, contact, adresse de livraison, daltonisme, fin de l'onboarding.
-- Mêmes règles que le reste de `profiles` : RLS « chacun ses lignes », droits colonne par colonne.

alter table public.profiles
  add column genre              text check (genre in ('femme', 'homme', 'non_precise')),
  add column poids_kg           numeric(5, 1) check (poids_kg between 30 and 250),
  add column morphologie        jsonb not null default '{}'::jsonb,  -- { epaules, ventre, hanches, coupe }
  add column contact            jsonb not null default '{}'::jsonb,  -- { prenom, nom, email, telephone }
  add column adresse            jsonb not null default '{}'::jsonb,  -- { numeroEtRue, codePostal, ville }
  add column daltonisme         jsonb not null default '{"actif": false}'::jsonb, -- { actif, type? }
  add column onboarding_termine boolean not null default false,
  add constraint profiles_morphologie_is_object check (jsonb_typeof(morphologie) = 'object'),
  add constraint profiles_contact_is_object check (jsonb_typeof(contact) = 'object'),
  add constraint profiles_adresse_is_object check (jsonb_typeof(adresse) = 'object'),
  add constraint profiles_daltonisme_is_object check (jsonb_typeof(daltonisme) = 'object');

grant insert (genre, poids_kg, morphologie, contact, adresse, daltonisme, onboarding_termine)
  on public.profiles to authenticated;
grant update (genre, poids_kg, morphologie, contact, adresse, daltonisme, onboarding_termine)
  on public.profiles to authenticated;
