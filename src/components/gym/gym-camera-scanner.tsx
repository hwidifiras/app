"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, CameraOff, X } from "lucide-react";
import type { IScannerControls } from "@zxing/browser";

export function GymCameraScanner({ onScan, disabled = false }: { onScan: (value: string) => void; disabled?: boolean }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const scannedRef = useRef(false);
  const [open, setOpen] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function stopScanner() {
    controlsRef.current?.stop();
    controlsRef.current = null;
    setOpen(false);
    setStarting(false);
  }

  async function startScanner() {
    if (disabled || starting) return;
    setOpen(true);
    setStarting(true);
    setError(null);
    scannedRef.current = false;
    try {
      const { BrowserQRCodeReader } = await import("@zxing/browser");
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      if (!videoRef.current) throw new Error("Aperçu caméra indisponible");
      const reader = new BrowserQRCodeReader(undefined, { delayBetweenScanAttempts: 150 });
      controlsRef.current = await reader.decodeFromConstraints(
        { video: { facingMode: { ideal: "environment" } }, audio: false },
        videoRef.current,
        (result, _scanError, controls) => {
          if (!result || scannedRef.current) return;
          scannedRef.current = true;
          const value = result.getText().trim();
          controls.stop();
          controlsRef.current = null;
          setOpen(false);
          onScan(value);
        },
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Impossible d'ouvrir la caméra");
      stopScanner();
    } finally {
      setStarting(false);
    }
  }

  useEffect(() => () => controlsRef.current?.stop(), []);

  return (
    <div>
      <button type="button" className="btn btn-ghost h-11 w-full sm:w-auto" disabled={disabled} onClick={() => void startScanner()}>
        <Camera className="size-4" /> Scanner avec la caméra
      </button>
      {error ? <p className="mt-2 text-xs text-red-700" role="alert"><CameraOff className="mr-1 inline size-3.5" />{error}</p> : null}
      {open ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-label="Scanner une carte d'accès">
          <div className="w-full max-w-lg overflow-hidden rounded-lg bg-black shadow-2xl">
            <div className="flex items-center justify-between bg-[#0B1220] px-4 py-3 text-white">
              <p className="text-sm font-semibold">Cadrez le QR de la carte</p>
              <button type="button" className="inline-flex size-9 items-center justify-center rounded-lg hover:bg-white/10" aria-label="Fermer la caméra" onClick={stopScanner}><X className="size-5" /></button>
            </div>
            <div className="relative aspect-[3/4] max-h-[70vh] bg-black sm:aspect-video">
              <video ref={videoRef} muted playsInline className="size-full object-cover" />
              <div className="pointer-events-none absolute inset-[16%] rounded-lg border-2 border-white shadow-[0_0_0_999px_rgba(0,0,0,0.25)]" />
              {starting ? <p className="absolute inset-x-0 bottom-5 text-center text-sm font-medium text-white">Ouverture de la caméra...</p> : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
