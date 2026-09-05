export function normalizeFencerName(name: string): string {
  // Keep identity normalization aligned with SQLite's built-in lower().
  return name.trim().replace(/[A-Z]/g, (character) => character.toLowerCase());
}

export function getUniqueFencerNames(names: Iterable<string>): string[] {
  const namesByIdentity = new Map<string, string>();

  for (const name of names) {
    const displayName = name.trim();
    if (!displayName) {
      continue;
    }

    const identity = normalizeFencerName(displayName);
    if (!namesByIdentity.has(identity)) {
      namesByIdentity.set(identity, displayName);
    }
  }

  return Array.from(namesByIdentity.values()).sort((left, right) =>
    left.localeCompare(right, undefined, { sensitivity: "base" })
  );
}
