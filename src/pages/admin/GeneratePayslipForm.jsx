import { useState } from "react";
import { generatePayslip } from "../../lib/services";
import { Button, Card, Field, inputClass } from "../../components/ui";

export default function GeneratePayslipForm({ employees, onDone }) {
  const [employeeId, setEmployeeId] = useState(employees[0]?.employee_id || "");
  const [period, setPeriod] = useState("");
  const [gross, setGross] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      await generatePayslip({ employeeId, period, gross: Number(gross) });
      onDone();
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
            {employees.map((employee) => <option key={employee.employee_id} value={employee.employee_id}>{employee.name}</option>)}
          </select>
        </Field>
        <Field label="Pay period">
          <input type="month" className={inputClass} value={period} onChange={(event) => setPeriod(event.target.value)} required />
        </Field>
        <Field label="Gross pay (KES)">
          <input type="number" min="0" step="0.01" className={inputClass} value={gross} onChange={(event) => setGross(event.target.value)} required />
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
