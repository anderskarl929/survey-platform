import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";

const BCRYPT_ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

function isLegacySha256(hash: string): boolean {
  return /^[a-f0-9]{64}$/i.test(hash);
}

async function sha256Hex(password: string): Promise<string> {
  const data = new TextEncoder().encode(password);
  const buffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function verifyPassword(
  password: string,
  storedHash: string
): Promise<boolean> {
  // Support legacy SHA-256 hashes (64 hex chars). Callers should upgrade them
  // to bcrypt on first successful login.
  if (isLegacySha256(storedHash)) {
    return (await sha256Hex(password)) === storedHash;
  }
  return bcrypt.compare(password, storedHash);
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email" },
        password: { label: "Lösenord", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const admin = await prisma.admin.findUnique({
          where: { email: credentials.email as string },
        });

        if (
          !admin ||
          !(await verifyPassword(
            credentials.password as string,
            admin.passwordHash
          ))
        ) {
          return null;
        }

        // Upgrade legacy SHA-256 hashes to bcrypt on successful login
        if (isLegacySha256(admin.passwordHash)) {
          await prisma.admin.update({
            where: { id: admin.id },
            data: { passwordHash: await hashPassword(credentials.password as string) },
          });
        }

        return {
          id: String(admin.id),
          email: admin.email,
          name: admin.name,
        };
      },
    }),
  ],
  pages: {
    signIn: "/admin/login",
  },
  session: {
    strategy: "jwt",
  },
});
