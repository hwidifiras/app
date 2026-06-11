/** Normalizes optional group room input for persistence. */
export function normalizeGroupRoomInput(room?: string | null): string | null {
  const trimmed = room?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

/** Label for UI when group has no default room. */
export function formatGroupRoomLabel(room?: string | null): string {
  const normalized = normalizeGroupRoomInput(room);
  return normalized ?? "Par séance";
}

/** Default room copied onto generated sessions when group has no fixed room. */
export function sessionRoomFromGroup(room?: string | null): string {
  return normalizeGroupRoomInput(room) ?? "";
}
