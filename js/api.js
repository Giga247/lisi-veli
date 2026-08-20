/**
 * ბაზასთან საუბრის ერთადერთი ფაილი. ყველა სხვა ფაილი მხოლოდ ამას იძახებს.
 * Supabase-ზე გადასვლისას მხოლოდ ეს ფაილი გადაიწერება.
 *
 * Content-Type აუცილებლად text/plain — application/json იწვევს preflight
 * OPTIONS მოთხოვნას, რომელსაც Apps Script არ ამუშავებს.
 */
const API = (function () {

  async function call(action, payload) {
    const token = Auth.getToken();
    const response = await fetch(CONFIG.API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ idToken: token, action: action, payload: payload || {} }),
    });

    if (!response.ok) {
      const error = new Error('სერვერთან კავშირი ვერ დამყარდა');
      error.code = 'SERVER';
      throw error;
    }

    const result = await response.json();
    if (result.ok) return result.data;

    const error = new Error(result.message || 'უცნობი შეცდომა');
    error.code = result.error || 'SERVER';
    throw error;
  }

  /** UNAUTHENTICATED-ზე ერთხელ ცდილობს ტოკენის განახლებას და იმეორებს. */
  async function callWithRetry(action, payload) {
    try {
      return await call(action, payload);
    } catch (error) {
      if (error.code !== 'UNAUTHENTICATED') throw error;
      const refreshed = await Auth.refresh();
      if (!refreshed) throw error;
      return await call(action, payload);
    }
  }

  return { call: callWithRetry };
})();
