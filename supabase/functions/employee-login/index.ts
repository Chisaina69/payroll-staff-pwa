import {
  adminClient,
  getCorsHeaders,
  hashCode,
  publicAuthClient,
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
    let body: unknown;

    try {
      body = await req.json();
    } catch {
      return respond(headers, { error: "Invalid request" }, 400);
    }

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return respond(
        headers,
        { error: "Invalid employee ID or password" },
        401,
      );
    }

    const employeeCodeValue = "employee_code" in body
      ? body.employee_code
      : null;
    const password = "password" in body ? body.password : null;
    const employeeCode = typeof employeeCodeValue === "string"
      ? employeeCodeValue.trim()
      : "";

    if (
      !employeeCode ||
      employeeCode.length > 50 ||
      typeof password !== "string" ||
      password.length === 0 ||
      password.length > 128
    ) {
      return respond(
        headers,
        { error: "Invalid employee ID or password" },
        401,
      );
    }

    const identifierHash = await hashCode(employeeCode.toUpperCase());

    const { data: allowed, error: rateLimitError } = await adminClient.rpc(
      "check_login_rate_limit",
      {
        p_identifier_hash: identifierHash,
      },
    );

    if (rateLimitError) {
      console.error("Login rate limiter failed:", rateLimitError.message);

      return respond(
        headers,
        { error: "Login is temporarily unavailable" },
        503,
      );
    }

    if (allowed !== true) {
      return respond(
        headers,
        { error: "Too many attempts. Try again in 15 minutes." },
        429,
      );
    }

    const { data: employee, error: employeeError } = await adminClient
      .from("employees")
      .select("id, email, status")
      .eq("employee_code", employeeCode)
      .maybeSingle();

    let loginEmail: string | null = null;

    if (!employeeError && employee && employee.status === "active") {
      const { data: profile, error: profileError } = await adminClient
        .from("profiles")
        .select("id")
        .eq("employee_id", employee.id)
        .eq("role", "staff")
        .maybeSingle();

      if (!profileError && profile && typeof employee.email === "string") {
        loginEmail = employee.email;
      }
    }

    const emailForAuth = loginEmail ??
      `invalid-${crypto.randomUUID()}@invalid.invalid`;

    const { data: authData, error: authError } = await publicAuthClient.auth
      .signInWithPassword({
        email: emailForAuth,
        password,
      });

    if (
      !loginEmail ||
      authError ||
      !authData.session ||
      !authData.user
    ) {
      return respond(
        headers,
        { error: "Invalid employee ID or password" },
        401,
      );
    }

    const { error: resetError } = await adminClient.rpc(
      "reset_login_rate_limit",
      { p_identifier_hash: identifierHash },
    );

    if (resetError) {
      console.error("Login rate-limit reset failed:", resetError.message);
    }

    return respond(headers, {
      session: {
        access_token: authData.session.access_token,
        refresh_token: authData.session.refresh_token,
        expires_at: authData.session.expires_at,
        expires_in: authData.session.expires_in,
        token_type: authData.session.token_type,
      },
    });
  } catch (error) {
    console.error("employee-login failed:", error);

    return respond(headers, { error: "Unable to log in" }, 500);
  }
});
