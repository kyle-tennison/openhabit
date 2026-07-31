import { useState } from "react";
import { api, setToken } from "./api.js";
import { DONATE_URL, GITHUB_URL, SUPPORT_EMAIL } from "./Footer.jsx";
import Logo from "./Logo.jsx";

// A reset link lands on /reset?token=… — the token decides which form to show.
function resetTokenFromUrl() {
  return new URLSearchParams(window.location.search).get("token") || "";
}

// Drop the token from the address bar so it isn't left in history or a shared URL.
function clearUrl() {
  window.history.replaceState({}, "", "/");
}

export default function Auth({ onSignedIn }) {
  const [resetToken, setResetToken] = useState(resetTokenFromUrl);
  const [mode, setMode] = useState(() => (resetTokenFromUrl() ? "reset" : "login"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const isRegister = mode === "register";
  const isForgot = mode === "forgot";
  const isReset = mode === "reset";

  function go(next) {
    setMode(next);
    setError("");
    setNotice("");
  }

  async function submit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (isForgot) {
        await api.forgot(email);
        setNotice("If that email has an account, a reset link is on its way.");
      } else if (isReset) {
        const result = await api.reset(resetToken, password);
        setToken(result.token);
        clearUrl();
        onSignedIn(result.email);
      } else {
        const result = isRegister
          ? await api.register(email, password)
          : await api.login(email, password);
        setToken(result.token);
        onSignedIn(result.email);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const heading = isReset
    ? "Choose a new password"
    : isForgot
      ? "Reset your password"
      : "Free and simple habit tracking";

  const submitLabel = isReset
    ? "Set new password"
    : isForgot
      ? "Send reset link"
      : isRegister
        ? "Create account"
        : "Sign in";

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={submit}>
        <Logo size={52} />
        <h1 className="wordmark">openhabit</h1>
        <p className="auth-tagline">{heading}</p>

        {!isReset && (
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
        )}

        {!isForgot && (
          <label>
            {isReset ? "New password" : "Password"}
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={isRegister || isReset ? "new-password" : "current-password"}
              minLength={isRegister || isReset ? 8 : undefined}
              required
            />
          </label>
        )}

        {error && <p className="auth-error">{error}</p>}
        {notice && <p className="auth-notice">{notice}</p>}

        <button className="primary" type="submit" disabled={busy}>
          {busy ? "One moment…" : submitLabel}
        </button>

        {mode === "login" && (
          <div className="auth-alt">
            <button type="button" className="link" onClick={() => go("register")}>
              Create an account
            </button>
            <button type="button" className="link" onClick={() => go("forgot")}>
              Forgot password?
            </button>
          </div>
        )}

        {isRegister && (
          <button type="button" className="link" onClick={() => go("login")}>
            I already have an account
          </button>
        )}

        {(isForgot || isReset) && (
          <button
            type="button"
            className="link"
            onClick={() => {
              if (isReset) {
                setResetToken("");
                clearUrl();
              }
              go("login");
            }}
          >
            Back to sign in
          </button>
        )}

        <div className="auth-links">
          <a href={DONATE_URL} target="_blank" rel="noopener noreferrer">
            <i className="bi bi-paypal" aria-hidden="true"></i>
            Support hosting
          </a>
          <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
            <i className="bi bi-github" aria-hidden="true"></i>
            GitHub
          </a>
          <a href={`mailto:${SUPPORT_EMAIL}?subject=openhabit%20issue`}>Contact</a>
        </div>
      </form>
    </div>
  );
}
