import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button, Field, inputClass } from "../components/ui";
import { activateStaffAccount } from "../lib/paydayAuth";

export default function Signup() {
  const navigate = useNavigate();
  const [employeeId, setEmployeeId] = useState("");
  const [registrationCode, setRegistrationCode] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await activateStaffAccount(employeeId, registrationCode, password);
      navigate("/login", { state: { accountActivated: true } });
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
            Ask your administrator for an Employee ID and one-time registration code.
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
          <Field label="Password">
            <input
              type="password"
              className={inputClass}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={12}
              required
            />
          </Field>
        </div>

        {error && <p className="mt-4 text-sm text-danger">{error}</p>}

        <Button type="submit" disabled={busy} className="mt-6 w-full">
          {busy ? "Activating account..." : "Activate Account"}
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
