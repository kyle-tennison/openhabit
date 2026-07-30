import { useState } from "react";
import { api, setToken } from "./api.js";
import { DONATE_URL } from "./Footer.jsx";
import PayPalIcon from "./PayPalIcon.jsx";
import Logo from "./Logo.jsx";

export default function Auth({ onSignedIn }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const isRegister = mode === "register";

  async function submit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const result = isRegister
        ? await api.register(email, password)
        : await api.login(email, password);
      setToken(result.token);
      onSignedIn(result.email);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={submit}>
        <Logo size={52} />
        <h1 className="wordmark">OpenHabit</h1>
        <p className="auth-tagline">Free and simple habit tracking</p>

        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
        </label>

        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={isRegister ? "new-password" : "current-password"}
            minLength={isRegister ? 8 : undefined}
            required
          />
        </label>

        {error && <p className="auth-error">{error}</p>}

        <button className="primary" type="submit" disabled={busy}>
          {busy ? "One moment…" : isRegister ? "Create account" : "Sign in"}
        </button>

        <button
          type="button"
          className="link"
          onClick={() => {
            setMode(isRegister ? "login" : "register");
            setError("");
          }}
        >
          {isRegister ? "I already have an account" : "Create an account"}
        </button>

        <a className="donate-small" href={DONATE_URL} target="_blank" rel="noopener noreferrer">
          <PayPalIcon size={14} />
          Support hosting
        </a>
      </form>
    </div>
  );
}
