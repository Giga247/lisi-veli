-- ლისი ველი — საბაზისო სქემა.
-- Google Sheet-ის ექვსი ფურცელი ექვს ცხრილად. სვეტების სახელები ინგლისურად —
-- იგივე გასაღებები, რაც `apps-script/lib.js`-ის HEADER_MAP-ს ჰქონდა, ასე რომ
-- ფრონტენდის ობიექტები უცვლელი რჩება.

create type user_role      as enum ('pending','member','moderator','admin','blocked');
create type pledge_status  as enum ('not_contacted','paying','loan','declined');
create type split_method   as enum ('area','equal','fixed','free');
create type project_status as enum ('draft','active','done','cancelled');

-- მომხმარებლები. `id` პირდაპირ auth.users-ს მიჰყვება: Supabase Auth ქმნის
-- ჩანაწერს, ჩვენი ტრიგერი კი აქ სარკეს — როლით `pending`.
create table public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  email         text not null unique,
  display_name  text,
  role          user_role not null default 'pending',
  street        text,
  cad           text,
  requested_at  timestamptz not null default now(),
  approved_at   timestamptz,
  approved_by   text,
  constraint approved_fields_together
    check ((approved_at is null) = (approved_by is null))
);

-- ნაკვეთები. `cad` (საკადასტრო კოდი) ბუნებრივი პირველადი გასაღებია —
-- უნიკალურია, უცვლელი და ყველა სხვა ცხრილი მასზე მიუთითებს.
create table public.plots (
  cad         text primary key,
  street      text,
  num         text,
  address     text,
  area        numeric(12,2) check (area is null or area > 0),
  purpose     text,
  first_name  text,
  last_name   text,
  phone       text,
  lat         double precision check (lat is null or lat between -90 and 90),
  lon         double precision check (lon is null or lon between -180 and 180),
  geometry    jsonb,
  source      text,
  note        text,
  updated_at  timestamptz not null default now(),
  updated_by  text
);
create index plots_street_idx on public.plots (street);

-- პროექტები. `streets` აქ ნამდვილი მასივია — Sheet-ში მძიმეებით გამოყოფილი
-- სტრიქონი იყო, რომელსაც `projectStreets()` ყოველ წაკითხვაზე შლიდა.
create table public.projects (
  id            text primary key,
  name          text not null,
  description   text,
  budget        numeric(12,2) check (budget is null or budget >= 0),
  split_method  split_method not null default 'area',
  fixed_amount  numeric(12,2) check (fixed_amount is null or fixed_amount >= 0),
  streets       text[] not null default '{}',
  treasurer     text,
  starts_on     date,
  ends_on       date,
  status        project_status not null default 'draft',
  created_at    timestamptz not null default now(),
  created_by    text,
  constraint ends_after_starts
    check (starts_on is null or ends_on is null or ends_on >= starts_on),
  constraint fixed_needs_amount
    check (split_method <> 'fixed' or fixed_amount is not null)
);

-- ვალდებულებები. ერთი ნაკვეთი — ერთი პასუხი ერთ პროექტში.
create table public.pledges (
  project_id   text not null references public.projects(id) on delete cascade,
  cad          text not null references public.plots(cad)   on delete cascade,
  amount_due   numeric(12,2) check (amount_due is null or amount_due >= 0),
  status       pledge_status not null default 'not_contacted',
  recorded_by  text,
  recorded_at  timestamptz,
  primary key (project_id, cad)
);

-- გადახდები. ერთ ვალდებულებაზე რამდენიმე გადახდა შეიძლება.
create table public.payments (
  payment_id   uuid primary key default gen_random_uuid(),
  project_id   text not null references public.projects(id) on delete cascade,
  cad          text not null references public.plots(cad)   on delete cascade,
  amount       numeric(12,2) not null check (amount > 0),
  paid_on      date not null,
  method       text,
  note         text,
  recorded_by  text,
  recorded_at  timestamptz not null default now()
);
create index payments_project_cad_idx on public.payments (project_id, cad);

-- აუდიტ-ლოგი. Sheet-ში მას ხელით ავსებდა `appendLog()` — აქ ტრიგერი წერს,
-- ასე რომ გვერდის ავლა შეუძლებელია.
create table public.audit_log (
  id         bigint generated always as identity primary key,
  at         timestamptz not null default now(),
  actor      text,
  action     text not null,
  cad        text,
  field      text,
  old_value  text,
  new_value  text
);
create index audit_log_at_idx  on public.audit_log (at desc);
create index audit_log_cad_idx on public.audit_log (cad);
