-- Commentaires et signalements (onglet Commentaires, src/ui/views/VueCommentaires.tsx).
--
-- Ouvert a tous, meme sans compte : un probleme de connexion fait partie de ce
-- qu'on veut pouvoir signaler. Personne ne lit la table directement (aucune
-- regle d'acces) : on ecrit par `envoyer_commentaire`, qui verifie les champs
-- et limite le debit, et seul l'admin general lit et range les messages
-- (ecran Administration).

create table public.commentaires (
  id bigint generated always as identity primary key,
  cree_le timestamptz not null default now(),
  type text not null check (type in ('probleme', 'suggestion', 'autre')),
  message text not null check (char_length(message) between 1 and 2000),
  -- Facultatif, pour pouvoir repondre. Visible par l'admin seulement.
  courriel text check (courriel is null or char_length(courriel) <= 200),
  -- Compte connecte, s'il y en a un. La suppression du compte ne garde que le
  -- pseudonyme (deja public).
  user_id uuid references auth.users (id) on delete set null,
  pseudo text,
  centre text check (centre is null or char_length(centre) <= 100),
  appareil text check (appareil is null or char_length(appareil) <= 400),
  traite boolean not null default false
);

revoke all on public.commentaires from anon, authenticated;
alter table public.commentaires enable row level security;

-- Debit maximal : par compte, ou pour l'ensemble des visiteurs sans compte
-- (rien d'autre ne les distingue cote base).
create function public.envoyer_commentaire(type text, message text, courriel text, centre text, appareil text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  msg text := btrim(coalesce(message, ''));
  mail text := nullif(btrim(coalesce(courriel, '')), '');
  recents int;
  ps text;
begin
  if type is null or type not in ('probleme', 'suggestion', 'autre') then
    raise exception 'type de commentaire inconnu : %', type using errcode = '22023';
  end if;
  if char_length(msg) = 0 or char_length(msg) > 2000 then
    raise exception 'message vide ou trop long (2000 caracteres au plus)' using errcode = '22023';
  end if;
  if mail is not null and (char_length(mail) > 200 or mail !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$') then
    raise exception 'adresse courriel invalide' using errcode = '22023';
  end if;
  if uid is null then
    select count(*) into recents from public.commentaires c
    where c.user_id is null and c.cree_le > now() - interval '1 hour';
    if recents >= 20 then
      raise exception 'trop de messages envoyes recemment, reessayez plus tard' using errcode = '54000';
    end if;
  else
    select count(*) into recents from public.commentaires c
    where c.user_id = uid and c.cree_le > now() - interval '1 hour';
    if recents >= 10 then
      raise exception 'trop de messages envoyes recemment, reessayez plus tard' using errcode = '54000';
    end if;
    select g.nom into ps from public.profils p join public.grimpeurs g on g.id = p.grimpeur_id where p.user_id = uid;
  end if;
  insert into public.commentaires (type, message, courriel, user_id, pseudo, centre, appareil)
  values (envoyer_commentaire.type, msg, mail, uid, ps, left(envoyer_commentaire.centre, 100), left(envoyer_commentaire.appareil, 400));
end;
$$;

create function public.admin_lister_commentaires()
returns setof public.commentaires
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.verifier_admin();
  return query select * from public.commentaires c order by c.cree_le desc;
end;
$$;

create function public.admin_marquer_commentaire(commentaire bigint, traite boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.verifier_admin();
  update public.commentaires c set traite = admin_marquer_commentaire.traite where c.id = commentaire;
  if not found then
    raise exception 'commentaire inconnu : %', commentaire using errcode = '22023';
  end if;
end;
$$;

revoke all on function public.envoyer_commentaire(text, text, text, text, text) from public;
revoke all on function public.admin_lister_commentaires() from public, anon;
revoke all on function public.admin_marquer_commentaire(bigint, boolean) from public, anon;
grant execute on function public.envoyer_commentaire(text, text, text, text, text) to anon, authenticated;
grant execute on function public.admin_lister_commentaires() to authenticated;
grant execute on function public.admin_marquer_commentaire(bigint, boolean) to authenticated;
