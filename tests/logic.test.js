import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { formatMoney, parseMoneyInput, toPesewas } from '../src/lib/money.js';
import { migrateV1Products, readV1Products } from '../src/lib/migrate.js';
import {
    addToCart, balanceOf, cartCount, cartKey, cartTotal, customerSummaries, dayKey, reminderLink,
    searchProducts, setQty, summarizeSales, whatsappNumber,
} from '../src/lib/shop.js';
import { makeBackup, parseBackup, parseCsv, parseDebtSheet, toCsv } from '../src/lib/backup.js';

// The exact catalog Pour v1 seeds into the shop's browser (generated from the old app's code).
const v1 = JSON.parse(readFileSync(new URL('./fixtures/v1-products.json', import.meta.url), 'utf8'));

describe('money', () => {
    test('stores pesewas and avoids decimal drift', () => {
        expect(toPesewas(0.1) + toPesewas(0.2)).toBe(toPesewas(0.3));
        expect(toPesewas(19.99)).toBe(1999);
    });
    test('formats cedis', () => {
        expect(formatMoney(1250)).toBe('GH₵12.50');
        expect(formatMoney(120050)).toBe('GH₵1,200.50');
        expect(formatMoney(-500)).toBe('-GH₵5.00');
        expect(formatMoney(0)).toBe('GH₵0.00');
    });
    test('parses typed prices', () => {
        expect(parseMoneyInput('12')).toBe(1200);
        expect(parseMoneyInput('GH₵ 7.5')).toBe(750);
        expect(parseMoneyInput('1,200.50')).toBe(120050);
        expect(parseMoneyInput('')).toBe(null);
        expect(parseMoneyInput('1.2.3')).toBe(null);
    });
});

describe('migrating the live v1 catalog', () => {
    const products = migrateV1Products(v1);

    test('keeps every product and price', () => {
        expect(products).toHaveLength(108);
        const voltic = products.find((p) => p.name === 'VOLTIC-SMALL');
        expect(voltic.category).toBe('Wholesale (carton)');
        expect(voltic.variants).toEqual([{ id: expect.any(String), label: '', price: 3000 }]);
        const water = products.find((p) => p.name === 'Bottle water (1.0L/1.5L)');
        expect(water.category).toBe('Fridge (single)');
        expect(water.variants.map((v) => [v.label, v.price])).toEqual([['1.0L', 500], ['1.5L', 700]]);
    });

    test('the total of every price is unchanged', () => {
        const before = v1.reduce((n, p) => n + p.variants.reduce((m, v) => m + toPesewas(v.retailPrice), 0), 0);
        const after = products.reduce((n, p) => n + p.variants.reduce((m, v) => m + v.price, 0), 0);
        expect(after).toBe(before);
    });

    test('keeps the shop’s own edits, including different wholesale prices', () => {
        const edited = [
            { id: 'p-custom', name: 'Club Beer', category: 'Beer', variants: [{ id: 'v1', sizeLabel: '625ml', retailPrice: 15, wholesalePrice: 160, packQuantity: 12 }] },
        ];
        const [club] = migrateV1Products(edited);
        expect(club.category).toBe('Beer');
        expect(club.variants.map((v) => [v.label, v.price])).toEqual([['625ml · single', 1500], ['625ml · carton (12)', 16000]]);
    });

    test('ignores junk and never throws', () => {
        expect(migrateV1Products(null)).toEqual([]);
        expect(migrateV1Products([{ name: '' }, null, { name: 'Ok', variants: [] }])).toHaveLength(1);
        expect(readV1Products({ getItem: () => '{not json' })).toBe(null);
    });
});

describe('cart', () => {
    const coke = { productId: 'a', variantId: 'x', name: 'Coke', label: '', unitPrice: 700 };
    const malt = { productId: 'b', variantId: 'y', name: 'Malt', label: '', unitPrice: 1200 };

    test('adds, merges and totals', () => {
        let cart = addToCart([], coke);
        cart = addToCart(cart, coke, 2);
        cart = addToCart(cart, malt);
        expect(cartCount(cart)).toBe(4);
        expect(cartTotal(cart)).toBe(3 * 700 + 1200);
    });

    test('quantity 0 removes the line', () => {
        const cart = setQty(addToCart([], coke), cartKey(coke), 0);
        expect(cart).toEqual([]);
    });
});

test('dayKey uses the local calendar day', () => {
    expect(dayKey(new Date(2026, 10, 15, 23, 59))).toBe('2026-11-15');
});

describe('daily report', () => {
    const sales = [
        { total: 1400, method: 'cash', items: [{ name: 'Coke', label: '', unitPrice: 700, qty: 2 }] },
        { total: 1200, method: 'momo', items: [{ name: 'Malt', label: '', unitPrice: 1200, qty: 1 }] },
        { total: 700, method: 'credit', items: [{ name: 'Coke', label: '', unitPrice: 700, qty: 1 }] },
        { total: 9900, method: 'cash', voided: { reason: 'mistake' }, items: [{ name: 'X', label: '', unitPrice: 9900, qty: 1 }] },
    ];
    const r = summarizeSales(sales);

    test('excludes voided sales', () => {
        expect(r.count).toBe(3);
        expect(r.voided).toBe(1);
        expect(r.total).toBe(3300);
    });
    test('credit sales are sold but not received', () => {
        expect(r.received).toBe(2600);
        expect(r.byMethod).toEqual({ cash: 1400, momo: 1200, credit: 700 });
    });
    test('top items by quantity', () => {
        expect(r.topItems[0]).toMatchObject({ name: 'Coke', qty: 3, total: 2100 });
    });
});

describe('customer credit', () => {
    const ledger = [
        { customerId: 'c1', kind: 'credit', amount: 5000, at: '2026-11-01' },
        { customerId: 'c1', kind: 'payment', amount: 2000, at: '2026-11-05' },
        { customerId: 'c1', kind: 'credit', amount: 1000, at: '2026-11-06', voided: true },
        { customerId: 'c2', kind: 'credit', amount: 700, at: '2026-11-07' },
    ];

    test('balance = credit − payments, ignoring voided entries', () => {
        expect(balanceOf(ledger.filter((e) => e.customerId === 'c1'))).toBe(3000);
    });

    test('summaries are sorted by who owes most', () => {
        const s = customerSummaries([{ id: 'c2', name: 'Esi' }, { id: 'c1', name: 'Kofi' }, { id: 'c3', name: 'Ama' }], ledger);
        expect(s.map((c) => [c.name, c.balance])).toEqual([['Kofi', 3000], ['Esi', 700], ['Ama', 0]]);
        expect(s[0].lastActivity).toBe('2026-11-06');
    });

    test('Ghana numbers become WhatsApp numbers', () => {
        expect(whatsappNumber('024 412 3456')).toBe('233244123456');
        expect(whatsappNumber('+233 24 412 3456')).toBe('233244123456');
        expect(whatsappNumber('244123456')).toBe('233244123456');
        expect(whatsappNumber('123')).toBe(null);
    });

    test('reminder link only when something is owed', () => {
        const link = reminderLink({ phone: '0244123456', name: 'Kofi', balance: 3000, shopName: 'Decorch', formatMoney });
        expect(link).toMatch(/^https:\/\/wa\.me\/233244123456\?text=/);
        expect(decodeURIComponent(link)).toContain('GH₵30.00');
        expect(reminderLink({ phone: '0244123456', name: 'Kofi', balance: 0, shopName: 'D', formatMoney })).toBe(null);
    });
});

test('search tolerates spaces, dashes and case', () => {
    const products = migrateV1Products(v1);
    expect(searchProducts(products, 'voltic small').map((p) => p.name)).toContain('VOLTIC-SMALL');
    expect(searchProducts(products, 'volticsmall').map((p) => p.name)).toContain('VOLTIC-SMALL');
    expect(searchProducts(products, 'bel malt').length).toBeGreaterThan(0);
    expect(searchProducts(products, '1.5l').map((p) => p.name)).toContain('Bottle water (1.0L/1.5L)');
});

describe('backup and import', () => {
    test('backup round-trips', () => {
        const data = { products: [{ id: 'p' }], sales: [], customers: [], ledger: [], settings: { shopName: 'X' } };
        const restored = parseBackup(JSON.stringify(makeBackup(data)));
        expect(restored.products).toEqual([{ id: 'p' }]);
        expect(restored.settings.shopName).toBe('X');
    });

    test('rejects files that are not backups', () => {
        expect(() => parseBackup('hello')).toThrow(/not a Pour backup/);
        expect(() => parseBackup('{"app":"other"}')).toThrow(/not a Pour backup/);
        expect(() => parseBackup('{"app":"pour","version":99}')).toThrow(/newer version/);
        expect(() => parseBackup('{"app":"pour","version":2,"products":[]}')).toThrow(/damaged/);
    });

    test('CSV handles quotes, commas and newlines', () => {
        const rows = [['Name', 'Note'], ['Kofi', 'said "pay Friday", ok'], ['Ama', 'line1\nline2']];
        expect(parseCsv(toCsv(rows))).toEqual(rows);
    });

    test('imports the old Google Sheets debt list', () => {
        const csv = 'Date,Name,Amount,Note\r\n2026-03-01,Kofi Mensah,120.5,crate of malt\r\n2026-03-02,,50,\r\n2026-03-03,Ama,$30,';
        const { rows, skipped } = parseDebtSheet(csv);
        expect(skipped).toBe(1);
        expect(rows).toEqual([
            { date: '2026-03-01', name: 'Kofi Mensah', amount: 12050, note: 'crate of malt' },
            { date: '2026-03-03', name: 'Ama', amount: 3000, note: '' },
        ]);
        expect(() => parseDebtSheet('Who,How much\nA,1')).toThrow(/Name/);
    });
});
