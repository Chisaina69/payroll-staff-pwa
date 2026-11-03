import { useEffect, useState } from "react";
import { Users, Wallet, CalendarClock, ListChecks, Plus } from "lucide-react";
import { useAuth } from "../../auth/useAuth";
import {
  subscribeEmployees,
  subscribePayroll,
  subscribeLeaveRequests,
  subscribeTasks,
  setLeaveRequestStatus,
  sendNotification,
} from "../../lib/services";
import DashboardShell from "../../components/DashboardShell";
import { Badge, Button, Card, EmptyState, StatCard } from "../../components/ui";
import AddEmployeeForm from "./AddEmployeeForm";
import GeneratePayslipForm from "./GeneratePayslipForm";
import AssignTaskForm from "./AssignTaskForm";

export default function AdminDashboard() {
  const { logout, profile } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [payroll, setPayroll] = useState([]);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [tab, setTab] = useState("employees");
  const [showAddEmployee, setShowAddEmployee] = useState(false);
  const [showGeneratePayslip, setShowGeneratePayslip] = useState(false);
  const [showAssignTask, setShowAssignTask] = useState(false);

  useEffect(() => {
    const unsubs = [
      subscribeEmployees(setEmployees),
      subscribePayroll(setPayroll),
      subscribeLeaveRequests(setLeaveRequests),
      subscribeTasks(setTasks),
    ];
    return () => unsubs.forEach((u) => u());
  }, []);

  function employeeName(employeeId) {
    return employees.find((e) => e.employee_id === employeeId)?.name || employeeId;
  }

  async function handleLeaveDecision(request, status) {
    await setLeaveRequestStatus(request.id, status);
    await sendNotification(request.employee_id, `Your ${request.type} leave request has been ${status}.`);
  }

  const pendingLeave = leaveRequests.filter((r) => r.status === "pending").length;
  const pendingTasks = tasks.filter((t) => t.status === "pending").length;

  const navItems = [
    { key: "employees", label: "Employees", icon: Users, count: employees.length },
    { key: "payroll", label: "Payroll", icon: Wallet, count: payroll.length },
    { key: "leave", label: "Leave Requests", icon: CalendarClock, count: pendingLeave },
    { key: "tasks", label: "Tasks", icon: ListChecks, count: pendingTasks },
  ];

  return (
    <DashboardShell
      brand={`Admin — ${profile?.display_name || "Administrator"}`}
      navItems={navItems}
      activeTab={tab}
      onTabChange={setTab}
      onLogout={logout}
    >
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Employees" value={employees.length} />
        <StatCard label="Payslips Issued" value={payroll.length} />
        <StatCard label="Pending Leave" value={pendingLeave} accent={pendingLeave > 0} />
        <StatCard label="Open Tasks" value={pendingTasks} accent={pendingTasks > 0} />
      </div>

      {tab === "employees" && (
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-xl font-semibold text-ink-900">Employee Records</h2>
            {!showAddEmployee && (
              <Button onClick={() => setShowAddEmployee(true)}><Plus size={15} /> Add Employee</Button>
            )}
          </div>
          {showAddEmployee && <AddEmployeeForm onDone={() => setShowAddEmployee(false)} />}
          {employees.length === 0 ? (
            <EmptyState>No employees yet. Add one to get started.</EmptyState>
          ) : (
            <Card className="overflow-x-auto p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line bg-surface-alt text-left text-xs font-semibold uppercase tracking-wide text-ink-500">
                    <th className="px-4 py-3">ID</th><th className="px-4 py-3">Name</th><th className="px-4 py-3">Department</th>
                    <th className="px-4 py-3">Position</th><th className="px-4 py-3">Salary</th><th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map((e) => (
                    <tr key={e.employee_id} className="border-b border-line last:border-0 hover:bg-surface-alt/60">
                      <td className="px-4 py-3 font-medium text-ink-900">{e.employee_id}</td>
                      <td className="px-4 py-3">{e.name}</td>
                      <td className="px-4 py-3 text-ink-600">{e.department}</td>
                      <td className="px-4 py-3 text-ink-600">{e.position}</td>
                      <td className="px-4 py-3 text-ink-600">KES {Number(e.salary).toLocaleString()}</td>
                      <td className="px-4 py-3"><Badge status={e.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </section>
      )}

      {tab === "payroll" && (
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-xl font-semibold text-ink-900">Payroll</h2>
            {!showGeneratePayslip && employees.length > 0 && (
              <Button onClick={() => setShowGeneratePayslip(true)}><Plus size={15} /> Generate Payslip</Button>
            )}
          </div>
          {employees.length === 0 && <EmptyState>Add an employee first before generating a payslip.</EmptyState>}
          {showGeneratePayslip && <GeneratePayslipForm employees={employees} onDone={() => setShowGeneratePayslip(false)} />}
          {payroll.length > 0 && (
            <Card className="overflow-x-auto p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line bg-surface-alt text-left text-xs font-semibold uppercase tracking-wide text-ink-500">
                    <th className="px-4 py-3">Employee</th><th className="px-4 py-3">Period</th><th className="px-4 py-3">Gross</th>
                    <th className="px-4 py-3">Deductions</th><th className="px-4 py-3">Net</th>
                  </tr>
                </thead>
                <tbody>
                  {payroll.map((p) => (
                    <tr key={p.id} className="border-b border-line last:border-0 hover:bg-surface-alt/60">
                      <td className="px-4 py-3 font-medium text-ink-900">{employeeName(p.employee_id)}</td>
                      <td className="px-4 py-3 text-ink-600">{p.period}</td>
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
          <h2 className="font-display mb-4 text-xl font-semibold text-ink-900">Leave Requests</h2>
          {leaveRequests.length === 0 ? (
            <EmptyState>No leave requests yet.</EmptyState>
          ) : (
            <Card className="overflow-x-auto p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line bg-surface-alt text-left text-xs font-semibold uppercase tracking-wide text-ink-500">
                    <th className="px-4 py-3">Employee</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Dates</th>
                    <th className="px-4 py-3">Days</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {leaveRequests.map((r) => (
                    <tr key={r.id} className="border-b border-line last:border-0 hover:bg-surface-alt/60">
                      <td className="px-4 py-3 font-medium text-ink-900">{employeeName(r.employee_id)}</td>
                      <td className="px-4 py-3 text-ink-600">{r.type}</td>
                      <td className="px-4 py-3 text-ink-600">{r.start_date} → {r.end_date}</td>
                      <td className="px-4 py-3 text-ink-600">{r.days}</td>
                      <td className="px-4 py-3"><Badge status={r.status} /></td>
                      <td className="px-4 py-3">
                        {r.status === "pending" && (
                          <div className="flex gap-2">
                            <Button variant="primary" className="px-3 py-1.5 text-xs" onClick={() => handleLeaveDecision(r, "approved")}>Approve</Button>
                            <Button variant="danger" className="px-3 py-1.5 text-xs" onClick={() => handleLeaveDecision(r, "rejected")}>Reject</Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </section>
      )}

      {tab === "tasks" && (
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-xl font-semibold text-ink-900">Tasks</h2>
            {!showAssignTask && employees.length > 0 && (
              <Button onClick={() => setShowAssignTask(true)}><Plus size={15} /> Assign Task</Button>
            )}
          </div>
          {showAssignTask && <AssignTaskForm employees={employees} onDone={() => setShowAssignTask(false)} />}
          {tasks.length === 0 ? (
            <EmptyState>No tasks assigned yet.</EmptyState>
          ) : (
            <Card className="overflow-x-auto p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line bg-surface-alt text-left text-xs font-semibold uppercase tracking-wide text-ink-500">
                    <th className="px-4 py-3">Title</th><th className="px-4 py-3">Assigned To</th><th className="px-4 py-3">Due</th><th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.map((t) => (
                    <tr key={t.id} className="border-b border-line last:border-0 hover:bg-surface-alt/60">
                      <td className="px-4 py-3 font-medium text-ink-900">{t.title}</td>
                      <td className="px-4 py-3 text-ink-600">{employeeName(t.assigned_to)}</td>
                      <td className="px-4 py-3 text-ink-600">{t.due_date}</td>
                      <td className="px-4 py-3"><Badge status={t.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </section>
      )}
    </DashboardShell>
  );
}
