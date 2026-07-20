import * as fs from "fs";
import * as path from "path";
import { getConfigDir } from "./config";
import { WorkshopItemRecord } from "../types";

/**
 * Registry of publishable Workshop items (reskin packs + generic uploads) plus
 * their preview images. Lives in app data so previews are never stored inside
 * content folders (which would upload them as part of the item).
 */

interface Registry {
  items: WorkshopItemRecord[];
}

function registryPath(): string {
  return path.join(getConfigDir(), "workshopItems.json");
}

function previewsDir(): string {
  const dir = path.join(getConfigDir(), "previews");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function loadRegistry(): Registry {
  try {
    const p = registryPath();
    if (fs.existsSync(p)) {
      const parsed = JSON.parse(fs.readFileSync(p, "utf-8"));
      if (parsed && Array.isArray(parsed.items)) return parsed;
    }
  } catch (error) {
    console.error("Error loading workshop registry:", error);
  }
  return { items: [] };
}

function saveRegistry(registry: Registry): void {
  fs.writeFileSync(registryPath(), JSON.stringify(registry, null, 2), "utf-8");
}

export function listWorkshopItems(): WorkshopItemRecord[] {
  return loadRegistry().items;
}

export function getWorkshopItem(localId: string): WorkshopItemRecord | null {
  return loadRegistry().items.find((i) => i.localId === localId) || null;
}

/** Find a tracked record for a reskin pack by its folder name, if any. */
export function getWorkshopItemForPack(
  packName: string
): WorkshopItemRecord | null {
  return (
    loadRegistry().items.find(
      (i) => i.kind === "reskin-pack" && i.packName === packName
    ) || null
  );
}

/** Insert or update a record (matched by localId). */
export function upsertWorkshopItem(
  record: WorkshopItemRecord
): WorkshopItemRecord {
  const registry = loadRegistry();
  const idx = registry.items.findIndex((i) => i.localId === record.localId);
  if (idx >= 0) {
    registry.items[idx] = record;
  } else {
    registry.items.push(record);
  }
  saveRegistry(registry);
  return record;
}

export function deleteWorkshopItem(localId: string): boolean {
  const registry = loadRegistry();
  const before = registry.items.length;
  registry.items = registry.items.filter((i) => i.localId !== localId);
  if (registry.items.length === before) return false;
  saveRegistry(registry);
  return true;
}

/**
 * Generate a stable local id. Avoids Math.random/Date collisions being an issue
 * by combining a slug with a monotonic counter derived from existing ids.
 */
export function generateLocalId(seed: string): string {
  const slug =
    seed
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "item";
  const existing = new Set(loadRegistry().items.map((i) => i.localId));
  if (!existing.has(slug)) return slug;
  let n = 2;
  while (existing.has(`${slug}-${n}`)) n++;
  return `${slug}-${n}`;
}

/**
 * Copy a (already-validated) preview image into the app-data previews folder,
 * named by localId. Returns the stored absolute path. Removes any prior preview
 * for this item with a different extension.
 */
export function storePreview(localId: string, sourcePath: string): string {
  const dir = previewsDir();
  const ext = path.extname(sourcePath).toLowerCase() || ".png";
  // Clean up stale previews for this item (different extension).
  for (const f of fs.readdirSync(dir)) {
    if (f.startsWith(`${localId}.`)) {
      try {
        fs.unlinkSync(path.join(dir, f));
      } catch {
        /* ignore */
      }
    }
  }
  const dest = path.join(dir, `${localId}${ext}`);
  fs.copyFileSync(sourcePath, dest);
  return dest;
}

/** Absolute path where a recompressed preview should be written for an item. */
export function previewDestFor(localId: string, ext = ".jpg"): string {
  return path.join(previewsDir(), `${localId}${ext}`);
}
