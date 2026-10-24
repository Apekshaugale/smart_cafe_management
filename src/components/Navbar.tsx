import React from 'react';
import { ShoppingBag, Coffee, Camera, Clock, ShieldCheck, Utensils, Lock } from 'lucide-react';

interface NavbarProps {
  cartCount: number;
  onOpenCart: () => void;
  selectedTable: number;
  onOpenOrderStatus: () => void;
  onOpenQrScanner: () => void;
  hasActiveOrder: boolean;
  isAdminView: boolean;
  onToggleAdminView: (val: boolean) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  cartCount,
  onOpenCart,
  selectedTable,
  onOpenOrderStatus,
  onOpenQrScanner,
  hasActiveOrder,
  isAdminView,
  onToggleAdminView,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-4 h-16">
          {/* Zone 1: Brand Wordmark & Mode Switcher */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-amber-600 flex items-center justify-center text-white shadow-sm">
                <Coffee className="w-5 h-5" />
              </div>
              <div>
                <span className="text-base font-bold text-slate-900 tracking-tight block">
                  Aura Cafe
                </span>
                <span className="text-[11px] text-slate-500 font-medium block">
                  Table #{selectedTable}
                </span>
              </div>
            </div>

            {/* Prominent Mode Switcher with Lock indicator */}
            <div className="flex items-center p-0.5 bg-slate-100 rounded-lg border border-slate-200 ml-2">
              <button
                onClick={() => onToggleAdminView(false)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                  !isAdminView
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Customer Menu Mode"
              >
                <Utensils className="w-3.5 h-3.5 text-amber-700" />
                <span className="hidden sm:inline">Menu</span>
                <span className="sm:hidden">Menu</span>
              </button>

              <button
                onClick={() => onToggleAdminView(true)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                  isAdminView
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Staff Portal (Password Protected)"
              >
                <Lock className="w-3 h-3 text-amber-700" />
                <span>Admin</span>
              </button>
            </div>
          </div>

          {/* Zone 2: Navigation Links (Customer View) */}
          {!isAdminView && (
            <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
              <button
                onClick={onOpenOrderStatus}
                className="relative text-slate-600 hover:text-amber-800 transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Clock className="w-4 h-4 text-amber-600" />
                <span>Track Order</span>
                {hasActiveOrder && (
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                )}
              </button>

              <button
                onClick={onOpenQrScanner}
                className="text-slate-600 hover:text-amber-800 transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Camera className="w-4 h-4 text-amber-600" />
                <span>Scan Table QR</span>
              </button>
            </nav>
          )}

          {/* Zone 3: Primary Actions (Scan QR + Cart) */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {!isAdminView && (
              <>
                <button
                  onClick={onOpenQrScanner}
                  className="md:hidden flex items-center gap-1 px-2 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer active:scale-95"
                  title="Scan Table QR"
                >
                  <Camera className="w-3.5 h-3.5 text-amber-700" />
                  <span className="hidden xs:inline">Scan</span>
                </button>

                <button
                  onClick={onOpenOrderStatus}
                  className="md:hidden flex items-center gap-1 px-2 py-1.5 text-xs font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 rounded-lg transition-colors cursor-pointer active:scale-95"
                  title="Track Order Status"
                >
                  <Clock className="w-3.5 h-3.5 text-amber-700" />
                  <span className="hidden xs:inline">Track</span>
                  {hasActiveOrder && (
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-600 animate-pulse" />
                  )}
                </button>

                <button
                  onClick={onOpenCart}
                  data-testid="open-cart-btn"
                  className="relative flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow-sm transition-all cursor-pointer active:scale-95"
                >
                  <ShoppingBag className="w-4 h-4" />
                  <span>Cart</span>
                  {cartCount > 0 && (
                    <span
                      data-testid="cart-badge"
                      className="bg-white text-amber-700 text-[10px] sm:text-[11px] font-black px-1.5 py-0.2 rounded-full"
                    >
                      {cartCount}
                    </span>
                  )}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
