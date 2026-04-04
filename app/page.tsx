import { connection } from "next/server";
import { LibraryPageShell } from "@/app/library-page-shell";
import { listSessions } from "@/lib/server/session-service";

export default async function HomePage() {
  await connection();
  const initialSessions = await listSessions();

  return <LibraryPageShell initialSessions={initialSessions} />;
}
