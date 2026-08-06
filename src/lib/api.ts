export const API_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ??
  "http://localhost:8000/api/v1";

const SESSION_MARKER_KEY = "meridian_doctor_session";
export const CSRF_KEY = "meridian_doctor_csrf_token";

type SessionResponse = {
  csrf_token?: string;
};

function storeSession(session: SessionResponse) {
  localStorage.setItem(SESSION_MARKER_KEY, "active");
  if (session.csrf_token) localStorage.setItem(CSRF_KEY, session.csrf_token);
  void import("@/lib/audit").then(({ flushAuditQueue }) => flushAuditQueue());
}

export function clearTokens() {
  localStorage.removeItem(SESSION_MARKER_KEY);
  localStorage.removeItem(CSRF_KEY);
}

export function hasSession() {
  return localStorage.getItem(SESSION_MARKER_KEY) === "active";
}

async function refreshAccessToken() {
  const csrfToken = localStorage.getItem(CSRF_KEY);
  if (!csrfToken) return false;
  const response = await fetch(`${API_URL}/auth/refresh`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-Token": csrfToken,
    },
    body: JSON.stringify({}),
  });
  if (!response.ok) {
    clearTokens();
    return false;
  }
  const session = (await response.json()) as SessionResponse;
  storeSession(session);
  void import("@/lib/audit").then(({ queueAuditEvent }) =>
    queueAuditEvent({
      action: "session.refresh",
      event_category: "authentication",
      resource_type: "session",
    }),
  );
  return true;
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
  retry = true,
): Promise<T> {
  const headers = new Headers(init.headers);
  const method = (init.method || "GET").toUpperCase();
  if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
    const csrfToken = localStorage.getItem(CSRF_KEY);
    if (csrfToken) headers.set("X-CSRF-Token", csrfToken);
  }
  if (init.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: "include",
    headers,
  });
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
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, hospital_code: hospitalCode }),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.detail || "Unable to sign in");
  }
  const session = (await response.json()) as SessionResponse;
  storeSession(session);
}

export async function logoutSession() {
  const csrfToken = localStorage.getItem(CSRF_KEY);
  try {
    await fetch(`${API_URL}/auth/logout`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
      },
      body: JSON.stringify({}),
    });
  } finally {
    clearTokens();
  }
}

export async function fetchClinicalHospitalCode(
  email: string,
  signal?: AbortSignal,
) {
  const response = await fetch(`${API_URL}/auth/clinical/hospital-code`, {
    method: "POST",
    credentials: "include",
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
