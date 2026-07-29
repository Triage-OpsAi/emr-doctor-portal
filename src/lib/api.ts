export const API_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ??
  "http://127.0.0.1:8001/api/v1";

const ACCESS_KEY = "meridian_doctor_access_token";
const REFRESH_KEY = "meridian_doctor_refresh_token";

export function storeTokens(accessToken: string, refreshToken: string) {
  localStorage.setItem(ACCESS_KEY, accessToken);
  localStorage.setItem(REFRESH_KEY, refreshToken);
  void import("@/lib/audit").then(({ flushAuditQueue }) => flushAuditQueue());
}

export function clearTokens() {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

export function hasSession() {
  return Boolean(localStorage.getItem(ACCESS_KEY));
}

async function refreshAccessToken() {
  const refreshToken = localStorage.getItem(REFRESH_KEY);
  if (!refreshToken) return null;
  const response = await fetch(`${API_URL}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  if (!response.ok) {
    clearTokens();
    return null;
  }
  const tokens = await response.json();
  storeTokens(tokens.access_token, tokens.refresh_token);
  void import("@/lib/audit").then(({ queueAuditEvent }) =>
    queueAuditEvent({
      action: "session.refresh",
      event_category: "authentication",
      resource_type: "session",
    }),
  );
  return tokens.access_token as string;
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
  retry = true,
): Promise<T> {
  const headers = new Headers(init.headers);
  const token = localStorage.getItem(ACCESS_KEY);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (init.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const response = await fetch(`${API_URL}${path}`, { ...init, headers });
  if (response.status === 401 && retry && (await refreshAccessToken())) {
    return apiFetch<T>(path, init, false);
  }
  if (!response.ok) {
    if (response.status === 403 && !path.startsWith("/audit/")) {
      void import("@/lib/audit").then(({ queueAuditEvent }) =>
        queueAuditEvent({
          action: "permission.denied",
          event_category: "security",
          resource_type: "api_request",
          outcome: "denied",
          event_metadata: { path, method: init.method || "GET" },
        }),
      );
    }
    const payload = await response.json().catch(() => ({}));
    const detail = Array.isArray(payload.detail)
      ? payload.detail.map((item: { msg?: string }) => item.msg).filter(Boolean).join(", ")
      : payload.detail;
    throw new Error(detail || `Request failed (${response.status})`);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export async function clinicalLogin(email: string, password: string, hospitalCode: string) {
  const response = await fetch(`${API_URL}/auth/clinical/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, hospital_code: hospitalCode }),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.detail || "Unable to sign in");
  }
  const tokens = await response.json();
  storeTokens(tokens.access_token, tokens.refresh_token);
}

export async function fetchClinicalHospitalCode(
  email: string,
  signal?: AbortSignal,
) {
  const response = await fetch(`${API_URL}/auth/clinical/hospital-code`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
    signal,
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.detail || "No hospital workspace was found for this email");
  }
  const payload = (await response.json()) as { hospital_code: string };
  return payload.hospital_code;
}
