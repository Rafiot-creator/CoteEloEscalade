-- Niveau de flash demande a l'inscription.
--
-- Le grimpeur donne la cote qu'il flashe habituellement ; son niveau declare
-- (`grimpeurs.niveau_declare`, la cote de depart du calcul, cf.
-- `amorcesGrimpeurs` dans src/core/formulas/lib.ts) est **un cran au-dessus** :
-- une cote du site est celle d'un bloc reussi une fois sur deux, et on flashe
-- en general sous ce niveau. Flash V4 -> niveau V5 -> depart a 5000.
-- Facultatif : sans reponse, la cote de depart reste estimee sur les premiers
-- blocs, comme avant.

-- Flash V0 a V11 -> niveau V1 a V12 (le haut de l'echelle, cf. src/core/cotations.ts).
create function public.niveau_depuis_flash(flash text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
begin
  if flash is null then
    return null;
  end if;
  if flash !~ '^V([0-9]|1[01])$' then
    raise exception 'niveau de flash hors echelle (V0 a V11) : %', flash using errcode = '22023';
  end if;
  return 'V' || (substr(flash, 2)::integer + 1);
end;
$$;

-- creer_profil prend desormais le niveau de flash, facultatif.
drop function public.creer_profil(text);
create function public.creer_profil(pseudo text, flash text default null)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  p text := btrim(pseudo);
  niveau text := public.niveau_depuis_flash(flash);
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
  values (gid, p, 'X', '', extract(year from now())::integer, niveau);
  insert into public.profils (user_id, grimpeur_id) values (auth.uid(), gid);
  return gid;
end;
$$;

-- Pour un compte cree avant cette question : donner son niveau de flash une
-- fois, tant qu'aucun niveau n'est declare. Pas apres : changer de cote de
-- depart a volonte permettrait de retoucher sa cote.
create function public.declarer_flash(flash text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  gid text;
  niveau text := public.niveau_depuis_flash(flash);
begin
  select grimpeur_id into gid from public.profils where user_id = auth.uid();
  if gid is null then
    raise exception 'connexion et pseudonyme requis' using errcode = '28000';
  end if;
  if niveau is null then
    raise exception 'niveau de flash manquant' using errcode = '22023';
  end if;
  update public.grimpeurs set niveau_declare = niveau where id = gid and niveau_declare is null;
  if not found then
    raise exception 'un niveau est deja declare pour ce compte' using errcode = '23505';
  end if;
end;
$$;

revoke all on function public.niveau_depuis_flash(text) from public, anon, authenticated;
revoke all on function public.creer_profil(text, text) from public, anon, authenticated;
revoke all on function public.declarer_flash(text) from public, anon, authenticated;
grant execute on function public.creer_profil(text, text) to authenticated;
grant execute on function public.declarer_flash(text) to authenticated;
