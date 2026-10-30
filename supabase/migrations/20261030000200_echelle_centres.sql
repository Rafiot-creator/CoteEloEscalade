-- Echelle affichee par centre (src/core/echelles.ts).
--
-- Les salles Rose Bloc cotent de 1 a 15, pas en V. La base et le calcul
-- restent en V : `blocs.cotation_officielle` garde une cotation V, desormais
-- eventuellement fractionnaire ('V5.31'), et la carte la traduit dans
-- l'echelle du centre a l'affichage et a la saisie (V = (cote - 1) / 1,13).

alter table public.centres
  add column echelle text not null default 'v' check (echelle in ('v', 'rose-bloc'));

update public.centres set echelle = 'rose-bloc' where id in ('rose-bloc-1', 'rose-bloc-2');

-- Accepte une cotation V a deux decimales au plus, de V0 a V12.49 (Rose Bloc
-- 15 = V12.39) : meme regle que indexDeCotation, src/core/cotations.ts.
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
