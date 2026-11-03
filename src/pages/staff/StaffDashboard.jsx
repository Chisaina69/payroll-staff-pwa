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
import { supabase } from "../../lib/supabase";
import DashboardShell from "../../components/DashboardShell";
import { Badge, Button, Card, EmptyState, Field, StatCard, inputClass } from "../../components/ui";

export default function StaffDashboard() {
  const { logout, profile, employeeId } = useAuth();

  const [payslips, setPayslips] = useState([]);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [directory, setDirectory] = useState([]);
  const [myRecord, setMyRecord] = useState(null);
  const [tab, setTab] = useState("payslips");

  const [leaveType, setLeaveType] = useState("Annual");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [leaveMsg, setLeaveMsg] = useState("");

  useEffect(() => {
    if (!employeeId) return;
    const unsubs = [
      subscribePayroll(setPayslips, { employeeId }),
      subscribeLeaveRequests(setLeaveRequests, { employeeId }),
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
    setLeaveMsg("");
    try {
      await submitLeaveRequest({ employeeId, type: leaveType, startDate, endDate });
      setStartDate(""); setEndDate("");
    } catch (err) {
      setLeaveMsg(err.message);
    }
  }

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
        <StatCard label="Leave Balance" value={`${myRecord?.leave_balance ?? "—"} days`} accent />
        <StatCard label="Payslips" value={payslips.length} />
        <StatCard label="Open Tasks" value={pendingTasks} accent={pendingTasks > 0} />
        <StatCard label="Unread" value={unreadNotifs} accent={unreadNotifs > 0} />
      </div>

      {tab === "payslips" && (
        <section>
          <h2 className="font-display mb-4 text-xl font-semibold text-ink-900">Payslips</h2>
          {payslips.length === 0 ? <EmptyState>No payslips yet.</EmptyState> : (
            <Card className="overflow-x-auto p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line bg-surface-alt text-left text-xs font-semibold uppercase tracking-wide text-ink-500">
                    <th className="px-4 py-3">Period</th><th className="px-4 py-3">Gross</th><th className="px-4 py-3">Deductions</th><th className="px-4 py-3">Net</th>
                  </tr>
                </thead>
                <tbody>
                  {payslips.map((p) => (
                    <tr key={p.id} className="border-b border-line last:border-0">
                      <td className="px-4 py-3">{p.period}</td>
                      <td className="px-4 py-3 text-ink-600">KES {Number(p.gross).toLocaleString()}</td>
                      <td className="px-4 py-3 text-ink-600">KES {Number(p.nssf + p.shif + p.ahl + p.paye).toLocaleString()}</td>
                      <td className="px-4 py-3 font-semibold text-accent-600">KES {Number(p.net).toLocaleString()}</td>
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
              You have <span className="font-semibold text-accent-600">{myRecord?.leave_balance ?? "—"} days</span> remaining this year.
            </p>
            <form onSubmit={handleLeaveSubmit} className="flex flex-wrap items-end gap-3">
              <Field label="Type">
                <select className={inputClass} value={leaveType} onChange={(e) => setLeaveType(e.target.value)}>
                  <option>Annual</option><option>Sick</option><option>Unpaid</option>
                </select>
              </Field>
              <Field label="Start"><input type="date" className={inputClass} value={startDate} onChange={(e) => setStartDate(e.target.value)} required /></Field>
              <Field label="End"><input type="date" className={inputClass} value={endDate} onChange={(e) => setEndDate(e.target.value)} required /></Field>
              <Button type="submit">Submit</Button>
            </form>
            {leaveMsg && <p className="mt-3 text-sm text-danger">{leaveMsg}</p>}
          </Card>

          {leaveRequests.length === 0 ? <EmptyState>No leave requests yet.</EmptyState> : (
            <Card className="overflow-x-auto p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line bg-surface-alt text-left text-xs font-semibold uppercase tracking-wide text-ink-500">
                    <th className="px-4 py-3">Type</th><th className="px-4 py-3">Dates</th><th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {leaveRequests.map((r) => (
                    <tr key={r.id} className="border-b border-line last:border-0">
                      <td className="px-4 py-3">{r.type}</td>
                      <td className="px-4 py-3 text-ink-600">{r.start_date} → {r.end_date}</td>
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
