-- ფულს მხოლოდ ხაზინდარი და ადმინი ეხება.
--
-- აქამდე მოდერატორსაც შეეძლო გადახდის ჩაწერა და გაუქმება — ეს იმ
-- ლოგიკას მიჰყვებოდა, რომ მოდერატორი ისედაც ცვლის სტატუსებს. მაგრამ
-- სტატუსი ზარის პასუხია და შეცდომა იაფად სწორდება, ფული კი ანგარიშია:
-- ვინც ჩაწერს, ის აგებს პასუხს ჯამზე. უბანში ეს ერთი ადამიანია —
-- პროექტის ხაზინდარი, პლუს ადმინი როგორც უკანასკნელი ინსტანცია.
--
-- მოდერატორს სტატუსებისა და ნაკვეთის რედაქტირების უფლება უცვლელად
-- რჩება; ეკრანიდან მხოლოდ გადახდის ჩამრთველი ქრება.

drop policy if exists payments_insert on public.payments;
create policy payments_insert on public.payments
  for insert to authenticated
  with check (public.has_role('admin')
              or public.is_treasurer(project_id));

drop policy if exists payments_delete on public.payments;
create policy payments_delete on public.payments
  for delete to authenticated
  using (public.has_role('admin')
         or public.is_treasurer(project_id));

-- გაუქმება `security definer`-ია და RLS-ს გვერდს უვლის — შემოწმება
-- თვითონ მასშია და ცალკე უნდა შევასწოროთ.
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
  if not (public.has_role('admin') or public.is_treasurer(p_project_id)) then
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

  update public.pledges
     set status = p_status
   where project_id = p_project_id and cad = p_cad;

  return v_deleted;
end $$;
