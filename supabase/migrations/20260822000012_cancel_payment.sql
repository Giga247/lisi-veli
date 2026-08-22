-- გადახდის გაუქმება.
--
-- „გადახდილია" სტატუსს ტრიგერი სვამს გადახდის ჩაწერისას. თუ ჩანაწერი
-- შეცდომით გაკეთდა (სხვა კომლს დააჭირეს), მისი გასწორება მხოლოდ ბაზაში
-- შეიძლება: ჩანაწერის წაშლა ინტერფეისიდან, სტატუსის უცვლელად
-- დატოვებით, ორ სხვადასხვა სიმართლეს დატოვებდა — ფული აღარაა, სტატუსი
-- კი ისევ „გადახდილია".
--
-- ამიტომ წაშლაც ტრიგერს მიჰყვება: თუ ამ ვალდებულებაზე გადახდა აღარ
-- დარჩა, სტატუსი ბრუნდება „არ დარეკილაზე" და მოდერატორი თავად ირჩევს
-- სწორს. ავტომატური გამოცნობა აქ ტყუილი იქნებოდა.

grant delete on public.payments to authenticated;

create policy payments_delete on public.payments
  for delete to authenticated
  using (public.has_role('moderator','admin')
         or public.is_treasurer(project_id));

create or replace function public.unmark_pledge_paid() returns trigger
  language plpgsql security definer set search_path = public
  as $$
begin
  if not exists (select 1 from public.payments
                  where project_id = old.project_id and cad = old.cad) then
    update public.pledges
       set status = 'not_contacted'
     where project_id = old.project_id and cad = old.cad
       and status = 'paid';
  end if;

  insert into public.audit_log (actor, action, cad, field, old_value, new_value)
  values (coalesce(public.my_email(), 'system'), 'payment_cancel',
          old.cad, old.project_id, old.amount::text, null);
  return null;
end $$;

create trigger payments_unmark_paid
  after delete on public.payments
  for each row execute function public.unmark_pledge_paid();
