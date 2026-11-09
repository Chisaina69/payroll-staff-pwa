import { useEffect, useState } from "react";
import { Wallet, CalendarClock, Bell, ListChecks, UserCircle, Users } from "lucide-react";
import { useAuth } from "../../auth/useAuth";
import {
  subscribePayroll,
  subscribeLeaveRequests,
  subscribeNotifications,
  subscribeTasks,
  submitLeaveRequest,
  completeTask,
  fetchDirectory,
} from "../../lib/services";
import { countLeaveWorkingDays } from "../../lib/leave";
import { supabase } from "../../lib/supabase";
import DashboardShell from "../../components/DashboardShell";
import { Badge, Button, Card, EmptyState, Field, StatCard, inputClass } from "../../components/ui";

const CURRENT_LEAVE_YEAR = new Date().getFullYear();

export default function StaffDashboard() {
  const { logout, profile, employeeId } = useAuth();

  const [payslips, setPayslips] = useState([]);
  const [payrollLoadError, setPayrollLoadError] = useState("");
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [leaveLoadError, setLeaveLoadError] = useState("");
  const [notifications, setNotifications] = useState([]);
  const [tasks, setTasks] = useState([]);
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
      subscribeTasks(setTasks, { employeeId }),
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

  const annualLeaveUsed = leaveRequests.reduce((total, request) => {
    if (request.leave_type !== "Annual" || request.status !== "approved") return total;
    const yearStart = `${CURRENT_LEAVE_YEAR}-01-01`;
    const yearEnd = `${CURRENT_LEAVE_YEAR}-12-31`;
    const startDateInYear = request.start_date < yearStart ? yearStart : request.start_date;
    const endDateInYear = request.end_date > yearEnd ? yearEnd : request.end_date;
    return total + countLeaveWorkingDays(startDateInYear, endDateInYear);
  }, 0);
  const annualLeaveBalance = Math.max(0, 21 - annualLeaveUsed);
  const requestedLeaveDays = countLeaveWorkingDays(startDate, endDate);
  const annualLeaveExceedsBalance =
    leaveType === "Annual" && requestedLeaveDays > annualLeaveBalance;

  const unreadNotifs = notifications.filter((n) => !n.read).length;
  const pendingTasks = tasks.filter((t) => t.status === "pending").length;

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
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Leave Balance" value={`${annualLeaveBalance} working days`} accent />
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
          {payslips.length === 0 ? <EmptyState>No payslips yet.</EmptyState> : (
            <Card className="overflow-x-auto p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line bg-surface-alt text-left text-xs font-semibold uppercase tracking-wide text-ink-500">
                    <th className="px-4 py-3">Period</th><th className="px-4 py-3">Basic Pay</th><th className="px-4 py-3">Allowances</th><th className="px-4 py-3">Deductions</th><th className="px-4 py-3">Net Pay</th><th className="px-4 py-3">Payment Status</th>
                  </tr>
                </thead>
                <tbody>
                  {payslips.map((p) => (
                    <tr key={p.id} className="border-b border-line last:border-0">
                      <td className="px-4 py-3">{p.pay_period_start} – {p.pay_period_end}</td>
                      <td className="px-4 py-3 text-ink-600">KES {Number(p.basic_pay).toLocaleString()}</td>
                      <td className="px-4 py-3 text-ink-600">KES {Number(p.allowances).toLocaleString()}</td>
                      <td className="px-4 py-3 text-ink-600">KES {Number(p.deductions).toLocaleString()}</td>
                      <td className="px-4 py-3 font-semibold text-accent-600">KES {Number(p.net_pay).toLocaleString()}</td>
                      <td className="px-4 py-3"><Badge status={p.payment_status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </section>
      )}

      {tab === "leave" && (
        <section>
          <h2 className="font-display mb-4 text-xl font-semibold text-ink-900">Leave</h2>
          <Card className="mb-6">
            <p className="mb-3 text-sm text-ink-500">
              Annual leave balance: <span className="font-semibold text-accent-600">{annualLeaveBalance} working days</span> remaining this year.
            </p>
            <form onSubmit={handleLeaveSubmit} className="flex flex-wrap items-end gap-3">
              <Field label="Type">
                <select className={inputClass} value={leaveType} onChange={(e) => setLeaveType(e.target.value)}>
                  <option value="Annual">Annual</option>
                  <option value="Sick">Sick</option>
                  <option value="Unpaid">Unpaid</option>
                </select>
              </Field>
              <Field label="Start"><input type="date" className={inputClass} value={startDate} onChange={(e) => setStartDate(e.target.value)} required /></Field>
              <Field label="End"><input type="date" min={startDate || undefined} className={inputClass} value={endDate} onChange={(e) => setEndDate(e.target.value)} required /></Field>
              <Field label="Reason">
                <textarea
                  className={inputClass}
                  value={leaveReason}
                  onChange={(e) => setLeaveReason(e.target.value)}
                  rows={2}
                  maxLength={1000}
                  required
                />
              </Field>
              <Button type="submit" disabled={submittingLeave || requestedLeaveDays === 0 || annualLeaveExceedsBalance}>
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
            {annualLeaveExceedsBalance && (
              <p role="alert" className="mt-3 text-sm text-danger">
                This request exceeds your remaining annual leave balance of {annualLeaveBalance} working days.
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
            <Card className="overflow-x-auto p-0">
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
          )}
        </section>
      )}

      {tab === "notifications" && (
        <section>
          <h2 className="font-display mb-4 text-xl font-semibold text-ink-900">Notifications</h2>
          {notifications.length === 0 ? <EmptyState>Nothing here yet.</EmptyState> : (
            <div className="space-y-2">
              {notifications.map((n) => (
                <Card key={n.id} className={`p-4 ${!n.read ? "border-brand-300 bg-brand-50/40" : ""}`}>
                  <p className="text-sm text-ink-900">{n.message}</p>
                </Card>
              ))}
            </div>
          )}
        </section>
      )}

      {tab === "tasks" && (
        <section>
          <h2 className="font-display mb-4 text-xl font-semibold text-ink-900">My Tasks</h2>
          {tasks.length === 0 ? <EmptyState>No tasks assigned yet.</EmptyState> : (
            <div className="space-y-2">
              {tasks.map((t) => (
                <Card key={t.id} className="flex items-center justify-between p-4">
                  <div>
                    <p className="font-medium text-ink-900">{t.title}</p>
                    <p className="text-sm text-ink-500">{t.description}</p>
                    <p className="mt-1 text-xs text-ink-400">Due {t.due_date}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge status={t.status} />
                    {t.status === "pending" && (
                      <Button className="px-3 py-1.5 text-xs" onClick={() => completeTask(t.id)}>Mark Done</Button>
                    )}
                  </div>
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
          <Card className="overflow-x-auto p-0">
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
