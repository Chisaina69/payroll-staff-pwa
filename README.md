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
2. Create the database tables and `employee_directory` view queried by the app: `profiles`, `employees`, `payroll`, `leave_requests`, `notifications`, and `tasks`. Column names are snake_case; see the Supabase queries in `src/lib/services.js` and `src/auth/AuthContext.jsx` for the fields used.
3. Configure Row Level Security and policies for the intended admin/staff access before using real employee or payroll data. The app's public anon key is not a substitute for database policies.
4. Create the first admin user in Supabase Auth and insert a matching `profiles` row with the same user UUID as `id` and `role` set to `admin`.
5. Run the app. Admins can add employees; staff can register using an existing employee ID.

The app expects staff profile rows to use `role: "staff"` and an `employee_id` matching an employee record. It does not include SQL migrations or configure RLS policies yet, so those database objects and access rules must be created in the Supabase project before the corresponding features can work.

## Build and lint

```sh
npm run build
npm run lint
```
