"use client";

import { useCallback, useRef, useState } from "react";
import {
  processPhoto,
  revokePreview,
  uploadPhoto,
  type ProcessedPhoto,
} from "@/lib/client/photo-processing";

type UploadState =
  | { status: "idle" }
  | { status: "processing" }
  | { status: "preview"; processed: ProcessedPhoto }
  | { status: "uploading"; processed: ProcessedPhoto }
  | { status: "done"; url: string; key: string }
  | { status: "error"; message: string };

type Props = {
  onUploaded?: (result: { url: string; key: string }) => void;
  className?: string;
};

export function PhotoCapture({ onUploaded, className }: Props) {
  const [state, setState] = useState<UploadState>({ status: "idle" });
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setState({ status: "error", message: "Only image files are accepted." });
      return;
    }

    setState({ status: "processing" });
    try {
      const processed = await processPhoto(file);
      setState({ status: "preview", processed });
    } catch {
      setState({ status: "error", message: "Failed to process image." });
    }
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleCommit = useCallback(async () => {
    if (state.status !== "preview") return;
    const { processed } = state;
    setState({ status: "uploading", processed });
    try {
      const result = await uploadPhoto(processed.file);
      revokePreview(processed.previewUrl);
      setState({ status: "done", ...result });
      onUploaded?.(result);
    } catch (err) {
      setState({
        status: "error",
        message: err instanceof Error ? err.message : "Upload failed.",
      });
    }
  }, [state, onUploaded]);

  const reset = useCallback(() => {
    if (
      (state.status === "preview" || state.status === "uploading") &&
      "processed" in state
    ) {
      revokePreview(state.processed.previewUrl);
    }
    setState({ status: "idle" });
    if (inputRef.current) inputRef.current.value = "";
  }, [state]);

  return (
    <div className={className}>
      {/* Idle / drop zone */}
      {state.status === "idle" && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          className={`flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-8 transition-colors ${
            dragging
              ? "border-blue-500 bg-blue-50"
              : "border-gray-300 bg-gray-50"
          }`}
        >
          <p className="text-sm text-gray-600">
            Drag &amp; drop a photo, or
          </p>
          {/* Desktop file picker */}
          <label className="cursor-pointer rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
            Choose file
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={handleInputChange}
            />
          </label>
          {/* Mobile camera capture */}
          <label className="cursor-pointer rounded-lg border border-blue-600 px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50">
            Take photo
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              onChange={handleInputChange}
            />
          </label>
          <p className="text-xs text-gray-400">JPEG, PNG, or HEIC · max 20 MB</p>
        </div>
      )}

      {/* Processing */}
      {state.status === "processing" && (
        <div className="flex items-center justify-center p-8">
          <p className="text-sm text-gray-500">Processing image…</p>
        </div>
      )}

      {/* Preview before commit */}
      {(state.status === "preview" || state.status === "uploading") && (
        <div className="flex flex-col gap-4">
          <img
            src={state.processed.previewUrl}
            alt="Preview"
            className="w-full max-h-96 rounded-xl object-contain bg-gray-100"
          />
          <div className="flex gap-2">
            <button
              onClick={reset}
              disabled={state.status === "uploading"}
              className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Retake
            </button>
            <button
              onClick={handleCommit}
              disabled={state.status === "uploading"}
              className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {state.status === "uploading" ? "Uploading…" : "Use photo"}
            </button>
          </div>
        </div>
      )}

      {/* Done */}
      {state.status === "done" && (
        <div className="flex flex-col gap-3">
          <img
            src={state.url}
            alt="Uploaded"
            className="w-full max-h-96 rounded-xl object-contain bg-gray-100"
          />
          <button
            onClick={reset}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            Replace photo
          </button>
        </div>
      )}

      {/* Error */}
      {state.status === "error" && (
        <div className="flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-700">{state.message}</p>
          <button
            onClick={reset}
            className="self-start rounded-lg border border-red-300 px-3 py-1.5 text-sm text-red-700 hover:bg-red-100"
          >
            Try again
          </button>
        </div>
      )}
    </div>
  );
}
