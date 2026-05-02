import { config } from "dotenv";
import path from "path";

// Worker runs from apps/worker/, env files are in project root
const rootEnvLocal = path.resolve(process.cwd(), "../../.env.local");
const rootEnv = path.resolve(process.cwd(), "../../.env");

let result = config({ path: rootEnvLocal });
if (result.error) {
  result = config({ path: rootEnv });
}

if (result.error) {
  console.warn("[Worker] Warning: No env file found, using process env vars");
} else {
  console.log("[Worker] Env loaded from:", result.parsed ? "(parsed)" : "(process)");
}
