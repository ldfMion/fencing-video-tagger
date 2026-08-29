import { Loader2, Swords } from "lucide-react";

export function RouteLoading({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={
        compact
          ? "flex h-screen items-center justify-center bg-background"
          : "min-h-screen bg-background px-4 py-6"
      }
    >
      <div className="mx-auto flex max-w-4xl items-center justify-center gap-3 rounded-xl border bg-card/70 px-5 py-4 text-sm text-muted-foreground shadow-sm backdrop-blur-xl">
        <span className="relative">
          <Swords className="size-5" />
          <Loader2 className="absolute -right-2 -top-2 size-3 animate-spin text-primary" />
        </span>
        Loading fencing workspace…
      </div>
    </div>
  );
}
