import React, { useEffect, useRef, useState } from 'react';
import { Camera, X, RefreshCw, AlertCircle, CheckCircle2, QrCode } from 'lucide-react';

interface CameraQrScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTableScanned: (tableNumber: number) => void;
  availableTables: number[];
}

export const CameraQrScannerModal: React.FC<CameraQrScannerModalProps> = ({
  isOpen,
  onClose,
  onTableScanned,
  availableTables,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState<boolean>(true);
  const [scannedTable, setScannedTable] = useState<number | null>(null);

  // Start camera when modal opens
  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      return;
    }

    startCamera();

    return () => {
      stopCamera();
    };
  }, [isOpen]);

  const startCamera = async () => {
    setCameraError(null);
    setHasPermission(null);
    setIsScanning(true);
    setScannedTable(null);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera access is not supported by your browser.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' }, // prefer rear camera on mobile
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        await videoRef.current.play();
      }
      setHasPermission(true);

      // Start BarcodeDetector scanning loop if supported
      initBarcodeDetector(videoRef.current);
    } catch (err: any) {
      console.warn('Camera access issue:', err);
      setHasPermission(false);
      setCameraError(
        err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError'
          ? 'Camera permission denied. Please allow camera access in your browser settings.'
          : err.message || 'Unable to access camera.'
      );
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  const handleDetected = (tableNumber: number) => {
    if (!isScanning) return;
    setIsScanning(false);
    setScannedTable(tableNumber);
    stopCamera();

    if (navigator.vibrate) {
      navigator.vibrate([80, 40, 80]);
    }

    setTimeout(() => {
      onTableScanned(tableNumber);
      onClose();
    }, 700);
  };

  // Modern BarcodeDetector API for real camera QR decoding
  const initBarcodeDetector = (videoElement: HTMLVideoElement | null) => {
    if (!videoElement) return;

    if ('BarcodeDetector' in window) {
      try {
        const barcodeDetector = new (window as any).BarcodeDetector({
          formats: ['qr_code'],
        });

        const detectFrame = async () => {
          if (!streamRef.current || !videoRef.current) return;
          try {
            const barcodes = await barcodeDetector.detect(videoRef.current);
            if (barcodes.length > 0) {
              const rawValue = barcodes[0].rawValue || '';
              // Match ?table=N or T-N or simply N
              const match =
                rawValue.match(/[?&]table=(\d+)/i) ||
                rawValue.match(/T-(\d+)/i) ||
                rawValue.match(/table[:\s]+(\d+)/i);

              if (match && match[1]) {
                const detectedNum = parseInt(match[1], 10);
                if (!isNaN(detectedNum) && detectedNum >= 1 && detectedNum <= 10) {
                  handleDetected(detectedNum);
                  return;
                }
              }
            }
          } catch {
            // Frame processing retry
          }
          if (streamRef.current) {
            requestAnimationFrame(detectFrame);
          }
        };

        requestAnimationFrame(detectFrame);
      } catch (e) {
        console.log('BarcodeDetector not initialized:', e);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="relative w-full max-w-md bg-slate-900 text-white rounded-3xl shadow-2xl border border-slate-800 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-amber-500" />
            <div>
              <h3 className="font-bold text-sm text-white">Scan Table QR Code</h3>
              <p className="text-[11px] text-slate-400">Point your camera at the table QR stand</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Viewfinder Window */}
        <div className="relative w-full aspect-square bg-black overflow-hidden flex items-center justify-center">
          {hasPermission && (
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              muted
              playsInline
            />
          )}

          {/* Scanner targeting reticle */}
          {hasPermission && isScanning && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none p-12">
              <div className="relative w-56 h-56 border-2 border-amber-400/80 rounded-2xl">
                {/* 4 Corner Markers */}
                <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-amber-400 rounded-tl-lg" />
                <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-amber-400 rounded-tr-lg" />
                <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-amber-400 rounded-bl-lg" />
                <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-amber-400 rounded-br-lg" />

                {/* Animated scanning laser line */}
                <div className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-amber-400 to-transparent shadow-[0_0_12px_rgba(251,191,36,0.9)] animate-pulse top-1/2 -translate-y-1/2" />
              </div>
            </div>
          )}

          {/* Scanned Confirmation Overlay */}
          {scannedTable && (
            <div className="absolute inset-0 bg-emerald-950/85 backdrop-blur-xs flex flex-col items-center justify-center p-6 text-center animate-fade-in">
              <CheckCircle2 className="w-14 h-14 text-emerald-400 mb-2" />
              <h4 className="text-xl font-black text-white">Table #{scannedTable} Detected!</h4>
              <p className="text-xs text-emerald-200 mt-1">
                Opening fresh customer menu for Table #{scannedTable}...
              </p>
            </div>
          )}

          {/* Fallback / Permission Denied */}
          {cameraError && (
            <div className="p-6 text-center space-y-3 max-w-xs">
              <AlertCircle className="w-10 h-10 text-amber-400 mx-auto" />
              <p className="text-xs text-slate-300 leading-relaxed">{cameraError}</p>
              <button
                onClick={startCamera}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Retry Camera Access
              </button>
            </div>
          )}
        </div>

        {/* Quick Select Table QR Stand Simulator */}
        <div className="p-4 bg-slate-900 border-t border-slate-800 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-slate-300 flex items-center gap-1.5">
              <QrCode className="w-3.5 h-3.5 text-amber-500" />
              Select Table QR to Simulate Scan:
            </span>
            <span className="text-[11px] text-slate-500">Tap table number</span>
          </div>

          <div className="grid grid-cols-5 gap-2">
            {availableTables.map((tNum) => (
              <button
                key={tNum}
                onClick={() => handleDetected(tNum)}
                className="py-2 px-1 rounded-xl bg-slate-800 hover:bg-amber-600 hover:text-white border border-slate-700 text-xs font-bold transition-all text-slate-200 cursor-pointer flex flex-col items-center justify-center"
              >
                <span className="text-[10px] text-slate-400">Table</span>
                <span className="text-sm font-extrabold">#{tNum}</span>
              </button>
            ))}
          </div>

          <p className="text-[11px] text-slate-400 text-center pt-1">
            Point at any QR stand on the table or tap a table number to open the menu immediately.
          </p>
        </div>
      </div>
    </div>
  );
};
