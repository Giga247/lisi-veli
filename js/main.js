/** გვერდის ჩატვირთვის ნაკადი: ტოკენი -> me -> ეკრანი. */
let CURRENT_USER = null;
let PLOTS = [];

async function afterSignIn() {
  UI.showScreen('loading');
  try {
    CURRENT_USER = await API.call('me');
  } catch (error) {
    await handleSignInError(error);
    return;
  }

  UI.el('whoami').textContent =
    CURRENT_USER.display_name || CURRENT_USER.email;
  if (CURRENT_USER.role === 'admin') UI.el('tab-admin').hidden = false;

  // აპის ჩარჩო ჩანს მონაცემების ლოდინშიც — თუ `plots` ჩავარდება, catch
  // ცხრილის პანელში მუდმივ შეტყობინებას წერს, არა უსასრულოდ ჩატვირთვის ეკრანს.
  UI.showScreen('app');
  UI.showTab('table');

  try {
    PLOTS = await API.call('plots');
    window.PLOTS = PLOTS;
    TableView.render(PLOTS, CURRENT_USER);
    MapView.render(PLOTS, CURRENT_USER);
    // პროექტები საკუთარ შეცდომას თავად წერს პანელში და `await`-ს არ
    // ელოდება — მისი ჩავარდნა რეესტრის ჩატვირთვას არ უნდა შეაჩეროს.
    ProjectsView.bind();
    ProjectsView.render(CURRENT_USER);
    if (CURRENT_USER.role === 'admin') AdminView.render();
  } catch (error) {
    UI.showError(error.message || 'მონაცემების ჩატვირთვა ვერ მოხერხდა');
    // ბანერი 6 წამში თავად იმალება. მის გარეშე ეკრანზე რჩებოდა ჩვეულებრივი
    // header სამი ტაბით, რომლებიც არაფერს აკეთებენ, და არცერთი ნიშანი იმისა,
    // რომ რაღაც ვერ მოხერხდა — ამიტომ პანელში მუდმივი კვალიც იწერება
    // (იგივე პატერნი, რაც js/admin.js-ს აქვს საკუთარი ჩავარდნისთვის).
    UI.el('panel-table').innerHTML =
      '<p>მონაცემები ვერ ჩაიტვირთა — გადატვირთეთ გვერდი.</p>';
  }
}

/**
 * `me`-ს შეცდომას მარშრუტავს მხოლოდ `.code`-ით — არასდროს შეტყობინების
 * ტექსტით, რომელიც სერვერზე ხვალ შეიძლება შეიცვალოს.
 */
async function handleSignInError(error) {
  if (error.code === 'NO_ACCOUNT') {
    // ანგარიში ჯერ არ არსებობს — მოთხოვნა ავტომატურად იგზავნება.
    try {
      await API.call('requestAccess');
      // ჩვეულებრივ requestAccess თავადაც "შეცდომად" აბრუნებს PENDING-ს
      // წარმატებული გაგზავნის შეტყობინებით (იხ. catch); success-ის ეს
      // ტოტი მხოლოდ თეორიული რბოლის-პირობის fallback-ია.
      UI.el('pending-message').textContent = 'მოთხოვნა გაგზავნილია. ადმინი დაგიდასტურებთ.';
    } catch (requestError) {
      UI.el('pending-message').textContent = requestError.message;
    }
    UI.showScreen('pending');
    return;
  }

  if (error.code === 'PENDING' || error.code === 'BLOCKED') {
    UI.el('pending-message').textContent = error.message;
    UI.showScreen('pending');
    return;
  }

  if (error.code === 'UNAUTHENTICATED') {
    // callWithRetry უკვე სცადა ჩუმი განახლება ერთხელ — აქამდე მისვლა
    // ნიშნავს, რომ სესია ნამდვილად ახალ შესვლას საჭიროებს. "მოთხოვნა
    // დამტკიცების პროცესშია" აქ ტყუილი იქნებოდა.
    UI.showScreen('signin');
    UI.showError(error.message);
    return;
  }

  // FORBIDDEN, NOT_FOUND, VALIDATION, CONFLICT, RATE_LIMIT, SERVER —
  // მოულოდნელია ამ წერტილში; არც ლოდინის და არც "ხელახლა შედი" ტექსტი
  // არ შეესაბამება, უბრალოდ ვაჩვენოთ შეცდომა და დავუბრუნოთ შესვლის ეკრანს.
  UI.showScreen('signin');
  UI.showError(error.message || 'შეცდომა მოხდა, სცადეთ თავიდან');
}

/**
 * `js/config.js` ჯერ პლეისჰოლდერებით არის შევსებული თუ არა.
 *
 * სერვერი ამას თავად იცავს — `smokeTest()` გამონაკლისს აგდებს, სანამ
 * `CLIENT_ID` არ შეიცვლება. კლიენტს ასეთი დაცვა არ ჰქონდა: GSI ცრუ
 * client id-ით ინიციალიზდებოდა, შესვლის ღილაკი ჩუმად ვერაფერს აკეთებდა
 * და მფლობელი ინგლისურ კონსოლის შეცდომას იღებდა სწორედ იმ მომენტში,
 * როცა ყველაზე ნაკლებად შეეძლო მისი ამოკითხვა.
 */
function configNotFilled() {
  return String(CONFIG.CLIENT_ID).indexOf('ჩასვი') !== -1 ||
    String(CONFIG.API_URL).indexOf('ჩასვი') !== -1;
}

/**
 * შესვლის ეკრანის ინტერაქტიული გეგმა.
 *
 * ავტორიზაციისგან დამოუკიდებელია — მონაცემი სტატიკური ფაილია და
 * მფლობელებს არ შეიცავს, ამიტომ ჩატვირთვისთანავე ეშვება. ჩავარდნაზე
 * ხმას არ იღებს: გეგმა შესვლის ეკრანის ილუსტრაციაა, არა მისი პირობა.
 */
function renderHeroPlan() {
  const host = document.getElementById('plan-hero');
  if (!host || typeof PlanView === 'undefined') return;
  PlanView.load().then(function (data) {
    PlanView.create(host, data, { sidebar: false });
    const count = document.getElementById('plan-hero-count');
    if (count) {
      count.textContent = data.streets.length + ' ქუჩა · ' +
        (data.parcels.length + data.noshape.length) + ' ნაკვეთი';
    }
  }).catch(function () { /* ილუსტრაციის გარეშეც შესვლა მუშაობს */ });
}

window.addEventListener('load', function () {
  renderHeroPlan();

  if (configNotFilled()) {
    UI.showScreen('signin');
    UI.el('signin-button').textContent =
      'კონფიგურაცია ჯერ არ არის შევსებული: js/config.js-ში CLIENT_ID და ' +
      'API_URL კვლავ პლეისჰოლდერებია. შეავსეთ ორივე docs/setup.md-ის ' +
      'მიხედვით (Step 8) და გადატვირთეთ გვერდი.';
    return;
  }

  const GSI_TIMEOUT_MS = 10000;
  const startedAt = Date.now();

  const timer = setInterval(function () {
    if (window.google && google.accounts && google.accounts.id) {
      clearInterval(timer);
      Auth.init(afterSignIn);
      UI.showScreen('signin');
      return;
    }
    if (Date.now() - startedAt > GSI_TIMEOUT_MS) {
      clearInterval(timer);
      UI.showScreen('signin');
      UI.showError('Google-ის ავტორიზაციის სერვისთან დაკავშირება ვერ მოხერხდა. გადატვირთეთ გვერდი.');
    }
  }, 100);
});
