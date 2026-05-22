"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  createScriptAction,
  updateScriptAction,
  deleteScriptAction,
  toggleScriptActiveAction,
  type ScriptFormState,
} from "./actions";
import { toast } from "sonner";
import type { Script } from "@/lib/db/schema";
import { BookOpen, Plus, Pencil, Trash2, Eye } from "lucide-react";

interface Props {
  initialScripts: Script[];
}

function ScriptForm({
  script,
  onClose,
}: {
  script?: Script;
  onClose: () => void;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const action = script
    ? updateScriptAction.bind(null, script.id)
    : createScriptAction;

  const [state, formAction, pending] = useActionState<ScriptFormState, FormData>(
    action as (prev: ScriptFormState, fd: FormData) => Promise<ScriptFormState>,
    {}
  );

  if (state.ok && !pending) {
    toast.success(script ? "Script updated" : "Script created");
    startTransition(() => router.refresh());
    onClose();
  }
  if (state.error && !pending) {
    toast.error(state.error);
  }

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label className="text-sm font-medium">Title *</label>
        <Input name="title" defaultValue={script?.title} required className="mt-1" />
      </div>
      <div>
        <label className="text-sm font-medium">Sort Order</label>
        <Input name="sortOrder" type="number" min={0} max={999} defaultValue={script?.sortOrder ?? 0} className="mt-1 w-24" />
      </div>
      <div>
        <label className="text-sm font-medium">Script Body *</label>
        <textarea
          name="body"
          defaultValue={script?.body}
          required
          minLength={10}
          maxLength={5000}
          rows={14}
          className="mt-1 flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-mono"
          placeholder="Write the script body here…"
        />
      </div>
      <div className="flex items-center gap-2">
        <input type="checkbox" name="isActive" id="isActive" defaultChecked={script?.isActive ?? true} className="size-4" />
        <label htmlFor="isActive" className="text-sm">Active (visible to dealers)</label>
      </div>
      <div className="flex gap-2 pt-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : script ? "Update script" : "Create script"}
        </Button>
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
      </div>
    </form>
  );
}

export function ScriptsClient({ initialScripts }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState<Script | "new" | null>(null);
  const [viewing, setViewing] = useState<Script | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this script? This cannot be undone.")) return;
    setDeleting(id);
    const res = await deleteScriptAction(id);
    if (res.error) toast.error(res.error);
    else {
      toast.success("Script deleted");
      startTransition(() => router.refresh());
    }
    setDeleting(null);
  };

  const handleToggle = async (s: Script) => {
    setToggling(s.id);
    const res = await toggleScriptActiveAction(s.id, !s.isActive);
    if (res.error) toast.error(res.error);
    else startTransition(() => router.refresh());
    setToggling(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Sales Scripts</h1>
          <p className="text-sm text-muted-foreground">Manage scripts visible to all dealers.</p>
        </div>
        <Button onClick={() => setEditing("new")}>
          <Plus className="size-4 mr-1" />
          New script
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8">#</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-32">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {initialScripts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-10 text-center text-sm text-muted-foreground">
                      No scripts yet. Create your first one above.
                    </TableCell>
                  </TableRow>
                ) : (
                  initialScripts.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="text-muted-foreground text-sm">{s.sortOrder}</TableCell>
                      <TableCell>
                        <div className="font-medium">{s.title}</div>
                        <div className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                          {s.body.slice(0, 80)}…
                        </div>
                      </TableCell>
                      <TableCell>
                        <button onClick={() => handleToggle(s)} disabled={toggling === s.id}>
                          <Badge variant={s.isActive ? "default" : "outline"}>
                            {s.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </button>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setViewing(s)}
                            title="Preview"
                          >
                            <Eye className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditing(s)}
                            title="Edit"
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(s.id)}
                            disabled={deleting === s.id}
                            title="Delete"
                          >
                            <Trash2 className="size-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Edit/Create dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => { if (!o) setEditing(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="size-4" />
              {editing === "new" ? "New Script" : "Edit Script"}
            </DialogTitle>
          </DialogHeader>
          {editing && (
            <ScriptForm
              script={editing === "new" ? undefined : editing}
              onClose={() => setEditing(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Preview sheet */}
      <Sheet open={!!viewing} onOpenChange={(o) => { if (!o) setViewing(null); }}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          {viewing && (
            <>
              <SheetHeader className="mb-4">
                <SheetTitle>{viewing.title}</SheetTitle>
              </SheetHeader>
              <div className="whitespace-pre-wrap text-sm leading-relaxed">
                {viewing.body}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
