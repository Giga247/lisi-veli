-- უფლებები. `apps-script/lib.js`-ის PERMISSIONS ცხრილის ზუსტი ასლი, ოღონდ
-- ბაზაში — ანუ ისეთი, რომელსაც ვერც ერთი კლიენტი ვერ აუვლის გვერდს.

-- ── დამხმარეები ──────────────────────────────────────────────────────────
-- security definer: profiles-ს თვითონ RLS აქვს, და პოლიტიკა რომ თავის თავს
-- ეკითხებოდეს როლს, უსასრულო რეკურსია გამოვიდოდა.

create or replace function public.my_role() returns user_role
  language sql stable security definer set search_path = public
  as $$ select role from public.profiles where id = auth.uid() $$;

create or replace function public.my_email() returns text
  language sql stable security definer set search_path = public
  as $$ select email from public.profiles where id = auth.uid() $$;

create or replace function public.has_role(variadic roles user_role[]) returns boolean
  language sql stable
  as $$ select coalesce(public.my_role() = any(roles), false) $$;

-- პროექტის ხაზინდარი გლობალური როლი არ არის — ის პროექტის ველია.
create or replace function public.is_treasurer(p_project_id text) returns boolean
  language sql stable security definer set search_path = public
  as $$ select exists (
         select 1 from public.projects
         where id = p_project_id and treasurer = public.my_email()) $$;

-- ── ნაგულისხმევი უფლებების მოხსნა ────────────────────────────────────────
-- Supabase ახალ ცხრილებს ავტომატურად აძლევს anon/authenticated-ს. ჯერ
-- ყველაფერს ვხსნით, მერე მხოლოდ საჭიროს ვაბრუნებთ.

revoke all on public.profiles, public.plots, public.projects,
              public.pledges, public.payments, public.audit_log
       from anon, authenticated;

alter table public.profiles  enable row level security;
alter table public.plots     enable row level security;
alter table public.projects  enable row level security;
alter table public.pledges   enable row level security;
alter table public.payments  enable row level security;
alter table public.audit_log enable row level security;

-- ── profiles ─────────────────────────────────────────────────────────────
grant select on public.profiles to authenticated;
grant update (display_name, street, cad) on public.profiles to authenticated;
grant update (role, approved_at, approved_by) on public.profiles to authenticated;

create policy profiles_read_own on public.profiles
  for select to authenticated using (id = auth.uid());
create policy profiles_read_all_admin on public.profiles
  for select to authenticated using (public.has_role('admin'));
create policy profiles_write_admin on public.profiles
  for update to authenticated
  using (public.has_role('admin')) with check (public.has_role('admin'));

-- ── plots ────────────────────────────────────────────────────────────────
-- UPDATE მხოლოდ თეთრი სიის სვეტებზე. ეს EDITABLE_FIELDS-ის ზუსტი ასლია,
-- ოღონდ ბაზის დონეზე: `cad`-ის ან `geometry`-ის შეცვლა უბრალოდ არ არსებობს.
grant select on public.plots to authenticated;
grant update (first_name, last_name, phone, street, num,
              address, area, purpose, note) on public.plots to authenticated;

create policy plots_read on public.plots
  for select to authenticated
  using (public.has_role('member','moderator','admin'));
create policy plots_update on public.plots
  for update to authenticated
  using (public.has_role('moderator','admin'))
  with check (public.has_role('moderator','admin'));

-- ── projects ─────────────────────────────────────────────────────────────
grant select on public.projects to authenticated;
grant insert, update on public.projects to authenticated;

create policy projects_read on public.projects
  for select to authenticated
  using (public.has_role('member','moderator','admin'));
create policy projects_insert_admin on public.projects
  for insert to authenticated with check (public.has_role('admin'));
create policy projects_update_admin on public.projects
  for update to authenticated
  using (public.has_role('admin')) with check (public.has_role('admin'));

-- ── pledges ──────────────────────────────────────────────────────────────
grant select on public.pledges to authenticated;
grant insert, update on public.pledges to authenticated;

create policy pledges_read on public.pledges
  for select to authenticated
  using (public.has_role('member','moderator','admin'));
create policy pledges_write on public.pledges
  for insert to authenticated
  with check (public.has_role('moderator','admin'));
create policy pledges_update on public.pledges
  for update to authenticated
  using (public.has_role('moderator','admin'))
  with check (public.has_role('moderator','admin'));

-- ── payments ─────────────────────────────────────────────────────────────
-- `member`-საც შეუძლია ჩაწერა, თუ ამ კონკრეტული პროექტის ხაზინდარია.
grant select on public.payments to authenticated;
grant insert on public.payments to authenticated;

create policy payments_read on public.payments
  for select to authenticated
  using (public.has_role('member','moderator','admin'));
create policy payments_insert on public.payments
  for insert to authenticated
  with check (public.has_role('moderator','admin')
              or public.is_treasurer(project_id));

-- ── audit_log ────────────────────────────────────────────────────────────
-- ჩაწერა მხოლოდ ტრიგერით ხდება (security definer), ამიტომ insert-ის
-- უფლება არავის სჭირდება.
grant select on public.audit_log to authenticated;

create policy audit_read_admin on public.audit_log
  for select to authenticated using (public.has_role('admin'));
