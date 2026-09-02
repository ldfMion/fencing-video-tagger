import type { Metadata } from "next";
import { Suspense } from "react";
import { SearchPageShell } from "@/app/search/search-page-shell";
import { RouteLoading } from "@/components/route-loading";
import { listSearchFencers } from "@/lib/server/comment-search-service";

export const metadata: Metadata = {
  title: "Touch Search · Piste",
  description: "Find and replay tagged fencing touches",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

async function SearchPageContent({ searchParams }: { searchParams: SearchParams }) {
  const [params, fencers] = await Promise.all([searchParams, listSearchFencers()]);

  return <SearchPageShell initialParams={params} fencers={fencers} />;
}

export default function SearchPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<RouteLoading />}>
      <SearchPageContent searchParams={searchParams} />
    </Suspense>
  );
}
