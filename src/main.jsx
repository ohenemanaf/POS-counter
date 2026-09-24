import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import {
  Beer, ChevronDown, Coffee, Edit3, GlassWater, IceCreamBowl, Menu,
  Plus, Search, Settings2, Sparkles, Trash2, Wine, X
} from 'lucide-react'
import './styles.light.css'

const seedProducts = [
  { id: 'p1', name: 'Brewed Coffee', category: 'Coffee', description: 'Slow-roasted house blend', accent: 'amber', variants: [
    { id: 'v1', sizeLabel: '12 oz', retailPrice: 12.5, wholesalePrice: 9.5, packQuantity: 1 },
    { id: 'v2', sizeLabel: '16 oz', retailPrice: 15.5, wholesalePrice: 12.0, packQuantity: 1 },
  ]},
  { id: 'p2', name: 'Mango Fizz', category: 'Soda', description: 'Tropical mango · sparkling', accent: 'orange', variants: [
    { id: 'v3', sizeLabel: '12 oz', retailPrice: 14.0, wholesalePrice: 10.0, packQuantity: 1 },
    { id: 'v4', sizeLabel: '24 oz', retailPrice: 22.5, wholesalePrice: 17.5, packQuantity: 1 },
  ]},
  { id: 'p3', name: 'Blueberry Lemonade', category: 'Juice', description: 'Fresh squeezed · lightly sweet', accent: 'purple', variants: [
    { id: 'v5', sizeLabel: '16 oz', retailPrice: 18.0, wholesalePrice: 13.5, packQuantity: 1 },
    { id: 'v6', sizeLabel: '1 gal', retailPrice: 60.0, wholesalePrice: 45.0, packQuantity: 1 },
  ]},
  { id: 'p4', name: 'Hazy IPA', category: 'Craft Beer', description: 'Citrus hops · 6.2% ABV', accent: 'green', variants: [
    { id: 'v7', sizeLabel: '16 oz', retailPrice: 25.0, wholesalePrice: 19.0, packQuantity: 1 },
    { id: 'v8', sizeLabel: '4 pack', retailPrice: 90.0, wholesalePrice: 72.0, packQuantity: 4 },
  ]},
  { id: 'p5', name: 'Vanilla Cloud', category: 'Shakes', description: 'Vanilla bean · whipped cream', accent: 'pink', variants: [
    { id: 'v9', sizeLabel: '12 oz', retailPrice: 24.0, wholesalePrice: 18.0, packQuantity: 1 },
    { id: 'v10', sizeLabel: '20 oz', retailPrice: 30.0, wholesalePrice: 22.0, packQuantity: 1 },
  ]},
  { id: 'p6', name: 'Sparkling Water', category: 'Water', description: 'Pure mineral · lime essence', accent: 'cyan', variants: [
    { id: 'v11', sizeLabel: '16 oz', retailPrice: 9.5, wholesalePrice: 7.0, packQuantity: 1 },
    { id: 'v12', sizeLabel: '12 pack', retailPrice: 79.0, wholesalePrice: 62.0, packQuantity: 12 },
  ]},
]

const icons = { Coffee, Soda: GlassWater, Juice: Wine, 'Craft Beer': Beer, Shakes: IceCreamBowl, Water: GlassWater }
const uid = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
const money = (value) => `GH₵${Number(value || 0).toFixed(2)}`
const loadProducts = () => {
  try {
    const stored = JSON.parse(localStorage.getItem('pour-products'))
    return Array.isArray(stored) ? stored : seedProducts
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

  const categories = useMemo(() => ['All', ...new Set(products.map((p) => p.category))], [products])
  const filtered = useMemo(() => products.filter((product) => {
    const term = search.toLowerCase().trim()
    const matchesSearch = !term || [product.name, product.category, product.description, ...product.variants.map((v) => v.sizeLabel)].join(' ').toLowerCase().includes(term)
    return matchesSearch && (category === 'All' || product.category === category)
  }), [products, search, category])

  const quickLookup = filtered[0]
  const quickPrice = quickLookup?.variants?.[0] ? money(priceTier === 'Retail' ? quickLookup.variants[0].retailPrice : quickLookup.variants[0].wholesalePrice) : '—'

  const saveProduct = (data) => {
    if (editingProduct) setProducts((items) => items.map((p) => p.id === editingProduct.id ? { ...p, ...data } : p))
    else setProducts((items) => [...items, { ...data, id: uid('p'), variants: [{ id: uid('v'), sizeLabel: '12 oz', retailPrice: 0, wholesalePrice: 0, packQuantity: 1 }] }])
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
          <small>{quickLookup ? `${quickLookup.category} · ${quickLookup.variants[0]?.sizeLabel || 'Price only'} · ${priceTier === 'Wholesale' ? 'carton/box' : 'single'}` : 'Try a product or size name'}</small>
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
        <div className="tier-switch"><button className={priceTier === 'Retail' ? 'selected' : ''} onClick={() => setPriceTier('Retail')}>Retail · single</button><button className={priceTier === 'Wholesale' ? 'selected' : ''} onClick={() => setPriceTier('Wholesale')}>Wholesale · carton</button></div>
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
  return <article className={`product-card accent-${product.accent}`} style={{ '--delay': `${index * 55}ms` }}>
    <div className="card-top"><div className="product-icon"><Icon size={22} /></div><span className="category-label">{product.category}</span>{admin && <div className="card-actions"><button onClick={onEdit} aria-label={`Edit ${product.name}`}><Edit3 size={15} /></button><button onClick={onDelete} aria-label={`Delete ${product.name}`}><Trash2 size={15} /></button></div>}</div>
    <h3>{product.name}</h3><p className="description">{product.description}</p>
    <div className="variants">{product.variants.map((variant) => <div className="variant-row" key={variant.id}><span className="size-badge">{variant.sizeLabel}<small>{priceTier === 'Retail' ? 'single bottle' : `carton/box · ${variant.packQuantity || 1} units`}</small></span><strong>{money(priceTier === 'Retail' ? variant.retailPrice : variant.wholesalePrice)}</strong>{admin && <div className="variant-actions"><button onClick={() => onEditVariant(variant)} aria-label="Edit variant"><Edit3 size={12} /></button><button onClick={() => onDeleteVariant(variant.id)} aria-label="Delete variant"><Trash2 size={12} /></button></div>}</div>)}</div>
    {admin && <button className="add-variant" onClick={onAddVariant}><Plus size={14} /> Add size variant</button>}
  </article>
}

function Modal({ type, product, variant, products, onClose, onSaveProduct, onSaveVariant }) {
  const [tab, setTab] = useState(type === 'variant' ? 'variant' : 'product')
  const [form, setForm] = useState(type === 'variant' ? { ...variant } : { name: product?.name || '', category: product?.category || 'Coffee', description: product?.description || '', accent: product?.accent || 'cyan' })
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }))
  const submit = (e) => { e.preventDefault(); tab === 'variant' ? onSaveVariant({ ...form, retailPrice: Number(form.retailPrice), wholesalePrice: Number(form.wholesalePrice), packQuantity: Number(form.packQuantity) }) : onSaveProduct(form) }
  return <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}><div className="modal" role="dialog" aria-modal="true">
    <div className="modal-header"><div><span className="eyebrow">CATALOG ADMIN</span><h2>{tab === 'variant' ? (variant?.id ? 'Edit size variant' : 'Add size variant') : (product ? 'Edit product' : 'Add product')}</h2></div><button className="close-button" onClick={onClose} aria-label="Close"><X size={20} /></button></div>
    <div className="modal-tabs"><button className={tab === 'category' ? 'active' : ''} onClick={() => setTab('category')}>Category</button><button className={tab === 'product' ? 'active' : ''} onClick={() => setTab('product')}>Product</button><button className={tab === 'variant' ? 'active' : ''} onClick={() => setTab('variant')}>Variant</button></div>
    {tab === 'category' ? <div className="category-manager"><p>Categories are created automatically from products. To add one, create a product and enter its category below.</p><button onClick={() => setTab('product')} className="primary-button">Create a product <ChevronDown size={16} /></button></div> : <form onSubmit={submit}><div className="form-grid">
      {tab === 'product' ? <><label>Product name<input required value={form.name} onChange={(e) => update('name', e.target.value)} placeholder="e.g. Cold Brew" /></label><label>Category<input required value={form.category} onChange={(e) => update('category', e.target.value)} placeholder="e.g. Coffee" /></label><label className="full">Description<input value={form.description} onChange={(e) => update('description', e.target.value)} placeholder="Short tasting notes" /></label><label>Card color<select value={form.accent} onChange={(e) => update('accent', e.target.value)}>{['cyan', 'green', 'amber', 'orange', 'purple', 'pink'].map((color) => <option key={color}>{color}</option>)}</select></label></> : <><label>Product<select required value={form.productId || ''} onChange={(e) => update('productId', e.target.value)}><option value="" disabled>Select product</option>{products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label>Size label<input required value={form.sizeLabel || ''} onChange={(e) => update('sizeLabel', e.target.value)} placeholder="e.g. 20 oz" /></label><label>Retail price · single bottle<input required type="number" min="0" step="0.01" value={form.retailPrice ?? ''} onChange={(e) => update('retailPrice', e.target.value)} /></label><label>Wholesale price · full carton/box<input required type="number" min="0" step="0.01" value={form.wholesalePrice ?? ''} onChange={(e) => update('wholesalePrice', e.target.value)} /></label><label>Units per carton/box<input required type="number" min="1" value={form.packQuantity ?? 1} onChange={(e) => update('packQuantity', e.target.value)} /></label></>}
    </div><button className="primary-button submit" type="submit">{product || variant?.id ? 'Save changes' : 'Add to catalog'} <Sparkles size={15} /></button></form>}
  </div></div>
}

createRoot(document.getElementById('root')).render(<App />)
