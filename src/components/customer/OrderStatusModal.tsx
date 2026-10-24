import React, { useState } from 'react';
import { CafeOrder } from '../../types/cafe';
import {
  X,
  Search,
  Clock,
  ChefHat,
  CheckCircle,
  CheckSquare,
  XCircle,
  Receipt,
  Printer,
  ShoppingBag,
} from 'lucide-react';
import { formatCurrency } from '../../utils/cafeUtils';

interface OrderStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  orders: CafeOrder[];
  selectedTable: number;
  initialOrderId?: number | null;
  onOrderMore: () => void;
}

export const OrderStatusModal: React.FC<OrderStatusModalProps> = ({
  isOpen,
  onClose,
  orders,
  selectedTable,
  initialOrderId,
  onOrderMore,
}) => {
  const [searchInput, setSearchInput] = useState<string>('');
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(
    initialOrderId || null
  );

  if (!isOpen) return null;

  // Active orders for this table
  const tableOrders = orders.filter((o) => o.table_number === selectedTable);

  // If user searched by order ID or phone
  const searchResults = searchInput.trim()
    ? orders.filter(
        (o) =>
          String(o.order_id).includes(searchInput.trim()) ||
          (o.customer_phone && o.customer_phone.includes(searchInput.trim())) ||
          o.customer_name.toLowerCase().includes(searchInput.toLowerCase().trim())
      )
    : [];

  // Determine active order to inspect (strictly scoped to this table or explicit user search)
  const activeOrder =
    (selectedOrderId && orders.find((o) => o.order_id === selectedOrderId)) ||
    (tableOrders.length > 0 ? tableOrders[0] : null);

  const statuses = ['PLACED', 'PREPARING', 'READY', 'COMPLETED'];
  const currentIndex = activeOrder ? statuses.indexOf(activeOrder.order_status) : -1;

  const statusDescriptions: Record<string, string> = {
    PLACED: 'Your order has been sent to the kitchen and is queued for prep.',
    PREPARING: 'The chef is actively preparing your fresh coffees and dishes.',
    READY: 'Your order is freshly prepared and ready for table delivery.',
    COMPLETED: 'Order served and completed. Enjoy your meal!',
    CANCELLED: 'This order was cancelled by the store or customer.',
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-6 flex flex-col max-h-[90vh]">
        {/* Modal Top Bar */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-600 flex items-center justify-center text-white">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-bold text-base text-white">Live Order Tracking</h2>
              <span className="text-[11px] text-slate-300">
                Check status for Table #{selectedTable} or search any order
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search & Quick Table Order Switcher */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by Order # (e.g. 101), Customer Name, or Phone..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          {/* Quick Order Tabs for Table */}
          {tableOrders.length > 0 && !searchInput && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar text-xs">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider shrink-0">
                Table #{selectedTable} Orders:
              </span>
              {tableOrders.map((ord) => {
                const isSelected = activeOrder?.order_id === ord.order_id;
                return (
                  <button
                    key={ord.order_id}
                    onClick={() => setSelectedOrderId(ord.order_id)}
                    className={`px-3 py-1 rounded-lg font-semibold shrink-0 transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'bg-white text-slate-700 border border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    #{ord.order_id} ({ord.order_status})
                  </button>
                );
              })}
            </div>
          )}

          {/* Search Result Dropdown Pills */}
          {searchInput && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar text-xs">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider shrink-0">
                Matches ({searchResults.length}):
              </span>
              {searchResults.length === 0 ? (
                <span className="text-slate-400 text-xs">No matching orders found</span>
              ) : (
                searchResults.map((ord) => (
                  <button
                    key={ord.order_id}
                    onClick={() => {
                      setSelectedOrderId(ord.order_id);
                      setSearchInput('');
                    }}
                    className="px-3 py-1 rounded-lg bg-white border border-amber-300 text-amber-900 font-semibold shrink-0 hover:bg-amber-50 cursor-pointer"
                  >
                    #{ord.order_id} · T-{ord.table_number} ({ord.order_status})
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* Order Details Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {!activeOrder ? (
            <div className="text-center py-12 text-slate-500 space-y-2">
              <Receipt className="w-10 h-10 text-slate-300 mx-auto" />
              <p className="text-sm font-semibold">No order selected or found.</p>
              <p className="text-xs text-slate-400">
                Place an order from the menu or search by your Order # above.
              </p>
            </div>
          ) : (
            <>
              {/* Order Header Summary Card */}
              <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-amber-800 uppercase tracking-wider">
                      Table #{activeOrder.table_number}
                    </span>
                    <span className="text-slate-300">·</span>
                    <span className="text-xs font-semibold text-slate-500">
                      Placed at {activeOrder.created_at}
                    </span>
                  </div>
                  <h3 className="text-xl font-extrabold text-slate-900 mt-1">
                    Order #{activeOrder.order_id}
                  </h3>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Customer: <strong className="text-slate-800">{activeOrder.customer_name}</strong>
                    {activeOrder.customer_phone ? ` (${activeOrder.customer_phone})` : ''}
                  </p>
                </div>

                <div className="flex flex-col sm:items-end">
                  <span
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${
                      activeOrder.order_status === 'COMPLETED'
                        ? 'bg-emerald-100 text-emerald-800'
                        : activeOrder.order_status === 'READY'
                        ? 'bg-purple-100 text-purple-800'
                        : activeOrder.order_status === 'CANCELLED'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-amber-100 text-amber-900 ring-2 ring-amber-300/50'
                    }`}
                  >
                    {activeOrder.order_status !== 'CANCELLED' && (
                      <span className="w-2 h-2 rounded-full bg-current animate-pulse" />
                    )}
                    {activeOrder.order_status}
                  </span>
                  <span className="text-lg font-black text-slate-900 tabular-nums mt-1">
                    {formatCurrency(activeOrder.total_amount)}
                  </span>
                </div>
              </div>

              {/* Status Stepper Progression */}
              {activeOrder.order_status !== 'CANCELLED' ? (
                <div className="space-y-4 pt-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">
                      Live Kitchen Timeline
                    </span>
                    <span className="text-slate-500 text-[11px]">
                      {statusDescriptions[activeOrder.order_status]}
                    </span>
                  </div>

                  <div className="relative flex items-center justify-between px-2">
                    {/* Connecting Bar */}
                    <div className="absolute top-4 left-6 right-6 h-1 bg-slate-200 z-0" />
                    <div
                      className="absolute top-4 left-6 h-1 bg-amber-600 z-0 transition-all duration-500"
                      style={{
                        width: `${(Math.max(0, currentIndex) / (statuses.length - 1)) * 88}%`,
                      }}
                    />

                    {[
                      { id: 'PLACED', label: 'Order Placed', icon: Clock },
                      { id: 'PREPARING', label: 'In Kitchen', icon: ChefHat },
                      { id: 'READY', label: 'Ready for Table', icon: CheckSquare },
                      { id: 'COMPLETED', label: 'Served', icon: CheckCircle },
                    ].map((step, idx) => {
                      const isDone = idx <= currentIndex;
                      const isCurrent = idx === currentIndex;
                      const Icon = step.icon;

                      return (
                        <div key={step.id} className="relative z-10 flex flex-col items-center">
                          <div
                            className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${
                              isDone
                                ? 'bg-amber-600 text-white shadow-xs'
                                : 'bg-white text-slate-400 border-2 border-slate-200'
                            } ${isCurrent ? 'ring-4 ring-amber-200 scale-105' : ''}`}
                          >
                            <Icon className="w-4 h-4" />
                          </div>
                          <span
                            className={`text-[11px] font-semibold mt-2 whitespace-nowrap ${
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
              ) : (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 flex items-center gap-2">
                  <XCircle className="w-5 h-5 text-red-600 shrink-0" />
                  <span>This order was marked CANCELLED by the cafe.</span>
                </div>
              )}

              {/* Order Items Breakdown */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Ordered Dishes & Drinks
                </h4>

                <div className="bg-slate-50 border border-slate-200 rounded-xl divide-y divide-slate-100 overflow-hidden">
                  {activeOrder.items.map((item) => (
                    <div
                      key={item.order_item_id}
                      className="p-3 flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="font-bold text-slate-900">{item.item_name}</div>
                        <div className="text-[11px] text-slate-500">
                          {formatCurrency(item.unit_price)} × {item.quantity}
                        </div>
                      </div>
                      <span className="font-extrabold text-slate-800 tabular-nums">
                        {formatCurrency(item.unit_price * item.quantity)}
                      </span>
                    </div>
                  ))}

                  <div className="p-3 bg-slate-100/70 space-y-1.5 text-xs font-bold text-slate-900">
                    <div className="flex justify-between items-center">
                      <span>Total Bill (Includes GST)</span>
                      <span className="text-amber-800 text-sm font-black tabular-nums">
                        {formatCurrency(activeOrder.total_amount)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-[11px] font-medium text-slate-600 pt-1 border-t border-slate-200/80">
                      <span>Payment: {activeOrder.payment_method === 'UPI' ? 'UPI / QR' : 'Cash at Counter'}</span>
                      {activeOrder.payment_status === 'PAID' ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-black bg-emerald-100 text-emerald-800 uppercase">
                          PAID
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-black bg-amber-100 text-amber-900 uppercase">
                          PENDING
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {activeOrder.notes && (
                  <p className="text-[11px] text-slate-600 bg-amber-50/60 p-2.5 rounded-lg border border-amber-200/60">
                    <strong className="text-slate-800">Special Instructions:</strong>{' '}
                    {activeOrder.notes}
                  </p>
                )}
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-medium transition-colors cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Print Receipt</span>
          </button>

          <button
            onClick={() => {
              onOrderMore();
              onClose();
            }}
            className="flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors cursor-pointer"
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>Back to Menu / Order More</span>
          </button>
        </div>
      </div>
    </div>
  );
};
