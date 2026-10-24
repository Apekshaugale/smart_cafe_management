import { MenuItem, CafeTable, CafeOrder, OrderStatus } from '../types/cafe';
import { INITIAL_MENU_ITEMS, INITIAL_TABLES, INITIAL_ORDERS } from '../data/initialData';

const MENU_KEY = 'smart_cafe_menu_items_v2';
const TABLES_KEY = 'smart_cafe_tables_v2';
const ORDERS_KEY = 'smart_cafe_orders_v2';
const ADMIN_TOKEN_KEY = 'smart_cafe_admin_jwt_session';

// Same-origin BroadcastChannel for instant local tab sync
let syncChannel: BroadcastChannel | null = null;
try {
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    syncChannel = new BroadcastChannel('smart_cafe_sync_bus');
  }
} catch (e) {
  console.log('BroadcastChannel not available', e);
}

// In-memory version tracker shared across calls
let clientKnownVersion = 0;

// ==========================================
// 1. SECURE ADMIN TOKEN & AUTHENTICATION
// ==========================================

export function getAdminToken(): string | null {
  try {
    return sessionStorage.getItem(ADMIN_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setAdminToken(token: string | null): void {
  try {
    if (token) {
      sessionStorage.setItem(ADMIN_TOKEN_KEY, token);
    } else {
      sessionStorage.removeItem(ADMIN_TOKEN_KEY);
    }
  } catch {}
}

export function isAdminSessionAuthenticated(): boolean {
  return Boolean(getAdminToken());
}

export async function loginAdminOnServer(password: string): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });

    const data = await res.json();
    if (res.ok && data.token) {
      setAdminToken(data.token);
      return { success: true };
    }
    return { success: false, error: data.error || 'Authentication failed. Incorrect password.' };
  } catch {
    return { success: false, error: 'Could not connect to authentication server. Please try again.' };
  }
}

export async function logoutAdminOnServer(): Promise<void> {
  const token = getAdminToken();
  setAdminToken(null);
  if (token) {
    try {
      await fetch('/api/admin/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
    } catch {}
  }
}

export async function verifyAdminSessionOnServer(): Promise<boolean> {
  const token = getAdminToken();
  if (!token) return false;
  try {
    const res = await fetch('/api/admin/verify', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const data = await res.json();
      if (!data.authenticated) {
        setAdminToken(null);
        return false;
      }
      return true;
    }
    setAdminToken(null);
    return false;
  } catch {
    return false;
  }
}

export async function changeAdminPasswordOnServer(
  currentPassword: string,
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  const token = getAdminToken();
  if (!token) return { success: false, error: 'Unauthorized: Please log in again.' };
  try {
    const res = await fetch('/api/admin/change-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    const data = await res.json();
    if (res.ok) return { success: true };
    return { success: false, error: data.error || 'Failed to update password' };
  } catch {
    return { success: false, error: 'Server communication error while changing password' };
  }
}

// ==========================================
// 2. ORDER PLACEMENT & SERVER-SIDE VALIDATION
// ==========================================

export async function placeCustomerOrderOnServer(orderData: {
  tableNumber: number;
  customerName: string;
  customerPhone?: string;
  paymentMethod: 'UPI' | 'Cash';
  notes?: string;
  items: Array<{ menuItemId: number; quantity: number }>;
}): Promise<{
  success: boolean;
  order?: CafeOrder;
  upiUri?: string;
  upiId?: string;
  cafeName?: string;
  formattedAmount?: string;
  error?: string;
}> {
  try {
    const res = await fetch('/api/orders/place', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tableNumber: orderData.tableNumber,
        customerName: orderData.customerName,
        customerPhone: orderData.customerPhone,
        paymentMethod: orderData.paymentMethod,
        notes: orderData.notes,
        items: orderData.items.map((it) => ({
          menu_item_id: it.menuItemId,
          quantity: it.quantity,
        })),
      }),
    });

    const data = await res.json();
    if (res.ok && data.success && data.order) {
      return {
        success: true,
        order: data.order,
        upiUri: data.upiUri,
        upiId: data.upiId,
        cafeName: data.cafeName,
        formattedAmount: data.formattedAmount,
      };
    }
    return { success: false, error: data.error || 'Failed to place order.' };
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error while placing order.' };
  }
}

export async function updateOrderStatusOnServer(orderId: number, status: OrderStatus): Promise<boolean> {
  const token = getAdminToken();
  try {
    const res = await fetch('/api/admin/orders/status', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ orderId, status }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function confirmOrderPaymentOnServer(orderId: number): Promise<boolean> {
  const token = getAdminToken();
  try {
    const res = await fetch('/api/admin/orders/confirm-payment', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ orderId }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function releaseTableOnServer(tableId: number): Promise<boolean> {
  const token = getAdminToken();
  try {
    const res = await fetch('/api/admin/tables/release', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ tableId }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ==========================================
// 3. STORAGE & REPLICATION
// ==========================================

export function loadStoredMenuItems(): MenuItem[] {
  try {
    const raw = localStorage.getItem(MENU_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Error loading menu items from local storage', e);
  }
  return INITIAL_MENU_ITEMS;
}

export function saveStoredMenuItems(items: MenuItem[]) {
  try {
    localStorage.setItem(MENU_KEY, JSON.stringify(items));
    syncChannel?.postMessage({ type: 'MENU_UPDATED', data: items });
  } catch (e) {
    console.error('Error saving menu items to local storage', e);
  }

  const token = getAdminToken();
  if (typeof window !== 'undefined' && token) {
    fetch('/api/sync/menu', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ items }),
    })
      .then((r) => r.json())
      .then((res) => {
        if (res?.version) {
          clientKnownVersion = res.version;
        }
      })
      .catch((err) => console.log('Server menu sync notice:', err));
  }
}

export function loadStoredTables(): CafeTable[] {
  try {
    const raw = localStorage.getItem(TABLES_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Error loading tables from storage', e);
  }
  return INITIAL_TABLES;
}

export function saveStoredTables(tables: CafeTable[]) {
  try {
    localStorage.setItem(TABLES_KEY, JSON.stringify(tables));
    syncChannel?.postMessage({ type: 'TABLES_UPDATED', data: tables });
  } catch (e) {
    console.error('Error saving tables to storage', e);
  }

  const token = getAdminToken();
  if (typeof window !== 'undefined' && token) {
    fetch('/api/sync/tables', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ tables }),
    })
      .then((r) => r.json())
      .then((res) => {
        if (res?.version) {
          clientKnownVersion = res.version;
        }
      })
      .catch(() => {});
  }
}

export function loadStoredOrders(): CafeOrder[] {
  try {
    const raw = localStorage.getItem(ORDERS_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Error loading orders from storage', e);
  }
  return INITIAL_ORDERS;
}

export function saveStoredOrders(orders: CafeOrder[]) {
  try {
    localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
    syncChannel?.postMessage({ type: 'ORDERS_UPDATED', data: orders });
  } catch (e) {
    console.error('Error saving orders to storage', e);
  }
}

// ==========================================
// 4. CROSS-DEVICE SYNC SUBSCRIPTION
// ==========================================

export function subscribeToCrossDeviceSync(callbacks: {
  onMenuUpdated: (items: MenuItem[]) => void;
  onTablesUpdated: (tables: CafeTable[]) => void;
  onOrdersUpdated: (orders: CafeOrder[]) => void;
}) {
  let isUnsubscribed = false;

  const handleStorage = (event: StorageEvent) => {
    if (event.key === MENU_KEY && event.newValue) {
      try {
        callbacks.onMenuUpdated(JSON.parse(event.newValue));
      } catch {}
    } else if (event.key === TABLES_KEY && event.newValue) {
      try {
        callbacks.onTablesUpdated(JSON.parse(event.newValue));
      } catch {}
    } else if (event.key === ORDERS_KEY && event.newValue) {
      try {
        callbacks.onOrdersUpdated(JSON.parse(event.newValue));
      } catch {}
    }
  };

  const handleBroadcast = (event: MessageEvent) => {
    if (!event.data) return;
    if (event.data.type === 'MENU_UPDATED') {
      callbacks.onMenuUpdated(event.data.data);
    } else if (event.data.type === 'TABLES_UPDATED') {
      callbacks.onTablesUpdated(event.data.data);
    } else if (event.data.type === 'ORDERS_UPDATED') {
      callbacks.onOrdersUpdated(event.data.data);
    }
  };

  window.addEventListener('storage', handleStorage);
  syncChannel?.addEventListener('message', handleBroadcast);

  const fetchFullState = async () => {
    if (isUnsubscribed) return;
    try {
      const res = await fetch('/api/sync');
      if (res.ok) {
        const json = await res.json();
        if (json.data && !isUnsubscribed) {
          if (json.version) {
            clientKnownVersion = json.version;
          }
          if (Array.isArray(json.data.menuItems)) {
            localStorage.setItem(MENU_KEY, JSON.stringify(json.data.menuItems));
            callbacks.onMenuUpdated(json.data.menuItems);
          }
          if (Array.isArray(json.data.tables)) {
            localStorage.setItem(TABLES_KEY, JSON.stringify(json.data.tables));
            callbacks.onTablesUpdated(json.data.tables);
          }
          if (Array.isArray(json.data.orders)) {
            localStorage.setItem(ORDERS_KEY, JSON.stringify(json.data.orders));
            callbacks.onOrdersUpdated(json.data.orders);
          }
        }
      }
    } catch {}
  };

  fetchFullState();

  const handleVisibilityChange = () => {
    if (!document.hidden) {
      fetchFullState();
    }
  };
  const handleFocus = () => {
    fetchFullState();
  };
  window.addEventListener('focus', handleFocus);
  document.addEventListener('visibilitychange', handleVisibilityChange);

  let eventSource: EventSource | null = null;
  const initSSE = () => {
    try {
      if (eventSource) eventSource.close();
      eventSource = new EventSource('/api/events');

      eventSource.onmessage = (event) => {
        if (isUnsubscribed) return;
        try {
          const payload = JSON.parse(event.data);
          if (payload.version) {
            clientKnownVersion = payload.version;
          }

          if (payload.type === 'MENU_UPDATED' || payload.type === 'INIT_SYNC') {
            const items = payload.type === 'INIT_SYNC' ? payload.data.menuItems : payload.data;
            if (Array.isArray(items)) {
              localStorage.setItem(MENU_KEY, JSON.stringify(items));
              callbacks.onMenuUpdated(items);
            }
          }
          if (payload.type === 'TABLES_UPDATED' || payload.type === 'INIT_SYNC') {
            const tables = payload.type === 'INIT_SYNC' ? payload.data.tables : payload.data;
            if (Array.isArray(tables)) {
              localStorage.setItem(TABLES_KEY, JSON.stringify(tables));
              callbacks.onTablesUpdated(tables);
            }
          }
          if (payload.type === 'ORDERS_UPDATED' || payload.type === 'INIT_SYNC') {
            const orders = payload.type === 'INIT_SYNC' ? payload.data.orders : payload.data;
            if (Array.isArray(orders)) {
              localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
              callbacks.onOrdersUpdated(orders);
            }
          }
        } catch (err) {
          console.log('Error parsing SSE event', err);
        }
      };
    } catch (e) {
      console.log('SSE connection init error', e);
    }
  };
  initSSE();

  const pollInterval = setInterval(async () => {
    if (isUnsubscribed) return;
    try {
      const res = await fetch('/api/sync/version');
      if (res.ok) {
        const json = await res.json();
        if (json.version && json.version !== clientKnownVersion) {
          await fetchFullState();
        }
      }
    } catch {}
  }, 1200);

  return () => {
    isUnsubscribed = true;
    window.removeEventListener('storage', handleStorage);
    syncChannel?.removeEventListener('message', handleBroadcast);
    window.removeEventListener('focus', handleFocus);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    eventSource?.close();
    clearInterval(pollInterval);
  };
}

export async function compressImageToDataUrl(
  fileOrBlob: Blob,
  maxDim = 640,
  quality = 0.78
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(fileOrBlob);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas 2D context error'));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image for compression'));
    };
    img.src = url;
  });
}
