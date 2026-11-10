import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { useAuth } from "../auth/useAuth";
import { Button, Field } from "../components/ui";
import { inputClass } from "../components/formStyles";
import { requestStaffPasswordReset } from "../lib/paydayAuth";

function Login() {
  const { login } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showResetRequest, setShowResetRequest] = useState(false);
  const [resetEmployeeCode, setResetEmployeeCode] = useState("");
  const [resetRequestError, setResetRequestError] = useState("");
  const [resetRequestMessage, setResetRequestMessage] = useState("");
  const [submittingResetRequest, setSubmittingResetRequest] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await login(identifier, password);
      navigate("/");
    } catch (loginError) {
      setError(loginError.message || "Login failed. Check your details and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function handleResetRequest() {
    setResetRequestError("");
    setResetRequestMessage("");
    if (!resetEmployeeCode.trim()) {
      setResetRequestError("Enter your employee ID.");
      return;
    }

    setSubmittingResetRequest(true);
    try {
      const result = await requestStaffPasswordReset(resetEmployeeCode);
      setResetRequestMessage(result.message);
      setResetEmployeeCode("");
    } catch (requestError) {
      setResetRequestError(requestError.message || "Unable to send your password-reset request.");
    } finally {
      setSubmittingResetRequest(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-paper px-4">
      <div
        className="pointer-events-none absolute -top-40 -right-40 h-96 w-96 rounded-full bg-brand-200/40 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-accent-400/20 blur-3xl"
        aria-hidden="true"
      />

      <form onSubmit={handleSubmit} className="card relative w-full max-w-sm p-8">
        <div className="mb-7 text-center">
          <span className="font-display text-3xl font-semibold text-brand-800">Payday</span>
          <p className="mt-1.5 text-sm text-ink-500">Sign in to continue</p>
        </div>

        {location.state?.accountActivated && (
          <p className="mb-4 text-sm text-success">
            Your account is ready. Sign in with your employee ID and password.
          </p>
        )}
        {location.state?.passwordReset && (
          <p className="mb-4 text-sm text-success">
            Your password was reset. Sign in with your employee ID and new password.
          </p>
        )}

        <div className="space-y-4">
          <Field label="Email or Employee ID">
            <input
              className={inputClass}
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="name@company.com or EMP001"
              required
            />
          </Field>
          <Field label="Password">
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                className={`${inputClass} pr-12`}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                className="absolute inset-y-0 right-0 inline-flex items-center px-3 text-ink-500 hover:text-ink-900"
                onClick={() => setShowPassword((visible) => !visible)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </Field>
        </div>

        {error && <p className="mt-4 text-sm text-danger">{error}</p>}

        <Button type="submit" disabled={busy} className="mt-6 w-full">
          {busy ? "Signing in..." : "Sign In"}
        </Button>

        <p className="mt-4 text-center text-sm text-ink-500">
          Forgot your password? Ask your administrator for a secure password-reset invite.
        </p>
        {!showResetRequest ? (
          <button
            type="button"
            className="mt-2 w-full text-center text-sm font-semibold text-brand-700 hover:underline"
            onClick={() => setShowResetRequest(true)}
          >
            Request a password reset
          </button>
        ) : (
          <div className="mt-4 space-y-3 rounded-xl border border-line bg-surface-alt p-4">
            <p className="text-sm text-ink-600">
              Enter your employee ID to notify your administrator.
            </p>
            <Field label="Employee ID">
              <input
                className={inputClass}
                value={resetEmployeeCode}
                onChange={(event) => setResetEmployeeCode(event.target.value)}
                autoComplete="username"
                required
                maxLength={50}
              />
            </Field>
            {resetRequestError && (
              <p role="alert" className="text-sm text-danger">{resetRequestError}</p>
            )}
            {resetRequestMessage && (
              <p role="status" className="text-sm text-success">{resetRequestMessage}</p>
            )}
            <div className="flex gap-2">
              <Button type="button" className="flex-1" disabled={submittingResetRequest} onClick={handleResetRequest}>
                {submittingResetRequest ? "Sending..." : "Send request"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setShowResetRequest(false);
                  setResetRequestError("");
                  setResetRequestMessage("");
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
        <p className="mt-2 text-center text-sm">
          <Link to="/signup?mode=reset" className="font-semibold text-brand-700 hover:underline">
            I have a password-reset invite
          </Link>
        </p>

        <p className="mt-5 text-center text-sm text-ink-500">
          Staff member, first time here?{" "}
          <Link to="/signup" className="font-semibold text-brand-700 hover:underline">
            Sign up
          </Link>
        </p>
      </form>
    </div>
  );
}

export default Login;
