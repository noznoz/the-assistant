// Lulu domain constants — the vocabulary of the app. Labels resolve via i18n keys.

export const TASK_TYPES = [
  { id: 'task', key: 'tt_task' },
  { id: 'request', key: 'tt_request' },
  { id: 'approval', key: 'tt_approval' },
  { id: 'follow_up', key: 'tt_follow_up' },
  { id: 'meeting_action', key: 'tt_meeting_action' },
  { id: 'errand', key: 'tt_errand' },
  { id: 'reminder', key: 'tt_reminder' },
  { id: 'idea', key: 'tt_idea' },
]

export const STATUSES = [
  { id: 'inbox', key: 'st_inbox', tint: 't-info' },
  { id: 'new', key: 'st_new', tint: 't-info' },
  { id: 'planned', key: 'st_planned', tint: 't-info' },
  { id: 'in_progress', key: 'st_in_progress', tint: 't-brand' },
  { id: 'waiting_someone', key: 'st_waiting_someone', tint: 't-warn' },
  { id: 'waiting_me', key: 'st_waiting_me', tint: 't-warn' },
  { id: 'on_hold', key: 'st_on_hold', tint: 't-warn' },
  { id: 'completed', key: 'st_completed', tint: 't-ok' },
  { id: 'cancelled', key: 'st_cancelled', tint: 't-danger' },
  { id: 'overdue', key: 'st_overdue', tint: 't-danger' },
]

export const PRIORITIES = [
  { id: 'critical', key: 'pr_critical', tint: 't-danger', color: 'var(--danger)' },
  { id: 'high', key: 'pr_high', tint: 't-warn', color: 'var(--warn)' },
  { id: 'medium', key: 'pr_medium', tint: 't-info', color: 'var(--info)' },
  { id: 'low', key: 'pr_low', tint: 't-brand', color: 'var(--ink-3)' },
]

export const VEHICLE_TYPES = [
  { id: 'car', key: 'vt_car', icon: 'car' },
  { id: 'motorcycle', key: 'vt_motorcycle', icon: 'moto' },
  { id: 'boat', key: 'vt_boat', icon: 'boat' },
  { id: 'other', key: 'vt_other', icon: 'car' },
]

// Expense categories — id + English/Arabic label + tint hue for charts.
export const EXPENSE_CATEGORIES = [
  { id: 'household', en: 'Household', ar: 'المنزل' },
  { id: 'dining', en: 'Dining', ar: 'مطاعم' },
  { id: 'groceries', en: 'Groceries', ar: 'بقالة' },
  { id: 'shopping', en: 'Shopping', ar: 'تسوّق' },
  { id: 'travel', en: 'Travel', ar: 'سفر' },
  { id: 'hotels', en: 'Hotels', ar: 'فنادق' },
  { id: 'flights', en: 'Flights', ar: 'طيران' },
  { id: 'transport', en: 'Transportation', ar: 'مواصلات' },
  { id: 'fuel', en: 'Fuel', ar: 'وقود' },
  { id: 'vehicle_maint', en: 'Vehicle maintenance', ar: 'صيانة مركبات' },
  { id: 'moto_acc', en: 'Motorcycle accessories', ar: 'ملحقات دراجات' },
  { id: 'boat', en: 'Boat expenses', ar: 'مصاريف قوارب' },
  { id: 'marina', en: 'Marina fees', ar: 'رسوم مرسى' },
  { id: 'insurance', en: 'Insurance', ar: 'تأمين' },
  { id: 'work', en: 'Work expenses', ar: 'مصاريف عمل' },
  { id: 'family', en: 'Family', ar: 'عائلة' },
  { id: 'education', en: 'Education', ar: 'تعليم' },
  { id: 'entertainment', en: 'Entertainment', ar: 'ترفيه' },
  { id: 'health', en: 'Health', ar: 'صحة' },
  { id: 'subscriptions', en: 'Subscriptions', ar: 'اشتراكات' },
  { id: 'utilities', en: 'Utilities', ar: 'فواتير' },
  { id: 'gifts', en: 'Gifts', ar: 'هدايا' },
  { id: 'charity', en: 'Charity', ar: 'صدقة' },
  { id: 'other', en: 'Other', ar: 'أخرى' },
]

export const PAYMENT_METHODS = [
  { id: 'cash', en: 'Cash', ar: 'نقد' },
  { id: 'debit', en: 'Debit card', ar: 'بطاقة مدى' },
  { id: 'credit', en: 'Credit card', ar: 'بطاقة ائتمان' },
  { id: 'transfer', en: 'Bank transfer', ar: 'تحويل بنكي' },
  { id: 'apple_pay', en: 'Apple Pay', ar: 'Apple Pay' },
  { id: 'wallet', en: 'Digital wallet', ar: 'محفظة رقمية' },
  { id: 'company', en: 'Company card', ar: 'بطاقة الشركة' },
  { id: 'other', en: 'Other', ar: 'أخرى' },
]

export const RELATIONSHIPS = [
  { id: 'colleague', en: 'Work colleague', ar: 'زميل عمل' },
  { id: 'report', en: 'Direct report', ar: 'مرؤوس' },
  { id: 'manager', en: 'Manager', ar: 'مدير' },
  { id: 'customer', en: 'Customer', ar: 'عميل' },
  { id: 'supplier', en: 'Supplier', ar: 'مورّد' },
  { id: 'friend', en: 'Friend', ar: 'صديق' },
  { id: 'family', en: 'Family', ar: 'عائلة' },
  { id: 'service', en: 'Service provider', ar: 'مزود خدمة' },
  { id: 'other', en: 'Other', ar: 'أخرى' },
]

export const DOC_CATEGORIES = [
  { id: 'id', en: 'Personal ID', ar: 'هوية شخصية' },
  { id: 'work', en: 'Work documents', ar: 'مستندات عمل' },
  { id: 'vehicle_reg', en: 'Vehicle registration', ar: 'استمارة مركبة' },
  { id: 'insurance', en: 'Insurance', ar: 'تأمين' },
  { id: 'invoice', en: 'Invoices', ar: 'فواتير' },
  { id: 'warranty', en: 'Warranties', ar: 'ضمانات' },
  { id: 'travel', en: 'Travel', ar: 'سفر' },
  { id: 'financial', en: 'Financial', ar: 'مالية' },
  { id: 'contract', en: 'Contracts', ar: 'عقود' },
  { id: 'other', en: 'Other', ar: 'أخرى' },
]

export const CURRENCIES = ['SAR', 'USD', 'EUR', 'GBP', 'AED', 'KWD', 'BHD', 'QAR', 'OMR']

// Helpers to look up a label object by id.
const byId = (list) => (id) => list.find(x => x.id === id)
export const findCategory = byId(EXPENSE_CATEGORIES)
export const findPayment = byId(PAYMENT_METHODS)
export const findStatus = byId(STATUSES)
export const findPriority = byId(PRIORITIES)
export const findType = byId(TASK_TYPES)
export const findVehicleType = byId(VEHICLE_TYPES)
export const findRelationship = byId(RELATIONSHIPS)
export const findDocCategory = byId(DOC_CATEGORIES)

export function label(item, lang) {
  if (!item) return ''
  return lang === 'ar' ? item.ar : item.en
}
