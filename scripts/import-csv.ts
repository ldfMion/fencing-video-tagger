import { readFileSync, writeFileSync } from "fs";
import { z } from "zod";
import {
  ACTION_CODES,
  ActionCodeSchema,
  SideSchema,
  MistakeTypeSchema,
  VideoSessionSchema,
  StorageEnvelopeSchema,
  CURRENT_SCHEMA_VERSION,
} from "../lib/types";

// --- CLI argument parsing ---

const args = process.argv.slice(2);

function printUsage() {
  console.error(
    "Usage: pnpm import-csv <bouts.csv> <tags.csv> --output <output.json>"
  );
  process.exit(1);
}

if (args.length < 3) printUsage();

const outputIndex = args.indexOf("--output");
if (outputIndex === -1 || outputIndex + 1 >= args.length) printUsage();

const boutsPath = args[0];
const tagsPath = args[1];
const outputPath = args[outputIndex + 1];

// --- CSV parsing ---

/** Parse a CSV line respecting quoted fields (handles commas inside quotes) */
function splitCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++; // skip escaped quote
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        fields.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
  }
  fields.push(current.trim());
  return fields;
}

function parseCSV(content: string): Record<string, string>[] {
  const lines = content
    .replace(/\r\n/g, "\n")
    .split("\n")
    .filter((line) => line.trim() !== "");

  if (lines.length === 0) return [];

  const headers = splitCSVLine(lines[0]);
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = splitCSVLine(lines[i]);
    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = values[j] ?? "";
    }
    rows.push(row);
  }

  return rows;
}

// --- Validation ---

const EXPECTED_BOUT_COLUMNS = [
  "bout_id",
  "left_fencer",
  "right_fencer",
  "date",
  "bout_type",
  "left_score",
  "right_score",
  "link",
];

const EXPECTED_TAG_COLUMNS = [
  "bout_id",
  "side",
  "action_new",
  "comments",
  "mistake",
];

function validateColumns(
  actual: string[],
  expected: string[],
  fileName: string
) {
  const missing = expected.filter((col) => !actual.includes(col));

  if (missing.length > 0) {
    console.error(
      `Column validation failed: Missing columns in ${fileName}: ${missing.join(", ")}`
    );
    process.exit(1);
  }

  const extra = actual.filter(
    (col) => col !== "" && !expected.includes(col)
  );
  if (extra.length > 0) {
    console.log(`  Note: ignoring extra columns in ${fileName}: ${extra.join(", ")}`);
  }
}

// --- Main ---

const boutsContent = readFileSync(boutsPath, "utf-8");
const tagsContent = readFileSync(tagsPath, "utf-8");

const boutRows = parseCSV(boutsContent);
const tagRows = parseCSV(tagsContent);

if (boutRows.length === 0) {
  console.error("Bouts CSV is empty");
  process.exit(1);
}

// Validate column headers
const boutHeaders = Object.keys(boutRows[0]);
const tagHeaders = tagRows.length > 0 ? Object.keys(tagRows[0]) : [];

validateColumns(boutHeaders, EXPECTED_BOUT_COLUMNS, boutsPath);
if (tagRows.length > 0) {
  validateColumns(tagHeaders, EXPECTED_TAG_COLUMNS, tagsPath);
}

// Validate all rows - collect errors, then reject all-or-nothing
const errors: string[] = [];
const boutIds = new Set<string>();

// Filter out rows with empty bout_id (trailing blank rows from spreadsheets)
const validBoutRows = boutRows.filter((row) => row.bout_id?.trim());
const skippedBoutRows = boutRows.length - validBoutRows.length;
if (skippedBoutRows > 0) {
  console.log(`  Note: skipped ${skippedBoutRows} bout row(s) with empty bout_id`);
}

// Validate bouts
for (let i = 0; i < validBoutRows.length; i++) {
  const row = validBoutRows[i];
  boutIds.add(row.bout_id.trim());
}

// Filter out tag rows with empty bout_id
const validTagRows = tagRows.filter((row) => row.bout_id?.trim());
const skippedTagRows = tagRows.length - validTagRows.length;
if (skippedTagRows > 0) {
  console.log(`  Note: skipped ${skippedTagRows} tag row(s) with empty bout_id`);
}

// Validate tags
const actionCodesSet = new Set<string>(ACTION_CODES);

for (let i = 0; i < validTagRows.length; i++) {
  const row = validTagRows[i];
  const lineNum = i + 2;

  if (!boutIds.has(row.bout_id.trim())) {
    errors.push(
      `Tags row ${lineNum}: bout_id "${row.bout_id}" not found in bouts CSV`
    );
  }

  const action = row.action_new?.trim();
  if (action && !actionCodesSet.has(action)) {
    errors.push(
      `Tags row ${lineNum}: unknown action_new "${action}"`
    );
  }

  const side = row.side?.trim();
  if (side) {
    const sideResult = SideSchema.safeParse(side);
    if (!sideResult.success) {
      errors.push(`Tags row ${lineNum}: invalid side "${side}" (must be "L" or "R")`);
    }
  }

  const mistake = row.mistake?.trim();
  if (mistake) {
    const mistakeResult = MistakeTypeSchema.safeParse(mistake);
    if (!mistakeResult.success) {
      errors.push(
        `Tags row ${lineNum}: invalid mistake "${mistake}" (must be "tactical" or "execution")`
      );
    }
  }
}

if (errors.length > 0) {
  console.error(`Validation failed with ${errors.length} error(s):`);
  errors.forEach((e) => console.error(`  ${e}`));
  process.exit(1);
}

// --- Build sessions ---

const now = Date.now();

// Group tags by bout_id
const tagsByBout = new Map<string, typeof validTagRows>();
for (const row of validTagRows) {
  const boutId = row.bout_id.trim();
  if (!tagsByBout.has(boutId)) {
    tagsByBout.set(boutId, []);
  }
  tagsByBout.get(boutId)!.push(row);
}

const sessions = validBoutRows.map((bout) => {
  const boutId = bout.bout_id.trim();
  const boutTags = tagsByBout.get(boutId) ?? [];

  const tags = boutTags.map((tagRow, index) => {
    const action = tagRow.action_new?.trim() || undefined;
    const side = tagRow.side?.trim() || undefined;
    const mistake = tagRow.mistake?.trim() || undefined;

    return {
      id: crypto.randomUUID(),
      createdAt: now,
      seq: index + 1,
      comment: tagRow.comments?.trim() ?? "",
      ...(side && { side: side as "L" | "R" }),
      ...(action && { action: action as z.infer<typeof ActionCodeSchema> }),
      ...(mistake && {
        mistake: mistake as "tactical" | "execution",
      }),
    };
  });

  const date = bout.date?.trim() || undefined;
  const boutType = bout.bout_type?.trim() || undefined;
  const link = bout.link?.trim() || undefined;

  return {
    id: boutId,
    tags,
    lastModified: now,
    ...(bout.left_fencer?.trim() && { leftFencer: bout.left_fencer.trim() }),
    ...(bout.right_fencer?.trim() && {
      rightFencer: bout.right_fencer.trim(),
    }),
    ...(date && { boutDate: date }),
    ...(boutType && { boutType }),
    ...(link && { externalSource: link }),
  };
});

// Final Zod validation as safety net
const validated = z.array(VideoSessionSchema).safeParse(sessions);
if (!validated.success) {
  console.error("Final Zod validation failed:");
  console.error(validated.error.format());
  process.exit(1);
}

// --- Write output ---

const envelope = {
  version: CURRENT_SCHEMA_VERSION,
  sessions: validated.data,
};

// Validate envelope too
const envelopeValidated = StorageEnvelopeSchema.safeParse(envelope);
if (!envelopeValidated.success) {
  console.error("Envelope validation failed:");
  console.error(envelopeValidated.error.format());
  process.exit(1);
}

writeFileSync(outputPath, JSON.stringify(envelope, null, 2));

// --- Summary ---

const totalTags = sessions.reduce((sum, s) => sum + s.tags.length, 0);
console.log(`Successfully converted:`);
console.log(`  ${sessions.length} bout(s)`);
console.log(`  ${totalTags} tag(s)`);
console.log(`  Output: ${outputPath}`);
