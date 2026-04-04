import { connection } from "next/server";
import { BoutWorkspaceShell } from "@/app/bouts/[id]/bout-workspace-shell";
import { listSessions } from "@/lib/server/session-service";

interface BoutPageProps {
  params: Promise<{ id: string }>;
}

export default async function BoutPage(props: BoutPageProps) {
  await connection();
  const { id } = await props.params;
  const initialSessions = await listSessions();

  return <BoutWorkspaceShell boutId={id} initialSessions={initialSessions} />;
}
