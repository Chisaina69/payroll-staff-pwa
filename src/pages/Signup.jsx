import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { Button, Field } from "../components/ui";
import { inputClass } from "../components/formStyles";
import { activateStaffAccount } from "../lib/paydayAuth";

function Signup() {
  const location = useLocation();
  const navigate = useNavigate();
  const [inviteDetails] = useState(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const employeeCode = hash.get("employee_code") || "";
    const registrationCode = hash.get("registration_code") || "";
    if (employeeCode || registrationCode) {
      window.history.replaceState(
        window.history.state,
        "",
        `${window.location.pathname}${window.location.search}`,
      );
    }
    return {
      employeeCode,
      registrationCode,
    };
  });
  const [employeeId, setEmployeeId] = useState(inviteDetails.employeeCode);
  const [registrationCode, setRegistrationCode] = useState(inviteDetails.registrationCode);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const isPasswordReset = new URLSearchParams(location.search).get("mode") === "reset";

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await activateStaffAccount(employeeId, registrationCode, password);
      navigate("/login", {
        state: {
          accountActivated: !isPasswordReset,
          passwordReset: isPasswordReset,
        },
      });
    } catch (err) {
      setError(err.message || "Couldn't create your account. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-paper px-4">
      <div
        className="pointer-events-none absolute -top-40 -left-40 h-96 w-96 rounded-full bg-accent-400/20 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-brand-200/40 blur-3xl"
        aria-hidden="true"
      />

      <form onSubmit={handleSubmit} className="card relative w-full max-w-sm p-8">
        <div className="mb-7 text-center">
          <span className="font-display text-3xl font-semibold text-brand-800">Payday</span>
          <p className="mt-1.5 text-sm text-ink-500">
            {isPasswordReset
              ? "Use the secure reset invite from your administrator to choose a new password."
              : "Ask your administrator for an Employee ID and one-time registration code."}
          </p>
        </div>

        <div className="space-y-4">
          <Field label="Employee ID">
            <input
              className={inputClass}
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              placeholder="EMP001"
              required
            />
          </Field>
          <Field label="Registration code">
            <input
              className={inputClass}
              value={registrationCode}
              onChange={(e) => setRegistrationCode(e.target.value)}
              required
            />
          </Field>
          <Field label={isPasswordReset ? "New password" : "Password"}>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                className={`${inputClass} pr-12`}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={12}
                maxLength={128}
                autoComplete="new-password"
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

        <p className="mt-3 text-xs text-ink-500">
          Use at least 12 characters. Your password is never shown to the administrator.
        </p>
        {error && <p className="mt-4 text-sm text-danger">{error}</p>}

        <Button type="submit" disabled={busy} className="mt-6 w-full">
          {busy
            ? isPasswordReset ? "Resetting password..." : "Activating account..."
            : isPasswordReset ? "Set New Password" : "Activate Account"}
        </Button>

        <p className="mt-5 text-center text-sm text-ink-500">
          Already have an account?{" "}
          <Link to="/login" className="font-semibold text-brand-700 hover:underline">
            Log in
          </Link>
        </p>
      </form>
    </div>
  );
}

export default Signup;
