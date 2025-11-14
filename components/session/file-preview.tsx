"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Eye,
  Download,
  X,
  FileText,
  Image as ImageIcon,
  Music,
  Video,
  File,
  Loader2,
} from "lucide-react";

interface FilePreviewProps {
  fileName: string;
  fileUrl: string;
  mimeType: string;
  size: number;
  onDownload: () => void;
}

export default function FilePreview({
  fileName,
  fileUrl,
  mimeType,
  size,
  onDownload,
}: FilePreviewProps) {
  const [showPreview, setShowPreview] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const getFileIcon = () => {
    if (mimeType.startsWith("image/")) return <ImageIcon className="h-4 w-4" />;
    if (mimeType.startsWith("audio/")) return <Music className="h-4 w-4" />;
    if (mimeType.startsWith("video/")) return <Video className="h-4 w-4" />;
    if (mimeType.includes("pdf") || mimeType.includes("document"))
      return <FileText className="h-4 w-4" />;
    return <File className="h-4 w-4" />;
  };

  const canPreview = () => {
    return (
      mimeType.startsWith("image/") ||
      mimeType.startsWith("audio/") ||
      mimeType.startsWith("video/") ||
      mimeType === "application/pdf" ||
      mimeType.includes("text/") ||
      mimeType.includes("json") ||
      mimeType.includes("csv") ||
      mimeType.includes("xml")
    );
  };

  const renderPreview = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="ml-2">Loading preview...</span>
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex items-center justify-center p-8 text-destructive">
          <span>Failed to load preview: {error}</span>
        </div>
      );
    }

    // Image preview
    if (mimeType.startsWith("image/")) {
      return (
        <div className="flex justify-center items-center bg-muted/30 rounded-sm p-2 sm:p-4 min-h-[150px] sm:min-h-[200px] overflow-auto">
          <img
            src={fileUrl}
            alt={fileName}
            className="max-w-full max-h-full object-contain rounded-sm shadow-sm"
            style={{
              maxHeight: "60vh",
              maxWidth: "100%",
              width: "auto",
              height: "auto",
            }}
            onLoad={(e) => {
              setLoading(false);
              // Auto-adjust container to content
              const img = e.target as HTMLImageElement;
              const container = img.parentElement;
              if (container && img.naturalWidth && img.naturalHeight) {
                const aspectRatio = img.naturalWidth / img.naturalHeight;
                container.style.aspectRatio = aspectRatio.toString();
              }
            }}
            onError={() => {
              setError("Failed to load image");
              setLoading(false);
            }}
          />
        </div>
      );
    }

    // Audio preview
    if (mimeType.startsWith("audio/")) {
      return (
        <div className="p-4">
          <audio
            controls
            className="w-full"
            onLoadStart={() => setLoading(true)}
            onCanPlay={() => setLoading(false)}
            onError={() => {
              setError("Failed to load audio");
              setLoading(false);
            }}
          >
            <source src={fileUrl} type={mimeType} />
            Your browser does not support the audio element.
          </audio>
        </div>
      );
    }

    // Video preview
    if (mimeType.startsWith("video/")) {
      return (
        <div className="flex justify-center bg-muted/30 rounded-sm p-2 sm:p-4">
          <video
            controls
            className="w-full max-h-[60vh] rounded-sm shadow-sm"
            style={{
              maxWidth: "100%",
              height: "auto",
            }}
            onLoadStart={() => setLoading(true)}
            onLoadedMetadata={(e) => {
              setLoading(false);
              // Auto-adjust container to video dimensions
              const video = e.target as HTMLVideoElement;
              const container = video.parentElement;
              if (container && video.videoWidth && video.videoHeight) {
                const aspectRatio = video.videoWidth / video.videoHeight;
                container.style.aspectRatio = aspectRatio.toString();
              }
            }}
            onError={() => {
              setError("Failed to load video");
              setLoading(false);
            }}
          >
            <source src={fileUrl} type={mimeType} />
            Your browser does not support the video element.
          </video>
        </div>
      );
    }

    // PDF preview
    if (mimeType === "application/pdf") {
      return (
        <div
          className="relative bg-muted/30 rounded-sm"
          style={{ height: "60vh", minHeight: "300px" }}
        >
          <iframe
            src={`${fileUrl}#view=FitH`}
            className="w-full h-full rounded-sm border"
            title={fileName}
            style={{
              minHeight: "300px",
            }}
            onLoad={() => setLoading(false)}
            onError={() => {
              setError("Failed to load PDF");
              setLoading(false);
            }}
          />
        </div>
      );
    }

    // Text/CSV/JSON preview
    if (
      mimeType.includes("text/") ||
      mimeType.includes("json") ||
      mimeType.includes("csv") ||
      mimeType.includes("xml")
    ) {
      return (
        <div className="h-64 overflow-auto">
          <iframe
            src={fileUrl}
            className="w-full h-full rounded-sm border"
            title={fileName}
            onLoad={() => setLoading(false)}
            onError={() => {
              setError("Failed to load text content");
              setLoading(false);
            }}
          />
        </div>
      );
    }

    return (
      <div className="flex items-center justify-center p-8 text-muted-foreground">
        <span>Preview not available for this file type</span>
      </div>
    );
  };

  const handlePreview = () => {
    if (!fileUrl) {
      setError("No file URL available");
      return;
    }
    setShowPreview(true);
    setLoading(false);
    setError(null);
  };

  return (
    <>
      {canPreview() && (
        <Button
          size="sm"
          variant="ghost"
          onClick={handlePreview}
          className="h-8 w-8 p-0 hover:bg-muted/50"
          title="Preview file"
        >
          <Eye className="h-4 w-4" />
        </Button>
      )}

      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-[95vw] max-h-[85vh] w-full sm:max-w-4xl overflow-hidden">
          <DialogHeader className="pb-2 flex-shrink-0">
            <DialogTitle className="flex items-center gap-2 text-sm sm:text-base break-words">
              {getFileIcon()}
              <span className="break-all text-left">{fileName}</span>
            </DialogTitle>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="secondary" className="text-xs px-2 py-0.5">
                {mimeType}
              </Badge>
              <span>{formatFileSize(size)}</span>
            </div>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-auto">{renderPreview()}</div>
          <DialogFooter className="pt-3 flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => setShowPreview(false)}
              className="w-full sm:w-auto order-2 sm:order-1"
            >
              Close
            </Button>
            <Button
              onClick={onDownload}
              className="w-full sm:w-auto order-1 sm:order-2"
            >
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
