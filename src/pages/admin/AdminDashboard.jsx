import { useEffect, useState } from "react";
import { Users, Wallet, CalendarClock, ListChecks, Plus, Bell } from "lucide-react";
import { useAuth } from "../../auth/useAuth";
import {
  subscribeEmployees,
  subscribePayroll,
  subscribeLeaveRequests,
  subscribeTasks,
  subscribeAdminPasswordResetRequests,
  fetchEmployeeInviteStatuses,
  setLeaveRequestStatus,
  sendNotification,
  markPasswordResetRequestRead,
  confirmPayrollPayment,
} from "../../lib/services";
import DashboardShell from "../../components/DashboardShell";
import { Badge, Button, Card, EmptyState, StatCard } from "../../components/ui";
import { inputClass } from "../../components/formStyles";
import AddEmployeeForm from "./AddEmployeeForm";
import GeneratePayslipForm from "./GeneratePayslipForm";
import AssignTaskForm from "./AssignTaskForm";
import { createStaffInvite } from "../../lib/paydayAuth";

function AdminDashboard() {
  const { logout, profile, user } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [employeeLoadError, setEmployeeLoadError] = useState("");
  const [inviteStatuses, setInviteStatuses] = useState({});
  const [inviteStatusesKey, setInviteStatusesKey] = useState("");
  const [inviteStatusError, setInviteStatusError] = useState("");
  const [payroll, setPayroll] = useState([]);
  const [payrollLoadError, setPayrollLoadError] = useState("");
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [leaveDecisionError, setLeaveDecisionError] = useState("");
  const [updatingLeaveId, setUpdatingLeaveId] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [tasksLoadError, setTasksLoadError] = useState("");
  const [passwordResetRequests, setPasswordResetRequests] = useState([]);
  const [adminNotificationsError, setAdminNotificationsError] = useState("");
  const [markingAdminNotificationId, setMarkingAdminNotificationId] = useState(null);
  const [adminNotificationError, setAdminNotificationError] = useState("");
  const [tab, setTab] = useState("employees");
  const [showAddEmployee, setShowAddEmployee] = useState(false);
  const [showGeneratePayslip, setShowGeneratePayslip] = useState(false);
  const [showAssignTask, setShowAssignTask] = useState(false);
  const [invite, setInvite] = useState(null);
  const [inviteCopied, setInviteCopied] = useState(false);
  const [inviteError, setInviteError] = useState("");
  const [invitingEmployee, setInvitingEmployee] = useState(null);
  const [paymentError, setPaymentError] = useState("");
  const [confirmingPaymentId, setConfirmingPaymentId] = useState(null);

  useEffect(() => {
    const unsubs = [
      subscribeEmployees(setEmployees, (error) => {
        setEmployeeLoadError(error?.message || "");
      }),
      subscribePayroll(setPayroll, {}, (error) => {
        setPayrollLoadError(error?.message || "");
      }),
      subscribeLeaveRequests(setLeaveRequests),
      subscribeTasks(setTasks, {}, (error) => {
        setTasksLoadError(error?.message || "");
      }),
      subscribeAdminPasswordResetRequests(setPasswordResetRequests, (error) => {
        setAdminNotificationsError(error?.message || "");
      }),
    ];
    return () => unsubs.forEach((u) => u());
  }, []);

  const employeeIdsKey = employees.map((employee) => employee.id).join(",");

  useEffect(() => {
    let active = true;
    const employeeIds = employeeIdsKey ? employeeIdsKey.split(",") : [];

    async function refreshInviteStatuses() {
      if (!employeeIds.length) {
        setInviteStatuses({});
        setInviteStatusError("");
        setInviteStatusesKey(employeeIdsKey);
        return;
      }

      try {
        const statuses = await fetchEmployeeInviteStatuses(employeeIds);
        if (active) {
          setInviteStatuses(statuses);
          setInviteStatusError("");
          setInviteStatusesKey(employeeIdsKey);
        }
      } catch (error) {
        if (active) {
          console.error("Unable to load employee invite statuses:", error);
          setInviteStatusError(error.message || "Unable to load invitation status.");
          setInviteStatusesKey(employeeIdsKey);
        }
      }
    }

    refreshInviteStatuses();
    const intervalId = window.setInterval(refreshInviteStatuses, 60_000);
    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [employeeIdsKey]);

  function employeeName(employeeId) {
    const employee = employees.find((e) => e.id === employeeId);
    return employee
      ? `${employee.first_name} ${employee.last_name}`.trim()
      : employeeId;
  }

  function handleEmployeeAdded(employee) {
    setEmployees((current) => {
      const existingIndex = current.findIndex((item) => item.id === employee.id);
      const updated = existingIndex === -1
        ? [...current, employee]
        : current.map((item) => item.id === employee.id ? employee : item);
      return updated.sort((a, b) =>
        `${a.first_name} ${a.last_name}`.localeCompare(
          `${b.first_name} ${b.last_name}`,
        )
      );
    });
    setEmployeeLoadError("");
    setShowAddEmployee(false);
  }

  function handlePayrollCreated(record) {
    setPayroll((current) => [
      record,
      ...current.filter((item) => item.id !== record.id),
    ].sort((a, b) =>
      b.pay_period_start.localeCompare(a.pay_period_start)
    ));
    setPayrollLoadError("");
    setShowGeneratePayslip(false);
  }

  function handleTaskAssigned(task) {
    setTasks((current) => [
      task,
      ...current.filter((item) => item.id !== task.id),
    ].sort((a, b) => (a.due_date || "").localeCompare(b.due_date || "")));
    setTasksLoadError("");
    setShowAssignTask(false);
  }

  async function handleLeaveDecision(request, status) {
    setLeaveDecisionError("");
    setUpdatingLeaveId(request.id);
    try {
      const result = await setLeaveRequestStatus(
        request.id,
        status,
        user?.id,
        request.status,
      );
      if (!result.updated) {
        setLeaveDecisionError(`This request is already ${status}.`);
        return;
      }

      setLeaveRequests((current) =>
        current.map((item) => item.id === result.request.id ? result.request : item)
      );
      const { error } = await sendNotification(
        request.employee_id,
        `Leave request ${status}`,
        `Your ${request.leave_type} leave request has been ${status}.`,
      );
      if (error) {
        console.error("Leave decision saved, but staff notification failed:", error.message);
        setLeaveDecisionError(`Request ${status}, but the staff notification could not be sent: ${error.message}`);
      }
    } catch (error) {
      setLeaveDecisionError(error.message || "Unable to update this leave request.");
    } finally {
      setUpdatingLeaveId(null);
    }
  }

  async function handlePaymentConfirmation(payrollId) {
    setPaymentError("");
    setConfirmingPaymentId(payrollId);
    try {
      const updatedRecord = await confirmPayrollPayment(payrollId);
      setPayroll((current) =>
        current.map((record) => record.id === updatedRecord.id ? updatedRecord : record)
      );
    } catch (error) {
      setPaymentError(error.message || "Unable to confirm this payment.");
    } finally {
      setConfirmingPaymentId(null);
    }
  }

  async function handlePasswordResetRequestRead(request) {
    setAdminNotificationError("");
    setMarkingAdminNotificationId(request.id);
    try {
      const readAt = await markPasswordResetRequestRead(request.id);
      setPasswordResetRequests((current) => current.map((item) =>
        item.id === request.id
          ? { ...item, read_at: item.read_at || readAt }
          : item
      ));
    } catch (error) {
      setAdminNotificationError(error.message || "Unable to mark this notification as read.");
    } finally {
      setMarkingAdminNotificationId(null);
    }
  }

  async function handleCreateInvite(employeeCode, purpose = "activation") {
    setInvite(null);
    setInviteCopied(false);
    setInviteError("");
    setInvitingEmployee(employeeCode);
    try {
      const result = await createStaffInvite(employeeCode, purpose);
      const inviteHash = new URLSearchParams({
        employee_code: result.employee_code,
        registration_code: result.registration_code,
      });
      const invitePath = purpose === "password_reset"
        ? "/signup?mode=reset"
        : "/signup";
      setInvite({
        ...result,
        purpose,
        inviteLink: `${window.location.origin}${invitePath}#${inviteHash.toString()}`,
      });
      const employee = employees.find((item) => item.employee_code === employeeCode);
      if (employee && purpose === "activation") {
        setInviteStatuses((current) => ({ ...current, [employee.id]: "invited" }));
      }
    } catch (error) {
      setInviteError(error.message || "Unable to generate a registration code.");
    } finally {
      setInvitingEmployee(null);
    }
  }

  function renderEmployeeAccountAction(employee) {
    if (inviteStatuses[employee.id] === "active") {
      return (
        <div className="flex flex-wrap items-center gap-2">
          <Badge status="active" />
          <Button
            variant="secondary"
            className="px-3 py-1.5 text-xs"
            disabled={invitingEmployee !== null}
            onClick={() => handleCreateInvite(employee.employee_code, "password_reset")}
          >
            {invitingEmployee === employee.employee_code ? "Generating..." : "Password reset invite"}
          </Button>
        </div>
      );
    }

    if (inviteStatuses[employee.id] === "invited") {
      return (
        <div className="flex items-center gap-2">
          <Badge status="invited" />
          <span className="text-xs text-ink-500">Invite sent</span>
        </div>
      );
    }

    return (
      <Button
        className="px-3 py-1.5 text-xs"
        disabled={
          employee.status !== "active" ||
          invitingEmployee !== null ||
          inviteStatusesKey !== employeeIdsKey ||
          Boolean(inviteStatusError)
        }
        onClick={() => handleCreateInvite(employee.employee_code)}
      >
        {invitingEmployee === employee.employee_code
          ? "Generating..."
          : inviteStatuses[employee.id] === "expired" ? "Resend invite" : "Create invite"}
      </Button>
    );
  }

  async function handleCopyInviteLink() {
    try {
      await navigator.clipboard.writeText(invite.inviteLink);
      setInviteCopied(true);
    } catch (error) {
      console.error("Unable to copy invite link:", error);
      setInviteError("Unable to copy the invite link. Select and copy the link manually.");
    }
  }

  const pendingLeave = leaveRequests.filter((r) => r.status === "pending").length;
  const pendingTasks = tasks.filter((task) =>
    (task.progress_status || task.status) !== "completed"
  ).length;
  const unreadPasswordResetRequests = passwordResetRequests.filter((request) =>
    !request.read_at
  ).length;

  const navItems = [
    { key: "employees", label: "Employees", icon: Users, count: employees.length },
    { key: "payroll", label: "Payroll", icon: Wallet, count: payroll.length },
    { key: "leave", label: "Leave Requests", icon: CalendarClock, count: pendingLeave },
    { key: "tasks", label: "Tasks", icon: ListChecks, count: pendingTasks },
    { key: "notifications", label: "Notifications", icon: Bell, count: unreadPasswordResetRequests },
  ];

  return (
    <DashboardShell
      brand={`Admin — ${profile?.display_name || "Administrator"}`}
      navItems={navItems}
      activeTab={tab}
      onTabChange={setTab}
      onLogout={logout}
    >
      <div className="mb-6 hidden grid-cols-2 gap-3 lg:grid lg:grid-cols-4">
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
          {showAddEmployee && (
            <AddEmployeeForm
              onDone={handleEmployeeAdded}
              onCancel={() => setShowAddEmployee(false)}
            />
          )}
          {employeeLoadError && (
            <p className="mb-4 rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm text-warning">
              Could not refresh the employee list from Supabase: {employeeLoadError}
            </p>
          )}
          {invite && (
            <Card className="mb-5 border-brand-300">
              <p className="font-semibold text-ink-900">
                {invite.purpose === "password_reset" ? "Password reset invite" : "Registration invite"} for employee {invite.employee_code}
              </p>
              <p className="my-2 text-sm text-ink-600">
                Share this one-time link securely with the employee. It expires {new Date(invite.expires_at).toLocaleString()}.
              </p>
              <div className="flex flex-wrap gap-2">
                <input
                  className={`${inputClass} min-w-0 flex-1`}
                  value={invite.inviteLink}
                  readOnly
                  aria-label="One-time staff invite link"
                />
                <Button type="button" onClick={handleCopyInviteLink}>
                  {inviteCopied ? "Copied" : "Copy invite link"}
                </Button>
              </div>
            </Card>
          )}
          {inviteError && <p className="mb-4 text-sm text-danger">{inviteError}</p>}
          {inviteStatusError && (
            <p role="alert" className="mb-4 rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm text-warning">
              Could not load invitation statuses: {inviteStatusError}
            </p>
          )}
          {employees.length === 0 ? (
            <EmptyState>No employees yet. Add one to get started.</EmptyState>
          ) : (
            <>
            <div className="space-y-3 lg:hidden">
              {employees.map((employee) => (
                <Card key={employee.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-ink-900">
                        {employee.first_name} {employee.last_name}
                      </p>
                      <p className="mt-0.5 text-xs text-ink-500">{employee.employee_code}</p>
                    </div>
                    <Badge status={employee.status} />
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 border-t border-line pt-3 text-xs">
                    <div><dt className="text-ink-500">Department</dt><dd className="mt-0.5 font-medium text-ink-700">{employee.department || "—"}</dd></div>
                    <div><dt className="text-ink-500">Position</dt><dd className="mt-0.5 font-medium text-ink-700">{employee.position || "—"}</dd></div>
                    <div className="col-span-2"><dt className="text-ink-500">Monthly salary</dt><dd className="mt-0.5 font-medium text-ink-700">KES {Number(employee.basic_salary).toLocaleString()}</dd></div>
                  </dl>
                  <div className="mt-3 border-t border-line pt-3">
                    <p className="mb-2 text-xs font-medium text-ink-500">Account</p>
                    {renderEmployeeAccountAction(employee)}
                  </div>
                </Card>
              ))}
            </div>
            <Card className="hidden overflow-x-auto p-0 lg:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line bg-surface-alt text-left text-xs font-semibold uppercase tracking-wide text-ink-500">
                    <th className="px-4 py-3">ID</th><th className="px-4 py-3">Name</th><th className="px-4 py-3">Department</th>
                    <th className="px-4 py-3">Position</th><th className="px-4 py-3">Salary</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Account</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map((e) => (
                    <tr key={e.id} className="border-b border-line last:border-0 hover:bg-surface-alt/60">
                      <td className="px-4 py-3 font-medium text-ink-900">{e.employee_code}</td>
                      <td className="px-4 py-3">{e.first_name} {e.last_name}</td>
                      <td className="px-4 py-3 text-ink-600">{e.department}</td>
                      <td className="px-4 py-3 text-ink-600">{e.position}</td>
                      <td className="px-4 py-3 text-ink-600">KES {Number(e.basic_salary).toLocaleString()}</td>
                      <td className="px-4 py-3"><Badge status={e.status} /></td>
                      <td className="px-4 py-3">{renderEmployeeAccountAction(e)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
            </>
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
          {showGeneratePayslip && <GeneratePayslipForm employees={employees} onDone={handlePayrollCreated} />}
          {payrollLoadError && (
            <p className="mb-4 rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm text-warning">
              Could not load payroll records from Supabase: {payrollLoadError}
            </p>
          )}
          {paymentError && (
            <p role="alert" className="mb-4 rounded-lg border border-danger/30 bg-danger/10 p-3 text-sm text-danger">
              Payment confirmation failed: {paymentError}
            </p>
          )}
          {payroll.length > 0 && (
            <>
            <div className="space-y-3 lg:hidden">
              {payroll.map((record) => (
                <Card key={record.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-ink-900">{employeeName(record.employee_id)}</p>
                      <p className="mt-0.5 text-xs text-ink-500">
                        {record.pay_period_start} – {record.pay_period_end}
                      </p>
                    </div>
                    <Badge status={record.payment_status} />
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-3 border-t border-line pt-3 text-xs">
                    <div><dt className="text-ink-500">Basic pay</dt><dd className="mt-0.5 font-medium">KES {Number(record.basic_pay).toLocaleString()}</dd></div>
                    <div><dt className="text-ink-500">Allowances</dt><dd className="mt-0.5 font-medium">KES {Number(record.allowances).toLocaleString()}</dd></div>
                    <div><dt className="text-ink-500">Deductions</dt><dd className="mt-0.5 font-medium">KES {Number(record.deductions).toLocaleString()}</dd></div>
                    <div><dt className="text-ink-500">Net pay</dt><dd className="mt-0.5 font-semibold text-accent-600">KES {Number(record.net_pay).toLocaleString()}</dd></div>
                  </dl>
                  {record.payment_status === "pending" && (
                    <Button
                      className="mt-3 w-full"
                      disabled={confirmingPaymentId !== null}
                      onClick={() => handlePaymentConfirmation(record.id)}
                    >
                      {confirmingPaymentId === record.id ? "Confirming..." : "Confirm payment"}
                    </Button>
                  )}
                </Card>
              ))}
            </div>
            <Card className="hidden overflow-x-auto p-0 lg:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line bg-surface-alt text-left text-xs font-semibold uppercase tracking-wide text-ink-500">
                    <th className="px-4 py-3">Employee</th><th className="px-4 py-3">Period</th><th className="px-4 py-3">Basic Pay</th>
                    <th className="px-4 py-3">Allowances</th><th className="px-4 py-3">Deductions</th><th className="px-4 py-3">Net Pay</th><th className="px-4 py-3">Payment Status</th><th className="px-4 py-3">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {payroll.map((p) => (
                    <tr key={p.id} className="border-b border-line last:border-0 hover:bg-surface-alt/60">
                      <td className="px-4 py-3 font-medium text-ink-900">{employeeName(p.employee_id)}</td>
                      <td className="px-4 py-3 text-ink-600">{p.pay_period_start} – {p.pay_period_end}</td>
                      <td className="px-4 py-3 text-ink-600">KES {Number(p.basic_pay).toLocaleString()}</td>
                      <td className="px-4 py-3 text-ink-600">KES {Number(p.allowances).toLocaleString()}</td>
                      <td className="px-4 py-3 text-ink-600">KES {Number(p.deductions).toLocaleString()}</td>
                      <td className="px-4 py-3 font-semibold text-accent-600">KES {Number(p.net_pay).toLocaleString()}</td>
                      <td className="px-4 py-3"><Badge status={p.payment_status} /></td>
                      <td className="px-4 py-3">
                        {p.payment_status === "pending" && (
                          <Button
                            className="whitespace-nowrap px-3 py-1.5 text-xs"
                            disabled={confirmingPaymentId !== null}
                            onClick={() => handlePaymentConfirmation(p.id)}
                          >
                            {confirmingPaymentId === p.id ? "Confirming..." : "Confirm payment"}
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
            </>
          )}
          {payroll.length === 0 && !payrollLoadError && (
            <EmptyState>No payroll records yet. Generate a payslip to get started.</EmptyState>
          )}
        </section>
      )}

      {tab === "leave" && (
        <section>
          <h2 className="font-display mb-4 text-xl font-semibold text-ink-900">Leave Requests</h2>
          {leaveDecisionError && (
            <p role="alert" className="mb-4 rounded-lg border border-danger/30 bg-danger/10 p-3 text-sm text-danger">
              {leaveDecisionError}
            </p>
          )}
          {leaveRequests.length === 0 ? (
            <EmptyState>No leave requests yet.</EmptyState>
          ) : (
            <>
            <div className="space-y-3 lg:hidden">
              {leaveRequests.map((request) => (
                <Card key={request.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-ink-900">{employeeName(request.employee_id)}</p>
                      <p className="mt-0.5 text-xs text-ink-500">{request.leave_type} · {request.days} working days</p>
                    </div>
                    <Badge status={request.status} />
                  </div>
                  <p className="mt-3 text-sm text-ink-700">{request.start_date} → {request.end_date}</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-ink-500">{request.reason}</p>
                  <div className="mt-3 flex gap-2 border-t border-line pt-3">
                    <Button
                      className="flex-1 px-3 py-2 text-xs"
                      disabled={updatingLeaveId !== null || request.status === "approved"}
                      onClick={() => handleLeaveDecision(request, "approved")}
                    >
                      {updatingLeaveId === request.id ? "Saving..." : request.status === "approved" ? "Approved" : "Approve"}
                    </Button>
                    <Button
                      variant="danger"
                      className="flex-1 px-3 py-2 text-xs"
                      disabled={updatingLeaveId !== null || request.status === "rejected"}
                      onClick={() => handleLeaveDecision(request, "rejected")}
                    >
                      {request.status === "rejected" ? "Rejected" : "Reject"}
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
            <Card className="hidden overflow-x-auto p-0 lg:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line bg-surface-alt text-left text-xs font-semibold uppercase tracking-wide text-ink-500">
                    <th className="px-4 py-3">Employee</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Dates</th>
                    <th className="px-4 py-3">Days</th><th className="px-4 py-3">Reason</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {leaveRequests.map((r) => (
                    <tr key={r.id} className="border-b border-line last:border-0 hover:bg-surface-alt/60">
                      <td className="px-4 py-3 font-medium text-ink-900">{employeeName(r.employee_id)}</td>
                      <td className="px-4 py-3 text-ink-600">{r.leave_type}</td>
                      <td className="px-4 py-3 text-ink-600">{r.start_date} → {r.end_date}</td>
                      <td className="px-4 py-3 text-ink-600">{r.days}</td>
                      <td className="px-4 py-3 text-ink-600">{r.reason}</td>
                      <td className="px-4 py-3"><Badge status={r.status} /></td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <Button
                            variant="primary"
                            className="px-3 py-1.5 text-xs"
                            disabled={updatingLeaveId !== null || r.status === "approved"}
                            onClick={() => handleLeaveDecision(r, "approved")}
                          >
                            {updatingLeaveId === r.id ? "Saving..." : r.status === "approved" ? "Approved" : "Approve"}
                          </Button>
                          <Button
                            variant="danger"
                            className="px-3 py-1.5 text-xs"
                            disabled={updatingLeaveId !== null || r.status === "rejected"}
                            onClick={() => handleLeaveDecision(r, "rejected")}
                          >
                            {r.status === "rejected" ? "Rejected" : "Reject"}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
            </>
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
          {showAssignTask && (
            <AssignTaskForm
              employees={employees}
              onDone={handleTaskAssigned}
              onCancel={() => setShowAssignTask(false)}
            />
          )}
          {employees.length === 0 && <EmptyState>Add an employee before assigning a task.</EmptyState>}
          {tasksLoadError && (
            <p role="alert" className="mb-4 rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm text-warning">
              Could not load tasks from Supabase: {tasksLoadError}
            </p>
          )}
          {tasks.length === 0 ? (
            <EmptyState>No tasks assigned yet.</EmptyState>
          ) : (
            <>
            <div className="space-y-3 lg:hidden">
              {tasks.map((task) => (
                <Card key={task.id} className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="min-w-0 flex-1 font-semibold text-ink-900">{task.title}</p>
                    <Badge status={task.progress_status || task.status} />
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-ink-600">{task.description}</p>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3 text-xs">
                    <span className="text-ink-600">{employeeName(task.employee_id || task.assigned_to)}</span>
                    <span className="text-ink-500">Due {task.due_date}</span>
                    <Badge status={task.priority || "medium"} />
                  </div>
                </Card>
              ))}
            </div>
            <Card className="hidden overflow-x-auto p-0 lg:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line bg-surface-alt text-left text-xs font-semibold uppercase tracking-wide text-ink-500">
                    <th className="px-4 py-3">Task</th><th className="px-4 py-3">Assigned To</th><th className="px-4 py-3">Priority</th><th className="px-4 py-3">Due</th><th className="px-4 py-3">Progress</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.map((t) => (
                    <tr key={t.id} className="border-b border-line last:border-0 hover:bg-surface-alt/60">
                      <td className="px-4 py-3">
                        <p className="font-medium text-ink-900">{t.title}</p>
                        <p className="mt-1 max-w-md whitespace-pre-wrap text-xs text-ink-500">{t.description}</p>
                      </td>
                      <td className="px-4 py-3 text-ink-600">{employeeName(t.employee_id || t.assigned_to)}</td>
                      <td className="px-4 py-3"><Badge status={t.priority || "medium"} /></td>
                      <td className="px-4 py-3 text-ink-600">{t.due_date}</td>
                      <td className="px-4 py-3"><Badge status={t.progress_status || t.status} /></td>
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
          {adminNotificationsError && (
            <p role="alert" className="mb-4 rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm text-warning">
              Could not load password-reset requests from Supabase: {adminNotificationsError}
            </p>
          )}
          {adminNotificationError && (
            <p role="alert" className="mb-4 text-sm text-danger">{adminNotificationError}</p>
          )}
          {passwordResetRequests.length === 0 ? (
            <EmptyState>No password-reset requests.</EmptyState>
          ) : (
            <div className="space-y-3">
              {passwordResetRequests.map((request) => (
                <Card key={request.id} className={request.read_at ? "opacity-75" : "border-brand-300"}>
                  <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                    <div>
                      <p className="font-semibold text-ink-900">Password reset requested</p>
                      <p className="mt-1 text-sm text-ink-600">
                        {employeeName(request.employee_id)} needs a password-reset invite.
                      </p>
                      <p className="mt-2 text-xs text-ink-500">
                        {new Date(request.created_at).toLocaleString()}
                      </p>
                    </div>
                    {!request.read_at && (
                      <Button
                        variant="secondary"
                        className="shrink-0 px-3 py-1.5 text-xs"
                        disabled={markingAdminNotificationId !== null}
                        onClick={() => handlePasswordResetRequestRead(request)}
                      >
                        {markingAdminNotificationId === request.id ? "Saving..." : "Mark read"}
                      </Button>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </section>
      )}
    </DashboardShell>
  );
}

export default AdminDashboard;
