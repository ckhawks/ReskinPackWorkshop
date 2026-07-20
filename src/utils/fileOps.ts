import * as fs from "fs";
import * as path from "path";
import { ReskinPack } from "../types";

/**
 * Read a reskinpack.json file
 */
export function readReskinPack(packPath: string): ReskinPack | null {
  try {
    const jsonPath = path.join(packPath, "reskinpack.json");
    if (!fs.existsSync(jsonPath)) {
      return null;
    }
    const content = fs.readFileSync(jsonPath, "utf-8");
    return JSON.parse(content);
  } catch (error) {
    console.error(`Error reading reskin pack from ${packPath}:`, error);
    return null;
  }
}

/**
 * Write a reskinpack.json file
 */
export function writeReskinPack(packPath: string, pack: ReskinPack): boolean {
  try {
    // Ensure pack directory exists
    if (!fs.existsSync(packPath)) {
      fs.mkdirSync(packPath, { recursive: true });
    }

    const jsonPath = path.join(packPath, "reskinpack.json");
    fs.writeFileSync(jsonPath, JSON.stringify(pack, null, 2), "utf-8");
    return true;
  } catch (error) {
    console.error(`Error writing reskin pack to ${packPath}:`, error);
    return false;
  }
}

/**
 * List all reskin packs in a folder
 */
export function listReskinPacks(reskinpacksFolder: string): string[] {
  try {
    if (!fs.existsSync(reskinpacksFolder)) {
      return [];
    }

    const items = fs.readdirSync(reskinpacksFolder, { withFileTypes: true });
    const packs: string[] = [];

    for (const item of items) {
      if (item.isDirectory()) {
        const packJsonPath = path.join(
          reskinpacksFolder,
          item.name,
          "reskinpack.json"
        );
        if (fs.existsSync(packJsonPath)) {
          packs.push(item.name);
        }
      }
    }

    return packs.sort();
  } catch (error) {
    console.error("Error listing reskin packs:", error);
    return [];
  }
}

/**
 * Create a new reskin pack with default values
 */
export function createNewReskinPack(
  packName: string,
  uniqueId: string,
  packPath: string
): ReskinPack {
  const newPack: ReskinPack = {
    name: packName,
    "unique-id": uniqueId || generateUniqueId(packName),
    version: "1.0.0",
    "pack-format": 1,
    reskins: [],
  };

  writeReskinPack(packPath, newPack);
  return newPack;
}

/**
 * Generate a unique ID from pack name
 */
export function generateUniqueId(packName: string): string {
  return packName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Copy an image file to the pack
 */
export function copyImageToPack(
  sourceImagePath: string,
  packPath: string,
  destRelativePath: string
): boolean {
  try {
    const destFullPath = path.join(packPath, destRelativePath);
    const destDir = path.dirname(destFullPath);

    // Ensure destination directory exists
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    // Copy file
    fs.copyFileSync(sourceImagePath, destFullPath);
    return true;
  } catch (error) {
    console.error("Error copying image:", error);
    return false;
  }
}

export interface ContentFileInfo {
  path: string; // relative to the content root, forward slashes
  size: number; // bytes
  modified: number; // mtime in ms
}

export interface ContentListing {
  files: ContentFileInfo[];
  totalBytes: number;
  totalCount: number;
  truncated: boolean; // true if more files exist than `files` contains
}

/**
 * Recursively list every file under a folder, with size and last-modified time.
 * Used to preview exactly what will be uploaded to the Workshop. Results are
 * sorted most-recently-modified first and capped at `max` entries.
 */
export function listContentFiles(dir: string, max = 5000): ContentListing {
  const files: ContentFileInfo[] = [];
  let totalBytes = 0;
  let totalCount = 0;

  function walk(current: string, prefix: string): void {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        walk(full, rel);
      } else if (entry.isFile()) {
        totalCount++;
        try {
          const stat = fs.statSync(full);
          totalBytes += stat.size;
          if (files.length < max) {
            files.push({
              path: rel,
              size: stat.size,
              modified: Math.round(stat.mtimeMs),
            });
          }
        } catch {
          /* skip unreadable file */
        }
      }
    }
  }

  if (fs.existsSync(dir)) {
    walk(dir, "");
  }

  files.sort((a, b) => b.modified - a.modified);

  return {
    files,
    totalBytes,
    totalCount,
    truncated: totalCount > files.length,
  };
}

/**
 * Delete a reskin pack folder
 */
export function deleteReskinPack(packPath: string): boolean {
  try {
    if (fs.existsSync(packPath)) {
      fs.rmSync(packPath, { recursive: true, force: true });
      return true;
    }
    return false;
  } catch (error) {
    console.error("Error deleting reskin pack:", error);
    return false;
  }
}
