-- Etape 2 : comptes et envois.
--
-- Un compte (auth.users, gere par Supabase) est relie a un grimpeur par la
-- table `profils`. Le grimpeur d'un compte est une ligne ordinaire de
-- `grimpeurs` : son `nom` est le pseudonyme choisi a l'inscription, seul
-- visible publiquement. Le courriel reste dans auth.users, jamais expose.
--
-- Aucune ecriture directe sur les tables n'est ouverte : tout passe par deux
-- fonctions (`creer_profil`, `enregistrer_envoi`) qui verifient elles-memes
-- qui appelle et ce qu'il a le droit de faire. Un compte ne peut donc ecrire
-- que ses propres envois, quel que soit le code qui tourne dans son navigateur.

create table public.profils (
  user_id uuid primary key references auth.users (id) on delete cascade,
  grimpeur_id text not null unique references public.grimpeurs (id) on delete cascade,
  cree_le timestamptz not null default now()
);

revoke all on public.profils from anon, authenticated;
grant select on public.profils to authenticated;
alter table public.profils enable row level security;
-- Chacun ne voit que son propre profil : le lien compte -> grimpeur n'est pas public.
create policy "son propre profil" on public.profils for select to authenticated using (user_id = auth.uid());

-- Un pseudonyme ne peut pas reprendre le nom d'un grimpeur existant, a la
-- casse et aux espaces pres.
create unique index grimpeurs_nom_unique on public.grimpeurs (lower(btrim(nom)));

-- Cree le grimpeur et le profil du compte connecte. Renvoie l'id du grimpeur.
create function public.creer_profil(pseudo text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  p text := btrim(pseudo);
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
  values (gid, p, 'X', '', extract(year from now())::integer, null);
  insert into public.profils (user_id, grimpeur_id) values (auth.uid(), gid);
  return gid;
end;
$$;

-- Enregistre l'envoi du compte connecte sur un bloc : flash, reussi ou echec.
-- Un seul statut par bloc et par grimpeur : le nouveau remplace les
-- precedents (meme regle que les boutons de la Carte avant les comptes).
create function public.enregistrer_envoi(bloc text, type text)
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
  if type not in ('flash', 'reussi', 'echec') then
    raise exception 'type d''envoi inconnu : %', type using errcode = '22023';
  end if;
  if not exists (select 1 from public.blocs where id = bloc) then
    raise exception 'bloc inconnu : %', bloc using errcode = '22023';
  end if;
  -- Frein contre les envois en rafale (script, faux resultats).
  if (select count(*) from public.ascensions a where a.grimpeur_id = gid and a.enregistre_le > now() - interval '1 hour') >= 100 then
    raise exception 'trop d''envois en une heure, reessayez plus tard' using errcode = '54000';
  end if;
  delete from public.ascensions where grimpeur_id = gid and bloc_id = bloc;
  insert into public.ascensions (date, grimpeur_id, bloc_id, resultat, essais)
  values (
    current_date, gid, bloc,
    case when type = 'echec' then 'echec' else 'reussite' end,
    -- Le nombre d'essais n'entre dans aucun calcul : il ne fait que
    -- distinguer flash (1) et reussi apres plusieurs essais (2).
    case when type = 'reussi' then 2 else 1 end
  );
end;
$$;

-- Moment exact de l'enregistrement (la colonne `date` n'a que le jour) :
-- sert au frein ci-dessus. Les lignes du jeu de demonstration n'en ont pas.
alter table public.ascensions add column enregistre_le timestamptz;
alter table public.ascensions alter column enregistre_le set default now();
create index ascensions_enregistre_le on public.ascensions (grimpeur_id, enregistre_le);

revoke all on function public.creer_profil(text) from public, anon, authenticated;
revoke all on function public.enregistrer_envoi(text, text) from public, anon, authenticated;
grant execute on function public.creer_profil(text) to authenticated;
grant execute on function public.enregistrer_envoi(text, text) to authenticated;
