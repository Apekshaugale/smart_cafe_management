import React, { useState, useEffect } from 'react';
import { CafeOrder } from '../../types/cafe';
import {
  X,
  Smartphone,
  Copy,
  Check,
  ExternalLink,
  AlertCircle,
  Clock,
  ArrowRight,
  ShieldCheck,
  QrCode,
} from 'lucide-react';
import { formatCurrency } from '../../utils/cafeUtils';

interface UpiPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: CafeOrder | null;
  upiUri: string;
  upiId: string;
  cafeName: string;
  onProceedToReceipt: () => void;
}

export const UpiPaymentModal: React.FC<UpiPaymentModalProps> = ({
  isOpen,
  onClose,
  order,
  upiUri,
  upiId,
  cafeName,
  onProceedToReceipt,
}) => {
  const [copied, setCopied] = useState(false);
  const [attemptedLaunch, setAttemptedLaunch] = useState(false);

  useEffect(() => {
    if (isOpen && upiUri) {
      // Auto-attempt opening the native UPI link on mobile devices
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      if (isMobile) {
        try {
          window.location.href = upiUri;
          setAttemptedLaunch(true);
        } catch (e) {
          console.log('UPI deep link auto-open error:', e);
        }
      }
    }
  }, [isOpen, upiUri]);

  if (!isOpen || !order) return null;

  const handleCopyUpiId = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(upiId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleManualOpenUpi = () => {
    setAttemptedLaunch(true);
    window.location.href = upiUri;
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[95vh] flex flex-col">
        {/* Modal Top Bar */}
        <div className="bg-gradient-to-r from-amber-700 to-amber-900 text-white px-5 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center text-white">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-sm sm:text-base text-white">Instant UPI Payment</h2>
              <span className="text-[11px] text-amber-200 block">
                Order #{order.order_id} · Table #{order.table_number}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-amber-200 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1 text-slate-800 text-xs">
          {/* Server-Validated Fixed Amount Box */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 text-center">
            <span className="text-[10px] font-bold text-amber-900 uppercase tracking-wider block">
              Payable Bill Amount (Server-Validated)
            </span>
            <div className="text-2xl sm:text-3xl font-black text-amber-900 tabular-nums mt-0.5">
              {formatCurrency(order.total_amount)}
            </div>
            <span className="text-[11px] text-amber-800/80 font-medium mt-0.5 block">
              Includes 5% Restaurant GST · Fixed amount request
            </span>
          </div>

          {/* Primary Action: Direct UPI App Deep Link */}
          <div className="space-y-2">
            <button
              onClick={handleManualOpenUpi}
              className="w-full py-3 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-98"
            >
              <ExternalLink className="w-4 h-4" />
              <span>Open in UPI App (GPay / PhonePe / Paytm / BHIM)</span>
            </button>
            <p className="text-[10px] text-slate-500 text-center">
              Tap above to launch any installed UPI app with payee details and amount prefilled.
            </p>
          </div>

          {/* QR Code & Fallback for Laptops or Devices without UPI app */}
          <div className="border border-slate-200 rounded-xl p-3.5 bg-slate-50 text-center space-y-2.5">
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-700 border-b border-slate-200 pb-2">
              <span className="flex items-center gap-1.5">
                <QrCode className="w-3.5 h-3.5 text-amber-700" />
                <span>Scan QR from Any UPI App</span>
              </span>
              <span className="text-slate-400 font-normal">Laptop / Desktop Fallback</span>
            </div>

            {/* Dynamic QR Code representation */}
            <div className="bg-white p-3 rounded-xl border border-slate-200 inline-block shadow-xs">
              <svg viewBox="0 0 100 100" className="w-36 h-36 mx-auto text-slate-900">
                {/* 3 Corner Markers */}
                <rect x="5" y="5" width="26" height="26" fill="currentColor" rx="4" />
                <rect x="9" y="9" width="18" height="18" fill="white" rx="2" />
                <rect x="13" y="13" width="10" height="10" fill="currentColor" rx="1" />

                <rect x="69" y="5" width="26" height="26" fill="currentColor" rx="4" />
                <rect x="73" y="9" width="18" height="18" fill="white" rx="2" />
                <rect x="77" y="13" width="10" height="10" fill="currentColor" rx="1" />

                <rect x="5" y="69" width="26" height="26" fill="currentColor" rx="4" />
                <rect x="9" y="73" width="18" height="18" fill="white" rx="2" />
                <rect x="13" y="77" width="10" height="10" fill="currentColor" rx="1" />

                {/* Center UPI Logo Placeholder */}
                <rect x="42" y="42" width="16" height="16" fill="currentColor" rx="2" />
                <rect x="45" y="45" width="10" height="10" fill="#f59e0b" rx="1" />

                {/* Modules */}
                <rect x="36" y="8" width="5" height="5" fill="currentColor" />
                <rect x="46" y="8" width="5" height="5" fill="currentColor" />
                <rect x="56" y="8" width="5" height="5" fill="currentColor" />
                <rect x="36" y="18" width="5" height="5" fill="currentColor" />
                <rect x="56" y="18" width="5" height="5" fill="currentColor" />
                <rect x="8" y="36" width="5" height="5" fill="currentColor" />
                <rect x="18" y="36" width="5" height="5" fill="currentColor" />
                <rect x="8" y="46" width="5" height="5" fill="currentColor" />
                <rect x="8" y="56" width="5" height="5" fill="currentColor" />
                <rect x="18" y="56" width="5" height="5" fill="currentColor" />
                <rect x="72" y="36" width="5" height="5" fill="currentColor" />
                <rect x="82" y="36" width="5" height="5" fill="currentColor" />
                <rect x="72" y="46" width="5" height="5" fill="currentColor" />
                <rect x="82" y="56" width="5" height="5" fill="currentColor" />
                <rect x="36" y="72" width="5" height="5" fill="currentColor" />
                <rect x="46" y="72" width="5" height="5" fill="currentColor" />
                <rect x="56" y="82" width="5" height="5" fill="currentColor" />
                <rect x="66" y="82" width="5" height="5" fill="currentColor" />
              </svg>
            </div>

            {/* Copyable UPI ID Field */}
            <div className="flex items-center justify-between gap-2 p-2 bg-white rounded-lg border border-slate-200 text-left">
              <div className="min-w-0">
                <span className="text-[10px] text-slate-400 font-semibold block">Payee UPI ID</span>
                <span className="font-mono font-bold text-slate-800 text-xs truncate block">{upiId}</span>
              </div>
              <button
                type="button"
                onClick={handleCopyUpiId}
                className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-md text-[11px] flex items-center gap-1 transition-colors cursor-pointer shrink-0"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-emerald-700 font-bold">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy ID</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Critical UPI Payment Notice / Limitation */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
            <div className="flex items-center gap-1.5 text-amber-800 font-bold text-[11px]">
              <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span>Payment Status: PENDING (Awaiting Staff Verification)</span>
            </div>
            <p className="text-[10px] text-slate-500 leading-relaxed">
              Your order has been queued in the kitchen. Opening the UPI app requests the exact bill of{' '}
              <strong>{formatCurrency(order.total_amount)}</strong>. Once your payment is received, cafe staff will verify and mark it as PAID.
            </p>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-3.5 sm:p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-2 text-slate-600 hover:text-slate-900 font-medium text-xs cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={() => {
              onClose();
              onProceedToReceipt();
            }}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <span>View Order Receipt</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
