-- Schema initial : les memes trois tables que les CSV de data/ (grimpeurs,
-- blocs, ascensions), plus les centres du menu et la position des blocs sur
-- leur carte. Etape 1 : lecture seule pour tout le monde, aucune ecriture
-- possible par l'API (ni visiteur, ni compte connecte).
--
-- Les droits sont poses explicitement ici plutot que laisses aux reglages du
-- tableau de bord ("exposer les nouvelles tables", "RLS automatique") : le
-- resultat ne depend pas de cases cochees ailleurs.

-- Une table creee plus tard n'est jamais exposee a l'API par oubli : il faudra
-- lui accorder ses droits explicitement, comme ci-dessous.
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke all on functions from anon, authenticated;

-- Centres du menu (src/App.tsx). `fond` et `taille_pastilles` reprennent
-- data/cartes/<centre>.json.
create table public.centres (
  id text primary key,
  nom text not null,
  fond text,
  taille_pastilles real not null default 1 check (taille_pastilles > 0)
);

-- Colonnes et valeurs identiques a data/grimpeurs.csv.
create table public.grimpeurs (
  id text primary key,
  nom text not null,
  sexe text not null check (sexe in ('F', 'M', 'X')),
  gym_principal text not null default '',
  premiere_saison integer not null check (premiere_saison between 1900 and 2100),
  niveau_declare text
);

-- Colonnes et valeurs identiques a data/blocs.csv. `gym` reste le nom de
-- salle vu par le calcul (texte libre, comme dans le CSV) ; `centre_id` dit
-- sur quelle carte du menu le bloc se trouve. `x`/`y` : position sur la carte
-- (fractions 0-1), absente pour un bloc qui n'y est pas place.
create table public.blocs (
  id text primary key,
  centre_id text not null references public.centres (id),
  nom text not null,
  gym text not null,
  secteur text not null default '',
  couleur text not null default '',
  cotation_officielle text not null,
  date_ouverture date not null default current_date,
  date_retrait date,
  x real check (x between 0 and 1),
  y real check (y between 0 and 1),
  check ((x is null) = (y is null))
);
create index blocs_centre_id on public.blocs (centre_id);

-- Colonnes et valeurs identiques a data/ascensions.csv.
create table public.ascensions (
  id bigint generated always as identity primary key,
  date date not null,
  grimpeur_id text not null references public.grimpeurs (id) on delete cascade,
  bloc_id text not null references public.blocs (id) on delete cascade,
  resultat text not null check (resultat in ('reussite', 'echec')),
  essais integer not null default 1 check (essais >= 1)
);
create index ascensions_grimpeur_id on public.ascensions (grimpeur_id);
create index ascensions_bloc_id on public.ascensions (bloc_id);

-- Droits : rien par defaut, puis lecture seule.
revoke all on public.centres, public.grimpeurs, public.blocs, public.ascensions from anon, authenticated;
grant select on public.centres, public.grimpeurs, public.blocs, public.ascensions to anon, authenticated;

alter table public.centres enable row level security;
alter table public.grimpeurs enable row level security;
alter table public.blocs enable row level security;
alter table public.ascensions enable row level security;

create policy "lecture publique" on public.centres for select to anon, authenticated using (true);
create policy "lecture publique" on public.grimpeurs for select to anon, authenticated using (true);
create policy "lecture publique" on public.blocs for select to anon, authenticated using (true);
create policy "lecture publique" on public.ascensions for select to anon, authenticated using (true);
