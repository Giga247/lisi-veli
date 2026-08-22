-- პროექტის რედაქტირება.
--
-- აქამდე პროექტი შექმნის შემდეგ ქვაში იყო ამოკვეთილი: ბიუჯეტის შეცდომას
-- ან სახელის შეცვლას ბაზაში ხელით ედავებოდნენ. ველების უმეტესობა
-- უწყინარია, ერთი კი არა — თანხა ოჯახიდან.
--
-- თანხის შეცვლისას უკვე გადახდილ ვალდებულებას არ ვეხებით: მეზობელმა
-- 1000 შემოიტანა და თუ წილს 1200-ზე გავზრდით, ის უცებ დავალიანებაში
-- აღმოჩნდება ისე, რომ არაფერი დაუშავებია. ვინც ჯერ არ გადაუხდია, მას
-- ახალი წილი ეხება — და ფუნქცია აბრუნებს, რამდენს შეეხო და რამდენს არა,
-- რომ ინტერფეისმა სიმართლე აჩვენოს და არა „შენახულია".
create or replace function public.update_project(
  p_id                   text,
  p_name                 text,
  p_description          text,
  p_budget               numeric,
  p_amount_per_household numeric,
  p_status               project_status
) returns json
  language plpgsql security definer set search_path = public
  as $$
declare
  v_old     public.projects;
  v_changed integer := 0;
  v_kept    integer := 0;
begin
  if not public.has_role('admin') then
    raise exception 'პროექტის რედაქტირება მხოლოდ ადმინს შეუძლია'
      using errcode = '42501';
  end if;
  if coalesce(btrim(p_name), '') = '' then
    raise exception 'პროექტის სახელი სავალდებულოა' using errcode = '22023';
  end if;
  if p_amount_per_household is null or p_amount_per_household <= 0 then
    raise exception 'თანხა ოჯახიდან დადებითი უნდა იყოს' using errcode = '22023';
  end if;

  select * into v_old from public.projects where id = p_id;
  if v_old.id is null then
    raise exception 'პროექტი ვერ მოიძებნა: %', p_id using errcode = 'P0002';
  end if;

  -- დაუმტკიცებელი პროექტი „მიმდინარეზე" ამ გზით ვერ გადავა: აქტიურობას
  -- `approve_project()` ანიჭებს, რომელიც ვალდებულებებსაც ქმნის.
  if v_old.status = 'draft' and p_status <> 'draft' then
    raise exception 'ჯერ დაამტკიცეთ პროექტი' using errcode = '22023';
  end if;

  update public.projects
     set name                 = btrim(p_name),
         description          = nullif(btrim(coalesce(p_description, '')), ''),
         budget               = p_budget,
         amount_per_household = p_amount_per_household,
         status               = p_status
   where id = p_id;

  if v_old.amount_per_household is distinct from p_amount_per_household then
    with touched as (
      update public.pledges pl
         set amount_due = p_amount_per_household
       where pl.project_id = p_id
         and not exists (select 1 from public.payments pa
                          where pa.project_id = pl.project_id and pa.cad = pl.cad)
      returning 1)
    select count(*) into v_changed from touched;

    select count(*) into v_kept
      from public.pledges pl
     where pl.project_id = p_id
       and exists (select 1 from public.payments pa
                    where pa.project_id = pl.project_id and pa.cad = pl.cad);
  end if;

  insert into public.audit_log (actor, action, cad, field, old_value, new_value)
  values (public.my_email(), 'project_update', p_id, 'status',
          v_old.status::text, p_status::text),
         (public.my_email(), 'project_update', p_id, 'amount_per_household',
          v_old.amount_per_household::text, p_amount_per_household::text);

  return json_build_object('id', p_id, 'repriced', v_changed, 'kept', v_kept);
end $$;
