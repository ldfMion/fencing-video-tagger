import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { StatRow } from "@/lib/stats";

export function StatsTable({ rows }: { rows: StatRow[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="text-left">Category</TableHead>
          <TableHead className="text-right">For</TableHead>
          <TableHead className="text-right">Against</TableHead>
          <TableHead className="text-right">Diff</TableHead>
          <TableHead className="text-right">Win %</TableHead>
          <TableHead className="text-right">EV</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.category}>
            <TableCell>{row.label}</TableCell>
            <TableCell className="text-right tabular-nums">{row.hitsFor}</TableCell>
            <TableCell className="text-right tabular-nums">{row.hitsAgainst}</TableCell>
            <TableCell className="text-right tabular-nums">
              <span
                className={
                  row.differential > 0
                    ? "text-green-600 dark:text-green-400"
                    : row.differential < 0
                      ? "text-red-600 dark:text-red-400"
                      : ""
                }
              >
                {row.differential > 0 ? "+" : ""}
                {row.differential}
              </span>
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {row.winRate != null ? `${Math.round(row.winRate * 100)}%` : "\u2013"}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {row.expectedValue != null ? (
                <span
                  className={
                    row.expectedValue > 0
                      ? "text-green-600 dark:text-green-400"
                      : row.expectedValue < 0
                        ? "text-red-600 dark:text-red-400"
                        : ""
                  }
                >
                  {row.expectedValue > 0 ? "+" : ""}
                  {row.expectedValue.toFixed(2)}
                </span>
              ) : (
                "\u2013"
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
