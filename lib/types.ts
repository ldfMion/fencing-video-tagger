// Action codes for fencing touches (sorted alphabetically)
export const ACTION_CODES = [
  "0",
  "A,R",
  "A,R-P",
  "A-A",
  "A-AP",
  "A-Cc",
  "A-Csh",
  "A-D",
  "A-L",
  "A-P",
  "AN-P",
  "AN-R",
  "AP-A",
  "AP-F",
  "AP-P",
  "AR,R",
  "bl",
  "Cc-A",
  "Cc-AP",
  "Cc-CT",
  "CCR-R",
  "CR,R",
  "CR-P",
  "CR-R",
  "Csh-A",
  "CT-R",
  "L-A",
  "R,R",
  "R-P",
  "R-R",
  "rc",
  "yc",
] as const;

export type ActionCode = (typeof ACTION_CODES)[number];
export type Side = "L" | "R";
export type MistakeType = "tactical" | "execution";

export interface Tag {
  id: string;
  timestamp: number; // seconds into video
  createdAt: number; // unix timestamp
  comment: string; // replaces 'text' field
  // Optional fields for statistics
  side?: Side; // required for statistics, optional for notes
  action?: ActionCode; // only for statistics
  mistake?: MistakeType; // only for statistics
}

export interface VideoSession {
  id: string; // serves as bout_id
  fileName: string;
  tags: Tag[];
  lastModified: number; // unix timestamp
  // Bout metadata
  leftFencer?: string;
  rightFencer?: string;
  boutDate?: string; // ISO date string
}
