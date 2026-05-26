"use client";

import { useMutation } from "@tanstack/react-query";

import { useAuth } from "@/components/AuthProvider";
import { requestRegistrationCodeRequest } from "@/lib/auth";
import type { RegisterPayload, RegistrationVerifyPayload } from "@/lib/auth";

export function useAuthMutations() {
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
