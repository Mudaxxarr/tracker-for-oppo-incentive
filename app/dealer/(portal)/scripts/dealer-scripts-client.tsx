"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { Script } from "@/lib/db/schema";
import { BookOpen, ChevronRight } from "lucide-react";

interface Props {
  scripts: Script[];
}

const SCRIPT_ICONS: Record<number, string> = {
  1: "🎯",
  2: "🤝",
  3: "🔍",
  4: "📦",
};

export function DealerScriptsClient({ scripts }: Props) {
  const [selected, setSelected] = useState<Script | null>(null);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Sales Scripts</h1>
        <p className="text-sm text-muted-foreground">Tap any script to open it mid-sale.</p>
      </div>

      {scripts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No scripts available. Contact your manager to add scripts.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {scripts.map((s) => (
            <button
              key={s.id}
              onClick={() => setSelected(s)}
              className="text-left w-full"
            >
              <Card className="h-full transition-colors hover:border-primary hover:bg-primary/5 cursor-pointer">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{SCRIPT_ICONS[s.sortOrder] ?? "📋"}</span>
                      <CardTitle className="text-base">{s.title}</CardTitle>
                    </div>
                    <ChevronRight className="size-4 text-muted-foreground shrink-0" />
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground line-clamp-3 whitespace-pre-wrap">
                    {s.body}
                  </p>
                </CardContent>
              </Card>
            </button>
          ))}
        </div>
      )}

      <Sheet open={!!selected} onOpenChange={(o) => { if (!o) setSelected(null); }}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          {selected && (
            <>
              <SheetHeader className="mb-4">
                <div className="flex items-center gap-2">
                  <BookOpen className="size-5 text-primary" />
                  <SheetTitle>{selected.title}</SheetTitle>
                </div>
              </SheetHeader>
              <div className="whitespace-pre-wrap text-sm leading-relaxed">
                {selected.body}
              </div>
              <div className="mt-6">
                <Button variant="outline" className="w-full" onClick={() => setSelected(null)}>
                  Close
                </Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
