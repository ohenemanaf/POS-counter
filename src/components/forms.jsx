import { useEffect, useState } from 'react';
import { Delete, Lock } from 'lucide-react';
import { Button, Sheet } from './ui';

export function Field({ label, hint, children }) {
    return (
        <label className="block">
            <span className="mb-1 block px-1 text-[12px] font-medium text-secondary">{label}</span>
            {children}
            {hint && <span className="mt-1 block px-1 text-[12px] text-secondary">{hint}</span>}
        </label>
    );
}

export const inputClass =
    'h-10 w-full rounded-[10px] bg-surface px-3 text-[15px] outline-none ring-1 ring-separator placeholder:text-tertiary focus:ring-2 focus:ring-tint';

export const TextInput = (props) => <input className={inputClass} {...props} />;

/** Price box: shows "GH₵" prefix, accepts "12", "12.50", "1,200". */
export function MoneyInput({ value, onChange, ...props }) {
    return (
        <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[15px] text-secondary">GH₵</span>
            <input inputMode="decimal" className={`${inputClass} pl-12 tabular-nums`} value={value} onChange={(e) => onChange(e.target.value)} {...props} />
        </div>
    );
}

export function EmptyState({ icon: Icon, title, children, action }) {
    return (
        <div className="flex flex-col items-center rounded-xl bg-surface px-6 py-10 text-center">
            {Icon && <Icon size={28} className="mb-3 text-tertiary" />}
            <p className="text-[15px] font-semibold">{title}</p>
            {children && <p className="mt-1 max-w-xs text-[13px] text-secondary">{children}</p>}
            {action && <div className="mt-4">{action}</div>}
        </div>
    );
}

export function Toast({ toast, onDismiss }) {
    if (!toast) return null;
    return (
        <div className="pointer-events-none fixed inset-x-0 bottom-[calc(76px+env(safe-area-inset-bottom))] z-[70] flex justify-center px-4 md:bottom-6" aria-live="polite">
            <div className={`pointer-events-auto flex items-center gap-3 rounded-xl px-4 py-2.5 text-[14px] shadow-lg ${toast.tone === 'error' ? 'bg-destructive text-white' : 'bg-label text-canvas'}`}>
                <span>{toast.message}</span>
                {toast.action && (
                    <button
                        className="font-semibold text-tint-on-dark"
                        onClick={() => {
                            toast.action.run();
                            onDismiss();
                        }}
                    >
                        {toast.action.label}
                    </button>
                )}
            </div>
        </div>
    );
}

/** 4-digit PIN entry. mode: 'unlock' checks, 'set' asks twice. onDone(pin) returns true if accepted. */
export function PinSheet({ open, title, subtitle, onDone, onClose }) {
    const [pin, setPin] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        if (open) {
            setPin('');
            setError('');
        }
    }, [open]);

    const press = async (digit) => {
        if (pin.length >= 4) return;
        const next = pin + digit;
        setPin(next);
        setError('');
        if (next.length === 4) {
            const result = await onDone(next);
            if (result !== true) {
                setError(typeof result === 'string' ? result : 'Wrong PIN. Try again.');
                navigator.vibrate?.([30, 40, 30]);
                setTimeout(() => setPin(''), 250);
            }
        }
    };

    useEffect(() => {
        if (!open) return;
        const onKey = (e) => {
            if (/^\d$/.test(e.key)) press(e.key);
            if (e.key === 'Backspace') setPin((p) => p.slice(0, -1));
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    });

    return (
        <Sheet open={open} title={title} onClose={onClose}>
            <div className="flex flex-col items-center">
                <Lock size={22} className="mb-2 text-tint" />
                {subtitle && <p className="mb-4 text-center text-[13px] text-secondary">{subtitle}</p>}
                <div className="mb-2 flex gap-3" aria-label={`${pin.length} of 4 digits entered`}>
                    {[0, 1, 2, 3].map((i) => (
                        <span key={i} className={`h-3.5 w-3.5 rounded-full ${i < pin.length ? 'bg-tint' : 'bg-fill'}`} />
                    ))}
                </div>
                <p className="mb-3 h-5 text-[13px] text-destructive" role="alert">{error}</p>
                <div className="grid w-full max-w-[260px] grid-cols-3 gap-2">
                    {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'].map((k) =>
                        k === '' ? (
                            <span key="blank" />
                        ) : (
                            <button
                                key={k}
                                aria-label={k === 'del' ? 'Delete digit' : k}
                                onClick={() => (k === 'del' ? setPin((p) => p.slice(0, -1)) : press(k))}
                                className="grid h-14 place-items-center rounded-xl bg-surface text-[22px] font-medium active:bg-fill"
                            >
                                {k === 'del' ? <Delete size={20} /> : k}
                            </button>
                        )
                    )}
                </div>
                <Button variant="plain" className="mt-3" onClick={onClose}>Cancel</Button>
            </div>
        </Sheet>
    );
}
