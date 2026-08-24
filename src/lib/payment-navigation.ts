const PAYMENT_FALLBACK_PATH = "/payments";
const INTERNAL_ORIGIN = "https://we-discipline.local";

function hasUnsafePathSyntax(value: string) {
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return true;
  }

  if (/[\u0000-\u001F\u007F]/.test(value)) {
    return true;
  }

  let decoded = value;
  for (let index = 0; index < 2; index += 1) {
    try {
      decoded = decodeURIComponent(decoded);
    } catch {
      return true;
    }

    if (
      !decoded.startsWith("/") ||
      decoded.startsWith("//") ||
      decoded.includes("\\") ||
      /[\u0000-\u001F\u007F]/.test(decoded)
    ) {
      return true;
    }
  }

  return false;
}

export function resolvePaymentReturnPath(value: string | null | undefined) {
  const candidate = value?.trim();
  if (!candidate || hasUnsafePathSyntax(candidate)) return PAYMENT_FALLBACK_PATH;

  try {
    const parsed = new URL(candidate, INTERNAL_ORIGIN);
    if (parsed.origin !== INTERNAL_ORIGIN) return PAYMENT_FALLBACK_PATH;
    if (!parsed.pathname.startsWith("/") || parsed.pathname.startsWith("//")) {
      return PAYMENT_FALLBACK_PATH;
    }
    if (parsed.pathname === "/payments/new" || parsed.pathname.startsWith("/payments/new/")) {
      return PAYMENT_FALLBACK_PATH;
    }

    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return PAYMENT_FALLBACK_PATH;
  }
}

export function paymentReturnLabel(path: string) {
  const pathname = path.split(/[?#]/, 1)[0] ?? path;

  if (pathname === "/") return "Accueil";
  if (pathname.startsWith("/members/")) return "Fiche membre";
  if (pathname === "/members") return "Membres";
  if (pathname.startsWith("/subscriptions")) return "Abonnements";
  if (pathname.startsWith("/attendance/today")) return "Pointage";
  return "Historique caisse";
}

export function paymentNewHref({
  memberId,
  memberSubscriptionId,
  returnTo,
}: {
  memberId?: string;
  memberSubscriptionId?: string;
  returnTo?: string;
} = {}) {
  const params = new URLSearchParams();
  if (memberId) params.set("memberId", memberId);
  if (memberSubscriptionId) params.set("memberSubscriptionId", memberSubscriptionId);
  if (returnTo) params.set("returnTo", resolvePaymentReturnPath(returnTo));

  const query = params.toString();
  return query ? `/payments/new?${query}` : "/payments/new";
}

export { PAYMENT_FALLBACK_PATH };
