/**
 * Google Identity Services. ტოკენი მხოლოდ მეხსიერებაშია — localStorage-ში
 * არ ინახება. გვერდის გადატვირთვისას ჩუმი შესვლა ავსებს (One Tap).
 */
const Auth = (function () {
  let token = null;
  let signInCallback = null;
  let refreshResolve = null;
  let refreshPromise = null;

  function handleCredential(response) {
    token = response.credential;
    if (refreshResolve) refreshResolve(true);
    if (signInCallback) signInCallback();
  }

  function init(callback) {
    signInCallback = callback;
    google.accounts.id.initialize({
      client_id: CONFIG.CLIENT_ID,
      callback: handleCredential,
      auto_select: true,
      cancel_on_tap_outside: false,
    });
    google.accounts.id.renderButton(
      document.getElementById('signin-button'),
      { theme: 'outline', size: 'large', text: 'signin_with', locale: 'ka' });
    google.accounts.id.prompt();
  }

  function getToken() { return token; }

  /**
   * ტოკენის ვადა ერთი საათია; გასვლისას ჩუმად ვცდილობთ ახლის აღებას.
   *
   * ერთდროული გამოძახებები (მაგ. ორი პარალელური API.call ერთსა და იმავე
   * წუთს UNAUTHENTICATED-ს იჭერს) ერთსა და იმავე in-flight promise-ს
   * იზიარებენ — ცალკე resolver-ები აღარ ეწერება ერთმანეთს თავზე, და
   * არცერთი resolver ორჯერ არ ისვლება.
   */
  function refresh() {
    if (refreshPromise) return refreshPromise;

    refreshPromise = new Promise(function (resolve) {
      function settle(value) {
        if (!refreshResolve) return;
        refreshResolve = null;
        refreshPromise = null;
        resolve(value);
      }
      refreshResolve = settle;

      google.accounts.id.prompt(function (notification) {
        if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
          settle(false);
        }
      });
      setTimeout(function () { settle(false); }, 5000);
    });

    return refreshPromise;
  }

  function signOut() {
    token = null;
    google.accounts.id.disableAutoSelect();
    location.reload();
  }

  return { init: init, getToken: getToken, refresh: refresh, signOut: signOut };
})();
