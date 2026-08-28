-- ვინ ჩაწერა პასუხი — სახელით და არა მეილით.
--
-- „ვინც არ დადო" სიაში ბოლო სვეტი „ვის ჰქონდა კომუნიკაცია"-ა, და იქ
-- `nino@example.com` არ უნდა ეწეროს. `plot_history()` ამას თითო ნაკვეთზე
-- აკეთებს; ცხრილს კი ოცდაათივე მწკრივი ერთბაშად სჭირდება და ოცდაათი
-- ცალკე მოთხოვნა აზრი არ აქვს.
--
-- `profiles` მთლიანად არ იხსნება — იქ ყველა მაცხოვრებლის როლი და
-- მოთხოვნის ისტორიაა. გამოდის მხოლოდ ის სახელები, რომლებიც ისედაც
-- ჩანს ეკრანზე: ვინც ოდესმე პასუხი ან გადახდა ჩაწერა.
create or replace function public.actor_names()
  returns table (email text, display_name text)
  language plpgsql stable security definer set search_path = public
  as $$
begin
  if not (public.has_role('moderator', 'admin')
          or exists (select 1 from public.projects
                      where public.my_email() = any(treasurers))) then
    return;
  end if;

  return query
  with actors as (
    select pl.recorded_by as email from public.pledges pl
     where pl.recorded_by is not null
    union
    select pa.recorded_by from public.payments pa
     where pa.recorded_by is not null
  )
  select a.email,
         coalesce(nullif(btrim(p.display_name), ''),
                  split_part(a.email, '@', 1)) as display_name
    from actors a
    left join public.profiles p on p.email = a.email;
end $$;

grant execute on function public.actor_names() to authenticated;
