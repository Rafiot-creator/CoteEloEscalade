-- Nommer ou retirer un ouvreur depuis l'ecran Administration
-- (src/ui/views/VueAdministration.tsx), au lieu du SQL a la main.
--
-- Reserve a l'admin general, comme les autres fonctions admin_*. Ne touche
-- qu'aux droits par centre : une ligne d'admin general (centre nul) ne se cree
-- ni ne se retire par ici.

-- Tous les droits d'ouvreur par centre, avec le grimpeur du compte.
create function public.admin_lister_ouvreurs()
returns table (grimpeur_id text, nom text, centre_id text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.verifier_admin();
  return query
    select g.id, g.nom, o.centre_id
    from public.ouvreurs o
    join public.profils p on p.user_id = o.user_id
    join public.grimpeurs g on g.id = p.grimpeur_id
    where o.centre_id is not null
    order by g.nom, o.centre_id;
end;
$$;

-- Donne (ouvreur = true) ou retire (false) le droit d'ouvrir sur un centre au
-- compte d'un grimpeur. Sans effet si c'est deja le cas.
create function public.admin_definir_ouvreur(grimpeur text, centre text, ouvreur boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid;
begin
  perform public.verifier_admin();
  if centre is null or not exists (select 1 from public.centres c where c.id = centre) then
    raise exception 'centre inconnu : %', centre using errcode = '22023';
  end if;
  select p.user_id into uid from public.profils p where p.grimpeur_id = grimpeur;
  if uid is null then
    raise exception 'ce grimpeur n''a pas de compte' using errcode = '22023';
  end if;
  if ouvreur then
    insert into public.ouvreurs (user_id, centre_id)
    select uid, centre
    where not exists (select 1 from public.ouvreurs o where o.user_id = uid and o.centre_id = centre);
  else
    delete from public.ouvreurs o where o.user_id = uid and o.centre_id = centre;
  end if;
end;
$$;

-- Le grimpeur a-t-il un compte ? (Les grimpeurs de la Demo n'en ont pas.)
create function public.admin_a_compte(grimpeur text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.verifier_admin();
  return exists (select 1 from public.profils p where p.grimpeur_id = grimpeur);
end;
$$;

revoke all on function public.admin_a_compte(text) from public, anon;
grant execute on function public.admin_a_compte(text) to authenticated;
revoke all on function public.admin_lister_ouvreurs() from public, anon;
revoke all on function public.admin_definir_ouvreur(text, text, boolean) from public, anon;
grant execute on function public.admin_lister_ouvreurs() to authenticated;
grant execute on function public.admin_definir_ouvreur(text, text, boolean) to authenticated;
