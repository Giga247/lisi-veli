-- ისტორიული გადახდები, რომლებიც `payments_mark_paid` ტრიგერამდე ჩაიწერა.
-- ტრიგერი მხოლოდ ახალ ჩანაწერებზე მუშაობს, ასე რომ უკვე შემოსული ფული
-- სტატუსში არ აისახებოდა და ეკრანზე ორი სხვადასხვა სიმართლე რჩებოდა.
update public.pledges g
   set status = 'paid'
 where status <> 'paid'
   and exists (select 1 from public.payments y
                where y.project_id = g.project_id and y.cad = g.cad);
