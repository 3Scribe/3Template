import { connection } from "next/server";
import { requireOwner } from "@/server/auth/require-owner";
import { runtime } from "@/server/runtime";
import { listCredentials } from "@/server/credentials/service";
import { providerDescriptors } from "@/server/credentials/providers";
import { Credentials } from "@/features/credentials/credentials";
import { LogoutButton } from "@/features/auth/logout-button";
export default async function CredentialsPage() {
  await connection();
  await requireOwner();
  const { db } = runtime();
  try {
    return (
      <>
        <p className="eyebrow">Settings</p>
        <h1>Credentials</h1>
        <LogoutButton />
        <p>
          Secrets are encrypted and cannot be displayed after saving. To change
          a secret, replace it.
        </p>
        <Credentials
          initial={await listCredentials(db)}
          providers={providerDescriptors()}
        />
      </>
    );
  } finally {
    db.close();
  }
}
