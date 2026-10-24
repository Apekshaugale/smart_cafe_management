import mysql from 'mysql2/promise';
import { MenuItem, CafeTable, CafeOrder } from './src/types/cafe.ts';

// ------------------------------------------------------------------
// MySQL connection settings (read from .env)
// ------------------------------------------------------------------
const DB_HOST = process.env.DB_HOST || '127.0.0.1';
const DB_PORT = process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 3306;
const DB_USER = process.env.DB_USER || 'root';
const DB_PASSWORD = process.env.DB_PASSWORD || '';
const DB_NAME = process.env.DB_NAME || 'cafe_db';

let pool: mysql.Pool | null = null;

// ------------------------------------------------------------------
// SCHEMA
//
//  RELATIONSHIPS
//  ONE-TO-MANY
//    cafe_tables  1 --- N  orders          (one table has many orders)
//    cafe_tables  1 --- N  bills           (one table has many bills)
//    orders       1 --- N  order_items     (one order has many dishes)
//    menu_items   1 --- N  order_items     (one dish appears in many order lines)
//  MANY-TO-MANY (junction tables)
//    orders  N --- N  menu_items   via  order_items
//    bills   N --- N  orders       via  bill_orders
//
//  DAY-WISE HISTORY (one row per day, old days are never deleted)
//    daily_menu         menu of every day
//    daily_tables       status of every table on every day
//    daily_sales        orders / revenue of every day
//    daily_table_sales  orders / revenue of every table on every day
// ------------------------------------------------------------------
const CREATE_TABLES_SQL = [
  `CREATE TABLE IF NOT EXISTS menu_items (
    menu_item_id INT PRIMARY KEY,
    sort_order INT NOT NULL DEFAULT 0,
    item_name VARCHAR(150) NOT NULL,
    category VARCHAR(50) NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    available CHAR(1) NOT NULL DEFAULT 'Y',
    description TEXT,
    is_veg TINYINT(1) NOT NULL DEFAULT 1,
    is_bestseller TINYINT(1) NOT NULL DEFAULT 0,
    calories INT NULL,
    prep_time_minutes INT NULL,
    image_url MEDIUMTEXT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS cafe_tables (
    table_id INT PRIMARY KEY,
    sort_order INT NOT NULL DEFAULT 0,
    table_number INT NOT NULL,
    capacity INT NULL,
    floor VARCHAR(50) NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'AVAILABLE',
    current_order_id INT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS orders (
    order_id INT PRIMARY KEY,
    sort_order INT NOT NULL DEFAULT 0,
    table_id INT NULL,
    table_number INT NULL,
    customer_name VARCHAR(100) NULL,
    customer_phone VARCHAR(30) NULL,
    order_status VARCHAR(20) NOT NULL,
    total_amount DECIMAL(10,2) NOT NULL,
    payment_method VARCHAR(10) NULL,
    payment_status VARCHAR(10) NULL,
    created_at VARCHAR(30) NULL,
    notes TEXT NULL,
    order_date DATE NULL,
    CONSTRAINT fk_orders_table
      FOREIGN KEY (table_id) REFERENCES cafe_tables(table_id) ON DELETE SET NULL
  )`,
  `CREATE TABLE IF NOT EXISTS order_items (
    order_item_id BIGINT PRIMARY KEY,
    order_id INT NOT NULL,
    menu_item_id INT NULL,
    item_name VARCHAR(150) NULL,
    quantity INT NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    CONSTRAINT fk_order_items_order
      FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE,
    CONSTRAINT fk_order_items_menu
      FOREIGN KEY (menu_item_id) REFERENCES menu_items(menu_item_id) ON DELETE SET NULL
  )`,
  `CREATE TABLE IF NOT EXISTS bills (
    bill_id INT AUTO_INCREMENT PRIMARY KEY,
    bill_number VARCHAR(40) NOT NULL UNIQUE,
    table_id INT NULL,
    table_number INT NULL,
    customer_name VARCHAR(100) NULL,
    bill_date DATE NOT NULL,
    subtotal DECIMAL(10,2) NOT NULL,
    gst_rate DECIMAL(5,2) NOT NULL DEFAULT 5.00,
    tax_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    total_amount DECIMAL(10,2) NOT NULL,
    payment_method VARCHAR(10) NULL,
    payment_status VARCHAR(10) NULL,
    paid_at DATETIME NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_bills_table
      FOREIGN KEY (table_id) REFERENCES cafe_tables(table_id) ON DELETE SET NULL
  )`,
  `CREATE TABLE IF NOT EXISTS bill_orders (
    bill_id INT NOT NULL,
    order_id INT NOT NULL,
    PRIMARY KEY (bill_id, order_id),
    CONSTRAINT fk_bill_orders_bill
      FOREIGN KEY (bill_id) REFERENCES bills(bill_id) ON DELETE CASCADE,
    CONSTRAINT fk_bill_orders_order
      FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS daily_menu (
    menu_date DATE NOT NULL,
    menu_item_id INT NOT NULL,
    item_name VARCHAR(150) NOT NULL,
    category VARCHAR(50) NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    available CHAR(1) NOT NULL DEFAULT 'Y',
    description TEXT,
    is_veg TINYINT(1) NOT NULL DEFAULT 1,
    is_bestseller TINYINT(1) NOT NULL DEFAULT 0,
    calories INT NULL,
    prep_time_minutes INT NULL,
    PRIMARY KEY (menu_date, menu_item_id)
  )`,
  `CREATE TABLE IF NOT EXISTS daily_tables (
    snapshot_date DATE NOT NULL,
    table_id INT NOT NULL,
    table_number INT NOT NULL,
    capacity INT NULL,
    floor VARCHAR(50) NULL,
    status VARCHAR(20) NOT NULL,
    current_order_id INT NULL,
    PRIMARY KEY (snapshot_date, table_id)
  )`,
  `CREATE TABLE IF NOT EXISTS daily_sales (
    sales_date DATE PRIMARY KEY,
    total_orders INT NOT NULL DEFAULT 0,
    paid_orders INT NOT NULL DEFAULT 0,
    cancelled_orders INT NOT NULL DEFAULT 0,
    total_revenue DECIMAL(12,2) NOT NULL DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS daily_table_sales (
    sales_date DATE NOT NULL,
    table_id INT NOT NULL,
    table_number INT NOT NULL,
    orders_count INT NOT NULL DEFAULT 0,
    total_revenue DECIMAL(12,2) NOT NULL DEFAULT 0,
    PRIMARY KEY (sales_date, table_id)
  )`,
  `CREATE TABLE IF NOT EXISTS settings (
    setting_key VARCHAR(50) PRIMARY KEY,
    setting_value TEXT NULL
  )`,
];

async function columnExists(table: string, column: string): Promise<boolean> {
  const [rows] = (await pool!.query(
    'SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?',
    [DB_NAME, table, column]
  )) as any;
  return rows.length > 0;
}

async function constraintExists(table: string, name: string): Promise<boolean> {
  const [rows] = (await pool!.query(
    'SELECT 1 FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = ? AND TABLE_NAME = ? AND CONSTRAINT_NAME = ?',
    [DB_NAME, table, name]
  )) as any;
  return rows.length > 0;
}

/** Upgrades a database that was created by the older version of this app. */
async function migrateSchema(): Promise<void> {
  const step = async (label: string, fn: () => Promise<void>) => {
    try {
      await fn();
    } catch (err: any) {
      console.warn(`[MySQL] Migration step "${label}" skipped: ${err?.message || err}`);
    }
  };

  await step('orders.order_date', async () => {
    if (!(await columnExists('orders', 'order_date'))) {
      await pool!.query('ALTER TABLE orders ADD COLUMN order_date DATE NULL');
    }
    await pool!.query('UPDATE orders SET order_date = CURDATE() WHERE order_date IS NULL');
  });

  await step('fk_orders_table', async () => {
    if (!(await constraintExists('orders', 'fk_orders_table'))) {
      await pool!.query(
        'UPDATE orders SET table_id = NULL WHERE table_id IS NOT NULL AND table_id NOT IN (SELECT table_id FROM cafe_tables)'
      );
      await pool!.query(
        'ALTER TABLE orders ADD CONSTRAINT fk_orders_table FOREIGN KEY (table_id) REFERENCES cafe_tables(table_id) ON DELETE SET NULL'
      );
    }
  });

  await step('fk_order_items_menu', async () => {
    if (!(await constraintExists('order_items', 'fk_order_items_menu'))) {
      await pool!.query(
        'UPDATE order_items SET menu_item_id = NULL WHERE menu_item_id IS NOT NULL AND menu_item_id NOT IN (SELECT menu_item_id FROM menu_items)'
      );
      await pool!.query(
        'ALTER TABLE order_items ADD CONSTRAINT fk_order_items_menu FOREIGN KEY (menu_item_id) REFERENCES menu_items(menu_item_id) ON DELETE SET NULL'
      );
    }
  });

  // Create bills for orders that already existed before the bills table was added
  await step('backfill bills', async () => {
    await pool!.query(
      `INSERT INTO bills (bill_number, table_id, table_number, customer_name, bill_date, subtotal,
                          tax_amount, total_amount, payment_method, payment_status, paid_at)
       SELECT CONCAT('BILL-', o.order_id), o.table_id, o.table_number, o.customer_name,
              COALESCE(o.order_date, CURDATE()),
              COALESCE(s.sub, o.total_amount),
              GREATEST(o.total_amount - COALESCE(s.sub, o.total_amount), 0),
              o.total_amount, o.payment_method, o.payment_status,
              IF(o.payment_status = 'PAID', NOW(), NULL)
       FROM orders o
       LEFT JOIN (SELECT order_id, SUM(quantity * unit_price) AS sub FROM order_items GROUP BY order_id) s
              ON s.order_id = o.order_id
       WHERE NOT EXISTS (SELECT 1 FROM bills b WHERE b.bill_number = CONCAT('BILL-', o.order_id))`
    );
    await pool!.query(
      `INSERT IGNORE INTO bill_orders (bill_id, order_id)
       SELECT b.bill_id, o.order_id FROM orders o
       JOIN bills b ON b.bill_number = CONCAT('BILL-', o.order_id)`
    );
  });
}

/**
 * Connects to MySQL, creates the database + tables if they do not exist.
 * Returns true when the database is ready to use.
 */
export async function connectDatabase(): Promise<boolean> {
  try {
    // 1) Connect without a database first so we can create it if missing
    const bootstrap = await mysql.createConnection({
      host: DB_HOST,
      port: DB_PORT,
      user: DB_USER,
      password: DB_PASSWORD,
    });
    await bootstrap.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\``);
    await bootstrap.end();

    // 2) Create the real connection pool
    pool = mysql.createPool({
      host: DB_HOST,
      port: DB_PORT,
      user: DB_USER,
      password: DB_PASSWORD,
      database: DB_NAME,
      waitForConnections: true,
      connectionLimit: 10,
      decimalNumbers: true, // return DECIMAL columns as JS numbers
      dateStrings: true, // return DATE columns as 'YYYY-MM-DD' text
    });

    // 3) Create tables, then upgrade an older database if needed
    for (const sql of CREATE_TABLES_SQL) {
      await pool.query(sql);
    }
    await migrateSchema();

    startDailyTimer();

    console.log(`[MySQL] Connected to "${DB_NAME}" at ${DB_HOST}:${DB_PORT} as ${DB_USER}`);
    return true;
  } catch (err: any) {
    pool = null;
    console.error('==================================================');
    console.error('[MySQL] COULD NOT CONNECT TO DATABASE');
    console.error(`[MySQL] ${err?.code || ''} ${err?.message || err}`);
    console.error('[MySQL] Check DB_HOST / DB_USER / DB_PASSWORD / DB_NAME in your .env file');
    console.error('[MySQL] and make sure the MySQL server is running.');
    console.error('[MySQL] The app will keep running, but data will NOT be saved.');
    console.error('==================================================');
    return false;
  }
}

export function isDatabaseReady(): boolean {
  return pool !== null;
}

export interface CafeState {
  menuItems: MenuItem[];
  tables: CafeTable[];
  orders: CafeOrder[];
  adminSalt?: string;
  adminPasswordHash?: string;
}

/**
 * Reads the whole cafe state from MySQL.
 * Returns null when the database is empty (first run).
 */
export async function loadStateFromDb(): Promise<CafeState | null> {
  if (!pool) return null;

  const [menuRows] = (await pool.query('SELECT * FROM menu_items ORDER BY sort_order ASC')) as any;
  if (!menuRows || menuRows.length === 0) return null;

  const [tableRows] = (await pool.query('SELECT * FROM cafe_tables ORDER BY sort_order ASC')) as any;
  const [orderRows] = (await pool.query('SELECT * FROM orders ORDER BY order_id DESC')) as any;
  const [itemRows] = (await pool.query('SELECT * FROM order_items ORDER BY order_item_id ASC')) as any;
  const [settingRows] = (await pool.query('SELECT * FROM settings')) as any;

  const menuItems: MenuItem[] = menuRows.map((r: any) => ({
    menu_item_id: Number(r.menu_item_id),
    item_name: r.item_name,
    category: r.category,
    price: Number(r.price),
    available: r.available,
    description: r.description ?? '',
    isVeg: !!r.is_veg,
    isBestseller: r.is_bestseller ? true : undefined,
    calories: r.calories ?? undefined,
    prepTimeMinutes: r.prep_time_minutes ?? 0,
    imageUrl: r.image_url ?? undefined,
  }));

  const tables: CafeTable[] = tableRows.map((r: any) => ({
    table_id: Number(r.table_id),
    table_number: Number(r.table_number),
    capacity: Number(r.capacity),
    floor: r.floor,
    status: r.status,
    currentOrderId: r.current_order_id ?? undefined,
  }));

  const orders: CafeOrder[] = orderRows.map((r: any) => ({
    order_id: Number(r.order_id),
    table_id: Number(r.table_id),
    table_number: Number(r.table_number),
    customer_name: r.customer_name,
    customer_phone: r.customer_phone ?? undefined,
    order_status: r.order_status,
    total_amount: Number(r.total_amount),
    payment_method: r.payment_method,
    payment_status: r.payment_status,
    created_at: r.created_at,
    notes: r.notes ?? undefined,
    items: itemRows
      .filter((i: any) => Number(i.order_id) === Number(r.order_id))
      .map((i: any) => ({
        order_item_id: Number(i.order_item_id),
        order_id: Number(i.order_id),
        menu_item_id: Number(i.menu_item_id),
        item_name: i.item_name,
        quantity: Number(i.quantity),
        unit_price: Number(i.unit_price),
      })),
  }));

  const settings: Record<string, string> = {};
  for (const s of settingRows) settings[s.setting_key] = s.setting_value;

  const loaded: CafeState = {
    menuItems,
    tables,
    orders,
    adminSalt: settings.adminSalt,
    adminPasswordHash: settings.adminPasswordHash,
  };

  // Remember what is already in the database so later saves only write the changes
  lastSaved = buildSnapshot(loaded);
  latestState = loaded;

  // Make sure today's day-wise rows exist (menu, tables, sales) right after start-up
  saveStateToDb(loaded).catch(() => {});

  return loaded;
}

// ------------------------------------------------------------------
// Incremental saving
//  - NEW rows are INSERTed, CHANGED rows are UPDATEd (only those rows).
//  - Orders and bills are never deleted: they stay as history.
//  - Menu items / tables are deleted from the live tables only when they are
//    really deleted in the app (their old days stay in the daily_* tables).
//  - Every day gets its own rows in daily_menu, daily_tables, daily_sales
//    and daily_table_sales. Old days are never touched.
// ------------------------------------------------------------------
type Snapshot = {
  menu: Map<number, string>;
  tables: Map<number, string>;
  orders: Map<number, string>;
  settings: string;
};

let lastSaved: Snapshot = { menu: new Map(), tables: new Map(), orders: new Map(), settings: '' };
let latestState: CafeState | null = null;
let lastSnapshotDate = '';

const menuSig = (m: MenuItem, idx: number) => JSON.stringify([idx, m]);
const tableSig = (t: CafeTable, idx: number) => JSON.stringify([idx, t]);
const orderSig = (o: CafeOrder) => JSON.stringify(o);

function todayStr(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function buildSnapshot(state: CafeState): Snapshot {
  return {
    menu: new Map(state.menuItems.map((m, i) => [m.menu_item_id, menuSig(m, i)])),
    tables: new Map(state.tables.map((t, i) => [t.table_id, tableSig(t, i)])),
    orders: new Map(state.orders.map((o) => [o.order_id, orderSig(o)])),
    settings: JSON.stringify([state.adminSalt, state.adminPasswordHash]),
  };
}

function diffRows<T>(
  list: T[],
  idOf: (x: T) => number,
  sigOf: (x: T, idx: number) => string,
  previous: Map<number, string>
) {
  const changed: { row: T; idx: number }[] = [];
  const currentIds = new Set<number>();
  list.forEach((row, idx) => {
    const id = idOf(row);
    currentIds.add(id);
    if (previous.get(id) !== sigOf(row, idx)) changed.push({ row, idx });
  });
  const removedIds = [...previous.keys()].filter((id) => !currentIds.has(id));
  return { changed, removedIds };
}

/** Recalculates the sales summary of one day (all orders + every table of that day). */
async function recomputeSales(conn: mysql.PoolConnection, date: string): Promise<void> {
  await conn.query(
    `INSERT INTO daily_sales (sales_date, total_orders, paid_orders, cancelled_orders, total_revenue)
     SELECT ?, COUNT(*),
            COALESCE(SUM(payment_status = 'PAID'), 0),
            COALESCE(SUM(order_status = 'CANCELLED'), 0),
            COALESCE(SUM(CASE WHEN order_status <> 'CANCELLED' THEN total_amount ELSE 0 END), 0)
     FROM orders WHERE order_date = ?
     ON DUPLICATE KEY UPDATE
       total_orders = VALUES(total_orders), paid_orders = VALUES(paid_orders),
       cancelled_orders = VALUES(cancelled_orders), total_revenue = VALUES(total_revenue)`,
    [date, date]
  );

  await conn.query(
    `INSERT INTO daily_table_sales (sales_date, table_id, table_number, orders_count, total_revenue)
     SELECT ?, t.table_id, t.table_number, COUNT(o.order_id),
            COALESCE(SUM(CASE WHEN o.order_status <> 'CANCELLED' THEN o.total_amount END), 0)
     FROM cafe_tables t
     LEFT JOIN orders o ON o.table_id = t.table_id AND o.order_date = ?
     GROUP BY t.table_id, t.table_number
     ON DUPLICATE KEY UPDATE
       table_number = VALUES(table_number), orders_count = VALUES(orders_count),
       total_revenue = VALUES(total_revenue)`,
    [date, date]
  );
}

async function writeStateToDb(state: CafeState): Promise<void> {
  if (!pool) return;

  const today = todayStr();
  const dateChanged = lastSnapshotDate !== today;

  const menuDiff = diffRows(state.menuItems, (m) => m.menu_item_id, menuSig, lastSaved.menu);
  const tableDiff = diffRows(state.tables, (t) => t.table_id, tableSig, lastSaved.tables);
  const orderDiff = diffRows(state.orders, (o) => o.order_id, (o) => orderSig(o), lastSaved.orders);
  const settingsSig = JSON.stringify([state.adminSalt, state.adminPasswordHash]);
  const settingsChanged = !!state.adminSalt && !!state.adminPasswordHash && settingsSig !== lastSaved.settings;

  const menuChanged = menuDiff.changed.length > 0 || menuDiff.removedIds.length > 0;
  const tablesChanged = tableDiff.changed.length > 0 || tableDiff.removedIds.length > 0;

  if (!dateChanged && !menuChanged && !tablesChanged && orderDiff.changed.length === 0 && !settingsChanged) {
    return;
  }

  const tableIds = new Set(state.tables.map((t) => t.table_id));
  const menuIds = new Set(state.menuItems.map((m) => m.menu_item_id));

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // ---------------- Menu items (live menu) ----------------
    if (menuDiff.removedIds.length > 0) {
      await conn.query('DELETE FROM menu_items WHERE menu_item_id IN (?)', [menuDiff.removedIds]);
    }
    if (menuDiff.changed.length > 0) {
      await conn.query(
        `INSERT INTO menu_items
          (menu_item_id, sort_order, item_name, category, price, available, description,
           is_veg, is_bestseller, calories, prep_time_minutes, image_url) VALUES ?
         ON DUPLICATE KEY UPDATE
           sort_order = VALUES(sort_order), item_name = VALUES(item_name), category = VALUES(category),
           price = VALUES(price), available = VALUES(available), description = VALUES(description),
           is_veg = VALUES(is_veg), is_bestseller = VALUES(is_bestseller), calories = VALUES(calories),
           prep_time_minutes = VALUES(prep_time_minutes), image_url = VALUES(image_url)`,
        [
          menuDiff.changed.map(({ row: m, idx }) => [
            m.menu_item_id,
            idx,
            m.item_name,
            m.category,
            m.price,
            m.available,
            m.description ?? '',
            m.isVeg ? 1 : 0,
            m.isBestseller ? 1 : 0,
            m.calories ?? null,
            m.prepTimeMinutes ?? null,
            m.imageUrl ?? null,
          ]),
        ]
      );
    }

    // ---------------- Tables (live tables) ----------------
    if (tableDiff.removedIds.length > 0) {
      await conn.query('DELETE FROM cafe_tables WHERE table_id IN (?)', [tableDiff.removedIds]);
    }
    if (tableDiff.changed.length > 0) {
      await conn.query(
        `INSERT INTO cafe_tables
          (table_id, sort_order, table_number, capacity, floor, status, current_order_id) VALUES ?
         ON DUPLICATE KEY UPDATE
           sort_order = VALUES(sort_order), table_number = VALUES(table_number), capacity = VALUES(capacity),
           floor = VALUES(floor), status = VALUES(status), current_order_id = VALUES(current_order_id)`,
        [
          tableDiff.changed.map(({ row: t, idx }) => [
            t.table_id,
            idx,
            t.table_number,
            t.capacity ?? null,
            t.floor ?? null,
            t.status,
            t.currentOrderId ?? null,
          ]),
        ]
      );
    }

    // ---------------- Orders, order lines, bills ----------------
    const affectedDates = new Set<string>();
    if (dateChanged) affectedDates.add(today);

    if (orderDiff.changed.length > 0) {
      const changedOrders = orderDiff.changed.map(({ row }) => row);

      // order_date is only written when the order is first created (never overwritten)
      await conn.query(
        `INSERT INTO orders
          (order_id, sort_order, table_id, table_number, customer_name, customer_phone,
           order_status, total_amount, payment_method, payment_status, created_at, notes, order_date) VALUES ?
         ON DUPLICATE KEY UPDATE
           sort_order = VALUES(sort_order), table_id = VALUES(table_id), table_number = VALUES(table_number),
           customer_name = VALUES(customer_name), customer_phone = VALUES(customer_phone),
           order_status = VALUES(order_status), total_amount = VALUES(total_amount),
           payment_method = VALUES(payment_method), payment_status = VALUES(payment_status),
           created_at = VALUES(created_at), notes = VALUES(notes)`,
        [
          changedOrders.map((o) => [
            o.order_id,
            o.order_id,
            tableIds.has(o.table_id) ? o.table_id : null,
            o.table_number ?? null,
            o.customer_name ?? null,
            o.customer_phone ?? null,
            o.order_status,
            o.total_amount,
            o.payment_method ?? null,
            o.payment_status ?? null,
            o.created_at ?? null,
            o.notes ?? null,
            today,
          ]),
        ]
      );

      // Refresh the dishes (order <-> menu many-to-many) of just these orders
      const orderIds = changedOrders.map((o) => o.order_id);
      await conn.query('DELETE FROM order_items WHERE order_id IN (?)', [orderIds]);
      const itemValues: any[][] = [];
      for (const o of changedOrders) {
        for (const i of o.items || []) {
          itemValues.push([
            i.order_item_id,
            i.order_id,
            menuIds.has(i.menu_item_id) ? i.menu_item_id : null,
            i.item_name ?? null,
            i.quantity,
            i.unit_price,
          ]);
        }
      }
      if (itemValues.length > 0) {
        await conn.query(
          `INSERT INTO order_items
            (order_item_id, order_id, menu_item_id, item_name, quantity, unit_price) VALUES ?
           ON DUPLICATE KEY UPDATE
             order_id = VALUES(order_id), menu_item_id = VALUES(menu_item_id), item_name = VALUES(item_name),
             quantity = VALUES(quantity), unit_price = VALUES(unit_price)`,
          [itemValues]
        );
      }

      // Original date of each order (kept even if the order is updated on a later day)
      const [dateRows] = (await conn.query('SELECT order_id, order_date FROM orders WHERE order_id IN (?)', [
        orderIds,
      ])) as any;
      const dateOf = new Map<number, string>();
      for (const r of dateRows) {
        const d = String(r.order_date || today);
        dateOf.set(Number(r.order_id), d);
        affectedDates.add(d);
      }

      // One bill per order (bills <-> orders many-to-many through bill_orders)
      for (const o of changedOrders) {
        const subtotal = Math.round((o.items || []).reduce((s, i) => s + i.quantity * i.unit_price, 0) * 100) / 100;
        const total = Number(o.total_amount);
        const tax = Math.max(0, Math.round((total - subtotal) * 100) / 100);
        const billNumber = `BILL-${o.order_id}`;
        const isPaid = o.payment_status === 'PAID';

        await conn.query(
          `INSERT INTO bills
            (bill_number, table_id, table_number, customer_name, bill_date, subtotal, tax_amount,
             total_amount, payment_method, payment_status, paid_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ${isPaid ? 'NOW()' : 'NULL'})
           ON DUPLICATE KEY UPDATE
             table_id = VALUES(table_id), table_number = VALUES(table_number),
             customer_name = VALUES(customer_name), subtotal = VALUES(subtotal),
             tax_amount = VALUES(tax_amount), total_amount = VALUES(total_amount),
             payment_method = VALUES(payment_method), payment_status = VALUES(payment_status),
             paid_at = IF(VALUES(payment_status) = 'PAID', COALESCE(paid_at, NOW()), NULL)`,
          [
            billNumber,
            tableIds.has(o.table_id) ? o.table_id : null,
            o.table_number ?? null,
            o.customer_name ?? null,
            dateOf.get(o.order_id) || today,
            subtotal,
            tax,
            total,
            o.payment_method ?? null,
            o.payment_status ?? null,
          ]
        );
        await conn.query(
          `INSERT IGNORE INTO bill_orders (bill_id, order_id)
           SELECT bill_id, ? FROM bills WHERE bill_number = ?`,
          [o.order_id, billNumber]
        );
      }
    }

    // ---------------- Day-wise history ----------------
    // Today's menu (a new day automatically gets a fresh copy; older days stay as they were)
    if (dateChanged || menuChanged) {
      await conn.query('DELETE FROM daily_menu WHERE menu_date = ?', [today]);
      if (state.menuItems.length > 0) {
        await conn.query(
          `INSERT INTO daily_menu
            (menu_date, menu_item_id, item_name, category, price, available, description,
             is_veg, is_bestseller, calories, prep_time_minutes) VALUES ?`,
          [
            state.menuItems.map((m) => [
              today,
              m.menu_item_id,
              m.item_name,
              m.category,
              m.price,
              m.available,
              m.description ?? '',
              m.isVeg ? 1 : 0,
              m.isBestseller ? 1 : 0,
              m.calories ?? null,
              m.prepTimeMinutes ?? null,
            ]),
          ]
        );
      }
    }

    // Today's status of every table
    if (dateChanged || tablesChanged) {
      await conn.query('DELETE FROM daily_tables WHERE snapshot_date = ?', [today]);
      if (state.tables.length > 0) {
        await conn.query(
          `INSERT INTO daily_tables
            (snapshot_date, table_id, table_number, capacity, floor, status, current_order_id) VALUES ?`,
          [
            state.tables.map((t) => [
              today,
              t.table_id,
              t.table_number,
              t.capacity ?? null,
              t.floor ?? null,
              t.status,
              t.currentOrderId ?? null,
            ]),
          ]
        );
      }
      affectedDates.add(today); // new/removed tables also change today's per-table sales rows
    }

    // Sales summary (whole cafe + each table) for every day that was touched
    for (const d of affectedDates) {
      await recomputeSales(conn, d);
    }

    // ---------------- Admin password settings ----------------
    if (settingsChanged) {
      await conn.query(
        `INSERT INTO settings (setting_key, setting_value) VALUES ('adminSalt', ?), ('adminPasswordHash', ?)
         ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
        [state.adminSalt, state.adminPasswordHash]
      );
    }

    await conn.commit();

    // Remember what is now stored (orders already in the DB stay remembered even if
    // they are no longer in the app's memory, so they are never deleted)
    const snap = buildSnapshot(state);
    for (const [id, sig] of lastSaved.orders) if (!snap.orders.has(id)) snap.orders.set(id, sig);
    lastSaved = snap;
    lastSnapshotDate = today;
  } catch (err) {
    try {
      await conn.rollback();
    } catch {}
    throw err;
  } finally {
    conn.release();
  }
}

// Saves are queued so two writes never overlap; only the latest snapshot is written.
let saving = false;
let pendingState: CafeState | null = null;

export async function saveStateToDb(state: CafeState): Promise<void> {
  if (!pool) return;
  latestState = state;
  pendingState = state;
  if (saving) return;
  saving = true;
  try {
    while (pendingState) {
      const next = pendingState;
      pendingState = null;
      try {
        await writeStateToDb(next);
      } catch (err) {
        console.error('[MySQL] Error saving state to database', err);
      }
    }
  } finally {
    saving = false;
  }
}

// When midnight passes, start a new day's menu / table / sales rows automatically
let dailyTimer: NodeJS.Timeout | null = null;
function startDailyTimer() {
  if (dailyTimer) return;
  dailyTimer = setInterval(() => {
    if (pool && latestState && lastSnapshotDate !== todayStr()) {
      saveStateToDb(latestState).catch(() => {});
    }
  }, 60 * 1000);
  dailyTimer.unref();
}