export function getMemberInitials(firstName: string, lastName: string): string {
  const first = firstName.trim().charAt(0);
  const last = lastName.trim().charAt(0);
  return `${first}${last}`.toUpperCase() || "?";
}

export function getMemberAvatarHue(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash) % 360;
}

export function getMemberAvatarStyle(seed: string) {
  const hue = getMemberAvatarHue(seed);
  return {
    backgroundColor: `hsl(${hue} 52% 40%)`,
    color: "#ffffff",
  } as const;
}

export function paymentProgressPercent(paidCents: number, amountCents: number): number {
  if (amountCents <= 0) return 100;
  return Math.min(100, Math.round((paidCents / amountCents) * 100));
}
