/** გვერდის ჩატვირთვის ნაკადი: ტოკენი -> me -> ეკრანი. */
let CURRENT_USER = null;
let PLOTS = [];

async function afterSignIn() {
  UI.showScreen('loading');
  try {
    CURRENT_USER = await API.call('me');
  } catch (error) {
    if (error.code === 'PENDING') {
      UI.el('pending-message').textContent = error.message;
      UI.showScreen('pending');
      return;
    }
    if (error.code === 'BLOCKED') {
      UI.el('pending-message').textContent = error.message;
      UI.showScreen('pending');
      return;
    }
    // უცნობი მეილი — მოთხოვნის გაგზავნა
    try {
      await API.call('requestAccess');
    } catch (requestError) {
      UI.el('pending-message').textContent = requestError.message;
      UI.showScreen('pending');
      return;
    }
    UI.showScreen('pending');
    return;
  }

  UI.el('whoami').textContent =
    CURRENT_USER.display_name || CURRENT_USER.email;
  if (CURRENT_USER.role === 'admin') UI.el('tab-admin').hidden = false;

  PLOTS = await API.call('plots');
  TableView.render(PLOTS, CURRENT_USER);
  MapView.render(PLOTS, CURRENT_USER);
  if (CURRENT_USER.role === 'admin') AdminView.render();

  UI.showScreen('app');
  UI.showTab('table');
}

window.addEventListener('load', function () {
  const timer = setInterval(function () {
    if (window.google && google.accounts && google.accounts.id) {
      clearInterval(timer);
      Auth.init(afterSignIn);
      UI.showScreen('signin');
    }
  }, 100);
});
