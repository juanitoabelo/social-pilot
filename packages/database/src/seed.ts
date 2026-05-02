import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // Create test user
  const hashedPassword = await bcrypt.hash("password123", 10);
  
  const user = await prisma.user.upsert({
    where: { email: "test@example.com" },
    update: {},
    create: {
      email: "test@example.com",
      name: "Test User",
      password: hashedPassword,
    },
  });

  console.log("Created user:", user.email);

  // Create default workspace
  const workspace = await prisma.workspace.upsert({
    where: { slug: "test-workspace" },
    update: {},
    create: {
      name: "Test Workspace",
      slug: "test-workspace",
      brand_config: {
        brand_name: "Test Brand",
        tone: "professional",
        do: ["Be helpful", "Be concise"],
        dont: ["Be spammy", "Be aggressive"],
        hashtag_style: "lowercase",
        emoji_policy: "optional",
      },
    },
  });

  console.log("Created workspace:", workspace.name);

  // Add user to workspace as owner
  await prisma.workspaceMember.upsert({
    where: {
      workspace_id_user_id: {
        workspace_id: workspace.id,
        user_id: user.id,
      },
    },
    update: {},
    create: {
      workspace_id: workspace.id,
      user_id: user.id,
      role: "owner",
    },
  });

  console.log("Added user to workspace as owner");

  console.log("Seeding complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });