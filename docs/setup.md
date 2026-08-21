# კედრის უბანი — განთავსების სახელმძღვანელო

ეს დოკუმენტი აღწერს, როგორ გაშვდეს „კედრის უბანი" ნულიდან: მონაცემების
მომზადებიდან და Google Sheet-ის შექმნიდან იმ მომენტამდე, როცა საიტი ცოცხალ
`github.io` მისამართზე იხსნება და მეზობლების მოწვევა შეიძლება. გაიარეთ ნაბიჯები
თანმიმდევრობით, რეპოზიტორი წინ გქონდეთ გახსნილი.

ნაბიჯების რუკა: **Step 0** მონაცემები → **Step 1** Sheet → **Step 2** OAuth →
**Step 3-5** Apps Script → **Step 6-7** დეპლოი და შემოწმება → **Step 8**
`js/config.js` → **Step 9** GitHub Pages. Step 8-ის და 9-ის გარეშე გაქვთ მომუშავე
**სერვერი**, მაგრამ არა **საიტი** — გვერდი, რომელსაც მეზობელი გახსნის, ჯერ არ
არსებობს.

## რატომ არის აგებული ასე

- **უსაფრთხოება ტოკენით, არა Apps Script-ის წვდომის პარამეტრით.** განთავსება
  ხდება „Execute as: Me" + „Who has access: Anyone" — ეს ჟღერს არაუსაფრთხოდ, მაგრამ
  არაა: „Anyone" მხოლოდ იმას ნიშნავს, რომ ნებისმიერს შეუძლია მოთხოვნის გაგზავნა,
  არა Sheet-ის ნახვა. Sheet კვლავ პირადია — მასთან წვდომა მხოლოდ თავად სკრიპტს
  აქვს (Execute as: Me), ხოლო სკრიპტი ყოველ მოთხოვნაზე ამოწმებს Google-ის ID
  token-ს `verifyToken`-ით — თუ ტოკენი არასწორია, ვადაგასულია, ან სხვა
  აპლიკაციისთვისაა გაცემული (`aud` არ ემთხვევა ჩვენს `CLIENT_ID`-ს), მოთხოვნა
  `UNAUTHENTICATED`-ით იბლოკება Sheet-თან მისვლამდე. `aud`-ის შემოწმების გარეშე
  ნებისმიერი Google ანგარიშით შესული ადამიანის ტოკენი — თუნდაც სულ სხვა საიტზე
  მიღებული — მიღებული იქნებოდა და მთელი ბაზა ყველასთვის ღია გახდებოდა.
- **ოპტიმისტური კონკურენტულობა.** `updatePlot` მოითხოვს `expected_updated_at`-ს
  როგორც სტრიქონს (არასდროს-განახლებული რიგისთვის — ცარიელი სტრიქონი `""`).
  `null`-ი ან ველის არარსებობა `VALIDATION`-ის შეცდომაა — კლიენტს არ შეუძლია ეს
  შემოწმება „გვერდის ავლით" ჩაუყაროს ცარიელი მნიშვნელობა და ამით სხვისი
  პარალელური რედაქტირება ჩუმად წაშალოს.
- **`Content-Type: text/plain;charset=utf-8`, არა `application/json`.** Apps
  Script-ის Web App არ პასუხობს CORS preflight (`OPTIONS`) მოთხოვნას. თუ
  კლიენტმა (ბრაუზერმა) `application/json`-ით გაგზავნა მოთხოვნა, ეს
  „non-simple" request-ად ითვლება და ბრაუზერი წინასწარ `OPTIONS`-ს
  გააგზავნის, რომელსაც endpoint პასუხს ვერასდროს გასცემს — მოთხოვნა
  CORS-ის შეცდომით ჩავარდება. `text/plain`-ით გაგზავნილი მოთხოვნა კი
  „simple request"-ია და preflight საერთოდ არ ხდება; სხეული მაინც
  ვალიდური JSON-ია და `JSON.parse(e.postData.contents)`-ით იკითხება
  `doPost`-ში.

## Step 0 — CSV-ების აწყობა (`build/` საქაღალდე)

Step 1 სამ ფაილს ითხოვს — `build/plots.csv`, `build/users.csv`, `build/log.csv`.
**რეპოზიტორიაში ისინი არ დევს:** `build/` `.gitignore`-შია (იმპორტის შედეგი
Sheet-ში იდება, არა git-ში), ამიტომ ახალ კლონში ეს საქაღალდე საერთოდ არ იქნება.
ისინი ერთჯერადი სკრიპტით იქმნება `.xlsx`-ისა და `.geojson`-ის საწყისი
ფაილებიდან, რომლებიც რეპოზიტორიის ძირშია.

1. საჭიროა **Python 3** (macOS-ზე უკვე დაყენებულია) და ერთი პაკეტი —
   `openpyxl`, რომლითაც სკრიპტი `.xlsx`-ს კითხულობს:

   ```bash
   python3 -m pip install --user openpyxl
   ```

   ეს ერთადერთი გარე დამოკიდებულებაა მთელ პროექტში და **მხოლოდ ამ ერთჯერად
   იმპორტს სჭირდება** — თავად საიტს, სერვერს და `node --test` ტესტებს არანაირი
   პაკეტი არ სჭირდება.

2. რეპოზიტორიის ძირიდან:

   ```bash
   python3 tools/import.py
   ```

Expected (რეზიუმე ტერმინალში):

```
--- იმპორტის რეზიუმე ---
ნაკვეთი:            71
მფლობელით:          71
პოლიგონით:          66
პოლიგონის გარეშე:   5  ['01.99.999.999', '99.99.99.001', ...]
ფართობის გარეშე:    1  ['01.99.999.999']
ქუჩის გარეშე:       5  ['01.99.999.999', '99.99.99.001', ...]
დუბლიკატი კოდი:     1  ['99.99.99.003']
დუბლიკატი geojson-ში: 0  []
geojson feature კოდის გარეშე: 0
```

შემდეგ `build/` საქაღალდეში სამივე ფაილი უნდა იყოს:

```bash
ls build/
# log.csv  plots.csv  users.csv
```

`users.csv` და `log.csv` განზრახ მხოლოდ სათაურების რიგს შეიცავს — ისინი
ფურცლების სვეტებს აწყობს, მონაცემი მოგვიანებით ივსება (ადმინის რიგი Step 1.7-ში,
ლოგი — თავად აპლიკაციით).

**სკრიპტი იდემპოტენტურია** — ხელახლა გაშვება იმავე შედეგს იძლევა, ამიტომ თუ
გაუგებრობა მოხდა, უბრალოდ ხელახლა გაუშვი.

**თუ `ModuleNotFoundError: No module named 'openpyxl'`** — 1-ლი პუნქტის `pip`
ბრძანება არ გაშვებულა ან სხვა Python-ში დაინსტალირდა; სცადე
`python3 -m pip install --user openpyxl` ზუსტად ამ ფორმით (`python3 -m pip`,
არა `pip`).

## Step 1 — Google Sheet-ის შექმნა და მონაცემების ჩასმა

1. Google Drive → New → Google Sheets. სახელი: `კედრის უბანი — ბაზა`
2. სამი ფურცელი შეიქმნას ზუსტად ამ სახელებით: `ნაკვეთები`, `მომხმარებლები`, `ლოგი`
3. `build/plots.csv` (Step 0-ში შექმნილი) → File → Import → Replace current
   sheet → ფურცელი `ნაკვეთები`
4. `build/users.csv` → იგივე, ფურცელი `მომხმარებლები`
5. `build/log.csv` → იგივე, ფურცელი `ლოგი`
6. **გაზიარება: არავისთვის.** არც „Publish to web", არც ბმულით წვდომა.
7. `მომხმარებლები` ფურცელში ხელით ჩაიწეროს **პირველი მონაცემთა რიგი — ანუ მე-2
   რიგი, სათაურების ქვემოთ.** სათაურები უკვე დევს 1-ლ რიგში (Step 1.4-ის CSV
   import-იდან) — **ისინი არ გადაიწეროს**, ადმინის ჩანაწერი მათ ქვემოთ, მე-2
   რიგში დაემატოს:

   | მეილი | როლი | ქუჩა | სახელი გვარი | საკადასტრო კოდი | მოთხოვნის თარიღი | დამტკიცების თარიღი | დამამტკიცებელი |
   |---|---|---|---|---|---|---|---|
   | `g.gabriadze@gmail.com` | `admin` | | გიგა გაბრიაძე | | | | |

   **ამის გარეშე ადმინი არავინ იქნება და სისტემაში ვერავინ შევა.** ხოლო თუ
   შეცდომით 1-ლი რიგის სათაურები წაიშალა/გადაიწერა — `mapHeaders` ვეღარ
   ცნობს სვეტებს, `readUsers()` ცარიელს დააბრუნებს და **არავინ ვერასდროს
   შევა** (მათ შორის ადმინიც). ასეთ შემთხვევაში საჭირო იქნება სათაურის
   რიგის ხელახლა ჩასმა `build/users.csv`-იდან.

## Step 2 — Google Cloud პროექტი და OAuth Client ID

1. https://console.cloud.google.com → New Project → `kedris-ubani`
2. APIs & Services → OAuth consent screen → External → აპლიკაციის სახელი
   `კედრის უბანი`, support email, developer email → Save
3. Audience → Publish app (თუ Testing-ში დარჩა, მხოლოდ ხელით დამატებული 100
   მომხმარებელი შეძლებს შესვლას)
4. Credentials → Create Credentials → OAuth client ID → Web application
5. **Authorized JavaScript origins:**
   - `https://<შენი-github-username>.github.io`
   - `http://localhost:8080` (ლოკალური ტესტირებისთვის; პროდაქშენში წაიშლება)
6. Client ID დაკოპირდეს — ის საჯაროა და კოდში იწერება

**Client ID:** `<ჩასვი აქ Step 2-ის შემდეგ>`
ეს ერთი და იგივე მნიშვნელობა **ორ ადგილას** იწერება: `apps-script/Code.js`-ის
`CLIENT_ID` ცვლადში (Step 3) და `js/config.js`-ის `CLIENT_ID`-ში (Step 8).
სერვერი მას ტოკენის `aud`-თან შესადარებლად იყენებს, ფრონტენდი — Google
Sign-In-ის ინიციალიზაციისთვის; თუ ორი მნიშვნელობა ერთმანეთს არ დაემთხვა,
შესვლა `UNAUTHENTICATED`-ით ჩავარდება.

## Step 3 — Apps Script პროექტის შექმნა და კოდის ჩასმა

1. Sheet-ში: Extensions → Apps Script
2. `Code.gs` ფაილში ჩაისვას `apps-script/Code.js`-ის მთელი შიგთავსი
3. `CLIENT_ID` შეივსოს Step 2-ის მნიშვნელობით (თავიდანვე `ჩასვი-შენი-client-id...`
   წერია — ის სპეციალურად აჩერებს `smokeTest()`-ს, სანამ არ შეცვლი)
4. ახალი ფაილი `lib.gs` — იხილეთ Step 4
5. Save

## Step 4 — `lib.js`-ის ჩასმა `lib.gs`-ად და `Lib_` alias-ები

Apps Script-ს მოდულები არ აქვს — ყველა ფაილი ერთ სივრცეშია. Apps Script-ის
რედაქტორში შეიქმნას ახალი ფაილი სახელით **`lib.gs`** და მასში ჩაისვას
`apps-script/lib.js`-ის მთელი შიგთავსი უცვლელად (ეს ფაილი Node-ის ტესტებითაცაა
დაფარული — ტესტირებადი ლოგიკა ცალკეა).

`lib.gs`-ის **ბოლოში** დამატებით ჩაისვას ეს ბლოკი — Apps Script-ის ერთიან
სივრცეში სახელების კონფლიქტის (`lib.js`-ის ფუნქციები Code.gs-ის ფუნქციებთან) თავიდან
ასაცილებლად:

```javascript
// Apps Script-ის ერთიან სივრცეში სახელების გამიჯვნა
const Lib_HEADER_MAP = HEADER_MAP;
const Lib_mapHeaders = mapHeaders;
const Lib_normalizePhone = normalizePhone;
const Lib_parseGeometry = parseGeometry;
const Lib_isEditableField = isEditableField;
const Lib_checkPermission = checkPermission;
const Lib_verifyTokenClaims = verifyTokenClaims;
const Lib_diffFields = diffFields;
```

**ეს ბლოკი მხოლოდ Apps Script-ის რედაქტორის `lib.gs`-შია** — რეპოზიტორიის
`apps-script/lib.js`-ს ნუ დაუმატებ, რადგან ის Node-ის ტესტებში ჩართულია
(`node --test tests/*.test.js`) და Apps Script-ის გლობალები (`const mapHeaders`
და ა.შ. უკვე გამოცხადებული Node-ის `require`-ის კონტექსტში) იქ არ არსებობს.

## Step 5 — `smokeTest`-ის გაშვება რედაქტორიდან

Apps Script-ის რედაქტორში: ფუნქციის ჩამონათვალიდან `smokeTest` → Run. პირველ
ჯერზე მოითხოვს ავტორიზაციას (Sheet-თან წვდომაზე) — დაეთანხმე.

Expected (Execution log):

```
ნაკვეთი: 71
პოლიგონით: 66
კოორდინატით: 66
პირველი: {"cad":"01.99.999.999",...}
მომხმარებელი: 1
ადმინი ნაპოვნია: admin
smokeTest დასრულდა
```

**თუ „ადმინი ნაპოვნია: არა"** — დაბრუნდი Step 1-ის მე-7 პუნქტზე: `მომხმარებლები`
ფურცელში ადმინის რიგი არასწორადაა ჩაწერილი ან საერთოდ არ არის.

## Step 6 — განთავსება (Deploy)

Deploy → New deployment → Type: **Web app**
- Description: `v1`
- Execute as: **Me**
- Who has access: **Anyone**

Deploy → Web app URL დაკოპირდეს (ფორმა: `https://script.google.com/macros/s/…/exec`).

**Web App URL:** `<ჩასვი აქ Deploy-ის შემდეგ>`
ეს მისამართი Step 8-ში `js/config.js`-ის `API_URL`-ში ჩაიწერება — ფრონტენდი
ყველა მოთხოვნას სწორედ აქ აგზავნის.

### ყველაზე ხშირი შეცდომა — კოდის განახლება

**კოდის ცვლილების შემდეგ Save საკმარისი არაა.** Apps Script-ის Save მხოლოდ
რედაქტორში ინახავს ცვლილებას — ცოცხალ (`.../exec`) URL-ს ის არაფერს ეხება, რადგან
დეპლოი „გაყინული" ვერსიაა. ცოცხალი endpoint-ის განახლებისთვის საჭიროა:

**Deploy → Manage deployments → Edit (✎) → Version: New version → Deploy.**

წინააღმდეგ შემთხვევაში მუშაობ ძველ, გაუნახლებელ კოდზე და ვერ მიხვდები, რატომ არ
სჩანს შენი ცვლილება.

## Step 7 — endpoint-ის შემოწმება `curl`-ით

არასწორი ტოკენით — უნდა დაბრუნდეს `UNAUTHENTICATED`. ეს ამტკიცებს, რომ
მარშრუტიზაცია და ტოკენის შემოწმება მუშაობს, რეალური ტოკენის გარეშე:

```bash
curl -sL -X POST "<WEB_APP_URL>" \
  -H 'Content-Type: text/plain;charset=utf-8' \
  -d '{"idToken":"არასწორი","action":"plots"}'
```

Expected:

```json
{"ok":false,"error":"UNAUTHENTICATED","message":"ტოკენი არასწორია"}
```

ტოკენის გარეშე:

```bash
curl -sL -X POST "<WEB_APP_URL>" \
  -H 'Content-Type: text/plain;charset=utf-8' \
  -d '{"action":"plots"}'
```

Expected:

```json
{"ok":false,"error":"UNAUTHENTICATED","message":"გთხოვთ შეხვიდეთ Google-ით"}
```

**თუ HTML ბრუნდება JSON-ის ნაცვლად** — დეპლოის „Who has access" არ არის
დაყენებული „Anyone"-ზე. დაუბრუნდი Step 6-ს, Manage deployments → Edit-ში
შეამოწმე პარამეტრი და გააკეთე New version.

## Step 8 — `js/config.js`-ის შევსება

აქამდე მუშა **სერვერი** გვაქვს. საიტს ჯერ არ იცის, სად უნდა დარეკოს და რომელი
Google აპლიკაციით შევიდეს — ეს ორი მნიშვნელობა ერთადერთ ფაილში წერია.

გახსენი `js/config.js`. ის ასე გამოიყურება:

```javascript
const CONFIG = {
  CLIENT_ID: 'ჩასვი-შენი-client-id.apps.googleusercontent.com',
  API_URL: 'https://script.google.com/macros/s/ჩასვი-შენი-id/exec',
};
```

ჩაანაცვლე **ორივე სტრიქონი მთლიანად**:

| ველი | საიდან | ფორმა |
|---|---|---|
| `CLIENT_ID` | Step 2, Google Cloud Console → Credentials → OAuth client ID | `1234…-abc….apps.googleusercontent.com` |
| `API_URL` | Step 6, Apps Script → Deploy → Web app URL | `https://script.google.com/macros/s/AKfyc…/exec` |

შედეგი (მნიშვნელობები შენი იქნება):

```javascript
const CONFIG = {
  CLIENT_ID: '1234567890-abcdefghij.apps.googleusercontent.com',
  API_URL: 'https://script.google.com/macros/s/AKfycbx.../exec',
};
```

ორივე მნიშვნელობა **საჯაროა** და repo-ში ჩაწერა უსაფრთხოა: Client ID Google-ის
დიზაინითვე ღიაა, Web App URL კი სწორი ტოკენის გარეშე `UNAUTHENTICATED`-ის მეტს
არაფერს აბრუნებს (სწორედ ეს შეამოწმა Step 7-მა).

**სიტყვა `ჩასვი` მარკერია, არა შემთხვევითი ტექსტი.** სანამ ის რომელიმე
მნიშვნელობაში რჩება, საიტი შესვლას საერთოდ არ ცდილობს და ეკრანზე წერს, რომ
კონფიგურაცია არ არის შევსებული — ეს იმის ნაცვლად, რომ Google-ის ღილაკი ჩუმად
გაფუჭებული იყოს. ანალოგიურად სერვერზე: `smokeTest()` პლეისჰოლდერზე
გამონაკლისს აგდებს (Step 5).

## Step 9 — GitHub repo და GitHub Pages

> ⚠️ **push-ამდე წაიკითხე — ისტორია ჯერ არ არის გასუფთავებული.**
>
> სამუშაო ხე სუფთაა, მაგრამ **44 commit-იდან 41 ჯერ კიდევ შეიცავს**
> მეზობლების ნამდვილ სახელებს და საკადასტრო კოდებს (ტესტების ძველ
> ფიქსტურებში). `git push`-ს ისტორიაც მიყვება — `git log -p` ყველას
> შეუძლია. სანამ ამას არ მოაგვარებ, `git push` **ნუ გააკეთებ**.
>
> ორი გზა:
> - **სუფთა ტოტი:** `git checkout --orphan publish && git commit`
>   → GitHub-ზე მიდის მხოლოდ ერთი სუფთა commit, სრული ისტორია `main`-ზე
>   ლოკალურად რჩება. არაფერი იშლება.
> - **ისტორიის გადაწერა:** `git filter-branch`-ით ყველა commit სუფთავდება,
>   commit-ები რჩება, მაგრამ SHA-ები იცვლება.
>
> სარეზერვო ნიშნული ორივე შემთხვევისთვის: `backup/pre-pii-rewrite`.


**ეს ნაბიჯი შენ თავად უნდა შეასრულო** — რეპოზიტორის შექმნა და push შენი
ანგარიშის ქვეშ ხდება.

1. https://github.com/new → Repository name: `kedris-ubani` (ან სხვა სახელი,
   მაგრამ დაიმახსოვრე — ის მისამართში გამოჩნდება) → **Public** → Create.
   Public აუცილებელია: უფასო GitHub Pages პირად რეპოზიტორიაზე არ მუშაობს.
   საიდუმლო აქ არაფერია — იხ. Step 8.
2. ლოკალურ საქაღალდეში (Step 8-ის ცვლილება ჯერ დაკომიტე):

   ```bash
   git add js/config.js
   git commit -m "config: რეალური Client ID და Web App URL"

   git remote add origin https://github.com/<შენი-username>/kedris-ubani.git
   git push -u origin main
   ```

   თუ ბრანჩი `main` არ ჰქვია, გამოიყენე შენი ბრანჩის სახელი; Pages-ს Step 9.3-ში
   იმავე ბრანჩს მიუთითებ.
3. რეპოზიტორიაში: **Settings → Pages** → Source: **Deploy from a branch** →
   Branch: `main`, საქაღალდე `/ (root)` → Save. build-პროცესი არ არის — საიტი
   სტატიკურია და `index.html` ძირშივე დევს.
4. დაელოდე 1-2 წუთს (პირველი გამოქვეყნება ნელია), შემდეგ გახსენი:

   ```
   https://<შენი-username>.github.io/kedris-ubani/
   ```

**შეამოწმე, რომ Step 2-ის origin ზუსტად ემთხვევა.** Google-ის „Authorized
JavaScript origins" ველში უნდა ეწეროს **მხოლოდ სქემა და ჰოსტი** —
`https://<შენი-username>.github.io`, **გზის (`/kedris-ubani`) გარეშე.** თუ იქ
გზაც მიაწერე, Google ორიგინს არ ცნობს და შესვლის ღილაკი ჩუმად ვერაფერს
გააკეთებს. origin-ის შეცვლის შემდეგ ცვლილებას რამდენიმე წუთი სჭირდება.

**თუ გვერდი 404-ს აბრუნებს** — Pages ჯერ არ გამოქვეყნებულა (Settings → Pages
გვერდის თავში აჩვენებს სტატუსს), ან რეპოზიტორი Private-ია, ან ბრანჩი/საქაღალდე
არასწორად აირჩა.

**თუ გვერდი იხსნება, მაგრამ „კონფიგურაცია ჯერ არ არის შევსებული" წერია** —
Step 8 არ დაკომიტებულა ან არ დაიპუშა; `js/config.js` GitHub-ზე ჯერ კიდევ
პლეისჰოლდერებით დევს.

ამის შემდეგ გაიარე `docs/qa-checklist.md` — **სწორედ ამ `github.io`
მისამართზე**, არა localhost-ზე.

## შემაჯამებელი ცხრილი — რა სად წერია

| მნიშვნელობა | სად მიიღება | სად იწერება |
|---|---|---|
| Client ID | Step 2, Google Cloud Console | `apps-script/Code.js` → `CLIENT_ID` (Step 3) **და** `js/config.js` → `CLIENT_ID` (Step 8) |
| Web App URL | Step 6, Apps Script Deploy | `js/config.js` → `API_URL` (Step 8) |
| `github.io` origin | Step 9, GitHub Pages | Step 2-ის „Authorized JavaScript origins" (გზის გარეშე) |

დასრულების ნიშანი: `https://<შენი-username>.github.io/<repo>/` იხსნება, Google-ით
შესვლა მუშაობს და ცხრილში 71 ნაკვეთი ჩანს. შემდეგი — `docs/qa-checklist.md`.
