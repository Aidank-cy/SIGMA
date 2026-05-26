export interface ApiErrorPayload {
  detail?: unknown;
}

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export interface TokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string | null;
  token_type: string;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api/v1";
const ACCESS_TOKEN_KEY = "sigma.accessToken";

let refreshPromise: Promise<string | null> | null = null;

function getStoredToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  return window.localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function setAccessToken(token: string | null): void {
  if (typeof window === "undefined") {
    return;
  }
  if (token === null) {
    window.localStorage.removeItem(ACCESS_TOKEN_KEY);
    return;
  }
  window.localStorage.setItem(ACCESS_TOKEN_KEY, token);
}

async function parseResponse<T>(response: Response): Promise<T> {
  if (response.status === 204) {
    return undefined as T;
  }
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return (await response.json()) as T;
  }
  return undefined as T;
}

function formatApiErrorMessage(payload: ApiErrorPayload | undefined, fallback: string): string {
  const detail = payload?.detail;
  if (typeof detail === "string" && detail.trim().length > 0) {
    return detail;
  }
  if (Array.isArray(detail)) {
    const messages = detail
      .map((entry) => {
        if (entry && typeof entry === "object" && "msg" in entry) {
          const message = (entry as { msg?: unknown }).msg;
          return typeof message === "string" ? message : null;
        }
        return null;
      })
      .filter((message): message is string => message !== null && message.trim().length > 0);
    if (messages.length > 0) {
      return messages.join("; ");
    }
  }
  return fallback;
}

async function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise !== null) {
    return refreshPromise;
  }

  refreshPromise = fetch(`${API_BASE_URL}/auth/refresh`, {
    credentials: "include",
    method: "POST"
  })
    .then(async (response) => {
      if (!response.ok) {
        setAccessToken(null);
        return null;
      }
      const tokenResponse = await parseResponse<TokenResponse>(response);
      setAccessToken(tokenResponse.access_token);
      return tokenResponse.access_token;
    })
    .finally(() => {
      refreshPromise = null;
    });

  return refreshPromise;
}

function redirectToLogin(): void {
  if (typeof window === "undefined") {
    return;
  }
  const [, locale] = window.location.pathname.split("/");
  const activeLocale = locale === "en" ? "en" : "zh";
  window.location.assign(`/${activeLocale}/login`);
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  retryOnUnauthorized = true
): Promise<T> {
  const token = getStoredToken();
  const headers = new Headers(options.headers);
  if (!headers.has("Content-Type") && options.body !== undefined) {
    headers.set("Content-Type", "application/json");
  }
  if (token !== null) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    credentials: "include",
    headers
  });

  if (response.status === 401 && retryOnUnauthorized) {
    const refreshedToken = await refreshAccessToken();
    if (refreshedToken !== null) {
      return apiFetch<T>(path, options, false);
    }
    redirectToLogin();
  }

  if (!response.ok) {
    const payload = await parseResponse<ApiErrorPayload>(response);
    throw new ApiError(formatApiErrorMessage(payload, response.statusText), response.status);
  }

  return parseResponse<T>(response);
}

export function getAccessToken(): string | null {
  return getStoredToken();
}
