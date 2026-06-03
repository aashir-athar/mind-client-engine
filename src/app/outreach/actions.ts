"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { dispatchMessage } from "@/lib/outreach/dispatch";

export async function approveMessage(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing message id");
  await prisma.message.update({ where: { id }, data: { status: "APPROVED" } });
  revalidatePath("/outreach");
}

export async function editMessage(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing message id");
  const subject = String(formData.get("subject") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  if (!body) throw new Error("Message body cannot be empty");
  await prisma.message.update({ where: { id }, data: { subject: subject || null, body } });
  revalidatePath("/outreach");
}

export async function sendMessage(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing message id");
  await dispatchMessage(id, { manual: true });
  revalidatePath("/outreach");
  revalidatePath("/leads");
}

export async function discardMessage(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing message id");
  await prisma.message.delete({ where: { id } });
  revalidatePath("/outreach");
}
