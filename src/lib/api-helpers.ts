import { NextResponse } from "next/server";
import { ZodError } from "zod";

export function handleApiError(error: unknown) {
  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: "Valideringsfel", details: error.flatten().fieldErrors },
      { status: 400 }
    );
  }
  console.error(error);
  return NextResponse.json({ error: "Internt serverfel" }, { status: 500 });
}
