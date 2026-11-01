const KEY = 'arena.token';
export const getToken = () => { try { return localStorage.getItem(KEY) || ''; } catch { return ''; } };
export const setToken = (t) => { try { t ? localStorage.setItem(KEY, t) : localStorage.removeItem(KEY); } catch { /* storage blocked */ } };

async function req(method, path, body) {
  let res;
  try {
    res = await fetch('/api' + path, { method, headers: { 'content-type': 'application/json', ...(getToken() ? { authorization: 'Bearer ' + getToken() } : {}) }, body: body ? JSON.stringify(body) : undefined });
  } catch { throw new Error('Cannot reach the server. Check your connection.'); }
  let data = null;
  try { data = await res.json(); } catch { /* empty */ }
  if (res.status === 401 && getToken()) { setToken(''); window.dispatchEvent(new Event('arena:logout')); }
  if (!res.ok) throw new Error((data && data.error) || `Request failed (${res.status})`);
  return data;
}
export const api = {
  get: (p) => req('GET', p),
  post: (p, b) => req('POST', p, b || {}),
  del: (p) => req('DELETE', p),
};
