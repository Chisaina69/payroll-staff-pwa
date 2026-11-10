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
  employees: "employee_id, id, employee_code, first_name, last_name, department, status",
  payroll: "id, employee_id, period",
  leaveRequests: "id, employee_id, status, submitted_at",
  notifications: "id, recipient_id, read, created_at",
  tasks: "id, assigned_to, status, due_date",
  pendingWrites: "++localId, kind, createdAt",
});

localDb.version(3).stores({
  employees: "employee_id, id, employee_code, first_name, last_name, department, status",
  payroll: "id, employee_id, period, payment_status",
  leaveRequests: "id, employee_id, status, submitted_at",
  notifications: "id, recipient_id, read, created_at",
  tasks: "id, assigned_to, status, due_date",
  pendingWrites: "++localId, kind, createdAt",
});

localDb.version(4).stores({
  employees: "employee_id, id, employee_code, first_name, last_name, department, status",
  payroll: "id, employee_id, pay_period_start, payment_status",
  leaveRequests: "id, employee_id, status, submitted_at",
  notifications: "id, recipient_id, read, created_at",
  tasks: "id, assigned_to, status, due_date",
  pendingWrites: "++localId, kind, createdAt",
});

localDb.version(5).stores({
  employees: null,
});

localDb.version(6).stores({
  employees: "id, employee_code, first_name, last_name, department, status",
});

localDb.version(7).stores({
  leaveRequests: "id, employee_id, status, created_at",
});

localDb.version(8).stores({
  notifications: "id, employee_id, read_at, created_at",
});

localDb.version(9).stores({
  employees: "id, employee_code, first_name, last_name, department, status",
  payroll: "id, employee_id, pay_period_start, payment_status",
  leaveRequests: "id, employee_id, status, created_at",
  notifications: "id, employee_id, read_at, created_at",
  tasks: "id, employee_id, status, due_date",
  pendingWrites: "++localId, kind, createdAt",
}).upgrade(async (transaction) => {
  const tasks = await transaction.table("tasks").toArray();
  await transaction.table("tasks").bulkPut(tasks.map((task) => ({
    ...task,
    employee_id: task.employee_id || task.assigned_to,
  })));
});

localDb.version(10).stores({
  employees: "id, employee_code, first_name, last_name, department, status",
  payroll: "id, employee_id, pay_period_start, payment_status",
  leaveRequests: "id, employee_id, status, created_at",
  notifications: "id, employee_id, read_at, created_at",
  tasks: "id, employee_id, status, due_date",
  pendingWrites: "++localId, kind, createdAt",
}).upgrade(async (transaction) => {
  await transaction.table("notifications")
    .filter((notification) => notification.title === "Password reset requested")
    .delete();
});
