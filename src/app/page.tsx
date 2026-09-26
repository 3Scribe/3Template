import { connection } from "next/server";
import { checkInstance } from "@/server/db/instance";

export default async function Dashboard() {
  await connection();
  checkInstance();
  return (
    <>
      <p className="eyebrow">Your workspace</p>
      <h1>Dashboard</h1>
      <p>Welcome to 3T, your home for reusable content.</p>
      <section className="panel" aria-labelledby="projects-title">
        <h2 id="projects-title">No projects yet</h2>
        <p>
          This is the initial 3T application shell. Project creation will be
          available in a future milestone.
        </p>
      </section>
    </>
  );
}
