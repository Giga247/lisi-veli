-- ფოტოების საცავი.
--
-- bucket **კერძოა**: ფოტოებზე მეზობლების სახლები და ეზოებია, და საჯარო
-- ბმული, რომელიც ერთხელ გაჟონავს, სამუდამოდ ღიაა. გვერდი ხელმოწერილ
-- URL-ებს იღებს, რომლებსაც ვადა აქვს.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('project-photos', 'project-photos', false, 10485760,
        array['image/jpeg','image/png','image/webp','image/heic'])
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- ნახვა — ყველა დამტკიცებულ მაცხოვრებელს; ატვირთვა და წაშლა — მხოლოდ
-- მათ, ვისაც პროექტის შექმნა შეუძლია.
create policy project_photos_read on storage.objects
  for select to authenticated
  using (bucket_id = 'project-photos'
         and public.has_role('member','moderator','admin'));

create policy project_photos_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'project-photos'
              and public.has_role('moderator','admin'));

create policy project_photos_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'project-photos'
         and public.has_role('moderator','admin'));

-- ტესტებმა მიმდევრობა წინ წასწია. ნამდვილი პროექტი ჯერ არცერთია, ასე რომ
-- პირველი მაინც PRJ-001 იქნება.
alter sequence public.project_seq restart with 1;
