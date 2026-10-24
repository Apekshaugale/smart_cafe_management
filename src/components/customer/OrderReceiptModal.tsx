import React from 'react';
import { CafeOrder } from '../../types/cafe';
import { X, CheckCircle, Clock, ChefHat, CheckSquare, Printer, ArrowRight } from 'lucide-react';
import { formatCurrency } from '../../utils/cafeUtils';

interface OrderReceiptModalProps {
  order: CafeOrder | null;
  isOpen: boolean;
  onClose: () => void;
  onOrderAgain: () => void;
}

export const OrderReceiptModal: React.FC<OrderReceiptModalProps> = ({
  order,
  isOpen,
  onClose,
  onOrderAgain,
}) => {
  if (!isOpen || !order) return null;

  const statuses = ['PLACED', 'PREPARING', 'READY', 'COMPLETED'];
  const currentIndex = statuses.indexOf(order.order_status);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-8">
        {/* Top Header */}
        <div className="bg-amber-600 text-white px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-white" />
            </div>
            <div>
              <span className="text-xs uppercase tracking-wider text-amber-200 font-semibold block">
                Order Received
              </span>
              <h2 className="text-lg font-extrabold text-white">Order #{order.order_id}</h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Live Status Progress Timeline */}
        <div className="p-6 border-b border-slate-100 bg-amber-50/40">
          <div className="flex items-center justify-between text-xs mb-3">
            <span className="font-bold text-slate-800">Kitchen Preparation Status</span>
            <span className="font-semibold text-amber-700 bg-amber-100/80 px-2 py-0.5 rounded text-[11px]">
              Status: {order.order_status}
            </span>
          </div>

          <div className="relative flex items-center justify-between">
            {/* Progress line */}
            <div className="absolute top-1/2 left-0 right-0 -translate-y-1/2 h-1 bg-slate-200 z-0" />
            <div
              className="absolute top-1/2 left-0 -translate-y-1/2 h-1 bg-amber-600 z-0 transition-all duration-500"
              style={{
                width: `${(Math.max(0, currentIndex) / (statuses.length - 1)) * 100}%`,
              }}
            />

            {[
              { id: 'PLACED', label: 'Placed', icon: Clock },
              { id: 'PREPARING', label: 'Preparing', icon: ChefHat },
              { id: 'READY', label: 'Ready', icon: CheckSquare },
              { id: 'COMPLETED', label: 'Served', icon: CheckCircle },
            ].map((step, idx) => {
              const isDone = idx <= currentIndex;
              const isCurrent = idx === currentIndex;
              const Icon = step.icon;

              return (
                <div key={step.id} className="relative z-10 flex flex-col items-center">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors shadow-xs ${
                      isDone
                        ? 'bg-amber-600 text-white'
                        : 'bg-white text-slate-400 border-2 border-slate-200'
                    } ${isCurrent ? 'ring-4 ring-amber-200' : ''}`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <span
                    className={`text-[10px] font-semibold mt-1.5 ${
                      isDone ? 'text-amber-900 font-bold' : 'text-slate-400'
                    }`}
                  >
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Printable Thermal Receipt Style Container */}
        <div className="p-6 space-y-4">
          <div className="border border-dashed border-slate-300 rounded-xl p-5 bg-slate-50/70 font-mono text-xs text-slate-800 space-y-3">
            <div className="text-center space-y-0.5 pb-3 border-b border-dashed border-slate-300">
              <div className="font-bold text-sm text-slate-900 font-sans tracking-tight">
                AURA CAFE & ARTISAN BISTRO
              </div>
              <div className="text-[10px] text-slate-500">
                Table #{order.table_number} · Order #{order.order_id}
              </div>
              <div className="text-[10px] text-slate-500">
                Time: {order.created_at} · Method: {order.payment_method === 'UPI' ? 'UPI / QR Payment' : 'Cash at Counter'}
              </div>
            </div>

            {/* Itemized Lines */}
            <div className="space-y-1.5 py-1">
              <div className="flex justify-between text-[11px] font-bold text-slate-500 pb-1 border-b border-slate-200">
                <span>ITEM</span>
                <span>QTY × PRICE</span>
              </div>
              {order.items.map((it) => (
                <div key={it.order_item_id} className="flex justify-between text-xs">
                  <span className="truncate pr-2">{it.item_name}</span>
                  <span className="tabular-nums shrink-0">
                    {it.quantity} × {formatCurrency(it.unit_price)}
                  </span>
                </div>
              ))}
            </div>

            {/* Totals */}
            <div className="pt-2 border-t border-dashed border-slate-300 space-y-1">
              <div className="flex justify-between text-xs font-bold text-slate-900">
                <span>TOTAL AMOUNT</span>
                <span className="tabular-nums text-sm text-amber-800">
                  {formatCurrency(order.total_amount)}
                </span>
              </div>
              <div className="text-[10px] text-slate-600 flex justify-between items-center pt-0.5">
                <span>Payment Status</span>
                {order.payment_status === 'PAID' ? (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 uppercase">
                    PAID
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 uppercase">
                    PENDING ({order.payment_method === 'Cash' ? 'Pay Cash' : 'Awaiting Staff Check'})
                  </span>
                )}
              </div>
            </div>

            {order.notes && (
              <div className="pt-2 border-t border-slate-200 text-[10px] text-slate-600">
                <span className="font-bold">Instructions:</span> {order.notes}
              </div>
            )}
          </div>

          <p className="text-[11px] text-slate-500 text-center">
            Your server is delivering this to <strong className="text-slate-800">Table #{order.table_number}</strong>. You can keep this screen open to monitor live kitchen status!
          </p>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 bg-slate-50 border-t border-slate-200">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-medium transition-colors cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            Print Receipt
          </button>

          <button
            onClick={() => {
              onOrderAgain();
              onClose();
            }}
            className="flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors cursor-pointer"
          >
            <span>Order More Items</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
