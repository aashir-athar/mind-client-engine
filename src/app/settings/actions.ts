"use server";

import { revalidatePath } from "next/cache";
import { SERVICES } from "@/lib/constants";
import { prisma } from "@/lib/db";

export async function updateGoal(formData: FormData) {
  const targetUsd = Number(formData.get("targetUsd"));
  const deadlineStr = String(formData.get("deadline") ?? "");
  const deadline = new Date(deadlineStr);

  if (!Number.isFinite(targetUsd) || targetUsd <= 0) throw new Error("Target must be a positive number");
  if (Number.isNaN(deadline.getTime())) throw new Error("Invalid deadline");

  await prisma.settings.upsert({
    where: { id: "singleton" },
    update: { goalTargetUsd: targetUsd, goalDeadline: deadline },
    create: {
      id: "singleton",
      servicesOffered: JSON.stringify(SERVICES),
      goalTargetUsd: targetUsd,
      goalDeadline: deadline,
    },
  });

  revalidatePath("/settings");
  revalidatePath("/");
}
