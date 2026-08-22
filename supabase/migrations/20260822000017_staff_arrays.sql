-- პროექტს რამდენიმე მოდერატორი და რამდენიმე ხაზინდარი ჰყავს.
--
-- ერთი ადამიანი 86 კომლს ვერ დაურეკავს და ვერც ფულს მიიღებს — უბანი
-- ამას ისედაც რამდენიმე კაცად აკეთებს. ერთადერთი ველი ხელოვნური
-- შეზღუდვა იყო: დანიშვნისას ადმინი ვინმეს ყოველთვის ჩამოართმევდა.
--
-- მასივი და არა ცალკე ცხრილი: სია მოკლეა, ყოველთვის მთლიანად
-- იკითხება და მთლიანადვე იწერება. ცალკე ცხრილი ორ join-ს დაამატებდა
-- და არაფერს მოიგებდა.

alter table public.projects add column if not exists moderators text[] not null default '{}';
alter table public.projects add column if not exists treasurers text[] not null default '{}';

update public.projects
   set moderators = case when moderator is null then '{}'::text[] else array[moderator] end,
       treasurers = case when treasurer is null then '{}'::text[] else array[treasurer] end
 where moderators = '{}' and treasurers = '{}';

alter table public.projects drop column if exists moderator;
alter table public.projects drop column if exists treasurer;

-- ── უფლების შემოწმება ────────────────────────────────────────────────────
create or replace function public.is_treasurer(p_project_id text) returns boolean
  language sql stable security definer set search_path = public
  as $$ select exists (select 1 from public.projects
         where id = p_project_id
           and public.my_email() = any(treasurers)) $$;

-- ტელეფონი: ნებისმიერი პროექტის ხაზინდარი ნომრებს ხედავს.
create or replace function public.plot_phones()
  returns table (cad text, phone text)
  language plpgsql stable security definer set search_path = public
  as $$
begin
  if not (public.has_role('moderator', 'admin')
          or exists (select 1 from public.projects
                      where public.my_email() = any(treasurers))) then
    return;
  end if;
  return query select p.cad, p.phone from public.plots p where p.phone is not null;
end $$;

-- ── სახელები ─────────────────────────────────────────────────────────────
create or replace function public.project_staff(p_id text)
  returns table (kind text, email text, display_name text)
  language plpgsql stable security definer set search_path = public
  as $$
begin
  if not public.has_role('member', 'moderator', 'admin') then
    return;
  end if;

  return query
  select s.kind, s.email,
         coalesce(nullif(btrim(p.display_name), ''), s.email) as display_name
    from (select 'moderator'::text as kind, unnest(pr.moderators) as email
            from public.projects pr where pr.id = p_id
          union all
          select 'treasurer'::text, unnest(pr.treasurers)
            from public.projects pr where pr.id = p_id) s
    left join public.profiles p on p.email = s.email
   order by s.kind, display_name;
end $$;

-- ── დამხმარე: სია გაიწმინდოს და შემოწმდეს ───────────────────────────────
-- ცარიელი სტრიქონები და გამეორებები ინტერფეისიდან მოდის; შემოწმება ერთ
-- ადგილას რომ იყოს, შექმნაც და დანიშვნაც ამას იძახებს.
create or replace function public.clean_staff(p_emails text[], p_role text)
  returns text[]
  language plpgsql stable security definer set search_path = public
  as $$
declare
  v_clean text[];
  v_bad   text;
begin
  select coalesce(array_agg(distinct lower(btrim(e))), '{}')
    into v_clean
    from unnest(coalesce(p_emails, '{}')) as e
   where nullif(btrim(e), '') is not null;

  select e into v_bad
    from unnest(v_clean) as e
   where not exists (select 1 from public.profiles
                      where email = e and role in ('member','moderator','admin'))
   limit 1;

  if v_bad is not null then
    raise exception '% დამტკიცებული მომხმარებელი უნდა იყოს: %', p_role, v_bad
      using errcode = '22023';
  end if;

  return v_clean;
end $$;

-- ── შექმნა ───────────────────────────────────────────────────────────────
drop function if exists public.create_project(text, text, numeric, numeric, text[], text, text);

create function public.create_project(
  p_name                 text,
  p_description          text,
  p_budget               numeric,
  p_amount_per_household numeric,
  p_cads                 text[],
  p_treasurers           text[] default '{}',
  p_moderators           text[] default '{}'
) returns text
  language plpgsql security definer set search_path = public
  as $$
declare
  v_id         text;
  v_found      integer;
  v_asked      integer := coalesce(array_length(p_cads, 1), 0);
  v_treasurers text[] := public.clean_staff(p_treasurers, 'ხაზინდარი');
  v_moderators text[] := public.clean_staff(p_moderators, 'მოდერატორი');
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

  v_id := 'PRJ-' || lpad(nextval('public.project_seq')::text, 3, '0');

  insert into public.projects (
    id, name, description, budget, amount_per_household,
    plot_cads, treasurers, moderators, status, created_by)
  values (
    v_id, btrim(p_name), nullif(btrim(coalesce(p_description, '')), ''),
    p_budget, p_amount_per_household, p_cads, v_treasurers, v_moderators,
    'draft', public.my_email());

  insert into public.audit_log (actor, action, cad, field, old_value, new_value)
  values (public.my_email(), 'project_create', v_id, 'name', null, btrim(p_name));

  return v_id;
end $$;

-- ── დანიშვნა ─────────────────────────────────────────────────────────────
drop function if exists public.set_project_staff(text, text, text);

create function public.set_project_staff(
  p_id         text,
  p_moderators text[] default '{}',
  p_treasurers text[] default '{}'
) returns public.projects
  language plpgsql security definer set search_path = public
  as $$
declare
  v_moderators text[] := public.clean_staff(p_moderators, 'მოდერატორი');
  v_treasurers text[] := public.clean_staff(p_treasurers, 'ხაზინდარი');
  v_row        public.projects;
begin
  if not public.has_role('admin') then
    raise exception 'დანიშვნა მხოლოდ ადმინს შეუძლია' using errcode = '42501';
  end if;

  update public.projects
     set moderators = v_moderators, treasurers = v_treasurers
   where id = p_id
  returning * into v_row;

  if v_row.id is null then
    raise exception 'პროექტი ვერ მოიძებნა: %', p_id using errcode = 'P0002';
  end if;

  -- დანიშვნა უფლების გარეშე ცარიელი ჟესტია. ჩამორთმევა აქ არ ხდება:
  -- კაცი სხვა პროექტზეც შეიძლება იყოს მოდერატორი.
  update public.profiles set role = 'moderator'
   where email = any(v_moderators) and role = 'member';

  insert into public.audit_log (actor, action, cad, field, old_value, new_value)
  values (public.my_email(), 'project_staff', p_id, 'moderators',
          null, array_to_string(v_moderators, ', ')),
         (public.my_email(), 'project_staff', p_id, 'treasurers',
          null, array_to_string(v_treasurers, ', '));

  return v_row;
end $$;
