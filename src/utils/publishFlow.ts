import * as fs from "fs";
import * as path from "path";
import { getReskinpacksFolder } from "./gameDetection";
import { readReskinPack, writeReskinPack } from "./fileOps";
import {
  createItem,
  publishItem,
  getSteamStatus,
  getLiveMetadataBatch,
} from "./steamWorkshop";
import {
  upsertWorkshopItem,
  getWorkshopItem,
  generateLocalId,
  listWorkshopItems,
} from "./workshopItems";
import { WorkshopItemRecord, PublishResult } from "../types";

export interface PublishRequest {
  /** Existing local id, or empty/omitted to create a new tracked item. */
  localId?: string;
  kind: "reskin-pack" | "generic";
  packName?: string;
  contentPath?: string;
  gameFolder?: string;
  title: string;
  description: string;
  tags: string[];
  visibility: WorkshopItemRecord["visibility"];
  /** Absolute path to the (already stored/validated) preview image. */
  previewPath?: string;
  changeNote?: string;
}

export interface PublishFlowResult {
  result: PublishResult;
  record?: WorkshopItemRecord;
}

/**
 * Resolve the content folder that will be uploaded for a request.
 */
function resolveContentPath(req: PublishRequest): string | null {
  if (req.kind === "reskin-pack") {
    if (!req.gameFolder || !req.packName) return null;
    return path.join(getReskinpacksFolder(req.gameFolder), req.packName);
  }
  return req.contentPath || null;
}

/**
 * Full publish flow: ensure Steam, create the item if it doesn't exist yet,
 * upload content + metadata, then persist tracking (registry + workshop-id in
 * reskinpack.json for reskin packs). Never overwrites live fields the caller
 * didn't provide.
 */
export async function publishWorkshopItem(
  req: PublishRequest
): Promise<PublishFlowResult> {
  const status = getSteamStatus();
  if (!status.available) {
    return { result: { success: false, error: status.error } };
  }

  const contentPath = resolveContentPath(req);
  if (!contentPath || !fs.existsSync(contentPath)) {
    return {
      result: {
        success: false,
        error: "Could not find the content folder to upload.",
      },
    };
  }

  // Load or start a tracking record.
  const localId =
    req.localId ||
    generateLocalId(req.packName || req.title || req.kind);
  const existing = req.localId ? getWorkshopItem(req.localId) : null;

  let record: WorkshopItemRecord = existing || {
    localId,
    kind: req.kind,
    packName: req.packName,
    contentPath: req.kind === "generic" ? contentPath : undefined,
    title: req.title,
    description: req.description,
    tags: req.tags,
    visibility: req.visibility,
    previewPath: req.previewPath,
  };

  // Create a new Workshop item if this one has never been published.
  let publishedFileId = record.publishedFileId;
  let needsToAcceptAgreement = false;
  if (!publishedFileId) {
    const created = await createItem();
    if (!created.success || !created.publishedFileId) {
      return { result: created };
    }
    publishedFileId = created.publishedFileId;
    needsToAcceptAgreement = created.needsToAcceptAgreement || false;
  }

  // Upload content + the metadata fields the caller provided.
  const publishResult = await publishItem({
    publishedFileId,
    contentPath,
    title: req.title,
    description: req.description,
    previewPath: req.previewPath,
    tags: req.tags,
    visibility: req.visibility,
    changeNote: req.changeNote,
  });

  if (!publishResult.success) {
    // Still persist the created id so a retry becomes an update, not a dupe.
    record = {
      ...record,
      publishedFileId,
      title: req.title,
      description: req.description,
      tags: req.tags,
      visibility: req.visibility,
      previewPath: req.previewPath ?? record.previewPath,
    };
    upsertWorkshopItem(record);
    mirrorWorkshopId(req, publishedFileId);
    return {
      result: {
        ...publishResult,
        publishedFileId,
        needsToAcceptAgreement:
          publishResult.needsToAcceptAgreement || needsToAcceptAgreement,
      },
      record,
    };
  }

  record = {
    ...record,
    publishedFileId,
    title: req.title,
    description: req.description,
    tags: req.tags,
    visibility: req.visibility,
    previewPath: req.previewPath ?? record.previewPath,
    lastPublishedAt: Date.now(),
  };
  upsertWorkshopItem(record);
  mirrorWorkshopId(req, publishedFileId);

  return {
    result: {
      ...publishResult,
      publishedFileId,
      needsToAcceptAgreement:
        publishResult.needsToAcceptAgreement || needsToAcceptAgreement,
    },
    record,
  };
}

export interface SyncResult {
  synced: number;
  checked: number;
  error?: string;
}

/**
 * Refresh every tracked, already-published item's metadata (name, description,
 * tags, visibility) from Steam in one batch query, and save the updates locally
 * so the list reflects the current Workshop state.
 */
export async function syncAllFromSteam(): Promise<SyncResult> {
  const status = getSteamStatus();
  if (!status.available) {
    return { synced: 0, checked: 0, error: status.error };
  }

  const published = listWorkshopItems().filter((i) => i.publishedFileId);
  if (published.length === 0) return { synced: 0, checked: 0 };

  const live = await getLiveMetadataBatch(
    published.map((i) => i.publishedFileId!) as string[]
  );

  let synced = 0;
  for (const item of published) {
    const meta = live[item.publishedFileId!];
    if (!meta) continue;
    upsertWorkshopItem({
      ...item,
      title: meta.title || item.title,
      description: meta.description ?? item.description,
      tags: meta.tags && meta.tags.length ? meta.tags : item.tags,
      visibility: meta.visibility || item.visibility,
      // Use Steam's real last-updated time (unix seconds -> ms) as the sort key
      // so the list matches the actual Workshop ordering.
      lastPublishedAt: meta.timeUpdated
        ? meta.timeUpdated * 1000
        : item.lastPublishedAt,
    });
    synced++;
  }

  return { synced, checked: published.length };
}

/**
 * For reskin packs, mirror the published file id into reskinpack.json so the
 * link survives even if app data is cleared. (Preview stays in app data only.)
 */
function mirrorWorkshopId(req: PublishRequest, publishedFileId: string): void {
  if (req.kind !== "reskin-pack" || !req.gameFolder || !req.packName) return;
  try {
    const packPath = path.join(
      getReskinpacksFolder(req.gameFolder),
      req.packName
    );
    const pack = readReskinPack(packPath);
    if (pack && pack["workshop-id"] !== publishedFileId) {
      pack["workshop-id"] = publishedFileId;
      writeReskinPack(packPath, pack);
    }
  } catch (error) {
    console.error("Error mirroring workshop id into reskinpack.json:", error);
  }
}
