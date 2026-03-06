import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";

export function handleApiError(error: unknown) {
  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: "Valideringsfel", details: error.flatten().fieldErrors },
      { status: 400 }
    );
  }
  if (error instanceof SyntaxError) {
    return NextResponse.json(
      { error: "Ogiltig JSON i request-body" },
      { status: 400 }
    );
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2003") {
      return NextResponse.json(
        { error: "Relaterad post saknas (t.ex. kursen finns inte)" },
        { status: 400 }
      );
    }
    if (error.code === "P2002") {
      return NextResponse.json(
        { error: "En post med samma värde finns redan" },
        { status: 409 }
      );
    }
  }
  console.error("API Error:", error instanceof Error ? error.message : error);
  console.error("Stack:", error instanceof Error ? error.stack : "no stack");
  return NextResponse.json({ error: "Internt serverfel" }, { status: 500 });
}
