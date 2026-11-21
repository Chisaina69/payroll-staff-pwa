# Payday — Staff & Payroll PWA

Payday is a responsive staff and payroll application for administrators and employees. Administrators maintain employee records, issue staff invites, prepare payslips, review leave, assign tasks, and handle password-reset requests. Staff can view their payslips, request leave, follow tasks, read notifications, and see a limited employee directory.

The interface is built with React and Vite. Supabase provides authentication, database access, realtime updates, and Edge Functions for sensitive staff account workflows. Dexie stores selected data in the browser so some screens can fall back to cached data when the network is unavailable.

## Run locally

Use Node.js 20 or later.

```sh
npm install
npm run dev
```

Create a `.env.local` file in the project root and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` using Supabase Dashboard → Project Settings → API. The URL must be the full project URL, for example `https://<project-ref>.supabase.co`. Restart Vite after changing these values. They are public client settings; never put a Supabase `service_role` key in a `VITE_*` variable or commit it to the repository.

The app is installable as a PWA on supported browsers. Open the deployed HTTPS site and choose **Install app** or **Add to Home screen** from the browser menu. On Render, set the two `VITE_*` values as build environment variables and redeploy. [render.yaml](render.yaml) configures the static publish directory and SPA route fallback so direct links such as `/login` load the app.

## Feature guide and code tour

This section describes what a user sees, what happens behind the scenes, and where to find the implementation. A useful way to follow most features through the code is:

1. A page or form handles the user's input.
2. A function in [src/lib/services.js](src/lib/services.js) validates or shapes the data and calls Supabase.
3. Supabase stores or returns the record; subscriptions refresh the relevant dashboard state.
4. The UI displays the result or a specific error.

### Sign-in, roles, and protected dashboards

- **What it does:** Administrators sign in with email and password. Staff sign in with employee ID and password. After authentication, each user is routed to the dashboard that matches their profile role.
- **How it works:** [src/auth/AuthContext.jsx](src/auth/AuthContext.jsx) loads the Supabase session and the matching `profiles` row, then exposes `user`, `role`, and `employeeId` through the auth context. Email identifiers use Supabase password sign-in; employee IDs use the `employee-login` Edge Function via [src/lib/paydayAuth.js](src/lib/paydayAuth.js). [src/App.jsx](src/App.jsx) selects the dashboard, while [src/routes/ProtectedRoute.jsx](src/routes/ProtectedRoute.jsx) redirects signed-out users and users with the wrong role.
- **Presentation point:** “The profile connects the Supabase login identity to an application role. That lets the same app present different tools to an administrator and an employee.”

The browser's route guard is a user-experience layer, not a replacement for database authorization. Configure Supabase Row Level Security (RLS) policies so users can only read or change records they are allowed to access.

### Staff account activation and password reset

- **What it does:** An administrator can issue a one-time registration invite to an employee with an active employee record. The employee uses the employee ID, invite code, and a password of at least 12 characters to activate their account. Staff can also ask an administrator for a password-reset invite.
- **How it works:** The form in [src/pages/admin/AdminDashboard.jsx](src/pages/admin/AdminDashboard.jsx) calls `createStaffInvite` in [src/lib/paydayAuth.js](src/lib/paydayAuth.js), which invokes the `create-staff-invite` Edge Function. The function checks the caller's admin role, creates a random code, stores its hash, and sets a 30-minute expiry. [src/pages/Signup.jsx](src/pages/Signup.jsx) reads invite details from the URL fragment and calls `redeem-staff-invite`; the Edge Function validates and consumes the code before creating the staff profile or changing a password. The code is removed from the browser URL after it is read.
- **Password-reset request:** The sign-in page in [src/pages/Login.jsx](src/pages/Login.jsx) can submit an employee ID to the same Edge Function. Valid requests are stored in `password_reset_requests` and deduplicated for 15 minutes. The response is intentionally generic so it does not reveal whether an employee ID has an active account. The admin sees requests in the Notifications tab, marks them read, and can issue the reset invite from the employee record.
- **Security note:** Invite codes are one-time, short-lived, and stored as hashes. The Edge Functions use server-side Supabase credentials; those secrets must stay in the Supabase Function environment and must never be exposed in frontend variables.

### Employee records and offboarding

- **What it does:** Administrators add employees with an employee ID, name, work email, department, position, and monthly salary. They can deactivate and later reactivate a record.
- **How it works:** [src/pages/admin/AddEmployeeForm.jsx](src/pages/admin/AddEmployeeForm.jsx) collects and checks the form, then calls `addEmployee` in [src/lib/services.js](src/lib/services.js). The Employees tab in [src/pages/admin/AdminDashboard.jsx](src/pages/admin/AdminDashboard.jsx) lists those records and shows staff account/invitation status.
- **Deactivation:** The admin confirms the action; `setEmployeeStatus` updates the employee's `status` to `inactive`. This preserves payroll and other historical records. The employee-login and invite Edge Functions reject inactive employees, and the admin UI excludes inactive employees from new payslip generation and task assignment. Reactivation changes the status back to `active`.
- **Important limitation:** Deactivation blocks future employee-ID logins and new actions exposed by this UI, but an existing authenticated session may remain usable. RLS policies must also check employee status and restrict employee updates to administrators to enforce this at the database level.

### Payroll and payslips

- **Administrator workflow:** In the Payroll tab, an administrator chooses an active employee, pay period, and optional allowances. `generatePayslip` in [src/lib/services.js](src/lib/services.js) reads the employee's basic salary, computes deductions, and inserts a `payroll_records` row with a pending payment status and the administrator's ID as creator. The admin can then confirm payment; `confirmPayrollPayment` only changes a pending record to paid.
- **Calculation:** [src/lib/payrollCalculator.js](src/lib/payrollCalculator.js) calculates NSSF, SHIF, Affordable Housing Levy, PAYE, and net pay using the configured rates and PAYE bands in that file. The gross amount is basic salary plus allowances. [src/pages/admin/GeneratePayslipForm.jsx](src/pages/admin/GeneratePayslipForm.jsx) gathers the inputs, and [src/lib/payslipReceipt.js](src/lib/payslipReceipt.js) formats the itemized deductions and receipt.
- **Staff workflow:** The Payslips tab in [src/pages/staff/StaffDashboard.jsx](src/pages/staff/StaffDashboard.jsx) loads only the signed-in employee's records, displays payment status and amounts, and expands each payslip into a receipt. The employee can print or save the receipt as PDF through the browser's print dialog.
- **Presentation point:** “The system generates a transparent, itemized payslip and tracks whether payment is pending or confirmed. The statutory rates live in one calculation module so they can be reviewed and updated centrally.”
- **Operational note:** Confirm that the configured rates and payroll rules are correct for the organization's jurisdiction and current tax year before relying on calculations for actual payroll.

### Leave requests and leave balance

- **Staff workflow:** Staff choose Annual, Sick, or Unpaid leave, enter a date range and reason, and submit a request. [src/lib/leave.js](src/lib/leave.js) counts weekdays inclusively, excluding Saturday and Sunday. [src/pages/staff/StaffDashboard.jsx](src/pages/staff/StaffDashboard.jsx) shows the estimated days, request history, and remaining shared Annual/Sick allowance.
- **Balance rule:** The UI starts with a 21-working-day Annual/Sick allowance for the current year, then subtracts approved Annual and Sick leave. Pending and rejected requests do not reduce it; Unpaid leave does not use this balance. This is the app's configured rule and should be aligned with the organization's actual leave policy.
- **Administrator workflow:** The Leave Requests tab in [src/pages/admin/AdminDashboard.jsx](src/pages/admin/AdminDashboard.jsx) lets an admin approve or reject pending requests. `setLeaveRequestStatus` in [src/lib/services.js](src/lib/services.js) checks the expected current status to avoid overwriting a concurrent decision. After a successful decision, the app sends the employee a notification.
- **Offline behavior:** If a staff member submits while offline, the request is queued in the browser's Dexie database. [src/main.jsx](src/main.jsx) flushes queued leave requests when the browser reports that it is online again. Other actions are not generally queued for offline submission.

### Task assignment and progress

- **Administrator workflow:** An administrator creates a task with title, description, active assignee, due date, and priority. [src/pages/admin/AssignTaskForm.jsx](src/pages/admin/AssignTaskForm.jsx) collects the task; `assignTask` in [src/lib/services.js](src/lib/services.js) validates it and inserts it.
- **Staff workflow:** Staff see only their own task list. They can start a pending task or mark a task complete. `updateTaskProgress` calls the `update_task_progress` database function, which checks the staff role, employee ownership, and allowed status transition before updating the row.
- **Related database work:** [supabase/migrations/20261110100000_add_task_priority.sql](supabase/migrations/20261110100000_add_task_priority.sql) adds priority values. [supabase/migrations/20261110113300_add_update_task_progress_rpc.sql](supabase/migrations/20261110113300_add_update_task_progress_rpc.sql) adds the checked progress update function.

### Notifications

- **Staff notifications:** Staff receive dashboard notifications, including alerts when a new payslip is available or a task is assigned. Database triggers in [supabase/migrations/20261110133000_notify_staff_on_task_and_payslip.sql](supabase/migrations/20261110133000_notify_staff_on_task_and_payslip.sql) create those notices. Staff can open a notice to mark it read.
- **Leave decisions:** When an administrator approves or rejects leave, the dashboard inserts a notification describing the decision.
- **Administrator notifications:** The admin Notifications tab lists password-reset requests separately from staff notifications. [supabase/migrations/20261110112400_admin_only_password_reset_requests.sql](supabase/migrations/20261110112400_admin_only_password_reset_requests.sql) creates that table and adds admin-only policies for reading and marking requests as read.

### Staff profile and employee directory

- **Profile:** The Profile tab shows the signed-in employee's name, department, position, and work email from the employee record.
- **Directory:** The Directory tab calls `fetchDirectory` in [src/lib/services.js](src/lib/services.js), which reads the `employee_directory` database view. The view exposes only the names, departments, and positions of active employees to signed-in users; salary and contact details are not included.

### Realtime updates, local cache, and responsive layout

- **Realtime and cache:** The subscription functions in [src/lib/services.js](src/lib/services.js) fetch an initial snapshot, then listen for Supabase Realtime changes and refetch affected lists. Selected employee, payroll, leave, task, and notification data is cached in IndexedDB through [src/db/Localdb.js](src/db/Localdb.js). Some subscriptions use that cache as a fallback if a Supabase read fails.
- **Scope of offline support:** The cache can help display previously loaded information, and leave requests can be queued for later submission. This is not a full offline mode: users need a connection for sign-in and most writes.
- **Responsive interface:** [src/components/DashboardShell.jsx](src/components/DashboardShell.jsx) provides desktop sidebar navigation and mobile bottom navigation. Admin and staff pages render compact cards on smaller screens and tables on wider screens.
- **PWA setup:** [vite.config.js](vite.config.js) configures the installable app manifest, service-worker generation, automatic service-worker updates, and app-shell navigation fallback.

## Code map

| Area | Main implementation |
| --- | --- |
| Application routes | [src/App.jsx](src/App.jsx) |
| Authentication state and role | [src/auth/AuthContext.jsx](src/auth/AuthContext.jsx) |
| Login and activation forms | [src/pages/Login.jsx](src/pages/Login.jsx), [src/pages/Signup.jsx](src/pages/Signup.jsx) |
| Admin dashboard and forms | [src/pages/admin/AdminDashboard.jsx](src/pages/admin/AdminDashboard.jsx), [src/pages/admin/AddEmployeeForm.jsx](src/pages/admin/AddEmployeeForm.jsx), [src/pages/admin/GeneratePayslipForm.jsx](src/pages/admin/GeneratePayslipForm.jsx), [src/pages/admin/AssignTaskForm.jsx](src/pages/admin/AssignTaskForm.jsx) |
| Staff dashboard | [src/pages/staff/StaffDashboard.jsx](src/pages/staff/StaffDashboard.jsx) |
| Data services | [src/lib/services.js](src/lib/services.js) |
| Auth Edge Functions | [supabase/functions/employee-login/index.ts](supabase/functions/employee-login/index.ts), [supabase/functions/create-staff-invite/index.ts](supabase/functions/create-staff-invite/index.ts), [supabase/functions/redeem-staff-invite/index.ts](supabase/functions/redeem-staff-invite/index.ts) |
| Payroll and leave calculations | [src/lib/payrollCalculator.js](src/lib/payrollCalculator.js), [src/lib/leave.js](src/lib/leave.js) |
| Browser cache and PWA | [src/db/Localdb.js](src/db/Localdb.js), [vite.config.js](vite.config.js) |

## Supabase setup and deployment

1. Create a Supabase project and enable email/password authentication.
2. Create the tables queried by the app: `profiles`, `employees`, `payroll_records`, `leave_requests`, `notifications`, and `tasks`. Employee records use fields such as `id`, `employee_code`, `first_name`, `last_name`, `email`, `department`, `position`, `basic_salary`, and `status`. Staff profiles connect an auth user to an employee through `profiles.employee_id`.
3. Create and test RLS policies for the intended admin/staff access before using real employee or payroll data. The public anon key does not replace database policies. The base schema, policies, and some database helper objects are not fully defined by this repository.
4. Create the first admin user in Supabase Auth and insert a matching `profiles` row with the same user UUID as `id` and `role` set to `admin`. Admins sign in with email; staff sign in with their employee ID.
5. Add the required staff-invite objects used by the Edge Functions: `staff_invite_codes`, `audit_logs`, and the `consume_staff_invite`, `check_login_rate_limit`, and `reset_login_rate_limit` database functions.
6. Apply the SQL migrations in [supabase/migrations](supabase/migrations) in timestamp order. They add the limited employee directory view, task priority and progress checks, password-reset request storage and admin policies, notifications for new payslips and task assignments, and Realtime publication configuration. These migrations assume the referenced base tables, enums, schemas, and helper functions already exist.
7. Deploy the three Edge Functions in [supabase/functions](supabase/functions). Configure their server-side Supabase secrets and allowed origins. The functions allow local development origins and `https://payroll-staff-pwa.onrender.com`; add other exact origins with the optional comma-separated `PAYDAY_ALLOWED_ORIGINS` secret. Wildcards are not supported.

## Suggested presentation walkthrough

1. **Introduce the roles:** Show the login page, then explain that the profile role determines whether the user sees the admin or staff dashboard.
2. **Demonstrate employee onboarding:** Add an employee, issue the one-time invite, and explain how the employee activates their account.
3. **Show payroll:** Generate a payslip for an active employee, point out the itemized deductions and pending status, then show the staff receipt and payment status.
4. **Show day-to-day operations:** Submit and review a leave request, then assign a task and demonstrate staff task progress.
5. **Finish with account lifecycle and architecture:** Show notifications and employee deactivation; explain that history is preserved, Supabase stores shared records, Edge Functions handle sensitive invite/login flows, and RLS must enforce data access.

## Build and lint

```sh
npm run build
npm run lint
```
