"use client";

import { useMutation } from "@tanstack/react-query";
import type { UseMutationResult } from "@tanstack/react-query";

import { useAuth } from "@/components/AuthProvider";
import { requestRegistrationCodeRequest } from "@/lib/auth";
import type { RegisterPayload, RegistrationVerifyPayload, User } from "@/lib/auth";

interface RegistrationCodeResponse {
  dev_code?: string;
  message: string;
}

interface AuthMutationsHookResult {
  requestRegistrationCode: UseMutationResult<RegistrationCodeResponse, Error, RegisterPayload>;
  verifyRegistration: UseMutationResult<User, Error, RegistrationVerifyPayload>;
}

/** Return registration-related auth mutations. */
export function useAuthMutations(): AuthMutationsHookResult {
  const { verifyRegistration } = useAuth();

  return {
    requestRegistrationCode: useMutation({
      mutationFn: (payload: RegisterPayload) => requestRegistrationCodeRequest(payload)
    }),
    verifyRegistration: useMutation({
      mutationFn: (payload: RegistrationVerifyPayload) => verifyRegistration(payload)
    })
  };
}
