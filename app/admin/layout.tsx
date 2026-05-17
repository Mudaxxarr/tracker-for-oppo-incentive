import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import { TopBar } from "@/components/feature/top-bar";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!(await isAuthenticated())) {
    redirect("/unlock");
  }

  return (
    <div className="flex min-h-screen flex-col">
      <TopBar dealers={[]} activeDealerId={null} />
      <div className="flex flex-1">
        <aside className="hidden md:flex md:w-56 md:flex-col md:border-r md:bg-muted/20">
          <nav className="flex flex-col gap-1 p-3">
            {[
              { href: "/admin/dealers", label: "Dealers" },
              { href: "/admin/revenue", label: "Revenue" },
            ].map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                {item.label}
              </a>
            ))}
          </nav>
        </aside>
        <main className="flex flex-1 flex-col overflow-x-hidden pb-16 md:pb-0">
          <div className="px-3 py-4 md:px-6 md:py-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
