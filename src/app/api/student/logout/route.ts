import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME } from "@/lib/student-session";

export async function POST(request: NextRequest) {
  const response = NextResponse.redirect(new URL("/login", request.url));
  response.cookies.delete(COOKIE_NAME);
  return response;
}
