import "server-only";

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

/** One authored file, with its path relative to the content directory (`items/significant.yaml`). */
export type ContentFile = { path: string; source: string };

export const CONTENT_DIR = path.join(process.cwd(), "content");

/**
 * Reads `sources.yaml`, `items/*.yaml` and `intents/*.yaml`, sorted by path so validation and
 * import see the same order on every machine. Other files (README.md, SOURCES.md) are ignored.
 */
export async function readContentDir(dir = CONTENT_DIR): Promise<ContentFile[]> {
  const files: ContentFile[] = [];
  const read = async (relative: string) => {
    files.push({ path: relative, source: await readFile(path.join(dir, relative), "utf8") });
  };

  await read("sources.yaml");
  for (const folder of ["items", "intents"]) {
    const entries = await readdir(path.join(dir, folder)).catch(() => []);
    for (const name of entries.filter((entry) => entry.endsWith(".yaml")).sort()) {
      await read(`${folder}/${name}`);
    }
  }
  return files;
}
