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
import { countLeaveWorkingDays } from "./leave";

// ---------- Employees ----------

export function subscribeEmployees(onChange, onError = () => {}) {
  async function fetchAndNotify() {
    const { data, error } = await supabase
      .from("employees")
      .select("*")
      .order("first_name");

    if (error) {
      console.error("Unable to load employees from Supabase:", error.message);
      onError(error);
      try {
        onChange(await localDb.employees.toArray());
      } catch (cacheError) {
        console.error("Unable to load cached employees:", cacheError);
        onError(cacheError);
      }
      return;
    }

    const employees = data || [];
    try {
      await localDb.transaction("rw", localDb.employees, async () => {
        await localDb.employees.clear();
        await localDb.employees.bulkPut(employees);
      });
    } catch (cacheError) {
      console.error("Unable to cache employees:", cacheError);
    }

    onError(null);
    onChange(employees);
  }

  fetchAndNotify().catch((error) => {
    console.error("Unexpected employee list error:", error);
    onError(error);
  });

  const channel = supabase
    .channel("employees-changes")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "employees" },
      () => {
        fetchAndNotify().catch((error) => {
          console.error("Unable to refresh employees:", error);
          onError(error);
        });
      },
    )
    .subscribe();
  return () => supabase.removeChannel(channel);
}

export async function addEmployee(employeeId, data) {
  const [firstName, ...lastNameParts] = data.name.trim().split(/\s+/);
  const lastName = lastNameParts.join(" ");
  const monthlySalary = Number(data.salary);

  if (!firstName || !data.email.trim() || !Number.isFinite(monthlySalary)) {
    throw new Error("Enter a name, work email, and valid monthly salary.");
  }

  const { data: employee, error } = await supabase
    .from("employees")
    .insert({
      employee_code: employeeId.trim(),
      first_name: firstName,
      last_name: lastName || firstName,
      email: data.email.trim().toLowerCase(),
      department: data.department.trim(),
      position: data.position.trim(),
      basic_salary: monthlySalary,
    })
    .select()
    .single();

  if (error) {
    console.error("Failed to create employee:", error.message);
    if (error.code === "23505") throw new Error(`Employee ID "${employeeId}" is already in use.`);
    throw error;
  }

  console.info("Employee record created:", employee.id);
  return employee;
}

export function updateEmployee(employeeId, data) {
  return supabase.from("employees").update(data).eq("id", employeeId);
}

// Employee directory: name/department/position only, no salary — reads
// from the employee_directory VIEW (see schema), which enforces that at
// the database level regardless of what this function requests.
export async function fetchDirectory() {
  const { data, error } = await supabase
    .from("employee_directory")
    .select("*")
    .order("first_name");
  if (error) throw error;
  return data;
}

// ---------- Payroll ----------

export function subscribePayroll(onChange, { employeeId } = {}, onError = () => {}) {
  async function fetchAndNotify() {
    let query = supabase
      .from("payroll_records")
      .select("*")
      .order("pay_period_start", { ascending: false });
    if (employeeId) query = query.eq("employee_id", employeeId);
    const { data, error } = await query;

    if (error) {
      console.error("Unable to load payroll records:", error.message);
      onError(error);
      const all = await localDb.payroll.toArray();
      onChange(employeeId ? all.filter((p) => p.employee_id === employeeId) : all);
      return;
    }

    try {
      await localDb.payroll.bulkPut(data || []);
    } catch (cacheError) {
      console.error("Unable to cache payroll records:", cacheError);
    }

    onError(null);
    onChange(data || []);
  }
  fetchAndNotify().catch((error) => {
    console.error("Unexpected payroll list error:", error);
    onError(error);
  });
  const channel = supabase
    .channel(`payroll-changes-${employeeId || "all"}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "payroll_records" },
      () => {
        fetchAndNotify().catch((error) => {
          console.error("Unable to refresh payroll records:", error);
          onError(error);
        });
      },
    )
    .subscribe();
  return () => supabase.removeChannel(channel);
}

export async function confirmPayrollPayment(payrollId) {
  const { data, error } = await supabase
    .from("payroll_records")
    .update({ payment_status: "paid" })
    .eq("id", payrollId)
    .eq("payment_status", "pending")
    .select()
    .single();

  if (error) {
    console.error("Payment confirmation failed:", error);
    throw error;
  }

  return data;
}

export async function generatePayslip({
  employeeId,
  period,
  allowances = 0,
  createdBy,
}) {
  if (typeof period !== "string" || !/^\d{4}-\d{2}$/.test(period)) {
    throw new Error("Choose a valid pay period.");
  }

  const [yearText, monthText] = period.split("-");
  const year = Number(yearText);
  const month = Number(monthText);

  if (month < 1 || month > 12) {
    throw new Error("Choose a valid pay period.");
  }

  if (!createdBy) {
    throw new Error("Unable to identify the payroll creator. Sign in again.");
  }

  const { data: employee, error: employeeError } = await supabase
    .from("employees")
    .select("basic_salary")
    .eq("id", employeeId)
    .single();

  if (employeeError) throw employeeError;

  const basicPay = Number(employee.basic_salary);
  const allowanceAmount = Number(allowances);
  if (
    !Number.isFinite(basicPay) ||
    basicPay < 0 ||
    !Number.isFinite(allowanceAmount) ||
    allowanceAmount < 0
  ) {
    throw new Error("Basic pay and allowances must be valid non-negative amounts.");
  }

  const breakdown = computePayslip(basicPay + allowanceAmount);
  const deductions = breakdown.nssf + breakdown.shif + breakdown.ahl + breakdown.paye;
  const payPeriodStart = `${yearText}-${monthText}-01`;
  const payPeriodEnd = new Date(Date.UTC(year, month, 0))
    .toISOString()
    .slice(0, 10);
  const record = {
    employee_id: employeeId,
    pay_period_start: payPeriodStart,
    pay_period_end: payPeriodEnd,
    basic_pay: basicPay,
    allowances: allowanceAmount,
    deductions,
    payment_status: "pending",
    created_by: createdBy,
  };
  const { data: createdRecord, error } = await supabase
    .from("payroll_records")
    .insert(record)
    .select("*")
    .single();
  if (error) throw error;
  return createdRecord;
}

// ---------- Leave Requests (with offline queueing) ----------

export function subscribeLeaveRequests(onChange, { employeeId } = {}, onError = () => {}) {
  async function fetchAndNotify() {
    let query = supabase.from("leave_requests").select("*").order("created_at", { ascending: false });
    if (employeeId) query = query.eq("employee_id", employeeId);
    const { data, error } = await query;

    if (error) {
      console.error("Unable to load leave requests:", error.message);
      onError(error);
      const all = await localDb.leaveRequests.toArray();
      onChange(employeeId ? all.filter((r) => r.employee_id === employeeId) : all);
      return;
    }

    try {
      await localDb.leaveRequests.bulkPut(data || []);
    } catch (cacheError) {
      console.error("Unable to cache leave requests:", cacheError);
    }

    onError(null);
    onChange(data || []);
  }

  function fetchAndNotifySafely() {
    fetchAndNotify().catch((error) => {
      console.error("Unexpected leave request list error:", error);
      onError(error);
    });
  }

  fetchAndNotifySafely();
  const channel = supabase
    .channel(`leave-changes-${employeeId || "all"}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "leave_requests" }, fetchAndNotifySafely)
    .subscribe();
  return () => supabase.removeChannel(channel);
}

export async function submitLeaveRequest({ employeeId, type, startDate, endDate, reason }) {
  if (!employeeId) throw new Error("Unable to identify your staff account. Sign in again.");
  if (!["Annual", "Sick", "Unpaid"].includes(type)) {
    throw new Error("Choose Annual, Sick, or Unpaid leave.");
  }
  if (typeof reason !== "string" || !reason.trim()) {
    throw new Error("Enter a reason for your leave request.");
  }

  const days = countLeaveWorkingDays(startDate, endDate);
  if (days === 0) {
    throw new Error("Choose valid dates that include at least one weekday.");
  }

  const record = {
    employee_id: employeeId,
    leave_type: type,
    start_date: startDate,
    end_date: endDate,
    days,
    reason: reason.trim(),
    status: "pending",
  };
  try {
    const { data: submittedRequest, error } = await supabase
      .from("leave_requests")
      .insert(record)
      .select("*")
      .single();
    if (error) throw error;
    return { queued: false, request: submittedRequest };
  } catch (err) {
    if (navigator.onLine) throw err;
    await localDb.pendingWrites.add({ kind: "leave_request", payload: record, createdAt: Date.now() });
    return { queued: true };
  }
}

export async function setLeaveRequestStatus(id, status) {
  if (!["approved", "rejected"].includes(status)) {
    throw new Error("Choose an approved or rejected status.");
  }
  const { error } = await supabase.from("leave_requests")
    .update({ status })
    .eq("id", id)
    .eq("status", "pending")
    .select("id")
    .single();
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
