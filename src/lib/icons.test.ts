import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ICON = 'src/components/Icon.astro';

function definedNames(): Set<string> {
  const source = readFileSync(ICON, 'utf8');
  return new Set(
    [...source.matchAll(/^ {2}'?([a-zA-Z0-9-]+)'?:\s*\n?\s*'/gm)].map(
      (match) => match[1]
    )
  );
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);

    if (statSync(full).isDirectory()) {
      walk(full, out);
    } else if (/\.(astro|ts|tsx|mdx)$/.test(entry)) {
      out.push(full);
    }
  }

  return out;
}

function usedNames(): Map<string, number> {
  const used = new Map<string, number>();

  for (const file of walk('src')) {
    if (file.endsWith(ICON)) continue;

    const source = readFileSync(file, 'utf8');

    for (const match of source.matchAll(/<Icon[^>]*\bname="([a-zA-Z0-9-]+)"/g)) {
      used.set(match[1], (used.get(match[1]) ?? 0) + 1);
    }
  }

  return used;
}

describe('the icon set', () => {
  it('defines every icon name used by the site', () => {
    const defined = definedNames();
    const missing = [...usedNames()]
      .filter(([name]) => !defined.has(name))
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => `${name} (used ${count}×)`);

    expect(
      missing,
      `Undefined icon names render as empty SVGs: ${missing.join(', ')}`
    ).toEqual([]);
  });

  it('finds enough defined and used names to validate the checks', () => {
    expect(definedNames().size).toBeGreaterThan(30);
    expect(usedNames().size).toBeGreaterThan(10);
  });
});