-- ვინ შეცვალა ბოლოს — ნაკვეთის ბარათზე.
--
-- ინფორმაცია ისედაც არსებობდა: `audit_log`-ს ყოველი ცვლილება ეწერა
-- ავტორის მეილითურთ. მაგრამ მას მხოლოდ ადმინი ხედავდა, საკუთარ
-- პანელში, ერთ გრძელ სიად — ანუ იმ ადგილას, სადაც კონკრეტულ ნაკვეთზე
-- პასუხის გასაცემად 200 სტრიქონი უნდა გადაათვალიერო.
--
-- აქ ორი რამ კეთდება: ჯერ ბეჭედი სწორდება, მერე ლოგი იხსნება იმდენად,
-- რამდენადაც ნაკვეთის ბარათს სჭირდება.

-- ── 1. ვალდებულების ბეჭედი ───────────────────────────────────────────────
-- `pledges.recorded_by` სქემაში დასაწყისიდან იყო, მაგრამ მას მხოლოდ
-- `approve_project` ავსებდა — სტატუსის ყოველი შემდგომი ცვლილება ველს
-- ხელუხლებლად ტოვებდა. ანუ სვეტი წერდა „ვინ შექმნა", თავს კი „ვინ
-- შეცვალა"-დ აჩვენებდა. `plots`-სა და `payments`-ს ასეთი ტრიგერი
-- პირველივე დღიდან ჰქონდა; ვალდებულებას გამორჩა.
create or replace function public.stamp_pledge_update() returns trigger
  language plpgsql security definer set search_path = public
  as $$
begin
  new.recorded_at := now();
  new.recorded_by := coalesce(public.my_email(), 'system');
  return new;
end $$;

drop trigger if exists pledges_stamp on public.pledges;
create trigger pledges_stamp
  before update on public.pledges
  for each row execute function public.stamp_pledge_update();

-- ── 2. ნაკვეთის ისტორია ──────────────────────────────────────────────────
-- `audit_log`-ის RLS ადმინზეა დაკეტილი და ასეც რჩება: იქ როლების
-- ცვლილებაც წერია და სხვა ნაკვეთების ტელეფონებიც. ერთი ნაკვეთის ჭრილი
-- კი იმ წრეს ეხსნება, ვინც ამ ნაკვეთის სტატუსს ისედაც ხედავს —
-- მოდერატორი, ადმინი და ნებისმიერი პროექტის ხაზინდარი. ზუსტად ისე,
-- როგორც `plot_phones()` აკეთებს.
--
-- სახელი აქვე გარდაიქმნება: `profiles` მოდერატორისთვის დაკეტილია,
-- ხოლო ბარათზე ადამიანის სახელი უნდა ეწეროს და არა მისი მეილი.
create or replace function public.plot_history(p_cad text, p_limit integer default 20)
  returns table (at timestamptz, actor text, actor_name text,
                 action text, field text, old_value text, new_value text)
  language plpgsql stable security definer set search_path = public
  as $$
begin
  if not (public.has_role('moderator', 'admin')
          or exists (select 1 from public.projects
                      where public.my_email() = any(treasurers))) then
    return;
  end if;

  return query
  select l.at, l.actor,
         coalesce(nullif(btrim(p.display_name), ''),
                  split_part(l.actor, '@', 1)) as actor_name,
         l.action, l.field, l.old_value, l.new_value
    from public.audit_log l
    left join public.profiles p on p.email = l.actor
   where l.cad = p_cad
   order by l.at desc
   limit least(greatest(coalesce(p_limit, 20), 1), 100);
end $$;

grant execute on function public.plot_history(text, integer) to authenticated;
