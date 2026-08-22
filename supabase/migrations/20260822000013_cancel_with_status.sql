-- გადახდის გაუქმება არჩეული სტატუსით.
--
-- აქამდე წაშლის ტრიგერი სტატუსს „არ დარეკილაზე" აბრუნებდა. ეს
-- უსაფრთხო ნაგულისხმევია, მაგრამ ინფორმაციას კარგავს: თუ მეზობელი
-- თანხას დებდა და ჩანაწერი შეცდომით გაკეთდა, სწორი პასუხი „დებს"-ია
-- და არა „არ დარეკილა" — მოდერატორს კი ხელახლა დარეკვა მოუწევდა.
--
-- ორივე ცვლილება ერთ ტრანზაქციაშია: შუაში ჩავარდნა ვალდებულებას
-- წაშლილი ფულითა და ძველი სტატუსით დატოვებდა.
create or replace function public.cancel_payment(
  p_project_id text,
  p_cad        text,
  p_status     pledge_status
) returns integer
  language plpgsql security definer set search_path = public
  as $$
declare
  v_deleted integer;
begin
  if not (public.has_role('moderator', 'admin')
          or public.is_treasurer(p_project_id)) then
    raise exception 'ამ მოქმედების უფლება არ გაქვთ' using errcode = '42501';
  end if;
  if p_status = 'paid' then
    raise exception 'გაუქმების შემდეგ სტატუსი „გადახდილი" ვერ იქნება'
      using errcode = '22023';
  end if;

  delete from public.payments
   where project_id = p_project_id and cad = p_cad;
  get diagnostics v_deleted = row_count;

  if v_deleted = 0 then
    raise exception 'გასაუქმებელი გადახდა ვერ მოიძებნა' using errcode = 'P0002';
  end if;

  -- წაშლის ტრიგერმა სტატუსი უკვე დააბრუნა „არ დარეკილაზე"; აქ მას
  -- მოდერატორის არჩეულით ვცვლით, იმავე ტრანზაქციაში.
  update public.pledges
     set status = p_status
   where project_id = p_project_id and cad = p_cad;

  return v_deleted;
end $$;
