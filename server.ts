import 'dotenv/config';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { INITIAL_MENU_ITEMS, INITIAL_TABLES, INITIAL_ORDERS } from './src/data/initialData.ts';
import { MenuItem, CafeTable, CafeOrder, OrderStatus } from './src/types/cafe.ts';
import { connectDatabase, loadStateFromDb, saveStateToDb } from './db.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cafe UPI Configuration (from environment variables or defaults)
const CAFE_UPI_ID = process.env.CAFE_UPI_ID || 'auracafe@okhdfcbank';
const CAFE_NAME = process.env.CAFE_NAME || 'Aura Cafe';

// Secure Password Hashing with PBKDF2 and Salt
function hashPassword(password: string, salt: string): string {
  return crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
}

let adminSalt = crypto.randomBytes(16).toString('hex');
let adminPasswordHash = hashPassword(process.env.ADMIN_PASSWORD || 'cafe123', adminSalt);

// Active Admin Session Tokens (in-memory with 24h expiration)
const activeAdminSessions = new Map<string, number>();

function verifyPassword(password: string): boolean {
  try {
    const candidateHash = hashPassword(password, adminSalt);
    return crypto.timingSafeEqual(
      Buffer.from(candidateHash, 'hex'),
      Buffer.from(adminPasswordHash, 'hex')
    );
  } catch {
    return false;
  }
}

// Admin Authentication Middleware for Protecting Admin Routes & APIs
function requireAdminAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7).trim()
    : ((req.headers['x-admin-token'] as string) || '').trim();

  if (!token || !activeAdminSessions.has(token)) {
    return res.status(401).json({
      error: 'Access Denied: Administrator authentication required.',
    });
  }

  const expiry = activeAdminSessions.get(token)!;
  if (Date.now() > expiry) {
    activeAdminSessions.delete(token);
    return res.status(401).json({
      error: 'Admin session expired. Please sign in again.',
    });
  }

  // Slide expiration by 24h on active use
  activeAdminSessions.set(token, Date.now() + 24 * 60 * 60 * 1000);
  next();
}

// In-memory persistent state synchronized across all connected devices
let currentMenuItems: MenuItem[] = [...INITIAL_MENU_ITEMS];
let currentTables: CafeTable[] = [...INITIAL_TABLES];
let currentOrders: CafeOrder[] = [...INITIAL_ORDERS];
let syncVersion = Date.now();

function saveStateToDisk() {
  // Persist the current state into MySQL (queued, runs in the background)
  saveStateToDb({
    menuItems: currentMenuItems,
    tables: currentTables,
    orders: currentOrders,
    adminSalt,
    adminPasswordHash,
  }).catch((err) => console.error('[MySQL] Error writing state', err));
}

// Load persisted state from MySQL (called once before the server starts listening)
async function loadPersistedState() {
  const connected = await connectDatabase();
  if (!connected) return;

  try {
    const saved = await loadStateFromDb();
    if (saved) {
      if (saved.menuItems.length > 0) currentMenuItems = saved.menuItems;
      if (saved.tables.length > 0) currentTables = saved.tables;
      currentOrders = saved.orders;
      if (saved.adminSalt && saved.adminPasswordHash && !process.env.ADMIN_PASSWORD) {
        adminSalt = saved.adminSalt;
        adminPasswordHash = saved.adminPasswordHash;
      }
      console.log(
        `[MySQL] Restored cafe state from database (${currentMenuItems.length} menu items, ${currentOrders.length} orders)`
      );
    } else {
      // First run: seed the database with the default menu, tables and orders
      saveStateToDisk();
      console.log('[MySQL] Empty database detected - seeding default cafe data');
    }
  } catch (err) {
    console.warn('[MySQL] Could not read state from database, using defaults', err);
  }
}

// Connected SSE clients for instantaneous real-time push to mobile & laptop
const sseClients: express.Response[] = [];

function broadcastUpdate(type: string, data: any) {
  syncVersion = Date.now();
  saveStateToDisk();

  const payload = JSON.stringify({
    type,
    version: syncVersion,
    data,
    timestamp: Date.now(),
  });

  for (let i = sseClients.length - 1; i >= 0; i--) {
    const client = sseClients[i];
    try {
      client.write(`data: ${payload}\n\n`);
      if (typeof (client as any).flush === 'function') {
        (client as any).flush();
      }
    } catch {
      sseClients.splice(i, 1);
    }
  }
}

async function startServer() {
  await loadPersistedState();

  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  // Support JSON payloads up to 25MB for mobile camera food photo uploads
  app.use(express.json({ limit: '25mb' }));
  app.use(express.urlencoded({ extended: true, limit: '25mb' }));

  // Global CORS headers
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, X-Admin-Token');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  // ==========================================
  // 1. ADMIN AUTHENTICATION ENDPOINTS
  // ==========================================

  // Admin login with password verification
  app.post('/api/admin/login', (req, res) => {
    const { password } = req.body;
    if (!password || typeof password !== 'string') {
      return res.status(400).json({ error: 'Password is required' });
    }

    if (verifyPassword(password.trim())) {
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = Date.now() + 24 * 60 * 60 * 1000;
      activeAdminSessions.set(token, expiresAt);
      console.log('[Auth] Admin successfully authenticated');
      return res.json({
        success: true,
        token,
        expiresAt,
      });
    }

    console.warn('[Auth] Failed admin login attempt');
    return res.status(401).json({
      error: 'Incorrect administrator password. Access denied.',
    });
  });

  // Admin logout (invalidates session on server)
  app.post('/api/admin/logout', (req, res) => {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ')
      ? authHeader.slice(7).trim()
      : ((req.headers['x-admin-token'] as string) || '').trim();

    if (token) {
      activeAdminSessions.delete(token);
    }
    return res.json({ success: true, message: 'Logged out successfully' });
  });

  // Verify admin session validity
  app.get('/api/admin/verify', (req, res) => {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ')
      ? authHeader.slice(7).trim()
      : ((req.headers['x-admin-token'] as string) || '').trim();

    const isValid = token && activeAdminSessions.has(token) && (activeAdminSessions.get(token)! > Date.now());
    return res.json({ authenticated: Boolean(isValid) });
  });

  // Change admin password (requires current admin authentication)
  app.post('/api/admin/change-password', requireAdminAuth, (req, res) => {
    const { currentPassword, newPassword } = req.body;
    if (!newPassword || typeof newPassword !== 'string' || newPassword.trim().length < 4) {
      return res.status(400).json({ error: 'New password must be at least 4 characters.' });
    }

    if (currentPassword && !verifyPassword(currentPassword.trim())) {
      return res.status(400).json({ error: 'Current password does not match.' });
    }

    adminSalt = crypto.randomBytes(16).toString('hex');
    adminPasswordHash = hashPassword(newPassword.trim(), adminSalt);
    saveStateToDisk();
    console.log('[Auth] Admin password changed successfully');
    return res.json({ success: true, message: 'Admin password updated successfully' });
  });

  // ==========================================
  // 2. CUSTOMER ORDER PLACEMENT & UPI FLOW
  // ==========================================

  // Server-side calculation and order placement
  app.post('/api/orders/place', (req, res) => {
    const { tableNumber, customerName, customerPhone, paymentMethod, notes, items } = req.body;

    if (!tableNumber || typeof tableNumber !== 'number') {
      return res.status(400).json({ error: 'Valid table number is required' });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Order must contain at least one item' });
    }

    // Server-side validation of ordered items and calculation of totals
    const validatedItems: Array<{
      order_item_id: number;
      order_id: number;
      menu_item_id: number;
      item_name: string;
      quantity: number;
      unit_price: number;
    }> = [];

    let subtotal = 0;
    const newOrderId = Math.max(...currentOrders.map((o) => o.order_id), 100) + 1;

    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const menuItem = currentMenuItems.find((m) => m.menu_item_id === Number(it.menu_item_id));
      if (!menuItem) {
        return res.status(400).json({ error: `Menu item with id ${it.menu_item_id} not found` });
      }
      if (menuItem.available === 'N') {
        return res.status(400).json({ error: `Dish "${menuItem.item_name}" is currently unavailable` });
      }

      const qty = Math.max(1, parseInt(it.quantity, 10) || 1);
      const itemSubtotal = menuItem.price * qty;
      subtotal += itemSubtotal;

      validatedItems.push({
        order_item_id: Number(`${newOrderId}${i + 1}`),
        order_id: newOrderId,
        menu_item_id: menuItem.menu_item_id,
        item_name: menuItem.item_name,
        quantity: qty,
        unit_price: menuItem.price,
      });
    }

    // Accurate server-calculated bill (5% Restaurant GST)
    const gstRate = 0.05;
    const gstAmount = Math.round((subtotal * gstRate + Number.EPSILON) * 100) / 100;
    const total_amount = Math.round((subtotal + gstAmount + Number.EPSILON) * 100) / 100;

    const matchedTable = currentTables.find((t) => t.table_number === tableNumber);
    const table_id = matchedTable ? matchedTable.table_id : tableNumber;

    const now = new Date();
    const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Payment method strictly limited to 'UPI' or 'Cash'
    const finalPaymentMethod: 'UPI' | 'Cash' = paymentMethod === 'Cash' ? 'Cash' : 'UPI';

    // Payment is always PENDING initially until confirmed
    const newOrder: CafeOrder = {
      order_id: newOrderId,
      table_id,
      table_number: tableNumber,
      customer_name: (typeof customerName === 'string' && customerName.trim()) || 'Guest Diner',
      customer_phone: (typeof customerPhone === 'string' && customerPhone.trim()) || undefined,
      order_status: 'PLACED',
      total_amount,
      payment_method: finalPaymentMethod,
      payment_status: 'PENDING',
      created_at: timeString,
      notes: (typeof notes === 'string' && notes.trim()) || undefined,
      items: validatedItems,
    };

    // Update in-memory state
    currentOrders = [newOrder, ...currentOrders];

    // Mark table as OCCUPIED
    currentTables = currentTables.map((t) =>
      t.table_number === tableNumber ? { ...t, status: 'OCCUPIED' as const, currentOrderId: newOrderId } : t
    );

    // Generate supported NPCI UPI Payment URI with server-calculated fixed amount
    const orderRef = `Order #${newOrderId}`;
    const upiUri =
      `upi://pay?pa=${encodeURIComponent(CAFE_UPI_ID)}` +
      `&pn=${encodeURIComponent(CAFE_NAME)}` +
      `&am=${total_amount.toFixed(2)}` +
      `&cu=INR` +
      `&tn=${encodeURIComponent(orderRef + ' Table ' + tableNumber)}`;

    broadcastUpdate('ORDERS_UPDATED', currentOrders);
    broadcastUpdate('TABLES_UPDATED', currentTables);

    return res.json({
      success: true,
      order: newOrder,
      upiUri,
      upiId: CAFE_UPI_ID,
      cafeName: CAFE_NAME,
      formattedAmount: total_amount.toFixed(2),
      orderReference: orderRef,
    });
  });

  // ==========================================
  // 3. PROTECTED ADMIN OPERATIONS
  // ==========================================

  // Admin order status update (PLACED -> PREPARING -> READY -> COMPLETED / CANCELLED)
  app.post('/api/admin/orders/status', requireAdminAuth, (req, res) => {
    const { orderId, status } = req.body;
    if (!orderId || !status) {
      return res.status(400).json({ error: 'Order ID and status are required' });
    }

    currentOrders = currentOrders.map((o) => (o.order_id === Number(orderId) ? { ...o, order_status: status as OrderStatus } : o));

    // Release table if completed or cancelled
    if (status === 'COMPLETED' || status === 'CANCELLED') {
      const order = currentOrders.find((o) => o.order_id === Number(orderId));
      if (order) {
        currentTables = currentTables.map((t) =>
          t.table_id === order.table_id ? { ...t, status: 'AVAILABLE' as const, currentOrderId: undefined } : t
        );
        broadcastUpdate('TABLES_UPDATED', currentTables);
      }
    }

    broadcastUpdate('ORDERS_UPDATED', currentOrders);
    return res.json({ success: true, orders: currentOrders });
  });

  // Admin confirmation of payment (confirms Cash receipt or verifies UPI payment)
  app.post('/api/admin/orders/confirm-payment', requireAdminAuth, (req, res) => {
    const { orderId } = req.body;
    if (!orderId) {
      return res.status(400).json({ error: 'Order ID is required' });
    }

    let found = false;
    currentOrders = currentOrders.map((o) => {
      if (o.order_id === Number(orderId)) {
        found = true;
        return { ...o, payment_status: 'PAID' as const };
      }
      return o;
    });

    if (!found) {
      return res.status(404).json({ error: 'Order not found' });
    }

    broadcastUpdate('ORDERS_UPDATED', currentOrders);
    return res.json({ success: true, message: 'Payment confirmed as PAID', orders: currentOrders });
  });

  // Update menu items (Protected: Only authenticated admin can add/edit/delete dishes)
  app.post('/api/sync/menu', requireAdminAuth, (req, res) => {
    const { items } = req.body;
    if (Array.isArray(items)) {
      currentMenuItems = items;
      broadcastUpdate('MENU_UPDATED', currentMenuItems);
      return res.json({ success: true, version: syncVersion, count: currentMenuItems.length });
    }
    res.status(400).json({ error: 'Invalid items array' });
  });

  // Update tables (Protected)
  app.post('/api/sync/tables', requireAdminAuth, (req, res) => {
    const { tables } = req.body;
    if (Array.isArray(tables)) {
      currentTables = tables;
      broadcastUpdate('TABLES_UPDATED', currentTables);
      return res.json({ success: true, version: syncVersion });
    }
    res.status(400).json({ error: 'Invalid tables array' });
  });

  // Update orders array directly (Protected)
  app.post('/api/sync/orders', requireAdminAuth, (req, res) => {
    const { orders } = req.body;
    if (Array.isArray(orders)) {
      currentOrders = orders;
      broadcastUpdate('ORDERS_UPDATED', currentOrders);
      return res.json({ success: true, version: syncVersion });
    }
    res.status(400).json({ error: 'Invalid orders array' });
  });

  // Release table (Protected)
  app.post('/api/admin/tables/release', requireAdminAuth, (req, res) => {
    const { tableId } = req.body;
    currentTables = currentTables.map((t) =>
      t.table_id === Number(tableId) ? { ...t, status: 'AVAILABLE' as const, currentOrderId: undefined } : t
    );
    broadcastUpdate('TABLES_UPDATED', currentTables);
    return res.json({ success: true, tables: currentTables });
  });

  // ==========================================
  // 4. PUBLIC SYNC & REAL-TIME EVENT STREAM
  // ==========================================

  // Fast version check endpoint (<1ms response)
  app.get('/api/sync/version', (_req, res) => {
    res.json({
      success: true,
      version: syncVersion,
      clientCount: sseClients.length,
      timestamp: Date.now(),
    });
  });

  // Public state endpoint (Notice: password is NOT exposed)
  app.get('/api/sync', (_req, res) => {
    res.json({
      success: true,
      version: syncVersion,
      data: {
        menuItems: currentMenuItems,
        tables: currentTables,
        orders: currentOrders,
        cafeConfig: {
          cafeUpiId: CAFE_UPI_ID,
          cafeName: CAFE_NAME,
        },
      },
    });
  });

  // Real-time Server-Sent Events stream (Notice: password is NOT exposed)
  app.get('/api/events', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.flushHeaders?.();

    // Send initial handshake state
    res.write(
      `data: ${JSON.stringify({
        type: 'INIT_SYNC',
        version: syncVersion,
        data: {
          menuItems: currentMenuItems,
          tables: currentTables,
          orders: currentOrders,
          cafeConfig: {
            cafeUpiId: CAFE_UPI_ID,
            cafeName: CAFE_NAME,
          },
        },
      })}\n\n`
    );

    sseClients.push(res);

    // Keep-alive heartbeat ping every 10 seconds
    const pingTimer = setInterval(() => {
      try {
        res.write(': keep-alive ping\n\n');
      } catch {
        clearInterval(pingTimer);
      }
    }, 10000);

    req.on('close', () => {
      clearInterval(pingTimer);
      const idx = sseClients.indexOf(res);
      if (idx !== -1) sseClients.splice(idx, 1);
    });
  });

  // Vite middleware in dev or static files in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
