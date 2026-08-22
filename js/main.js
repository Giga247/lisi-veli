/** გვერდის ჩატვირთვის ნაკადი: ტოკენი -> me -> ეკრანი. */
let CURRENT_USER = null;
let PLOTS = [];

/**
 * შესვლის შემდეგ: ვინ ხარ → მონაცემები → მთავარი გვერდი.
 *
 * ოთხი მოთხოვნიდან სამი პარალელურია. აქტიური პროექტის დეტალები
 * ცალკე მოდის, რადგან მისი id მხოლოდ სიის მიღების შემდეგ ვიცით —
 * სწორედ ის აძლევს რუკასა და სიას სტატუსების ფერებს.
 */
async function afterSignIn() {
  UI.showScreen('loading');
  try {
    CURRENT_USER = await API.call('me');
  } catch (error) {
    await handleSignInError(error);
    return;
  }

  UI.el('whoami').textContent = initials(CURRENT_USER);
  UI.el('whoami').title = CURRENT_USER.display_name || CURRENT_USER.email;
  if (CURRENT_USER.role === 'admin') UI.el('btn-admin').hidden = false;

  UI.showScreen('app');
  UI.showView('home');
  ProjectsView.bind();

  try {
    PLOTS = await API.call('plots');
    window.PLOTS = PLOTS;
  } catch (error) {
    UI.showError(error.message || 'მონაცემები ვერ ჩაიტვირთა');
    UI.el('home-list').innerHTML =
      '<p class="empty">მონაცემები ვერ ჩაიტვირთა — გადატვირთეთ გვერდი.</p>';
    return;
  }

  // პროექტების ჩავარდნა რეესტრს არ აჩერებს: რუკა და სია ქუჩის
  // ფერებით მაინც უნდა დაიხატოს.
  let active = null;
  let rows = [];
  try {
    const list = await ProjectsView.render(CURRENT_USER);
    active = (list || []).filter(function (p) { return p.status === 'active'; })[0] || null;
    if (active) {
      const detail = await API.call('project', { id: active.id });
      rows = detail.rows || [];
    }
  } catch (error) {
    UI.showError(error.message || 'პროექტები ვერ ჩაიტვირთა');
  }

  MapView.render(PLOTS, CURRENT_USER, active, rows);
  TableView.render(PLOTS, CURRENT_USER, active, rows);
}

/** ავატარის ორი ასო — სახელიდან, თუ არა და მეილიდან. */
function initials(profile) {
  const source = String(profile.display_name || profile.email || '?').trim();
  const parts = source.split(/[\s@._-]+/).filter(Boolean);
  const letters = parts.length >= 2
    ? parts[0][0] + parts[1][0]
    : source.slice(0, 2);
  return letters.toUpperCase();
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
 * სიტყვა `ჩასვი` მარკერია: სანამ ის კონფიგში დგას, შესვლას საერთოდ არ
 * ვცდილობთ და მფლობელს ქართულ ინსტრუქციას ვაჩვენებთ — და არა ჩუმად
 * უმოქმედო ღილაკს კონსოლის ინგლისურ შეცდომასთან ერთად.
 */
function configNotFilled() {
  return String(CONFIG.SUPABASE_URL).indexOf('ჩასვი') !== -1 ||
    String(CONFIG.SUPABASE_ANON_KEY).indexOf('ჩასვი') !== -1;
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
      'კონფიგურაცია ჯერ არ არის შევსებული: js/config.js-ში SUPABASE_URL და ' +
      'SUPABASE_ANON_KEY კვლავ პლეისჰოლდერებია. შეავსეთ ორივე ' +
      'docs/setup.md-ის მიხედვით და გადატვირთეთ გვერდი.';
    return;
  }

  // supabase-js ლოკალური ფაილია და სინქრონულად იტვირთება — ლოდინის
  // ციკლი, რომელიც Google-ის CDN-ს სჭირდებოდა, აღარ არის საჭირო.
  // შემოწმება მაინც რჩება: ფაილი შეიძლება საერთოდ არ ჩაიტვირთოს.
  if (typeof supabase === 'undefined') {
    UI.showScreen('signin');
    UI.showError('js/vendor/supabase.js ვერ ჩაიტვირთა. გადატვირთეთ გვერდი.');
    return;
  }

  UI.showScreen('signin');
  Auth.init(afterSignIn);
});
