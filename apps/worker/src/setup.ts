import { config } from "dotenv";
const result = config({ path: ".env.local" });
if (result.error) {
  console.error("[Worker] Dotenv error:", result.error);
  process.exit(1);
} else {
  console.log("[Worker] Dotenv loaded successfully");
}