import type { Metadata } from "next";
import { connection } from "next/server";
import { BoutWorkspaceShell } from "@/app/bouts/[id]/bout-workspace-shell";
import { getBoutDisplayLabel } from "@/lib/session-selectors";
import { getSessionById, listSessions } from "@/lib/server/session-service";
import {
  findTagById,
  getDefaultBoutDescription,
  getTagShareDescription,
  getTagShareTitle,
} from "@/lib/tag-share";

interface BoutPageSearchParams {
  tag?: string | string[];
}

interface BoutPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<BoutPageSearchParams>;
}

function getSingleSearchParamValue(
  value: string | string[] | undefined,
): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export async function generateMetadata(
  props: BoutPageProps,
): Promise<Metadata> {
  const { id } = await props.params;
  const searchParams = await props.searchParams;
  const session = await getSessionById(id);

  if (!session) {
    return {
      title: "Bout not found",
      description: "This bout does not exist or may have been deleted.",
    };
  }

  const tagId = getSingleSearchParamValue(searchParams.tag);
  const tag = findTagById(session, tagId);

  if (!tag) {
    return {
      title: getBoutDisplayLabel(session),
      description: getDefaultBoutDescription(session),
    };
  }

  const title = getTagShareTitle(session, tag);
  const description = getTagShareDescription(tag);

  return {
    title,
    description,
    openGraph: {
      title,
      description,
    },
    twitter: {
      title,
      description,
    },
  };
}

export default async function BoutPage(props: BoutPageProps) {
  await connection();
  const { id } = await props.params;
  const searchParams = await props.searchParams;
  const initialSessions = await listSessions();
  const initialTagId = getSingleSearchParamValue(searchParams.tag) ?? null;

  return (
    <BoutWorkspaceShell
      boutId={id}
      initialSessions={initialSessions}
      initialTagId={initialTagId}
    />
  );
}
