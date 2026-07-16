import { FormEvent, useState } from "react";
import { supabase } from "../lib/supabase";

export default function AuthForm() {
  const [mode, setMode] = useState<"login" | "signup" | "forgot-password">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setLoading(true);
    setMessage("");

    if (mode === "signup") {
      const { error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) {
        setMessage(error.message);
      } else {
        setMessage(
          "Account created. Check your email to confirm your account."
        );
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setMessage(error.message);
      }
    }

    setLoading(false);
  }

  async function handleForgotPassword(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setLoading(true);
    setMessage("");

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/`,
    });

    if (error) {
      setMessage(error.message);
    } else {
      setMessage(
      "Password reset email sent. Check your inbox and spam folder."
    );
  }

  setLoading(false);
}

if (mode === "forgot-password") {
  return (
    <main className="auth-page">
      <section className="auth-card">
        <p className="eyebrow">ACCOUNT RECOVERY</p>
        <h1>Reset your password</h1>
        <p>Enter your account email and we’ll send you a reset link.</p>

        <form onSubmit={handleForgotPassword}>
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>

          <button
            className="button primary auth-submit-button"
            type="submit"
            disabled={loading}
          >
            {loading ? "Sending..." : "Send reset link"}
          </button>
        </form>

        {message && <p>{message}</p>}

        <button
          className="auth-switch-button"
          type="button"
          onClick={() => {
            setMode("login");
            setMessage("");
          }}
        >
          Back to login
        </button>
      </section>
    </main>
  );
}

  return (
    <main className="auth-page">
      <section className="auth-card">
        <p className="eyebrow">STUDY APP</p>

        <h1>
          {mode === "login" ? "Welcome back" : "Create your account"}
        </h1>

        <p>
          Sign in to save your topics, questions, and quiz history.
        </p>

        <form onSubmit={handleSubmit}>
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>

          <label>
            Password
            <div className="password-input-wrapper">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                minLength={8}
                required
              />

              <button
                className="password-peek-button"
                type="button"
                onClick={() => setShowPassword((current) => !current)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </label>

          <button 
            className="button primary auth-submit-button"
            type="submit"
            disabled={loading}
          >
            {loading ? "Please wait..." : "Log in"}
          </button>
        </form>

        {mode === "login" && (
          <button
            className="forgot-password-button"
            type="button"
            onClick={() => {
              setMode("forgot-password");
              setMessage("");
            }}
          >
            Forgot password?
          </button>
        )}

        {message && <p>{message}</p>}

          <button
            className="auth-switch-button"
            type="button"
            onClick={() =>
              setMode((current) =>
                current === "login" ? "signup" : "login"
              )
            }
          >
            {mode === "login"
              ? "Need an account? Sign up"
              : "Already have an account? Log in"}
          </button>
      </section>
    </main>
  );
}