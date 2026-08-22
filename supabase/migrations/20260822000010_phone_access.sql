-- ტელეფონი მხოლოდ მათ, ვისაც დარეკვა ევალება.
--
-- აქამდე `authenticated`-ს მთელ ცხრილზე ჰქონდა `SELECT`, ანუ ნებისმიერი
-- დამტკიცებული მაცხოვრებელი ყველა მეზობლის ნომერს იღებდა — ეკრანზე ის
-- არ ჩანდა, მაგრამ პასუხში მოდიოდა. დამალვა ინტერფეისში დაცვა არ არის.
--
-- RLS სვეტებს ვერ ფილტრავს, ამიტომ უფლება სვეტობრივ დონეზე გადადის:
-- `phone`-ის გარდა ყველა სვეტი ღიაა, თავად `phone` კი — არავისთვის.

revoke select on public.plots from authenticated;

grant select (cad, street, num, address, area, purpose,
              first_name, last_name, lat, lon, geometry,
              source, note, updated_at, updated_by)
  on public.plots to authenticated;

-- ნომრები ცალკე მოთხოვნით მოდის და მხოლოდ მაშინ, თუ როლი უფლებას იძლევა.
-- `security definer` აუცილებელია: ფუნქციამ თავად უნდა წაიკითხოს ის სვეტი,
-- რომელზეც გამომძახებელს უფლება არ აქვს.
create or replace function public.plot_phones()
  returns table (cad text, phone text)
  language plpgsql stable security definer set search_path = public
  as $$
begin
  if not (public.has_role('moderator', 'admin')
          or exists (select 1 from public.projects
                      where treasurer = public.my_email())) then
    return;   -- ცარიელი ნაკრები, არა შეცდომა: ეს უფლების არქონაა და არა ხარვეზი
  end if;
  return query
    select p.cad, p.phone from public.plots p where p.phone is not null;
end $$;

revoke all on function public.plot_phones() from public, anon;
grant execute on function public.plot_phones() to authenticated;
