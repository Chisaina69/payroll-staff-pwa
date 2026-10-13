# Payday — Staff & Payroll PWA

Payday is a responsive React PWA for payroll administrators and staff. It is being built in phases. This version includes Firebase email/password sign-in, role-gated admin and staff portals, admin-created employee records with employee-ID registration, and a clearly labelled sample admin dashboard. Payroll, leave, task, and notification data are not connected yet.

## Run locally

Use Node.js 20 or later (Vite 8 does not run on Node.js 12).

```sh
npm install
cp .env.example .env.local
npm run dev
```

Fill in `.env.local` (or `.env`) with the `VITE_FIREBASE_*` variables from Firebase Console → Project settings → Your apps. Restart Vite after changing environment variables. Firebase web configuration is public client configuration; never put Firebase service-account credentials in a `VITE_*` variable or in this repository.

## Firebase setup

1. Create a Firebase project and register a web app.
2. Enable **Authentication → Sign-in method → Email/Password** and create a **Cloud Firestore** database using the `(default)` database ID in the same project as the web app.
3. Add the local and deployed app domains under **Authentication → Settings → Authorized domains**.
4. Copy the web app's API key, auth domain, project ID, and app ID into `.env.local`. The messaging sender ID and storage bucket are optional for this phase.
5. Deploy the included Firestore rules before using the app:

   ```sh
   firebase deploy --only firestore:rules
   ```

6. Bootstrap the first administrator in Firebase Console. Create the administrator's account under Authentication, verify its email, copy its UID, then create a document at `users/{uid}` in Firestore:

   ```json
   {
     "email": "admin@example.com",
     "displayName": "Administrator Name",
     "role": "admin"
   }
   ```

   Use the exact Auth UID as the document ID and a lowercase email address. The app accepts `admin` or `Admin` for the admin role, but lowercase `admin` is recommended. The application does not offer public administrator registration or let users choose their own role.
7. Start the app. An administrator can create an employee record and share the generated employee ID and registration link. The employee registers with that ID and work email, creates a password, and verifies the email before entering the staff portal.

If the browser console reports `Database '(default)' not found`, create the `(default)` Cloud Firestore database in the Firebase project configured by `VITE_FIREBASE_PROJECT_ID`. Confirm the project ID under Firebase Console → Project settings → General matches the app's `.env.local`, then restart Vite and reload the app. Firestore rules cannot create a database; deploy them after database creation.

## Current authentication model

- Admin and staff use the same sign-in page; the role on `users/{uid}` determines which portal opens.
- The app requires email verification before opening either portal. The provided Firestore rules do not require verified email, so verification is an app-level check, not a database access control.
- Users can read their own `users/{uid}` document; administrators can read user documents. A staff account is created at `users/{uid}` with `role: "staff"` and an `employeeId` that must refer to an existing `employees/{employeeId}` document.
- Administrators create employee records at `employees/{employeeId}`. Employees can read their own record and associated payroll/leave data according to the rules. The admin dashboard's summary and table still use sample data; the add-employee form creates a real Firestore employee record.
- **Security limitation in the supplied rules:** the `users` create rule checks that the employee ID exists, but it does not check that the Auth email matches the email on that employee record. The UI checks the email after registration, but client-side checks can be bypassed. Before production, add an email-match condition to the `users` create rule (and validate the allowed user document fields) to prevent someone who knows another employee ID from linking their account to that employee's data.
- The supplied `payroll`, `leaveRequests`, and `notifications` rules are present, but those features are not connected to the app yet.
- The service worker caches the application shell and same-origin assets. Sensitive employee or payroll records should not be cached in the service worker; offline data storage and sync will be implemented separately with Firestore and IndexedDB/Dexie.

## Build and lint

```sh
npm run build
npm run lint
```
