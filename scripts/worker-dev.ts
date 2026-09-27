import { startWorker } from "./worker-runtime";

const worker = await startWorker(
  {
    APP_ORIGIN: process.env.APP_ORIGIN!,
    CREDENTIAL_ROOT_KEY: process.env.CREDENTIAL_ROOT_KEY!,
    OWNER_SETUP_TOKEN: process.env.OWNER_SETUP_TOKEN!,
  },
  3101,
);
console.log("Local Worker security API ready.");
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.on(signal, async () => {
    await worker.dispose();
    process.exit(0);
  });
