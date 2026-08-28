-- ისტორიული `recorded_by` აუდიტ-ლოგიდან.
--
-- `pledges_stamp` ტრიგერი დღეიდან სწორად წერს, ვინ შეცვალა სტატუსი.
-- მაგრამ არსებულ 80 მწკრივს ველში ერთი და იგივე მეილი უწერია — იმ
-- ადმინისა, ვინც პროექტი დაამტკიცა და ვალდებულებები შექმნა. ცხრილი
-- „ვინც არ დადო" ამ ველს კითხულობს და ყველა მწკრივში ერთსა და იმავე
-- ადამიანს დაწერდა.
--
-- ნამდვილი პასუხი `audit_log`-შია: იქ 123 სტატუსის ცვლილება წერია
-- ხუთი სხვადასხვა ავტორისგან. ვიღებთ ბოლოს თითო ნაკვეთზე.
--
-- `audit_log.cad` პროექტს არ იცნობს — `audit_row_changes()` მხოლოდ
-- ნაკვეთის კოდს წერს. ამიტომ ჩამოწერა მხოლოდ იმ ნაკვეთებს ეხება,
-- რომლებიც ერთადერთ პროექტშია: ორ პროექტში მყოფისთვის ჩანაწერი
-- რომელს ეხება, ლოგიდან ვერ გაიგება და ცდომილება ხმაურზე უარესია.

-- ტრიგერი ამ დროით ითიშება: ის სწორედ იმ ორ ველს გადააწერდა,
-- რომელსაც ვასწორებთ, და შედეგად ყველგან „system" დაიწერებოდა.
alter table public.pledges disable trigger pledges_stamp;

with single_project as (
  select cad from public.pledges group by cad having count(*) = 1
),
last_touch as (
  select distinct on (l.cad) l.cad, l.actor, l.at
    from public.audit_log l
    join single_project s on s.cad = l.cad
   where l.action = 'setPledge' and l.field = 'status'
   order by l.cad, l.at desc
)
update public.pledges p
   set recorded_by = t.actor,
       recorded_at = t.at
  from last_touch t
 where p.cad = t.cad;

-- ვისზეც ლოგში ჩანაწერი არ არის, ის არავის შეუცვლია: ვალდებულება
-- პროექტის დამტკიცებისას გაჩნდა და ისე დარჩა. ასეთ მწკრივში
-- „ვის ესაუბრა" ცარიელი უნდა იყოს და არა ადმინის მეილი.
update public.pledges p
   set recorded_by = null,
       recorded_at = null
 where not exists (
   select 1 from public.audit_log l
    where l.cad = p.cad and l.action = 'setPledge' and l.field = 'status');

alter table public.pledges enable trigger pledges_stamp;
