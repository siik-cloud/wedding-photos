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
}

export interface UploadWithUrl extends Upload {
  url: string;
  downloadUrl: string;
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
}
