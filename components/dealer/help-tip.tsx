"use client";

import Link from "next/link";
import { Info } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { getHelp, topicId } from "@/lib/dealer/help-content";
import { cn } from "@/lib/utils";

export function HelpTip({ term, className }: { term: string; className?: string }) {
  const entry = getHelp(term);
  if (!entry) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(`HelpTip: unknown term "${term}"`);
    }
    return null;
  }
  return (
    <Popover>
      <PopoverTrigger
        aria-label={`What is ${entry.label}?`}
        className={cn(
          "inline-grid size-4 shrink-0 cursor-help place-items-center rounded-full text-muted-foreground/70 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          className,
        )}
      >
        <Info className="size-3.5" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64">
        <PopoverHeader>
          <PopoverTitle>{entry.label}</PopoverTitle>
          <PopoverDescription>{entry.short}</PopoverDescription>
        </PopoverHeader>
        <Link
          href={`/dealer/help#${topicId(entry.topic)}`}
          className="text-xs font-medium text-primary hover:underline"
        >
          Learn more →
        </Link>
      </PopoverContent>
    </Popover>
  );
}
