import { readFile } from "node:fs/promises";

export async function readJsonl(filePath) {
  const text = await readFile(filePath, "utf8");
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  return lines.map((line, index) => {
    try {
      return JSON.parse(line);
    } catch {
      throw new Error(`${filePath}:${index + 1}: invalid JSONL record`);
    }
  });
}
