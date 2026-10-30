-- Etape 4 : temps reel.
--
-- Supabase diffuse les changements des tables de la publication
-- `supabase_realtime` aux navigateurs abonnes (src/ui/etat.ts pour les
-- envois, src/ui/views/VueCarte.tsx pour la carte). La diffusion respecte les
-- regles d'acces (RLS) : ces deux tables sont deja lisibles par tous, rien
-- de plus n'est expose. `profils` et `ouvreurs`, qui ne le sont pas, restent
-- hors de la publication.
alter publication supabase_realtime add table public.ascensions, public.blocs;
