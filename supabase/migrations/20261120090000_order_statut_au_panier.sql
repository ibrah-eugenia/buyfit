-- Parcours « ajout au panier » : l'agent s'arrête une fois l'article dans le panier du compte
-- marchand (statut `au_panier`, identique à OrderStatutSchema dans packages/shared/src/order.ts).
alter type public.order_statut add value if not exists 'au_panier' after 'confirmation_requise';
