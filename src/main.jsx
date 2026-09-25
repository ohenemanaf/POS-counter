import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import {
  Beer, Coffee, Edit3, GlassWater, IceCreamBowl, Menu,
  Plus, Search, Settings2, Sparkles, Trash2, Wine, X
} from 'lucide-react'
import './styles.light.css'

const catalogVersion = 'decorch-enterprise-full-menu-v4'
const wholesaleStocks = [
  ['SACHET-AQUA FRESH', 10], ['SACHETS- COOL', 12], ['SACHETS- MOBILE', 12], ['SACHETS- EVERPURE', 15], ['SACHETS- STANDARD', 12],
  ['VERNA', 32], ['SLIMFIT', 28], ['BEL-ACTIVE', 55], ['PERLA WATER (S)', 34], ['PERLA WATER (M)', 34], ['AWAKE-SMALL', 30], ['AWAKE MEDIUM', 38],
  ['VOLTIC-SMALL', 30], ['VOLTIC-MEDIUM', 38], ['VOLTIC -BIG', 38], ['Mont MONT', 30], ['Bel Malt', 75], ['BEL-AQUA-500 ML', 32],
  ['BEL-AQUA -750ML (MED', 38], ['BEL -AQUA- 1,000ML', 38], ['BEL-AQUA-BOX', 65], ['BEL COLA', 47], ['BEGOO', 60], ['ANGELCOLA/SQUEEZ', 47],
  ['VITAMILK CHAMP', 30], ['VITAMILK MEDIUM', 60], ['VITA MILK-BOTTLE', 90], ['HOLLANDIA KALYPPO', 50], ['PUKKA/TAMARINDA', 55], ['RUSH/STORM( S)', 65],
  ['JUICEE', 55], ['TAMPICO-SMALL', 50], ['DARLING', 70], ['U-FRESH BOTTLE', 75], ['STORM BIG', 75], ['HAPPY DELIGHT', 55], ['PLASTIC COKE/FANTA', 70],
  ['TAMPICO- MEDIUM', 70], ['ALVARO', 100], ['BETA MALT', 110], ['PLATIC MALT', 125], ['KALYPPO', 110], ['WHEAT MILK', 175], ['CAN MALT-SMALL', 155],
  ['FRUIT- TELI', 175], ['FUN MAX/NUTRIDAY', 80], ['PLASTIC COKE -BIG', 150], ['BB COCKTAIL', 300], ['CAN COKE-SMALL', 75], ['CAN MALT-BIG', 300],
  ['DON SIMON', 360], ['CERES', 480], ['VODY ENERGY', 480],
]
const fridgeRetailItems = [
  ['SACHET-ACQUA FRESH', 0.5], ['SACHET- EVERPURE', 0.5], ['ICE BLOCK(SACKET)', 1], ['ICE BLOCK(BIG)', 1.5], ['Bottle water (Small)', 3],
  ['Bottle water (Medium)', 4], ['Bottle water (1.0L/1.5L)', [5, 7]], ['Bel Active', 5], ['Bel Drink', 4], ['YOGOT/CHOCO/FUN ICE', 5], ['FUN SUPER/PASSION', 5], ['KALYPO/HAPPY DELIG', 5],
  ['PUKKA/TAMARINDA', 5], ['STORM/RUSH/5 STAR', 6], ['DARLING LEMON', 7], ['U-FRESH BOTTLE', 6], ['Honey', 65], ['STORM (SMALL)', 6],
  ['STORM-B /BEL MALT', 7], ['TAMPICO', 7], ['PLASTIC COKE (S)', 7], ['HOLLANDIA KALYPPO ST', 7], ['NICHE CHOCOLATE', 9], ['CAN COKE/FANTA/', 12],
  ['ALVARO', 12], ['VITAMILK (CHAMP)', 5], ['VITAMILK (MEDIUM)', 10], ['VITA MILK (BOTTLE)', 15], ['BETA MALT', 10], ['PLASTIC MALT', 12],
  ['CAN MALT', 15], ['FUNMAX / NUTRIDAY', 15], ['BB COCKTAIL', 13], ['HALLANDIA -(M)', 15], ['HALLANDIA -(MM)', 18], ['Kiki Apple', 5],
  ['FANTA/COKE(M)', 10], ['WHEAT MILK', 15], ['DON SIMON-SMALL', 20], ['LUCOZADE CAN', 15], ['LUCOZADE PLASTIC', 18], ['GUINNESS CAN', 18],
  ['BLUE JEANS ENERGY', 20], ['VODY ENERGY', 20], ['RED BULL ENERGY', 25], ['KISS/SMIRNOFF(SMALL)', 20], ['KISS (BIG)', 25], ['FRUIT-TELI', 30],
  ['VITAMIK (BIG)', 30], ['BIG FANTA/SPIRIT/ COKE', 25], ['HOLLANDIA-BIG', 35], ['DON SIMON-BIG', 35], ['WELCH', 45], ['CERES', 45], ['PILLOW', 75],
]
const productPairAliases = {
  sachetaquafresh: 'sachetwaterfresh',
  sachetacquafresh: 'sachetwaterfresh',
  sacheteverpure: 'sacheteverpure',
  sachetseverpure: 'sacheteverpure',
  hollandiakalyppost: 'hollandiakalyppo',
  rushstormssmall: 'stormrush',
  rushstorms: 'stormrush',
  stormrush5star: 'stormrush',
  tampico: 'tampicosmall',
  darlinglemon: 'darling',
  kalypohappydelig: 'kalyppo',
  kalyppo: 'kalyppo',
  plasticcokefanta: 'plasticcokesmall',
  plasticcokes: 'plasticcokesmall',
  bigfantaspiritcoke: 'plasticcokebig',
  plasticcokebig: 'plasticcokebig',
  cancokefanta: 'cancokesmall',
  cancokesmall: 'cancokesmall',
  canmalt: 'canmaltsmall',
  platicmalt: 'plasticmalt',
  plasticmalt: 'plasticmalt',
}
const normalizeProductName = (name) => String(name || '').toLowerCase().replace(/[^a-z0-9]/g, '')
const getProductPairKey = (name) => {
  const normalized = normalizeProductName(name)
  return productPairAliases[normalized] || normalized
}
const getRetailUnitLabel = (name) => {
  const normalized = normalizeProductName(name)
  if (normalized.includes('sachet')) return 'Single sachet'
  if (normalized.includes('iceblock')) return 'Single ice block'
  if (normalized.includes('can')) return 'Single can'
  if (normalized.includes('bottle') || normalized.includes('water') || normalized.includes('plastic')) return 'Single bottle'
  return 'Single item'
}
const getWholesaleUnitLabel = (variant = {}) => {
  const label = variant.wholesaleUnitLabel || 'Carton / box'
  const quantity = Math.max(1, Number(variant.packQuantity) || 1)
  return `${label} · ${quantity} ${quantity === 1 ? 'unit' : 'units'}`
}
const buildProducts = (items, category) => items.map(([name, price], index) => ({
  id: `${category === 'Wholesale Stocks' ? 'w' : 'r'}${index + 1}`,
  name,
  category,
  pricingScope: category === 'Wholesale Stocks' ? 'wholesale' : 'retail',
  pairKey: getProductPairKey(name),
  description: category === 'Wholesale Stocks' ? 'DECORCH ENTERPRISE · wholesale stock' : 'DECORCH ENTERPRISE · fridge retail',
  accent: ['cyan', 'green', 'amber', 'orange', 'pink'][index % 5],
  variants: (Array.isArray(price) ? price : [price]).map((variantPrice, variantIndex) => ({
    id: `v-${category[0].toLowerCase()}${index + 1}-${variantIndex + 1}`,
    sizeLabel: Array.isArray(price) ? ['1.0L', '1.5L'][variantIndex] : 'Standard',
    retailPrice: category === 'Fridge Retail' ? variantPrice : null,
    wholesalePrice: category === 'Wholesale Stocks' ? variantPrice : null,
    retailUnitLabel: category === 'Fridge Retail' ? getRetailUnitLabel(name) : null,
    wholesaleUnitLabel: category === 'Wholesale Stocks' ? 'Carton / box' : null,
    packQuantity: 1,
  })),
}))
const rawSeedProducts = [...buildProducts(wholesaleStocks, 'Wholesale Stocks'), ...buildProducts(fridgeRetailItems, 'Fridge Retail')]
const seedProductsById = new Map(rawSeedProducts.map((product) => [product.id, product]))
const mergeSeedProducts = (products) => {
  const merged = []
  products.forEach((product) => {
    const seed = seedProductsById.get(product.id)
    const entry = {
      ...product,
      pairKey: product.pairKey || seed?.pairKey || null,
      categories: Array.isArray(product.categories) ? product.categories : [product.category],
    }
    if (!seed || !entry.pairKey || !['retail', 'wholesale'].includes(entry.pricingScope)) {
      merged.push(entry)
      return
    }
    const partnerIndex = merged.findIndex((item) => seedProductsById.has(item.id) && item.pairKey === entry.pairKey && item.pricingScope !== entry.pricingScope && item.pricingScope !== 'both' && item.variants.length === entry.variants.length)
    if (partnerIndex < 0) {
      merged.push(entry)
      return
    }
    const partner = merged[partnerIndex]
    const retailProduct = entry.pricingScope === 'retail' ? entry : partner
    const wholesaleProduct = entry.pricingScope === 'wholesale' ? entry : partner
    const variants = retailProduct.variants.map((retailVariant, index) => {
      const wholesaleVariant = wholesaleProduct.variants[index]
      return {
        ...retailVariant,
        retailPrice: retailVariant.retailPrice,
        wholesalePrice: wholesaleVariant.wholesalePrice,
        retailUnitLabel: retailVariant.retailUnitLabel || getRetailUnitLabel(retailProduct.name),
        wholesaleUnitLabel: wholesaleVariant.wholesaleUnitLabel || 'Carton / box',
        packQuantity: wholesaleVariant.packQuantity || 1,
      }
    })
    merged[partnerIndex] = {
      ...retailProduct,
      id: partner.id,
      pricingScope: 'both',
      categories: [...new Set([...retailProduct.categories, ...wholesaleProduct.categories])],
      description: 'DECORCH ENTERPRISE · fridge retail and wholesale stock',
      variants,
    }
  })
  return merged
}
const seedProducts = mergeSeedProducts(rawSeedProducts)

const icons = { Coffee, Soda: GlassWater, Juice: Wine, 'Craft Beer': Beer, Shakes: IceCreamBowl, Water: GlassWater }
const uid = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
const hasPrice = (value) => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value))
const money = (value) => hasPrice(value) ? `GH₵${Number(value).toFixed(2)}` : '—'
const validPricingScope = (scope) => ['retail', 'wholesale', 'both'].includes(scope)
const inferPricingScope = (product) => {
  const variants = Array.isArray(product.variants) ? product.variants : []
  const hasRetail = variants.some((variant) => hasPrice(variant?.retailPrice))
  const hasWholesale = variants.some((variant) => hasPrice(variant?.wholesalePrice))
  if (hasRetail && hasWholesale) return 'both'
  if (hasWholesale) return 'wholesale'
  if (hasRetail) return 'retail'
  return product.category === 'Wholesale Stocks' ? 'wholesale' : 'retail'
}
const migrateProducts = (stored) => stored
  .filter((product) => product && typeof product.name === 'string' && product.name.trim() && typeof product.category === 'string' && product.category.trim() && Array.isArray(product.variants))
  .map((product) => {
    const seed = seedProductsById.get(product.id)
    const sourcePriceKey = seed?.pricingScope === 'wholesale' ? 'wholesalePrice' : 'retailPrice'
    const unusedPriceKey = sourcePriceKey === 'wholesalePrice' ? 'retailPrice' : 'wholesalePrice'
    const variants = product.variants.map((variant) => {
      const seedVariant = seed?.variants.find((item) => item.id === variant?.id)
      if (!seedVariant) return variant
      const sourcePrice = seedVariant[sourcePriceKey]
      const wasDuplicatedSeedPrice = hasPrice(sourcePrice) && Number(variant[sourcePriceKey]) === sourcePrice && Number(variant[unusedPriceKey]) === sourcePrice
      return wasDuplicatedSeedPrice ? { ...variant, [unusedPriceKey]: null } : variant
    })
    return {
      ...product,
      pairKey: product.pairKey || seed?.pairKey || null,
      categories: Array.isArray(product.categories) ? product.categories : [product.category],
      pricingScope: validPricingScope(product.pricingScope) ? product.pricingScope : seed?.pricingScope || inferPricingScope(product),
      variants: variants.map((variant) => ({
        ...variant,
        retailUnitLabel: variant.retailUnitLabel || seed?.variants.find((item) => item.id === variant?.id)?.retailUnitLabel || getRetailUnitLabel(product.name),
        wholesaleUnitLabel: variant.wholesaleUnitLabel || seed?.variants.find((item) => item.id === variant?.id)?.wholesaleUnitLabel || 'Carton / box',
        packQuantity: Number(variant.packQuantity) || 1,
      })),
    }
  })
const tierPriceKey = (priceTier) => priceTier === 'Retail' ? 'retailPrice' : 'wholesalePrice'
const categoryForTier = (priceTier) => priceTier === 'Retail' ? 'Fridge Retail' : 'Wholesale Stocks'
const productHasTier = (product, priceTier) => {
  const scope = validPricingScope(product.pricingScope) ? product.pricingScope : inferPricingScope(product)
  return scope === 'both' || scope === priceTier.toLowerCase()
}
const tierUnitLabel = (product, variant, priceTier) => priceTier === 'Retail'
  ? variant.retailUnitLabel || getRetailUnitLabel(product.name)
  : getWholesaleUnitLabel(variant)
const loadProducts = () => {
  try {
    const needsMigration = localStorage.getItem('pour-catalog-version') !== catalogVersion
    const stored = JSON.parse(localStorage.getItem('pour-products'))
    const products = Array.isArray(stored) ? (needsMigration ? migrateProducts(stored) : stored) : seedProducts
    localStorage.setItem('pour-catalog-version', catalogVersion)
    return products
  } catch {
    return seedProducts
  }
}

function App() {
  const searchInputRef = useRef(null)

  const [products, setProducts] = useState(loadProducts)
  const [mode, setMode] = useState(() => localStorage.getItem('pour-mode') || 'Display')
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All')
  const [priceTier, setPriceTier] = useState(() => localStorage.getItem('pour-price-tier') === 'Wholesale' ? 'Wholesale' : 'Retail')
  const [menuOpen, setMenuOpen] = useState(false)
  const [modal, setModal] = useState(null)
  const [editingProduct, setEditingProduct] = useState(null)
  const [editingVariant, setEditingVariant] = useState(null)

  useEffect(() => { localStorage.setItem('pour-products', JSON.stringify(products)) }, [products])
  useEffect(() => { localStorage.setItem('pour-mode', mode) }, [mode])
  useEffect(() => { localStorage.setItem('pour-price-tier', priceTier) }, [priceTier])
  useEffect(() => {
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {})
  }, [])
  useEffect(() => {
    const handleKeyDown = (event) => {
      const isShortcut = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k'
      if (isShortcut) {
        event.preventDefault()
        searchInputRef.current?.focus()
        searchInputRef.current?.select()
      }
      if (event.key === 'Escape') {
        setSearch('')
        setCategory('All')
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const visibleProducts = useMemo(() => products.filter((product) => productHasTier(product, priceTier) && (mode === 'Admin' || Array.isArray(product.variants) && product.variants.some((variant) => hasPrice(variant[tierPriceKey(priceTier)])))), [products, mode, priceTier])
  const categories = useMemo(() => {
    const available = new Set(visibleProducts.flatMap((product) => product.categories?.length ? product.categories : [product.category]))
    const listCategories = ['Fridge Retail', 'Wholesale Stocks'].filter((item) => available.has(item))
    return ['All', ...listCategories, ...[...available].filter((item) => !listCategories.includes(item))]
  }, [visibleProducts])
  useEffect(() => {
    if (category !== 'All' && !categories.includes(category)) setCategory('All')
  }, [category, categories])
  const filtered = useMemo(() => visibleProducts.filter((product) => {
    const term = search.toLowerCase().trim()
    const variants = Array.isArray(product.variants) ? product.variants : []
    const matchesSearch = !term || [product.name, product.category, product.description, ...variants.map((v) => v.sizeLabel)].join(' ').toLowerCase().includes(term)
    return matchesSearch && (category === 'All' || (product.categories?.length ? product.categories : [product.category]).includes(category))
  }), [visibleProducts, search, category])

  const quickLookup = search.trim() ? filtered[0] : null
  const priceKey = tierPriceKey(priceTier)
  const quickVariant = quickLookup?.variants?.find((variant) => hasPrice(variant[priceKey]))
  const quickUnitLabel = quickLookup && quickVariant ? tierUnitLabel(quickLookup, quickVariant, priceTier) : ''
  const quickPriceSummary = quickVariant ? `${money(quickVariant[priceKey])} · ${quickUnitLabel}` : ''

  const saveProduct = (data) => {
    const pricingScope = validPricingScope(data.pricingScope) ? data.pricingScope : 'retail'
    if (editingProduct) setProducts((items) => items.map((p) => {
      if (p.id !== editingProduct.id) return p
      const listCategories = pricingScope === 'both' ? ['Fridge Retail', 'Wholesale Stocks'] : [categoryForTier(pricingScope === 'retail' ? 'Retail' : 'Wholesale')]
      return { ...p, name: data.name.trim(), pairKey: getProductPairKey(data.name), category: listCategories[0], pricingScope, categories: listCategories }
    }))
    else {
      const optionalPrice = (value) => value === '' || value === null || value === undefined ? null : Number(value)
      const listCategories = pricingScope === 'both' ? ['Fridge Retail', 'Wholesale Stocks'] : [categoryForTier(pricingScope === 'retail' ? 'Retail' : 'Wholesale')]
      const newProduct = {
        id: uid('p'),
        name: data.name.trim(),
        category: listCategories[0],
        categories: listCategories,
        pairKey: getProductPairKey(data.name),
        pricingScope,
        description: '',
        accent: ['cyan', 'green', 'amber', 'orange', 'pink'][products.length % 5],
        variants: [{
          id: uid('v'),
          sizeLabel: 'Standard',
          retailPrice: pricingScope === 'wholesale' ? null : optionalPrice(data.initialRetailPrice),
          wholesalePrice: pricingScope === 'retail' ? null : optionalPrice(data.initialWholesalePrice),
          retailUnitLabel: getRetailUnitLabel(data.name),
          wholesaleUnitLabel: 'Carton / box',
          packQuantity: 1,
        }],
      }
      setProducts((items) => {
        const pairIndex = items.findIndex((item) => (item.pairKey || getProductPairKey(item.name)) === newProduct.pairKey)
        if (pairIndex < 0) return [...items, newProduct]
        const existing = items[pairIndex]
        const existingScope = validPricingScope(existing.pricingScope) ? existing.pricingScope : inferPricingScope(existing)
        const mergedScope = existingScope === 'both' || pricingScope === 'both' || existingScope !== pricingScope ? 'both' : existingScope
        const incomingVariant = newProduct.variants[0]
        let matchedVariant = false
        const variants = [...existing.variants]
        const variantIndex = variants.findIndex((variant) => (variant.sizeLabel || 'Standard').trim().toLowerCase() === 'standard')
        if (variantIndex >= 0) {
          const current = variants[variantIndex]
          variants[variantIndex] = {
            ...current,
            retailPrice: hasPrice(incomingVariant.retailPrice) ? incomingVariant.retailPrice : current.retailPrice,
            wholesalePrice: hasPrice(incomingVariant.wholesalePrice) ? incomingVariant.wholesalePrice : current.wholesalePrice,
          }
          matchedVariant = true
        }
        if (!matchedVariant) variants.push(incomingVariant)
        const categories = mergedScope === 'both' ? ['Fridge Retail', 'Wholesale Stocks'] : listCategories
        return items.map((item, index) => index === pairIndex ? {
          ...existing,
          pricingScope: mergedScope,
          category: categories[0],
          categories,
          variants,
        } : item)
      })
    }
    closeModal()
  }
  const saveVariant = (data) => {
    setProducts((items) => items.map((p) => {
      if (p.id !== data.productId) return p
      const scope = validPricingScope(p.pricingScope) ? p.pricingScope : 'both'
      const variant = {
        ...data,
        retailPrice: scope === 'wholesale' ? null : data.retailPrice,
        wholesalePrice: scope === 'retail' ? null : data.wholesalePrice,
        retailUnitLabel: p.variants.find((item) => item.id === data.id)?.retailUnitLabel || getRetailUnitLabel(p.name),
        wholesaleUnitLabel: p.variants.find((item) => item.id === data.id)?.wholesaleUnitLabel || 'Carton / box',
        packQuantity: Number(data.packQuantity || 1),
      }
      return { ...p, variants: p.variants.some((item) => item.id === data.id) ? p.variants.map((item) => item.id === data.id ? variant : item) : [...p.variants, { ...variant, id: uid('v') }] }
    }))
    closeModal()
  }
  const deleteProduct = (id) => { if (window.confirm('Remove this drink from the catalog?')) setProducts((items) => items.filter((p) => p.id !== id)) }
  const clearCatalog = () => {
    if (products.length && window.confirm('Remove all drinks, sizes, and prices from the catalog? This cannot be undone.')) setProducts([])
  }
  const deleteVariant = (productId, variantId) => setProducts((items) => items.map((p) => p.id === productId ? { ...p, variants: p.variants.filter((v) => v.id !== variantId) } : p))
  const closeModal = () => { setModal(null); setEditingProduct(null); setEditingVariant(null) }

  return <div className="app-shell">
    <header className="topbar">
      <div className="brand"><div className="brand-mark"><Sparkles size={17} /></div><div><b>pour</b><span>DRINK CATALOG</span></div></div>
      <div className="header-actions">
        <div className="mode-toggle" aria-label="Application mode">
          <button className={mode === 'Display' ? 'active' : ''} onClick={() => setMode('Display')}>Display</button>
          <button className={mode === 'Admin' ? 'active' : ''} onClick={() => setMode('Admin')}><Settings2 size={14} /> Admin</button>
        </div>
        <button className="icon-button menu-button" aria-label={menuOpen ? 'Close categories menu' : 'Open categories menu'} aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}>{menuOpen ? <X size={20} /> : <Menu size={20} />}</button>
      </div>
      {menuOpen && <nav className="category-nav menu-panel" aria-label="Drink categories">{categories.map((item) => { const Icon = icons[item] || GlassWater; return <button key={item} onClick={() => { setCategory(item); if (item === 'Fridge Retail') setPriceTier('Retail'); if (item === 'Wholesale Stocks') setPriceTier('Wholesale'); setMenuOpen(false) }} className={category === item ? 'active' : ''}>{item !== 'All' && <Icon size={15} />}{item}</button> })}</nav>}
    </header>
    <main>
      <section className="counter-hero">
        <div className="counter-copy">
          <p className="eyebrow">POS COUNTER</p>
          <h1>Quick drink price lookup</h1>
          <p className="hero-copy">Type a drink name or size to find the current price instantly.</p>
        </div>
        <div className="counter-price-card">
          <span className="eyebrow">MATCH</span>
          <h2>{quickLookup ? quickLookup.name : search.trim() ? 'No match' : 'Ready to search'}</h2>
          <div className="counter-price">{quickVariant ? money(quickVariant[priceKey]) : '—'}</div>
          <small>{quickLookup ? `${categoryForTier(priceTier)} · ${quickUnitLabel}` : 'Search a drink name or size'}</small>
        </div>
      </section>
      <div className="lookup-strip">
        <div>
          <span className="eyebrow">QUICK LOOKUP</span>
          <strong>{quickLookup ? `${quickLookup.name} · ${quickPriceSummary || 'No price for this list'}` : search.trim() ? 'No drink found' : 'Enter a drink or size to see its price'}</strong>
        </div>
        <button className="ghost-button" onClick={() => setSearch('')}>Clear</button>
      </div>
      <div className="toolbar counter-toolbar">
        <label className="search-box"><Search size={18} /><input ref={searchInputRef} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search drinks, sizes..." /><kbd>⌘ K</kbd></label>
        <div className="tier-switch" role="group" aria-label="Price list">
          <button className={priceTier === 'Retail' ? 'selected' : ''} aria-pressed={priceTier === 'Retail'} onClick={() => { setPriceTier('Retail'); setCategory('All') }}>Retail · single</button>
          <button className={priceTier === 'Wholesale' ? 'selected' : ''} aria-pressed={priceTier === 'Wholesale'} onClick={() => { setPriceTier('Wholesale'); setCategory('All') }}>Wholesale · carton</button>
        </div>
      </div>
      <div className="catalog-heading"><div><span className="eyebrow">CURATED SELECTION</span><h2>{category === 'All' ? 'All drinks' : category}<span>{filtered.length} items</span></h2></div>{mode === 'Admin' && <div className="catalog-actions"><button className="danger-button" onClick={clearCatalog} disabled={!products.length}><Trash2 size={16} /> Remove all</button><button className="outline-button" onClick={() => { setEditingProduct(null); setModal('product') }}><Plus size={16} /> Add product</button></div>}</div>
      {filtered.length ? <section className="product-grid">{filtered.map((product, index) => <ProductCard key={product.id} product={product} admin={mode === 'Admin'} priceTier={priceTier} index={index} onEdit={() => { setEditingProduct(product); setModal('product') }} onDelete={() => deleteProduct(product.id)} onAddVariant={() => { setEditingVariant({ productId: product.id }); setModal('variant') }} onEditVariant={(variant) => { setEditingVariant({ ...variant, productId: product.id }); setModal('variant') }} onDeleteVariant={(id) => deleteVariant(product.id, id)} />)}</section> : <div className="empty"><Search size={28} /><h3>{search.trim() ? 'No matching price in this list' : 'No drinks in this list'}</h3><p>Try another search or switch price lists.</p></div>}
    </main>
    {modal && <Modal type={modal} product={editingProduct} variant={editingVariant} products={products} defaultPricingScope={priceTier === 'Retail' ? 'retail' : 'wholesale'} onClose={closeModal} onSaveProduct={saveProduct} onSaveVariant={saveVariant} />}
  </div>
}

function ProductCard({ product, admin, priceTier, index, onEdit, onDelete, onAddVariant, onEditVariant, onDeleteVariant }) {
  const categories = product.categories?.length ? product.categories : [product.category]
  const listCategory = categoryForTier(priceTier)
  const cardCategory = categories.includes(listCategory) ? listCategory : product.category
  const Icon = icons[cardCategory] || GlassWater
  const tierDescription = `${listCategory} · ${priceTier === 'Retail' ? getRetailUnitLabel(product.name) : getWholesaleUnitLabel(product.variants[0])}`
  const customDescription = product.description?.startsWith('DECORCH ENTERPRISE') ? '' : product.description
  const description = [customDescription, tierDescription].filter(Boolean).join(' · ')
  return <article className={`product-card accent-${product.accent}`} style={{ '--delay': `${index * 55}ms` }}>
    <div className="card-top"><div className="product-icon"><Icon size={22} /></div><span className="category-label">{cardCategory}</span>{admin && <div className="card-actions"><button onClick={onEdit} aria-label={`Edit ${product.name}`}><Edit3 size={15} /></button><button onClick={onDelete} aria-label={`Delete ${product.name}`}><Trash2 size={15} /></button></div>}</div>
    <h3>{product.name}</h3><p className="description">{description}</p>
    <div className="variants">{product.variants.map((variant) => {
      const variantPrice = variant[tierPriceKey(priceTier)]
      if (!admin && !hasPrice(variantPrice)) return null
      return <div className={`variant-row ${admin ? 'admin' : ''}`} key={variant.id}>
        <span className="size-badge">{variant.sizeLabel}<small>{tierUnitLabel(product, variant, priceTier)}</small></span>
        <strong>{hasPrice(variantPrice) ? money(variantPrice) : 'No price'}</strong>
        {admin && <div className="variant-actions"><button onClick={() => onEditVariant(variant)} aria-label={`Edit ${variant.sizeLabel} price`}><Edit3 size={12} /></button><button onClick={() => onDeleteVariant(variant.id)} aria-label={`Delete ${variant.sizeLabel} price`}><Trash2 size={12} /></button></div>}
      </div>
    })}</div>
    {admin && <button className="add-variant" onClick={onAddVariant}><Plus size={14} /> Add size variant</button>}
  </article>
}

function Modal({ type, product, variant, products, defaultPricingScope, onClose, onSaveProduct, onSaveVariant }) {
  const [form, setForm] = useState(type === 'variant' ? { ...variant } : { name: product?.name || '', pricingScope: product?.pricingScope || defaultPricingScope, initialRetailPrice: '', initialWholesalePrice: '' })
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }))
  const selectedProduct = products.find((item) => item.id === form.productId)
  const variantScope = validPricingScope(selectedProduct?.pricingScope) ? selectedProduct.pricingScope : 'both'
  const submit = (e) => {
    e.preventDefault()
    if (type === 'variant') {
      const asOptionalPrice = (value) => value === null || value === '' || value === undefined ? null : Number(value)
      onSaveVariant({ ...form, retailPrice: asOptionalPrice(form.retailPrice), wholesalePrice: asOptionalPrice(form.wholesalePrice), packQuantity: 1 })
    } else onSaveProduct(form)
  }
  return <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}><div className="modal" role="dialog" aria-modal="true">
    <div className="modal-header"><div><span className="eyebrow">CATALOG ADMIN</span><h2>{type === 'variant' ? (variant?.id ? 'Edit size variant' : 'Add size variant') : (product ? 'Edit product' : 'Add product')}</h2></div><button className="close-button" onClick={onClose} aria-label="Close"><X size={20} /></button></div>
    <form onSubmit={submit}><div className="form-grid">
      {type === 'product' ? <>
        <label>Product name<input required value={form.name} onChange={(e) => update('name', e.target.value)} placeholder="e.g. Cold Brew" /></label>
        <label>Price list<select value={form.pricingScope} onChange={(e) => update('pricingScope', e.target.value)}><option value="retail">Retail only</option><option value="wholesale">Wholesale stock only</option><option value="both">Retail and wholesale</option></select></label>
        {!product && <>
          {form.pricingScope !== 'wholesale' && <label>Retail price · single item<input type="number" min="0" step="0.01" value={form.initialRetailPrice} onChange={(e) => update('initialRetailPrice', e.target.value)} /></label>}
          {form.pricingScope !== 'retail' && <label>Wholesale price · carton / box<input type="number" min="0" step="0.01" value={form.initialWholesalePrice} onChange={(e) => update('initialWholesalePrice', e.target.value)} /></label>}
        </>}
      </> : <>
        <label>Product<select required disabled={Boolean(variant?.id)} value={form.productId || ''} onChange={(e) => update('productId', e.target.value)}><option value="" disabled>Select product</option>{products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
        <label>Size label<input required value={form.sizeLabel || ''} onChange={(e) => update('sizeLabel', e.target.value)} placeholder="e.g. 20 oz" /></label>
        {variantScope !== 'wholesale' && <label className={variantScope === 'retail' ? 'full' : ''}>Retail price · per item<input type="number" min="0" step="0.01" value={form.retailPrice ?? ''} onChange={(e) => update('retailPrice', e.target.value === '' ? null : e.target.value)} /></label>}
        {variantScope !== 'retail' && <label className={variantScope === 'wholesale' ? 'full' : ''}>Wholesale price · per carton / box<input type="number" min="0" step="0.01" value={form.wholesalePrice ?? ''} onChange={(e) => update('wholesalePrice', e.target.value === '' ? null : e.target.value)} /></label>}
      </>}
    </div><button className="primary-button submit" type="submit">{product || variant?.id ? 'Save changes' : 'Add to catalog'} <Sparkles size={15} /></button></form>
  </div></div>
}

createRoot(document.getElementById('root')).render(<App />)
