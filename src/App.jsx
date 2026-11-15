import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BarChart3, Ellipsis, ShoppingBag, Users } from 'lucide-react';
import { getSettings, initialize } from './lib/db';
import { LockContext, ToastContext, hashPin, useHashRoute, useLive, useToastState } from './lib/hooks';
import { ErrorState, Spinner } from './components/ui';
import { PinSheet, Toast } from './components/forms';
import Sell from './views/Sell';
import Customers from './views/Customers';
import Today from './views/Today';
import More from './views/More';

const TABS = [
    { id: 'sell', label: 'Sell', icon: ShoppingBag },
    { id: 'customers', label: 'Customers', icon: Users },
    { id: 'sales', label: 'Sales', icon: BarChart3 },
    { id: 'more', label: 'More', icon: Ellipsis },
];

function useSystemTheme() {
    useEffect(() => {
        const media = window.matchMedia('(prefers-color-scheme: dark)');
        const apply = () => (document.documentElement.dataset.theme = media.matches ? 'dark' : 'light');
        apply();
        media.addEventListener('change', apply);
        return () => media.removeEventListener('change', apply);
    }, []);
}

/** PIN lock: unlocked for the rest of the session once the right PIN is entered. */
function useLockState() {
    const { data: settings } = useLive(getSettings);
    const [sessionUnlocked, setSessionUnlocked] = useState(false);
    const [prompt, setPrompt] = useState(null); // { reason, resolve }
    const hasPin = Boolean(settings?.pinHash);
    const unlocked = !hasPin || sessionUnlocked;
    const unlockedRef = useRef(unlocked);
    unlockedRef.current = unlocked;

    const requireUnlock = useCallback((reason) => {
        if (unlockedRef.current) return Promise.resolve(true);
        return new Promise((resolve) => setPrompt({ reason, resolve }));
    }, []);

    const sheet = (
        <PinSheet
            open={Boolean(prompt)}
            title="Enter PIN"
            subtitle={prompt?.reason}
            onClose={() => {
                prompt?.resolve(false);
                setPrompt(null);
            }}
            onDone={async (pin) => {
                if ((await hashPin(pin)) !== settings?.pinHash) return false;
                setSessionUnlocked(true);
                unlockedRef.current = true;
                prompt?.resolve(true);
                setPrompt(null);
                return true;
            }}
        />
    );
    const value = useMemo(() => ({ unlocked, requireUnlock, lock: () => setSessionUnlocked(false) }), [unlocked, requireUnlock]);
    return { value, sheet };
}

function NavLink({ tab, active, compact }) {
    const Icon = tab.icon;
    return (
        <a
            href={`#/${tab.id}`}
            aria-current={active ? 'page' : undefined}
            className={
                compact
                    ? `flex flex-1 flex-col items-center gap-0.5 pt-1.5 text-[10px] font-medium ${active ? 'text-tint' : 'text-tertiary'}`
                    : `flex h-9 items-center gap-2.5 rounded-lg px-3 text-[14px] font-medium ${active ? 'bg-tint-soft text-tint' : 'text-secondary hover:bg-fill'}`
            }
        >
            <Icon size={compact ? 22 : 18} strokeWidth={active ? 2.2 : 1.8} />
            {tab.label}
        </a>
    );
}

export default function App() {
    useSystemTheme();
    const [section, ...rest] = useHashRoute();
    const current = TABS.some((t) => t.id === section) ? section : 'sell';
    const [boot, setBoot] = useState({ ready: false, error: null });
    const toast = useToastState();
    const lock = useLockState();

    const start = useCallback(() => {
        setBoot({ ready: false, error: null });
        initialize()
            .then(() => setBoot({ ready: true, error: null }))
            .catch(() => setBoot({ ready: false, error: 'This browser could not open the shop records. Close other Pour tabs and try again.' }));
    }, []);
    useEffect(() => {
        start();
    }, [start]);

    useEffect(() => {
        window.scrollTo(0, 0);
    }, [section, rest[0]]); // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <ToastContext.Provider value={toast.show}>
            <LockContext.Provider value={lock.value}>
                <div className="min-h-dvh md:flex">
                    <aside className="sticky top-0 hidden h-dvh w-56 shrink-0 flex-col gap-1 border-r border-separator px-3 py-5 md:flex">
                        <div className="mb-5 flex items-center gap-2 px-3">
                            <img src="/icon.svg" alt="" className="h-7 w-7 rounded-lg" />
                            <span className="text-[17px] font-bold tracking-tight">pour</span>
                        </div>
                        {TABS.map((t) => <NavLink key={t.id} tab={t} active={t.id === current} />)}
                    </aside>

                    <main className="mx-auto w-full max-w-2xl px-4 pb-28 pt-[max(env(safe-area-inset-top),8px)] md:pb-10 md:pt-6">
                        {boot.error ? (
                            <ErrorState message={boot.error} onRetry={start} />
                        ) : !boot.ready ? (
                            <Spinner label="Opening the shop…" />
                        ) : (
                            <>
                                {current === 'sell' && <Sell />}
                                {current === 'customers' && <Customers id={rest[0]} />}
                                {current === 'sales' && <Today />}
                                {current === 'more' && <More view={rest[0]} />}
                            </>
                        )}
                    </main>

                    <nav className="pb-safe fixed inset-x-0 bottom-0 z-40 flex border-t border-separator bg-canvas/85 backdrop-blur-xl md:hidden">
                        {TABS.map((t) => <NavLink key={t.id} tab={t} active={t.id === current} compact />)}
                    </nav>
                </div>
                {lock.sheet}
                <Toast toast={toast.toast} onDismiss={toast.dismiss} />
            </LockContext.Provider>
        </ToastContext.Provider>
    );
}
