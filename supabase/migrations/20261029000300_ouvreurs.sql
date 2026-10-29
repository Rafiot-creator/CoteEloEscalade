-- Etape 3 : outils de l'ouvreur.
--
-- Un ouvreur place, modifie et demonte les blocs d'un centre sur sa carte.
-- Meme principe qu'a l'etape 2 : aucune ecriture directe sur `blocs`, tout
-- passe par trois fonctions (`placer_bloc`, `modifier_bloc`, `demonter_bloc`)
-- qui verifient elles-memes que le compte qui appelle a ce droit sur ce centre.

-- Qui peut ouvrir ou. `centre_id` nul : tous les centres (admin general).
create table public.ouvreurs (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  centre_id text references public.centres (id) on delete cascade,
  nomme_le timestamptz not null default now()
);
create unique index ouvreurs_unique on public.ouvreurs (user_id, coalesce(centre_id, ''));

revoke all on public.ouvreurs from anon, authenticated;
grant select on public.ouvreurs to authenticated;
alter table public.ouvreurs enable row level security;
-- Chacun ne voit que ses propres droits (le site s'en sert pour montrer ou
-- non les outils d'edition) ; la liste des ouvreurs n'est pas publique.
create policy "ses propres droits" on public.ouvreurs for select to authenticated using (user_id = auth.uid());

-- Admin general : le compte de Raphael (pseudonyme « Rafiot »). Les autres
-- ouvreurs se nomment a la main, cf. README.
insert into public.ouvreurs (user_id, centre_id)
select p.user_id, null
from public.profils p join public.grimpeurs g on g.id = p.grimpeur_id
where g.nom = 'Rafiot';

-- Le compte connecte peut-il ouvrir sur ce centre ? Leve une exception sinon.
create function public.verifier_ouvreur(centre text)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'connexion requise' using errcode = '28000';
  end if;
  if not exists (
    select 1 from public.ouvreurs o
    where o.user_id = auth.uid() and (o.centre_id is null or o.centre_id = centre)
  ) then
    raise exception 'ce compte n''est pas ouvreur de ce centre' using errcode = '42501';
  end if;
end;
$$;

-- Verifie les champs d'un bloc et renvoie la couleur telle que stockee
-- ('rouge' -> 'Rouge', comme dans data/blocs.csv).
create function public.verifier_champs_bloc(cotation text, couleur text, secteur text, nom text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
begin
  -- Meme echelle que src/core/cotations.ts.
  if cotation is null or cotation !~ '^V([0-9]|1[0-2])$' then
    raise exception 'cotation hors echelle V (V0 a V12) : %', cotation using errcode = '22023';
  end if;
  -- Memes identifiants que PALETTE_COULEURS (src/ui/views/VueCarte.tsx).
  if couleur is null or couleur not in ('mauve', 'bleu', 'turquoise', 'vert', 'jaune', 'orange', 'rouge', 'rose', 'noir', 'blanc') then
    raise exception 'couleur inconnue : %', couleur using errcode = '22023';
  end if;
  -- Meme vocabulaire que STYLES_BLOC (src/core/stylesBloc.ts), ou aucun style.
  if secteur is null or secteur not in ('', 'Dalle', 'Coordo', 'Dévers', 'Joker') then
    raise exception 'style inconnu : %', secteur using errcode = '22023';
  end if;
  if char_length(btrim(coalesce(nom, ''))) > 40 then
    raise exception 'nom de bloc trop long (40 caracteres au plus)' using errcode = '22023';
  end if;
  return upper(left(couleur, 1)) || substr(couleur, 2);
end;
$$;

-- Place un nouveau bloc sur la carte d'un centre. Renvoie son id.
create function public.placer_bloc(centre text, x real, y real, cotation text, couleur text, secteur text, nom text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  c text;
  bid text := 'b-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 12);
  salle text;
begin
  perform public.verifier_ouvreur(centre);
  c := public.verifier_champs_bloc(cotation, couleur, secteur, nom);
  -- `gym` est le nom de salle vu par le calcul : celui des autres blocs du
  -- centre s'il y en a (le jeu de demonstration a le sien), sinon le nom du
  -- centre.
  select b.gym into salle from public.blocs b where b.centre_id = centre limit 1;
  if salle is null then
    select ce.nom into salle from public.centres ce where ce.id = centre;
  end if;
  insert into public.blocs (id, centre_id, nom, gym, secteur, couleur, cotation_officielle, date_ouverture, x, y)
  values (bid, centre, coalesce(nullif(btrim(nom), ''), bid), salle, secteur, c, cotation, current_date, x, y);
  return bid;
end;
$$;

-- Modifie un bloc deja place : position, cotation, couleur, style, nom.
create function public.modifier_bloc(bloc text, x real, y real, cotation text, couleur text, secteur text, nom text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  centre text;
  c text;
begin
  select b.centre_id into centre from public.blocs b where b.id = bloc;
  if centre is null then
    raise exception 'bloc inconnu : %', bloc using errcode = '22023';
  end if;
  perform public.verifier_ouvreur(centre);
  c := public.verifier_champs_bloc(cotation, couleur, secteur, nom);
  update public.blocs b
  set x = modifier_bloc.x, y = modifier_bloc.y, cotation_officielle = cotation, couleur = c,
      secteur = modifier_bloc.secteur, nom = coalesce(nullif(btrim(modifier_bloc.nom), ''), b.id)
  where b.id = bloc;
end;
$$;

-- Demonte un bloc : il quitte la carte. S'il a deja des ascensions, il reste
-- dans la base avec sa date de retrait (son historique compte toujours dans
-- les cotes des grimpeurs) ; sinon c'etait un bloc pose par erreur ou jamais
-- grimpe, et il est supprime.
create function public.demonter_bloc(bloc text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  centre text;
begin
  select b.centre_id into centre from public.blocs b where b.id = bloc;
  if centre is null then
    raise exception 'bloc inconnu : %', bloc using errcode = '22023';
  end if;
  perform public.verifier_ouvreur(centre);
  if exists (select 1 from public.ascensions a where a.bloc_id = bloc) then
    update public.blocs b
    set x = null, y = null, date_retrait = coalesce(b.date_retrait, current_date)
    where b.id = bloc;
  else
    delete from public.blocs b where b.id = bloc;
  end if;
end;
$$;

revoke all on function public.verifier_ouvreur(text) from public, anon, authenticated;
revoke all on function public.verifier_champs_bloc(text, text, text, text) from public, anon, authenticated;
revoke all on function public.placer_bloc(text, real, real, text, text, text, text) from public, anon, authenticated;
revoke all on function public.modifier_bloc(text, real, real, text, text, text, text) from public, anon, authenticated;
revoke all on function public.demonter_bloc(text) from public, anon, authenticated;
grant execute on function public.placer_bloc(text, real, real, text, text, text, text) to authenticated;
grant execute on function public.modifier_bloc(text, real, real, text, text, text, text) to authenticated;
grant execute on function public.demonter_bloc(text) to authenticated;
