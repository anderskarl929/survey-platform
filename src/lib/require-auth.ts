import { NextResponse } from "next/server";
import { auth } from "./auth";

/**
 * Defense-in-depth auth check for admin API routes.
 * Returns null if authenticated, or a 401 Response if not.
 */
export async function requireAdmin(): Promise<NextResponse | null> {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Ej autentiserad" }, { status: 401 });
  }
  return null;
}
