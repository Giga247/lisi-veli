# ლისი ველი — განთავსების სახელმძღვანელო

როგორ გაშვდეს „ლისი ველი" ნულიდან: Supabase-ის პროექტის შექმნიდან იმ
მომენტამდე, როცა საიტი ცოცხალ `github.io` მისამართზე იხსნება.

**ნაბიჯების რუკა:** Step 1 Supabase → Step 2 სქემა → Step 3 მონაცემები →
Step 4 Google-ის შესვლა → Step 5 `js/config.js` → Step 6 GitHub Pages →
Step 7 პირველი შესვლა.

## რატომ არის აგებული ასე

**უფლებებს ბაზა იცავს, არა კლიენტი.** ბრაუზერი პირდაპირ ელაპარაკება
Supabase-ს `anon` გასაღებით. ეს გასაღები საჯაროდაა განკუთვნილი და
`js/config.js`-ში ღიად წერია — ის თავისთავად არაფერს იძლევა: ექვსივე
ცხრილზე ჩართულია RLS და `anon` როლს ცხრილებზე `GRANT`-იც კი არ აქვს.
ორივე ბარიერი დამოუკიდებელია.

შესული მომხმარებლის უფლებებს პოლიტიკები წყვეტს:

| ვინ | რა შეუძლია |
|---|---|
| `pending` | არაფერი — ელოდება დამტკიცებას |
| `member` | ხედავს რეესტრს, პროექტებს და ვალდებულებებს |
| `moderator` | + ცვლის საკონტაქტო ველებს და სტატუსებს, ქმნის პროექტს |
| `admin` | + ამტკიცებს მომხმარებლებს, როლებს და პროექტებს |
| `blocked` | არაფერი |

**ნაკვეთის რედაქტირება სვეტების დონეზეა შეზღუდული.** `GRANT UPDATE`
მხოლოდ ცხრა ველზეა (სახელი, გვარი, ტელეფონი, ქუჩა, N, მისამართი,
ფართობი, დანიშნულება, შენიშვნა). `cad`-ის ან `geometry`-ის შეცვლა
კლიენტისთვის უბრალოდ არ არსებობს.

**`service_role` გასაღები არასოდეს არ უნდა მოხვდეს `js/`-ში.** ის RLS-ს
გვერდს უვლის.

---

## Step 1 — Supabase-ის პროექტი

1. [supabase.com](https://supabase.com) → ანგარიში → ორგანიზაცია → პროექტი
2. რეგიონი: **eu-central-1** (თბილისთან ყველაზე ახლოს)
3. შეინახეთ DB პაროლი
4. Account → Access Tokens → ახალი ტოკენი (`sbp_...`)

შექმენით `.env.local` პროექტის ფესვში — ის `.gitignore`-შია:

```
SUPABASE_ACCESS_TOKEN=sbp_...
SUPABASE_PROJECT_REF=<20 ასო პროექტის URL-იდან>
GOOGLE_CLIENT_SECRET=GOCSPX-...
```

## Step 2 — სქემა

მიგრაციები `supabase/migrations/`-შია და თანმიმდევრობით უნდა გაეშვას:

```sh
for f in supabase/migrations/*.sql; do tools/sbsql.sh "$f"; done
```

`tools/sbsql.sh` SQL-ს Management API-ით უშვებს და ტოკენს `.env.local`-იდან
კითხულობს. შემოწმება:

```sh
echo "select count(*) from public.plots;" | tools/sbsql.sh
```

## Step 3 — მონაცემები

`build/*.csv` აეწყობა `.xlsx`-იდან და `.geojson`-იდან:

```sh
python3 -m pip install --user openpyxl
python3 tools/import.py
python3 tools/seed_supabase.py | tools/sbsql.sh
```

გენერირებული SQL ფაილად არსად არ ინახება — ტელეფონები და სახელები
დისკზე მხოლოდ იქ რჩება, სადაც უკვე იყო.

## Step 4 — Google-ის შესვლა

Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client ID.
**Authorized redirect URIs**-ში დაამატეთ:

```
https://<project-ref>.supabase.co/auth/v1/callback
```

შემდეგ ჩართეთ provider Supabase-ში:

```sh
. ./.env.local
curl -X PATCH "https://api.supabase.com/v1/projects/$SUPABASE_PROJECT_REF/config/auth" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"external_google_enabled":true,
       "external_google_client_id":"<client id>",
       "external_google_secret":"'"$GOOGLE_CLIENT_SECRET"'",
       "site_url":"https://<user>.github.io/<repo>/",
       "uri_allow_list":"https://<user>.github.io/<repo>/**,http://localhost:8000/**"}'
```

`uri_allow_list`-ში localhost იმისთვის რჩება, რომ ლოკალურად ტესტირება
შეიძლებოდეს. მის გარეშე შესვლა მხოლოდ ცოცხალ საიტზე იმუშავებდა.

## Step 5 — `js/config.js`

ორივე მნიშვნელობა საჯაროა:

```js
const CONFIG = {
  SUPABASE_URL: 'https://<project-ref>.supabase.co',
  SUPABASE_ANON_KEY: '<anon key>',
};
```

გასაღები **publishable** ტიპისაა (`sb_publishable_...`), არა ძველი JWT.
Project Settings → API Keys, ან

```sh
. ./.env.local
curl -s -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  "https://api.supabase.com/v1/projects/$SUPABASE_PROJECT_REF/api-keys"
```

## Step 6 — GitHub Pages

Settings → Pages → Source: **Deploy from a branch** → `main` / `/ (root)`.

**ქეშირება:** `index.html`-ში ყველა `js/` და `css/` მისამართს `?v=N` აქვს.
ფაილის შეცვლისას ეს რიცხვი უნდა გაიზარდოს — თორემ ბრაუზერი ძველ ასლს
გამოიყენებს. `js/vendor/supabase.js` გამონაკლისია: მას ვერსია სახელშივე აქვს.

## Step 7 — პირველი შესვლა

გახსენით საიტი და შედით Google-ით.

**პირველი ოდესმე შემსვლელი ავტომატურად ხდება `admin`** — ვიღაცას ხომ
უნდა შეეძლოს დანარჩენების დამტკიცება. ყველა შემდეგი `pending`-ია და
ადმინის დადასტურებას ელოდება („ადმინი" → როლის შეცვლა).

შემდეგ გაიარეთ `docs/qa-checklist.md`.

## ლოკალურად გაშვება

```sh
python3 -m http.server 8000
```

npm-პაკეტები არსად არ არის საჭირო. ტესტები:

```sh
node --test tests/*.test.js
python3 tools/test_import.py -v
```
