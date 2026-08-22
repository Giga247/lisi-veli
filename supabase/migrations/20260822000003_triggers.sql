-- ტრიგერები. ის სამი რამ, რასაც Apps Script ხელით აკეთებდა ყოველ handler-ში
-- და რის გამოტოვებაც შეიძლებოდა.

-- ── ახალი მომხმარებელი ───────────────────────────────────────────────────
-- Supabase Auth ქმნის auth.users-ს; ჩვენ სარკეს ვქმნით profiles-ში.
-- პირველი ოდესმე დარეგისტრირებული ხდება admin — ეს არის „bootstrap":
-- ვიღაცას ხომ უნდა შეეძლოს დანარჩენების დამტკიცება. ყველა შემდეგი — pending.
create or replace function public.handle_new_user() returns trigger
  language plpgsql security definer set search_path = public
  as $$
declare
  first_user boolean;
begin
  select not exists (select 1 from public.profiles) into first_user;
  insert into public.profiles (id, email, display_name, role, approved_at, approved_by)
  values (
    new.id,
    lower(new.email),
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    case when first_user then 'admin'::user_role else 'pending'::user_role end,
    case when first_user then now() else null end,
    case when first_user then 'bootstrap' else null end
  )
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── ნაკვეთის განახლების ბეჭედი ───────────────────────────────────────────
-- კლიენტი ამ ორ ველს ვერ წერს (სვეტობრივი grant არ აქვს) — ბაზა თვითონ სვამს.
create or replace function public.stamp_plot_update() returns trigger
  language plpgsql security definer set search_path = public
  as $$
begin
  new.updated_at := now();
  new.updated_by := coalesce(public.my_email(), 'system');
  return new;
end $$;

create trigger plots_stamp
  before update on public.plots
  for each row execute function public.stamp_plot_update();

-- ── აუდიტი ───────────────────────────────────────────────────────────────
-- თითო შეცვლილი ველი — თითო ჩანაწერი, ისევე როგორც `appendLog()` წერდა.
create or replace function public.audit_row_changes() returns trigger
  language plpgsql security definer set search_path = public
  as $$
declare
  o jsonb := to_jsonb(old);
  n jsonb := to_jsonb(new);
  k text;
  skip text[] := array['updated_at','updated_by','recorded_at','recorded_by'];
  row_cad text := coalesce(n->>'cad', o->>'cad');
begin
  for k in select jsonb_object_keys(n) loop
    continue when k = any(skip);
    if (o->>k) is distinct from (n->>k) then
      insert into public.audit_log (actor, action, cad, field, old_value, new_value)
      values (coalesce(public.my_email(), 'system'), tg_argv[0], row_cad, k, o->>k, n->>k);
    end if;
  end loop;
  return null;
end $$;

create trigger plots_audit    after update on public.plots
  for each row execute function public.audit_row_changes('updatePlot');
create trigger profiles_audit after update on public.profiles
  for each row execute function public.audit_row_changes('setRole');
create trigger pledges_audit  after update on public.pledges
  for each row execute function public.audit_row_changes('setPledge');
