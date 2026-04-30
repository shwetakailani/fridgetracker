'use client'
import { useState, useEffect, useCallback } from 'react'
import {
  collection, addDoc, deleteDoc, doc, onSnapshot,
  query, orderBy, updateDoc
} from 'firebase/firestore'
import { db } from '../../lib/firebase'
import {
  FridgeItem, ShoppingItem, Category, CATEGORIES, CATEGORY_ICONS,
  STATUS_STYLES, daysUntil, getStatus, expiryLabel,
  lookupShelfLife, addDaysToToday, todayString
} from '../../lib/types'

type Tab = 'fridge' | 'add' | 'alerts' | 'recipes' | 'shopping'
type AddMethod = 'manual' | 'leftover'

// ─── NOTIFICATION HELPER ───────────────────────────────────────────────────
async function requestNotifications() {
  if (!('Notification' in window)) return false
  if (Notification.permission === 'granted') return true
  const result = await Notification.requestPermission()
  return result === 'granted'
}

function checkAndNotify(items: FridgeItem[]) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return
  const urgent = items.filter(i => {
    const d = daysUntil(i.expiryDate)
    return d >= 0 && d <= 2
  })
  if (urgent.length === 0) return
  const names = urgent.map(i => i.name).join(', ')
  new Notification('🥦 FridgeTracker', {
    body: urgent.length === 1
      ? `${names} expires ${daysUntil(urgent[0].expiryDate) === 0 ? 'today' : 'tomorrow'}!`
      : `${urgent.length} items expiring soon: ${names}`,
  })
}

// ─── RECIPE SUGGESTIONS (no AI - rule-based) ───────────────────────────────
function getSuggestedRecipes(items: FridgeItem[]) {
  const names = items.map(i => i.name.toLowerCase())
  const recipes = [
    {
      name: 'Stir Fry',
      needs: ['chicken', 'broccoli', 'bell pepper', 'carrot'],
      time: '20 min', difficulty: 'Easy',
      instructions: ['Chop all vegetables', 'Heat oil in a pan', 'Cook chicken until done', 'Add vegetables and stir fry for 5 min', 'Season with soy sauce and serve'],
    },
    {
      name: 'Omelette',
      needs: ['eggs', 'cheese', 'spinach', 'tomato'],
      time: '10 min', difficulty: 'Easy',
      instructions: ['Beat 2-3 eggs', 'Heat butter in pan', 'Pour in eggs', 'Add fillings on one side', 'Fold and serve'],
    },
    {
      name: 'Simple Salad',
      needs: ['lettuce', 'tomato', 'cucumber', 'bell pepper'],
      time: '5 min', difficulty: 'Easy',
      instructions: ['Wash and chop all vegetables', 'Combine in a bowl', 'Dress with olive oil and lemon', 'Season with salt and pepper'],
    },
    {
      name: 'Pasta with Veggies',
      needs: ['pasta', 'tomato', 'spinach', 'garlic'],
      time: '25 min', difficulty: 'Easy',
      instructions: ['Boil pasta according to package', 'Sauté garlic in olive oil', 'Add tomatoes and spinach', 'Toss with pasta and serve'],
    },
    {
      name: 'Smoothie',
      needs: ['banana', 'strawberries', 'blueberries', 'milk'],
      time: '5 min', difficulty: 'Easy',
      instructions: ['Add all ingredients to blender', 'Blend until smooth', 'Pour and enjoy'],
    },
    {
      name: 'Chicken Soup',
      needs: ['chicken', 'carrots', 'celery', 'broth'],
      time: '40 min', difficulty: 'Medium',
      instructions: ['Dice chicken and vegetables', 'Sauté vegetables for 5 min', 'Add chicken and broth', 'Simmer for 30 min', 'Season and serve'],
    },
  ]

  return recipes
    .map(r => {
      const matched = r.needs.filter(n => names.some(item => item.includes(n) || n.includes(item)))
      return { ...r, matched, score: matched.length }
    })
    .filter(r => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
}

// ─── MAIN COMPONENT ────────────────────────────────────────────────────────
export default function FridgePage() {
  const [tab, setTab] = useState<Tab>('fridge')
  const [items, setItems] = useState<FridgeItem[]>([])
  const [shopping, setShopping] = useState<ShoppingItem[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState('')
  const [filterCat, setFilterCat] = useState('All')
  const [sort, setSort] = useState<'expiry' | 'name' | 'added'>('expiry')
  const [search, setSearch] = useState('')
  const [expandedRecipe, setExpandedRecipe] = useState<string | null>(null)
  const [notifEnabled, setNotifEnabled] = useState(false)

  // Add form state
  const [method, setMethod] = useState<AddMethod>('manual')
  const [fname, setFname] = useState('')
  const [fcat, setFcat] = useState<Category>('Other')
  const [fexpiry, setFexpiry] = useState('')
  const [fpurch, setFpurch] = useState(todayString())
  const [fqty, setFqty] = useState(1)
  const [funit, setFunit] = useState('')
  const [fnotes, setFnotes] = useState('')
  const [flookup, setFlookup] = useState<{ text: string; found: boolean } | null>(null)
  const [saving, setSaving] = useState(false)
  const [addError, setAddError] = useState('')
  const [newShopItem, setNewShopItem] = useState('')

  // ── Firebase listeners ──
  useEffect(() => {
    const q = query(collection(db, 'fridgeItems'), orderBy('createdAt', 'desc'))
    const unsub = onSnapshot(q, snap => {
      setItems(snap.docs.map(d => ({ id: d.id, ...d.data() } as FridgeItem)))
      setLoading(false)
    })
    return () => unsub()
  }, [])

  useEffect(() => {
    const q = query(collection(db, 'shoppingItems'), orderBy('createdAt', 'desc'))
    const unsub = onSnapshot(q, snap => {
      setShopping(snap.docs.map(d => ({ id: d.id, ...d.data() } as ShoppingItem)))
    })
    return () => unsub()
  }, [])

  // ── Notification check on load ──
  useEffect(() => {
    setNotifEnabled(Notification.permission === 'granted')
    if (items.length > 0 && Notification.permission === 'granted') {
      checkAndNotify(items)
    }
  }, [items])

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 2500)
  }

  // ── Name change + shelf life lookup ──
  function handleNameChange(val: string) {
    setFname(val)
    if (val.length < 3) { setFlookup(null); return }
    if (method === 'leftover' || method === 'manual') {
      const result = lookupShelfLife(val)
      if (result) {
        setFexpiry(addDaysToToday(result.days))
        setFcat(result.category)
        setFlookup({ text: `Found: ~${result.days} day shelf life`, found: true })
      } else {
        setFlookup(null)
      }
    }
  }

  // ── Add item ──
  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!fname.trim()) { setAddError('Please enter a name'); return }
    if (!fexpiry) { setAddError('Please enter an expiry date'); return }
    setSaving(true); setAddError('')
    try {
      await addDoc(collection(db, 'fridgeItems'), {
        name: fname.trim(),
        category: fcat,
        expiryDate: fexpiry,
        purchasedDate: fpurch,
        quantity: fqty,
        unit: funit || null,
        notes: fnotes || null,
        createdAt: Date.now(),
      })
      showToast(`✓ ${fname.trim()} added!`)
      setFname(''); setFcat('Other'); setFexpiry(''); setFpurch(todayString())
      setFqty(1); setFunit(''); setFnotes(''); setFlookup(null); setMethod('manual')
      setTab('fridge')
    } catch (e: any) {
      setAddError('Failed to save: ' + e.message)
    }
    setSaving(false)
  }

  // ── Remove item ──
  async function removeItem(id: string, action: 'consumed' | 'discard') {
    const item = items.find(i => i.id === id)
    await deleteDoc(doc(db, 'fridgeItems', id))
    if (item) {
      // Auto-add to shopping list
      const alreadyThere = shopping.some(s => s.name.toLowerCase() === item.name.toLowerCase() && !s.checked)
      if (!alreadyThere) {
        await addDoc(collection(db, 'shoppingItems'), {
          name: item.name,
          category: item.category,
          checked: false,
          reason: action === 'consumed' ? 'Used up' : 'Expired',
          createdAt: Date.now(),
        })
      }
    }
    showToast(action === 'consumed' ? '✓ Marked as used' : '🗑 Removed')
  }

  // ── Shopping list ──
  async function addShopItem(e: React.FormEvent) {
    e.preventDefault()
    if (!newShopItem.trim()) return
    await addDoc(collection(db, 'shoppingItems'), {
      name: newShopItem.trim(),
      checked: false,
      reason: 'Manual',
      createdAt: Date.now(),
    })
    setNewShopItem('')
  }

  async function toggleShopItem(id: string, checked: boolean) {
    await updateDoc(doc(db, 'shoppingItems', id), { checked: !checked })
  }

  async function deleteShopItem(id: string) {
    await deleteDoc(doc(db, 'shoppingItems', id))
  }

  async function clearChecked() {
    const checked = shopping.filter(s => s.checked)
    await Promise.all(checked.map(s => deleteDoc(doc(db, 'shoppingItems', s.id))))
  }

  // ── Enable notifications ──
  async function enableNotifications() {
    const granted = await requestNotifications()
    setNotifEnabled(granted)
    if (granted) { showToast('✓ Notifications enabled!'); checkAndNotify(items) }
    else showToast('Notifications blocked — check browser settings')
  }

  // ── Filtered & sorted items ──
  let displayed = [...items]
  if (filterCat !== 'All') displayed = displayed.filter(i => i.category === filterCat)
  if (search) displayed = displayed.filter(i => i.name.toLowerCase().includes(search.toLowerCase()))
  if (sort === 'expiry') displayed.sort((a, b) => a.expiryDate.localeCompare(b.expiryDate))
  else if (sort === 'name') displayed.sort((a, b) => a.name.localeCompare(b.name))

  const urgentCount = items.filter(i => ['expired', 'critical'].includes(getStatus(i.expiryDate))).length
  const warnCount = items.filter(i => getStatus(i.expiryDate) === 'warning').length
  const cats = ['All', ...Array.from(new Set(items.map(i => i.category || 'Other')))]
  const recipes = getSuggestedRecipes(items)
  const pendingShopping = shopping.filter(s => !s.checked)
  const checkedShopping = shopping.filter(s => s.checked)

  // ── Render ──
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 pt-5 pb-3 max-w-lg mx-auto w-full">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">🥦 FridgeTracker</h1>
            <p className="text-xs text-gray-400 mt-0.5">{items.length} items · {urgentCount > 0 ? `${urgentCount} urgent` : 'all fresh'}</p>
          </div>
          {!notifEnabled && (
            <button onClick={enableNotifications}
              className="text-xs bg-brand-50 text-brand-700 px-3 py-1.5 rounded-full font-medium">
              🔔 Enable alerts
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <main className="flex-1 pb-20 max-w-lg mx-auto w-full px-4 pt-4">

        {/* ── FRIDGE TAB ── */}
        {tab === 'fridge' && (
          <div>
            {items.length > 0 && (
              <div className="flex gap-2 mb-3 flex-wrap">
                {urgentCount > 0 && <span className="text-xs font-medium px-3 py-1.5 rounded-full bg-red-50 text-red-700">🔴 {urgentCount} urgent</span>}
                {warnCount > 0 && <span className="text-xs font-medium px-3 py-1.5 rounded-full bg-amber-50 text-amber-700">🟡 {warnCount} soon</span>}
                {items.length - urgentCount - warnCount > 0 && <span className="text-xs font-medium px-3 py-1.5 rounded-full bg-green-50 text-green-700">🟢 {items.length - urgentCount - warnCount} fresh</span>}
              </div>
            )}

            <div className="relative mb-3">
              <span className="absolute left-3 top-2.5 text-gray-400 text-sm">🔍</span>
              <input className="input pl-8" placeholder="Search items…" value={search} onChange={e => setSearch(e.target.value)} />
            </div>

            <div className="flex items-center justify-between mb-3">
              <div className="flex gap-1.5 flex-wrap">
                {cats.map(c => (
                  <button key={c} onClick={() => setFilterCat(c)}
                    className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${filterCat === c ? 'bg-brand-500 text-white' : 'bg-white text-gray-600 border border-gray-200'}`}>
                    {c !== 'All' ? CATEGORY_ICONS[c] + ' ' : ''}{c}
                  </button>
                ))}
              </div>
              <select value={sort} onChange={e => setSort(e.target.value as any)}
                className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-600 ml-2 flex-shrink-0">
                <option value="expiry">Expiring first</option>
                <option value="name">A–Z</option>
                <option value="added">Recently added</option>
              </select>
            </div>

            {loading ? (
              <div className="text-center py-16 text-gray-400 text-sm">Loading…</div>
            ) : displayed.length === 0 ? (
              <div className="text-center py-16">
                <div className="text-4xl mb-3">🥗</div>
                <p className="font-medium text-gray-700">{items.length === 0 ? 'Your fridge is empty' : 'No items match'}</p>
                <p className="text-sm text-gray-400 mt-1">{items.length === 0 ? 'Tap + Add Item to get started' : 'Try a different filter'}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {displayed.map(item => {
                  const status = getStatus(item.expiryDate)
                  const styles = STATUS_STYLES[status]
                  return (
                    <div key={item.id} className={`card p-3.5 flex items-center gap-3 border-l-4 ${styles.border}`}>
                      <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${styles.dot}`} />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 text-sm capitalize truncate">{item.name}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {CATEGORY_ICONS[item.category] || '📦'} {item.category}
                          {item.quantity > 1 ? ` · ${item.quantity}${item.unit ? ' ' + item.unit : ''}` : ''}
                          {item.notes ? ` · ${item.notes}` : ''}
                        </p>
                        <p className="text-xs text-gray-400">Exp: {item.expiryDate}</p>
                      </div>
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full flex-shrink-0 ${styles.badge}`}>
                        {expiryLabel(item.expiryDate)}
                      </span>
                      <div className="flex gap-1 flex-shrink-0">
                        <button onClick={() => removeItem(item.id, 'consumed')} title="Mark as used"
                          className="text-xs w-7 h-7 rounded-lg bg-green-50 text-green-700 hover:bg-green-100 flex items-center justify-center">✓</button>
                        <button onClick={() => removeItem(item.id, 'discard')} title="Discard"
                          className="text-xs w-7 h-7 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 flex items-center justify-center">✕</button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ── ADD ITEM TAB ── */}
        {tab === 'add' && (
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Add Item</h2>
            <p className="text-xs text-gray-400 mb-4">Purchase date is set to today automatically</p>

            <div className="grid grid-cols-2 gap-2 mb-5">
              {([['manual', '✏️', 'Manual entry', 'Type details'], ['leftover', '🍱', 'Leftover / takeout', 'Auto date lookup']] as const).map(([id, icon, label, sub]) => (
                <button key={id} onClick={() => setMethod(id)}
                  className={`rounded-xl p-3.5 text-left border-2 transition-all ${method === id ? 'border-brand-500 bg-brand-50' : 'border-gray-100 bg-white'}`}>
                  <div className="text-2xl mb-1">{icon}</div>
                  <div className="text-sm font-medium text-gray-800">{label}</div>
                  <div className="text-xs text-gray-400">{sub}</div>
                </button>
              ))}
            </div>

            <form onSubmit={handleAdd} className="space-y-4">
              <div>
                <label className="label">Item name</label>
                <input className="input" value={fname} onChange={e => handleNameChange(e.target.value)}
                  placeholder={method === 'leftover' ? 'e.g. Chick-fil-A, leftover pasta…' : 'e.g. Milk, Strawberries…'} />
                {flookup && (
                  <p className="text-xs mt-1.5 px-3 py-2 rounded-lg bg-green-50 text-green-700">
                    ✓ {flookup.text} — expiry auto-filled
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Category</label>
                  <select className="input" value={fcat} onChange={e => setFcat(e.target.value as Category)}>
                    {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Expiry date</label>
                  <input className="input" type="date" value={fexpiry} onChange={e => setFexpiry(e.target.value)} required />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Purchase date</label>
                  <input className="input" type="date" value={fpurch} onChange={e => setFpurch(e.target.value)} />
                </div>
                <div>
                  <label className="label">Quantity</label>
                  <div className="flex gap-1.5">
                    <input className="input w-16 flex-shrink-0" type="number" min={1} value={fqty}
                      onChange={e => setFqty(parseInt(e.target.value) || 1)} />
                    <input className="input" value={funit} onChange={e => setFunit(e.target.value)} placeholder="unit" />
                  </div>
                </div>
              </div>

              <div>
                <label className="label">Notes (optional)</label>
                <input className="input" value={fnotes} onChange={e => setFnotes(e.target.value)}
                  placeholder="Brand, restaurant name, etc." />
              </div>

              {addError && <p className="text-red-600 text-sm bg-red-50 rounded-lg px-3 py-2">{addError}</p>}
              <button type="submit" disabled={saving} className="btn-primary">
                {saving ? 'Adding…' : '+ Add to Fridge'}
              </button>
            </form>
          </div>
        )}

        {/* ── ALERTS TAB ── */}
        {tab === 'alerts' && (
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Alerts</h2>
            <p className="text-xs text-gray-400 mb-4">Items expiring in the next 5 days</p>

            {!notifEnabled && (
              <div className="card p-4 mb-4 bg-brand-50 border-brand-100">
                <p className="text-sm font-medium text-brand-700 mb-1">🔔 Get notified automatically</p>
                <p className="text-xs text-brand-600 mb-3">Enable browser notifications to get an alert when you open the app and items are expiring.</p>
                <button onClick={enableNotifications} className="btn-primary py-2 text-sm">Enable notifications</button>
              </div>
            )}

            {(() => {
              const urgent = items.filter(i => ['expired', 'critical'].includes(getStatus(i.expiryDate)))
                .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate))
              const soon = items.filter(i => getStatus(i.expiryDate) === 'warning')
                .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate))

              if (urgent.length === 0 && soon.length === 0) return (
                <div className="text-center py-16">
                  <div className="text-4xl mb-3">✅</div>
                  <p className="font-medium text-gray-700">All clear!</p>
                  <p className="text-sm text-gray-400 mt-1">Nothing expiring in the next 5 days.</p>
                </div>
              )

              return (
                <>
                  {urgent.length > 0 && (
                    <section className="mb-5">
                      <p className="text-xs font-semibold text-red-600 uppercase tracking-widest mb-2">⚠️ Use immediately</p>
                      <div className="space-y-2">
                        {urgent.map(item => (
                          <div key={item.id} className="card p-3.5 border-l-4 border-l-red-400 flex items-center gap-3">
                            <span className="text-lg">{CATEGORY_ICONS[item.category] || '📦'}</span>
                            <div className="flex-1">
                              <p className="font-medium text-gray-900 text-sm capitalize">{item.name}</p>
                              <p className="text-xs text-red-600 font-medium mt-0.5">{expiryLabel(item.expiryDate)}</p>
                            </div>
                            <button onClick={() => removeItem(item.id, 'consumed')}
                              className="text-xs px-3 py-1.5 bg-green-50 text-green-700 rounded-lg font-medium">Used ✓</button>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}
                  {soon.length > 0 && (
                    <section>
                      <p className="text-xs font-semibold text-amber-600 uppercase tracking-widest mb-2">⏰ Use soon</p>
                      <div className="space-y-2">
                        {soon.map(item => (
                          <div key={item.id} className="card p-3.5 border-l-4 border-l-amber-300 flex items-center gap-3">
                            <span className="text-lg">{CATEGORY_ICONS[item.category] || '📦'}</span>
                            <div className="flex-1">
                              <p className="font-medium text-gray-900 text-sm capitalize">{item.name}</p>
                              <p className="text-xs text-amber-600 font-medium mt-0.5">{expiryLabel(item.expiryDate)}</p>
                            </div>
                            <button onClick={() => removeItem(item.id, 'consumed')}
                              className="text-xs px-3 py-1.5 bg-green-50 text-green-700 rounded-lg font-medium">Used ✓</button>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}
                </>
              )
            })()}
          </div>
        )}

        {/* ── RECIPES TAB ── */}
        {tab === 'recipes' && (
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Recipe Ideas</h2>
            <p className="text-xs text-gray-400 mb-4">Based on what's in your fridge right now</p>

            {items.length === 0 ? (
              <div className="text-center py-16">
                <div className="text-4xl mb-3">👨‍🍳</div>
                <p className="font-medium text-gray-700">No items in fridge yet</p>
                <p className="text-sm text-gray-400 mt-1">Add items to see recipe suggestions</p>
              </div>
            ) : recipes.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-4xl mb-3">🤔</div>
                <p className="font-medium text-gray-700">No matching recipes found</p>
                <p className="text-sm text-gray-400 mt-1">Try adding more common ingredients</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recipes.map(r => (
                  <div key={r.name} className="card overflow-hidden">
                    <button onClick={() => setExpandedRecipe(expandedRecipe === r.name ? null : r.name)}
                      className="w-full p-4 text-left hover:bg-gray-50 transition-colors">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <p className="font-semibold text-gray-900">{r.name}</p>
                          <div className="flex gap-2 mt-1.5 flex-wrap">
                            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">⏱ {r.time}</span>
                            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">📊 {r.difficulty}</span>
                            <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full">
                              ✓ {r.matched.length} ingredient{r.matched.length !== 1 ? 's' : ''} in fridge
                            </span>
                          </div>
                          <p className="text-xs text-gray-400 mt-1">Uses: {r.matched.join(', ')}</p>
                        </div>
                        <span className="text-gray-300 mt-1">{expandedRecipe === r.name ? '▲' : '▼'}</span>
                      </div>
                    </button>
                    {expandedRecipe === r.name && (
                      <div className="border-t border-gray-100 p-4">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Instructions</p>
                        <ol className="space-y-2">
                          {r.instructions.map((step, i) => (
                            <li key={i} className="flex gap-2 text-sm text-gray-700">
                              <span className="text-xs font-bold text-brand-500 mt-0.5 flex-shrink-0 w-4">{i + 1}.</span>
                              <span>{step}</span>
                            </li>
                          ))}
                        </ol>
                      </div>
                    )}
                  </div>
                ))}
                <p className="text-xs text-center text-gray-400 pt-2">
                  💡 AI-powered recipe suggestions coming in a future update
                </p>
              </div>
            )}
          </div>
        )}

        {/* ── SHOPPING TAB ── */}
        {tab === 'shopping' && (
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Shopping List</h2>
            <p className="text-xs text-gray-400 mb-4">
              {pendingShopping.length} item{pendingShopping.length !== 1 ? 's' : ''} to get · Items are added automatically when food expires or gets used
            </p>

            <form onSubmit={addShopItem} className="flex gap-2 mb-4">
              <input className="input flex-1" value={newShopItem}
                onChange={e => setNewShopItem(e.target.value)} placeholder="Add item manually…" />
              <button type="submit"
                className="bg-brand-500 hover:bg-brand-700 text-white text-sm font-medium px-4 rounded-xl transition-colors">
                Add
              </button>
            </form>

            {shopping.length === 0 ? (
              <div className="text-center py-16">
                <div className="text-4xl mb-3">🛒</div>
                <p className="font-medium text-gray-700">Shopping list is empty</p>
                <p className="text-sm text-gray-400 mt-1">Items appear here automatically when food gets used up or expires</p>
              </div>
            ) : (
              <>
                {pendingShopping.length > 0 && (
                  <section className="mb-4">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-2">To get ({pendingShopping.length})</p>
                    <div className="space-y-2">
                      {pendingShopping.map(item => (
                        <div key={item.id} className="card p-3.5 flex items-center gap-3">
                          <button onClick={() => toggleShopItem(item.id, item.checked)}
                            className="w-5 h-5 rounded-full border-2 border-gray-300 flex-shrink-0 hover:border-brand-500 transition-colors" />
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900 capitalize">{item.name}</p>
                            {item.reason && <p className="text-xs text-gray-400">{item.reason}</p>}
                          </div>
                          <button onClick={() => deleteShopItem(item.id)}
                            className="text-gray-300 hover:text-red-400 transition-colors text-sm w-6 h-6 flex items-center justify-center">✕</button>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {checkedShopping.length > 0 && (
                  <section>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Got it ({checkedShopping.length})</p>
                      <button onClick={clearChecked} className="text-xs text-red-400 hover:text-red-600 transition-colors">Clear all</button>
                    </div>
                    <div className="space-y-2">
                      {checkedShopping.map(item => (
                        <div key={item.id} className="card p-3.5 flex items-center gap-3 opacity-50">
                          <button onClick={() => toggleShopItem(item.id, item.checked)}
                            className="w-5 h-5 rounded-full bg-brand-500 flex-shrink-0 flex items-center justify-center text-white text-xs flex-shrink-0">✓</button>
                          <p className="text-sm text-gray-500 line-through capitalize flex-1">{item.name}</p>
                          <button onClick={() => deleteShopItem(item.id)}
                            className="text-gray-300 hover:text-red-400 transition-colors text-sm">✕</button>
                        </div>
                      ))}
                    </div>
                  </section>
                )}
              </>
            )}
          </div>
        )}
      </main>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 z-50">
        <div className="max-w-lg mx-auto flex">
          {([
            ['fridge',   '🗄',  'Fridge'],
            ['add',      '➕',  'Add Item'],
            ['alerts',   '🔔',  'Alerts'],
            ['recipes',  '👨‍🍳', 'Recipes'],
            ['shopping', '🛒',  'Shopping'],
          ] as [Tab, string, string][]).map(([id, icon, label]) => (
            <button key={id} onClick={() => setTab(id)}
              className={`flex-1 flex flex-col items-center py-2.5 gap-0.5 text-xs transition-colors relative ${tab === id ? 'text-brand-700 font-medium' : 'text-gray-400'}`}>
              {id === 'alerts' && urgentCount > 0 && (
                <span className="absolute top-1.5 right-1/4 w-2 h-2 bg-red-500 rounded-full" />
              )}
              <span className="text-base leading-none">{icon}</span>
              <span className="leading-none">{label}</span>
            </button>
          ))}
        </div>
      </nav>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-sm px-4 py-2.5 rounded-full shadow-lg z-50 whitespace-nowrap">
          {toast}
        </div>
      )}
    </div>
  )
}
