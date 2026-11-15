// Backup file format and the import of the old Google Sheets debt list.
import { toPesewas } from './money';

export const BACKUP_APP = 'pour';
export const BACKUP_VERSION = 2;
const TABLES = ['products', 'sales', 'customers', 'ledger'];

export function makeBackup(data, now = new Date()) {
    return {
        app: BACKUP_APP,
        version: BACKUP_VERSION,
        exportedAt: now.toISOString(),
        ...Object.fromEntries(TABLES.map((t) => [t, data[t] || []])),
        settings: data.settings || {},
    };
}

/** Throws a readable error if the file isn't a Pour backup. */
export function parseBackup(text) {
    let data;
    try {
        data = JSON.parse(text);
    } catch {
        throw new Error('This file is not a Pour backup (it is not valid JSON).');
    }
    if (data?.app !== BACKUP_APP) throw new Error('This file is not a Pour backup.');
    if (data.version > BACKUP_VERSION) throw new Error('This backup is from a newer version of Pour. Update the app first.');
    for (const t of TABLES) {
        if (!Array.isArray(data[t])) throw new Error(`The backup is damaged (missing ${t}).`);
    }
    return data;
}

// ---------- CSV ----------

/** Minimal RFC 4180 parser: quoted fields, escaped quotes, commas and newlines inside quotes. */
export function parseCsv(text) {
    const rows = [];
    let row = [];
    let field = '';
    let quoted = false;
    const s = String(text).replace(/^﻿/, '');
    for (let i = 0; i < s.length; i++) {
        const c = s[i];
        if (quoted) {
            if (c === '"' && s[i + 1] === '"') {
                field += '"';
                i++;
            } else if (c === '"') quoted = false;
            else field += c;
        } else if (c === '"') quoted = true;
        else if (c === ',') {
            row.push(field);
            field = '';
        } else if (c === '\n' || c === '\r') {
            if (c === '\r' && s[i + 1] === '\n') i++;
            row.push(field);
            rows.push(row);
            row = [];
            field = '';
        } else field += c;
    }
    if (field || row.length) {
        row.push(field);
        rows.push(row);
    }
    return rows.filter((r) => r.some((f) => f.trim()));
}

const csvCell = (v) => {
    const s = String(v ?? '');
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
export const toCsv = (rows) => rows.map((r) => r.map(csvCell).join(',')).join('\r\n');

/**
 * Reads the old debt tracker's sheet (columns Date, Name, Amount, Note, exported as CSV).
 * Returns { rows: [{ date, name, amount, note }], skipped } with amount in pesewas.
 */
export function parseDebtSheet(text) {
    const [header, ...body] = parseCsv(text);
    if (!header) return { rows: [], skipped: 0 };
    const col = (name) => header.findIndex((h) => h.trim().toLowerCase() === name);
    const [iDate, iName, iAmount, iNote] = ['date', 'name', 'amount', 'note'].map(col);
    if (iName < 0 || iAmount < 0) throw new Error('Expected columns named "Name" and "Amount" (like the old debt tracker sheet).');
    const rows = [];
    let skipped = 0;
    for (const r of body) {
        const name = (r[iName] || '').trim();
        const amount = toPesewas(String(r[iAmount] || '').replace(/[^\d.]/g, ''));
        if (!name || !amount) {
            skipped++;
            continue;
        }
        const date = iDate >= 0 && /^\d{4}-\d{2}-\d{2}/.test(r[iDate] || '') ? r[iDate].slice(0, 10) : null;
        rows.push({ date, name, amount, note: iNote >= 0 ? (r[iNote] || '').trim() : '' });
    }
    return { rows, skipped };
}
