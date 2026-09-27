import { connection } from "next/server";
import { requireOwner } from "@/server/auth/require-owner";
import { LogoutButton } from "@/features/auth/logout-button";

export default async function Dashboard() {
  await connection();
  await requireOwner();
  return (
    <>
      <p className="eyebrow">Your workspace</p>
      <h1>Dashboard</h1>
      <p>Welcome to 3Template, your home for reusable content.</p>
      <LogoutButton />
      <section className="panel" aria-labelledby="projects-title">
        <h2 id="projects-title">No projects yet</h2>
        <p>
          This is the initial 3Template application shell. Project creation will
          be available in a future milestone.
        </p>
      </section>
    </>
  );
}
