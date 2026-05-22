"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isAuthenticated } from "@/lib/auth";
import { createScript, updateScript, deleteScript } from "@/lib/db/queries/scripts";
import { logAudit } from "@/lib/audit";

export type ScriptFormState = { error?: string; ok?: boolean };

const ScriptSchema = z.object({
  title: z.string().trim().min(1, "Title required").max(120),
  body: z.string().trim().min(10, "Script body required (min 10 chars)").max(5000),
  sortOrder: z.coerce.number().int().min(0).max(999).default(0),
  isActive: z.preprocess((v) => v === "on" || v === true || v === "true", z.boolean()).default(true),
});

export async function createScriptAction(
  _prev: ScriptFormState,
  fd: FormData
): Promise<ScriptFormState> {
  if (!(await isAuthenticated())) return { error: "Not authenticated" };

  const parsed = ScriptSchema.safeParse({
    title: fd.get("title"),
    body: fd.get("body"),
    sortOrder: fd.get("sortOrder") || 0,
    isActive: fd.get("isActive"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const id = await createScript(parsed.data);
  await logAudit({
    action: "script.create",
    entityType: "script",
    entityId: id,
    summary: `Created script "${parsed.data.title}"`,
  });
  revalidatePath("/scripts");
  return { ok: true };
}

export async function updateScriptAction(
  id: string,
  _prev: ScriptFormState,
  fd: FormData
): Promise<ScriptFormState> {
  if (!(await isAuthenticated())) return { error: "Not authenticated" };

  const parsed = ScriptSchema.safeParse({
    title: fd.get("title"),
    body: fd.get("body"),
    sortOrder: fd.get("sortOrder") || 0,
    isActive: fd.get("isActive"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  await updateScript(id, parsed.data);
  await logAudit({
    action: "script.update",
    entityType: "script",
    entityId: id,
    summary: `Updated script "${parsed.data.title}"`,
  });
  revalidatePath("/scripts");
  return { ok: true };
}

export async function deleteScriptAction(id: string): Promise<{ error?: string }> {
  if (!(await isAuthenticated())) return { error: "Not authenticated" };
  await deleteScript(id);
  await logAudit({
    action: "script.delete",
    entityType: "script",
    entityId: id,
    summary: `Deleted script ${id}`,
  });
  revalidatePath("/scripts");
  return {};
}

export async function toggleScriptActiveAction(
  id: string,
  isActive: boolean
): Promise<{ error?: string }> {
  if (!(await isAuthenticated())) return { error: "Not authenticated" };
  await updateScript(id, { isActive });
  revalidatePath("/scripts");
  return {};
}
