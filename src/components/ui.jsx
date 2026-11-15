import { useEffect } from 'react';
import { ChevronRight, LoaderCircle, X } from 'lucide-react';

const cx = (...c) => c.filter(Boolean).join(' ');

export function PageHeader({ title, subtitle, action }) {
    return (
        <header className="mb-4 flex items-end justify-between gap-3 pt-2">
            <div className="min-w-0">
                <h1 className="truncate text-[26px] font-bold tracking-tight">{title}</h1>
                {subtitle && <p className="mt-0.5 text-[13px] text-secondary">{subtitle}</p>}
            </div>
            {action}
        </header>
    );
}

/** Grouped list section in the iOS style: optional caption, rounded card, hairline rows. */
export function Group({ title, footer, children, className }) {
    return (
        <section className={cx('mb-5', className)}>
            {title && <h2 className="mb-1.5 px-4 text-[12px] font-medium uppercase tracking-wide text-secondary">{title}</h2>}
            <div className="overflow-hidden rounded-xl bg-surface">{children}</div>
            {footer && <p className="mt-1.5 px-4 text-[12px] leading-relaxed text-secondary">{footer}</p>}
        </section>
    );
}

export function Row({ icon: Icon, title, subtitle, value, onClick, chevron = Boolean(onClick), active, children }) {
    const Tag = onClick ? 'button' : 'div';
    return (
        <Tag
            onClick={onClick}
            className={cx(
                'flex min-h-11 w-full items-center gap-3 px-4 py-2 text-left',
                'border-b border-separator last:border-b-0',
                onClick && 'active:bg-fill',
                active && 'bg-tint-soft'
            )}
        >
            {Icon && <Icon size={18} className="shrink-0 text-tint" />}
            <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px]">{title}</span>
                {subtitle && <span className="block truncate text-[12px] text-secondary">{subtitle}</span>}
            </span>
            {children}
            {value !== undefined && <span className="shrink-0 text-[14px] tabular-nums text-secondary">{value}</span>}
            {chevron && <ChevronRight size={16} className="shrink-0 text-tertiary" />}
        </Tag>
    );
}

export function Segmented({ options, value, onChange, className }) {
    return (
        <div role="tablist" className={cx('flex rounded-[9px] bg-fill p-0.5', className)}>
            {options.map((o) => (
                <button
                    key={o.value}
                    role="tab"
                    aria-selected={value === o.value}
                    onClick={() => onChange(o.value)}
                    className={cx(
                        'h-7 flex-1 rounded-[7px] px-3 text-[13px] font-medium transition-all ease-sheet',
                        value === o.value ? 'bg-surface shadow-sm' : 'text-secondary'
                    )}
                >
                    {o.label}
                </button>
            ))}
        </div>
    );
}

export function Button({ variant = 'tinted', icon = false, className, children, ...props }) {
    const styles = {
        filled: 'bg-tint text-white',
        tinted: 'bg-tint-soft text-tint',
        plain: 'text-tint',
        gray: 'bg-fill text-label',
    };
    return (
        <button
            className={cx('inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-[10px] text-[14px] font-semibold transition-opacity active:opacity-60 disabled:opacity-40', icon ? 'w-9' : 'px-3.5', styles[variant], className)}
            {...props}
        >
            {children}
        </button>
    );
}

export function Spinner({ label = 'Loading…' }) {
    return (
        <div className="flex items-center justify-center gap-2 py-12 text-[13px] text-secondary">
            <LoaderCircle size={16} className="animate-spin" /> {label}
        </div>
    );
}

export function ErrorState({ message, onRetry }) {
    return (
        <div className="flex flex-col items-center gap-3 rounded-xl bg-surface px-6 py-10 text-center">
            <p className="text-[14px] text-secondary">{message}</p>
            {onRetry && <Button onClick={onRetry}>Try again</Button>}
        </div>
    );
}

/** Bottom sheet on phones, centred dialog on larger screens. */
export function Sheet({ open, title, onClose, children }) {
    useEffect(() => {
        if (!open) return;
        const onKey = (e) => e.key === 'Escape' && onClose();
        document.addEventListener('keydown', onKey);
        document.body.style.overflow = 'hidden';
        return () => {
            document.removeEventListener('keydown', onKey);
            document.body.style.overflow = '';
        };
    }, [open, onClose]);
    if (!open) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onClick={onClose}>
            <div
                role="dialog"
                aria-modal="true"
                aria-label={title}
                onClick={(e) => e.stopPropagation()}
                className="pb-safe max-h-[88vh] w-full overflow-y-auto rounded-t-2xl bg-canvas sm:max-w-md sm:rounded-2xl"
            >
                <div className="sticky top-0 z-10 flex items-center justify-between bg-canvas/90 px-4 py-3 backdrop-blur">
                    <h2 className="text-[17px] font-semibold">{title}</h2>
                    <button aria-label="Close" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full bg-fill text-secondary">
                        <X size={16} />
                    </button>
                </div>
                <div className="px-4 pb-6">{children}</div>
            </div>
        </div>
    );
}
