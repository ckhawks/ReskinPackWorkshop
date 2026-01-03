import * as path from "path";
import * as fs from "fs";
import imageSize from "image-size";
import {
  MIN_IMAGE_RESOLUTION,
  MAX_IMAGE_RESOLUTION,
  IMAGE_RESOLUTION_INCREMENT,
  VALID_IMAGE_FORMATS,
} from "./constants";

/**
 * Validate image file extension
 */
export function validateImageFormat(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return VALID_IMAGE_FORMATS.includes(ext);
}

/**
 * Validate image resolution (should be square, increment of 16, within bounds)
 */
export function validateImageResolution(width: number, height: number): boolean {
  // Check if square
  if (width !== height) {
    return false;
  }

  // Check if within bounds
  if (width < MIN_IMAGE_RESOLUTION || width > MAX_IMAGE_RESOLUTION) {
    return false;
  }

  // Check if increment of 16
  if (width % IMAGE_RESOLUTION_INCREMENT !== 0) {
    return false;
  }

  return true;
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
export async function validateImageFile(filePath: string): Promise<{
  valid: boolean;
  errors: string[];
}> {
  const errors: string[] = [];

  // Check file exists
  if (!fs.existsSync(filePath)) {
    errors.push("File does not exist");
    return { valid: false, errors };
  }

  // Check format
  if (!validateImageFormat(filePath)) {
    errors.push(`Invalid format. Only ${VALID_IMAGE_FORMATS.join(", ")} allowed`);
    return { valid: false, errors };
  }

  // Check dimensions
  try {
    const dimensions = await getImageDimensions(filePath);
    if (!dimensions) {
      errors.push("Could not read image dimensions");
    } else if (!validateImageResolution(dimensions.width, dimensions.height)) {
      const resolutionRange = `${MIN_IMAGE_RESOLUTION}-${MAX_IMAGE_RESOLUTION}px`;
      const increment = IMAGE_RESOLUTION_INCREMENT;
      errors.push(
        `Invalid resolution: ${dimensions.width}x${dimensions.height}. Image must be square (${resolutionRange}), in increments of ${increment}px (e.g., 512, 1024, 2048)`
      );
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
