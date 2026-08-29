-- მომხმარებლის წაშლა — მხოლოდ ადმინს.
--
-- `blocked` როლი უკვე არსებობს და წვდომას კეტავს; წაშლა სხვას ნიშნავს —
-- ჩანაწერი სიიდან ქრება. სამუდამო ბანი ეს არ არის: `auth.users` რჩება
-- (მისი წაშლა service-role-ის უფლებას ითხოვს), ამიტომ თუ იგივე კაცი ისევ
-- შემოვა, ტრიგერი მას ახალ `pending` პროფილს გაუკეთებს და ადმინი ისევ
-- დაინახავს მოთხოვნას. სამუდამოდ დახურვა = `blocked`.

grant delete on public.profiles to authenticated;

-- საკუთარ თავს ვერავინ წაშლის: ერთადერთი ადმინი ერთი დაჭერით გარეთ
-- დარჩებოდა და პანელს ვეღარავინ გახსნიდა.
create policy profiles_delete_admin on public.profiles
  for delete to authenticated
  using (public.has_role('admin') and id <> auth.uid());

-- აუდიტში წაშლაც უნდა ჩანდეს. `audit_row_changes()` მხოლოდ update-ს
-- ემსახურება — ის შეცვლილ ველებზე დადის და წაშლაზე ვერაფერს იტყოდა.
create or replace function public.audit_profile_delete() returns trigger
  language plpgsql security definer set search_path = public
  as $$
begin
  insert into public.audit_log (actor, action, cad, field, old_value, new_value)
  values (coalesce(public.my_email(), 'system'), 'deleteUser',
          old.cad, 'user', old.email, null);
  return old;
end $$;

create trigger profiles_audit_delete after delete on public.profiles
  for each row execute function public.audit_profile_delete();
