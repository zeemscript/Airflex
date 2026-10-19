/**
 * StorageProvider.ts — issue #248
 *
 * Defines the interface every storage backend must satisfy.  The KYC upload
 * route calls only this interface; the concrete implementation is chosen at
 * server startup via the STORAGE_PROVIDER env flag.
 *
 * Implementations:
 *   S3StorageProvider   — default, uses an S3-compatible object store
 *   LocalStorageProvider — development fallback, writes to the local filesystem
 */

import type { Readable } from "stream";

export interface UploadOptions {
  /** MIME type of the file, e.g. "image/jpeg" */
  contentType: string;
  /** Arbitrary key-value metadata stored alongside the object */
  metadata?: Record<string, string>;
}

export interface UploadResult {
  /**
   * The object store key (not a filesystem path).
   * Stored in `users.kyc_document_path`.
   * Example: "kyc/2024/07/abcd-1234.jpg"
   */
  key: string;
}

export interface StorageProvider {
  /**
   * Uploads a readable stream and returns the object store key.
   *
   * @param key    Destination key inside the bucket / directory.
   * @param stream Readable stream of file contents.
   * @param opts   Content-type and optional metadata.
   */
  upload(key: string, stream: Readable, opts: UploadOptions): Promise<UploadResult>;

  /**
   * Deletes an object by key.  Used when a KYC submission is superseded.
   * Implementations should not throw if the key does not exist.
   */
  delete(key: string): Promise<void>;
}
