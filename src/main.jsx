import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import {
  Beer, ChevronDown, Coffee, Edit3, GlassWater, IceCreamBowl, Menu,
  Plus, Search, Settings2, Sparkles, Trash2, Wine, X
} from 'lucide-react'
import './styles.light.css'

const catalogVersion = 'decorch-enterprise-full-menu-v2'
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
const buildProducts = (items, category) => items.map(([name, price], index) => ({
  id: `${category === 'Wholesale Stocks' ? 'w' : 'r'}${index + 1}`,
  name,
  category,
  description: category === 'Wholesale Stocks' ? 'DECORCH ENTERPRISE · wholesale stock' : 'DECORCH ENTERPRISE · fridge retail',
  accent: ['cyan', 'green', 'amber', 'orange', 'pink'][index % 5],
  variants: (Array.isArray(price) ? price : [price]).map((variantPrice, variantIndex) => ({
    id: `v-${category[0].toLowerCase()}${index + 1}-${variantIndex + 1}`,
    sizeLabel: Array.isArray(price) ? ['1.0L', '1.5L'][variantIndex] : category === 'Wholesale Stocks' ? 'Wholesale stock' : 'Fridge retail',
    retailPrice: category === 'Fridge Retail' ? variantPrice : null,
    wholesalePrice: category === 'Wholesale Stocks' ? variantPrice : null,
    packQuantity: 1,
  })),
}))
const seedProducts = [...buildProducts(wholesaleStocks, 'Wholesale Stocks'), ...buildProducts(fridgeRetailItems, 'Fridge Retail')]
const seedProductsById = new Map(seedProducts.map((product) => [product.id, product]))

const icons = { Coffee, Soda: GlassWater, Juice: Wine, 'Craft Beer': Beer, Shakes: IceCreamBowl, Water: GlassWater }
const uid = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
const hasPrice = (value) => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value))
const money = (value) => hasPrice(value) ? `GH₵${Number(value).toFixed(2)}` : '—'
const migrateProducts = (stored) => stored
  .filter((product) => product && typeof product.name === 'string' && product.name.trim() && typeof product.category === 'string' && product.category.trim() && Array.isArray(product.variants))
  .map((product) => {
    const seed = seedProductsById.get(product.id)
    if (!seed || !Array.isArray(product.variants)) return product
    const sourcePriceKey = seed.category === 'Wholesale Stocks' ? 'wholesalePrice' : 'retailPrice'
    const unusedPriceKey = sourcePriceKey === 'wholesalePrice' ? 'retailPrice' : 'wholesalePrice'
    const variants = product.variants.map((variant) => {
      const seedVariant = seed.variants.find((item) => item.id === variant.id)
      if (!seedVariant) return variant
      const sourcePrice = seedVariant[sourcePriceKey]
      const wasDuplicatedSeedPrice = hasPrice(sourcePrice) && Number(variant[sourcePriceKey]) === sourcePrice && Number(variant[unusedPriceKey]) === sourcePrice
      return wasDuplicatedSeedPrice ? { ...variant, [unusedPriceKey]: null } : variant
    })
    return { ...product, variants }
  })
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
  const [priceTier, setPriceTier] = useState('Retail')
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All')
  const [menuOpen, setMenuOpen] = useState(false)
  const [modal, setModal] = useState(null)
  const [editingProduct, setEditingProduct] = useState(null)
  const [editingVariant, setEditingVariant] = useState(null)

  useEffect(() => { localStorage.setItem('pour-products', JSON.stringify(products)) }, [products])
  useEffect(() => { localStorage.setItem('pour-mode', mode) }, [mode])
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

  const priceKey = priceTier === 'Retail' ? 'retailPrice' : 'wholesalePrice'
  const tierProducts = useMemo(() => mode === 'Admin' ? products : products.filter((product) => Array.isArray(product.variants) && product.variants.some((variant) => hasPrice(variant[priceKey]))), [products, mode, priceKey])
  const categories = useMemo(() => ['All', ...new Set(tierProducts.map((p) => p.category))], [tierProducts])
  useEffect(() => {
    if (category !== 'All' && !categories.includes(category)) setCategory('All')
  }, [category, categories])
  const filtered = useMemo(() => tierProducts.filter((product) => {
    const term = search.toLowerCase().trim()
    const variants = Array.isArray(product.variants) ? product.variants : []
    const matchesSearch = !term || [product.name, product.category, product.description, ...variants.map((v) => v.sizeLabel)].join(' ').toLowerCase().includes(term)
    return matchesSearch && (category === 'All' || product.category === category)
  }), [tierProducts, search, category])

  const quickLookup = filtered[0]
  const quickVariant = quickLookup?.variants?.find((variant) => hasPrice(variant[priceKey]))
  const quickPrice = quickVariant ? money(quickVariant[priceKey]) : '—'

  const saveProduct = (data) => {
    if (editingProduct) setProducts((items) => items.map((p) => p.id === editingProduct.id ? { ...p, ...data } : p))
    else setProducts((items) => [...items, { ...data, id: uid('p'), variants: [{ id: uid('v'), sizeLabel: 'Standard', retailPrice: null, wholesalePrice: null, packQuantity: 1 }] }])
    closeModal()
  }
  const saveVariant = (data) => {
    setProducts((items) => items.map((p) => p.id === data.productId ? { ...p, variants: p.variants.some((v) => v.id === data.id) ? p.variants.map((v) => v.id === data.id ? data : v) : [...p.variants, { ...data, id: uid('v') }] } : p))
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
      {menuOpen && <nav className="category-nav menu-panel" aria-label="Drink categories">{categories.map((item) => { const Icon = icons[item] || GlassWater; return <button key={item} onClick={() => { setCategory(item); setMenuOpen(false) }} className={category === item ? 'active' : ''}>{item !== 'All' && <Icon size={15} />}{item}</button> })}</nav>}
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
          <h2>{quickLookup ? quickLookup.name : 'No match'}</h2>
          <div className="counter-price">{quickLookup ? quickPrice : '--'}</div>
          <small>{quickLookup ? `${quickLookup.category} · ${quickVariant?.sizeLabel || 'Price only'} · ${priceTier === 'Wholesale' ? 'wholesale stock' : 'retail item'}` : 'Try a product or size name'}</small>
        </div>
      </section>
      <div className="lookup-strip">
        <div>
          <span className="eyebrow">QUICK LOOKUP</span>
          <strong>{quickLookup ? `${quickLookup.name} · ${quickPrice}` : 'No drink found'}</strong>
        </div>
        <button className="ghost-button" onClick={() => setSearch('')}>Clear</button>
      </div>
      <div className="toolbar counter-toolbar">
        <label className="search-box"><Search size={18} /><input ref={searchInputRef} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search drinks, sizes..." /><kbd>⌘ K</kbd></label>
        <div className="tier-switch"><button className={priceTier === 'Retail' ? 'selected' : ''} onClick={() => { setPriceTier('Retail'); setCategory('All') }}>Retail · item</button><button className={priceTier === 'Wholesale' ? 'selected' : ''} onClick={() => { setPriceTier('Wholesale'); setCategory('All') }}>Wholesale · stock</button></div>
      </div>
      <div className="catalog-heading"><div><span className="eyebrow">CURATED SELECTION</span><h2>{category === 'All' ? 'All drinks' : category}<span>{filtered.length} items</span></h2></div>{mode === 'Admin' && <div className="catalog-actions"><button className="danger-button" onClick={clearCatalog} disabled={!products.length}><Trash2 size={16} /> Remove all</button><button className="outline-button" onClick={() => { setEditingProduct(null); setModal('product') }}><Plus size={16} /> Add product</button></div>}</div>
      {filtered.length ? <section className="product-grid">{filtered.map((product, index) => <ProductCard key={product.id} product={product} priceTier={priceTier} admin={mode === 'Admin'} index={index} onEdit={() => { setEditingProduct(product); setModal('product') }} onDelete={() => deleteProduct(product.id)} onAddVariant={() => { setEditingVariant({ productId: product.id }); setModal('variant') }} onEditVariant={(variant) => { setEditingVariant({ ...variant, productId: product.id }); setModal('variant') }} onDeleteVariant={(id) => deleteVariant(product.id, id)} />)}</section> : <div className="empty"><Search size={28} /><h3>No drinks found</h3><p>Try another search or category.</p></div>}
    </main>
    {mode === 'Admin' && <button className="admin-fab" onClick={() => { setEditingProduct(null); setModal('product') }}><Plus size={22} /><span>New item</span></button>}
    {modal && <Modal type={modal} product={editingProduct} variant={editingVariant} products={products} onClose={closeModal} onSaveProduct={saveProduct} onSaveVariant={saveVariant} />}
  </div>
}

function ProductCard({ product, priceTier, admin, index, onEdit, onDelete, onAddVariant, onEditVariant, onDeleteVariant }) {
  const Icon = icons[product.category] || GlassWater
  const priceKey = priceTier === 'Retail' ? 'retailPrice' : 'wholesalePrice'
  return <article className={`product-card accent-${product.accent}`} style={{ '--delay': `${index * 55}ms` }}>
    <div className="card-top"><div className="product-icon"><Icon size={22} /></div><span className="category-label">{product.category}</span>{admin && <div className="card-actions"><button onClick={onEdit} aria-label={`Edit ${product.name}`}><Edit3 size={15} /></button><button onClick={onDelete} aria-label={`Delete ${product.name}`}><Trash2 size={15} /></button></div>}</div>
    <h3>{product.name}</h3><p className="description">{product.description}</p>
    <div className="variants">{product.variants.map((variant) => <div className="variant-row" key={variant.id}><span className="size-badge">{variant.sizeLabel}<small>{priceTier === 'Retail' ? 'retail item' : 'wholesale stock'}</small></span><strong>{money(variant[priceKey])}</strong>{admin && <div className="variant-actions"><button onClick={() => onEditVariant(variant)} aria-label={`Edit ${variant.sizeLabel} price`}><Edit3 size={12} /></button><button onClick={() => onDeleteVariant(variant.id)} aria-label={`Delete ${variant.sizeLabel} price`}><Trash2 size={12} /></button></div>}</div>)}</div>
    {admin && <button className="add-variant" onClick={onAddVariant}><Plus size={14} /> Add size variant</button>}
  </article>
}

function Modal({ type, product, variant, products, onClose, onSaveProduct, onSaveVariant }) {
  const [tab, setTab] = useState(type === 'variant' ? 'variant' : 'product')
  const [form, setForm] = useState(type === 'variant' ? { ...variant } : { name: product?.name || '', category: product?.category || 'Coffee', description: product?.description || '', accent: product?.accent || 'cyan' })
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }))
  const submit = (e) => {
    e.preventDefault()
    if (type === 'variant') {
      const asOptionalPrice = (value) => value === null || value === '' || value === undefined ? null : Number(value)
      onSaveVariant({ ...form, retailPrice: asOptionalPrice(form.retailPrice), wholesalePrice: asOptionalPrice(form.wholesalePrice), packQuantity: Number(form.packQuantity) })
    } else if (tab === 'product') onSaveProduct(form)
  }
  return <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}><div className="modal" role="dialog" aria-modal="true">
    <div className="modal-header"><div><span className="eyebrow">CATALOG ADMIN</span><h2>{tab === 'variant' ? (variant?.id ? 'Edit size variant' : 'Add size variant') : (product ? 'Edit product' : 'Add product')}</h2></div><button className="close-button" onClick={onClose} aria-label="Close"><X size={20} /></button></div>
    <div className="modal-tabs">{type === 'product' ? <><button className={tab === 'category' ? 'active' : ''} onClick={() => setTab('category')}>Category</button><button className={tab === 'product' ? 'active' : ''} onClick={() => setTab('product')}>Product</button></> : <button className="active" type="button">Variant</button>}</div>
    {tab === 'category' ? <div className="category-manager"><p>Categories are created automatically from products. To add one, create a product and enter its category below.</p><button onClick={() => setTab('product')} className="primary-button">Create a product <ChevronDown size={16} /></button></div> : <form onSubmit={submit}><div className="form-grid">
      {tab === 'product' ? <><label>Product name<input required value={form.name} onChange={(e) => update('name', e.target.value)} placeholder="e.g. Cold Brew" /></label><label>Category<input required value={form.category} onChange={(e) => update('category', e.target.value)} placeholder="e.g. Coffee" /></label><label className="full">Description<input value={form.description} onChange={(e) => update('description', e.target.value)} placeholder="Short tasting notes" /></label><label>Card color<select value={form.accent} onChange={(e) => update('accent', e.target.value)}>{['cyan', 'green', 'amber', 'orange', 'purple', 'pink'].map((color) => <option key={color}>{color}</option>)}</select></label></> : <><label>Product<select required disabled={Boolean(variant?.id)} value={form.productId || ''} onChange={(e) => update('productId', e.target.value)}><option value="" disabled>Select product</option>{products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label>Size label<input required value={form.sizeLabel || ''} onChange={(e) => update('sizeLabel', e.target.value)} placeholder="e.g. 20 oz" /></label><label>Retail price · per item<input type="number" min="0" step="0.01" value={form.retailPrice ?? ''} onChange={(e) => update('retailPrice', e.target.value === '' ? null : e.target.value)} /></label><label>Wholesale price · stock entry<input type="number" min="0" step="0.01" value={form.wholesalePrice ?? ''} onChange={(e) => update('wholesalePrice', e.target.value === '' ? null : e.target.value)} /></label><label>Units per stock entry<input required type="number" min="1" value={form.packQuantity ?? 1} onChange={(e) => update('packQuantity', e.target.value)} /></label></>}
    </div><button className="primary-button submit" type="submit">{product || variant?.id ? 'Save changes' : 'Add to catalog'} <Sparkles size={15} /></button></form>}
  </div></div>
}

createRoot(document.getElementById('root')).render(<App />)
