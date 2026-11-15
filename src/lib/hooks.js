import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { subscribe } from './db';

/** Runs an async DB read and re-runs it whenever the data changes. */
export function useLive(read, deps = []) {
    const [state, setState] = useState({ data: undefined, error: null });
    const readRef = useRef(read);
    readRef.current = read;
    useEffect(() => {
        let alive = true;
        const run = () =>
            readRef.current()
                .then((data) => alive && setState({ data, error: null }))
                .catch((error) => alive && setState((s) => ({ ...s, error })));
        run();
        const off = subscribe(run);
        return () => {
            alive = false;
            off();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, deps);
    return state;
}

/** Hash route: "#/customers/c_123" -> ["customers", "c_123"]. */
export function useHashRoute() {
    const get = () => (window.location.hash.replace(/^#\/?/, '') || 'sell').split('/');
    const [route, setRoute] = useState(get);
    useEffect(() => {
        const on = () => setRoute(get());
        window.addEventListener('hashchange', on);
        return () => window.removeEventListener('hashchange', on);
    }, []);
    return route;
}

export const navigate = (path) => {
    window.location.hash = `/${path}`;
};

// ---------- toasts ----------

export const ToastContext = createContext(() => {});
export const useToast = () => useContext(ToastContext);

export function useToastState() {
    const [toast, setToast] = useState(null);
    const timer = useRef(null);
    const show = useCallback((message, { action, tone } = {}) => {
        clearTimeout(timer.current);
        setToast({ message, action, tone, id: Math.random() });
        timer.current = setTimeout(() => setToast(null), action ? 6000 : 3000);
    }, []);
    const dismiss = useCallback(() => setToast(null), []);
    return { toast, show, dismiss };
}

// ---------- PIN lock ----------

export async function hashPin(pin) {
    const bytes = new TextEncoder().encode(`pour:${pin}`);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export const LockContext = createContext({ unlocked: true, requireUnlock: async () => true, lock: () => {} });
export const useLock = () => useContext(LockContext);
