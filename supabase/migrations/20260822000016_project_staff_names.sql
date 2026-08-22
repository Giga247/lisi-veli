-- პროექტის პასუხისმგებლების სახელები.
--
-- `projects`-ში მხოლოდ მეილი წერია, სახელი კი `profiles`-შია, რომელსაც
-- ადმინის გარდა ვერავინ კითხულობს — და სამართლიანად: იქ ყველა
-- მომხმარებლის როლი და მოთხოვნის ისტორიაა.
--
-- მაგრამ „ვის დავურეკო" საჯარო კითხვაა უბნისთვის. ამიტომ ორი კონკრეტული
-- ადამიანის სახელი ცალკე ფუნქციით გამოდის — მთელი ცხრილის გაღების
-- ნაცვლად.
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
    from (select 'moderator'::text as kind, pr.moderator as email from public.projects pr
           where pr.id = p_id and pr.moderator is not null
          union all
          select 'treasurer'::text, pr.treasurer from public.projects pr
           where pr.id = p_id and pr.treasurer is not null) s
    left join public.profiles p on p.email = s.email;
end $$;
