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
