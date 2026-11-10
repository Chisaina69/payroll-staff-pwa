import { supabase } from "./supabase";

export async function loginWithEmployeeId(employeeCode, password) {
  const { data, error } = await supabase.functions.invoke(
    "employee-login",
    {
      body: {
        employee_code: employeeCode.trim(),
        password,
      },
    },
  );

  if (error) {
    throw new Error("Unable to log in. Check your details and try again.");
  }

  if (!data?.session?.access_token || !data?.session?.refresh_token) {
    throw new Error(data?.error || "Unable to establish a login session.");
  }

  const { error: sessionError } = await supabase.auth.setSession({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  });

  if (sessionError) {
    throw new Error("Login succeeded, but the session could not be saved.");
  }

  return data;
}

export async function activateStaffAccount(
  employeeCode,
  registrationCode,
  password,
) {
  const { data, error } = await supabase.functions.invoke(
    "redeem-staff-invite",
    {
      body: {
        employee_code: employeeCode.trim(),
        registration_code: registrationCode.trim(),
        password,
      },
    },
  );

  if (error) {
    throw new Error(
      data?.error || "Unable to activate your account. Try again.",
    );
  }

  if (!data?.message) {
    throw new Error("The account activation response was invalid.");
  }

  return data;
}

export async function createStaffInvite(employeeCode, purpose = "activation") {
  const { data, error } = await supabase.functions.invoke(
    "create-staff-invite",
    {
      body: {
        employee_code: employeeCode.trim(),
        purpose,
      },
    },
  );

  if (error) {
    let message = data?.error;
    if (!message && error.context instanceof Response) {
      const response = error.context;
      const responseData = await response.clone().json().catch(() => null);
      message = responseData?.error ||
        `Unable to generate a staff registration code (HTTP ${response.status}).`;
    }
    throw new Error(message || error.message || "Unable to generate a staff registration code.");
  }

  if (!data?.registration_code) {
    throw new Error("The registration code was not returned.");
  }

  return data;
}

export async function requestStaffPasswordReset(employeeCode) {
  const { data, error } = await supabase.functions.invoke("create-staff-invite", {
    body: {
      action: "request_password_reset",
      employee_code: employeeCode.trim(),
    },
  });

  if (error) {
    let message = data?.error;
    if (!message && error.context instanceof Response) {
      const response = error.context;
      const responseData = await response.clone().json().catch(() => null);
      message = responseData?.error ||
        `Unable to send a password-reset request (HTTP ${response.status}).`;
    }
    throw new Error(message || error.message || "Unable to send a password-reset request.");
  }

  if (!data?.message) {
    throw new Error("The password-reset request response was invalid.");
  }

  return data;
}

export async function logout() {
  const { error } = await supabase.auth.signOut();

  if (error) {
    throw new Error("Unable to log out. Please try again.");
  }
}
