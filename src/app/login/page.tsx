import { connection } from "next/server";
import { redirect } from "next/navigation";
import { runtime } from "@/server/runtime";
import { hasOwner } from "@/server/auth/service";
import { AuthForm } from "@/features/auth/auth-form";
export default async function Login() {
  await connection();
  const { db } = runtime();
  try {
    if (!(await hasOwner(db))) redirect("/setup");
  } finally {
    db.close();
  }
  return (
    <>
      <h1>Sign in to 3Template</h1>
      <AuthForm setup={false} />
    </>
  );
}
