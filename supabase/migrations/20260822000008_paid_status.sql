-- გადახდა → სტატუსი „გადახდილია", ავტომატურად.
--
-- ეს ბაზაშია და არა კლიენტში, რომ ორ ჩანაწერს შორის შეუთანხმებლობა
-- ვერ გაჩნდეს: გადახდა რომ არსებობდეს და სტატუსი სხვას ამბობდეს,
-- ეკრანზე ორი სხვადასხვა სიმართლე დარჩებოდა.
create or replace function public.mark_pledge_paid() returns trigger
  language plpgsql security definer set search_path = public
  as $$
begin
  update public.pledges
     set status = 'paid'
   where project_id = new.project_id
     and cad = new.cad
     and status <> 'paid';
  return null;
end $$;

create trigger payments_mark_paid
  after insert on public.payments
  for each row execute function public.mark_pledge_paid();

-- გადახდის ფორმა აღარ ითხოვს ნაღდი/უნაღდოს — სვეტი რჩება (ძველი
-- ჩანაწერები), მაგრამ ახალი ჩანაწერები მას აღარ ავსებენ.
comment on column public.payments.method is
  'აღარ გამოიყენება — ფორმიდან მოიხსნა 2026-08-22';
