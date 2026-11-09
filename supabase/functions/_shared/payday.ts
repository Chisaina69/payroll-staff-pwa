import { createClient } from "npm:@supabase/supabase-js@2";

function getKey(
  modernVariable: string,
  legacyVariable: string,
): string {
  const modern = Deno.env.get(modernVariable);

  if (modern) {
    const keys = JSON.parse(modern) as Record<string, string>;

    if (keys.default) {
      return keys.default;
    }
  }

  const legacy = Deno.env.get(legacyVariable);

  if (!legacy) {
    throw new Error(`Missing required server environment key`);
  }

  return legacy;
}

const supabaseUrl = Deno.env.get("SUPABASE_URL");

if (!supabaseUrl) {
  throw new Error("Missing Supabase URL");
}

export const adminClient = createClient(
  supabaseUrl,
  getKey("SUPABASE_SECRET_KEYS", "SUPABASE_SERVICE_ROLE_KEY"),
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  },
);

export const publicAuthClient = createClient(
  supabaseUrl,
  getKey("SUPABASE_PUBLISHABLE_KEYS", "SUPABASE_ANON_KEY"),
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  },
);

const allowedOrigins = new Set([
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  ...(Deno.env.get("PAYDAY_ALLOWED_ORIGINS") ?? "").split(","),
].map((origin) => origin.trim()).filter(Boolean));

export function getCorsHeaders(req: Request): Headers | null {
  const origin = req.headers.get("origin");

  if (origin && !allowedOrigins.has(origin)) {
    return null;
  }

  const headers = new Headers({
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
    "Vary": "Origin",
  });

  if (origin) {
    headers.set("Access-Control-Allow-Origin", origin);
  }

  return headers;
}

export function respond(
  headers: Headers,
  body: unknown,
  status = 200,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers,
  });
}

export async function hashCode(code: string): Promise<string> {
  const bytes = new TextEncoder().encode(code);
  const digest = await crypto.subtle.digest("SHA-256", bytes);

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function generateCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));

  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function isValidPassword(password: unknown): password is string {
  return typeof password === "string" &&
    password.length >= 12 &&
    password.length <= 128;
}

export async function requireAdmin(
  req: Request,
): Promise<
  | { userId: string; error?: never }
  | { userId?: never; error: string }
> {
  const authorization = req.headers.get("Authorization");

  if (!authorization?.startsWith("Bearer ")) {
    return { error: "Authentication required" };
  }

  const token = authorization.slice(7).trim();

  if (!token) {
    return { error: "Authentication required" };
  }

  const {
    data: { user },
    error: authError,
  } = await adminClient.auth.getUser(token);

  if (authError || !user) {
    return { error: "Authentication required" };
  }

  const { data: profile, error: profileError } = await adminClient
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (
    profileError ||
    !profile ||
    profile.role !== "admin"
  ) {
    return { error: "Administrator access required" };
  }

  return { userId: user.id };
}
