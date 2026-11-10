import { Fragment, useEffect, useState } from "react";
import { Wallet, CalendarClock, Bell, ListChecks, UserCircle, Users } from "lucide-react";
import { useAuth } from "../../auth/useAuth";
import {
  subscribePayroll,
  subscribeLeaveRequests,
  subscribeNotifications,
  subscribeTasks,
  submitLeaveRequest,
  markNotificationRead,
  updateTaskProgress,
  fetchDirectory,
} from "../../lib/services";
import { countLeaveWorkingDays } from "../../lib/leave";
import { formatCurrency, getPayslipDetails, openPayslipReceipt } from "../../lib/payslipReceipt";
import { supabase } from "../../lib/supabase";
import DashboardShell from "../../components/DashboardShell";
import { Badge, Button, Card, EmptyState, Field, StatCard, inputClass } from "../../components/ui";

const CURRENT_LEAVE_YEAR = new Date().getFullYear();

function StaffDashboard() {
  const { logout, profile, employeeId } = useAuth();

  const [payslips, setPayslips] = useState([]);
  const [payrollLoadError, setPayrollLoadError] = useState("");
  const [expandedPayslipId, setExpandedPayslipId] = useState(null);
  const [receiptError, setReceiptError] = useState("");
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [leaveLoadError, setLeaveLoadError] = useState("");
  const [notifications, setNotifications] = useState([]);
  const [notificationReadError, setNotificationReadError] = useState("");
  const [markingNotificationId, setMarkingNotificationId] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [tasksLoadError, setTasksLoadError] = useState("");
  const [taskProgressError, setTaskProgressError] = useState("");
  const [updatingTaskId, setUpdatingTaskId] = useState(null);
  const [directory, setDirectory] = useState([]);
  const [myRecord, setMyRecord] = useState(null);
  const [tab, setTab] = useState("payslips");

  const [leaveType, setLeaveType] = useState("Annual");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [leaveReason, setLeaveReason] = useState("");
  const [leaveError, setLeaveError] = useState("");
  const [leaveMessage, setLeaveMessage] = useState("");
  const [submittingLeave, setSubmittingLeave] = useState(false);

  useEffect(() => {
    if (!employeeId) return;
    const unsubs = [
      subscribePayroll(setPayslips, { employeeId }, (error) => {
        setPayrollLoadError(error?.message || "");
      }),
      subscribeLeaveRequests(setLeaveRequests, { employeeId }, (error) => {
        setLeaveLoadError(error?.message || "");
      }),
      subscribeNotifications(employeeId, setNotifications),
      subscribeTasks(setTasks, { employeeId }, (error) => {
        setTasksLoadError(error?.message || "");
      }),
    ];
    supabase.from("employees").select("*").eq("id", employeeId).single()
      .then(({ data, error }) => {
        if (error) {
          console.error("Unable to load employee record:", error.message);
          return;
        }
        setMyRecord(data);
      });
    fetchDirectory().then(setDirectory).catch((error) => {
      console.error("Unable to load employee directory:", error.message);
    });
    return () => unsubs.forEach((u) => u());
  }, [employeeId]);

  async function handleLeaveSubmit(e) {
    e.preventDefault();
    setLeaveError("");
    setLeaveMessage("");
    setSubmittingLeave(true);
    try {
      const result = await submitLeaveRequest({
        employeeId,
        type: leaveType,
        startDate,
        endDate,
        reason: leaveReason,
      });
      if (result.request) {
        setLeaveRequests((current) => [
          result.request,
          ...current.filter((request) => request.id !== result.request.id),
        ].sort((a, b) => (b.created_at || "").localeCompare(a.created_at || "")));
      }
      setLeaveMessage(result.queued
        ? "You're offline. Your leave request is saved and will submit when you're back online."
        : "Your leave request has been submitted.");
      setStartDate("");
      setEndDate("");
      setLeaveReason("");
    } catch (err) {
      setLeaveError(err.message || "Unable to submit your leave request.");
    } finally {
      setSubmittingLeave(false);
    }
  }

  function handlePayslipReceipt(record) {
    setReceiptError("");
    if (!openPayslipReceipt(record, myRecord)) {
      setReceiptError("Allow pop-ups for this site to open and save your payslip as a PDF.");
    }
  }

  async function handleNotificationOpen(notification) {
    if (notification.read_at || markingNotificationId) return;

    setNotificationReadError("");
    setMarkingNotificationId(notification.id);
    setNotifications((current) =>
      current.map((item) =>
        item.id === notification.id
          ? { ...item, read_at: new Date().toISOString() }
          : item
      )
    );

    try {
      await markNotificationRead(notification.id, employeeId);
    } catch (error) {
      setNotifications((current) =>
        current.map((item) =>
          item.id === notification.id ? { ...item, read_at: null } : item
        )
      );
      setNotificationReadError(error.message || "Unable to mark this notification as read.");
    } finally {
      setMarkingNotificationId(null);
    }
  }

  async function handleTaskProgress(task, status) {
    setTaskProgressError("");
    setUpdatingTaskId(task.id);
    try {
      await updateTaskProgress(task.id, status);
      setTasks((current) => current.map((item) =>
        item.id === task.id
          ? {
            ...item,
            progress_status: status,
            ...(status === "completed"
              ? { status: "completed" }
              : {}),
          }
          : item
      ));
    } catch (error) {
      setTaskProgressError(error.message || "Unable to update task progress.");
    } finally {
      setUpdatingTaskId(null);
    }
  }

  const paidLeaveUsed = leaveRequests.reduce((total, request) => {
    if (!["Annual", "Sick"].includes(request.leave_type) || request.status !== "approved") {
      return total;
    }
    const yearStart = `${CURRENT_LEAVE_YEAR}-01-01`;
    const yearEnd = `${CURRENT_LEAVE_YEAR}-12-31`;
    const startDateInYear = request.start_date < yearStart ? yearStart : request.start_date;
    const endDateInYear = request.end_date > yearEnd ? yearEnd : request.end_date;
    return total + countLeaveWorkingDays(startDateInYear, endDateInYear);
  }, 0);
  const paidLeaveBalance = Math.max(0, 21 - paidLeaveUsed);
  const requestedLeaveDays = countLeaveWorkingDays(startDate, endDate);
  const paidLeaveExceedsBalance =
    leaveType !== "Unpaid" && requestedLeaveDays > paidLeaveBalance;

  const unreadNotifs = notifications.filter((n) => !n.read_at).length;
  const pendingTasks = tasks.filter((task) =>
    (task.progress_status || task.status) !== "completed"
  ).length;

  const navItems = [
    { key: "payslips", label: "Payslips", icon: Wallet },
    { key: "leave", label: "Leave", icon: CalendarClock },
    { key: "notifications", label: "Notifications", icon: Bell, count: unreadNotifs },
    { key: "tasks", label: "Tasks", icon: ListChecks, count: pendingTasks },
    { key: "profile", label: "Profile", icon: UserCircle },
    { key: "directory", label: "Directory", icon: Users },
  ];

  return (
    <DashboardShell
      brand={`${myRecord ? `${myRecord.first_name} ${myRecord.last_name}`.trim() : profile?.display_name || "Staff"} — ${myRecord?.employee_code || ""}`}
      navItems={navItems}
      activeTab={tab}
      onTabChange={setTab}
      onLogout={logout}
    >
      <div className="mb-6 hidden grid-cols-2 gap-3 md:grid md:grid-cols-4">
        <StatCard label="Annual & Sick Balance" value={`${paidLeaveBalance} working days`} accent />
        <StatCard label="Payslips" value={payslips.length} />
        <StatCard label="Open Tasks" value={pendingTasks} accent={pendingTasks > 0} />
        <StatCard label="Unread" value={unreadNotifs} accent={unreadNotifs > 0} />
      </div>

      {tab === "payslips" && (
        <section>
          <h2 className="font-display mb-4 text-xl font-semibold text-ink-900">Payslips</h2>
          {payrollLoadError && (
            <p className="mb-4 rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm text-warning">
              Could not load payslips from Supabase: {payrollLoadError}
            </p>
          )}
          {receiptError && <p role="alert" className="mb-4 text-sm text-danger">{receiptError}</p>}
          {payslips.length === 0 ? <EmptyState>No payslips yet.</EmptyState> : (
            <>
            <div className="space-y-3 md:hidden">
              {payslips.map((payslip) => {
                const details = getPayslipDetails(payslip);
                const expanded = expandedPayslipId === payslip.id;
                return (
                  <Card key={payslip.id} className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-ink-900">{payslip.pay_period_start} – {payslip.pay_period_end}</p>
                        <p className="mt-1 text-xs text-ink-500">Net pay</p>
                        <p className="text-lg font-semibold text-accent-600">{formatCurrency(details.netPay)}</p>
                      </div>
                      <Badge status={payslip.payment_status} />
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-3 border-t border-line pt-3 text-xs">
                      <div><p className="text-ink-500">Basic pay</p><p className="mt-0.5 font-medium">{formatCurrency(details.basicPay)}</p></div>
                      <div><p className="text-ink-500">Allowances</p><p className="mt-0.5 font-medium">{formatCurrency(details.allowances)}</p></div>
                      <div><p className="text-ink-500">Deductions</p><p className="mt-0.5 font-medium">{formatCurrency(details.deductionTotal)}</p></div>
                      <div><p className="text-ink-500">Gross pay</p><p className="mt-0.5 font-medium">{formatCurrency(details.gross)}</p></div>
                    </div>
                    <Button
                      variant="secondary"
                      className="mt-3 w-full"
                      aria-expanded={expanded}
                      onClick={() => setExpandedPayslipId(expanded ? null : payslip.id)}
                    >
                      {expanded ? "Hide receipt" : "View receipt"}
                    </Button>
                    {expanded && (
                      <div className="mt-3 border-t border-line pt-3">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <h3 className="font-semibold text-ink-900">Receipt details</h3>
                          <Button className="px-3 py-2 text-xs" onClick={() => handlePayslipReceipt(payslip)}>
                            Download / Print
                          </Button>
                        </div>
                        <div className="space-y-2 text-sm">
                          {details.deductions.map((deduction) => (
                            <p key={deduction.label} className="flex justify-between gap-3">
                              <span>{deduction.label}</span>
                              <span className="font-medium">{formatCurrency(deduction.amount)}</span>
                            </p>
                          ))}
                          <p className="flex justify-between border-t border-line pt-2 font-semibold">
                            <span>Total deductions</span><span>{formatCurrency(details.deductionTotal)}</span>
                          </p>
                          <p className="flex justify-between text-base font-semibold text-accent-600">
                            <span>Net pay</span><span>{formatCurrency(details.netPay)}</span>
                          </p>
                        </div>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
            <Card className="hidden overflow-x-auto p-0 md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line bg-surface-alt text-left text-xs font-semibold uppercase tracking-wide text-ink-500">
                    <th className="px-4 py-3">Period</th><th className="px-4 py-3">Basic Pay</th><th className="px-4 py-3">Allowances</th><th className="px-4 py-3">Deductions</th><th className="px-4 py-3">Net Pay</th><th className="px-4 py-3">Payment Status</th><th className="px-4 py-3">Receipt</th>
                  </tr>
                </thead>
                <tbody>
                  {payslips.map((p) => {
                    const details = getPayslipDetails(p);
                    const expanded = expandedPayslipId === p.id;
                    return (
                      <Fragment key={p.id}>
                        <tr className="border-b border-line last:border-0">
                          <td className="px-4 py-3">{p.pay_period_start} – {p.pay_period_end}</td>
                          <td className="px-4 py-3 text-ink-600">{formatCurrency(details.basicPay)}</td>
                          <td className="px-4 py-3 text-ink-600">{formatCurrency(details.allowances)}</td>
                          <td className="px-4 py-3 text-ink-600">{formatCurrency(details.deductionTotal)}</td>
                          <td className="px-4 py-3 font-semibold text-accent-600">{formatCurrency(details.netPay)}</td>
                          <td className="px-4 py-3"><Badge status={p.payment_status} /></td>
                          <td className="px-4 py-3">
                            <Button
                              variant="secondary"
                              className="whitespace-nowrap px-3 py-1.5 text-xs"
                              aria-expanded={expanded}
                              onClick={() => setExpandedPayslipId(expanded ? null : p.id)}
                            >
                              {expanded ? "Hide receipt" : "View receipt"}
                            </Button>
                          </td>
                        </tr>
                        {expanded && (
                          <tr className="border-b border-line bg-surface-alt/50">
                            <td colSpan={7} className="px-4 py-4">
                              <div className="mx-auto max-w-2xl rounded-xl border border-line bg-white p-5">
                                <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                                  <div>
                                    <h3 className="font-display text-lg font-semibold text-ink-900">Payslip receipt</h3>
                                    <p className="text-sm text-ink-500">
                                      {myRecord ? `${myRecord.first_name} ${myRecord.last_name}`.trim() : profile?.display_name}
                                      {myRecord?.employee_code ? ` · ${myRecord.employee_code}` : ""}
                                    </p>
                                  </div>
                                  <Button
                                    className="px-3 py-1.5 text-xs"
                                    onClick={() => handlePayslipReceipt(p)}
                                  >
                                    Download / Print PDF
                                  </Button>
                                </div>
                                <p className="mb-3 text-sm text-ink-600">
                                  Pay period: {p.pay_period_start} – {p.pay_period_end}
                                </p>
                                <div className="grid gap-2 text-sm sm:grid-cols-2">
                                  <p>Basic pay <span className="float-right font-medium">{formatCurrency(details.basicPay)}</span></p>
                                  <p>Allowances <span className="float-right font-medium">{formatCurrency(details.allowances)}</span></p>
                                  <p>Gross pay <span className="float-right font-semibold">{formatCurrency(details.gross)}</span></p>
                                </div>
                                <h4 className="mb-2 mt-4 font-semibold text-ink-900">Itemized deductions</h4>
                                <div className="space-y-2 text-sm">
                                  {details.deductions.map((deduction) => (
                                    <p key={deduction.label} className="flex justify-between gap-4">
                                      <span>{deduction.label}</span>
                                      <span className="font-medium">{formatCurrency(deduction.amount)}</span>
                                    </p>
                                  ))}
                                  <p className="flex justify-between gap-4 border-t border-line pt-2 font-semibold">
                                    <span>Total deductions</span>
                                    <span>{formatCurrency(details.deductionTotal)}</span>
                                  </p>
                                  <p className="flex justify-between gap-4 text-base font-semibold text-accent-600">
                                    <span>Net pay</span>
                                    <span>{formatCurrency(details.netPay)}</span>
                                  </p>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </Card>
            </>
          )}
        </section>
      )}

      {tab === "leave" && (
        <section>
          <h2 className="font-display mb-4 text-xl font-semibold text-ink-900">Leave</h2>
          <Card className="mb-6">
            <p className="mb-3 text-sm text-ink-500">
              Annual and sick leave balance: <span className="font-semibold text-accent-600">{paidLeaveBalance} working days</span> remaining this year. Unpaid leave does not use this balance.
            </p>
            <form onSubmit={handleLeaveSubmit} className="grid grid-cols-2 items-end gap-3 sm:grid-cols-4">
              <Field label="Type" className="col-span-2 sm:col-span-1">
                <select className={inputClass} value={leaveType} onChange={(e) => setLeaveType(e.target.value)}>
                  <option value="Annual">Annual</option>
                  <option value="Sick">Sick</option>
                  <option value="Unpaid">Unpaid</option>
                </select>
              </Field>
              <Field label="Start"><input type="date" className={inputClass} value={startDate} onChange={(e) => setStartDate(e.target.value)} required /></Field>
              <Field label="End"><input type="date" min={startDate || undefined} className={inputClass} value={endDate} onChange={(e) => setEndDate(e.target.value)} required /></Field>
              <Field label="Reason" className="col-span-2 sm:col-span-3">
                <textarea
                  className={inputClass}
                  value={leaveReason}
                  onChange={(e) => setLeaveReason(e.target.value)}
                  rows={2}
                  maxLength={1000}
                  required
                />
              </Field>
              <Button type="submit" className="col-span-2 sm:col-span-1" disabled={submittingLeave || requestedLeaveDays === 0 || paidLeaveExceedsBalance}>
                {submittingLeave ? "Submitting..." : "Submit request"}
              </Button>
            </form>
            {requestedLeaveDays > 0 && (
              <p className="mt-3 text-sm text-ink-500">
                This request covers {requestedLeaveDays} working {requestedLeaveDays === 1 ? "day" : "days"}.
                Weekends are excluded.
              </p>
            )}
            {startDate && endDate && requestedLeaveDays === 0 && (
              <p role="alert" className="mt-3 text-sm text-danger">
                Choose an end date on or after the start date and include at least one weekday.
              </p>
            )}
            {paidLeaveExceedsBalance && (
              <p role="alert" className="mt-3 text-sm text-danger">
                This request exceeds your remaining Annual and Sick leave balance of {paidLeaveBalance} working days.
              </p>
            )}
            {leaveError && <p role="alert" className="mt-3 text-sm text-danger">{leaveError}</p>}
            {leaveMessage && <p role="status" className="mt-3 text-sm text-success">{leaveMessage}</p>}
          </Card>

          {leaveLoadError && (
            <p role="alert" className="mb-4 rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm text-warning">
              Could not load leave request history from Supabase: {leaveLoadError}
            </p>
          )}
          {leaveRequests.length === 0 ? <EmptyState>No leave requests yet.</EmptyState> : (
            <>
            <div className="space-y-3 md:hidden">
              {leaveRequests.map((request) => (
                <Card key={request.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-ink-900">{request.leave_type} leave</p>
                      <p className="mt-0.5 text-xs text-ink-500">{request.days} working days</p>
                    </div>
                    <Badge status={request.status} />
                  </div>
                  <p className="mt-3 text-sm text-ink-700">{request.start_date} → {request.end_date}</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-ink-500">{request.reason}</p>
                  <p className="mt-2 text-xs text-ink-400">
                    Submitted {request.created_at ? new Date(request.created_at).toLocaleDateString() : "—"}
                  </p>
                </Card>
              ))}
            </div>
            <Card className="hidden overflow-x-auto p-0 md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line bg-surface-alt text-left text-xs font-semibold uppercase tracking-wide text-ink-500">
                    <th className="px-4 py-3">Type</th><th className="px-4 py-3">Dates</th><th className="px-4 py-3">Working Days</th><th className="px-4 py-3">Reason</th><th className="px-4 py-3">Submitted</th><th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {leaveRequests.map((r) => (
                    <tr key={r.id} className="border-b border-line last:border-0">
                      <td className="px-4 py-3">{r.leave_type}</td>
                      <td className="px-4 py-3 text-ink-600">{r.start_date} → {r.end_date}</td>
                      <td className="px-4 py-3 text-ink-600">{r.days}</td>
                      <td className="px-4 py-3 text-ink-600">{r.reason}</td>
                      <td className="px-4 py-3 text-ink-600">
                        {r.created_at ? new Date(r.created_at).toLocaleDateString() : "—"}
                      </td>
                      <td className="px-4 py-3"><Badge status={r.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
            </>
          )}
        </section>
      )}

      {tab === "notifications" && (
        <section>
          <h2 className="font-display mb-4 text-xl font-semibold text-ink-900">Notifications</h2>
          {notificationReadError && (
            <p role="alert" className="mb-4 text-sm text-danger">{notificationReadError}</p>
          )}
          {notifications.length === 0 ? <EmptyState>Nothing here yet.</EmptyState> : (
            <div className="space-y-2">
              {notifications.map((n) => (
                <Card
                  key={n.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`${n.title || "Notification"}${n.read_at ? ", read" : ", unread. Open to mark as read."}`}
                  className={`cursor-pointer p-4 ${!n.read_at ? "border-brand-300 bg-brand-50/40" : ""}`}
                  onClick={() => handleNotificationOpen(n)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      handleNotificationOpen(n);
                    }
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      {n.title && <p className="font-medium text-ink-900">{n.title}</p>}
                      <p className="text-sm text-ink-900">{n.message}</p>
                      {n.created_at && (
                        <p className="mt-1 text-xs text-ink-500">{new Date(n.created_at).toLocaleString()}</p>
                      )}
                    </div>
                    {!n.read_at && (
                      <span className="shrink-0 rounded-full bg-brand-700 px-2 py-1 text-xs font-semibold text-white">
                        {markingNotificationId === n.id ? "Reading..." : "Unread"}
                      </span>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </section>
      )}

      {tab === "tasks" && (
        <section>
          <h2 className="font-display mb-4 text-xl font-semibold text-ink-900">My Tasks</h2>
          {tasksLoadError && (
            <p role="alert" className="mb-4 rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm text-warning">
              Could not load tasks from Supabase: {tasksLoadError}
            </p>
          )}
          {taskProgressError && (
            <p role="alert" className="mb-4 text-sm text-danger">{taskProgressError}</p>
          )}
          {tasks.length === 0 ? <EmptyState>No tasks assigned yet.</EmptyState> : (
            <div className="space-y-3">
              {tasks.map((t) => (
                <Card key={t.id} className="p-4">
                  <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                    <div className="min-w-0">
                      <p className="font-medium text-ink-900">{t.title}</p>
                      <p className="mt-1 whitespace-pre-wrap text-sm text-ink-600">{t.description}</p>
                      <p className="mt-2 text-xs text-ink-500">Due {t.due_date}</p>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      <span className="text-xs font-medium text-ink-500">Priority</span>
                      <Badge status={t.priority || "medium"} />
                      <Badge status={t.progress_status || t.status} />
                    </div>
                  </div>
                  {(t.progress_status || t.status) !== "completed" && (
                    <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-3">
                      {(t.progress_status || t.status) === "pending" && (
                        <Button
                          className="px-3 py-1.5 text-xs"
                          disabled={updatingTaskId !== null}
                          onClick={() => handleTaskProgress(t, "in_progress")}
                        >
                          {updatingTaskId === t.id ? "Updating..." : "Start task"}
                        </Button>
                      )}
                      <Button
                        className="px-3 py-1.5 text-xs"
                        disabled={updatingTaskId !== null}
                        onClick={() => handleTaskProgress(t, "completed")}
                      >
                        {updatingTaskId === t.id ? "Updating..." : "Mark completed"}
                      </Button>
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}
        </section>
      )}

      {tab === "profile" && (
        <section className="max-w-md">
          <h2 className="font-display mb-4 text-xl font-semibold text-ink-900">My Profile</h2>
          <Card>
            <dl className="mb-5 space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-ink-500">Name</dt><dd className="font-medium text-ink-900">{myRecord ? `${myRecord.first_name} ${myRecord.last_name}`.trim() : ""}</dd></div>
              <div className="flex justify-between"><dt className="text-ink-500">Department</dt><dd className="font-medium text-ink-900">{myRecord?.department}</dd></div>
              <div className="flex justify-between"><dt className="text-ink-500">Position</dt><dd className="font-medium text-ink-900">{myRecord?.position}</dd></div>
              <div className="flex justify-between"><dt className="text-ink-500">Work email</dt><dd className="font-medium text-ink-900">{myRecord?.email}</dd></div>
            </dl>
          </Card>
        </section>
      )}

      {tab === "directory" && (
        <section>
          <h2 className="font-display mb-4 text-xl font-semibold text-ink-900">Employee Directory</h2>
          <div className="space-y-3 md:hidden">
            {directory.map((person) => (
              <Card key={person.id || person.employee_code || person.employee_id} className="p-4">
                <p className="font-semibold text-ink-900">{person.first_name ? `${person.first_name} ${person.last_name || ""}`.trim() : person.name}</p>
                <p className="mt-1 text-sm text-ink-600">{person.position || "—"}</p>
                <p className="mt-2 text-xs text-ink-500">{person.department || "—"}</p>
              </Card>
            ))}
            {directory.length === 0 && <EmptyState>No directory entries yet.</EmptyState>}
          </div>
          <Card className="hidden overflow-x-auto p-0 md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line bg-surface-alt text-left text-xs font-semibold uppercase tracking-wide text-ink-500">
                  <th className="px-4 py-3">Name</th><th className="px-4 py-3">Department</th><th className="px-4 py-3">Position</th>
                </tr>
              </thead>
              <tbody>
                {directory.map((d) => (
                  <tr key={d.id || d.employee_code || d.employee_id} className="border-b border-line last:border-0">
                    <td className="px-4 py-3 font-medium text-ink-900">{d.first_name ? `${d.first_name} ${d.last_name || ""}`.trim() : d.name}</td>
                    <td className="px-4 py-3 text-ink-600">{d.department}</td>
                    <td className="px-4 py-3 text-ink-600">{d.position}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </section>
      )}
    </DashboardShell>
  );
}

export default StaffDashboard;
