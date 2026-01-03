import React, { useEffect } from "react";
import { X } from "lucide-react";
import "./ImagePreviewModal.css";

interface ImagePreviewModalProps {
  imageSrc: string;
  imageName: string;
  onClose: () => void;
}

export default function ImagePreviewModal({
  imageSrc,
  imageName,
  onClose,
}: ImagePreviewModalProps) {
  // Prevent background scrolling when modal is open
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "unset";
    };
  }, []);

  return (
    <div className="image-preview-overlay" onClick={onClose}>
      <div className="image-preview-modal" onClick={(e) => e.stopPropagation()}>
        <button className="image-preview-close" onClick={onClose} title="Close">
          <X size={32} />
        </button>
        <div className="image-preview-container">
          <img src={imageSrc} alt={imageName} />
        </div>
        <div className="image-preview-info">
          <p className="image-preview-name">{imageName}</p>
        </div>
      </div>
    </div>
  );
}
