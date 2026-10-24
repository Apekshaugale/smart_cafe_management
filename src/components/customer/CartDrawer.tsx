import React, { useState } from 'react';
import { MenuItem, CafeTable } from '../../types/cafe';
import { X, Trash2, Plus, Minus, Banknote, Smartphone, AlertCircle, ShoppingBag } from 'lucide-react';
import { formatCurrency, calculateCartTotals } from '../../utils/cafeUtils';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  cart: Record<number, number>;
  menuItems: MenuItem[];
  tables: CafeTable[];
  selectedTable: number;
  onSelectTable: (tableId: number) => void;
  onUpdateQuantity: (menuItemId: number, delta: number) => void;
  onRemoveItem: (menuItemId: number) => void;
  onPlaceOrder: (orderData: {
    tableNumber: number;
    customerName: string;
    customerPhone: string;
    paymentMethod: 'UPI' | 'Cash';
    notes: string;
  }) => void;
}

export const CartDrawer: React.FC<CartDrawerProps> = ({
  isOpen,
  onClose,
  cart,
  menuItems,
  tables,
  selectedTable,
  onSelectTable,
  onUpdateQuantity,
  onRemoveItem,
  onPlaceOrder,
}) => {
  const [customerName, setCustomerName] = useState<string>('Guest Diner');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<'UPI' | 'Cash'>('UPI');
  const [notes, setNotes] = useState<string>('');
  const [validationError, setValidationError] = useState<string | null>(null);

  if (!isOpen) return null;

  // Build list of active items
  const cartEntries = Object.entries(cart)
    .filter(([_, qty]) => qty > 0)
    .map(([idStr, qty]) => {
      const item = menuItems.find((m) => m.menu_item_id === Number(idStr));
      return { item, qty };
    })
    .filter((entry): entry is { item: MenuItem; qty: number } => entry.item !== undefined);

  const { subtotal, gstAmount, grandTotal } = calculateCartTotals(
    cartEntries.map((e) => ({ price: e.item.price, quantity: e.qty }))
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (cartEntries.length === 0) {
      setValidationError('Your cart is empty. Please add items before placing order.');
      return;
    }

    if (!selectedTable || selectedTable < 1) {
      setValidationError('Please select a valid table number.');
      return;
    }

    if (!customerName.trim()) {
      setValidationError('Please enter your name or a table guest identifier.');
      return;
    }

    setValidationError(null);
    onPlaceOrder({
      tableNumber: selectedTable,
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      paymentMethod,
      notes: notes.trim(),
    });
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/60 backdrop-blur-xs flex justify-end">
      <div className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-amber-600" />
            <h2 className="font-bold text-slate-900 text-base">Your Cafe Order</h2>
            <span className="text-xs text-slate-500 font-semibold">
              ({cartEntries.reduce((a, b) => a + b.qty, 0)} items)
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {validationError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2 text-xs text-red-700">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
              <span>{validationError}</span>
            </div>
          )}

          {/* Table Selector */}
          <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                Dine-In Table Number
              </label>
              <span className="text-[11px] text-amber-800 font-semibold">
                Auto-assigned from QR
              </span>
            </div>
            <select
              value={selectedTable}
              onChange={(e) => onSelectTable(Number(e.target.value))}
              className="w-full bg-white border border-amber-300 rounded-lg px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              {tables.map((t) => (
                <option key={t.table_id} value={t.table_number}>
                  Table #{t.table_number} ({t.floor} · {t.capacity} Seats · {t.status})
                </option>
              ))}
            </select>
          </div>

          {/* Cart Items List */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Selected Items
            </h3>

            {cartEntries.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-xs">
                Your cart is empty. Add delicious coffees & snacks from the menu!
              </div>
            ) : (
              <div className="space-y-2.5">
                {cartEntries.map(({ item, qty }) => (
                  <div
                    key={item.menu_item_id}
                    className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200"
                  >
                    <div className="flex-1 min-w-0 pr-3">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`w-2 h-2 rounded-full shrink-0 ${
                            item.isVeg ? 'bg-emerald-500' : 'bg-red-500'
                          }`}
                        />
                        <h4 className="text-xs font-bold text-slate-900 truncate">
                          {item.item_name}
                        </h4>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {formatCurrency(item.price)} × {qty} ={' '}
                        <span className="font-semibold text-slate-700">
                          {formatCurrency(item.price * qty)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <div className="flex items-center bg-white border border-slate-300 rounded-lg p-0.5 shadow-xs">
                        <button
                          type="button"
                          onClick={() => onUpdateQuantity(item.menu_item_id, -1)}
                          className="w-5 h-5 flex items-center justify-center text-slate-600 hover:bg-slate-100 rounded cursor-pointer"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-5 text-center text-xs font-bold text-slate-800 tabular-nums">
                          {qty}
                        </span>
                        <button
                          type="button"
                          onClick={() => onUpdateQuantity(item.menu_item_id, 1)}
                          className="w-5 h-5 flex items-center justify-center text-slate-600 hover:bg-slate-100 rounded cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => onRemoveItem(item.menu_item_id)}
                        className="p-1 text-slate-400 hover:text-red-600 transition-colors cursor-pointer"
                        title="Remove item"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Customer Info & Notes */}
          <div className="space-y-3 pt-2 border-t border-slate-200">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Guest Details
            </h3>

            <div className="space-y-2">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Customer Name *
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="e.g. Rahul Sharma"
                  className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Mobile Number (Optional for SMS receipt)
                </label>
                <input
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="e.g. 9876543210"
                  className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Special Instructions / Dietary Notes
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Extra hot coffee, less sugar, serve waffles with warm syrup"
                  className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
                />
              </div>
            </div>
          </div>

          {/* Payment Method Selector (Strictly UPI and Cash) */}
          <div className="space-y-2 pt-2 border-t border-slate-200">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Payment Method
              </h3>
              <span className="text-[10px] text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                Direct Cafe Billing
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              {[
                {
                  id: 'UPI',
                  label: 'UPI Payment',
                  sub: 'GPay, PhonePe, Paytm',
                  icon: Smartphone,
                },
                {
                  id: 'Cash',
                  label: 'Cash Payment',
                  sub: 'Pay at Counter / Table',
                  icon: Banknote,
                },
              ].map((m) => {
                const Icon = m.icon;
                const isSelected = paymentMethod === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setPaymentMethod(m.id as 'UPI' | 'Cash')}
                    className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-xs transition-all cursor-pointer ${
                      isSelected
                        ? 'border-amber-600 bg-amber-50 text-amber-900 font-bold shadow-xs ring-1 ring-amber-500'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <Icon className="w-5 h-5 mb-1 text-amber-600" />
                    <span className="font-bold">{m.label}</span>
                    <span className="text-[10px] text-slate-400 mt-0.5">{m.sub}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer Summary & Order CTA */}
        <div className="p-5 border-t border-slate-200 bg-slate-50 space-y-3">
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>Items Subtotal</span>
              <span className="tabular-nums font-semibold">{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Restaurant GST (5%)</span>
              <span className="tabular-nums font-semibold">{formatCurrency(gstAmount)}</span>
            </div>
            <div className="flex justify-between text-slate-900 font-bold text-sm pt-1.5 border-t border-slate-200">
              <span>Total Payable</span>
              <span className="tabular-nums text-amber-700 font-extrabold text-base">
                {formatCurrency(grandTotal)}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={cartEntries.length === 0}
            data-testid="place-order-submit-btn"
            className="w-full py-3 bg-amber-600 hover:bg-amber-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-md transition-colors cursor-pointer flex items-center justify-center gap-2"
          >
            {paymentMethod === 'UPI' ? (
              <>
                <Smartphone className="w-4 h-4" />
                <span>Pay {formatCurrency(grandTotal)} via UPI & Place Order</span>
              </>
            ) : (
              <>
                <Banknote className="w-4 h-4" />
                <span>Confirm Cash Order ({formatCurrency(grandTotal)})</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
