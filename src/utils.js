export function parseSnapPoints(input) {
  const parts = input
    ?.split(',')
    .map((part) => part.trim())
    .filter(Boolean);

  if (!parts?.length) return [];

  const names = new Set();

  const points = parts.map((part) => {
    const separator = part.indexOf(':');

    if (separator < 1) {
      throw new TypeError(`Invalid snap point "${part}". Expected name:fraction.`);
    }

    const name = part.slice(0, separator).trim();
    const fraction = Number(part.slice(separator + 1));

    if (!name || !Number.isFinite(fraction) || fraction <= 0 || fraction > 1) {
      throw new TypeError(`Invalid snap point "${part}".`);
    }

    if (names.has(name)) {
      throw new TypeError(`Duplicate snap point "${name}".`);
    }

    names.add(name);

    return { name, fraction };
  });

  return points.sort((a, b) => a.fraction - b.fraction);
}
