// All money is stored as whole pesewas (GH₵1 = 100 pesewas) so sums never drift
// the way decimals do (0.1 + 0.2 !== 0.3).

export const toPesewas = (cedis) => Math.round(Number(cedis || 0) * 100);
export const toCedis = (pesewas) => (pesewas || 0) / 100;

/** 1250 -> "GH₵12.50", -500 -> "-GH₵5.00" */
export function formatMoney(pesewas) {
    const sign = pesewas < 0 ? '-' : '';
    const abs = Math.abs(pesewas || 0);
    const cedis = Math.floor(abs / 100).toLocaleString('en-GH');
    return `${sign}GH₵${cedis}.${String(abs % 100).padStart(2, '0')}`;
}

/** Parses what a person types into a price box: "12", "12.5", "1,200.50", "GH₵ 7". */
export function parseMoneyInput(text) {
    const clean = String(text ?? '').replace(/[^\d.]/g, '');
    if (!clean || (clean.match(/\./g) || []).length > 1) return null;
    const value = Number(clean);
    return Number.isFinite(value) ? toPesewas(value) : null;
}
