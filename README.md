# Payday — Staff & Payroll PWA

Payday is a responsive React progressive web app for payroll administrators and staff. Authentication and app data use Supabase; employee, payroll, leave, task, and notification records are loaded from Supabase, with selected data cached locally using Dexie.

## Run locally

Use Node.js 20 or later.

```sh
npm install
cp .env.example .env.local
npm run dev
```

Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env.local` using Supabase Dashboard → Project Settings → API, then restart Vite. The URL must be the full project URL, for example `https://<project-ref>.supabase.co`; replace the example values in `.env.example` with your own project's values. These are public client values; never put a Supabase `service_role` key in a `VITE_*` variable or commit it to the repository.

## Supabase setup

1. Create a Supabase project and enable email/password authentication.
2. Create the database tables and `employee_directory` view queried by the app: `profiles`, `employees`, `payroll_records`, `leave_requests`, `notifications`, and `tasks`. Employee records use `id`, `employee_code`, `first_name`, `last_name`, `email`, `department`, `position`, and `basic_salary`. Payroll records use `employee_id`, `period`, `basic_pay`, `allowances`, `deductions`, `net_pay`, and `payment_status`; task assignments reference employees through `tasks.employee_id`. Related records and staff profiles reference the employee `id`. Column names are snake_case; see the Supabase queries in `src/lib/services.js` and `src/auth/AuthContext.jsx` for the fields used.
3. Configure Row Level Security and policies for the intended admin/staff access before using real employee or payroll data. The app's public anon key is not a substitute for database policies.
4. Create the first admin user in Supabase Auth and insert a matching `profiles` row with the same user UUID as `id` and `role` set to `admin`. Admins sign in with their email; staff sign in with their employee ID.
5. Add each employee's work email when creating their employee record. Admins can generate a one-time registration code from the Employees list; staff activate their account using the employee ID, that code, and a password.

The app expects staff profile rows to use `role: "staff"` and an `employee_id` matching an employee record. Staff invitations also require the `staff_invite_codes` and `audit_logs` tables and the `consume_staff_invite`, `check_login_rate_limit`, and `reset_login_rate_limit` database functions used by the Edge Functions. Deploy the three Edge Functions after creating these database objects. The migration in `supabase/migrations` adds the task priority column and its allowed values; apply it to the Supabase project before assigning prioritized tasks. RLS policies are not configured in this repository, so access rules must also be created in the Supabase project before these flows can work.

Staff can request a password reset from the sign-in page using their employee ID. Requests are stored separately from staff notifications and protected by an admin-only row-level security policy; requests for the same employee are deduplicated for 15 minutes. The response is the same whether or not an account matches the ID. Apply the migration in `supabase/migrations` and deploy the updated `create-staff-invite` Edge Function for reset requests to work. Admins can issue a short-lived password-reset invite for an existing staff account from the Employees panel. The employee opens the link, enters a new password of at least 12 characters, and uses the one-time invite; the code expires after 30 minutes and is consumed before the password changes. Share reset links with the employee through a trusted channel.

The Edge Functions always allow `http://localhost:5173` and `http://127.0.0.1:5173` for local development and `https://payroll-staff-pwa.onrender.com` for production. They also allow any additional exact origins listed in the optional `PAYDAY_ALLOWED_ORIGINS` Supabase Edge Function secret, as a comma-separated list. Origins are matched exactly; wildcard origins are not allowed. Deploy the Edge Functions after changing their code.

Leave requests are stored in `leave_requests` with `employee_id`, `leave_type`, `start_date`, `end_date`, `days`, `reason`, `status`, and `created_at` columns. The app counts weekdays inclusively (Saturday and Sunday are excluded), offers Annual, Sick, and Unpaid types, and derives the current year's shared Annual and Sick leave balance from a 21-working-day allowance minus approved Annual and Sick leave. Unpaid leave does not reduce that balance; pending and rejected requests do not reduce it either.

## Build and lint

```sh
npm run build
npm run lint
```
