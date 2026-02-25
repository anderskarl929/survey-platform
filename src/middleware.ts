import { auth } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET environment variable is required");
}
const STUDENT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET);

export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Protect student pages and API routes with direct jose verification (edge compatible)
  if (
    pathname.startsWith("/student") ||
    pathname.startsWith("/api/student")
  ) {
    const token = request.cookies.get("student-session")?.value;
    if (!token) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    try {
      await jwtVerify(token, STUDENT_SECRET);
    } catch {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    return NextResponse.next();
  }

  const session = await auth();

  // Allow login page always
  if (pathname === "/admin/login") {
    if (session?.user) {
      return NextResponse.redirect(new URL("/admin", request.url));
    }
    return NextResponse.next();
  }

  // Allow NextAuth API routes
  if (pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  // Allow public survey endpoints
  if (pathname.match(/^\/api\/surveys\/[^/]+\/respond/)) {
    return NextResponse.next();
  }

  // Protect admin pages
  if (pathname.startsWith("/admin") && !session?.user) {
    // Only allow relative paths as callbackUrl to prevent open redirect
    const safeCallback = pathname.startsWith("/admin") ? pathname : "/admin";
    return NextResponse.redirect(
      new URL(
        `/admin/login?callbackUrl=${encodeURIComponent(safeCallback)}`,
        request.url
      )
    );
  }

  // Protect admin API routes
  const isAdminApi =
    pathname.startsWith("/api/courses") ||
    pathname.startsWith("/api/questions") ||
    pathname.startsWith("/api/topics") ||
    (pathname.startsWith("/api/surveys") &&
      !pathname.match(/^\/api\/surveys\/[^/]+\/respond/));

  if (isAdminApi && !session?.user) {
    return NextResponse.json({ error: "Ej autentiserad" }, { status: 401 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/student/:path*",
    "/api/courses/:path*",
    "/api/questions/:path*",
    "/api/topics/:path*",
    "/api/surveys/:path*",
    "/api/student/:path*",
  ],
};
