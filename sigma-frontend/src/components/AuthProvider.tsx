"use client";

import { useRouter } from "next/navigation";
import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

import {
  clearAuthToken,
  currentUserRequest,
  loginRequest,
  registerRequest,
  verifyRegistrationRequest
} from "@/lib/auth";
import type { LoginPayload, RegisterPayload, RegistrationVerifyPayload, User } from "@/lib/auth";

interface AuthContextValue {
  isLoading: boolean;
  login: (payload: LoginPayload) => Promise<User>;
  logout: () => void;
  register: (payload: RegisterPayload) => Promise<User>;
  verifyRegistration: (payload: RegistrationVerifyPayload) => Promise<User>;
  user: User | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const isAuthRoute = pathname.endsWith("/login") || pathname.endsWith("/register");
    currentUserRequest(!isAuthRoute)
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setIsLoading(false));
  }, [pathname]);

  const login = useCallback(async (payload: LoginPayload) => {
    setIsLoading(true);
    try {
      const authenticatedUser = await loginRequest(payload);
      setUser(authenticatedUser);
      return authenticatedUser;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const register = useCallback(async (payload: RegisterPayload) => {
    const registeredUser = await registerRequest(payload);
    setUser(registeredUser);
    return registeredUser;
  }, []);

  const verifyRegistration = useCallback(async (payload: RegistrationVerifyPayload) => {
    const registeredUser = await verifyRegistrationRequest(payload);
    setUser(registeredUser);
    return registeredUser;
  }, []);

  const logout = useCallback(() => {
    clearAuthToken();
    setUser(null);
    const [, locale] = window.location.pathname.split("/");
    router.push(`/${locale === "en" ? "en" : "zh"}/login`);
  }, [router]);

  const value = useMemo(
    () => ({ isLoading, login, logout, register, user, verifyRegistration }),
    [isLoading, login, logout, register, user, verifyRegistration]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === null) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
}
