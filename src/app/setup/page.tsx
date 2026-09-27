import { connection } from "next/server";
import { redirect } from "next/navigation";
import { runtime } from "@/server/runtime";
import { hasOwner } from "@/server/auth/service";
import { AuthForm } from "@/features/auth/auth-form";
export default async function Setup() {
  await connection();
  const { db } = runtime();
  try {
    if (await hasOwner(db)) redirect("/login");
  } finally {
    db.close();
  }
  return (
    <>
      <h1>Set up 3Template</h1>
      <p>Create the single owner of this Community instance.</p>
      <AuthForm setup />
    </>
  );
}
