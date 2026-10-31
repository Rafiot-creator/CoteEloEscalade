-- Comp Wall de Rose Bloc 2 (src/core/echelles.ts, echelle 'comp-wall').
--
-- Ses 24 blocs sont numerotes de 1 a 24, sans autre cote. Un bloc y appartient
-- par une couleur speciale, 'comp-wall' (stockee 'Comp-wall'), qui lui donne
-- sa pastille en etoile et sa conversion vers V ; la cotation stockee reste
-- une cotation V, comme pour tous les blocs. `centres.comp_wall` dit a la
-- carte si elle doit proposer cette couleur a l'ouvreur.

alter table public.centres
  add column comp_wall boolean not null default false;

update public.centres set comp_wall = true where id = 'rose-bloc-2';

create or replace function public.verifier_champs_bloc(cotation text, couleur text, secteur text, nom text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
begin
  if cotation is null or cotation !~ '^V[0-9]{1,2}(\.[0-9]{1,2})?$' or substr(cotation, 2)::numeric >= 12.5 then
    raise exception 'cotation hors echelle V (V0 a V12) : %', cotation using errcode = '22023';
  end if;
  -- Memes identifiants que PALETTE_COULEURS (src/ui/views/VueCarte.tsx), plus
  -- COULEUR_COMP_WALL (src/core/echelles.ts).
  if couleur is null or couleur not in ('mauve', 'bleu', 'turquoise', 'vert', 'jaune', 'orange', 'rouge', 'rose', 'noir', 'blanc', 'comp-wall') then
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
