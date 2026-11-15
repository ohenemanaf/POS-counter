// Everything the shop records lives in IndexedDB on this device (more room than
// localStorage, which caps out at ~5 MB). Changes notify subscribers so screens refresh.
import { openDB } from 'idb';
import { migrateV1Products, readV1Products } from './migrate';
import { dayKey } from './shop';
import decorchMenu from '../data/decorch-menu-v1.json';

export const DB_NAME = 'pour';
const VERSION = 1;

let dbPromise = null;
export function db() {
    dbPromise ??= openDB(DB_NAME, VERSION, {
        upgrade(d) {
            d.createObjectStore('products', { keyPath: 'id' });
            d.createObjectStore('sales', { keyPath: 'id' }).createIndex('day', 'day');
            d.createObjectStore('customers', { keyPath: 'id' });
            d.createObjectStore('ledger', { keyPath: 'id' }).createIndex('customerId', 'customerId');
            d.createObjectStore('settings');
        },
    });
    return dbPromise;
}

/** For tests: forget the open connection. */
export function resetConnection() {
    dbPromise = null;
}

// ---------- change notifications ----------

const listeners = new Set();
export const subscribe = (fn) => {
    listeners.add(fn);
    return () => listeners.delete(fn);
};
const changed = () => listeners.forEach((fn) => fn());

export const uid = (prefix) => `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

// ---------- settings ----------

export const DEFAULT_SETTINGS = { shopName: 'DECORCH ENTERPRISE', pinHash: null, lastBackupAt: null };

export async function getSettings() {
    return { ...DEFAULT_SETTINGS, ...((await (await db()).get('settings', 'app')) || {}) };
}

export async function saveSettings(patch) {
    const d = await db();
    await d.put('settings', { ...(await getSettings()), ...patch }, 'app');
    changed();
}

// ---------- first run ----------

/**
 * Runs once per device. Carries over the catalog from Pour v1 if this phone has it
 * (never deleting the old copy), otherwise loads the Decorch menu. Returns what happened.
 */
export async function initialize(storage = globalThis.localStorage) {
    const d = await db();
    const done = await d.get('settings', 'migration');
    if (done) return done;

    const v1 = readV1Products(storage);
    const source = Array.isArray(v1) ? 'v1' : 'seed';
    const products = migrateV1Products(Array.isArray(v1) ? v1 : decorchMenu);
    const record = { source, products: products.length, at: new Date().toISOString() };

    const tx = d.transaction(['products', 'settings'], 'readwrite');
    // Only fill an empty catalog: a half-finished earlier run must not duplicate anything.
    if ((await tx.objectStore('products').count()) === 0) {
        for (const p of products) await tx.objectStore('products').put(p);
    }
    await tx.objectStore('settings').put(record, 'migration');
    await tx.done;

    // Ask the browser not to clear this data when space runs low.
    navigator.storage?.persist?.().catch(() => {});
    changed();
    return record;
}

// ---------- reads ----------

export async function listProducts() {
    return (await (await db()).getAll('products')).sort((a, b) => a.category.localeCompare(b.category) || (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name));
}
export async function salesOn(day) {
    return (await (await db()).getAllFromIndex('sales', 'day', day)).sort((a, b) => b.at.localeCompare(a.at));
}
export const listCustomers = async () => (await db()).getAll('customers');
export const listLedger = async () => (await db()).getAll('ledger');
export async function ledgerFor(customerId) {
    return (await (await db()).getAllFromIndex('ledger', 'customerId', customerId)).sort((a, b) => b.at.localeCompare(a.at));
}

// ---------- catalog ----------

export async function saveProduct(product) {
    const d = await db();
    const clean = {
        ...product,
        id: product.id || uid('p'),
        name: product.name.trim(),
        category: product.category.trim() || 'Other',
        variants: product.variants.map((v) => ({ ...v, id: v.id || uid('v'), label: (v.label || '').trim() })),
        order: product.order ?? Date.now(),
    };
    await d.put('products', clean);
    changed();
    return clean;
}

export async function deleteProduct(id) {
    await (await db()).delete('products', id);
    changed();
}

// ---------- customers & credit ----------

export async function saveCustomer({ id, name, phone = '' }) {
    const d = await db();
    const existing = id ? await d.get('customers', id) : null;
    const customer = { ...existing, id: id || uid('c'), name: name.trim(), phone: phone.trim(), createdAt: existing?.createdAt || new Date().toISOString() };
    await d.put('customers', customer);
    changed();
    return customer;
}

/** Payment received from a customer towards their balance. */
export async function addPayment(customerId, amount, { method = 'cash', note = '', at = new Date() } = {}) {
    if (!(amount > 0)) throw new Error('Enter an amount above zero.');
    const d = await db();
    const entry = { id: uid('l'), customerId, kind: 'payment', amount, method, note: note.trim(), at: at.toISOString(), day: dayKey(at) };
    await d.put('ledger', entry);
    changed();
    return entry;
}

/** Credit given without a sale (e.g. an old debt carried over). */
export async function addCredit(customerId, amount, { note = '', at = new Date() } = {}) {
    if (!(amount > 0)) throw new Error('Enter an amount above zero.');
    const d = await db();
    const entry = { id: uid('l'), customerId, kind: 'credit', amount, note: note.trim(), at: at.toISOString(), day: dayKey(at) };
    await d.put('ledger', entry);
    changed();
    return entry;
}

// ---------- sales ----------

/**
 * Records a sale in one transaction. A credit sale also adds the amount to the customer's
 * balance, linked to the sale, so voiding the sale removes it from the balance too.
 */
export async function recordSale({ cart, method, customerId = null, received = null, at = new Date() }) {
    if (!cart.length) throw new Error('The cart is empty.');
    if (method === 'credit' && !customerId) throw new Error('Choose the customer this sale is for.');
    const total = cart.reduce((sum, l) => sum + l.unitPrice * l.qty, 0);
    const sale = {
        id: uid('s'),
        at: at.toISOString(),
        day: dayKey(at),
        items: cart.map(({ productId, variantId, name, label, unitPrice, qty }) => ({ productId, variantId, name, label, unitPrice, qty })),
        total,
        method,
        customerId: method === 'credit' ? customerId : customerId || null,
        received: method === 'cash' && received ? received : null,
    };
    const d = await db();
    const tx = d.transaction(['sales', 'ledger'], 'readwrite');
    await tx.objectStore('sales').put(sale);
    if (method === 'credit') {
        await tx.objectStore('ledger').put({
            id: uid('l'), customerId, kind: 'credit', amount: total, saleId: sale.id,
            note: sale.items.map((l) => `${l.qty}× ${l.name}`).join(', '), at: sale.at, day: sale.day,
        });
    }
    await tx.done;
    changed();
    return sale;
}

/** Marks a sale void (kept for the record) and cancels its credit entry, if any. */
export async function voidSale(saleId, reason) {
    const d = await db();
    const tx = d.transaction(['sales', 'ledger'], 'readwrite');
    const sale = await tx.objectStore('sales').get(saleId);
    if (!sale) throw new Error('Sale not found.');
    if (sale.voided) return sale;
    const voided = { at: new Date().toISOString(), reason: reason.trim() || 'No reason given' };
    await tx.objectStore('sales').put({ ...sale, voided });
    if (sale.method === 'credit') {
        const entries = await tx.objectStore('ledger').index('customerId').getAll(sale.customerId);
        for (const e of entries.filter((x) => x.saleId === saleId)) await tx.objectStore('ledger').put({ ...e, voided });
    }
    await tx.done;
    changed();
    return { ...sale, voided };
}

// ---------- backup ----------

export async function exportAll() {
    const d = await db();
    const [products, sales, customers, ledger, settings] = await Promise.all([
        d.getAll('products'), d.getAll('sales'), d.getAll('customers'), d.getAll('ledger'), getSettings(),
    ]);
    // The PIN is device-specific and not included in backups.
    return { products, sales, customers, ledger, settings: { shopName: settings.shopName } };
}

/** Replaces everything on this device with a backup's contents. */
export async function restoreAll(backup) {
    const d = await db();
    const tx = d.transaction(['products', 'sales', 'customers', 'ledger', 'settings'], 'readwrite');
    for (const store of ['products', 'sales', 'customers', 'ledger']) {
        await tx.objectStore(store).clear();
        for (const row of backup[store]) await tx.objectStore(store).put(row);
    }
    const current = (await tx.objectStore('settings').get('app')) || {};
    await tx.objectStore('settings').put({ ...current, shopName: backup.settings?.shopName || current.shopName }, 'app');
    await tx.done;
    changed();
}

/** Adds customers and opening balances from the old Google Sheets debt list. Matches names case-insensitively. */
export async function importDebts(rows) {
    const customers = await listCustomers();
    const byName = new Map(customers.map((c) => [c.name.toLowerCase(), c]));
    let created = 0;
    for (const r of rows) {
        let c = byName.get(r.name.toLowerCase());
        if (!c) {
            c = await saveCustomer({ name: r.name });
            byName.set(r.name.toLowerCase(), c);
            created++;
        }
        const at = r.date ? new Date(`${r.date}T12:00:00`) : new Date();
        await addCredit(c.id, r.amount, { note: r.note ? `Imported: ${r.note}` : 'Imported from the old debt tracker', at });
    }
    return { entries: rows.length, customersCreated: created };
}
