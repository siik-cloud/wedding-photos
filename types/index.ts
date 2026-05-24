export interface Upload {
  id: string;
  file_name: string;
  original_file_name: string;
  file_type: "image" | "video" | "other";
  mime_type: string;
  file_size: number;
  storage_path: string;
  guest_name: string | null;
  created_at: string;
  deleted_at: string | null;
  /**
   * Storage path for the pre-generated video thumbnail JPEG.
   * Requires DB migration: ALTER TABLE uploads ADD COLUMN IF NOT EXISTS thumbnail_path TEXT;
   * null for images or videos uploaded before thumbnail generation was added.
   */
  thumbnail_path: string | null;
}

export interface UploadWithUrl extends Upload {
  url: string;
  downloadUrl: string;
  /** Signed URL for the thumbnail image. Only present for videos with a thumbnail. */
  thumbnailUrl?: string;
}

export interface Settings {
  public_gallery_enabled: boolean;
}

export interface AdminStats {
  totalFiles: number;
  totalImages: number;
  totalVideos: number;
  totalSizeBytes: number;
}

export interface InitUploadRequest {
  fileName: string;
  fileSize: number;
  mimeType: string;
  guestName: string | null;
}

export interface InitUploadResponse {
  signedUrl: string;
  storagePath: string;
}

export interface ConfirmUploadRequest {
  storagePath: string;
  originalFileName: string;
  fileSize: number;
  mimeType: string;
  guestName: string | null;
  /** Storage path of the pre-generated thumbnail JPEG, if available. */
  thumbnailPath?: string | null;
}
