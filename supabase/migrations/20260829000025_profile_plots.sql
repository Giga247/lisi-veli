-- ერთი მაცხოვრებელი — რამდენიმე ნაკვეთი.
--
-- `profiles.cad` ერთ სვეტად იდგა და ერთ სახლს გულისხმობდა. აღმოჩნდა, რომ
-- ერთი კაცი უბანში რამდენიმე ნაკვეთს ფლობს — ანუ კავშირი ერთი-ერთთან კი
-- არა, მრავალთანაა და ცალკე ცხრილს ითხოვს.
--
-- ძველი სვეტები (`cad`, `street`, `num`) ადგილზე რჩება და არ იშლება:
-- წაშლა შეუქცევადია, ხოლო `street`/`num`-ში ხელით აკრეფილი მისამართებია,
-- რომლებიც ზოგჯერ არცერთ ნაკვეთს არ ეკუთვნის. ინტერფეისი მათ აღარ
-- კითხულობს; `cad`-ს კი `setRole` პირველ მიბმულ ნაკვეთზე ინახავს, რომ
-- ძველი მონაცემი ახალს არ აცდეს.

create table public.profile_plots (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  cad        text not null references public.plots(cad)   on delete cascade,
  added_at   timestamptz not null default now(),
  primary key (profile_id, cad)
);

-- სია ორივე მხრიდან იკითხება: „ამ კაცის ნაკვეთები" და „ამ ნაკვეთის
-- მაცხოვრებლები". პირველს პირველადი გასაღები ფარავს, მეორეს — ეს ინდექსი.
create index profile_plots_cad_idx on public.profile_plots (cad);

alter table public.profile_plots enable row level security;
revoke all on public.profile_plots from anon, authenticated;
grant select, insert, delete on public.profile_plots to authenticated;

-- საკუთარს ყველა კითხულობს (რუკაზე „ჩემი ნაკვეთი" ამას ეყრდნობა),
-- სხვისას და ჩაწერას — მხოლოდ ადმინი.
create policy profile_plots_read_own on public.profile_plots
  for select to authenticated using (profile_id = auth.uid());
create policy profile_plots_read_admin on public.profile_plots
  for select to authenticated using (public.has_role('admin'));
create policy profile_plots_add_admin on public.profile_plots
  for insert to authenticated with check (public.has_role('admin'));
create policy profile_plots_del_admin on public.profile_plots
  for delete to authenticated using (public.has_role('admin'));

-- არსებული მიბმები ახალ ცხრილში.
insert into public.profile_plots (profile_id, cad)
select id, cad from public.profiles where cad is not null
on conflict do nothing;

-- ── აუდიტი ───────────────────────────────────────────────────────────
-- მიბმა და მოხსნა ლოგში ისევე უნდა ჩანდეს, როგორც აქამდე `cad`-ის
-- ცვლილება ჩანდა: ვინ ვის რომელ ნაკვეთზე მიაბა.
create or replace function public.audit_profile_plot() returns trigger
  language plpgsql security definer set search_path = public
  as $$
declare
  who text;
begin
  if tg_op = 'INSERT' then
    select email into who from public.profiles where id = new.profile_id;
    insert into public.audit_log (actor, action, cad, field, old_value, new_value)
    values (coalesce(public.my_email(), 'system'), 'setRole', new.cad,
            'მაცხოვრებელი', null, who);
    return new;
  end if;
  select email into who from public.profiles where id = old.profile_id;
  insert into public.audit_log (actor, action, cad, field, old_value, new_value)
  values (coalesce(public.my_email(), 'system'), 'setRole', old.cad,
          'მაცხოვრებელი', who, null);
  return old;
end $$;

create trigger profile_plots_audit
  after insert or delete on public.profile_plots
  for each row execute function public.audit_profile_plot();

-- ── ნაკვეთის მაცხოვრებლები ───────────────────────────────────────────
-- იგივე ფუნქცია, ოღონდ ერთი სვეტის ნაცვლად ცხრილზე დაყრდნობით.
create or replace function public.plot_residents(p_cad text)
  returns table (display_name text, email text)
  language plpgsql stable security definer set search_path = public
  as $$
begin
  if not public.has_role('member', 'moderator', 'admin') then
    return;
  end if;

  return query
  select coalesce(nullif(btrim(pr.display_name), ''),
                  split_part(pr.email, '@', 1)),
         case when public.has_role('moderator', 'admin') then pr.email end
    from public.profile_plots pp
    join public.profiles pr on pr.id = pp.profile_id
   where pp.cad = p_cad
     and pr.role in ('member', 'moderator', 'admin')
   order by 1;
end $$;
