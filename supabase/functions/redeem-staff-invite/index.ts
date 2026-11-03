// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

import {
  adminClient,
  getCorsHeaders,
  hashCode,
  isValidPassword,
  respond,
} from "../_shared/payday.ts";

Deno.serve(async (req: Request) => {
  const headers = getCorsHeaders(req);

  if (!headers) {
    return new Response("Origin not allowed", { status: 403 });
  }

  if (req.method === "OPTIONS") {
    return new Response(null, { headers });
  }

  if (req.method !== "POST") {
    return respond(headers, { error: "Method not allowed" }, 405);
  }

  let createdUserId: string | null = null;

  try {
    let body: unknown;

    try {
      body = await req.json();
    } catch {
      return respond(headers, { error: "Invalid request" }, 400);
    }

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return respond(headers, { error: "Invalid request" }, 400);
    }

    const employeeCodeValue = "employee_code" in body
      ? body.employee_code
      : null;
    const registrationCodeValue = "registration_code" in body
      ? body.registration_code
      : null;
    const employeeCode = typeof employeeCodeValue === "string"
      ? employeeCodeValue.trim()
      : "";
    const registrationCode = typeof registrationCodeValue === "string"
      ? registrationCodeValue.trim()
      : "";
    const password = "password" in body ? body.password : null;

    if (
      !employeeCode ||
      employeeCode.length > 50 ||
      !registrationCode ||
      !/^[a-f0-9]{64}$/i.test(registrationCode) ||
      !isValidPassword(password)
    ) {
      return respond(
        headers,
        {
          error:
            "Provide a valid employee ID, registration code and password of at least 12 characters.",
        },
        400,
      );
    }

    const { data: employee, error: employeeError } = await adminClient
      .from("employees")
      .select("id, employee_code, email, first_name, last_name, status")
      .eq("employee_code", employeeCode)
      .maybeSingle();

    if (
      employeeError ||
      !employee ||
      employee.status !== "active"
    ) {
      return respond(
        headers,
        { error: "Invalid or expired registration details" },
        400,
      );
    }

    const codeHash = await hashCode(registrationCode);

    const { data: invitation, error: invitationError } = await adminClient
      .from("staff_invite_codes")
      .select("id")
      .eq("employee_id", employee.id)
      .eq("code_hash", codeHash)
      .is("used_at", null)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (invitationError || !invitation) {
      return respond(
        headers,
        { error: "Invalid or expired registration details" },
        400,
      );
    }

    const { data: existingProfile, error: profileError } = await adminClient
      .from("profiles")
      .select("id")
      .eq("employee_id", employee.id)
      .maybeSingle();

    if (profileError) {
      return respond(headers, { error: "Unable to activate account" }, 500);
    }

    if (existingProfile) {
      return respond(
        headers,
        { error: "Employee account already exists" },
        409,
      );
    }

    const { data: created, error: createError } = await adminClient.auth.admin
      .createUser({
        email: employee.email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: `${employee.first_name} ${employee.last_name}`.trim(),
        },
      });

    if (createError || !created.user) {
      return respond(
        headers,
        {
          error: "Unable to activate account. Check the details and try again.",
        },
        400,
      );
    }

    createdUserId = created.user.id;

    const { error: consumeError } = await adminClient.rpc(
      "consume_staff_invite",
      {
        p_employee_id: employee.id,
        p_code_hash: codeHash,
        p_auth_user_id: created.user.id,
      },
    );

    if (consumeError) {
      const { error: cleanupError } = await adminClient.auth.admin.deleteUser(
        created.user.id,
      );

      if (cleanupError) {
        console.error(
          "Orphan Auth account cleanup failed:",
          cleanupError.message,
        );
      }

      createdUserId = null;

      return respond(
        headers,
        { error: "Unable to activate account. Request a new code if needed." },
        400,
      );
    }

    createdUserId = null;

    const { error: auditError } = await adminClient.from("audit_logs").insert({
      actor_id: null,
      action: "staff_account_activated",
      entity_type: "employee",
      entity_id: employee.id,
    });

    if (auditError) {
      console.error("redeem-staff-invite audit log failed:", auditError);
    }

    return respond(headers, {
      message: "Account activated successfully. You can now log in.",
    });
  } catch (error) {
    console.error("redeem-staff-invite failed:", error);

    if (createdUserId) {
      const { error: cleanupError } = await adminClient.auth.admin.deleteUser(
        createdUserId,
      );

      if (cleanupError) {
        console.error("Auth cleanup failed:", cleanupError.message);
      }
    }

    return respond(headers, { error: "Unable to activate account" }, 500);
  }
});
