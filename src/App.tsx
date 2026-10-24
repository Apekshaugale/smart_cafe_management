import React, { useState, useEffect } from 'react';
import { MenuItem, CafeTable, CafeOrder, OrderStatus } from './types/cafe';
import { Navbar } from './components/Navbar';
import { CustomerMenu } from './components/customer/CustomerMenu';
import { CartDrawer } from './components/customer/CartDrawer';
import { OrderReceiptModal } from './components/customer/OrderReceiptModal';
import { OrderStatusModal } from './components/customer/OrderStatusModal';
import { CameraQrScannerModal } from './components/customer/CameraQrScannerModal';
import { UpiPaymentModal } from './components/customer/UpiPaymentModal';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { QrCodeModal } from './components/common/QrCodeModal';
import {
  loadStoredMenuItems,
  saveStoredMenuItems,
  loadStoredTables,
  saveStoredTables,
  loadStoredOrders,
  saveStoredOrders,
  subscribeToCrossDeviceSync,
  placeCustomerOrderOnServer,
  updateOrderStatusOnServer,
  confirmOrderPaymentOnServer,
  releaseTableOnServer,
} from './utils/storageSync';

export default function App() {
  // View Toggle: Customer Mode vs Admin Dashboard
  const [isAdminView, setIsAdminView] = useState<boolean>(false);

  // Persistent Core App Entities (Synchronized in real-time across laptop and mobile)
  const [menuItems, setMenuItems] = useState<MenuItem[]>(() => loadStoredMenuItems());
  const [tables, setTables] = useState<CafeTable[]>(() => loadStoredTables());
  const [orders, setOrders] = useState<CafeOrder[]>(() => loadStoredOrders());

  // Cart State (menuItemId -> quantity)
  const [cart, setCart] = useState<Record<number, number>>({
    1: 1, // Pre-seeded with 1 Cappuccino for immediate diner testing
  });

  // Selected Table Context
  const [selectedTable, setSelectedTable] = useState<number>(1);

  // Modals & Drawers
  const [isCartOpen, setIsCartOpen] = useState<boolean>(false);
  const [isQrModalOpen, setIsQrModalOpen] = useState<boolean>(false);
  const [isCameraQrOpen, setIsCameraQrOpen] = useState<boolean>(false);
  const [isOrderStatusOpen, setIsOrderStatusOpen] = useState<boolean>(false);
  const [tableForQr, setTableForQr] = useState<number>(1);
  const [activeReceiptOrder, setActiveReceiptOrder] = useState<CafeOrder | null>(null);
  const [activeUpiData, setActiveUpiData] = useState<{
    order: CafeOrder;
    upiUri: string;
    upiId: string;
    cafeName: string;
  } | null>(null);

  // 1. Cross-Device Real-time Sync Subscription (Mobile <-> Laptop sync)
  useEffect(() => {
    const unsubscribe = subscribeToCrossDeviceSync({
      onMenuUpdated: (newMenu) => setMenuItems(newMenu),
      onTablesUpdated: (newTables) => setTables(newTables),
      onOrdersUpdated: (newOrders) => setOrders(newOrders),
    });
    return unsubscribe;
  }, []);

  // 2. URL Parameters and hash monitoring
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tableParam = params.get('table');
    if (tableParam) {
      const tableNum = parseInt(tableParam, 10);
      if (!isNaN(tableNum) && tableNum >= 1 && tableNum <= 10) {
        setSelectedTable(tableNum);
      }
    }

    if (window.location.hash === '#admin' || params.get('admin') === 'true') {
      setIsAdminView(true);
    }

    const handleHashChange = () => {
      setIsAdminView(window.location.hash === '#admin');
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Update URL hash when toggling admin view
  const handleToggleAdminView = (val: boolean) => {
    setIsAdminView(val);
    if (val) {
      window.location.hash = 'admin';
    } else {
      window.location.hash = '';
    }
  };

  // Cart Actions
  const handleAddToCart = (item: MenuItem) => {
    if (item.available === 'N') return;
    setCart((prev) => ({
      ...prev,
      [item.menu_item_id]: (prev[item.menu_item_id] || 0) + 1,
    }));
  };

  const handleUpdateQuantity = (menuItemId: number, delta: number) => {
    setCart((prev) => {
      const current = prev[menuItemId] || 0;
      const next = current + delta;
      if (next <= 0) {
        const copy = { ...prev };
        delete copy[menuItemId];
        return copy;
      }
      return { ...prev, [menuItemId]: next };
    });
  };

  const handleRemoveFromCart = (menuItemId: number) => {
    setCart((prev) => {
      const copy = { ...prev };
      delete copy[menuItemId];
      return copy;
    });
  };

  // Order Placement (Server-side authoritative calculation, UPI deep link, Cash pending)
  const handlePlaceOrder = async (orderData: {
    tableNumber: number;
    customerName: string;
    customerPhone: string;
    paymentMethod: 'UPI' | 'Card' | 'Cash';
    notes: string;
  }) => {
    const rawMethod: 'UPI' | 'Cash' = orderData.paymentMethod === 'Cash' ? 'Cash' : 'UPI';
    const cartEntries = Object.entries(cart)
      .filter(([_, qty]) => qty > 0)
      .map(([idStr, qty]) => {
        const item = menuItems.find((m) => m.menu_item_id === Number(idStr));
        return { item, qty };
      })
      .filter((entry): entry is { item: MenuItem; qty: number } => entry.item !== undefined);

    if (cartEntries.length === 0) return;

    const itemsPayload = cartEntries.map((e) => ({
      menuItemId: e.item.menu_item_id,
      quantity: e.qty,
    }));

    // Server-side authoritative validation and order generation
    const serverResult = await placeCustomerOrderOnServer({
      tableNumber: orderData.tableNumber,
      customerName: orderData.customerName,
      customerPhone: orderData.customerPhone,
      paymentMethod: rawMethod,
      notes: orderData.notes,
      items: itemsPayload,
    });

    let finalizedOrder: CafeOrder;
    let upiDeepLinkUri = '';
    let cafeUpiId = 'auracafe@okhdfcbank';
    let cafePayeeName = 'Aura Cafe';

    if (serverResult.success && serverResult.order) {
      finalizedOrder = serverResult.order;
      upiDeepLinkUri = serverResult.upiUri || '';
      cafeUpiId = serverResult.upiId || 'auracafe@okhdfcbank';
      cafePayeeName = serverResult.cafeName || 'Aura Cafe';
    } else {
      // Offline fallback: calculate with 5% GST and create order with payment_status: 'PENDING'
      const subtotal = cartEntries.reduce((sum, e) => sum + e.item.price * e.qty, 0);
      const gst = Math.round((subtotal * 0.05 + Number.EPSILON) * 100) / 100;
      const total_amount = Math.round((subtotal + gst + Number.EPSILON) * 100) / 100;
      const newOrderId = Math.max(...orders.map((o) => o.order_id), 100) + 1;
      const matchedTable = tables.find((t) => t.table_number === orderData.tableNumber);
      const table_id = matchedTable ? matchedTable.table_id : orderData.tableNumber;
      const now = new Date();
      const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      finalizedOrder = {
        order_id: newOrderId,
        table_id,
        table_number: orderData.tableNumber,
        customer_name: orderData.customerName || 'Guest Diner',
        customer_phone: orderData.customerPhone,
        order_status: 'PLACED',
        total_amount,
        payment_method: rawMethod,
        payment_status: 'PENDING',
        created_at: timeString,
        notes: orderData.notes,
        items: cartEntries.map((e, index) => ({
          order_item_id: Number(`${newOrderId}${index + 1}`),
          order_id: newOrderId,
          menu_item_id: e.item.menu_item_id,
          item_name: e.item.item_name,
          quantity: e.qty,
          unit_price: e.item.price,
        })),
      };

      upiDeepLinkUri = `upi://pay?pa=${encodeURIComponent(cafeUpiId)}&pn=${encodeURIComponent(cafePayeeName)}&am=${total_amount.toFixed(2)}&cu=INR&tn=${encodeURIComponent(`Order #${newOrderId} Table ${orderData.tableNumber}`)}`;
    }

    // Save order & sync cross-device
    const updatedOrders = [finalizedOrder, ...orders.filter((o) => o.order_id !== finalizedOrder.order_id)];
    setOrders(updatedOrders);
    saveStoredOrders(updatedOrders);

    // Mark table as OCCUPIED & sync cross-device
    const updatedTables = tables.map((t) =>
      t.table_number === orderData.tableNumber
        ? { ...t, status: 'OCCUPIED' as const, currentOrderId: finalizedOrder.order_id }
        : t
    );
    setTables(updatedTables);
    saveStoredTables(updatedTables);

    // Reset cart and close drawer
    setCart({});
    setIsCartOpen(false);

    // Route to appropriate modal:
    // A. UPI: Open UpiPaymentModal (prompts app or shows QR fallback; status remains PENDING)
    // B. Cash: Directly open OrderReceiptModal with status PENDING
    if (rawMethod === 'UPI') {
      setActiveUpiData({
        order: finalizedOrder,
        upiUri: upiDeepLinkUri,
        upiId: cafeUpiId,
        cafeName: cafePayeeName,
      });
    } else {
      setActiveReceiptOrder(finalizedOrder);
    }
  };

  // Staff Payment Confirmation Workflow (Mark Cash or UPI as PAID)
  const handleConfirmPayment = async (orderId: number) => {
    const updatedOrders = orders.map((o) =>
      o.order_id === orderId ? { ...o, payment_status: 'PAID' as const } : o
    );
    setOrders(updatedOrders);
    saveStoredOrders(updatedOrders);

    if (activeReceiptOrder?.order_id === orderId) {
      setActiveReceiptOrder((prev) => (prev ? { ...prev, payment_status: 'PAID' } : null));
    }
    if (activeUpiData?.order.order_id === orderId) {
      setActiveUpiData((prev) =>
        prev ? { ...prev, order: { ...prev.order, payment_status: 'PAID' } } : null
      );
    }

    await confirmOrderPaymentOnServer(orderId);
  };

  // Admin Order Actions
  const handleUpdateOrderStatus = async (orderId: number, nextStatus: OrderStatus) => {
    const updatedOrders = orders.map((o) => {
      if (o.order_id === orderId) {
        const updated = { ...o, order_status: nextStatus };
        if (activeReceiptOrder?.order_id === orderId) {
          setActiveReceiptOrder(updated);
        }
        return updated;
      }
      return o;
    });
    setOrders(updatedOrders);
    saveStoredOrders(updatedOrders);

    // If completed, release the table
    if (nextStatus === 'COMPLETED') {
      const order = orders.find((o) => o.order_id === orderId);
      if (order) {
        const updatedTables = tables.map((t) =>
          t.table_id === order.table_id
            ? { ...t, status: 'AVAILABLE' as const, currentOrderId: undefined }
            : t
        );
        setTables(updatedTables);
        saveStoredTables(updatedTables);
        await releaseTableOnServer(order.table_id);
      }
    }

    await updateOrderStatusOnServer(orderId, nextStatus);
  };

  const handleCancelOrder = (orderId: number, reason: string) => {
    const updatedOrders = orders.map((o) =>
      o.order_id === orderId ? { ...o, order_status: 'CANCELLED' as const } : o
    );
    setOrders(updatedOrders);
    saveStoredOrders(updatedOrders);

    const order = orders.find((o) => o.order_id === orderId);
    if (order) {
      const updatedTables = tables.map((t) =>
        t.table_id === order.table_id
          ? { ...t, status: 'AVAILABLE' as const, currentOrderId: undefined }
          : t
      );
      setTables(updatedTables);
      saveStoredTables(updatedTables);
    }
  };

  // Menu Management Actions (Syncs to localStorage & BroadcastChannel)
  const handleToggleAvailability = (menuItemId: number) => {
    const updatedMenu = menuItems.map((item) =>
      item.menu_item_id === menuItemId
        ? { ...item, available: (item.available === 'Y' ? 'N' : 'Y') as 'Y' | 'N' }
        : item
    );
    setMenuItems(updatedMenu);
    saveStoredMenuItems(updatedMenu);
  };

  const handleUpdateItemPrice = (menuItemId: number, newPrice: number) => {
    if (newPrice < 0) return;
    const updatedMenu = menuItems.map((item) =>
      item.menu_item_id === menuItemId ? { ...item, price: newPrice } : item
    );
    setMenuItems(updatedMenu);
    saveStoredMenuItems(updatedMenu);
  };

  const handleAddNewMenuItem = (newItem: Omit<MenuItem, 'menu_item_id'>) => {
    const nextId = Math.max(...menuItems.map((m) => m.menu_item_id), 0) + 1;
    const updatedMenu = [...menuItems, { ...newItem, menu_item_id: nextId }];
    setMenuItems(updatedMenu);
    saveStoredMenuItems(updatedMenu);
  };

  const handleDeleteMenuItem = (menuItemId: number) => {
    const updatedMenu = menuItems.map((m) =>
      m.menu_item_id === menuItemId ? { ...m, available: 'N' as const } : m
    );
    setMenuItems(updatedMenu);
    saveStoredMenuItems(updatedMenu);
  };

  const handleReleaseTable = (tableId: number) => {
    const updatedTables = tables.map((t) =>
      t.table_id === tableId ? { ...t, status: 'AVAILABLE' as const, currentOrderId: undefined } : t
    );
    setTables(updatedTables);
    saveStoredTables(updatedTables);
  };

  const handleOpenTableQr = (tableNumber: number) => {
    setTableForQr(tableNumber);
    setIsQrModalOpen(true);
  };

  // When customer scans QR with camera
  const handleCameraTableScanned = (tableNumber: number) => {
    setSelectedTable(tableNumber);
    setIsAdminView(false);
  };

  const handleSimulateScan = (tableNumber: number) => {
    setSelectedTable(tableNumber);
    setIsAdminView(false);
  };

  const cartTotalCount = Object.values(cart).reduce((a, b) => a + b, 0);

  // Orders for current table
  const currentTableOrders = orders.filter((o) => o.table_number === selectedTable);
  const hasActiveOrderOnTable = currentTableOrders.some((o) =>
    ['PLACED', 'PREPARING', 'READY'].includes(o.order_status)
  );

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col text-slate-900 font-sans">
      {/* Top Navbar with Mode Switcher & Cart */}
      <Navbar
        cartCount={cartTotalCount}
        onOpenCart={() => setIsCartOpen(true)}
        selectedTable={selectedTable}
        onOpenOrderStatus={() => setIsOrderStatusOpen(true)}
        onOpenQrScanner={() => setIsCameraQrOpen(true)}
        hasActiveOrder={hasActiveOrderOnTable}
        isAdminView={isAdminView}
        onToggleAdminView={handleToggleAdminView}
      />

      {/* Main Content Area */}
      <main className="flex-1 pb-16">
        {isAdminView ? (
          <AdminDashboard
            menuItems={menuItems}
            tables={tables}
            orders={orders}
            onUpdateOrderStatus={handleUpdateOrderStatus}
            onConfirmPayment={handleConfirmPayment}
            onCancelOrder={handleCancelOrder}
            onToggleAvailability={handleToggleAvailability}
            onUpdateItemPrice={handleUpdateItemPrice}
            onAddNewMenuItem={handleAddNewMenuItem}
            onDeleteMenuItem={handleDeleteMenuItem}
            onReleaseTable={handleReleaseTable}
            onOpenTableQr={handleOpenTableQr}
            onExitToCustomerMenu={() => handleToggleAdminView(false)}
          />
        ) : (
          <CustomerMenu
            menuItems={menuItems}
            cart={cart}
            onAddToCart={handleAddToCart}
            onUpdateQuantity={handleUpdateQuantity}
            selectedTable={selectedTable}
            onOpenTableSelect={() => handleOpenTableQr(selectedTable)}
            onOpenCart={() => setIsCartOpen(true)}
            onOpenOrderStatus={() => setIsOrderStatusOpen(true)}
            onOpenQrScanner={() => setIsCameraQrOpen(true)}
            tableOrders={currentTableOrders}
          />
        )}
      </main>

      {/* Slide-out Cart Drawer */}
      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        cart={cart}
        menuItems={menuItems}
        tables={tables}
        selectedTable={selectedTable}
        onSelectTable={setSelectedTable}
        onUpdateQuantity={handleUpdateQuantity}
        onRemoveItem={handleRemoveFromCart}
        onPlaceOrder={handlePlaceOrder}
      />

      {/* Customer Live Camera QR Scanner Modal */}
      <CameraQrScannerModal
        isOpen={isCameraQrOpen}
        onClose={() => setIsCameraQrOpen(false)}
        onTableScanned={handleCameraTableScanned}
        availableTables={tables.map((t) => t.table_number)}
      />

      {/* Customer Live Order Tracking & Status Modal */}
      <OrderStatusModal
        isOpen={isOrderStatusOpen}
        onClose={() => setIsOrderStatusOpen(false)}
        orders={orders}
        selectedTable={selectedTable}
        initialOrderId={activeReceiptOrder?.order_id || null}
        onOrderMore={() => {
          setIsOrderStatusOpen(false);
          setIsAdminView(false);
        }}
      />

      {/* UPI Payment App Deep Link & Direct Pay Modal */}
      <UpiPaymentModal
        isOpen={activeUpiData !== null}
        onClose={() => setActiveUpiData(null)}
        order={activeUpiData?.order || null}
        upiUri={activeUpiData?.upiUri || ''}
        upiId={activeUpiData?.upiId || 'auracafe@okhdfcbank'}
        cafeName={activeUpiData?.cafeName || 'Aura Cafe'}
        onProceedToReceipt={() => {
          if (activeUpiData?.order) {
            setActiveReceiptOrder(activeUpiData.order);
          }
          setActiveUpiData(null);
        }}
      />

      {/* Immediate Order Placed Receipt Modal */}
      <OrderReceiptModal
        order={activeReceiptOrder}
        isOpen={activeReceiptOrder !== null}
        onClose={() => setActiveReceiptOrder(null)}
        onOrderAgain={() => setIsAdminView(false)}
      />

      {/* Table QR Stand Preview Modal (for printing tent cards) */}
      <QrCodeModal
        tableNumber={tableForQr}
        isOpen={isQrModalOpen}
        onClose={() => setIsQrModalOpen(false)}
        onSimulateScan={handleSimulateScan}
      />

      {/* Clean Cafe Footer */}
      <footer className="bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-800">Aura Cafe & Artisan Bistro</span>
            <span>·</span>
            <span>Real-time Sync Active (Mobile ↔ Laptop)</span>
          </div>
          <div className="flex items-center gap-4 text-slate-500">
            <button
              onClick={() => setIsOrderStatusOpen(true)}
              className="text-amber-700 hover:underline font-semibold cursor-pointer"
            >
              Track Order Status
            </button>
            <span>·</span>
            <button
              onClick={() => setIsCameraQrOpen(true)}
              className="text-slate-600 hover:text-slate-900 font-medium cursor-pointer"
            >
              Scan Table QR
            </button>
            <span>·</span>
            <button
              onClick={() => handleToggleAdminView(!isAdminView)}
              className="text-amber-800 hover:underline font-bold cursor-pointer"
            >
              {isAdminView ? 'Switch to Customer View' : 'Switch to Admin & Kitchen'}
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
