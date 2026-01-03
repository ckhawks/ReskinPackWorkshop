import React, { useState } from "react";
import { Upload, X } from "lucide-react";
import { Reskin, ReskinType } from "../../types";
import { RESKIN_TYPES, RESKIN_TYPE_FOLDERS, getReskinTypeLabel } from "../../utils/constants";
import "./ReskinForm.css";

interface ReskinFormProps {
  gameFolder: string;
  packName: string;
  onAdd: (reskin: Reskin) => void;
  onCancel: () => void;
}

export default function ReskinForm({
  gameFolder,
  packName,
  onAdd,
  onCancel,
}: ReskinFormProps) {
  const [reskinType, setReskinType] = useState<ReskinType>(RESKIN_TYPES[0]);
  const [reskinName, setReskinName] = useState("");
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  async function validateAndSetImage(imagePath: string) {
    try {
      setSelectedImage(imagePath);
      setImagePreview(imagePath);
      setError(null);

      // Validate image
      const validation = await (window as any).electron.validateImage(imagePath);
      if (!validation.valid) {
        const errorMessage = validation.errors
          .map((err: string) => `• ${err}`)
          .join("\n");
        setError(`Image validation failed:\n${errorMessage}`);
      } else {
        setError(null);
      }
    } catch (err) {
      setError("Failed to validate image. Please try again.");
      console.error(err);
    }
  }

  async function handleSelectImage() {
    try {
      const imagePath = await (window as any).electron.selectImage();
      if (imagePath) {
        await validateAndSetImage(imagePath);
      }
    } catch (err) {
      setError("Failed to select image. Please try again.");
      console.error(err);
    }
  }

  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }

  function handleDragLeave(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }

  async function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);

    // Try to get file path from items (Electron native drag-drop)
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      for (let i = 0; i < e.dataTransfer.items.length; i++) {
        const item = e.dataTransfer.items[i];
        if (item.kind === "file") {
          const file = item.getAsFile();
          if (file) {
            // Try to get the native file path first (works when dragging from file explorer in some Electron versions)
            const filePath = (file as any).path;
            if (filePath) {
              await validateAndSetImage(filePath);
              return;
            }

            // If no native path, read file as blob and save to temp directory
            try {
              const reader = new FileReader();
              reader.onload = async (event) => {
                if (!event.target?.result) return;

                const base64Data = (event.target.result as string).split(",")[1];
                const tempPath = await (window as any).electron.saveDroppedFile(
                  file.name,
                  base64Data
                );

                if (tempPath) {
                  await validateAndSetImage(tempPath);
                } else {
                  setError("Failed to save dropped file. Please use the Select Image button instead.");
                }
              };
              reader.onerror = () => {
                setError("Could not read dropped file. Please use the Select Image button instead.");
              };
              reader.readAsDataURL(file);
              return;
            } catch (err) {
              console.error("Error processing dropped file:", err);
            }
          }
        }
      }
    }

    // Fallback to files API
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      const filePath = (file as any).path;

      if (filePath) {
        await validateAndSetImage(filePath);
        return;
      }

      // Try to read the file from the files API
      try {
        const reader = new FileReader();
        reader.onload = async (event) => {
          if (!event.target?.result) return;

          const base64Data = (event.target.result as string).split(",")[1];
          const tempPath = await (window as any).electron.saveDroppedFile(
            file.name,
            base64Data
          );

          if (tempPath) {
            await validateAndSetImage(tempPath);
          } else {
            setError("Failed to save dropped file. Please use the Select Image button instead.");
          }
        };
        reader.onerror = () => {
          setError("Could not read dropped file. Please use the Select Image button instead.");
        };
        reader.readAsDataURL(file);
      } catch (err) {
        console.error("Error processing dropped file:", err);
        setError("Could not process dropped file. Please use the Select Image button instead.");
      }
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!reskinName.trim()) {
      setError("Reskin name is required");
      return;
    }

    if (!selectedImage) {
      setError("Please select an image");
      return;
    }

    try {
      setUploading(true);
      setError(null);

      // Generate image filename
      const imageName = `${reskinName.toLowerCase().replace(/\s+/g, "-")}.png`;

      // Copy image to pack
      const success = await (window as any).electron.copyImageToPack(
        gameFolder,
        packName,
        selectedImage,
        reskinType,
        imageName
      );

      if (!success) {
        setError("Failed to copy image to pack");
        return;
      }

      // Create reskin object
      const destFolder = RESKIN_TYPE_FOLDERS[reskinType];
      const reskinPath = `${destFolder}/${imageName}`;

      const newReskin: Reskin = {
        type: reskinType,
        name: reskinName,
        path: reskinPath,
      };

      onAdd(newReskin);

      // Reset form
      setReskinName("");
      setSelectedImage(null);
      setImagePreview(null);
    } catch (err) {
      setError("Failed to add reskin");
      console.error(err);
    } finally {
      setUploading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="reskin-form">
      <div className="form-grid">
        <div className="form-group">
          <label htmlFor="reskin-type">Type</label>
          <select
            id="reskin-type"
            value={reskinType}
            onChange={(e) => setReskinType(e.target.value as ReskinType)}
            disabled={uploading}
          >
            {RESKIN_TYPES.map((type) => (
              <option key={type} value={type}>
                {getReskinTypeLabel(type)}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="reskin-name">Name</label>
          <input
            id="reskin-name"
            type="text"
            placeholder="e.g., 'Carbon Red - No text'"
            value={reskinName}
            onChange={(e) => setReskinName(e.target.value)}
            disabled={uploading}
          />
        </div>
      </div>

      <div className="image-section">
        <div className="image-upload">
          <label>Image (Drag & Drop or Click)</label>
          <div
            className={`image-input-area ${dragOver ? "drag-over" : ""}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            {imagePreview && (
              <div className="image-preview">
                <img src={`file:///${imagePreview.replace(/\\/g, "/")}`} alt="preview" />
                <div className="preview-info">
                  <p className="preview-name">{selectedImage?.split("\\").pop()}</p>
                </div>
              </div>
            )}
            {!imagePreview && (
              <div className="image-placeholder">
                <Upload size={32} />
                <p>Drag & drop PNG image here</p>
                <p className="small-text">or click to select</p>
              </div>
            )}
            <button
              type="button"
              onClick={handleSelectImage}
              disabled={uploading}
              className="select-image-button"
            >
              {imagePreview ? "Change Image" : "Select Image"}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="error-message">
          <div className="error-header">
            <span>Validation Error</span>
            <button
              type="button"
              onClick={() => setError(null)}
              className="error-close"
            >
              <X size={16} />
            </button>
          </div>
          <p>{error}</p>
        </div>
      )}

      <div className="form-actions">
        <button
          type="button"
          onClick={onCancel}
          disabled={uploading}
          className="cancel-button"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={uploading || !reskinName.trim() || !selectedImage}
          className="submit-button"
        >
          {uploading ? "Adding..." : "Add Reskin"}
        </button>
      </div>
    </form>
  );
}
