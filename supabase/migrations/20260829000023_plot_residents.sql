-- მაცხოვრებელი და ნაკვეთი.
--
-- `profiles.cad` თავიდანვე იდგა — „ჩემი ნაკვეთი" ბლოკი სწორედ მას
-- კითხულობს — მაგრამ არსად ივსებოდა: ადმინის პანელს მხოლოდ როლი და
-- ქუჩა ჰქონდა. ახლა ადმინი ნაკვეთსაც ნიშნავს, და იგივე კავშირი
-- უკუმიმართულებით ნაკვეთის ბარათს მაცხოვრებელთა სიას აძლევს.

-- ── სახლის ნომერი ────────────────────────────────────────────────────
-- ნაკვეთიდან ნაწარმი ველი არ არის: რეესტრში ნომერი ხან აცდენილია, ხან
-- საერთოდ არ წერია, და ადმინს ხელით გასწორება უნდა შეეძლოს. ნაკვეთის
-- არჩევა მას მხოლოდ წინასწარ ავსებს.
alter table public.profiles add column num text;

grant update (num) on public.profiles to authenticated;

-- ── მიბმა მხოლოდ არსებულ ნაკვეთზე ────────────────────────────────────
-- უცხო გასაღების გარეშე წაშლილი ნაკვეთის კოდი პროფილში სამუდამოდ
-- დარჩებოდა და მაცხოვრებელი არარსებულ სახლზე „იცხოვრებდა".
-- ჯერ ვასუფთავებთ იმას, რასაც დღეს ვერაფერი შეესაბამება.
update public.profiles p set cad = null
 where p.cad is not null
   and not exists (select 1 from public.plots pl where pl.cad = p.cad);

alter table public.profiles
  add constraint profiles_cad_fkey
  foreign key (cad) references public.plots(cad) on delete set null;

-- სია ნაკვეთის მიხედვით იკითხება — ეს ინდექსი სწორედ იმ მოთხოვნისაა.
create index profiles_cad_idx on public.profiles (cad);

-- ── ნაკვეთის მაცხოვრებლები ───────────────────────────────────────────
-- `profiles`-ს მაცხოვრებელი ვერ კითხულობს და ვერც უნდა კითხულობდეს:
-- იქ ყველას როლი და მოთხოვნის ისტორიაა. ამიტომ იგივე ხერხი, რაც
-- `project_staff()`-სა და `actor_names()`-ს — ვიწრო `security definer`
-- ფუნქცია, რომელიც მხოლოდ იმას გამოიტანს, რაც ეკრანზე უნდა ეწეროს.
--
-- სახელს ყველა დამტკიცებული ხედავს: „ვინ ცხოვრობს ამ სახლში" მეზობლის
-- ჩვეულებრივი კითხვაა. მეილი კი საკონტაქტო მონაცემია და ტელეფონის
-- წესს მიჰყვება (იხ. `plot_phones()`) — მას მხოლოდ მოდერატორი და
-- ადმინი იღებს, დანარჩენს `null` მოსდის, ანუ ბრაუზერამდე არ ჩამოდის.
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
    from public.profiles pr
   where pr.cad = p_cad
     -- დაუმტკიცებელი მოთხოვნა და დაბლოკილი ანგარიში მაცხოვრებელი არ
     -- არის — ისინი ადმინის პანელის საქმეა და არა ნაკვეთის ბარათის.
     and pr.role in ('member', 'moderator', 'admin')
   order by 1;
end $$;

grant execute on function public.plot_residents(text) to authenticated;
