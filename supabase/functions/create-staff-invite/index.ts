import {
  adminClient,
  generateCode,
  getCorsHeaders,
  hashCode,
  requireAdmin,
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

  try {
    const auth = await requireAdmin(req);

    if (auth.error) {
      return respond(headers, { error: auth.error }, 403);
    }

    let body: unknown;

    try {
      body = await req.json();
    } catch {
      return respond(headers, { error: "Invalid request" }, 400);
    }

    if (!body || typeof body !== "object" || !("employee_code" in body)) {
      return respond(headers, { error: "Invalid request" }, 400);
    }

    const rawEmployeeCode = body.employee_code;

    if (typeof rawEmployeeCode !== "string") {
      return respond(headers, { error: "Invalid request" }, 400);
    }

    const employeeCode = rawEmployeeCode.trim();

    if (
      !employeeCode ||
      employeeCode.length > 50
    ) {
      return respond(
        headers,
        { error: "A valid employee ID is required" },
        400,
      );
    }

    const { data: employee, error: employeeError } = await adminClient
      .from("employees")
      .select("id, employee_code, email, status")
      .eq("employee_code", employeeCode)
      .maybeSingle();

    if (employeeError) {
      return respond(headers, { error: "Unable to process request" }, 500);
    }

    if (!employee || employee.status !== "active") {
      return respond(headers, { error: "Employee not eligible" }, 404);
    }

    if (typeof employee.email !== "string" || !employee.email.trim()) {
      return respond(
        headers,
        { error: "Add the employee's work email before creating an invite" },
        400,
      );
    }

    const { data: existingProfile, error: profileError } = await adminClient
      .from("profiles")
      .select("id")
      .eq("employee_id", employee.id)
      .maybeSingle();

    if (profileError) {
      return respond(headers, { error: "Unable to process request" }, 500);
    }

    if (existingProfile) {
      return respond(
        headers,
        { error: "Employee already has an account" },
        409,
      );
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 30 * 60 * 1000);
    const code = generateCode();
    const codeHash = await hashCode(code);

    const { error: invalidateError } = await adminClient
      .from("staff_invite_codes")
      .update({ used_at: now.toISOString() })
      .eq("employee_id", employee.id)
      .is("used_at", null);

    if (invalidateError) {
      return respond(headers, { error: "Unable to issue code" }, 500);
    }

    const { error: insertError } = await adminClient
      .from("staff_invite_codes")
      .insert({
        employee_id: employee.id,
        code_hash: codeHash,
        expires_at: expiresAt.toISOString(),
        created_by: auth.userId,
      });

    if (insertError) {
      return respond(headers, { error: "Unable to issue code" }, 500);
    }

    await adminClient.from("audit_logs").insert({
      actor_id: auth.userId,
      action: "staff_invite_created",
      entity_type: "employee",
      entity_id: employee.id,
    });

    return respond(headers, {
      employee_code: employee.employee_code,
      registration_code: code,
      expires_at: expiresAt.toISOString(),
    });
  } catch (error) {
    console.error("create-staff-invite failed:", error);

    return respond(headers, { error: "Internal server error" }, 500);
  }
});
