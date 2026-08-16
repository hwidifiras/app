export class SignupClientError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = "SignupClientError";
  }
}
export async function signupApi<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
    cache: "no-store",
  });
  const payload = await response.json().catch(() => ({})) as {
    data?: T;
    error?: string;
    code?: string;
  };
  if (!response.ok || payload.data === undefined) {
    const retryAfter = Number.parseInt(response.headers.get("Retry-After") ?? "", 10);
    throw new SignupClientError(
      payload.error || "Une erreur est survenue. Réessayez.",
      payload.code,
      Number.isFinite(retryAfter) ? retryAfter : undefined,
    );
  }
  return payload.data;
}
