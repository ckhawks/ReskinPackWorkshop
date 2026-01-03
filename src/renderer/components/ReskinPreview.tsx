import React, { useState, useEffect } from "react";
import { Image, Edit as EditIcon, Trash2 } from "lucide-react";
import ConfirmDialog from "./ConfirmDialog";
import ImagePreviewModal from "./ImagePreviewModal";
import { Reskin } from "../../types";
import { getReskinTypeLabel } from "../../utils/constants";
import "./ReskinPreview.css";

interface ReskinPreviewProps {
  packPath: string;
  reskin: Reskin;
  onDelete: () => void;
  refreshTrigger?: number;
}

export default function ReskinPreview({
  packPath,
  reskin,
  onDelete,
  refreshTrigger = 0,
}: ReskinPreviewProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showImagePreview, setShowImagePreview] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageSrc, setImageSrc] = useState<string | null>(null);

  // Load image as data URL on mount or when refresh is triggered
  useEffect(() => {
    async function loadImage() {
      const fullPath = `${packPath}${packPath.endsWith("/") ? "" : "/"}${reskin.path}`;
      console.log("Loading image:", { fullPath, packPath, reskinPath: reskin.path });
      const dataUrl = await (window as any).electron.readImageAsDataUrl(fullPath);
      if (dataUrl) {
        setImageSrc(dataUrl);
      } else {
        setImageError("Image file not found");
      }
    }
    loadImage();
  }, [packPath, reskin.path, refreshTrigger]);

  return (
    <>
      {showDeleteConfirm && (
        <ConfirmDialog
          title="Delete Reskin?"
          message={
            <>
              Are you sure you want to delete <strong>{reskin.name}</strong>? This cannot be undone and the image will be deleted.
            </>
          }
          confirmText="Delete"
          cancelText="Cancel"
          isDangerous={true}
          onConfirm={() => {
            onDelete();
            setShowDeleteConfirm(false);
          }}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}

      {showImagePreview && imageSrc && (
        <ImagePreviewModal
          imageSrc={imageSrc}
          imageName={reskin.name}
          onClose={() => setShowImagePreview(false)}
        />
      )}

      <div className="reskin-preview-card">
        <div
          className="reskin-preview-image"
          onClick={() => imageLoaded && imageSrc && setShowImagePreview(true)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if ((e.key === "Enter" || e.key === " ") && imageLoaded && imageSrc) {
              setShowImagePreview(true);
            }
          }}
          style={{ cursor: imageLoaded ? "pointer" : "default" }}
        >
          {imageSrc && (
            <img
              src={imageSrc}
              alt={reskin.name}
              onLoad={() => {
                console.log("Image loaded successfully");
                setImageLoaded(true);
                setImageError(null);
              }}
              onError={(e) => {
                console.error("Image failed to load");
                setImageLoaded(false);
                setImageError("Failed to load image");
              }}
            />
          )}
          {!imageLoaded && (
            <div className={`reskin-preview-placeholder ${imageError ? "error" : ""}`}>
              <Image size={24} />
              {imageError && <p className="reskin-preview-error-text">{imageError}</p>}
            </div>
          )}
        </div>

        <div className="reskin-preview-info">
          <div className="reskin-preview-header">
            <h4>{reskin.name}</h4>
            <div className="reskin-preview-actions">
              <button
                onClick={() => {
                  const fullPath = `${packPath}${packPath.endsWith("/") ? "" : "/"}${reskin.path}`;
                  (window as any).electron.openWithDialog(fullPath);
                }}
                className="reskin-preview-edit"
                title="Open image with..."
              >
                <EditIcon size={16} />
              </button>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="reskin-preview-delete"
                title="Delete reskin"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
          <p className="reskin-preview-type">{getReskinTypeLabel(reskin.type)}</p>
          <p className="reskin-preview-path" title={reskin.path}>
            {reskin.path}
          </p>
        </div>
      </div>
    </>
  );
}
