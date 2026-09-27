import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { runtime } from "../runtime";
import { authenticated, cookieName, hasOwner } from "./service";

export async function requireOwner() {
  const { db, config } = runtime();
  try {
    if (!(await hasOwner(db))) redirect("/setup");
    const token =
      (await cookies()).get(cookieName(config, "session"))?.value ?? "";
    if (!(await authenticated(db, token))) redirect("/login");
  } finally {
    db.close();
  }
}
