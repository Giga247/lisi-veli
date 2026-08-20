# კედრის უბანი — განთავსების სახელმძღვანელო

ეს დოკუმენტი აღწერს, როგორ გაშვდეს „კედრის უბანი"-ს სერვერი ნულიდან: Google Sheet-ის
შექმნიდან დეპლოის შემოწმებამდე. გაიარეთ ნაბიჯები თანმიმდევრობით, რეპოზიტორი წინ
გქონდეთ გახსნილი.

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

## Step 1 — Google Sheet-ის შექმნა და მონაცემების ჩასმა

1. Google Drive → New → Google Sheets. სახელი: `კედრის უბანი — ბაზა`
2. სამი ფურცელი შეიქმნას ზუსტად ამ სახელებით: `ნაკვეთები`, `მომხმარებლები`, `ლოგი`
3. `build/plots.csv` → File → Import → Replace current sheet → ფურცელი `ნაკვეთები`
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
ეს მნიშვნელობა შედის `apps-script/Code.js`-ის `CLIENT_ID` ცვლადში (Step 3) და
მოგვიანებით ასევე `js/config.js`-ში, საიდანაც ფრონტენდი კითხულობს მას
Google Sign-In-ისთვის.

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
პირველი: {"cad":"01.99.99.999.001",...}
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
ამ URL-ს Task 4-ის `js/config.js` გამოიყენებს, როგორც ფრონტენდის API endpoint-ს.

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

## შემაჯამებელი ცხრილი — რა სად წერია

| მნიშვნელობა | სად მიიღება | სად იწერება |
|---|---|---|
| Client ID | Step 2, Google Cloud Console | `apps-script/Code.js` → `CLIENT_ID`; მოგვიანებით `js/config.js` |
| Web App URL | Step 6, Apps Script Deploy | მოგვიანებით `js/config.js` (Task 4) |
