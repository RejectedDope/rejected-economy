"use client";

import { useCallback, useRef, useState } from "react";
import { useDropzone, type FileRejection } from "react-dropzone";
import { Upload, FileText, Image as ImageIcon, AlertTriangle, X, Loader2, Camera } from "lucide-react";
import { cn } from "@/lib/utils";

export type SupportedFileType = "csv" | "xlsx" | "screenshot";

export type UploadedFile = {
  file: File;
  type: SupportedFileType;
  id: string;
};

interface FileUploaderProps {
  onFilesAccepted: (files: UploadedFile[]) => void;
  disabled?: boolean;
  maxFiles?: number;
}

const ACCEPTED_TYPES = {
  "text/csv": [".csv"],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
  "application/vnd.ms-excel": [".xls"],
  "image/png": [".png"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/webp": [".webp"],
};

const MAX_SIZE_MB = 20;

function detectFileType(file: File): SupportedFileType {
  if (file.type.startsWith("image/")) return "screenshot";
  if (file.name.endsWith(".csv") || file.type === "text/csv") return "csv";
  return "xlsx";
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function FileTypeIcon({ type }: { type: SupportedFileType }) {
  if (type === "screenshot") return <ImageIcon className="h-4 w-4 text-blue-400" />;
  return <FileText className="h-4 w-4 text-emerald-400" />;
}

export function FileUploader({ onFilesAccepted, disabled, maxFiles = 5 }: FileUploaderProps) {
  const [queuedFiles, setQueuedFiles] = useState<UploadedFile[]>([]);
  const [rejections, setRejections] = useState<string[]>([]);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const cameraRef = useRef<HTMLInputElement>(null);

  const onDrop = useCallback(
    (accepted: File[], rejected: FileRejection[]) => {
      setRejections([]);

      const newRejections: string[] = rejected.map(
        (r) => `${r.file.name}: ${r.errors.map((e) => e.message).join(", ")}`
      );
      if (newRejections.length) setRejections(newRejections);

      const newFiles: UploadedFile[] = accepted.slice(0, maxFiles).map((file) => ({
        file,
        type: detectFileType(file),
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      }));

      setQueuedFiles((prev) => {
        const combined = [...prev, ...newFiles].slice(0, maxFiles);
        return combined;
      });
    },
    [maxFiles]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED_TYPES,
    maxSize: MAX_SIZE_MB * 1024 * 1024,
    disabled: disabled || processing,
    multiple: true,
  });

  function removeFile(id: string) {
    setQueuedFiles((prev) => prev.filter((f) => f.id !== id));
  }

  function addFiles(files: File[]) {
    const newFiles: UploadedFile[] = files.map((file) => ({
      file,
      type: detectFileType(file),
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    }));
    setQueuedFiles((prev) => [...prev, ...newFiles].slice(0, maxFiles));
  }

  function handleCameraChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length) addFiles(files);
    if (cameraRef.current) cameraRef.current.value = "";
  }

  function handleImport() {
    if (!queuedFiles.length) return;
    setProcessing(true);
    setProgress(0);
    // Simulate incremental progress ticks while parent processes
    const interval = setInterval(() => {
      setProgress((p) => {
        if (p >= 90) { clearInterval(interval); return p; }
        return p + Math.random() * 15;
      });
    }, 120);
    onFilesAccepted(queuedFiles);
    setQueuedFiles([]);
    // Progress completes when parent sets processing=false via re-render
    clearInterval(interval);
    setProgress(100);
    setTimeout(() => { setProcessing(false); setProgress(0); }, 400);
  }

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        {...getRootProps()}
        className={cn(
          "relative cursor-pointer rounded-xl border-2 border-dashed px-8 py-12 text-center transition-all",
          isDragActive
            ? "border-[#E935C1] bg-[#E935C1]/5"
            : "border-zinc-700 bg-zinc-900/50 hover:border-zinc-500 hover:bg-zinc-900",
          (disabled || processing) && "cursor-not-allowed opacity-50"
        )}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center gap-3">
          {processing ? (
            <Loader2 className="h-8 w-8 animate-spin text-[#E935C1]" />
          ) : (
            <Upload className="h-8 w-8 text-zinc-600" />
          )}
          <div>
            <p className="font-semibold text-zinc-200">
              {isDragActive ? "Drop files here" : "Drop inventory files here"}
            </p>
            <p className="mt-1 text-sm text-zinc-500">
              CSV · XLSX · Screenshots (PNG, JPG) — up to {MAX_SIZE_MB} MB each
            </p>
          </div>
          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="rounded border border-zinc-700 px-4 py-1.5 text-xs font-semibold text-zinc-300 transition-colors hover:border-zinc-500 hover:text-zinc-100"
            >
              Browse files
            </button>
            {/* Mobile camera capture — hidden on desktop via CSS, always rendered for accessibility */}
            <button
              type="button"
              className="flex items-center gap-1.5 rounded border border-zinc-700 px-3 py-1.5 text-xs font-semibold text-zinc-300 transition-colors hover:border-zinc-500 hover:text-zinc-100 sm:hidden"
              onClick={() => cameraRef.current?.click()}
            >
              <Camera className="h-3.5 w-3.5" />
              Camera
            </button>
            <input
              ref={cameraRef}
              type="file"
              accept="image/*"
              capture="environment"
              multiple
              className="hidden"
              onChange={handleCameraChange}
            />
          </div>
        </div>
      </div>

      {/* Format guide */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          {
            icon: <FileText className="h-4 w-4 text-emerald-400" />,
            label: "eBay CSV Export",
            tip: "Seller Hub → Active Listings → Download report",
          },
          {
            icon: <FileText className="h-4 w-4 text-pink-400" />,
            label: "Poshmark CSV",
            tip: "Account → My Inventory → Export",
          },
          {
            icon: <ImageIcon className="h-4 w-4 text-blue-400" />,
            label: "Screenshots",
            tip: "Listing page screenshots → staged for manual review",
          },
        ].map((item) => (
          <div
            key={item.label}
            className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-4 py-3"
          >
            <div className="flex items-center gap-2">
              {item.icon}
              <span className="text-xs font-bold text-zinc-300">{item.label}</span>
            </div>
            <p className="mt-1 text-xs text-zinc-600">{item.tip}</p>
          </div>
        ))}
      </div>

      {/* Rejection errors */}
      {rejections.length > 0 && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-400" />
            <div>
              <p className="text-xs font-bold text-red-400">Files rejected</p>
              <ul className="mt-1 space-y-0.5">
                {rejections.map((r, i) => (
                  <li key={i} className="text-xs text-red-300/80">
                    {r}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Queued files */}
      {queuedFiles.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-widest text-zinc-600">
            Ready to import
          </p>
          {queuedFiles.map((uf) => (
            <div
              key={uf.id}
              className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3"
            >
              <FileTypeIcon type={uf.type} />
              <div className="flex-1 overflow-hidden">
                <p className="truncate text-sm font-medium text-zinc-200">{uf.file.name}</p>
                <p className="text-xs text-zinc-600">
                  {formatBytes(uf.file.size)} · {uf.type.toUpperCase()}
                </p>
              </div>
              <button
                onClick={() => removeFile(uf.id)}
                className="rounded p-1 text-zinc-600 transition-colors hover:text-zinc-300"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}

          {processing && (
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
              <div
                className="h-full rounded-full bg-[#E935C1] transition-all duration-200"
                style={{ width: `${Math.min(progress, 100)}%` }}
              />
            </div>
          )}
          <button
            onClick={handleImport}
            disabled={processing}
            className="w-full rounded-lg bg-[#E935C1] px-4 py-3 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {processing ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Processing…
              </span>
            ) : `Parse ${queuedFiles.length} file${queuedFiles.length > 1 ? "s" : ""}`}
          </button>
        </div>
      )}
    </div>
  );
}
