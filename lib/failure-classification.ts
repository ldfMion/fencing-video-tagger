import type {
  FailureCause,
  FailureMode,
  MistakeType,
} from "@/lib/types";

export const FAILURE_MODES = [
  "technique",
  "distance",
  "timing",
  "action-choice",
] as const satisfies readonly FailureMode[];

export const FAILURE_CAUSES = [
  "read",
  "knowledge-gap",
  "experiment",
  "discipline",
  "lapse",
  "skill-gap",
] as const satisfies readonly FailureCause[];

export const FAILURE_MODE_LABELS: Record<FailureMode, string> = {
  technique: "Technique",
  distance: "Distance",
  timing: "Timing",
  "action-choice": "Action choice",
};

export const FAILURE_MODE_DESCRIPTIONS: Record<FailureMode, string> = {
  technique:
    "The action, distance, and timing were appropriate, but the physical mechanics failed.",
  distance: "The same action could have worked from a different measure.",
  timing: "The same action could have worked at a different moment.",
  "action-choice":
    "The action remained unsuitable even with appropriate distance and timing.",
};

export const FAILURE_CAUSE_LABELS: Record<FailureCause, string> = {
  read: "Read",
  "knowledge-gap": "Knowledge gap",
  experiment: "Experiment",
  discipline: "Discipline",
  lapse: "Lapse",
  "skill-gap": "Skill gap",
};

export const FAILURE_CAUSE_DESCRIPTIONS: Record<FailureCause, string> = {
  read: "I attended to the situation but misperceived or misinterpreted a relevant cue.",
  "knowledge-gap":
    "I lacked the tactical understanding needed to identify the appropriate response.",
  experiment: "I deliberately tested a plausible but uncertain option.",
  discipline:
    "The correct response was consciously available, but I acted against it.",
  lapse:
    "I temporarily failed to apply knowledge, attention, or ability that is normally available.",
  "skill-gap":
    "The required ability is not yet reliable under comparable conditions.",
};

export const LEGACY_MISTAKE_LABELS: Record<MistakeType, string> = {
  tactical: "Tactical",
  execution: "Execution",
};

export function formatFailureMode(mode: FailureMode): string {
  return FAILURE_MODE_LABELS[mode];
}

export function formatFailureCause(cause: FailureCause): string {
  return FAILURE_CAUSE_LABELS[cause];
}
