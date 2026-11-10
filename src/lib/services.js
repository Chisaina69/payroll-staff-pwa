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

function subscribeEmployees(onChange, onError = () => {}) {
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

async function addEmployee(employeeId, data) {
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

function updateEmployee(employeeId, data) {
  return supabase.from("employees").update(data).eq("id", employeeId);
}

// Employee directory: name/department/position only, no salary — reads
// from the employee_directory VIEW (see schema), which enforces that at
// the database level regardless of what this function requests.
async function fetchDirectory() {
  const { data, error } = await supabase
    .from("employee_directory")
    .select("*")
    .order("first_name");
  if (error) throw error;
  return data;
}

async function fetchEmployeeInviteStatuses(employeeIds) {
  if (!employeeIds.length) return {};

  const { data, error } = await supabase.functions.invoke("create-staff-invite", {
    body: {
      action: "list_statuses",
      employee_ids: employeeIds,
    },
  });

  if (error) {
    const responseData = error.context instanceof Response
      ? await error.context.clone().json().catch(() => null)
      : null;
    throw new Error(
      responseData?.error || error.message || "Unable to load employee invite statuses.",
    );
  }
  if (!data?.statuses || typeof data.statuses !== "object") {
    throw new Error("The invitation status response was invalid.");
  }

  return data.statuses;
}

// ---------- Payroll ----------

function subscribePayroll(onChange, { employeeId } = {}, onError = () => {}) {
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

async function confirmPayrollPayment(payrollId) {
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

async function generatePayslip({
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

function subscribeLeaveRequests(onChange, { employeeId } = {}, onError = () => {}) {
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

async function submitLeaveRequest({ employeeId, type, startDate, endDate, reason }) {
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

async function setLeaveRequestStatus(id, status, reviewerId, currentStatus) {
  if (!["approved", "rejected"].includes(status)) {
    throw new Error("Choose an approved or rejected status.");
  }
  if (!reviewerId) throw new Error("Unable to identify the administrator. Sign in again.");
  if (!["pending", "approved", "rejected"].includes(currentStatus)) {
    throw new Error("The current leave request status is invalid. Refresh and try again.");
  }
  if (status === currentStatus) {
    return { request: null, updated: false };
  }

  const { data: updatedRequest, error } = await supabase.from("leave_requests")
    .update({
      status,
      reviewed_by: reviewerId,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("status", currentStatus)
    .select("*")
    .maybeSingle();
  if (error) throw error;

  if (updatedRequest) return { request: updatedRequest, updated: true };

  const { data: latestRequest, error: lookupError } = await supabase
    .from("leave_requests")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (lookupError) throw lookupError;
  if (!latestRequest) throw new Error("This leave request could not be found.");
  if (latestRequest.status === status) {
    return { request: latestRequest, updated: false };
  }
  throw new Error("This request changed while you were reviewing it. Refresh and try again.");
}

// Flushes any leave requests queued while offline. Registered to run on
// the browser's 'online' event.
async function flushPendingWrites() {
  const pending = await localDb.pendingWrites.toArray();
  for (const item of pending) {
    if (item.kind === "leave_request") {
      const { error } = await supabase.from("leave_requests").insert(item.payload);
      if (!error) await localDb.pendingWrites.delete(item.localId);
    }
  }
}

// ---------- Notifications ----------

function subscribeNotifications(employeeId, onChange) {
  async function fetchAndNotify() {
    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("employee_id", employeeId)
      .order("created_at", { ascending: false });
    if (!error) {
      await localDb.notifications.bulkPut(data);
      onChange(data);
    } else {
      const all = await localDb.notifications.toArray();
      onChange(all.filter((n) => n.employee_id === employeeId));
    }
  }
  fetchAndNotify();
  const channel = supabase
    .channel(`notif-changes-${employeeId}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "notifications" }, fetchAndNotify)
    .subscribe();
  return () => supabase.removeChannel(channel);
}

function subscribeAdminPasswordResetRequests(onChange, onError = () => {}) {
  async function fetchAndNotify() {
    const { data, error } = await supabase
      .from("password_reset_requests")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Unable to load password-reset requests:", error.message);
      onError(error);
      return;
    }

    onError(null);
    onChange(data || []);
  }

  fetchAndNotify().catch((error) => {
    console.error("Unexpected password-reset request error:", error);
    onError(error);
  });

  const channel = supabase
    .channel("admin-password-reset-request-changes")
    .on("postgres_changes", { event: "*", schema: "public", table: "password_reset_requests" }, () => {
      fetchAndNotify().catch((error) => {
        console.error("Unable to refresh password-reset requests:", error);
        onError(error);
      });
    })
    .subscribe();
  return () => supabase.removeChannel(channel);
}

async function markPasswordResetRequestRead(requestId) {
  const readAt = new Date().toISOString();
  const { data, error } = await supabase
    .from("password_reset_requests")
    .update({ read_at: readAt })
    .eq("id", requestId)
    .is("read_at", null)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("Unable to mark password-reset request as read:", error.message);
    throw error;
  }
  if (!data) return null;

  return readAt;
}

async function markNotificationRead(notificationId, employeeId) {
  const readAt = new Date().toISOString();
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: readAt })
    .eq("id", notificationId)
    .eq("employee_id", employeeId)
    .is("read_at", null);

  if (error) {
    console.error("Unable to mark notification as read:", error.message);
    throw error;
  }

  await localDb.notifications.update(notificationId, { read_at: readAt });
  return readAt;
}

function sendNotification(employeeId, title, message) {
  return supabase.from("notifications").insert({
    employee_id: employeeId,
    title,
    message,
    type: "leave",
  });
}

// ---------- Tasks ----------

function subscribeTasks(onChange, { employeeId } = {}, onError = () => {}) {
  async function fetchAndNotify() {
    try {
      let query = supabase.from("tasks").select("*").order("due_date", { ascending: true });
      if (employeeId) query = query.eq("employee_id", employeeId);
      const { data, error } = await query;
      if (error) throw error;
      await localDb.tasks.bulkPut(data);
      onChange(data);
      onError(null);
    } catch (error) {
      console.error("Unable to load tasks from Supabase:", error.message);
      onError(error);
      const all = await localDb.tasks.toArray();
      onChange(employeeId
        ? all.filter((task) => (task.employee_id || task.assigned_to) === employeeId)
        : all);
    }
  }
  fetchAndNotify().catch((error) => {
    console.error("Unexpected task list error:", error);
    onError(error);
  });
  const channel = supabase
    .channel(`tasks-changes-${employeeId || "all"}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, () => {
      fetchAndNotify().catch((error) => {
        console.error("Unexpected task refresh error:", error);
        onError(error);
      });
    })
    .subscribe();
  return () => supabase.removeChannel(channel);
}

async function assignTask({ title, description, assignedTo, assignedBy, dueDate, priority }) {
  const cleanTitle = typeof title === "string" ? title.trim() : "";
  const cleanDescription = typeof description === "string" ? description.trim() : "";
  const validPriorities = ["low", "medium", "high"];
  const parsedDueDate = typeof dueDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dueDate)
    ? new Date(`${dueDate}T00:00:00Z`)
    : null;

  if (!cleanTitle || !cleanDescription || !assignedTo || !assignedBy) {
    throw new Error("Enter a title, description, employee, and assigning administrator.");
  }
  if (!parsedDueDate || Number.isNaN(parsedDueDate.getTime()) || parsedDueDate.toISOString().slice(0, 10) !== dueDate) {
    throw new Error("Choose a valid task due date.");
  }
  if (!validPriorities.includes(priority)) {
    throw new Error("Choose a valid task priority.");
  }

  const { data, error } = await supabase.from("tasks").insert({
    title: cleanTitle,
    description: cleanDescription,
    employee_id: assignedTo,
    assigned_by: assignedBy,
    due_date: dueDate,
    priority,
  }).select("*").single();
  if (error) throw error;
  await localDb.tasks.put(data);
  return data;
}

async function updateTaskProgress(taskId, status) {
  if (!["in_progress", "completed"].includes(status)) {
    throw new Error("Choose a valid task progress status.");
  }
  const { error } = await supabase.rpc("update_task_progress", {
    p_task_id: taskId,
    p_status: status,
  });
  if (error) throw error;
}

export {
  addEmployee,
  assignTask,
  confirmPayrollPayment,
  fetchDirectory,
  fetchEmployeeInviteStatuses,
  flushPendingWrites,
  generatePayslip,
  markNotificationRead,
  markPasswordResetRequestRead,
  sendNotification,
  setLeaveRequestStatus,
  submitLeaveRequest,
  subscribeAdminPasswordResetRequests,
  subscribeEmployees,
  subscribeLeaveRequests,
  subscribeNotifications,
  subscribePayroll,
  subscribeTasks,
  updateEmployee,
  updateTaskProgress,
};
