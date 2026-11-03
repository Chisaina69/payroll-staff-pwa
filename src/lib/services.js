// Thin data-access layer, same role as before: every page calls through
// here rather than talking to Supabase directly, so the realtime and
// offline-caching behaviour lives in one place.
//
// Supabase's realtime channels stream CHANGES, not an initial snapshot the
// way Firestore's onSnapshot did — so each subscribe function below does an
// initial select() first, then re-fetches on any change notification. For a
// single-company system this table size makes a full refetch cheap and far
// simpler (and less bug-prone) than hand-patching partial state.

import { supabase } from "./supabase";
import { localDb } from "../db/Localdb";
import { computePayslip } from "./payrollCalculator";

// ---------- Employees ----------

export function subscribeEmployees(onChange) {
  async function fetchAndNotify() {
    const { data, error } = await supabase.from("employees").select("*").order("name");
    if (!error) {
      await localDb.employees.clear();
      await localDb.employees.bulkPut(data);
      onChange(data);
    } else {
      onChange(await localDb.employees.toArray());
    }
  }
  fetchAndNotify();
  const channel = supabase
    .channel("employees-changes")
    .on("postgres_changes", { event: "*", schema: "public", table: "employees" }, fetchAndNotify)
    .subscribe();
  return () => supabase.removeChannel(channel);
}

export async function addEmployee(employeeId, data) {
  const { error } = await supabase.from("employees").insert({
    employee_id: employeeId,
    ...data,
    status: data.status || "active",
    leave_balance: 21,
  });
  if (error) {
    if (error.code === "23505") throw new Error(`Employee ID "${employeeId}" is already in use.`);
    throw error;
  }
}

export function updateEmployee(employeeId, data) {
  return supabase.from("employees").update(data).eq("employee_id", employeeId);
}

// Employee directory: name/department/position only, no salary — reads
// from the employee_directory VIEW (see schema), which enforces that at
// the database level regardless of what this function requests.
export async function fetchDirectory() {
  const { data, error } = await supabase.from("employee_directory").select("*").order("name");
  if (error) throw error;
  return data;
}

// ---------- Payroll ----------

export function subscribePayroll(onChange, { employeeId } = {}) {
  async function fetchAndNotify() {
    let query = supabase.from("payroll").select("*").order("period", { ascending: false });
    if (employeeId) query = query.eq("employee_id", employeeId);
    const { data, error } = await query;
    if (!error) {
      await localDb.payroll.bulkPut(data);
      onChange(data);
    } else {
      const all = await localDb.payroll.toArray();
      onChange(employeeId ? all.filter((p) => p.employee_id === employeeId) : all);
    }
  }
  fetchAndNotify();
  const channel = supabase
    .channel(`payroll-changes-${employeeId || "all"}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "payroll" }, fetchAndNotify)
    .subscribe();
  return () => supabase.removeChannel(channel);
}

// Takes gross pay only — NSSF/SHIF/AHL/PAYE/net are all computed here from
// current statutory rates, not typed in manually.
export async function generatePayslip({ employeeId, period, gross }) {
  const breakdown = computePayslip(gross);
  const { error } = await supabase.from("payroll").insert({
    employee_id: employeeId,
    period,
    ...breakdown,
  });
  if (error) throw error;
  return breakdown;
}

// ---------- Leave Requests (with offline queueing) ----------

export function subscribeLeaveRequests(onChange, { employeeId } = {}) {
  async function fetchAndNotify() {
    let query = supabase.from("leave_requests").select("*").order("submitted_at", { ascending: false });
    if (employeeId) query = query.eq("employee_id", employeeId);
    const { data, error } = await query;
    if (!error) {
      await localDb.leaveRequests.bulkPut(data);
      onChange(data);
    } else {
      const all = await localDb.leaveRequests.toArray();
      onChange(employeeId ? all.filter((r) => r.employee_id === employeeId) : all);
    }
  }
  fetchAndNotify();
  const channel = supabase
    .channel(`leave-changes-${employeeId || "all"}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "leave_requests" }, fetchAndNotify)
    .subscribe();
  return () => supabase.removeChannel(channel);
}

function daysBetween(start, end) {
  const ms = new Date(end) - new Date(start);
  return Math.round(ms / (1000 * 60 * 60 * 24)) + 1;
}

export async function submitLeaveRequest({ employeeId, type, startDate, endDate }) {
  const days = daysBetween(startDate, endDate);
  const record = {
    employee_id: employeeId,
    type,
    start_date: startDate,
    end_date: endDate,
    days,
    status: "pending",
    submitted_at: new Date().toISOString(),
  };
  try {
    const { error } = await supabase.from("leave_requests").insert(record);
    if (error) throw error;
  } catch (err) {
    if (navigator.onLine) throw err;
    await localDb.pendingWrites.add({ kind: "leave_request", payload: record, createdAt: Date.now() });
    throw new Error("You're offline — this request has been saved and will submit automatically once you're back online.");
  }
}

export async function setLeaveRequestStatus(id, status) {
  const { error } = await supabase.from("leave_requests").update({ status }).eq("id", id);
  if (error) throw error;
}

// Flushes any leave requests queued while offline. Registered to run on
// the browser's 'online' event.
export async function flushPendingWrites() {
  const pending = await localDb.pendingWrites.toArray();
  for (const item of pending) {
    if (item.kind === "leave_request") {
      const { error } = await supabase.from("leave_requests").insert(item.payload);
      if (!error) await localDb.pendingWrites.delete(item.localId);
    }
  }
}

// ---------- Notifications ----------

export function subscribeNotifications(recipientId, onChange) {
  async function fetchAndNotify() {
    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("recipient_id", recipientId)
      .order("created_at", { ascending: false });
    if (!error) {
      await localDb.notifications.bulkPut(data);
      onChange(data);
    } else {
      const all = await localDb.notifications.toArray();
      onChange(all.filter((n) => n.recipient_id === recipientId));
    }
  }
  fetchAndNotify();
  const channel = supabase
    .channel(`notif-changes-${recipientId}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "notifications" }, fetchAndNotify)
    .subscribe();
  return () => supabase.removeChannel(channel);
}

export function sendNotification(recipientId, message) {
  return supabase.from("notifications").insert({ recipient_id: recipientId, message });
}

// ---------- Tasks ----------

export function subscribeTasks(onChange, { employeeId } = {}) {
  async function fetchAndNotify() {
    let query = supabase.from("tasks").select("*").order("due_date", { ascending: true });
    if (employeeId) query = query.eq("assigned_to", employeeId);
    const { data, error } = await query;
    if (!error) {
      await localDb.tasks.bulkPut(data);
      onChange(data);
    } else {
      const all = await localDb.tasks.toArray();
      onChange(employeeId ? all.filter((t) => t.assigned_to === employeeId) : all);
    }
  }
  fetchAndNotify();
  const channel = supabase
    .channel(`tasks-changes-${employeeId || "all"}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, fetchAndNotify)
    .subscribe();
  return () => supabase.removeChannel(channel);
}

export async function assignTask({ title, description, assignedTo, assignedBy, dueDate }) {
  const { error } = await supabase.from("tasks").insert({
    title,
    description,
    assigned_to: assignedTo,
    assigned_by: assignedBy,
    due_date: dueDate,
  });
  if (error) throw error;
}

export function completeTask(taskId) {
  return supabase
    .from("tasks")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("id", taskId);
}
