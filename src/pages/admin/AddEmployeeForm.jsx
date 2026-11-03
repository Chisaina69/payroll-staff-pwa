import { useState } from "react";
import { addEmployee } from "../../lib/services";
import { Button, Card, Field, inputClass } from "../../components/ui";

export default function AddEmployeeForm({ onDone }) {
  const [values, setValues] = useState({
    employeeId: "",
    name: "",
    department: "",
    position: "",
    salary: "",
    contact: "",
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function update(field, value) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      const { employeeId, ...employee } = values;
      await addEmployee(employeeId.trim(), {
        ...employee,
        salary: Number(employee.salary),
      });
      onDone();
    } catch (submitError) {
      setError(submitError.message || "Unable to add this employee.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="mb-5">
      <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
        <Field label="Employee ID">
          <input className={inputClass} value={values.employeeId} onChange={(event) => update("employeeId", event.target.value)} required />
        </Field>
        <Field label="Full name">
          <input className={inputClass} value={values.name} onChange={(event) => update("name", event.target.value)} required />
        </Field>
        <Field label="Department">
          <input className={inputClass} value={values.department} onChange={(event) => update("department", event.target.value)} required />
        </Field>
        <Field label="Position">
          <input className={inputClass} value={values.position} onChange={(event) => update("position", event.target.value)} required />
        </Field>
        <Field label="Monthly salary (KES)">
          <input type="number" min="0" step="0.01" className={inputClass} value={values.salary} onChange={(event) => update("salary", event.target.value)} required />
        </Field>
        <Field label="Contact">
          <input className={inputClass} value={values.contact} onChange={(event) => update("contact", event.target.value)} />
        </Field>
        {error && <p className="text-sm text-danger sm:col-span-2">{error}</p>}
        <div className="flex gap-2 sm:col-span-2">
          <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save Employee"}</Button>
          <Button variant="secondary" onClick={onDone}>Cancel</Button>
        </div>
      </form>
    </Card>
  );
}
