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
2. Create the database tables and `employee_directory` view queried by the app: `profiles`, `employees`, `payroll_records`, `leave_requests`, `notifications`, and `tasks`. Employee records use `id`, `employee_code`, `first_name`, `last_name`, `email`, `department`, `position`, and `basic_salary`. Payroll records use `employee_id`, `period`, `basic_pay`, `allowances`, `deductions`, `net_pay`, and `payment_status`; related records and staff profiles reference the employee `id`. Column names are snake_case; see the Supabase queries in `src/lib/services.js` and `src/auth/AuthContext.jsx` for the fields used.
3. Configure Row Level Security and policies for the intended admin/staff access before using real employee or payroll data. The app's public anon key is not a substitute for database policies.
4. Create the first admin user in Supabase Auth and insert a matching `profiles` row with the same user UUID as `id` and `role` set to `admin`. Admins sign in with their email; staff sign in with their employee ID.
5. Add each employee's work email when creating their employee record. Admins can generate a one-time registration code from the Employees list; staff activate their account using the employee ID, that code, and a password.

The app expects staff profile rows to use `role: "staff"` and an `employee_id` matching an employee record. Staff invitations also require the `staff_invite_codes` and `audit_logs` tables and the `consume_staff_invite`, `check_login_rate_limit`, and `reset_login_rate_limit` database functions used by the Edge Functions. Deploy the three Edge Functions after creating these database objects. This repository does not yet include SQL migrations or configure RLS policies, so those objects and access rules must be created in the Supabase project before these flows can work.

The Edge Functions always allow `http://localhost:5173` and `http://127.0.0.1:5173` for local development. They also allow any additional exact origins listed in the optional `PAYDAY_ALLOWED_ORIGINS` Supabase Edge Function secret, as a comma-separated list. Deploy the Edge Functions after changing their code.

Leave requests are stored in `leave_requests` with `employee_id`, `leave_type`, `start_date`, `end_date`, `days`, `reason`, `status`, and `created_at` columns. The app counts weekdays inclusively (Saturday and Sunday are excluded), offers Annual, Sick, and Unpaid types, and derives the current year's annual leave balance from a 21-working-day allowance minus approved annual leave. Pending and rejected requests do not reduce that balance.

## Build and lint

```sh
npm run build
npm run lint
```
