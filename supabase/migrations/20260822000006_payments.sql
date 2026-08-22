-- გადახდების ჩაწერა.

-- ── ვინ ჩაწერა — ბაზა წყვეტს, არა კლიენტი ────────────────────────────────
-- `recorded_by` კლიენტს შეეძლო ნებისმიერი მეილით შეევსო. ფულის ისტორიაში
-- ეს ყველაზე ცუდი ადგილია სანდოობის დასათმობად, ამიტომ ველი ყოველთვის
-- გადაიწერება მოქმედი სესიის მეილით.
create or replace function public.stamp_payment() returns trigger
  language plpgsql security definer set search_path = public
  as $$
begin
  new.recorded_by := coalesce(public.my_email(), 'system');
  new.recorded_at := now();
  return new;
end $$;

create trigger payments_stamp
  before insert on public.payments
  for each row execute function public.stamp_payment();

-- ── აუდიტი ───────────────────────────────────────────────────────────────
-- დანარჩენი ცხრილების ტრიგერი UPDATE-ს უსმენს. გადახდა კი მხოლოდ ჩნდება
-- და არასდროს იცვლება, ამიტომ მას საკუთარი, INSERT-ის ტრიგერი სჭირდება.
create or replace function public.audit_payment() returns trigger
  language plpgsql security definer set search_path = public
  as $$
begin
  insert into public.audit_log (actor, action, cad, field, old_value, new_value)
  values (new.recorded_by, 'payment', new.cad, new.project_id,
          null, new.amount::text);
  return null;
end $$;

create trigger payments_audit
  after insert on public.payments
  for each row execute function public.audit_payment();

-- ── ხაზინდარი პროექტის ფორმაში ───────────────────────────────────────────
-- ველი თავიდანვე იყო სქემაში, მაგრამ `create_project` მას არ იღებდა, ასე
-- რომ ყოველთვის ცარიელი რჩებოდა — და `is_treasurer()` არასდროს ირთვებოდა.
drop function public.create_project(text, text, numeric, numeric, text[]);

create function public.create_project(
  p_name                 text,
  p_description          text,
  p_budget               numeric,
  p_amount_per_household numeric,
  p_cads                 text[],
  p_treasurer            text default null
) returns text
  language plpgsql security definer set search_path = public
  as $$
declare
  v_id        text;
  v_found     integer;
  v_asked     integer := coalesce(array_length(p_cads, 1), 0);
  v_treasurer text := nullif(btrim(lower(coalesce(p_treasurer, ''))), '');
begin
  if not public.has_role('admin', 'moderator') then
    raise exception 'ამ მოქმედების უფლება არ გაქვთ' using errcode = '42501';
  end if;
  if coalesce(btrim(p_name), '') = '' then
    raise exception 'პროექტის სახელი სავალდებულოა' using errcode = '22023';
  end if;
  if p_amount_per_household is null or p_amount_per_household <= 0 then
    raise exception 'თანხა ოჯახიდან დადებითი უნდა იყოს' using errcode = '22023';
  end if;
  if v_asked = 0 then
    raise exception 'ერთი ნაკვეთი მაინც უნდა აირჩეს' using errcode = '22023';
  end if;

  select count(*) into v_found from public.plots where cad = any(p_cads);
  if v_found <> v_asked then
    raise exception 'არჩეულ ნაკვეთებში უცნობი საკადასტრო კოდია'
      using errcode = '22023';
  end if;

  -- ხაზინდარი ფულს იწერს, ამიტომ ის დამტკიცებული მომხმარებელი უნდა იყოს
  -- და არა თავისუფალი ტექსტი: აკრეფის შეცდომა უფლებას ჩუმად წაართმევდა.
  if v_treasurer is not null and not exists (
       select 1 from public.profiles
       where email = v_treasurer and role in ('member','moderator','admin')) then
    raise exception 'ხაზინდარი დამტკიცებული მომხმარებელი უნდა იყოს: %', v_treasurer
      using errcode = '22023';
  end if;

  v_id := 'PRJ-' || lpad(nextval('public.project_seq')::text, 3, '0');

  insert into public.projects (
    id, name, description, budget, amount_per_household,
    plot_cads, treasurer, status, created_by)
  values (
    v_id, btrim(p_name), nullif(btrim(coalesce(p_description, '')), ''),
    p_budget, p_amount_per_household, p_cads, v_treasurer, 'draft', public.my_email());

  insert into public.audit_log (actor, action, cad, field, old_value, new_value)
  values (public.my_email(), 'project_create', v_id, 'name', null, btrim(p_name));

  return v_id;
end $$;
