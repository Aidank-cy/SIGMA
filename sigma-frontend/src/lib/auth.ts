import { apiFetch, setAccessToken } from "@/lib/api";
import type { TokenResponse } from "@/lib/api";

export interface User {
  id: string;
  email: string;
  display_name: string;
  role: "admin" | "user";
  locale: "zh" | "en";
  data_retention_days: number;
  is_active: boolean;
  created_at: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  display_name: string;
  email: string;
  locale: "zh" | "en";
  password: string;
}

type RegisterResponse = User & TokenResponse;

export async function loginRequest(payload: LoginPayload): Promise<User> {
  const token = await apiFetch<TokenResponse>(
    "/auth/login",
    {
      body: JSON.stringify(payload),
      method: "POST"
    },
    false
  );
  setAccessToken(token.access_token);
  return apiFetch<User>("/auth/me");
}

export async function registerRequest(payload: RegisterPayload): Promise<User> {
  const user = await apiFetch<RegisterResponse>("/auth/register", {
    body: JSON.stringify(payload),
    method: "POST"
  });
  setAccessToken(user.access_token);
  return user;
}

export async function currentUserRequest(retryOnUnauthorized = true): Promise<User> {
  return apiFetch<User>("/auth/me", {}, retryOnUnauthorized);
}

export function clearAuthToken(): void {
  setAccessToken(null);
}
