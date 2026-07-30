const TOKEN_KEY = "openhabit.token";

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t) => localStorage.setItem(TOKEN_KEY, t);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

async function request(method, path, body) {
  const token = getToken();
  const res = await fetch(`/api${path}`, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401) clearToken();
    throw new Error(data.error || "Request failed");
  }
  return data;
}

export const api = {
  register: (email, password) => request("POST", "/auth/register", { email, password }),
  login: (email, password) => request("POST", "/auth/login", { email, password }),
  me: () => request("GET", "/auth/me"),

  listHabits: () => request("GET", "/habits"),
  addHabit: (name) => request("POST", "/habits", { name }),
  renameHabit: (id, name) => request("PATCH", `/habits/${id}`, { name }),
  deleteHabit: (id) => request("DELETE", `/habits/${id}`),

  listChecks: (start, end) => request("GET", `/checks?start=${start}&end=${end}`),
  toggleCheck: (habitId, date) => request("POST", "/checks/toggle", { habitId, date }),

  listMoods: (start, end) => request("GET", `/moods?start=${start}&end=${end}`),
  setMood: (date, value) => request("PUT", "/moods", { date, value }),
  clearMood: (date) => request("DELETE", `/moods/${date}`),
};
