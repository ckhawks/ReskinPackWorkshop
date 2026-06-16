import * as path from "path";
import * as fs from "fs";
import imageSize from "image-size";
import {
  MIN_IMAGE_RESOLUTION,
  MAX_IMAGE_RESOLUTION,
  IMAGE_RESOLUTION_INCREMENT,
  VALID_IMAGE_FORMATS,
  RINK_ICE_MIN_WIDTH,
  RINK_ICE_MAX_WIDTH,
} from "./constants";
import { ReskinType } from "../types";

/**
 * Validate image file extension
 */
export function validateImageFormat(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return VALID_IMAGE_FORMATS.includes(ext);
}

/**
 * Validate image resolution. Most reskins must be square; rink_ice uses a 2:1 aspect ratio.
 */
export function validateImageResolution(
  width: number,
  height: number,
  reskinType?: ReskinType
): { valid: boolean; error?: string } {
  if (reskinType === "rink_ice") {
    if (width !== height * 2) {
      return {
        valid: false,
        error: `Invalid resolution: ${width}x${height}. Rink ice must have a 2:1 aspect ratio (width = 2 × height), e.g. 8192x4096.`,
      };
    }
    if (width < RINK_ICE_MIN_WIDTH || width > RINK_ICE_MAX_WIDTH) {
      return {
        valid: false,
        error: `Invalid resolution: ${width}x${height}. Rink ice width must be between ${RINK_ICE_MIN_WIDTH} and ${RINK_ICE_MAX_WIDTH}px.`,
      };
    }
    if (width % IMAGE_RESOLUTION_INCREMENT !== 0) {
      return {
        valid: false,
        error: `Invalid resolution: ${width}x${height}. Dimensions must be in increments of ${IMAGE_RESOLUTION_INCREMENT}px.`,
      };
    }
    return { valid: true };
  }

  if (width !== height) {
    return {
      valid: false,
      error: `Invalid resolution: ${width}x${height}. Image must be square.`,
    };
  }
  if (width < MIN_IMAGE_RESOLUTION || width > MAX_IMAGE_RESOLUTION) {
    return {
      valid: false,
      error: `Invalid resolution: ${width}x${height}. Image must be between ${MIN_IMAGE_RESOLUTION} and ${MAX_IMAGE_RESOLUTION}px.`,
    };
  }
  if (width % IMAGE_RESOLUTION_INCREMENT !== 0) {
    return {
      valid: false,
      error: `Invalid resolution: ${width}x${height}. Dimensions must be in increments of ${IMAGE_RESOLUTION_INCREMENT}px (e.g., 512, 1024, 2048).`,
    };
  }
  return { valid: true };
}

/**
 * Get image dimensions using image-size
 */
export async function getImageDimensions(
  filePath: string
): Promise<{ width: number; height: number } | null> {
  try {
    const buffer = fs.readFileSync(filePath);
    const dimensions = imageSize(new Uint8Array(buffer));
    if (dimensions.width && dimensions.height) {
      return { width: dimensions.width, height: dimensions.height };
    }
    return null;
  } catch (error) {
    console.error("Error getting image dimensions:", error);
    return null;
  }
}

/**
 * Validate complete image file
 */
export async function validateImageFile(
  filePath: string,
  reskinType?: ReskinType
): Promise<{
  valid: boolean;
  errors: string[];
}> {
  const errors: string[] = [];

  if (!fs.existsSync(filePath)) {
    errors.push("File does not exist");
    return { valid: false, errors };
  }

  if (!validateImageFormat(filePath)) {
    errors.push(`Invalid format. Only ${VALID_IMAGE_FORMATS.join(", ")} allowed`);
    return { valid: false, errors };
  }

  try {
    const dimensions = await getImageDimensions(filePath);
    if (!dimensions) {
      errors.push("Could not read image dimensions");
    } else {
      const result = validateImageResolution(dimensions.width, dimensions.height, reskinType);
      if (!result.valid && result.error) {
        errors.push(result.error);
      }
    }
  } catch (error) {
    errors.push("Failed to validate image dimensions");
    console.error("Validation error:", error);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
