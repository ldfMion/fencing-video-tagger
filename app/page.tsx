import { unstable_noStore as noStore } from "next/cache";
import { LibraryPageShell } from "@/app/library-page-shell";
import { listSessions } from "@/lib/server/session-service";

export default async function HomePage() {
  noStore();
  const initialSessions = await listSessions();

  return <LibraryPageShell initialSessions={initialSessions} />;
}
