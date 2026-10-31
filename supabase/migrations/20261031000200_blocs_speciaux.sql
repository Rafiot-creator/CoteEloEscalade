-- Blocs speciaux de Rose Bloc 1 (src/core/types.ts, `Bloc.special`).
--
-- Des blocs que l'ouvreur ne cote pas. Ils gardent leur couleur de prises (la
-- pastille montre un « S » a la place du chiffre) ; leur cotation stockee est
-- toujours V8, une simple amorce a 8000 points. Le calcul les ecarte de
-- l'etalonnage, des verdicts et du « plus dur envoye », et ils ne deplacent la
-- cote d'aucun grimpeur tant que 20 grimpeurs ne les ont pas essayes
-- (`duelsGelesPourGrimpeurs`, src/core/formulas/lib.ts).
-- `centres.blocs_speciaux` dit a la carte si elle doit proposer l'option.

alter table public.blocs
  add column special boolean not null default false;

alter table public.centres
  add column blocs_speciaux boolean not null default false;

update public.centres set blocs_speciaux = true where id = 'rose-bloc-1';

-- Cotation enregistree pour un bloc special, quelle que soit celle envoyee.
create function public.cotation_bloc(centre text, cotation text, special boolean)
returns text
language plpgsql
stable
set search_path = ''
as $$
begin
  if not special then
    return cotation;
  end if;
  if not exists (select 1 from public.centres ce where ce.id = centre and ce.blocs_speciaux) then
    raise exception 'ce centre n''a pas de blocs speciaux : %', centre using errcode = '22023';
  end if;
  return 'V8';
end;
$$;

-- Memes fonctions qu'a l'etape 3 (20261029000300_ouvreurs.sql), avec le
-- marquage en plus. `modifier_bloc` le laisse tel quel s'il n'est pas fourni
-- (null) : une ancienne version du site encore ouverte ne l'efface pas.
drop function public.placer_bloc(text, real, real, text, text, text, text);
drop function public.modifier_bloc(text, real, real, text, text, text, text);

create function public.placer_bloc(
  centre text, x real, y real, cotation text, couleur text, secteur text, nom text, special boolean default false
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  c text;
  cot text;
  bid text := 'b-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 12);
  salle text;
begin
  perform public.verifier_ouvreur(centre);
  cot := public.cotation_bloc(centre, cotation, coalesce(placer_bloc.special, false));
  c := public.verifier_champs_bloc(cot, couleur, secteur, nom);
  select b.gym into salle from public.blocs b where b.centre_id = centre limit 1;
  if salle is null then
    select ce.nom into salle from public.centres ce where ce.id = centre;
  end if;
  insert into public.blocs (id, centre_id, nom, gym, secteur, couleur, cotation_officielle, date_ouverture, x, y, special)
  values (bid, centre, coalesce(nullif(btrim(nom), ''), bid), salle, secteur, c, cot, current_date, x, y,
          coalesce(placer_bloc.special, false));
  return bid;
end;
$$;

create function public.modifier_bloc(
  bloc text, x real, y real, cotation text, couleur text, secteur text, nom text, special boolean default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  centre text;
  s boolean;
  c text;
  cot text;
begin
  select b.centre_id, coalesce(modifier_bloc.special, b.special) into centre, s from public.blocs b where b.id = bloc;
  if centre is null then
    raise exception 'bloc inconnu : %', bloc using errcode = '22023';
  end if;
  perform public.verifier_ouvreur(centre);
  cot := public.cotation_bloc(centre, cotation, s);
  c := public.verifier_champs_bloc(cot, couleur, secteur, nom);
  update public.blocs b
  set x = modifier_bloc.x, y = modifier_bloc.y, cotation_officielle = cot, couleur = c,
      secteur = modifier_bloc.secteur, nom = coalesce(nullif(btrim(modifier_bloc.nom), ''), b.id), special = s
  where b.id = bloc;
end;
$$;

revoke all on function public.cotation_bloc(text, text, boolean) from public, anon, authenticated;
revoke all on function public.placer_bloc(text, real, real, text, text, text, text, boolean) from public, anon, authenticated;
revoke all on function public.modifier_bloc(text, real, real, text, text, text, text, boolean) from public, anon, authenticated;
grant execute on function public.placer_bloc(text, real, real, text, text, text, text, boolean) to authenticated;
grant execute on function public.modifier_bloc(text, real, real, text, text, text, text, boolean) to authenticated;
