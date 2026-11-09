import type { Tag } from "@/lib/types";

export function formatAgentTagLine(tag: Tag): string {
  const fields = [
    `id=${tag.id}`,
    `t=${tag.timestamp?.toFixed(3) ?? "none"}s`,
    `side=${tag.side ?? "none"}`,
    `action=${tag.action ?? "none"}`,
    tag.matchPeriod ? `period=${tag.matchPeriod}` : null,
    tag.matchClock ? `clock=${tag.matchClock}` : null,
    tag.stripZone ? `zone=${tag.stripZone}` : null,
    `by=${tag.origin === "agent" ? "agent" : "user"}`,
  ];
  return `- ${fields.filter(Boolean).join(" ")}`;
}
