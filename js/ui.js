const UI = (function () {

  const VIEWS = ['home', 'registry', 'project', 'admin'];

  function el(id) { return document.getElementById(id); }

  /**
   * ხედის გადართვა. ტაბები აღარ არსებობს — მთავარი ერთი გრაგნილი
   * გვერდია, პროექტი და ადმინი კი ცალკე ხედებია, საიდანაც უკან ბრუნდები.
   *
   * გრაგნილის პოზიცია მთავარზე ინახება: პროექტიდან დაბრუნებისას
   * მომხმარებელი იქვე უნდა აღმოჩნდეს, სადაც დატოვა, და არა თავში.
   */
  let homeScroll = 0;

  function showView(name) {
    const leavingHome = !el('view-home').hidden;
    if (leavingHome && name !== 'home') homeScroll = window.scrollY;

    VIEWS.forEach(function (view) {
      const box = el('view-' + view);
      if (box) box.hidden = (view !== name);
    });

    // შემოწმება `typeof`-ით და არა `window.X`-ით: მოდულები top-level
    // `const`-ებია და ასეთი დეკლარაცია `window`-ის თვისებად არ იქცევა.
    // `window.AdminView` ყოველთვის undefined იყო — ადმინის პანელი
    // არასდროს იხატებოდა, ხოლო რუკა მთავარზე დაბრუნებისას არ ჯდებოდა.
    if (name === 'home') {
      window.scrollTo(0, homeScroll);
    } else {
      window.scrollTo(0, 0);
    }
    // რუკა დამალულ ხედში ნულოვან სიგანეს ზომავს და გეგმა არ ჯდება —
    // გასწორება მხოლოდ გამოჩენის შემდეგ შეიძლება.
    if (name === 'registry' && typeof MapView !== 'undefined') MapView.refresh();
    if (name === 'admin' && typeof AdminView !== 'undefined') AdminView.render();
  }

  function showError(message) {
    const box = el('error-box');
    box.textContent = message;
    box.hidden = false;
    clearTimeout(box._timer);
    box._timer = setTimeout(function () { box.hidden = true; }, 6000);
  }

  function showScreen(name) {
    ['loading', 'signin', 'pending', 'app'].forEach(function (screen) {
      el('screen-' + screen).hidden = (screen !== name);
    });
    // ფონის გეგმა დამალულ ეკრანზე იხატება — იქ სიგანე ნულია და ნახაზი
    // ვერ ჯდება. `window.HeroPlan` აშკარა მინიჭებაა და არა top-level
    // `const`, ამიტომ აქედან ჩანს.
    if (name === 'signin' && window.HeroPlan) window.HeroPlan.refresh();
  }

  return { el: el, showView: showView, showError: showError, showScreen: showScreen };
})();
