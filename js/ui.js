const UI = (function () {

  const VIEWS = ['home', 'project', 'admin'];

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

    if (name === 'home') {
      window.scrollTo(0, homeScroll);
      if (window.MapView) MapView.refresh();
    } else {
      window.scrollTo(0, 0);
    }
    if (name === 'admin' && window.AdminView) AdminView.render();
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
  }

  return { el: el, showView: showView, showError: showError, showScreen: showScreen };
})();
