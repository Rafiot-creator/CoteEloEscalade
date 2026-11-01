-- « Je ne souhaite pas apparaitre dans le classement » (ecran Grimpeurs).
--
-- Un grimpeur qui coche la case n'est plus montre dans le classement public
-- (tableau, histogramme, tuiles, liste des noms de la Carte) ; il voit
-- toujours ses propres cotes, sur une ligne a part au-dessus du tableau. Il
-- continue d'entrer dans le calcul comme avant : ses envois deplacent la cote
-- des blocs, seul l'affichage change.
--
-- Comme le reste de `grimpeurs`, la colonne est en lecture publique (le calcul
-- se fait dans le navigateur, qui a besoin de toutes les ascensions) : c'est
-- un retrait de l'affichage, pas une protection des donnees. Le pseudonyme
-- reste le seul nom expose.

alter table public.grimpeurs add column masque_classement boolean not null default false;

create function public.definir_masque_classement(masque boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  gid text;
begin
  select grimpeur_id into gid from public.profils where user_id = auth.uid();
  if gid is null then
    raise exception 'connexion et pseudonyme requis' using errcode = '28000';
  end if;
  update public.grimpeurs set masque_classement = coalesce(masque, false) where id = gid;
end;
$$;

revoke all on function public.definir_masque_classement(boolean) from public, anon, authenticated;
grant execute on function public.definir_masque_classement(boolean) to authenticated;
