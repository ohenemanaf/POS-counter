import 'fake-indexeddb/auto';
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, test } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import {
    addPayment, exportAll, importDebts, initialize, ledgerFor, listCustomers, listProducts,
    recordSale, resetConnection, restoreAll, salesOn, saveCustomer, voidSale,
} from '../src/lib/db.js';
import { balanceOf, dayKey } from '../src/lib/shop.js';
import { makeBackup, parseBackup } from '../src/lib/backup.js';

const v1 = readFileSync(new URL('./fixtures/v1-products.json', import.meta.url), 'utf8');
const storageWith = (items) => ({ getItem: (k) => items[k] ?? null });

beforeEach(() => {
    // A brand-new, empty browser database for every test.
    globalThis.indexedDB = new IDBFactory();
    resetConnection();
});

describe('first run', () => {
    test('a phone that ran v1 keeps its catalog, including its own edits', async () => {
        const edited = JSON.parse(v1);
        edited[0].variants[0].retailPrice = 11; // the shop changed a price in v1
        edited[0].variants[0].wholesalePrice = 11;
        const storage = storageWith({ 'pour-products': JSON.stringify(edited) });

        const result = await initialize(storage);
        expect(result).toMatchObject({ source: 'v1', products: 108 });
        const products = await listProducts();
        expect(products.find((p) => p.name === 'SACHET-AQUA FRESH').variants[0].price).toBe(1100);
    });

    test('runs only once and never overwrites later changes', async () => {
        await initialize(storageWith({}));
        await recordSale({ cart: [{ productId: 'w1', variantId: 'v', name: 'X', label: '', unitPrice: 100, qty: 1 }], method: 'cash' });
        const again = await initialize(storageWith({ 'pour-products': '[]' }));
        expect(again.source).toBe('seed');
        expect(await listProducts()).toHaveLength(108);
    });

    test('a new phone gets the Decorch menu', async () => {
        expect((await initialize(storageWith({}))).source).toBe('seed');
        expect(await listProducts()).toHaveLength(108);
    });
});

describe('sales and credit', () => {
    const cart = [
        { productId: 'a', variantId: 'x', name: 'Coke', label: '', unitPrice: 700, qty: 2 },
        { productId: 'b', variantId: 'y', name: 'Malt', label: '', unitPrice: 1200, qty: 1 },
    ];

    test('a cash sale is recorded on today', async () => {
        const sale = await recordSale({ cart, method: 'cash', received: 5000 });
        expect(sale.total).toBe(2600);
        expect((await salesOn(dayKey()))[0].id).toBe(sale.id);
    });

    test('a credit sale adds to the customer balance; voiding removes it', async () => {
        const kofi = await saveCustomer({ name: 'Kofi', phone: '0244123456' });
        const sale = await recordSale({ cart, method: 'credit', customerId: kofi.id });
        expect(balanceOf(await ledgerFor(kofi.id))).toBe(2600);

        await addPayment(kofi.id, 1000);
        expect(balanceOf(await ledgerFor(kofi.id))).toBe(1600);

        await voidSale(sale.id, 'wrong customer');
        expect(balanceOf(await ledgerFor(kofi.id))).toBe(-1000); // only the payment remains
        expect((await salesOn(dayKey()))[0].voided.reason).toBe('wrong customer');
    });

    test('a credit sale needs a customer; empty carts are refused', async () => {
        await expect(recordSale({ cart, method: 'credit' })).rejects.toThrow(/customer/);
        await expect(recordSale({ cart: [], method: 'cash' })).rejects.toThrow(/empty/);
        await expect(addPayment('c', 0)).rejects.toThrow(/above zero/);
    });
});

describe('backup, restore and import', () => {
    test('a backup restored on another phone brings everything back', async () => {
        await initialize(storageWith({}));
        const ama = await saveCustomer({ name: 'Ama' });
        await recordSale({ cart: [{ productId: 'a', variantId: 'x', name: 'Coke', label: '', unitPrice: 700, qty: 1 }], method: 'credit', customerId: ama.id });
        const file = JSON.stringify(makeBackup(await exportAll()));

        // "New phone"
        globalThis.indexedDB = new IDBFactory();
        resetConnection();
        await restoreAll(parseBackup(file));
        expect(await listProducts()).toHaveLength(108);
        expect((await listCustomers())[0].name).toBe('Ama');
        expect(balanceOf(await ledgerFor(ama.id))).toBe(700);
    });

    test('imports the old debt list, matching existing customers by name', async () => {
        await saveCustomer({ name: 'Kofi Mensah' });
        const result = await importDebts([
            { date: '2026-03-01', name: 'kofi mensah', amount: 12050, note: 'malt' },
            { date: null, name: 'Ama', amount: 3000, note: '' },
        ]);
        expect(result).toEqual({ entries: 2, customersCreated: 1 });
        const customers = await listCustomers();
        expect(customers).toHaveLength(2);
        const kofi = customers.find((c) => c.name === 'Kofi Mensah');
        const entries = await ledgerFor(kofi.id);
        expect(balanceOf(entries)).toBe(12050);
        expect(entries[0].day).toBe('2026-03-01');
    });
});

