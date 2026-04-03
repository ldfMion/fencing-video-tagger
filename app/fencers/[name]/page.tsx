import { FencerAnalyticsShell } from "@/app/fencers/[name]/fencer-analytics-shell";

interface FencerPageProps {
  params: Promise<{ name: string }>;
}

export default async function FencerPage(props: FencerPageProps) {
  const { name } = await props.params;

  return <FencerAnalyticsShell fencerName={decodeURIComponent(name)} />;
}
