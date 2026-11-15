import { useState } from 'react';
import { ChevronLeft, MessageCircle, Phone, Search, UserPlus, Users } from 'lucide-react';
import { addCredit, addPayment, getSettings, ledgerFor, listCustomers, listLedger, saveCustomer } from '../lib/db';
import { balanceOf, customerSummaries, reminderLink } from '../lib/shop';
import { formatMoney, parseMoneyInput } from '../lib/money';
import { navigate, useLive, useToast } from '../lib/hooks';
import { Button, Group, PageHeader, Row, Segmented, Sheet, Spinner } from '../components/ui';
import { EmptyState, Field, MoneyInput, TextInput } from '../components/forms';

const shortDate = (iso) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const timeOf = (iso) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

function CustomerForm({ open, customer, onClose, onSaved }) {
    const [name, setName] = useState(customer?.name || '');
    const [phone, setPhone] = useState(customer?.phone || '');
    return (
        <Sheet open={open} title={customer ? 'Edit customer' : 'New customer'} onClose={onClose}>
            <form
                className="flex flex-col gap-3"
                onSubmit={async (e) => {
                    e.preventDefault();
                    onSaved(await saveCustomer({ id: customer?.id, name, phone }));
                }}
            >
                <Field label="Name"><TextInput autoFocus required value={name} onChange={(e) => setName(e.target.value)} /></Field>
                <Field label="Phone" hint="Used for WhatsApp reminders and calls."><TextInput type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="024 000 0000" /></Field>
                <Button variant="filled" type="submit" className="mt-1" disabled={!name.trim()}>Save</Button>
            </form>
        </Sheet>
    );
}

function EntrySheet({ open, kind, customer, onClose }) {
    const toast = useToast();
    const [amount, setAmount] = useState('');
    const [method, setMethod] = useState('cash');
    const [note, setNote] = useState('');
    const value = parseMoneyInput(amount);
    const isPayment = kind === 'payment';

    const save = async (e) => {
        e.preventDefault();
        try {
            if (isPayment) await addPayment(customer.id, value, { method, note });
            else await addCredit(customer.id, value, { note });
            toast(isPayment ? `Payment of ${formatMoney(value)} recorded` : `${formatMoney(value)} added to ${customer.name}'s balance`);
            setAmount('');
            setNote('');
            onClose();
        } catch (err) {
            toast(err.message, { tone: 'error' });
        }
    };

    return (
        <Sheet open={open} title={isPayment ? `Payment from ${customer.name}` : `Add to ${customer.name}'s balance`} onClose={onClose}>
            <form className="flex flex-col gap-3" onSubmit={save}>
                {isPayment && customer.balance > 0 && (
                    <div className="flex gap-2">
                        <Button type="button" variant="gray" onClick={() => setAmount((customer.balance / 100).toFixed(2))}>Full {formatMoney(customer.balance)}</Button>
                    </div>
                )}
                <Field label="Amount"><MoneyInput autoFocus value={amount} onChange={setAmount} placeholder="0.00" /></Field>
                {isPayment && (
                    <Segmented value={method} onChange={setMethod} options={[{ value: 'cash', label: 'Cash' }, { value: 'momo', label: 'MoMo' }]} />
                )}
                <Field label="Note (optional)">
                    <TextInput value={note} onChange={(e) => setNote(e.target.value)} placeholder={isPayment ? 'e.g. part payment' : 'e.g. old balance from the notebook'} />
                </Field>
                {isPayment && value > customer.balance && customer.balance > 0 && (
                    <p className="px-1 text-[13px] text-warn">That is more than they owe. The extra {formatMoney(value - customer.balance)} will be kept as credit in their favour.</p>
                )}
                <Button variant="filled" type="submit" disabled={!(value > 0)}>Save</Button>
            </form>
        </Sheet>
    );
}

function CustomerDetail({ id }) {
    const { data } = useLive(async () => {
        const [customers, entries, settings] = await Promise.all([listCustomers(), ledgerFor(id), getSettings()]);
        const customer = customers.find((c) => c.id === id);
        return customer ? { customer: { ...customer, balance: balanceOf(entries) }, entries, settings } : null;
    }, [id]);
    const [sheet, setSheet] = useState(null);

    if (data === undefined) return <Spinner />;
    if (data === null) return <EmptyState icon={Users} title="Customer not found" action={<Button onClick={() => navigate('customers')}>Back to customers</Button>} />;
    const { customer, entries, settings } = data;
    const link = reminderLink({ phone: customer.phone, name: customer.name, balance: customer.balance, shopName: settings.shopName, formatMoney });

    return (
        <>
            <Button variant="plain" className="-ml-2 mb-1 px-2" onClick={() => navigate('customers')}>
                <ChevronLeft size={18} /> Customers
            </Button>
            <PageHeader title={customer.name} subtitle={customer.phone || 'No phone number'} action={<Button variant="gray" onClick={() => setSheet('edit')}>Edit</Button>} />

            <section className="mb-4 rounded-2xl bg-surface p-4">
                <p className="text-[13px] text-secondary">{customer.balance > 0 ? 'Owes the shop' : customer.balance < 0 ? 'Shop owes them (paid ahead)' : 'All settled'}</p>
                <p className={`text-[32px] font-bold tabular-nums tracking-tight ${customer.balance > 0 ? 'text-warn' : 'text-good'}`}>{formatMoney(Math.abs(customer.balance))}</p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                    <Button variant="filled" onClick={() => setSheet('payment')}>Record payment</Button>
                    <Button variant="tinted" onClick={() => setSheet('credit')}>Add to balance</Button>
                </div>
                {(link || customer.phone) && (
                    <div className="mt-2 grid grid-cols-2 gap-2">
                        {link ? (
                            <a href={link} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center justify-center gap-1.5 rounded-[10px] bg-good-soft text-[14px] font-semibold text-good">
                                <MessageCircle size={16} /> WhatsApp reminder
                            </a>
                        ) : <span />}
                        {customer.phone && (
                            <a href={`tel:${customer.phone.replace(/\s/g, '')}`} className="inline-flex h-9 items-center justify-center gap-1.5 rounded-[10px] bg-fill text-[14px] font-semibold">
                                <Phone size={16} /> Call
                            </a>
                        )}
                    </div>
                )}
            </section>

            <Group title="History" footer={entries.length ? 'Credit sales that were voided stay listed but no longer count.' : undefined}>
                {entries.length === 0 && <p className="px-4 py-6 text-center text-[13px] text-secondary">Nothing yet.</p>}
                {entries.map((e) => (
                    <div key={e.id} className={`flex items-start gap-3 border-b border-separator px-4 py-2.5 last:border-b-0 ${e.voided ? 'opacity-45' : ''}`}>
                        <div className="min-w-0 flex-1">
                            <p className="text-[15px]">{e.kind === 'payment' ? `Paid${e.method === 'momo' ? ' by MoMo' : ''}` : e.saleId ? 'Bought on credit' : 'Added to balance'}</p>
                            <p className="text-[12px] text-secondary">
                                {shortDate(e.at)}, {timeOf(e.at)}
                                {e.note ? ` · ${e.note}` : ''}
                                {e.voided ? ` · voided: ${e.voided.reason}` : ''}
                            </p>
                        </div>
                        <span className={`shrink-0 text-[15px] font-semibold tabular-nums ${e.kind === 'payment' ? 'text-good' : ''} ${e.voided ? 'line-through' : ''}`}>
                            {e.kind === 'payment' ? '−' : '+'}{formatMoney(e.amount)}
                        </span>
                    </div>
                ))}
            </Group>

            <EntrySheet open={sheet === 'payment'} kind="payment" customer={customer} onClose={() => setSheet(null)} />
            <EntrySheet open={sheet === 'credit'} kind="credit" customer={customer} onClose={() => setSheet(null)} />
            {sheet === 'edit' && <CustomerForm open customer={customer} onClose={() => setSheet(null)} onSaved={() => setSheet(null)} />}
        </>
    );
}

function CustomerList() {
    const { data: customers } = useLive(async () => customerSummaries(await listCustomers(), await listLedger()));
    const [query, setQuery] = useState('');
    const [adding, setAdding] = useState(false);

    if (!customers) return <Spinner />;
    const owed = customers.reduce((sum, c) => sum + Math.max(0, c.balance), 0);
    const debtors = customers.filter((c) => c.balance > 0).length;
    const q = query.trim().toLowerCase();
    const shown = q ? customers.filter((c) => c.name.toLowerCase().includes(q) || c.phone?.includes(q)) : customers;

    return (
        <>
            <PageHeader
                title="Customers"
                subtitle={debtors ? `${debtors} owe ${formatMoney(owed)} in total` : 'Nobody owes the shop'}
                action={<Button variant="tinted" onClick={() => setAdding(true)}><UserPlus size={16} /> New</Button>}
            />
            {customers.length === 0 ? (
                <EmptyState icon={Users} title="No customers yet" action={<Button onClick={() => setAdding(true)}>Add a customer</Button>}>
                    Customers are added when you sell on credit, or here. Moving from the old debt tracker? Import it under More.
                </EmptyState>
            ) : (
                <>
                    <label className="mb-3 flex items-center gap-2 rounded-[10px] bg-fill px-3">
                        <Search size={16} className="text-tertiary" />
                        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name or phone" className="h-10 w-full bg-transparent text-[15px] outline-none placeholder:text-tertiary" />
                    </label>
                    <Group>
                        {shown.map((c) => (
                            <Row
                                key={c.id}
                                title={c.name}
                                subtitle={c.phone || undefined}
                                onClick={() => navigate(`customers/${c.id}`)}
                            >
                                <span className={`shrink-0 text-[15px] font-semibold tabular-nums ${c.balance > 0 ? 'text-warn' : 'text-secondary'}`}>
                                    {c.balance > 0 ? formatMoney(c.balance) : c.balance < 0 ? `+${formatMoney(-c.balance)}` : 'Settled'}
                                </span>
                            </Row>
                        ))}
                    </Group>
                </>
            )}
            {adding && (
                <CustomerForm
                    open
                    onClose={() => setAdding(false)}
                    onSaved={(c) => {
                        setAdding(false);
                        navigate(`customers/${c.id}`);
                    }}
                />
            )}
        </>
    );
}

export default function Customers({ id }) {
    return id ? <CustomerDetail key={id} id={id} /> : <CustomerList />;
}
