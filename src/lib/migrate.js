// Carries the catalog from Pour v1 (localStorage "pour-products") into v2.
// v1 stored each size as a "variant" with retailPrice and wholesalePrice in cedis.
// The built-in menu set both prices to the same number, so they become one price.
// If the shop had edited a variant to have two different prices, both are kept
// as separate sell options, so nothing the shop entered is lost.
import { toPesewas } from './money';

export const V1_PRODUCTS_KEY = 'pour-products';

export function migrateV1Products(v1Products) {
    if (!Array.isArray(v1Products)) return [];
    return v1Products
        .filter((p) => p && typeof p.name === 'string' && p.name.trim())
        .map((p, index) => {
            const variants = [];
            for (const v of Array.isArray(p.variants) ? p.variants : []) {
                const retail = toPesewas(v.retailPrice);
                const wholesale = toPesewas(v.wholesalePrice);
                const label = cleanLabel(v.sizeLabel);
                if (wholesale && wholesale !== retail) {
                    const pack = Number(v.packQuantity) > 1 ? ` (${Number(v.packQuantity)})` : '';
                    variants.push({ id: `${v.id}-single`, label: joinLabel(label, 'single'), price: retail });
                    variants.push({ id: `${v.id}-carton`, label: joinLabel(label, `carton${pack}`), price: wholesale });
                } else {
                    variants.push({ id: String(v.id), label, price: retail });
                }
            }
            return {
                id: String(p.id || `p${index + 1}`),
                name: p.name.trim(),
                category: categoryName(p.category),
                variants,
                order: index,
            };
        });
}

// v1 labels were generic ("Wholesale stock", "Fridge retail"); real sizes ("1.0L") are kept.
function cleanLabel(label) {
    const l = String(label || '').trim();
    return /^(wholesale stock|fridge retail|price only)$/i.test(l) ? '' : l;
}

const joinLabel = (a, b) => [a, b].filter(Boolean).join(' · ');

function categoryName(category) {
    const c = String(category || '').trim();
    if (c === 'Wholesale Stocks') return 'Wholesale (carton)';
    if (c === 'Fridge Retail') return 'Fridge (single)';
    return c || 'Other';
}

/** Reads v1 data from localStorage. Never deletes it, so the old app keeps working if rolled back. */
export function readV1Products(storage = globalThis.localStorage) {
    try {
        const raw = storage?.getItem(V1_PRODUCTS_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}
