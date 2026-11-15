import { useRef, useState } from 'react';
import { ChevronLeft, Download, FileSpreadsheet, KeyRound, Plus, Search, Store, Tag, Trash2, Upload } from 'lucide-react';
import { deleteProduct, exportAll, getSettings, importDebts, listCustomers, listProducts, restoreAll, saveProduct, saveSettings } from '../lib/db';
import { makeBackup, parseBackup, parseDebtSheet, toCsv } from '../lib/backup';
import { formatMoney, parseMoneyInput } from '../lib/money';
import { METHODS, searchProducts } from '../lib/shop';
import { hashPin, navigate, useLive, useLock, useToast } from '../lib/hooks';
import { Button, Group, PageHeader, Row, Sheet, Spinner } from '../components/ui';
import { Field, PinSheet, TextInput, inputClass } from '../components/forms';

function download(filename, text, type) {
    const blob = new Blob([text], { type });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), { href: url, download: filename });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return blob;
}

/** Shares the file (WhatsApp, Drive…) where the phone supports it, otherwise downloads it. */
async function shareOrDownload(filename, text, type) {
    const file = new File([text], filename, { type });
    if (navigator.canShare?.({ files: [file] })) {
        try {
            await navigator.share({ files: [file], title: filename });
            return 'shared';
        } catch (err) {
            if (err.name === 'AbortError') return 'cancelled';
        }
    }
    download(filename, text, type);
    return 'downloaded';
}

const stamp = () => new Date().toISOString().slice(0, 10);

// ---------------- Prices ----------------

function ProductEditor({ product, categories, onClose }) {
    const toast = useToast();
    const [name, setName] = useState(product?.name || '');
    const [category, setCategory] = useState(product?.category || categories[0] || '');
    const [variants, setVariants] = useState(
        product?.variants.map((v) => ({ ...v, priceText: (v.price / 100).toFixed(2) })) || [{ id: '', label: '', priceText: '' }]
    );
    const setVariant = (i, patch) => setVariants((list) => list.map((v, j) => (j === i ? { ...v, ...patch } : v)));
    const valid = name.trim() && variants.length && variants.every((v) => parseMoneyInput(v.priceText) !== null);

    const save = async (e) => {
        e.preventDefault();
        await saveProduct({
            ...product,
            name,
            category,
            variants: variants.map(({ priceText, ...v }) => ({ ...v, price: parseMoneyInput(priceText) })),
        });
        toast(product ? 'Price saved' : 'Product added');
        onClose();
    };

    return (
        <Sheet open title={product ? 'Edit product' : 'New product'} onClose={onClose}>
            <form className="flex flex-col gap-3" onSubmit={save}>
                <Field label="Name"><TextInput autoFocus={!product} required value={name} onChange={(e) => setName(e.target.value)} /></Field>
                <Field label="Category">
                    <input list="categories" className={inputClass} required value={category} onChange={(e) => setCategory(e.target.value)} />
                    <datalist id="categories">{categories.map((c) => <option key={c} value={c} />)}</datalist>
                </Field>
                <div>
                    <p className="mb-1 px-1 text-[12px] font-medium text-secondary">Prices</p>
                    <div className="flex flex-col gap-2">
                        {variants.map((v, i) => (
                            <div key={i} className="flex gap-2">
                                <input aria-label="Size or unit" className={inputClass} placeholder="Size (optional), e.g. 1.5L" value={v.label} onChange={(e) => setVariant(i, { label: e.target.value })} />
                                <div className="relative w-36 shrink-0">
                                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-secondary">GH₵</span>
                                    <input aria-label="Price" inputMode="decimal" required className={`${inputClass} pl-11 tabular-nums`} value={v.priceText} onChange={(e) => setVariant(i, { priceText: e.target.value })} />
                                </div>
                                {variants.length > 1 && (
                                    <button type="button" aria-label="Remove this price" onClick={() => setVariants(variants.filter((_, j) => j !== i))} className="grid h-10 w-10 shrink-0 place-items-center rounded-[10px] text-destructive active:bg-fill">
                                        <Trash2 size={16} />
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                    <Button type="button" variant="plain" className="mt-1 px-1" onClick={() => setVariants([...variants, { id: '', label: '', priceText: '' }])}>
                        <Plus size={15} /> Add another size
                    </Button>
                </div>
                <Button variant="filled" type="submit" disabled={!valid}>Save</Button>
                {product && (
                    <Button
                        type="button"
                        variant="plain"
                        className="text-destructive"
                        onClick={async () => {
                            if (!window.confirm(`Remove ${product.name} from the price list? Past sales keep their record.`)) return;
                            await deleteProduct(product.id);
                            toast('Product removed');
                            onClose();
                        }}
                    >
                        Remove product
                    </Button>
                )}
            </form>
        </Sheet>
    );
}

function Prices() {
    const { data: products } = useLive(listProducts);
    const [query, setQuery] = useState('');
    const [editing, setEditing] = useState(null);
    if (!products) return <Spinner />;
    const categories = [...new Set(products.map((p) => p.category))];
    const shown = searchProducts(products, query);
    const grouped = categories.map((c) => [c, shown.filter((p) => p.category === c)]).filter(([, list]) => list.length);

    return (
        <>
            <Button variant="plain" className="-ml-2 mb-1 px-2" onClick={() => navigate('more')}><ChevronLeft size={18} /> More</Button>
            <PageHeader title="Prices" subtitle={`${products.length} products`} action={<Button variant="tinted" onClick={() => setEditing('new')}><Plus size={16} /> Add</Button>} />
            <label className="mb-3 flex items-center gap-2 rounded-[10px] bg-fill px-3">
                <Search size={16} className="text-tertiary" />
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find a product" className="h-10 w-full bg-transparent text-[15px] outline-none placeholder:text-tertiary" />
            </label>
            {grouped.map(([category, list]) => (
                <Group key={category} title={category}>
                    {list.map((p) => (
                        <Row key={p.id} title={p.name} onClick={() => setEditing(p)}>
                            <span className="shrink-0 text-right text-[14px] tabular-nums text-secondary">
                                {p.variants.map((v) => `${v.label ? `${v.label} ` : ''}${formatMoney(v.price)}`).join(' · ')}
                            </span>
                        </Row>
                    ))}
                </Group>
            ))}
            {editing && <ProductEditor product={editing === 'new' ? null : editing} categories={categories} onClose={() => setEditing(null)} />}
        </>
    );
}

// ---------------- Main menu ----------------

function ShopNameSheet({ open, current, onClose }) {
    const [name, setName] = useState(current);
    return (
        <Sheet open={open} title="Shop name" onClose={onClose}>
            <form className="flex flex-col gap-3" onSubmit={async (e) => { e.preventDefault(); await saveSettings({ shopName: name.trim() }); onClose(); }}>
                <Field label="Shown in WhatsApp reminders"><TextInput autoFocus required value={name} onChange={(e) => setName(e.target.value)} /></Field>
                <Button variant="filled" type="submit" disabled={!name.trim()}>Save</Button>
            </form>
        </Sheet>
    );
}

function Menu() {
    const toast = useToast();
    const { requireUnlock, lock } = useLock();
    const { data: settings } = useLive(getSettings);
    const [sheet, setSheet] = useState(null);
    const [newPin, setNewPin] = useState(null);
    const restoreInput = useRef(null);
    const debtInput = useRef(null);

    if (!settings) return <Spinner />;

    const backup = async () => {
        const text = JSON.stringify(makeBackup(await exportAll()));
        const how = await shareOrDownload(`pour-backup-${stamp()}.json`, text, 'application/json');
        if (how !== 'cancelled') {
            await saveSettings({ lastBackupAt: new Date().toISOString() });
            toast(how === 'shared' ? 'Backup shared' : 'Backup downloaded');
        }
    };

    const exportSales = async () => {
        const { sales } = await exportAll();
        const names = Object.fromEntries((await listCustomers()).map((c) => [c.id, c.name]));
        const rows = [['Date', 'Time', 'Items', 'Total (GHS)', 'Payment', 'Customer', 'Voided']];
        for (const s of [...sales].sort((a, b) => a.at.localeCompare(b.at))) {
            const d = new Date(s.at);
            rows.push([
                s.day, d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
                s.items.map((l) => `${l.qty}x ${l.name}${l.label ? ` (${l.label})` : ''}`).join('; '),
                (s.total / 100).toFixed(2), METHODS[s.method], names[s.customerId] || '', s.voided ? s.voided.reason : '',
            ]);
        }
        await shareOrDownload(`pour-sales-${stamp()}.csv`, toCsv(rows), 'text/csv');
    };

    const onRestoreFile = async (e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        try {
            const data = parseBackup(await file.text());
            const when = new Date(data.exportedAt).toLocaleString('en-GB');
            if (!window.confirm(`Replace everything on this phone with the backup from ${when}? (${data.products.length} products, ${data.sales.length} sales, ${data.customers.length} customers)`)) return;
            await restoreAll(data);
            toast('Backup restored');
        } catch (err) {
            toast(err.message, { tone: 'error' });
        }
    };

    const onDebtFile = async (e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        try {
            const { rows, skipped } = parseDebtSheet(await file.text());
            if (!rows.length) throw new Error('No debts found in that file.');
            const total = rows.reduce((s, r) => s + r.amount, 0);
            if (!window.confirm(`Import ${rows.length} debts totalling ${formatMoney(total)}?${skipped ? ` (${skipped} empty rows skipped)` : ''}`)) return;
            const result = await importDebts(rows);
            toast(`Imported ${result.entries} debts, ${result.customersCreated} new customers`);
        } catch (err) {
            toast(err.message, { tone: 'error' });
        }
    };

    const daysSinceBackup = settings.lastBackupAt ? Math.floor((Date.now() - new Date(settings.lastBackupAt)) / 86400000) : null;

    return (
        <>
            <PageHeader title="More" subtitle={settings.shopName} />

            <Group>
                <Row icon={Tag} title="Prices" subtitle="Add products and change prices" onClick={async () => (await requireUnlock('Enter the PIN to change prices')) && navigate('more/prices')} />
                <Row icon={Store} title="Shop name" value={settings.shopName} onClick={() => setSheet('name')} />
            </Group>

            <Group
                title="Keep your records safe"
                footer={
                    daysSinceBackup === null
                        ? 'Your records live only on this phone. Send a backup to WhatsApp or Google Drive regularly, so nothing is lost if the phone is.'
                        : `Last backup ${daysSinceBackup === 0 ? 'today' : `${daysSinceBackup} day${daysSinceBackup === 1 ? '' : 's'} ago`}.`
                }
            >
                <Row icon={Download} title="Back up now" subtitle="Share or save a backup file" onClick={backup}>
                    {(daysSinceBackup === null || daysSinceBackup > 7) && <span className="rounded-full bg-warn-soft px-2 py-0.5 text-[11px] font-medium text-warn">Due</span>}
                </Row>
                <Row icon={Upload} title="Restore a backup" subtitle="Replaces what is on this phone" onClick={async () => (await requireUnlock('Enter the PIN to restore a backup')) && restoreInput.current.click()} />
                <Row icon={FileSpreadsheet} title="Export sales (CSV)" subtitle="Opens in Excel or Google Sheets" onClick={exportSales} />
            </Group>

            <Group title="Moving from the old debt tracker" footer='In Google Sheets: File → Download → CSV. The sheet needs "Name" and "Amount" columns (Date and Note are used too).'>
                <Row icon={FileSpreadsheet} title="Import debts from CSV" onClick={() => debtInput.current.click()} />
            </Group>

            <Group title="Security" footer="The PIN protects prices, voiding sales and restoring backups. It stays on this phone and is not in backups.">
                <Row
                    icon={KeyRound}
                    title={settings.pinHash ? 'Change PIN' : 'Set a PIN'}
                    subtitle={settings.pinHash ? undefined : 'Recommended: anyone can change prices without one'}
                    onClick={async () => (await requireUnlock('Enter your current PIN')) && setSheet('pin-new')}
                />
                {settings.pinHash && <Row title="Lock now" onClick={() => { lock(); toast('Locked'); }} />}
                {settings.pinHash && (
                    <Row
                        title="Remove PIN"
                        onClick={async () => {
                            if ((await requireUnlock('Enter the PIN to remove it')) && window.confirm('Remove the PIN? Anyone with the phone could change prices.')) {
                                await saveSettings({ pinHash: null });
                                toast('PIN removed');
                            }
                        }}
                    />
                )}
            </Group>

            <p className="mt-6 text-center text-[12px] text-tertiary">Pour 2.0 · works offline · records stay on this phone</p>

            <input ref={restoreInput} type="file" accept="application/json,.json" hidden onChange={onRestoreFile} />
            <input ref={debtInput} type="file" accept=".csv,text/csv" hidden onChange={onDebtFile} />

            <ShopNameSheet key={settings.shopName} open={sheet === 'name'} current={settings.shopName} onClose={() => setSheet(null)} />
            <PinSheet
                open={sheet === 'pin-new'}
                title="New PIN"
                subtitle="Choose 4 digits"
                onClose={() => setSheet(null)}
                onDone={async (pin) => {
                    setNewPin(pin);
                    setSheet('pin-confirm');
                    return true;
                }}
            />
            <PinSheet
                open={sheet === 'pin-confirm'}
                title="Confirm PIN"
                subtitle="Enter the same 4 digits again"
                onClose={() => setSheet(null)}
                onDone={async (pin) => {
                    if (pin !== newPin) return "The PINs didn't match.";
                    await saveSettings({ pinHash: await hashPin(pin) });
                    setSheet(null);
                    toast('PIN saved');
                    return true;
                }}
            />
        </>
    );
}

export default function More({ view }) {
    const { unlocked } = useLock();
    if (view === 'prices') {
        // Opening #/more/prices directly still needs the PIN.
        if (!unlocked) {
            navigate('more');
            return null;
        }
        return <Prices />;
    }
    return <Menu />;
}
