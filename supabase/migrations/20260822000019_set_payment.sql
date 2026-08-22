-- შემოსული თანხის ჩაწერა და შესწორება.
--
-- ჩაწერა ვალდებულების წილს იმეორებდა: 1000 ეწერა, 1000 იწერებოდა.
-- სინამდვილეში მეზობელი ხან ნაკლებს დებს, ხან მეტს — და ხაზინდარმა
-- ის უნდა ჩაწეროს, რაც ხელში მიიღო, და არა ის, რაც ეკუთვნოდა.
--
-- ცალკე ფუნქცია და არა უბრალო `insert`: შესწორება ორ ნაბიჯს ითხოვს —
-- ძველის წაშლას და ახლის ჩაწერას — და შუაში ჩავარდნა ვალდებულებას
-- საერთოდ უფულოდ დატოვებდა. ერთი ტრანზაქცია ამას გამორიცხავს.
--
-- სტატუსს ხელით არ ვსვამთ: წაშლის ტრიგერი მას „არ დარეკილაზე"
-- დააბრუნებს, ჩაწერისა კი ისევ „გადახდილზე" — ორივე ამავე
-- ტრანზაქციაში, ასე რომ საბოლოო მდგომარეობა სწორია.
create or replace function public.set_payment(
  p_project_id text,
  p_cad        text,
  p_amount     numeric,
  p_paid_on    date default current_date
) returns numeric
  language plpgsql security definer set search_path = public
  as $$
declare
  v_old numeric;
begin
  if not (public.has_role('admin') or public.is_treasurer(p_project_id)) then
    raise exception 'გადახდის ჩაწერის უფლება არ გაქვთ' using errcode = '42501';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'თანხა დადებითი უნდა იყოს' using errcode = '22023';
  end if;
  if not exists (select 1 from public.pledges
                  where project_id = p_project_id and cad = p_cad) then
    raise exception 'ვალდებულება ვერ მოიძებნა' using errcode = 'P0002';
  end if;

  select coalesce(sum(amount), 0) into v_old
    from public.payments
   where project_id = p_project_id and cad = p_cad;

  delete from public.payments
   where project_id = p_project_id and cad = p_cad;

  insert into public.payments (project_id, cad, amount, paid_on)
  values (p_project_id, p_cad, p_amount, coalesce(p_paid_on, current_date));

  insert into public.audit_log (actor, action, cad, field, old_value, new_value)
  values (public.my_email(), 'payment_set', p_cad, p_project_id,
          v_old::text, p_amount::text);

  return p_amount;
end $$;
