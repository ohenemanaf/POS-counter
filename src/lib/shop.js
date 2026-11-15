// Pure shop logic: cart, sales summaries and customer balances. No storage here,
// so all of it is unit-tested.

// ---------- Cart ----------

export const cartKey = (item) => `${item.productId}:${item.variantId}`;

export function addToCart(cart, item, qty = 1) {
    const key = cartKey(item);
    const existing = cart.find((l) => cartKey(l) === key);
    if (existing) return cart.map((l) => (cartKey(l) === key ? { ...l, qty: l.qty + qty } : l));
    return [...cart, { ...item, qty }];
}

export function setQty(cart, key, qty) {
    if (qty <= 0) return cart.filter((l) => cartKey(l) !== key);
    return cart.map((l) => (cartKey(l) === key ? { ...l, qty } : l));
}

export const cartTotal = (cart) => cart.reduce((sum, l) => sum + l.unitPrice * l.qty, 0);
export const cartCount = (cart) => cart.reduce((sum, l) => sum + l.qty, 0);

// ---------- Dates ----------

/** Local calendar day "YYYY-MM-DD" (not UTC, so late-evening sales land on the right day). */
export function dayKey(date = new Date()) {
    const d = new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ---------- Sales report ----------

export const METHODS = {
    cash: 'Cash',
    momo: 'Mobile money',
    credit: 'On credit',
};

export function summarizeSales(sales) {
    const valid = sales.filter((s) => !s.voided);
    const byMethod = Object.fromEntries(Object.keys(METHODS).map((m) => [m, 0]));
    const items = new Map();
    for (const s of valid) {
        byMethod[s.method] = (byMethod[s.method] || 0) + s.total;
        for (const l of s.items) {
            const key = `${l.name}|${l.label}`;
            const prev = items.get(key) || { name: l.name, label: l.label, qty: 0, total: 0 };
            items.set(key, { ...prev, qty: prev.qty + l.qty, total: prev.total + l.unitPrice * l.qty });
        }
    }
    return {
        count: valid.length,
        voided: sales.length - valid.length,
        total: valid.reduce((sum, s) => sum + s.total, 0),
        // Money that actually came in today (credit sales are owed, not received).
        received: byMethod.cash + byMethod.momo,
        byMethod,
        topItems: [...items.values()].sort((a, b) => b.qty - a.qty || b.total - a.total).slice(0, 5),
    };
}

// ---------- Customer credit ----------

/** Ledger entries: { kind: 'credit' | 'payment', amount (pesewas, positive) }. Positive balance = owes the shop. */
export function balanceOf(entries) {
    return entries.reduce((sum, e) => (e.voided ? sum : e.kind === 'credit' ? sum + e.amount : sum - e.amount), 0);
}

export function customerSummaries(customers, ledger) {
    const byCustomer = new Map(customers.map((c) => [c.id, []]));
    for (const e of ledger) byCustomer.get(e.customerId)?.push(e);
    return customers
        .map((c) => {
            const entries = byCustomer.get(c.id) || [];
            const last = entries.reduce((max, e) => (e.at > max ? e.at : max), c.createdAt || '');
            return { ...c, balance: balanceOf(entries), lastActivity: last };
        })
        .sort((a, b) => b.balance - a.balance || a.name.localeCompare(b.name));
}

// ---------- WhatsApp reminder ----------

/** Ghana numbers: "024 412 3456" -> "233244123456". Already-international numbers pass through. */
export function whatsappNumber(phone) {
    const digits = String(phone || '').replace(/\D/g, '');
    if (!digits) return null;
    if (digits.startsWith('233') && digits.length === 12) return digits;
    if (digits.startsWith('0') && digits.length === 10) return `233${digits.slice(1)}`;
    if (digits.length === 9) return `233${digits}`;
    return digits.length >= 10 ? digits : null;
}

export function reminderLink({ phone, name, balance, shopName, formatMoney }) {
    const number = whatsappNumber(phone);
    if (!number || balance <= 0) return null;
    const text = `Hello ${name}, this is ${shopName}. A friendly reminder that your balance with us is ${formatMoney(balance)}. Thank you!`;
    return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}

// ---------- Search ----------

/** Loose match so "voltic small", "volticsmall" and "VOLTIC-SMALL" all find the same product. */
const loose = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');
export function searchProducts(products, query) {
    const words = String(query).toLowerCase().split(/\s+/).map(loose).filter(Boolean);
    if (!words.length) return products;
    return products.filter((p) => {
        const hay = loose(`${p.name} ${p.category} ${p.variants.map((v) => v.label).join(' ')}`);
        return words.every((w) => hay.includes(w));
    });
}
