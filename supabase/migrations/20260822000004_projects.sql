-- პროექტების რეალური მოდელი.
--
-- საწყისი სქემა ბიუჯეტის ოთხი განაწილების წესისთვის იყო აგებული
-- (ფართობის პროპორციულად, თანაბრად, ფიქსირებული, ნებაყოფლობით).
-- უბანი მხოლოდ ერთს იყენებს: თანხა ოჯახიდან, ხელით დაწერილი. გასაყოფი
-- აღარაფერია, ამიტომ `split_method` და მთელი განაწილების მექანიკა ქრება.

alter table public.projects drop constraint fixed_needs_amount;
alter table public.projects rename column fixed_amount to amount_per_household;
alter table public.projects
  drop column split_method,
  drop column streets,
  -- არჩევა ცალკეულ ნაკვეთამდე ჩადის: „ყველა", „ქუჩა" და „ცალცალკე"
  -- სამივე ერთსა და იმავე სიად ითარგმნება.
  add column plot_cads   text[] not null default '{}',
  add column approved_at timestamptz,
  add column approved_by text;

alter table public.projects
  alter column amount_per_household set not null,
  add constraint amount_positive check (amount_per_household > 0),
  add constraint approved_fields_together
    check ((approved_at is null) = (approved_by is null));

drop type split_method;

-- პროექტის ნომერი მიმდევრობიდან მოდის, არა `count(*)`-იდან: წაშლილი
-- პროექტი რომ ნომერს ათავისუფლებდეს, ორი პროექტი ერთ id-ს მიიღებდა.
create sequence public.project_seq;

-- ფოტოები. ბაზაში მხოლოდ გზა ინახება — თავად ფაილი Storage-შია.
create table public.project_photos (
  id           uuid primary key default gen_random_uuid(),
  project_id   text not null references public.projects(id) on delete cascade,
  path         text not null unique,
  sort         integer not null default 0,
  uploaded_by  text,
  uploaded_at  timestamptz not null default now()
);
create index project_photos_project_idx on public.project_photos (project_id, sort);

alter table public.project_photos enable row level security;
revoke all on public.project_photos from anon, authenticated;
grant select on public.project_photos to authenticated;
grant insert, delete on public.project_photos to authenticated;

create policy photos_read on public.project_photos
  for select to authenticated
  using (public.has_role('member','moderator','admin'));
create policy photos_write on public.project_photos
  for insert to authenticated with check (public.has_role('moderator','admin'));
create policy photos_delete on public.project_photos
  for delete to authenticated using (public.has_role('moderator','admin'));

-- დაუმტკიცებელი პროექტი მაცხოვრებელს არ უნდა უჩანდეს: ის ჯერ წინადადებაა,
-- არა გადაწყვეტილება.
drop policy projects_read on public.projects;
create policy projects_read on public.projects
  for select to authenticated
  using (public.has_role('moderator','admin')
         or (public.has_role('member') and status <> 'draft'));

-- ── შექმნა ───────────────────────────────────────────────────────────────
create or replace function public.create_project(
  p_name                 text,
  p_description          text,
  p_budget               numeric,
  p_amount_per_household numeric,
  p_cads                 text[]
) returns text
  language plpgsql security definer set search_path = public
  as $$
declare
  v_id    text;
  v_found integer;
  v_asked integer := coalesce(array_length(p_cads, 1), 0);
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

  -- უცნობი კოდი ჩუმად რომ გამოგვრჩეს, პროექტი ნაკლები კომლით
  -- გააქტიურდებოდა და სხვაობა მხოლოდ ფულის თვლისას გამოჩნდებოდა.
  select count(*) into v_found from public.plots where cad = any(p_cads);
  if v_found <> v_asked then
    raise exception 'არჩეულ ნაკვეთებში უცნობი საკადასტრო კოდია'
      using errcode = '22023';
  end if;

  v_id := 'PRJ-' || lpad(nextval('public.project_seq')::text, 3, '0');

  insert into public.projects (
    id, name, description, budget, amount_per_household,
    plot_cads, status, created_by)
  values (
    v_id, btrim(p_name), nullif(btrim(coalesce(p_description, '')), ''),
    p_budget, p_amount_per_household, p_cads, 'draft', public.my_email());

  insert into public.audit_log (actor, action, cad, field, old_value, new_value)
  values (public.my_email(), 'project_create', v_id, 'name', null, btrim(p_name));

  return v_id;
end $$;

-- ── დამტკიცება ───────────────────────────────────────────────────────────
-- სტატუსის შეცვლა და ვალდებულებების შექმნა ერთ ტრანზაქციაშია: „აქტიური"
-- პროექტი ვალდებულებების გარეშე ვერ გაჩნდება.
create or replace function public.approve_project(p_id text)
  returns integer
  language plpgsql security definer set search_path = public
  as $$
declare
  v_project public.projects;
  v_created integer;
begin
  if not public.has_role('admin') then
    raise exception 'დამტკიცება მხოლოდ ადმინს შეუძლია' using errcode = '42501';
  end if;

  select * into v_project from public.projects where id = p_id for update;
  if not found then
    raise exception 'პროექტი ვერ მოიძებნა' using errcode = 'P0002';
  end if;
  if v_project.status <> 'draft' then
    raise exception 'ეს პროექტი უკვე დამუშავებულია: %', v_project.status
      using errcode = '22023';
  end if;

  insert into public.pledges (project_id, cad, amount_due, status, recorded_by, recorded_at)
  select v_project.id, p.cad, v_project.amount_per_household,
         'not_contacted', public.my_email(), now()
  from public.plots p
  where p.cad = any(v_project.plot_cads);
  get diagnostics v_created = row_count;

  update public.projects
     set status = 'active', approved_at = now(), approved_by = public.my_email()
   where id = p_id;

  insert into public.audit_log (actor, action, cad, field, old_value, new_value)
  values (public.my_email(), 'project_approve', p_id, 'status', 'draft', 'active');

  return v_created;
end $$;
