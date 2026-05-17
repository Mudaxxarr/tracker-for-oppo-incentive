import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function PageTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{title}</h1>
        {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Placeholder</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          This page lights up in a later phase.
        </CardContent>
      </Card>
    </div>
  );
}
