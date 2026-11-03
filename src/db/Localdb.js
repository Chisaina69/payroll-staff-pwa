import Dexie from "dexie";

export const localDb = new Dexie("PaydayCache");

localDb.version(1).stores({
  employees: "employee_id, name, department, status",
  payroll: "id, employee_id, period",
  leaveRequests: "id, employee_id, status, submitted_at",
  notifications: "id, recipient_id, read, created_at",
  tasks: "id, assigned_to, status, due_date",
  pendingWrites: "++localId, kind, createdAt", // queued offline writes
});

localDb.version(2).stores({
  employees: "id, employee_code, first_name, last_name, department, status",
  payroll: "id, employee_id, period",
  leaveRequests: "id, employee_id, status, submitted_at",
  notifications: "id, recipient_id, read, created_at",
  tasks: "id, assigned_to, status, due_date",
  pendingWrites: "++localId, kind, createdAt",
});
