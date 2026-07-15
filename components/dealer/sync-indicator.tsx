/** Shown right after a create/delete action closes, while router.refresh()
 *  re-fetches the real list/KPIs in the background — without this, there's a
 *  visible beat where the success toast has already fired but the table
 *  still shows the pre-action data. */
export function SyncIndicator() {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <span className="size-1.5 animate-pulse rounded-full bg-primary" />
      Updating…
    </span>
  );
}
