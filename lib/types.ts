export type Category = 'Produce' | 'Dairy' | 'Meat' | 'Leftovers' | 'Drinks' | 'Other'

export interface FridgeItem {
  id: string
  name: string
  category: Category
  purchasedDate: string  // YYYY-MM-DD
  expiryDate: string     // YYYY-MM-DD
  quantity: number
  unit?: string
  notes?: string
  createdAt: number      // timestamp
}

export interface ShoppingItem {
  id: string
  name: string
  category?: string
  checked: boolean
  reason?: string
  createdAt: number
}

export type ExpiryStatus = 'expired' | 'critical' | 'warning' | 'fresh'

export function daysUntil(dateStr: string): number {
  const exp = new Date(dateStr)
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  exp.setHours(0, 0, 0, 0)
  return Math.round((exp.getTime() - now.getTime()) / 86400000)
}

export function getStatus(expiryDate: string): ExpiryStatus {
  const d = daysUntil(expiryDate)
  if (d < 0)  return 'expired'
  if (d <= 2) return 'critical'
  if (d <= 5) return 'warning'
  return 'fresh'
}

export function expiryLabel(expiryDate: string): string {
  const d = daysUntil(expiryDate)
  if (d < 0)  return `Expired ${Math.abs(d)}d ago`
  if (d === 0) return 'Expires today'
  if (d === 1) return 'Tomorrow'
  return `${d} days left`
}

export const STATUS_STYLES: Record<ExpiryStatus, { badge: string; dot: string; border: string }> = {
  expired:  { badge: 'bg-red-50 text-red-700',    dot: 'bg-red-500',    border: 'border-l-red-400' },
  critical: { badge: 'bg-red-50 text-red-700',    dot: 'bg-red-500',    border: 'border-l-red-400' },
  warning:  { badge: 'bg-amber-50 text-amber-700', dot: 'bg-amber-400',  border: 'border-l-amber-300' },
  fresh:    { badge: 'bg-green-50 text-green-700', dot: 'bg-green-500',  border: 'border-l-green-300' },
}

export const CATEGORY_ICONS: Record<string, string> = {
  Produce: '🥦', Dairy: '🥛', Meat: '🥩',
  Leftovers: '🍱', Drinks: '🥤', Other: '📦',
}

export const CATEGORIES: Category[] = ['Produce', 'Dairy', 'Meat', 'Leftovers', 'Drinks', 'Other']

// Built-in shelf life database (days from purchase)
export const SHELF_LIFE: Record<string, { days: number; category: Category }> = {
  'leftover chicken':    { days: 4,  category: 'Leftovers' },
  'leftover pasta':      { days: 3,  category: 'Leftovers' },
  'leftover rice':       { days: 4,  category: 'Leftovers' },
  'leftover pizza':      { days: 4,  category: 'Leftovers' },
  'leftover soup':       { days: 4,  category: 'Leftovers' },
  'leftover beef':       { days: 3,  category: 'Leftovers' },
  'leftover fish':       { days: 2,  category: 'Leftovers' },
  'chick fil a':         { days: 2,  category: 'Leftovers' },
  'chick-fil-a':         { days: 2,  category: 'Leftovers' },
  'mcdonald\'s':         { days: 2,  category: 'Leftovers' },
  'subway':              { days: 2,  category: 'Leftovers' },
  'chipotle':            { days: 3,  category: 'Leftovers' },
  'chinese takeout':     { days: 3,  category: 'Leftovers' },
  'pizza':               { days: 4,  category: 'Leftovers' },
  'restaurant leftovers':{ days: 3,  category: 'Leftovers' },
  'milk':                { days: 7,  category: 'Dairy' },
  'eggs':                { days: 21, category: 'Dairy' },
  'butter':              { days: 30, category: 'Dairy' },
  'cheese':              { days: 14, category: 'Dairy' },
  'yogurt':              { days: 14, category: 'Dairy' },
  'sour cream':          { days: 14, category: 'Dairy' },
  'cream cheese':        { days: 10, category: 'Dairy' },
  'heavy cream':         { days: 7,  category: 'Dairy' },
  'chicken':             { days: 2,  category: 'Meat' },
  'chicken breast':      { days: 2,  category: 'Meat' },
  'ground beef':         { days: 2,  category: 'Meat' },
  'beef':                { days: 2,  category: 'Meat' },
  'pork':                { days: 2,  category: 'Meat' },
  'salmon':              { days: 2,  category: 'Meat' },
  'fish':                { days: 2,  category: 'Meat' },
  'shrimp':              { days: 2,  category: 'Meat' },
  'bacon':               { days: 7,  category: 'Meat' },
  'deli turkey':         { days: 5,  category: 'Meat' },
  'deli ham':            { days: 5,  category: 'Meat' },
  'strawberries':        { days: 5,  category: 'Produce' },
  'blueberries':         { days: 7,  category: 'Produce' },
  'raspberries':         { days: 3,  category: 'Produce' },
  'spinach':             { days: 5,  category: 'Produce' },
  'lettuce':             { days: 7,  category: 'Produce' },
  'kale':                { days: 7,  category: 'Produce' },
  'cucumber':            { days: 7,  category: 'Produce' },
  'tomato':              { days: 7,  category: 'Produce' },
  'bell pepper':         { days: 10, category: 'Produce' },
  'broccoli':            { days: 5,  category: 'Produce' },
  'cauliflower':         { days: 7,  category: 'Produce' },
  'carrots':             { days: 21, category: 'Produce' },
  'celery':              { days: 14, category: 'Produce' },
  'apple':               { days: 30, category: 'Produce' },
  'orange':              { days: 21, category: 'Produce' },
  'banana':              { days: 5,  category: 'Produce' },
  'grapes':              { days: 7,  category: 'Produce' },
  'avocado':             { days: 4,  category: 'Produce' },
  'lemon':               { days: 21, category: 'Produce' },
  'orange juice':        { days: 7,  category: 'Drinks' },
  'apple juice':         { days: 10, category: 'Drinks' },
  'almond milk':         { days: 7,  category: 'Drinks' },
  'hummus':              { days: 7,  category: 'Other' },
  'salsa':               { days: 14, category: 'Other' },
  'guacamole':           { days: 3,  category: 'Other' },
}

export function lookupShelfLife(name: string): { days: number; category: Category } | null {
  const lower = name.toLowerCase().trim()
  if (SHELF_LIFE[lower]) return SHELF_LIFE[lower]
  // Partial match
  for (const key of Object.keys(SHELF_LIFE)) {
    if (lower.includes(key) || key.includes(lower)) return SHELF_LIFE[key]
  }
  return null
}

export function addDaysToToday(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

export function todayString(): string {
  return new Date().toISOString().split('T')[0]
}
