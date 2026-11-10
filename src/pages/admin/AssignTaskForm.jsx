import { useState } from "react";
import { useAuth } from "../../auth/useAuth";
import { assignTask } from "../../lib/services";
import { Button, Card, Field, inputClass } from "../../components/ui";

function AssignTaskForm({ employees, onDone, onCancel }) {
  const { user } = useAuth();
  const [values, setValues] = useState({
    title: "",
    description: "",
    assignedTo: employees[0]?.id || "",
    dueDate: "",
    priority: "medium",
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function update(field, value) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (!values.title.trim() || !values.description.trim()) {
      setError("Enter a task title and description.");
      return;
    }

    setSaving(true);
    try {
      const task = await assignTask({ ...values, assignedBy: user.id });
      onDone(task);
    } catch (submitError) {
      setError(submitError.message || "Unable to assign this task.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="mb-5">
      <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
        <Field label="Task title">
          <input className={inputClass} value={values.title} onChange={(event) => update("title", event.target.value)} required maxLength={160} />
        </Field>
        <Field label="Assign to">
          <select className={inputClass} value={values.assignedTo} onChange={(event) => update("assignedTo", event.target.value)} required>
            {employees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.first_name} {employee.last_name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Description">
          <textarea className={inputClass} rows={3} value={values.description} onChange={(event) => update("description", event.target.value)} required maxLength={5000} />
        </Field>
        <Field label="Priority">
          <select className={inputClass} value={values.priority} onChange={(event) => update("priority", event.target.value)} required>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </Field>
        <Field label="Due date">
          <input type="date" className={inputClass} value={values.dueDate} onChange={(event) => update("dueDate", event.target.value)} required />
        </Field>
        {error && <p className="text-sm text-danger sm:col-span-2">{error}</p>}
        <div className="flex gap-2 sm:col-span-2">
          <Button type="submit" disabled={saving || employees.length === 0}>{saving ? "Assigning..." : "Assign Task"}</Button>
          <Button variant="secondary" onClick={onCancel}>Cancel</Button>
        </div>
      </form>
    </Card>
  );
}

export default AssignTaskForm;
