import { useState } from 'react';
import { ChevronLeft, ChevronRight, Receipt } from 'lucide-react';
import { listCustomers, listLedger, salesOn, voidSale } from '../lib/db';
import { dayKey, METHODS, summarizeSales } from '../lib/shop';
import { formatMoney } from '../lib/money';
import { useLive, useLock, useToast } from '../lib/hooks';
import { Button, Group, PageHeader, Sheet, Spinner } from '../components/ui';
import { EmptyState, Field, TextInput } from '../components/forms';

const shift = (day, n) => {
    const [y, m, d] = day.split('-').map(Number);
    return dayKey(new Date(y, m - 1, d + n));
};
const label = (day) => {
    const today = dayKey();
    if (day === today) return 'Today';
    if (day === shift(today, -1)) return 'Yesterday';
    const [y, m, d] = day.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' });
};

function Tile({ title, value, note, tone }) {
    return (
        <div className="rounded-xl bg-surface p-3">
            <p className="text-[12px] text-secondary">{title}</p>
            <p className={`mt-0.5 text-[20px] font-bold tabular-nums tracking-tight ${tone === 'warn' ? 'text-warn' : tone === 'good' ? 'text-good' : ''}`}>{value}</p>
            {note && <p className="text-[11px] text-secondary">{note}</p>}
        </div>
    );
}

function VoidSheet({ sale, onClose }) {
    const toast = useToast();
    const [reason, setReason] = useState('');
    if (!sale) return null;
    return (
        <Sheet open title="Void this sale?" onClose={onClose}>
            <p className="mb-3 text-[14px] text-secondary">
                {formatMoney(sale.total)} at {new Date(sale.at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}. It stays in the list marked void and stops counting in totals
                {sale.method === 'credit' ? ", and it comes off the customer's balance." : '.'}
            </p>
            <form
                className="flex flex-col gap-3"
                onSubmit={async (e) => {
                    e.preventDefault();
                    await voidSale(sale.id, reason);
                    toast('Sale voided');
                    onClose();
                }}
            >
                <Field label="Reason"><TextInput autoFocus required value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. rang up twice" /></Field>
                <Button type="submit" className="bg-destructive-soft text-destructive" disabled={!reason.trim()}>Void sale</Button>
            </form>
        </Sheet>
    );
}

export default function Today() {
    const [day, setDay] = useState(dayKey());
    const { requireUnlock } = useLock();
    const [voiding, setVoiding] = useState(null);
    const { data } = useLive(async () => {
        const [sales, ledger, customers] = await Promise.all([salesOn(day), listLedger(), listCustomers()]);
        const names = Object.fromEntries(customers.map((c) => [c.id, c.name]));
        const collected = ledger.filter((e) => e.day === day && e.kind === 'payment' && !e.voided);
        return { sales, names, collected };
    }, [day]);

    if (!data) return <Spinner />;
    const { sales, names, collected } = data;
    const r = summarizeSales(sales);
    const debtPaid = collected.reduce((sum, e) => sum + e.amount, 0);
    const isToday = day === dayKey();

    return (
        <>
            <PageHeader title="Sales" />
            <div className="mb-3 flex items-center justify-between rounded-xl bg-surface px-1.5 py-1.5">
                <button aria-label="Previous day" onClick={() => setDay((d) => shift(d, -1))} className="grid h-9 w-9 place-items-center rounded-lg text-tint active:bg-fill">
                    <ChevronLeft size={20} />
                </button>
                <button onClick={() => setDay(dayKey())} className="text-[15px] font-semibold">{label(day)}</button>
                <button aria-label="Next day" disabled={isToday} onClick={() => setDay((d) => shift(d, 1))} className="grid h-9 w-9 place-items-center rounded-lg text-tint active:bg-fill disabled:opacity-30">
                    <ChevronRight size={20} />
                </button>
            </div>

            <div className="mb-5 grid grid-cols-2 gap-2">
                <Tile title="Sales" value={formatMoney(r.total)} note={`${r.count} sale${r.count === 1 ? '' : 's'}${r.voided ? ` · ${r.voided} voided` : ''}`} />
                <Tile title="Money in" value={formatMoney(r.received + debtPaid)} note={debtPaid ? `incl. ${formatMoney(debtPaid)} debt paid` : 'cash + MoMo'} tone="good" />
                <Tile title="Cash" value={formatMoney(r.byMethod.cash + collected.filter((e) => e.method !== 'momo').reduce((s, e) => s + e.amount, 0))} note="should be in the drawer" />
                <Tile title="On credit" value={formatMoney(r.byMethod.credit)} note="added to customers' balances" tone={r.byMethod.credit ? 'warn' : undefined} />
            </div>

            {r.topItems.length > 0 && (
                <Group title="Best sellers">
                    {r.topItems.map((t) => (
                        <div key={`${t.name}|${t.label}`} className="flex items-center gap-3 border-b border-separator px-4 py-2 last:border-b-0">
                            <span className="min-w-0 flex-1 truncate text-[15px]">{t.name}{t.label ? <span className="text-secondary"> · {t.label}</span> : null}</span>
                            <span className="text-[13px] tabular-nums text-secondary">×{t.qty}</span>
                            <span className="w-24 text-right text-[15px] font-medium tabular-nums">{formatMoney(t.total)}</span>
                        </div>
                    ))}
                </Group>
            )}

            {sales.length === 0 && collected.length === 0 ? (
                <EmptyState icon={Receipt} title={isToday ? 'No sales yet today' : 'No sales this day'}>{isToday ? 'Sales you record on the Sell tab show up here.' : undefined}</EmptyState>
            ) : (
                <Group title={`Sales (${sales.length})`}>
                    {sales.map((s) => (
                        <div key={s.id} className={`border-b border-separator px-4 py-2.5 last:border-b-0 ${s.voided ? 'opacity-50' : ''}`}>
                            <div className="flex items-baseline gap-2">
                                <span className="text-[13px] tabular-nums text-secondary">{new Date(s.at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
                                <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${s.method === 'credit' ? 'bg-warn-soft text-warn' : s.method === 'momo' ? 'bg-tint-soft text-tint' : 'bg-good-soft text-good'}`}>
                                    {s.method === 'credit' ? `Credit · ${names[s.customerId] || 'customer'}` : METHODS[s.method]}
                                </span>
                                <span className={`ml-auto text-[15px] font-semibold tabular-nums ${s.voided ? 'line-through' : ''}`}>{formatMoney(s.total)}</span>
                            </div>
                            <p className="mt-0.5 text-[13px] text-secondary">{s.items.map((l) => `${l.qty}× ${l.name}${l.label ? ` (${l.label})` : ''}`).join(', ')}</p>
                            {s.voided ? (
                                <p className="mt-0.5 text-[12px] text-destructive">Voided: {s.voided.reason}</p>
                            ) : (
                                <button
                                    className="mt-1 text-[12px] font-medium text-secondary underline-offset-2 hover:underline"
                                    onClick={async () => (await requireUnlock('Enter the PIN to void a sale')) && setVoiding(s)}
                                >
                                    Void
                                </button>
                            )}
                        </div>
                    ))}
                    {collected.map((e) => (
                        <div key={e.id} className="flex items-baseline gap-2 border-b border-separator px-4 py-2.5 last:border-b-0">
                            <span className="text-[13px] tabular-nums text-secondary">{new Date(e.at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
                            <span className="rounded-full bg-good-soft px-2 py-0.5 text-[11px] font-medium text-good">Debt paid · {names[e.customerId] || 'customer'}</span>
                            <span className="ml-auto text-[15px] font-semibold tabular-nums text-good">+{formatMoney(e.amount)}</span>
                        </div>
                    ))}
                </Group>
            )}
            <VoidSheet sale={voiding} onClose={() => setVoiding(null)} />
        </>
    );
}
