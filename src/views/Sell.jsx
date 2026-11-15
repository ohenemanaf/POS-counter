import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Minus, Plus, Search, ShoppingBag, UserPlus, X } from 'lucide-react';
import { listCustomers, listLedger, listProducts, recordSale, saveCustomer, voidSale } from '../lib/db';
import { addToCart, cartCount, cartKey, cartTotal, customerSummaries, METHODS, searchProducts, setQty } from '../lib/shop';
import { formatMoney, parseMoneyInput } from '../lib/money';
import { useLive, useToast } from '../lib/hooks';
import { Button, Segmented, Sheet, Spinner } from '../components/ui';
import { EmptyState, Field, MoneyInput, TextInput } from '../components/forms';

const CART_KEY = 'pour:cart';
const loadCart = () => {
    try {
        return JSON.parse(sessionStorage.getItem(CART_KEY)) || [];
    } catch {
        return [];
    }
};

function CustomerPicker({ value, onChange }) {
    const { data: customers } = useLive(async () => customerSummaries(await listCustomers(), await listLedger()));
    const [query, setQuery] = useState('');
    const [adding, setAdding] = useState(false);
    const [phone, setPhone] = useState('');

    if (!customers) return <Spinner />;
    const selected = customers.find((c) => c.id === value);
    if (selected) {
        return (
            <div className="flex items-center justify-between rounded-[10px] bg-surface px-3 py-2 ring-1 ring-separator">
                <div>
                    <p className="text-[15px] font-medium">{selected.name}</p>
                    <p className="text-[12px] text-secondary">Owes {formatMoney(selected.balance)} before this sale</p>
                </div>
                <Button variant="plain" onClick={() => onChange(null)}>Change</Button>
            </div>
        );
    }

    const q = query.trim().toLowerCase();
    const matches = q ? customers.filter((c) => c.name.toLowerCase().includes(q) || c.phone?.includes(q)) : customers.slice(0, 6);
    const exact = customers.some((c) => c.name.toLowerCase() === q);

    if (adding) {
        return (
            <div className="flex flex-col gap-2 rounded-[10px] bg-surface p-3 ring-1 ring-separator">
                <TextInput autoFocus placeholder="Customer name" value={query} onChange={(e) => setQuery(e.target.value)} />
                <TextInput type="tel" placeholder="Phone (optional, for reminders)" value={phone} onChange={(e) => setPhone(e.target.value)} />
                <div className="flex justify-end gap-2">
                    <Button variant="plain" onClick={() => setAdding(false)}>Cancel</Button>
                    <Button
                        variant="filled"
                        disabled={!query.trim()}
                        onClick={async () => onChange((await saveCustomer({ name: query, phone })).id)}
                    >
                        Add customer
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="overflow-hidden rounded-[10px] bg-surface ring-1 ring-separator">
            <label className="flex items-center gap-2 border-b border-separator px-3">
                <Search size={15} className="text-tertiary" />
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find customer" className="h-10 w-full bg-transparent text-[15px] outline-none" />
            </label>
            <div className="max-h-44 overflow-y-auto">
                {matches.map((c) => (
                    <button key={c.id} onClick={() => onChange(c.id)} className="flex w-full items-center justify-between border-b border-separator px-3 py-2 text-left last:border-b-0 active:bg-fill">
                        <span className="text-[15px]">{c.name}</span>
                        <span className={`text-[13px] tabular-nums ${c.balance > 0 ? 'text-warn' : 'text-secondary'}`}>{c.balance > 0 ? `owes ${formatMoney(c.balance)}` : 'no balance'}</span>
                    </button>
                ))}
            </div>
            {!exact && (
                <button onClick={() => setAdding(true)} className="flex w-full items-center gap-2 px-3 py-2.5 text-[15px] font-medium text-tint active:bg-fill">
                    <UserPlus size={16} /> {q ? `Add "${query.trim()}"` : 'New customer'}
                </button>
            )}
        </div>
    );
}

function Checkout({ open, cart, setCart, onClose, onDone }) {
    const toast = useToast();
    const [method, setMethod] = useState('cash');
    const [received, setReceived] = useState('');
    const [customerId, setCustomerId] = useState(null);
    const [busy, setBusy] = useState(false);
    const total = cartTotal(cart);
    const receivedP = parseMoneyInput(received);
    const change = receivedP !== null ? receivedP - total : null;

    useEffect(() => {
        if (open) {
            setReceived('');
            setBusy(false);
        }
    }, [open]);
    useEffect(() => {
        if (!cart.length && open) onClose();
    }, [cart.length, open, onClose]);

    const canConfirm = cart.length && !busy && (method !== 'credit' || customerId) && (method !== 'cash' || !received || change >= 0);

    const confirm = async () => {
        setBusy(true);
        try {
            const sale = await recordSale({ cart, method, customerId: method === 'credit' ? customerId : null, received: receivedP });
            onDone();
            toast(`Sale recorded · ${formatMoney(sale.total)}${method === 'cash' && change > 0 ? ` · change ${formatMoney(change)}` : ''}`, {
                action: { label: 'Undo', run: () => voidSale(sale.id, 'Undone right after the sale') },
            });
            setMethod('cash');
            setCustomerId(null);
        } catch (err) {
            toast(err.message, { tone: 'error' });
            setBusy(false);
        }
    };

    return (
        <Sheet open={open} title="Checkout" onClose={onClose}>
            <div className="mb-4 overflow-hidden rounded-xl bg-surface">
                {cart.map((l) => (
                    <div key={cartKey(l)} className="flex items-center gap-3 border-b border-separator px-3 py-2 last:border-b-0">
                        <div className="min-w-0 flex-1">
                            <p className="truncate text-[15px]">{l.name}</p>
                            <p className="truncate text-[12px] text-secondary">{[l.label, formatMoney(l.unitPrice)].filter(Boolean).join(' · ')}</p>
                        </div>
                        <div className="flex items-center gap-1">
                            <button aria-label={`One less ${l.name}`} onClick={() => setCart((c) => setQty(c, cartKey(l), l.qty - 1))} className="grid h-8 w-8 place-items-center rounded-full bg-fill">
                                <Minus size={14} />
                            </button>
                            <span className="w-7 text-center text-[15px] font-semibold tabular-nums">{l.qty}</span>
                            <button aria-label={`One more ${l.name}`} onClick={() => setCart((c) => setQty(c, cartKey(l), l.qty + 1))} className="grid h-8 w-8 place-items-center rounded-full bg-fill">
                                <Plus size={14} />
                            </button>
                        </div>
                        <span className="w-20 text-right text-[15px] font-medium tabular-nums">{formatMoney(l.unitPrice * l.qty)}</span>
                    </div>
                ))}
                <div className="flex items-baseline justify-between bg-fill/50 px-3 py-2.5">
                    <span className="text-[15px] font-semibold">Total</span>
                    <span className="text-[22px] font-bold tabular-nums">{formatMoney(total)}</span>
                </div>
            </div>

            <Segmented
                className="mb-4"
                value={method}
                onChange={setMethod}
                options={Object.entries(METHODS).map(([value, label]) => ({ value, label: value === 'momo' ? 'MoMo' : value === 'credit' ? 'Credit' : label }))}
            />

            {method === 'cash' && (
                <div className="mb-4">
                    <Field label="Cash received (optional)">
                        <MoneyInput value={received} onChange={setReceived} placeholder="0.00" />
                    </Field>
                    {change !== null && (
                        <p className={`mt-2 px-1 text-[15px] font-semibold tabular-nums ${change < 0 ? 'text-destructive' : 'text-good'}`}>
                            {change < 0 ? `${formatMoney(-change)} short` : `Change: ${formatMoney(change)}`}
                        </p>
                    )}
                </div>
            )}
            {method === 'credit' && (
                <div className="mb-4">
                    <p className="mb-1 px-1 text-[12px] font-medium text-secondary">Who is this sale for? It goes on their balance.</p>
                    <CustomerPicker value={customerId} onChange={setCustomerId} />
                </div>
            )}
            {method === 'momo' && <p className="mb-4 px-1 text-[13px] text-secondary">Confirm the MoMo payment arrived on the shop phone before recording.</p>}

            <Button variant="filled" className="h-12 w-full text-[16px]" disabled={!canConfirm} onClick={confirm}>
                <Check size={18} /> Record {method === 'credit' ? 'credit sale' : 'sale'} · {formatMoney(total)}
            </Button>
        </Sheet>
    );
}

export default function Sell() {
    const { data: products } = useLive(listProducts);
    const [query, setQuery] = useState('');
    const [category, setCategory] = useState('All');
    const [cart, setCartState] = useState(loadCart);
    const [checkout, setCheckout] = useState(false);
    const [flash, setFlash] = useState(null);
    const searchRef = useRef(null);

    // The cart survives a reload or an accidental tab switch (but not closing the app).
    const setCart = (next) =>
        setCartState((c) => {
            const value = typeof next === 'function' ? next(c) : next;
            try {
                sessionStorage.setItem(CART_KEY, JSON.stringify(value));
            } catch {
                /* ignore */
            }
            return value;
        });

    useEffect(() => {
        const onKey = (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                searchRef.current?.focus();
                searchRef.current?.select();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []);

    const categories = useMemo(() => (products ? ['All', ...new Set(products.map((p) => p.category))] : ['All']), [products]);
    const shown = useMemo(() => {
        if (!products) return [];
        const inCategory = category === 'All' ? products : products.filter((p) => p.category === category);
        return searchProducts(inCategory, query);
    }, [products, category, query]);

    const add = (product, variant) => {
        setCart((c) => addToCart(c, { productId: product.id, variantId: variant.id, name: product.name, label: variant.label, unitPrice: variant.price }));
        navigator.vibrate?.(8);
        setFlash(`${product.id}:${variant.id}`);
        setTimeout(() => setFlash(null), 350);
    };
    const inCart = (p, v) => cart.find((l) => l.productId === p.id && l.variantId === v.id)?.qty || 0;

    if (!products) return <Spinner />;

    return (
        <>
            <div className="sticky top-0 z-20 -mx-4 bg-canvas/90 px-4 pb-2 pt-2 backdrop-blur-xl">
                <label className="flex items-center gap-2 rounded-[10px] bg-fill px-3">
                    <Search size={17} className="text-tertiary" />
                    <input
                        ref={searchRef}
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search drinks or sizes"
                        className="h-10 w-full bg-transparent text-[16px] outline-none placeholder:text-tertiary"
                        aria-label="Search products"
                    />
                    {query && (
                        <button aria-label="Clear search" onClick={() => setQuery('')} className="text-tertiary">
                            <X size={16} />
                        </button>
                    )}
                    <kbd className="hidden rounded border border-separator px-1.5 text-[11px] text-tertiary md:inline">Ctrl K</kbd>
                </label>
                <div className="no-scrollbar -mx-4 mt-2 flex gap-2 overflow-x-auto px-4">
                    {categories.map((c) => (
                        <button
                            key={c}
                            onClick={() => setCategory(c)}
                            className={`h-8 shrink-0 rounded-full px-3 text-[13px] font-medium ${c === category ? 'bg-label text-canvas' : 'bg-surface text-label'}`}
                        >
                            {c}
                        </button>
                    ))}
                </div>
            </div>

            {shown.length === 0 ? (
                <EmptyState icon={Search} title="No match">Try fewer letters, or check the Prices list under More.</EmptyState>
            ) : (
                <div className="mt-1 overflow-hidden rounded-xl bg-surface">
                    {shown.map((p) => (
                        <div key={p.id} className="flex items-center gap-3 border-b border-separator px-4 py-2 last:border-b-0">
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-[15px] font-medium">{p.name}</p>
                                <p className="truncate text-[12px] text-secondary">{p.category}</p>
                            </div>
                            <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
                                {p.variants.map((v) => {
                                    const qty = inCart(p, v);
                                    const key = `${p.id}:${v.id}`;
                                    return (
                                        <button
                                            key={v.id}
                                            onClick={() => add(p, v)}
                                            aria-label={`Add ${p.name}${v.label ? ` ${v.label}` : ''}, ${formatMoney(v.price)}`}
                                            className={`relative flex h-10 min-w-[84px] flex-col items-end justify-center rounded-[10px] px-3 transition-transform active:scale-95 ${flash === key ? 'bg-tint text-white' : 'bg-tint-soft text-tint'}`}
                                        >
                                            <span className="text-[15px] font-bold tabular-nums leading-none">{formatMoney(v.price)}</span>
                                            {v.label && <span className="mt-0.5 text-[10px] leading-none opacity-80">{v.label}</span>}
                                            {qty > 0 && (
                                                <span className="absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-label px-1 text-[11px] font-bold text-canvas">{qty}</span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            )}
            <p className="mt-3 px-1 text-center text-[12px] text-tertiary">Tap a price to add it to the sale.</p>

            {cart.length > 0 && (
                <div className="fixed inset-x-0 bottom-[calc(56px+env(safe-area-inset-bottom))] z-30 px-4 pb-2 md:bottom-4 md:left-56">
                    <div className="mx-auto flex max-w-2xl items-center gap-2 rounded-2xl bg-label p-2 pl-4 text-canvas shadow-xl">
                        <ShoppingBag size={18} />
                        <span className="flex-1 text-[15px] font-semibold tabular-nums">
                            {cartCount(cart)} item{cartCount(cart) === 1 ? '' : 's'} · {formatMoney(cartTotal(cart))}
                        </span>
                        <button onClick={() => setCart([])} className="h-10 rounded-xl px-3 text-[14px] font-medium opacity-70">Clear</button>
                        <button onClick={() => setCheckout(true)} className="h-10 rounded-xl bg-tint px-4 text-[15px] font-semibold text-white">Checkout</button>
                    </div>
                </div>
            )}
            {cart.length > 0 && <div className="h-20" />}

            <Checkout
                open={checkout}
                cart={cart}
                setCart={setCart}
                onClose={() => setCheckout(false)}
                onDone={() => {
                    setCart([]);
                    setCheckout(false);
                    setQuery('');
                }}
            />
        </>
    );
}
