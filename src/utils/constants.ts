import { ReskinType } from "../types";

export const RESKIN_TYPES: ReskinType[] = [
  "stick_attacker",
  "stick_goalie",
  "net",
  "puck",
  "rink_ice",
  "jersey_torso",
  "jersey_groin",
  "legpad",
  "helmet",
  "goalie_mask",
  "tape_attacker_blade",
  "tape_attacker_shaft",
  "tape_goalie_blade",
  "tape_goalie_shaft",
];

export const RESKIN_TYPE_LABELS: Record<ReskinType, string> = {
  stick_attacker: "Stick (Attacker)",
  stick_goalie: "Stick (Goalie)",
  net: "Net",
  puck: "Puck",
  rink_ice: "Rink Ice",
  jersey_torso: "Jersey (Torso)",
  jersey_groin: "Jersey (Groin)",
  legpad: "Leg Pad",
  helmet: "Helmet",
  goalie_mask: "Goalie Mask",
  tape_attacker_blade: "Tape (Attacker Blade)",
  tape_attacker_shaft: "Tape (Attacker Shaft)",
  tape_goalie_blade: "Tape (Goalie Blade)",
  tape_goalie_shaft: "Tape (Goalie Shaft)",
};

export const RESKIN_TYPE_FOLDERS: Record<ReskinType, string> = {
  stick_attacker: "textures/sticks/attacker",
  stick_goalie: "textures/sticks/goalie",
  net: "textures/net",
  puck: "textures/pucks",
  rink_ice: "textures/ice",
  jersey_torso: "textures/jersey",
  jersey_groin: "textures/jersey",
  legpad: "textures/legpad",
  helmet: "textures/helmet",
  goalie_mask: "textures/goalie-mask",
  tape_attacker_blade: "textures/tape/attacker-blade",
  tape_attacker_shaft: "textures/tape/attacker-shaft",
  tape_goalie_blade: "textures/tape/goalie-blade",
  tape_goalie_shaft: "textures/tape/goalie-shaft",
};

export const MIN_IMAGE_RESOLUTION = 512;
export const MAX_IMAGE_RESOLUTION = 2048;
export const IMAGE_RESOLUTION_INCREMENT = 16;
export const VALID_IMAGE_FORMATS = [".png"];

/**
 * Get the display label for a reskin type, handling unknown types gracefully
 */
export function getReskinTypeLabel(type: ReskinType | string): string {
  if (typeof type === "string" && type in RESKIN_TYPE_LABELS) {
    return RESKIN_TYPE_LABELS[type as ReskinType];
  }
  // For unknown types, format as "Unknown (type_name)"
  return `Unknown (${type})`;
}

export const PUCK_GAME_NAME = "Puck";
export const DEFAULT_GAME_PATH = "C:\\Program Files (x86)\\Steam\\steamapps\\common\\Puck";
export const RESKINPACKS_FOLDER = "reskinpacks";
