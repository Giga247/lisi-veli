-- პროექტს მოდერატორიც ჰყავს, არა მარტო ხაზინდარი.
--
-- აქამდე მოდერატორობა მხოლოდ გლობალური როლი იყო და პროექტს არ ახსოვდა,
-- ვინ პასუხობს მის ზარებზე. ორივე პასუხისმგებელი ახლა პროექტის ველია და
-- ეკრანზე ჩანს — მეზობელმა უნდა იცოდეს, ვის დაურეკოს.
--
-- უფლება ამ ველზე არ არის მიბმული: მოდერატორი სტატუსს ყველგან ცვლის
-- (ქუჩის შეზღუდვა მოიხსნა), ველი კი პასუხისმგებლობას აფიქსირებს. ერთი
-- გამონაკლისია — დანიშვნა მაცხოვრებელს თვითონ აძლევს მოდერატორის როლს,
-- რომ ადმინს ორ ადგილას ერთი და იმავე გადაწყვეტილების გამეორება არ
-- მოუწიოს.

alter table public.projects add column if not exists moderator text;

-- ── შექმნა მოდერატორითურთ ────────────────────────────────────────────────
drop function if exists public.create_project(text, text, numeric, numeric, text[], text);

create function public.create_project(
  p_name                 text,
  p_description          text,
  p_budget               numeric,
  p_amount_per_household numeric,
  p_cads                 text[],
  p_treasurer            text default null,
  p_moderator            text default null
) returns text
  language plpgsql security definer set search_path = public
  as $$
declare
  v_id        text;
  v_found     integer;
  v_asked     integer := coalesce(array_length(p_cads, 1), 0);
  v_treasurer text := nullif(btrim(lower(coalesce(p_treasurer, ''))), '');
  v_moderator text := nullif(btrim(lower(coalesce(p_moderator, ''))), '');
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

  if v_treasurer is not null and not exists (
       select 1 from public.profiles
       where email = v_treasurer and role in ('member','moderator','admin')) then
    raise exception 'ხაზინდარი დამტკიცებული მომხმარებელი უნდა იყოს: %', v_treasurer
      using errcode = '22023';
  end if;
  if v_moderator is not null and not exists (
       select 1 from public.profiles
       where email = v_moderator and role in ('member','moderator','admin')) then
    raise exception 'მოდერატორი დამტკიცებული მომხმარებელი უნდა იყოს: %', v_moderator
      using errcode = '22023';
  end if;

  v_id := 'PRJ-' || lpad(nextval('public.project_seq')::text, 3, '0');

  insert into public.projects (
    id, name, description, budget, amount_per_household,
    plot_cads, treasurer, moderator, status, created_by)
  values (
    v_id, btrim(p_name), nullif(btrim(coalesce(p_description, '')), ''),
    p_budget, p_amount_per_household, p_cads, v_treasurer, v_moderator,
    'draft', public.my_email());

  insert into public.audit_log (actor, action, cad, field, old_value, new_value)
  values (public.my_email(), 'project_create', v_id, 'name', null, btrim(p_name));

  return v_id;
end $$;

-- ── დანიშვნა უკვე არსებულ პროექტზე ───────────────────────────────────────
-- „პროექტის რედაქტირების" ეკრანი არ გვაქვს და მხოლოდ ამ ორი ველისთვის
-- მისი აშენება გადაჭარბებული იქნებოდა. `null` ველს ასუფთავებს, გამოტოვება
-- კი მას უცვლელს ტოვებს — ამიტომ სამივე ვარიანტი ერთი გამოძახებით იწერება.
create or replace function public.set_project_staff(
  p_id        text,
  p_moderator text default null,
  p_treasurer text default null
) returns public.projects
  language plpgsql security definer set search_path = public
  as $$
declare
  v_moderator text := nullif(btrim(lower(coalesce(p_moderator, ''))), '');
  v_treasurer text := nullif(btrim(lower(coalesce(p_treasurer, ''))), '');
  v_row       public.projects;
begin
  if not public.has_role('admin') then
    raise exception 'დანიშვნა მხოლოდ ადმინს შეუძლია' using errcode = '42501';
  end if;

  if v_moderator is not null and not exists (
       select 1 from public.profiles
       where email = v_moderator and role in ('member','moderator','admin')) then
    raise exception 'მოდერატორი დამტკიცებული მომხმარებელი უნდა იყოს: %', v_moderator
      using errcode = '22023';
  end if;
  if v_treasurer is not null and not exists (
       select 1 from public.profiles
       where email = v_treasurer and role in ('member','moderator','admin')) then
    raise exception 'ხაზინდარი დამტკიცებული მომხმარებელი უნდა იყოს: %', v_treasurer
      using errcode = '22023';
  end if;

  update public.projects
     set moderator = v_moderator, treasurer = v_treasurer
   where id = p_id
  returning * into v_row;

  if v_row.id is null then
    raise exception 'პროექტი ვერ მოიძებნა: %', p_id using errcode = 'P0002';
  end if;

  -- დანიშვნა უფლების გარეშე ცარიელი ჟესტია: მოდერატორი სტატუსს ვერ
  -- შეცვლიდა და ადმინი მიზეზს დიდხანს ეძებდა. ჩამორთმევა კი აქ არ
  -- ხდება — კაცი სხვა პროექტზეც შეიძლება იყოს მოდერატორი.
  if v_moderator is not null then
    update public.profiles set role = 'moderator'
     where email = v_moderator and role = 'member';
  end if;

  insert into public.audit_log (actor, action, cad, field, old_value, new_value)
  values (public.my_email(), 'project_staff', p_id, 'moderator',
          null, coalesce(v_moderator, '—')),
         (public.my_email(), 'project_staff', p_id, 'treasurer',
          null, coalesce(v_treasurer, '—'));

  return v_row;
end $$;
