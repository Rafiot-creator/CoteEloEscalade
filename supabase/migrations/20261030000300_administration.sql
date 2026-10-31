-- Ecran Administration (src/ui/views/VueAdministration.tsx).
--
-- Corriger les erreurs et effacer les tests : modifier ou effacer une
-- ascension de n'importe quel grimpeur, supprimer un bloc pour de bon (avec
-- ses ascensions, meme deja demonte). Reserve a l'admin general (ligne de
-- `ouvreurs` sans centre). Meme principe que les etapes precedentes : aucune
-- ecriture directe sur les tables, tout passe par ces fonctions, qui
-- verifient elles-memes le droit.

-- Le compte connecte est-il admin general ? Leve une exception sinon.
create function public.verifier_admin()
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
  if not exists (select 1 from public.ouvreurs o where o.user_id = auth.uid() and o.centre_id is null) then
    raise exception 'reserve a l''administrateur' using errcode = '42501';
  end if;
end;
$$;

-- Change le resultat d'une ascension : flash, reussi ou echec (memes valeurs
-- que `enregistrer_envoi`).
create function public.admin_modifier_ascension(ascension bigint, type text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.verifier_admin();
  if type not in ('flash', 'reussi', 'echec') then
    raise exception 'type d''envoi inconnu : %', type using errcode = '22023';
  end if;
  update public.ascensions a
  set resultat = case when type = 'echec' then 'echec' else 'reussite' end,
      essais = case when type = 'reussi' then 2 else 1 end
  where a.id = ascension;
  if not found then
    raise exception 'ascension inconnue : %', ascension using errcode = '22023';
  end if;
end;
$$;

create function public.admin_supprimer_ascension(ascension bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.verifier_admin();
  delete from public.ascensions a where a.id = ascension;
  if not found then
    raise exception 'ascension inconnue : %', ascension using errcode = '22023';
  end if;
end;
$$;

-- Supprime un bloc et toutes ses ascensions (cle etrangere en cascade), qu'il
-- soit en place ou deja demonte. A la difference de `demonter_bloc`, qui
-- garde l'historique d'un bloc grimpe.
create function public.admin_supprimer_bloc(bloc text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.verifier_admin();
  delete from public.blocs b where b.id = bloc;
  if not found then
    raise exception 'bloc inconnu : %', bloc using errcode = '22023';
  end if;
end;
$$;

revoke all on function public.verifier_admin() from public, anon, authenticated;
revoke all on function public.admin_modifier_ascension(bigint, text) from public, anon;
revoke all on function public.admin_supprimer_ascension(bigint) from public, anon;
revoke all on function public.admin_supprimer_bloc(text) from public, anon;
grant execute on function public.admin_modifier_ascension(bigint, text) to authenticated;
grant execute on function public.admin_supprimer_ascension(bigint) to authenticated;
grant execute on function public.admin_supprimer_bloc(text) to authenticated;
