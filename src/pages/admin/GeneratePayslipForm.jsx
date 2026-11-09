import { useState } from "react";
import { useAuth } from "../../auth/useAuth";
import { generatePayslip } from "../../lib/services";
import { Button, Card, Field, inputClass } from "../../components/ui";

export default function GeneratePayslipForm({ employees, onDone }) {
  const { user } = useAuth();
  const [employeeId, setEmployeeId] = useState(employees[0]?.id || "");
  const [period, setPeriod] = useState("");
  const [allowances, setAllowances] = useState("0");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      const createdRecord = await generatePayslip({
        employeeId,
        period,
        allowances: Number(allowances),
        createdBy: user.id,
      });
      onDone(createdRecord);
    } catch (submitError) {
      setError(submitError.message || "Unable to generate this payslip.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="mb-5">
      <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-3">
        <Field label="Employee">
          <select className={inputClass} value={employeeId} onChange={(event) => setEmployeeId(event.target.value)} required>
            {employees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.first_name} {employee.last_name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Pay period">
          <input type="month" className={inputClass} value={period} onChange={(event) => setPeriod(event.target.value)} required />
        </Field>
        <Field label="Additional allowances (KES)">
          <input type="number" min="0" step="0.01" className={inputClass} value={allowances} onChange={(event) => setAllowances(event.target.value)} required />
        </Field>
        {error && <p className="text-sm text-danger sm:col-span-3">{error}</p>}
        <div className="flex gap-2 sm:col-span-3">
          <Button type="submit" disabled={saving}>{saving ? "Generating..." : "Generate Payslip"}</Button>
          <Button variant="secondary" onClick={onDone}>Cancel</Button>
        </div>
      </form>
    </Card>
  );
}
