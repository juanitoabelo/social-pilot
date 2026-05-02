import { prisma } from "@/lib/db";

type ActivityLogInput = {
  workspace_id: string;
  user_id: string;
  action: string;
  entity_type?: string;
  entity_id?: string;
  metadata?: Record<string, unknown>;
};

export async function logActivity(input: ActivityLogInput) {
  return prisma.activityLog.create({
    data: {
      workspace_id: input.workspace_id,
      user_id: input.user_id,
      action: input.action,
      entity_type: input.entity_type,
      entity_id: input.entity_id,
      metadata: (input.metadata ?? {}) as any,
    },
  });
}
