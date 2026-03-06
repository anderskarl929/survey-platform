import { NextResponse } from "next/server";
import { ZodError } from "zod";

export function handleApiError(error: unknown) {
  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: "Valideringsfel", details: error.flatten().fieldErrors },
      { status: 400 }
    );
  }
  console.error("API Error:", error instanceof Error ? error.message : error);
  console.error("Stack:", error instanceof Error ? error.stack : "no stack");
  return NextResponse.json({ error: "Internt serverfel" }, { status: 500 });
}
