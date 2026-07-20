export type ReskinType =
  | "stick_attacker"
  | "stick_goalie"
  | "net"
  | "puck"
  | "rink_ice"
  | "jersey_torso"
  | "jersey_groin"
  | "legpad"
  | "helmet"
  | "goalie_mask"
  | "tape_attacker_blade"
  | "tape_attacker_shaft"
  | "tape_goalie_blade"
  | "tape_goalie_shaft";

export interface Reskin {
  type: ReskinType;
  name: string;
  path: string;
}

export interface ReskinPack {
  name: string;
  "unique-id": string;
  version: string;
  "pack-format": number;
  reskins: Reskin[];
  /** Steam Workshop published file id, set once the pack has been published. */
  "workshop-id"?: string;
}

export type WorkshopVisibility = "public" | "friends" | "private" | "unlisted";

/**
 * A publishable Steam Workshop item tracked by the app. Covers both reskin
 * packs (content = the pack folder) and generic uploads such as plugins
 * (content = any folder the user points at).
 */
export interface WorkshopItemRecord {
  /** Stable local identifier, independent of the Steam published file id. */
  localId: string;
  kind: "reskin-pack" | "generic";
  /** For reskin packs: the folder name under reskinpacks/. */
  packName?: string;
  /** For generic uploads: absolute path to the content folder. */
  contentPath?: string;
  /** Steam published file id (bigint serialized as string), once created. */
  publishedFileId?: string;
  title: string;
  description: string;
  tags: string[];
  visibility: WorkshopVisibility;
  /** Absolute path to the preview image, stored in app data (never inside content). */
  previewPath?: string;
  lastPublishedAt?: number;
}

/** Result of validating a Workshop preview image. */
export interface PreviewValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
  width?: number;
  height?: number;
  sizeBytes?: number;
  /** True when the image exceeds Steam's 1MB limit but can be auto-recompressed. */
  canRecompress?: boolean;
}

/** Live metadata pulled from the Steam Workshop for an existing item. */
export interface LiveWorkshopMetadata {
  publishedFileId: string;
  title: string;
  description: string;
  tags: string[];
  visibility: WorkshopVisibility;
  url: string;
  previewUrl?: string;
  timeUpdated: number;
}

export interface SteamStatus {
  available: boolean;
  error?: string;
  steamId64?: string;
  accountId?: number;
  personaName?: string;
}

export interface PublishResult {
  success: boolean;
  publishedFileId?: string;
  needsToAcceptAgreement?: boolean;
  /** URL of the item's Workshop page. */
  url?: string;
  error?: string;
}

export interface PackMetadata {
  name: string;
  author?: string;
  description?: string;
  version: string;
}

export interface AppConfig {
  gameFolder?: string;
  recentPacks?: string[];
}
