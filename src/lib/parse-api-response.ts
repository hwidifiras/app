export async function parseApiResponse<T = Record<string, unknown>>(response: Response): Promise<T> {
  const text = await response.text();
  if (!text.trim()) {
    return {} as T;
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    return { error: "Réponse serveur invalide" } as T;
  }
}
