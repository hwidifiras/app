import { NextResponse } from "next/server";

import type { WorkspaceSignupState } from "@/platform/signup/signup-account-service";
import { isSignupServiceError, type SignupErrorCode } from "@/platform/signup/signup-errors";

const ERROR_MESSAGES: Record<SignupErrorCode, string> = {
  SIGNUP_DISABLED: "La création d'espace n'est pas encore ouverte.",
  SIGNUP_INVITE_REQUIRED: "Une invitation valide est nécessaire.",
  SIGNUP_INVITE_INVALID: "Cette invitation n'est plus valide.",
  SIGNUP_SESSION_INVALID: "Cette session d'inscription n'est plus valide.",
  SIGNUP_EXPIRED: "Cette inscription a expiré. Recommencez pour créer votre espace.",
  SIGNUP_NOT_VERIFIED: "Confirmez d'abord votre adresse email.",
  SIGNUP_VERIFICATION_INVALID: "Le code de confirmation est incorrect.",
  SIGNUP_VERIFICATION_LOCKED: "Trop de tentatives. Demandez un nouveau code.",
  SIGNUP_RESEND_COOLDOWN: "Un code vient d'être envoyé. Patientez avant de réessayer.",
  SIGNUP_ALREADY_COMPLETED: "Cet espace a déjà été créé.",
  SIGNUP_REQUEST_CONFLICT: "Cette demande ne correspond pas à l'inscription en cours.",
  SIGNUP_RATE_LIMITED: "Trop de tentatives. Patientez avant de réessayer.",
  SIGNUP_RATE_LIMIT_UNAVAILABLE: "La protection contre les abus est temporairement indisponible.",
  ANTI_BOT_REQUIRED: "Terminez la vérification de sécurité.",
  ANTI_BOT_FAILED: "La vérification de sécurité a échoué. Réessayez.",
  ANTI_BOT_UNAVAILABLE: "La vérification de sécurité est temporairement indisponible.",
  PLATFORM_HOST_REQUIRED: "Cette page doit être ouverte depuis le portail We Discipline.",
  UNTRUSTED_ORIGIN: "Cette demande ne peut pas être vérifiée.",
  SLUG_INVALID: "Choisissez une adresse d'espace valide.",
  SLUG_UNAVAILABLE: "Cette adresse d'espace est déjà utilisée.",
  EDITION_NOT_ALLOWED: "Cette édition ne correspond pas à votre invitation.",
  ACTIVITY_TEMPLATE_INVALID: "Une activité choisie ne correspond pas à cette édition.",
  SAAS_PLAN_UNAVAILABLE: "Cette édition est temporairement indisponible.",
  SAAS_PLAN_CONFIGURATION_INVALID: "Cette édition doit être vérifiée par notre équipe.",
  PROVISIONING_FAILED: "L'espace n'a pas pu être créé. Aucune donnée partielle n'a été conservée.",
  HANDOFF_INVALID: "Le lien d'accès est invalide ou a expiré.",
};

export function noStoreJson(data: unknown, init?: ResponseInit): NextResponse {
  const response = NextResponse.json(data, init);
  response.headers.set("Cache-Control", "private, no-store, max-age=0, must-revalidate");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");
  return response;
}

export function signupErrorResponse(error: unknown): NextResponse {
  if (!isSignupServiceError(error)) {
    console.error("Unhandled owner signup error", error);
    return noStoreJson({ error: "Une erreur inattendue est survenue." }, { status: 500 });
  }
  const headers = error.retryAfterSeconds
    ? { "Retry-After": String(error.retryAfterSeconds) }
    : undefined;
  return noStoreJson(
    { error: ERROR_MESSAGES[error.code], code: error.code },
    { status: error.status, headers },
  );
}

export function serializeSignupState(state: WorkspaceSignupState) {
  return {
    ...state,
    expiresAt: state.expiresAt.toISOString(),
  };
}
