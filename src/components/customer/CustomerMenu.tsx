import React, { useState } from 'react';
import { MenuItem, CafeOrder } from '../../types/cafe';
import { DishIllustration } from './DishIllustration';
import { Search, Plus, Minus, Clock, Flame, QrCode, Camera, ChevronRight, ShoppingBag } from 'lucide-react';
import { formatCurrency } from '../../utils/cafeUtils';

interface CustomerMenuProps {
  menuItems: MenuItem[];
  cart: Record<number, number>;
  onAddToCart: (item: MenuItem) => void;
  onUpdateQuantity: (menuItemId: number, delta: number) => void;
  selectedTable: number;
  onOpenTableSelect: () => void;
  onOpenCart: () => void;
  onOpenOrderStatus: () => void;
  onOpenQrScanner: () => void;
  tableOrders: CafeOrder[];
}

export const CustomerMenu: React.FC<CustomerMenuProps> = ({
  menuItems,
  cart,
  onAddToCart,
  onUpdateQuantity,
  selectedTable,
  onOpenTableSelect,
  onOpenCart,
  onOpenOrderStatus,
  onOpenQrScanner,
  tableOrders,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [vegOnly, setVegOnly] = useState<boolean>(false);

  const categories = ['All', 'Coffee', 'Cold Brew', 'Breakfast', 'Snacks', 'Mains', 'Desserts'];

  const filteredItems = menuItems.filter((item) => {
    const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory;
    const matchesSearch =
      item.item_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesVeg = !vegOnly || item.isVeg;
    return matchesCategory && matchesSearch && matchesVeg;
  });

  const totalCartCount = Object.values(cart).reduce((a, b) => a + b, 0);

  // Cart subtotal for bottom floating bar
  const cartSubtotal = Object.entries(cart).reduce((sum, [id, qty]) => {
    const item = menuItems.find((m) => m.menu_item_id === Number(id));
    return sum + (item ? item.price * qty : 0);
  }, 0);

  // Check if there is an active order for this table
  const activeOrder = tableOrders.find((o) =>
    ['PLACED', 'PREPARING', 'READY'].includes(o.order_status)
  );

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4 sm:space-y-6 pb-24 sm:pb-8">
      {/* Table Banner & Ordering Context: Optimized for Mobile & Laptop */}
      <div className="bg-amber-950 text-white rounded-2xl p-4 sm:p-6 shadow-md border border-amber-900/60 flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
        <div>
          <div className="flex items-center gap-2 text-amber-300 text-[11px] font-bold uppercase tracking-wider">
            <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block animate-pulse" />
            <span>Table #{selectedTable} Dine-In</span>
            <span>·</span>
            <span className="text-amber-200/90 font-medium">Real-Time Kitchen Sync</span>
          </div>
          <h1 className="text-lg sm:text-2xl font-black tracking-tight text-white mt-1">
            Table #{selectedTable} — Artisan Cafe Menu
          </h1>
          <p className="text-xs text-amber-100/80 mt-0.5 sm:mt-1 hidden sm:block">
            Browse our freshly brewed coffees and gourmet bites. Add items to order directly to the kitchen.
          </p>
        </div>

        {/* Action Buttons: Responsive wrap on mobile */}
        <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 shrink-0 pt-1 md:pt-0">
          {/* Live Camera Table QR Scanner CTA */}
          <button
            onClick={onOpenQrScanner}
            className="flex items-center justify-center gap-1.5 px-3 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs shadow-sm transition-all cursor-pointer active:scale-95"
            title="Scan Table QR with Camera"
          >
            <Camera className="w-3.5 h-3.5 text-slate-950" />
            <span>Scan QR</span>
          </button>

          <button
            onClick={onOpenOrderStatus}
            className="flex items-center justify-center gap-1.5 px-3 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-semibold border border-white/20 transition-all cursor-pointer active:scale-95"
          >
            <Clock className="w-3.5 h-3.5 text-amber-300" />
            <span>Track Order</span>
          </button>

          <button
            onClick={onOpenTableSelect}
            className="flex items-center justify-center gap-1.5 px-3 py-2 bg-amber-900/70 hover:bg-amber-900 text-amber-200 rounded-xl text-xs font-semibold border border-amber-700/60 transition-all cursor-pointer active:scale-95"
            title="Switch Table Number"
          >
            <QrCode className="w-3.5 h-3.5" />
            <span>Table #{selectedTable}</span>
          </button>

          {totalCartCount > 0 && (
            <button
              onClick={onOpenCart}
              className="flex items-center justify-center gap-1.5 px-3.5 py-2 bg-white text-amber-950 hover:bg-amber-50 rounded-xl text-xs font-extrabold shadow-md transition-all cursor-pointer active:scale-95"
            >
              <ShoppingBag className="w-3.5 h-3.5 text-amber-700" />
              <span>Cart ({totalCartCount})</span>
            </button>
          )}
        </div>
      </div>

      {/* Active Order Banner Notification */}
      {activeOrder && (
        <div className="p-3.5 sm:p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-8 h-8 rounded-full bg-amber-600 text-white flex items-center justify-center shrink-0">
              <Clock className="w-4 h-4 animate-spin" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-slate-900 flex items-center gap-2 truncate">
                <span>Order #{activeOrder.order_id}</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-200 text-amber-900 font-extrabold uppercase">
                  {activeOrder.order_status}
                </span>
              </div>
              <p className="text-[11px] text-slate-600 mt-0.5 truncate">
                {activeOrder.items.length} items ({formatCurrency(activeOrder.total_amount)}) · Updated live
              </p>
            </div>
          </div>

          <button
            onClick={onOpenOrderStatus}
            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold shrink-0 transition-colors cursor-pointer active:scale-95"
          >
            Track Status
          </button>
        </div>
      )}

      {/* Search & Category Filter Controls: Mobile-Friendly Scroll & Spacing */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Category Segmented Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 no-scrollbar touch-pan-x">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer shrink-0 ${
                selectedCategory === cat
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-white text-slate-700 hover:text-slate-900 hover:bg-slate-50 border border-slate-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Search & Veg Filter */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search dishes or drinks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 transition-all"
            />
          </div>

          <button
            onClick={() => setVegOnly(!vegOnly)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-colors cursor-pointer shrink-0 ${
              vegOnly
                ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                : 'bg-white border-slate-200 text-slate-700 hover:text-slate-900'
            }`}
          >
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                vegOnly ? 'bg-emerald-600' : 'border border-emerald-600 bg-white'
              }`}
            />
            <span>Pure Veg</span>
          </button>
        </div>
      </div>

      {/* Menu Grid: 1 col on mobile, 2 col on tablet, 3 col on laptop */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-5">
        {filteredItems.map((item) => {
          const qty = cart[item.menu_item_id] || 0;
          const isOutOfStock = item.available === 'N';

          return (
            <div
              key={item.menu_item_id}
              className={`group flex flex-col bg-white rounded-2xl border transition-all duration-200 overflow-hidden shadow-xs ${
                isOutOfStock
                  ? 'border-slate-200 opacity-60 bg-slate-50/50'
                  : 'border-slate-200 hover:border-amber-400/80 hover:shadow-md'
              }`}
            >
              {/* Dish Visual Header */}
              <div className="relative h-40 sm:h-44 w-full bg-slate-100 overflow-hidden">
                <DishIllustration
                  category={item.category}
                  name={item.item_name}
                  imageUrl={item.imageUrl}
                />

                {/* Dietary badge */}
                <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 bg-white/95 backdrop-blur-xs px-2 py-0.5 rounded-md shadow-xs text-[10px] font-bold border border-slate-200/50">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      item.isVeg ? 'bg-emerald-500' : 'bg-red-500'
                    }`}
                  />
                  <span className="text-slate-800">{item.isVeg ? 'Veg' : 'Non-Veg'}</span>
                </div>

                {/* Bestseller badge */}
                {item.isBestseller && (
                  <div className="absolute top-2.5 right-2.5 bg-amber-600 text-white px-2 py-0.5 rounded-md text-[10px] font-bold shadow-xs">
                    Popular
                  </div>
                )}

                {/* Out of stock overlay */}
                {isOutOfStock && (
                  <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-[1px] flex items-center justify-center p-3 text-center">
                    <span className="bg-red-600 text-white font-bold text-xs px-3 py-1.5 rounded-xl shadow-md">
                      Currently Sold Out
                    </span>
                  </div>
                )}
              </div>

              {/* Card Body */}
              <div className="p-3.5 sm:p-4 flex-1 flex flex-col justify-between space-y-3">
                <div>
                  <div className="flex items-baseline justify-between gap-2">
                    <h3 className="font-bold text-slate-900 text-sm group-hover:text-amber-800 transition-colors">
                      {item.item_name}
                    </h3>
                    <span className="font-black text-slate-900 text-sm sm:text-base tabular-nums shrink-0">
                      {formatCurrency(item.price)}
                    </span>
                  </div>

                  <p className="text-xs text-slate-500 line-clamp-2 mt-1 leading-relaxed">
                    {item.description}
                  </p>

                  {/* Clean unboxed metadata with dot separators */}
                  <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-2 font-medium">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-400" />
                      {item.prepTimeMinutes} mins
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="flex items-center gap-1">
                      <Flame className="w-3 h-3 text-slate-400" />
                      {item.calories} kcal
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="text-slate-600 font-semibold">{item.category}</span>
                  </div>
                </div>

                {/* Action Row */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-slate-500">
                    {isOutOfStock ? 'Unavailable' : 'Live Order'}
                  </span>

                  {isOutOfStock ? (
                    <button
                      disabled
                      className="px-3 py-1.5 text-xs font-semibold text-slate-400 bg-slate-100 rounded-lg cursor-not-allowed"
                    >
                      Out of Stock
                    </button>
                  ) : qty === 0 ? (
                    <button
                      onClick={() => onAddToCart(item)}
                      data-testid={`add-item-${item.menu_item_id}`}
                      className="flex items-center gap-1 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer active:scale-95"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add</span>
                    </button>
                  ) : (
                    <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-300 rounded-xl p-1">
                      <button
                        onClick={() => onUpdateQuantity(item.menu_item_id, -1)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg bg-white text-amber-900 hover:bg-amber-100 transition-colors cursor-pointer shadow-xs font-bold"
                        title="Reduce quantity"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="text-xs font-black text-amber-950 w-6 text-center tabular-nums">
                        {qty}
                      </span>
                      <button
                        onClick={() => onUpdateQuantity(item.menu_item_id, 1)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg bg-amber-600 text-white hover:bg-amber-700 transition-colors cursor-pointer shadow-xs font-bold"
                        title="Increase quantity"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filteredItems.length === 0 && (
        <div className="text-center py-12 bg-white rounded-2xl border border-slate-200 p-6">
          <p className="text-slate-600 text-sm font-semibold">No dishes match your filter.</p>
          <button
            onClick={() => {
              setSearchQuery('');
              setSelectedCategory('All');
              setVegOnly(false);
            }}
            className="mt-3 px-4 py-2 text-xs text-white bg-amber-600 rounded-xl font-bold cursor-pointer hover:bg-amber-700 transition-colors"
          >
            Reset Filters
          </button>
        </div>
      )}

      {/* Floating Sticky Bottom Bar for Mobile Viewers with Items in Cart */}
      {totalCartCount > 0 && (
        <div className="sm:hidden fixed bottom-3 left-3 right-3 z-30">
          <button
            onClick={onOpenCart}
            className="w-full bg-slate-900 text-white rounded-2xl p-3 shadow-2xl flex items-center justify-between border border-amber-500/50 active:scale-[0.98] transition-all cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-xl bg-amber-500 text-slate-950 font-black text-xs flex items-center justify-center">
                {totalCartCount}
              </span>
              <div className="text-left">
                <span className="font-extrabold text-xs block text-white">
                  Cart Total: {formatCurrency(cartSubtotal)}
                </span>
                <span className="text-[10px] text-amber-300 font-semibold block">
                  Table #{selectedTable} Dine-In
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1 bg-amber-600 hover:bg-amber-500 text-white px-3 py-1.5 rounded-xl font-bold text-xs shadow-xs">
              <span>View Cart</span>
              <ChevronRight className="w-4 h-4" />
            </div>
          </button>
        </div>
      )}
    </div>
  );
};
