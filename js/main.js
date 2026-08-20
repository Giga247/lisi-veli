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

  // აპის ჩარჩო ჩანს მონაცემების ლოდინშიც — თუ `plots` ჩავარდება, მომხმარებელი
  // ცარიელ ცხრილს ხედავს შეცდომის ბანერთან ერთად, არა უსასრულოდ ჩატვირთვის ეკრანს.
  UI.showScreen('app');
  UI.showTab('table');

  try {
    PLOTS = await API.call('plots');
    window.PLOTS = PLOTS;
    TableView.render(PLOTS, CURRENT_USER);
    MapView.render(PLOTS, CURRENT_USER);
    if (CURRENT_USER.role === 'admin') AdminView.render();
  } catch (error) {
    UI.showError(error.message || 'მონაცემების ჩატვირთვა ვერ მოხერხდა');
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

window.addEventListener('load', function () {
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
