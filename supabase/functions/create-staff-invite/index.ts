import {
  adminClient,
  generateCode,
  getCorsHeaders,
  hashCode,
  requireAdmin,
  respond,
} from "../_shared/payday.ts";

async function getInviteStatuses(employeeIds: string[]) {
  const statuses: Record<string, "not_invited" | "active" | "invited" | "expired"> =
    Object.fromEntries(employeeIds.map((id) => [id, "not_invited"]));

  const [profilesResult, invitesResult] = await Promise.all([
    adminClient
      .from("profiles")
      .select("employee_id")
      .in("employee_id", employeeIds),
    adminClient
      .from("staff_invite_codes")
      .select("employee_id, expires_at, created_at")
      .in("employee_id", employeeIds)
      .is("used_at", null)
      .order("created_at", { ascending: false }),
  ]);

  if (profilesResult.error) {
    console.error("Failed to load staff profiles for invite statuses:", profilesResult.error);
    throw new Error("Unable to load invitation statuses");
  }
  if (invitesResult.error) {
    console.error("Failed to load staff invite statuses:", invitesResult.error);
    throw new Error("Unable to load invitation statuses");
  }

  for (const profile of profilesResult.data || []) {
    if (profile.employee_id) statuses[profile.employee_id] = "active";
  }

  const now = Date.now();
  for (const invite of invitesResult.data || []) {
    if (statuses[invite.employee_id] !== "not_invited") continue;
    statuses[invite.employee_id] = new Date(invite.expires_at).getTime() > now
      ? "invited"
      : "expired";
  }

  return statuses;
}

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
    let body: unknown;

    try {
      body = await req.json();
    } catch {
      return respond(headers, { error: "Invalid request" }, 400);
    }

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return respond(headers, { error: "Invalid request" }, 400);
    }

    if ("action" in body && body.action === "request_password_reset") {
      const rawEmployeeCode = "employee_code" in body ? body.employee_code : null;
      if (
        typeof rawEmployeeCode !== "string" ||
        !rawEmployeeCode.trim() ||
        rawEmployeeCode.trim().length > 50
      ) {
        return respond(headers, { error: "Enter a valid employee ID." }, 400);
      }

      const employeeCode = rawEmployeeCode.trim();
      const genericResponse = {
        message: "If an active staff account matches that employee ID, the administrator has been notified.",
      };
      const { data: employee, error: employeeError } = await adminClient
        .from("employees")
        .select("id, employee_code, first_name, last_name, status")
        .eq("employee_code", employeeCode)
        .maybeSingle();

      if (employeeError) {
        console.error("Failed to load employee for password-reset request:", employeeError);
        return respond(headers, { error: "Unable to send your request. Try again later." }, 500);
      }
      if (!employee || employee.status !== "active") {
        return respond(headers, genericResponse);
      }

      const { data: staffProfile, error: profileError } = await adminClient
        .from("profiles")
        .select("id")
        .eq("employee_id", employee.id)
        .eq("role", "staff")
        .maybeSingle();

      if (profileError) {
        console.error("Failed to verify staff account for password-reset request:", profileError);
        return respond(headers, { error: "Unable to send your request. Try again later." }, 500);
      }
      if (!staffProfile) {
        return respond(headers, genericResponse);
      }

      const recentRequestAfter = new Date(Date.now() - 15 * 60 * 1000).toISOString();
      const { data: recentRequest, error: recentRequestError } = await adminClient
        .from("password_reset_requests")
        .select("id")
        .eq("employee_id", employee.id)
        .gte("created_at", recentRequestAfter)
        .limit(1)
        .maybeSingle();

      if (recentRequestError) {
        console.error("Failed to check recent password-reset requests:", recentRequestError);
        return respond(headers, { error: "Unable to send your request. Try again later." }, 500);
      }

      if (!recentRequest) {
        const { error: notificationError } = await adminClient
          .from("password_reset_requests")
          .insert({
            employee_id: employee.id,
          });

        if (notificationError) {
          console.error("Failed to store password-reset request:", notificationError);
          return respond(headers, { error: "Unable to send your request. Try again later." }, 500);
        }
      }

      return respond(headers, genericResponse);
    }

    const auth = await requireAdmin(req);

    if (auth.error) {
      return respond(headers, { error: auth.error }, 403);
    }

    if ("action" in body && body.action === "list_statuses") {
      if (
        !("employee_ids" in body) ||
        !Array.isArray(body.employee_ids) ||
        body.employee_ids.length > 500 ||
        body.employee_ids.some((id) =>
          typeof id !== "string" ||
          !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
            .test(id)
        )
      ) {
        return respond(headers, { error: "Invalid employee ID list" }, 400);
      }

      const statuses = await getInviteStatuses(body.employee_ids);
      return respond(headers, { statuses });
    }

    if (!("employee_code" in body)) {
      return respond(headers, { error: "Invalid request" }, 400);
    }

    const purpose = "purpose" in body ? body.purpose : "activation";
    if (purpose !== "activation" && purpose !== "password_reset") {
      return respond(headers, { error: "Invalid invite purpose" }, 400);
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
      console.error("Failed to load employee for staff invite:", employeeError);
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
      console.error("Failed to check staff profile for invite:", profileError);
      return respond(headers, { error: "Unable to process request" }, 500);
    }

    if (purpose === "activation" && existingProfile) {
      return respond(
        headers,
        { error: "Employee already has an account" },
        409,
      );
    }
    if (purpose === "password_reset" && !existingProfile) {
      return respond(
        headers,
        { error: "Employee does not have an account to reset" },
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
      console.error("Failed to invalidate prior staff invites:", invalidateError);
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
      console.error("Failed to store staff invite:", insertError);
      return respond(headers, { error: "Unable to issue code" }, 500);
    }

    await adminClient.from("audit_logs").insert({
      actor_id: auth.userId,
      action: purpose === "password_reset"
        ? "staff_password_reset_invite_created"
        : "staff_invite_created",
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
