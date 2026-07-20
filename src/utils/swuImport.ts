import * as fs from "fs";
import * as path from "path";
import { WorkshopVisibility, WorkshopItemRecord } from "../types";
import {
  listWorkshopItems,
  upsertWorkshopItem,
  generateLocalId,
  storePreview,
} from "./workshopItems";

/**
 * Import tracking data from the legacy SteamWorkshopUploader
 * (github.com/nihilocrat/SteamWorkshopUploader).
 *
 * That tool stores each item as a `<Name>.workshop.json` sidecar next to a
 * `<Name>/` content folder and a `<Name>.png` preview. We read those, preserve
 * the published file id, and register each as a generic folder upload — so
 * future publishes update the existing Workshop item instead of duplicating it.
 */

interface SwuPack {
  publishedfileid?: string;
  contentfolder?: string;
  previewfile?: string;
  visibility?: number;
  title?: string;
  description?: string;
  tags?: string[];
}

export interface SwuImportEntry {
  title: string;
  publishedFileId?: string;
  status: "imported" | "updated" | "skipped";
  reason?: string;
}

export interface SwuImportResult {
  imported: number;
  updated: number;
  skipped: number;
  entries: SwuImportEntry[];
}

function visibilityFromInt(n?: number): WorkshopVisibility {
  switch (n) {
    case 1:
      return "friends";
    case 2:
      return "private";
    case 3:
      return "unlisted";
    default:
      return "public";
  }
}

/** Recursively collect *.workshop.json files under a folder (bounded depth). */
function findWorkshopJsonFiles(root: string, depth = 0): string[] {
  if (depth > 3) return [];
  const results: string[] = [];
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(root, { withFileTypes: true });
  } catch {
    return results;
  }
  for (const entry of entries) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) {
      results.push(...findWorkshopJsonFiles(full, depth + 1));
    } else if (entry.isFile() && entry.name.endsWith(".workshop.json")) {
      results.push(full);
    }
  }
  return results;
}

/**
 * Import from a SteamWorkshopUploader folder (typically its `WorkshopContent`
 * directory). Returns a per-item summary.
 */
export function importFromSteamWorkshopUploader(
  sourceFolder: string
): SwuImportResult {
  const files = findWorkshopJsonFiles(sourceFolder);
  const existing = listWorkshopItems();
  const result: SwuImportResult = {
    imported: 0,
    updated: 0,
    skipped: 0,
    entries: [],
  };

  for (const file of files) {
    const baseDir = path.dirname(file);
    let pack: SwuPack;
    try {
      pack = JSON.parse(fs.readFileSync(file, "utf-8"));
    } catch {
      result.skipped++;
      result.entries.push({
        title: path.basename(file),
        status: "skipped",
        reason: "Could not parse the .workshop.json file.",
      });
      continue;
    }

    const title =
      pack.title || pack.contentfolder || path.basename(file, ".workshop.json");

    // Resolve the content folder (relative to the sidecar's directory).
    const contentPath = pack.contentfolder
      ? path.join(baseDir, pack.contentfolder)
      : "";
    if (!contentPath || !fs.existsSync(contentPath)) {
      result.skipped++;
      result.entries.push({
        title,
        publishedFileId: pack.publishedfileid,
        status: "skipped",
        reason: `Content folder "${pack.contentfolder || ""}" not found next to the .workshop.json.`,
      });
      continue;
    }

    // Match an existing tracked item by published file id so re-imports update
    // rather than duplicate.
    const match = pack.publishedfileid
      ? existing.find((i) => i.publishedFileId === pack.publishedfileid)
      : undefined;

    // Use the sidecar's modified time as a "last updated" proxy so imported
    // items sort sensibly (SWU has no timestamp field of its own).
    let updatedAt: number | undefined = match?.lastPublishedAt;
    try {
      updatedAt = updatedAt ?? Math.round(fs.statSync(file).mtimeMs);
    } catch {
      /* leave undefined */
    }

    const localId = match ? match.localId : generateLocalId(title);

    // Bring the preview across into app data (never inside the content folder).
    let previewPath = match?.previewPath;
    if (pack.previewfile) {
      const previewSource = path.join(baseDir, pack.previewfile);
      if (fs.existsSync(previewSource)) {
        try {
          previewPath = storePreview(localId, previewSource);
        } catch {
          /* keep going; preview is optional */
        }
      }
    }

    const record: WorkshopItemRecord = {
      localId,
      kind: "generic",
      contentPath,
      publishedFileId: pack.publishedfileid || match?.publishedFileId,
      title,
      description: pack.description || "",
      // SWU stores tags with stray leading spaces and sometimes empty strings.
      tags: Array.isArray(pack.tags)
        ? pack.tags.map((t) => (t || "").trim()).filter(Boolean)
        : [],
      visibility: visibilityFromInt(pack.visibility),
      previewPath,
      lastPublishedAt: updatedAt,
    };
    upsertWorkshopItem(record);

    if (match) {
      result.updated++;
      result.entries.push({ title, publishedFileId: record.publishedFileId, status: "updated" });
    } else {
      result.imported++;
      result.entries.push({ title, publishedFileId: record.publishedFileId, status: "imported" });
    }
  }

  return result;
}
