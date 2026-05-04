import bcrypt from "bcryptjs";

export async function hashPassword(plain: string): Promise<string> {
  const trimmed = plain.trim();
  if (trimmed.length < 8) {
    throw new Error("Mot de passe trop court (min 8 caractères)");
  }
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(trimmed, salt);
}

export async function verifyPassword(plain: string, passwordHash: string): Promise<boolean> {
  return bcrypt.compare(plain, passwordHash);
}
