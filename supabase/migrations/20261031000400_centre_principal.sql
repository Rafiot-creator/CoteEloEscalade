-- Centre principal et niveau de flash en cote maison.
--
-- 1. L'inscription demande le centre ou l'on grimpe le plus souvent. Il est
--    range dans `grimpeurs.gym_principal` (deja la, colonne « Salle » des
--    classements) sous le nom du centre, et sert a preselectionner ce centre a
--    la premiere visite. Modifiable ensuite (`definir_centre_principal`) : il
--    n'entre dans aucun calcul.
-- 2. Dans un centre Rose Bloc, le niveau de flash peut se donner en cote 1-15 :
--    le site le convertit en V a deux decimales (src/core/echelles.ts), donc
--    `niveau_depuis_flash` accepte desormais une cote V fractionnaire. Le
--    niveau declare (flash + 1 cote V) est plafonne au haut de l'echelle, V12.

create or replace function public.niveau_depuis_flash(flash text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v numeric;
begin
  if flash is null then
    return null;
  end if;
  if flash !~ '^V[0-9]{1,2}(\.[0-9]{1,2})?$' or substr(flash, 2)::numeric >= 12.5 then
    raise exception 'niveau de flash hors echelle (V0 a V12) : %', flash using errcode = '22023';
  end if;
  v := least(round(substr(flash, 2)::numeric + 1, 2), 12);
  -- 'V5', 'V6.31' (jamais 'V6.30' ni 'V5.00').
  if v = trunc(v) then
    return 'V' || trunc(v)::integer::text;
  end if;
  return 'V' || rtrim(v::text, '0');
end;
$$;

-- Nom du centre a ranger dans `gym_principal` ('' : aucun ou autre centre).
create function public.nom_centre_principal(centre text)
returns text
language plpgsql
stable
set search_path = ''
as $$
declare
  n text;
begin
  if centre is null or btrim(centre) = '' then
    return '';
  end if;
  select ce.nom into n from public.centres ce where ce.id = centre and ce.id <> 'demo';
  if n is null then
    raise exception 'centre inconnu : %', centre using errcode = '22023';
  end if;
  return n;
end;
$$;

drop function public.creer_profil(text, text);
create function public.creer_profil(pseudo text, flash text default null, centre text default null)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  p text := btrim(pseudo);
  niveau text := public.niveau_depuis_flash(flash);
  salle text := public.nom_centre_principal(centre);
  gid text;
begin
  if auth.uid() is null then
    raise exception 'connexion requise' using errcode = '28000';
  end if;
  if exists (select 1 from public.profils where user_id = auth.uid()) then
    raise exception 'ce compte a deja un pseudonyme' using errcode = '23505';
  end if;
  if p is null or char_length(p) not between 2 and 30 then
    raise exception 'le pseudonyme doit faire de 2 a 30 caracteres' using errcode = '22023';
  end if;
  if exists (select 1 from public.grimpeurs where lower(btrim(nom)) = lower(p)) then
    raise exception 'ce pseudonyme est deja pris' using errcode = '23505';
  end if;
  gid := 'u-' || replace(auth.uid()::text, '-', '');
  -- Sexe inconnu ('X') et saison en cours : ces deux champs n'entrent dans
  -- aucun calcul (cf. src/core/types.ts) et ne sont pas demandes a l'inscription.
  insert into public.grimpeurs (id, nom, sexe, gym_principal, premiere_saison, niveau_declare)
  values (gid, p, 'X', salle, extract(year from now())::integer, niveau);
  insert into public.profils (user_id, grimpeur_id) values (auth.uid(), gid);
  return gid;
end;
$$;

create function public.definir_centre_principal(centre text)
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
  update public.grimpeurs set gym_principal = public.nom_centre_principal(centre) where id = gid;
end;
$$;

revoke all on function public.nom_centre_principal(text) from public, anon, authenticated;
revoke all on function public.creer_profil(text, text, text) from public, anon, authenticated;
revoke all on function public.definir_centre_principal(text) from public, anon, authenticated;
grant execute on function public.creer_profil(text, text, text) to authenticated;
grant execute on function public.definir_centre_principal(text) to authenticated;
