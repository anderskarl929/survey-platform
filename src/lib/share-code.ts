import { nanoid } from "nanoid";

export function generateShareCode(): string {
  return nanoid(8);
}
