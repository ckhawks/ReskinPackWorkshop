import * as fs from "fs";
import * as path from "path";
import {
  PUCK_APP_ID,
  WORKSHOP_PREVIEW_MAX_BYTES,
  WORKSHOP_PREVIEW_MAX_DIMENSION,
  WORKSHOP_PREVIEW_FORMATS,
} from "./constants";
import {
  WorkshopVisibility,
  PreviewValidation,
  LiveWorkshopMetadata,
  SteamStatus,
  PublishResult,
} from "../types";

/**
 * Thin wrapper around steamworks.js for publishing Puck Workshop items.
 *
 * All of this runs in the Electron main process. The Steam client must be
 * running and logged in; we initialize against Puck's App ID so uploads land
 * in the Puck Workshop.
 */

// steamworks.js is a native module; require lazily so the app still boots if
// the binary is missing (e.g. an unusual platform) and we can surface a clean
// error instead of crashing at startup.
type SteamClient = any;
let steamworks: any = null;
let client: SteamClient | null = null;
let initError: string | null = null;

function loadSteamworks(): any {
  if (steamworks) return steamworks;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  steamworks = require("steamworks.js");
  return steamworks;
}

/**
 * Initialize (or reuse) the Steam client. Safe to call repeatedly. Returns a
 * status object rather than throwing, so the UI can guide the user (e.g. "start
 * Steam and log in").
 */
export function initSteam(): SteamStatus {
  if (client) {
    return currentStatus();
  }
  try {
    const sw = loadSteamworks();
    client = sw.init(PUCK_APP_ID);
    initError = null;
    return currentStatus();
  } catch (error) {
    client = null;
    initError = String(error);
    return {
      available: false,
      error:
        "Could not connect to Steam. Make sure the Steam client is running and you are logged in, then try again.",
    };
  }
}

function currentStatus(): SteamStatus {
  if (!client) {
    return {
      available: false,
      error: initError || "Steam is not connected.",
    };
  }
  try {
    const me = client.localplayer.getSteamId();
    return {
      available: true,
      steamId64: me.steamId64.toString(),
      accountId: me.accountId,
      personaName: client.localplayer.getName(),
    };
  } catch (error) {
    return { available: true };
  }
}

export function getSteamStatus(): SteamStatus {
  if (!client) {
    // Try once; the user may have started Steam since app launch.
    return initSteam();
  }
  return currentStatus();
}

// ---------------------------------------------------------------------------
// Visibility mapping between our string enum and steamworks.js's numeric enum.
// ---------------------------------------------------------------------------

const VISIBILITY_TO_NUM: Record<WorkshopVisibility, number> = {
  public: 0,
  friends: 1,
  private: 2,
  unlisted: 3,
};

function visibilityFromNum(n: number): WorkshopVisibility {
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

// ---------------------------------------------------------------------------
// Puck build number detection (offered as a suggested tag).
// ---------------------------------------------------------------------------

/**
 * Read Puck's in-game build number (e.g. "1153" for build B1153) from the
 * Unity `bundleVersion` field in `Puck_Data/globalgamemanagers`. This is the
 * number Puck shows and that Workshop tags use — NOT Steam's depot buildid.
 *
 * `bundleVersion` is stored as a length-prefixed ASCII string. Puck's build
 * numbers are plain integers, while the app-version strings alongside it contain
 * a dot ("1.0"), so we return the first pure-digit length-prefixed string in the
 * file header. Returns the number as a string, or null if unavailable.
 */
export function detectPuckBuildId(gameFolderPath?: string): string | null {
  try {
    if (!gameFolderPath) return null;
    const ggm = path.join(gameFolderPath, "Puck_Data", "globalgamemanagers");
    if (!fs.existsSync(ggm)) return null;

    const fd = fs.openSync(ggm, "r");
    const buf = Buffer.alloc(16384);
    const bytesRead = fs.readSync(fd, buf, 0, buf.length, 0);
    fs.closeSync(fd);
    const data = buf.subarray(0, bytesRead);

    for (let i = 0; i + 4 < data.length; i++) {
      const len = data.readUInt32LE(i);
      if (len < 3 || len > 6 || i + 4 + len > data.length) continue;
      const s = data.subarray(i + 4, i + 4 + len);
      let allDigits = true;
      for (const b of s) {
        if (b < 0x30 || b > 0x39) {
          allDigits = false;
          break;
        }
      }
      if (allDigits) return s.toString("latin1");
    }
    return null;
  } catch (error) {
    console.error("Error detecting Puck build number:", error);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Preview image validation & recompression.
// ---------------------------------------------------------------------------

/**
 * Validate a candidate Workshop preview image: format, size (<=1MB), and
 * dimensions. Steam is lenient about dimensions but a roughly-square image
 * displays best, so a non-square image produces a warning, not an error.
 */
export function validatePreviewImage(imagePath: string): PreviewValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!fs.existsSync(imagePath)) {
    return { valid: false, errors: ["Preview image does not exist."], warnings };
  }

  const ext = path.extname(imagePath).toLowerCase();
  if (!WORKSHOP_PREVIEW_FORMATS.includes(ext)) {
    errors.push(
      `Preview must be one of: ${WORKSHOP_PREVIEW_FORMATS.join(", ")}.`
    );
  }

  const sizeBytes = fs.statSync(imagePath).size;
  let width: number | undefined;
  let height: number | undefined;
  try {
    const { nativeImage } = require("electron");
    const img = nativeImage.createFromPath(imagePath);
    const size = img.getSize();
    width = size.width;
    height = size.height;
    if (!width || !height) {
      warnings.push("Could not read the preview's dimensions.");
    } else if (width !== height) {
      warnings.push(
        `Preview is ${width}x${height}. A square image (e.g. 512x512) displays best on the Workshop.`
      );
    }
  } catch (error) {
    warnings.push("Could not read the preview's dimensions.");
  }

  const tooBig = sizeBytes > WORKSHOP_PREVIEW_MAX_BYTES;
  if (tooBig) {
    errors.push(
      `Preview is ${(sizeBytes / (1024 * 1024)).toFixed(
        2
      )}MB. Steam's limit is 1MB.`
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    width,
    height,
    sizeBytes,
    canRecompress: tooBig && ext !== ".gif",
  };
}

/**
 * Recompress an oversized preview image to fit under Steam's 1MB limit. Writes
 * the result to destPath (a .jpg). Downscales to WORKSHOP_PREVIEW_MAX_DIMENSION
 * then steps JPEG quality down until the file fits. Returns the written path.
 */
export function recompressPreviewImage(
  sourcePath: string,
  destPath: string
): { success: boolean; path?: string; sizeBytes?: number; error?: string } {
  try {
    const { nativeImage } = require("electron");
    let img = nativeImage.createFromPath(sourcePath);
    if (img.isEmpty()) {
      return { success: false, error: "Could not read the source image." };
    }

    const size = img.getSize();
    const longest = Math.max(size.width, size.height);
    if (longest > WORKSHOP_PREVIEW_MAX_DIMENSION) {
      const scale = WORKSHOP_PREVIEW_MAX_DIMENSION / longest;
      img = img.resize({
        width: Math.round(size.width * scale),
        height: Math.round(size.height * scale),
        quality: "best",
      });
    }

    const dir = path.dirname(destPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    // Step quality down until we're comfortably under the limit.
    for (const quality of [90, 80, 70, 60, 50, 40, 30]) {
      const buffer = img.toJPEG(quality);
      if (buffer.length <= WORKSHOP_PREVIEW_MAX_BYTES) {
        fs.writeFileSync(destPath, buffer);
        return { success: true, path: destPath, sizeBytes: buffer.length };
      }
    }

    // Even at low quality it didn't fit: downscale harder and try once more.
    img = img.resize({ width: 512, height: 512, quality: "good" });
    const buffer = img.toJPEG(50);
    fs.writeFileSync(destPath, buffer);
    return {
      success: buffer.length <= WORKSHOP_PREVIEW_MAX_BYTES,
      path: destPath,
      sizeBytes: buffer.length,
      error:
        buffer.length > WORKSHOP_PREVIEW_MAX_BYTES
          ? "Could not shrink the image under 1MB. Try a simpler preview image."
          : undefined,
    };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// ---------------------------------------------------------------------------
// Create / update / query Workshop items.
// ---------------------------------------------------------------------------

function itemUrl(publishedFileId: string): string {
  return `https://steamcommunity.com/sharedfiles/filedetails/?id=${publishedFileId}`;
}

/**
 * Create a brand new (empty) Workshop item and return its published file id.
 * Content is filled in by a subsequent publishItem() call.
 */
export async function createItem(): Promise<PublishResult> {
  const status = initSteam();
  if (!status.available || !client) {
    return { success: false, error: status.error };
  }
  try {
    const result = await client.workshop.createItem(PUCK_APP_ID);
    const id = result.itemId.toString();
    return {
      success: true,
      publishedFileId: id,
      needsToAcceptAgreement: result.needsToAcceptAgreement,
      url: itemUrl(id),
    };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

export interface PublishOptions {
  publishedFileId: string;
  contentPath: string;
  title?: string;
  description?: string;
  previewPath?: string;
  tags?: string[];
  visibility?: WorkshopVisibility;
  changeNote?: string;
}

/**
 * Push content/metadata to an existing Workshop item. Only fields that are
 * provided are sent, so callers can update just the metadata (or just the
 * content) without clobbering the rest.
 */
export async function publishItem(
  options: PublishOptions
): Promise<PublishResult> {
  const status = initSteam();
  if (!status.available || !client) {
    return { success: false, error: status.error };
  }

  if (!fs.existsSync(options.contentPath)) {
    return { success: false, error: "Content folder does not exist." };
  }

  const update: any = {
    contentPath: options.contentPath,
  };
  if (options.title !== undefined) update.title = options.title;
  if (options.description !== undefined)
    update.description = options.description;
  if (options.previewPath) update.previewPath = options.previewPath;
  if (options.tags) update.tags = options.tags;
  if (options.visibility !== undefined)
    update.visibility = VISIBILITY_TO_NUM[options.visibility];
  if (options.changeNote) update.changeNote = options.changeNote;

  try {
    const result = await client.workshop.updateItem(
      BigInt(options.publishedFileId),
      update,
      PUCK_APP_ID
    );
    const id = result.itemId.toString();
    return {
      success: true,
      publishedFileId: id,
      needsToAcceptAgreement: result.needsToAcceptAgreement,
      url: itemUrl(id),
    };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

/**
 * Fetch the current live metadata for an item straight from Steam, so the UI
 * can edit from what's actually published rather than a stale local copy.
 */
export async function getLiveMetadata(
  publishedFileId: string
): Promise<LiveWorkshopMetadata | null> {
  const status = initSteam();
  if (!status.available || !client) return null;
  try {
    const item = await client.workshop.getItem(BigInt(publishedFileId), {
      includeLongDescription: true,
    });
    if (!item) return null;
    return {
      publishedFileId: item.publishedFileId.toString(),
      title: item.title,
      description: item.description,
      tags: item.tags || [],
      visibility: visibilityFromNum(item.visibility),
      url: item.url || itemUrl(publishedFileId),
      previewUrl: item.previewUrl,
      timeUpdated: item.timeUpdated,
    };
  } catch (error) {
    console.error("Error fetching live workshop metadata:", error);
    return null;
  }
}

/**
 * Fetch current live metadata for many items in a single Steam query.
 * Returns a map keyed by published file id (string). Missing/failed items are
 * simply absent from the map.
 */
export async function getLiveMetadataBatch(
  publishedFileIds: string[]
): Promise<Record<string, LiveWorkshopMetadata>> {
  const out: Record<string, LiveWorkshopMetadata> = {};
  const status = initSteam();
  if (!status.available || !client || publishedFileIds.length === 0) return out;
  try {
    const ids = publishedFileIds.map((id) => BigInt(id));
    const res = await client.workshop.getItems(ids, {
      includeLongDescription: true,
    });
    for (const item of res.items || []) {
      if (!item) continue;
      const id = item.publishedFileId.toString();
      out[id] = {
        publishedFileId: id,
        title: item.title,
        description: item.description,
        tags: item.tags || [],
        visibility: visibilityFromNum(item.visibility),
        url: item.url || itemUrl(id),
        previewUrl: item.previewUrl,
        timeUpdated: item.timeUpdated,
      };
    }
  } catch (error) {
    console.error("Error batch-fetching workshop metadata:", error);
  }
  return out;
}

/**
 * List Puck Workshop items published by the currently logged-in user. Useful
 * for reconciling/importing items that exist on Steam but aren't yet tracked
 * locally.
 */
export async function listMyPublishedItems(): Promise<LiveWorkshopMetadata[]> {
  const status = initSteam();
  if (!status.available || !client || status.accountId === undefined) return [];
  try {
    const sw = loadSteamworks();
    const { UGCType, UserListType, UserListOrder } = sw.workshop || {};
    // Fall back to numeric enum values if the named enums aren't surfaced.
    const itemType = UGCType?.Items ?? 0;
    const listType = UserListType?.Published ?? 0;
    const sortOrder = UserListOrder?.LastUpdatedDesc ?? 3;

    const out: LiveWorkshopMetadata[] = [];
    let page = 1;
    // Steam paginates in blocks of 50; cap at a few pages defensively.
    for (let i = 0; i < 10; i++) {
      const res = await client.workshop.getUserItems(
        page,
        status.accountId,
        listType,
        itemType,
        sortOrder,
        { creator: PUCK_APP_ID, consumer: PUCK_APP_ID },
        { includeLongDescription: true }
      );
      const items = (res.items || []).filter(Boolean);
      for (const item of items) {
        out.push({
          publishedFileId: item.publishedFileId.toString(),
          title: item.title,
          description: item.description,
          tags: item.tags || [],
          visibility: visibilityFromNum(item.visibility),
          url: item.url || itemUrl(item.publishedFileId.toString()),
          previewUrl: item.previewUrl,
          timeUpdated: item.timeUpdated,
        });
      }
      if (out.length >= res.totalResults || items.length === 0) break;
      page++;
    }
    return out;
  } catch (error) {
    console.error("Error listing published workshop items:", error);
    return [];
  }
}
