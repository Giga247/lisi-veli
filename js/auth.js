/**
 * Google Identity Services. ტოკენი მხოლოდ მეხსიერებაშია — localStorage-ში
 * არ ინახება. გვერდის გადატვირთვისას ჩუმი შესვლა ავსებს (One Tap).
 */
const Auth = (function () {
  let token = null;
  let signInCallback = null;
  let refreshResolve = null;

  function handleCredential(response) {
    token = response.credential;
    if (refreshResolve) { refreshResolve(true); refreshResolve = null; }
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

  /** ტოკენის ვადა ერთი საათია; გასვლისას ჩუმად ვცდილობთ ახლის აღებას. */
  function refresh() {
    return new Promise(function (resolve) {
      refreshResolve = resolve;
      google.accounts.id.prompt(function (notification) {
        if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
          if (refreshResolve) { refreshResolve(false); refreshResolve = null; }
        }
      });
      setTimeout(function () {
        if (refreshResolve) { refreshResolve(false); refreshResolve = null; }
      }, 5000);
    });
  }

  function signOut() {
    token = null;
    google.accounts.id.disableAutoSelect();
    location.reload();
  }

  return { init: init, getToken: getToken, refresh: refresh, signOut: signOut };
})();
