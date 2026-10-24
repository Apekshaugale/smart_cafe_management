import React from 'react';
import { X, Printer, ExternalLink, QrCode } from 'lucide-react';

interface QrCodeModalProps {
  tableNumber: number;
  isOpen: boolean;
  onClose: () => void;
  onSimulateScan: (tableNumber: number) => void;
}

export const QrCodeModal: React.FC<QrCodeModalProps> = ({
  tableNumber,
  isOpen,
  onClose,
  onSimulateScan,
}) => {
  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <QrCode className="w-5 h-5 text-amber-600" />
            <span className="font-bold text-slate-800 text-sm">Table #{tableNumber} QR Card</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Card Body - Restaurant Table Stand Style */}
        <div className="p-6 text-center bg-radial from-amber-50/50 via-white to-slate-50">
          <div className="inline-block p-4 bg-white rounded-xl shadow-md border border-amber-200 mb-4">
            <div className="w-48 h-48 mx-auto relative flex items-center justify-center bg-white p-2 border-4 border-slate-900 rounded-lg">
              {/* Scalable Vector QR Code Graphic */}
              <svg viewBox="0 0 100 100" className="w-full h-full text-slate-900">
                {/* 3 Corner Finder Markers */}
                <rect x="5" y="5" width="28" height="28" fill="currentColor" rx="4" />
                <rect x="9" y="9" width="20" height="20" fill="white" rx="2" />
                <rect x="13" y="13" width="12" height="12" fill="currentColor" rx="1" />

                <rect x="67" y="5" width="28" height="28" fill="currentColor" rx="4" />
                <rect x="71" y="9" width="20" height="20" fill="white" rx="2" />
                <rect x="75" y="13" width="12" height="12" fill="currentColor" rx="1" />

                <rect x="5" y="67" width="28" height="28" fill="currentColor" rx="4" />
                <rect x="9" y="71" width="20" height="20" fill="white" rx="2" />
                <rect x="13" y="75" width="12" height="12" fill="currentColor" rx="1" />

                {/* Timing patterns & decorative modules */}
                <rect x="36" y="8" width="5" height="5" fill="currentColor" />
                <rect x="44" y="8" width="5" height="5" fill="currentColor" />
                <rect x="52" y="8" width="5" height="5" fill="currentColor" />
                <rect x="60" y="8" width="5" height="5" fill="currentColor" />

                <rect x="8" y="36" width="5" height="5" fill="currentColor" />
                <rect x="8" y="44" width="5" height="5" fill="currentColor" />
                <rect x="8" y="52" width="5" height="5" fill="currentColor" />
                <rect x="8" y="60" width="5" height="5" fill="currentColor" />

                {/* Central QR Data Matrix blocks */}
                <rect x="38" y="38" width="8" height="8" fill="currentColor" />
                <rect x="54" y="38" width="8" height="8" fill="currentColor" />
                <rect x="46" y="50" width="8" height="8" fill="currentColor" />
                <rect x="62" y="54" width="8" height="8" fill="currentColor" />
                <rect x="38" y="66" width="6" height="6" fill="currentColor" />
                <rect x="50" y="66" width="8" height="6" fill="currentColor" />
                <rect x="64" y="70" width="6" height="6" fill="currentColor" />
                <rect x="76" y="44" width="8" height="8" fill="currentColor" />
                <rect x="86" y="56" width="6" height="6" fill="currentColor" />
                <rect x="76" y="68" width="10" height="6" fill="currentColor" />
                <rect x="80" y="80" width="12" height="10" fill="currentColor" />
                <rect x="40" y="82" width="18" height="8" fill="currentColor" />
                <rect x="20" y="40" width="8" height="6" fill="currentColor" />
                <rect x="22" y="52" width="6" height="8" fill="currentColor" />
              </svg>

              {/* Table center badge */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="bg-amber-600 text-white font-extrabold text-xs px-2 py-0.5 rounded shadow-sm border border-white">
                  T-{tableNumber}
                </div>
              </div>
            </div>
          </div>

          <h3 className="font-extrabold text-lg text-slate-800">Scan to Order</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
            Place this QR code on Table #{tableNumber}. Guests can scan with any camera app to view the live menu and order directly.
          </p>
          <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-800 rounded-md text-xs font-semibold">
            <span>Table #{tableNumber}</span>
            <span>·</span>
            <span>Floor {tableNumber <= 5 ? '1 (Inside)' : '2 (Terrace)'}</span>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center gap-2 px-5 py-4 bg-slate-50 border-t border-slate-100">
          <button
            onClick={() => {
              onSimulateScan(tableNumber);
              onClose();
            }}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-medium transition-colors cursor-pointer"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Simulate Scan (Order as Table #{tableNumber})
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center justify-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-medium transition-colors cursor-pointer"
            title="Print Tent Card"
          >
            <Printer className="w-3.5 h-3.5" />
            Print
          </button>
        </div>
      </div>
    </div>
  );
};
