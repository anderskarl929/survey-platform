import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { timingSafeEqual } from "crypto";
import { auth } from "./auth";

/**
 * Defense-in-depth auth check for admin API routes.
 *
 * Accepts either:
 *  - NextAuth session cookie (used by the admin webapp)
 *  - Authorization: Bearer <ADMIN_API_KEY> header (used by CLI/MCP clients)
 *
 * Returns null if authenticated, or a 401 NextResponse if not.
 */
export async function requireAdmin(): Promise<NextResponse | null> {
  const headersList = await headers();
  const authHeader = headersList.get("authorization");

  if (authHeader?.startsWith("Bearer ")) {
    const presented = authHeader.slice("Bearer ".length).trim();
    const expected = process.env.ADMIN_API_KEY;
    if (expected && constantTimeEqual(presented, expected)) {
      return null;
    }
    return NextResponse.json({ error: "Ogiltig API-nyckel" }, { status: 401 });
  }

  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Ej autentiserad" }, { status: 401 });
  }
  return null;
}

function constantTimeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}
