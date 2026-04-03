import { BoutWorkspaceShell } from "@/app/bouts/[id]/bout-workspace-shell";

interface BoutPageProps {
  params: Promise<{ id: string }>;
}

export default async function BoutPage(props: BoutPageProps) {
  const { id } = await props.params;

  return <BoutWorkspaceShell boutId={id} />;
}
