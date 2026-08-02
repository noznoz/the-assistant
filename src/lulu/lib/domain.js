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

// Ownership status of a vehicle.
export const OWNERSHIP_STATUSES = [
  { id: 'owned', en: 'Owned', ar: 'مملوكة', tint: 't-ok' },
  { id: 'finance', en: 'On finance', ar: 'تمويل', tint: 't-warn' },
  { id: 'lease', en: 'Leased', ar: 'مستأجرة', tint: 't-info' },
  { id: 'company', en: 'Company', ar: 'شركة', tint: 't-brand' },
  { id: 'sold', en: 'Sold', ar: 'مباعة', tint: 't-danger' },
  { id: 'other', en: 'Other', ar: 'أخرى', tint: '' },
]
export const findOwnership = (id) => OWNERSHIP_STATUSES.find(x => x.id === id)

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
  { id: 'amex', en: 'Amex', ar: 'أمريكان إكسبريس' },
  { id: 'apple_pay', en: 'Apple Pay', ar: 'Apple Pay' },
  { id: 'wallet', en: 'Digital wallet', ar: 'محفظة رقمية' },
  { id: 'company', en: 'Company card', ar: 'بطاقة الشركة' },
  { id: 'installment', en: 'Installment', ar: 'تقسيط' },
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
  { id: 'medical', en: 'Medical', ar: 'طبية' },
  { id: 'property', en: 'Property', ar: 'عقارات' },
  { id: 'education', en: 'Education', ar: 'تعليم' },
  { id: 'personal', en: 'Personal', ar: 'شخصية' },
  { id: 'other', en: 'Other', ar: 'أخرى' },
]

// Category options for documents: built-ins plus the user's own custom
// categories (stored as `custom:<Label>`), with "Other" kept last.
export function docCategoryOptions(lang = 'en', custom = []) {
  const main = DOC_CATEGORIES.filter(c => c.id !== 'other').map(c => ({ value: c.id, label: label(c, lang) }))
  const customs = (custom || []).map(name => ({ value: 'custom:' + name, label: name }))
  const other = DOC_CATEGORIES.filter(c => c.id === 'other').map(c => ({ value: c.id, label: label(c, lang) }))
  return [...main, ...customs, ...other]
}

export function docCatLabel(id, lang = 'en') {
  if (!id) return ''
  if (typeof id === 'string' && id.startsWith('custom:')) return id.slice(7)
  const c = DOC_CATEGORIES.find(x => x.id === id)
  return c ? label(c, lang) : id
}

export const CURRENCIES = ['SAR', 'USD', 'EUR', 'GBP', 'AED', 'KWD', 'BHD', 'QAR', 'OMR']

// Expense kinds — regular monthly living costs vs one-off/special outlays.
export const EXPENSE_KINDS = [
  { id: 'monthly', en: 'Monthly', ar: 'شهري' },
  { id: 'special', en: 'Special', ar: 'خاص' },
]

// Income sources.
export const INCOME_SOURCES = [
  { id: 'salary', en: 'Salary', ar: 'راتب', icon: 'wallet' },
  { id: 'bonus', en: 'Bonus', ar: 'مكافأة', icon: 'gift' },
  { id: 'dividend', en: 'Dividend', ar: 'أرباح أسهم', icon: 'chart' },
  { id: 'rental', en: 'Rental', ar: 'إيجار', icon: 'doc' },
  { id: 'business', en: 'Business', ar: 'أعمال', icon: 'report' },
  { id: 'other', en: 'Other', ar: 'أخرى', icon: 'plus' },
]

// Investment / holding types.
export const INVESTMENT_TYPES = [
  { id: 'stocks', en: 'Stocks', ar: 'أسهم', icon: 'chart' },
  { id: 'fund', en: 'Fund', ar: 'صندوق', icon: 'report' },
  { id: 'realestate', en: 'Real estate', ar: 'عقار', icon: 'doc' },
  { id: 'crypto', en: 'Crypto', ar: 'عملات رقمية', icon: 'wallet' },
  { id: 'savings', en: 'Savings', ar: 'ادخار', icon: 'wallet' },
  { id: 'business', en: 'Business', ar: 'أعمال', icon: 'report' },
  { id: 'other', en: 'Other', ar: 'أخرى', icon: 'plus' },
]

// Account types for the funding accounts an expense/income is tagged to.
export const ACCOUNT_TYPES = [
  { id: 'salary', en: 'Salary', ar: 'راتب', icon: 'wallet' },
  { id: 'current', en: 'Current', ar: 'جاري', icon: 'wallet' },
  { id: 'savings', en: 'Savings', ar: 'ادخار', icon: 'shield' },
  { id: 'credit', en: 'Credit card', ar: 'بطاقة ائتمان', icon: 'wallet' },
  { id: 'cash', en: 'Cash', ar: 'نقد', icon: 'wallet' },
  { id: 'other', en: 'Other', ar: 'أخرى', icon: 'wallet' },
]

// Loan / liability types.
export const LIABILITY_TYPES = [
  { id: 'mortgage', en: 'Mortgage', ar: 'رهن عقاري', icon: 'doc' },
  { id: 'car_loan', en: 'Car loan', ar: 'قرض سيارة', icon: 'car' },
  { id: 'personal', en: 'Personal loan', ar: 'قرض شخصي', icon: 'wallet' },
  { id: 'credit_card', en: 'Credit card', ar: 'بطاقة ائتمان', icon: 'wallet' },
  { id: 'business', en: 'Business loan', ar: 'قرض تجاري', icon: 'report' },
  { id: 'other', en: 'Other', ar: 'أخرى', icon: 'wallet' },
]
export const findLiabilityType = (id) => LIABILITY_TYPES.find(x => x.id === id)

// Property / real-estate types.
export const PROPERTY_TYPES = [
  { id: 'villa', en: 'Villa', ar: 'فيلا', icon: 'doc' },
  { id: 'apartment', en: 'Apartment', ar: 'شقة', icon: 'doc' },
  { id: 'land', en: 'Land', ar: 'أرض', icon: 'trip' },
  { id: 'office', en: 'Office', ar: 'مكتب', icon: 'report' },
  { id: 'shop', en: 'Shop', ar: 'محل', icon: 'wallet' },
  { id: 'other', en: 'Other', ar: 'أخرى', icon: 'doc' },
]
export const findPropertyType = (id) => PROPERTY_TYPES.find(x => x.id === id)

// Valuables / warranty categories.
export const VALUABLE_CATEGORIES = [
  { id: 'electronics', en: 'Electronics', ar: 'إلكترونيات', icon: 'doc' },
  { id: 'watch', en: 'Watch', ar: 'ساعة', icon: 'clock' },
  { id: 'jewelry', en: 'Jewelry', ar: 'مجوهرات', icon: 'sparkle' },
  { id: 'appliance', en: 'Appliance', ar: 'أجهزة منزلية', icon: 'wrench' },
  { id: 'art', en: 'Art', ar: 'فن', icon: 'camera' },
  { id: 'other', en: 'Other', ar: 'أخرى', icon: 'gift' },
]
export const findValuableCategory = (id) => VALUABLE_CATEGORIES.find(x => x.id === id)

// Membership / loyalty card categories.
export const MEMBERSHIP_CATEGORIES = [
  { id: 'airline', en: 'Airline', ar: 'طيران', icon: 'trip' },
  { id: 'hotel', en: 'Hotel', ar: 'فندق', icon: 'doc' },
  { id: 'store', en: 'Store', ar: 'متجر', icon: 'wallet' },
  { id: 'gym', en: 'Gym / Club', ar: 'نادي', icon: 'sparkle' },
  { id: 'bank', en: 'Bank', ar: 'بنك', icon: 'wallet' },
  { id: 'gov', en: 'Government', ar: 'حكومي', icon: 'shield' },
  { id: 'other', en: 'Other', ar: 'أخرى', icon: 'gift' },
]
export const findMembershipCategory = (id) => MEMBERSHIP_CATEGORIES.find(x => x.id === id)

// Wishlist — things to buy or aspire to, with a priority and rough cost.
export const WISH_CATEGORIES = [
  { id: 'tech', en: 'Tech & gadgets', ar: 'تقنية', icon: 'doc' },
  { id: 'watch', en: 'Watches', ar: 'ساعات', icon: 'clock' },
  { id: 'car', en: 'Cars & vehicles', ar: 'مركبات', icon: 'car' },
  { id: 'home', en: 'Home', ar: 'المنزل', icon: 'doc' },
  { id: 'fashion', en: 'Fashion', ar: 'أزياء', icon: 'gift' },
  { id: 'travel', en: 'Travel & experiences', ar: 'سفر وتجارب', icon: 'trip' },
  { id: 'gift', en: 'Gifts', ar: 'هدايا', icon: 'gift' },
  { id: 'other', en: 'Other', ar: 'أخرى', icon: 'sparkle' },
]
export const findWishCategory = (id) => WISH_CATEGORIES.find(x => x.id === id)

// Wishlist priority — how much you want it.
export const WISH_PRIORITIES = [
  { id: 'must', en: 'Must have', ar: 'ضروري', tint: 't-danger', color: 'var(--danger)' },
  { id: 'want', en: 'Want', ar: 'أرغبه', tint: 't-warn', color: 'var(--warn)' },
  { id: 'someday', en: 'Someday', ar: 'يوماً ما', tint: 't-info', color: 'var(--info)' },
]
export const findWishPriority = (id) => WISH_PRIORITIES.find(x => x.id === id)

// Reporting levels for a work team member (used in the org hierarchy).
export const ROLE_LEVELS = [
  { id: 'head', en: 'Head', ar: 'رئيس' },
  { id: 'deputy', en: 'Deputy', ar: 'نائب' },
  { id: 'manager', en: 'Manager', ar: 'مدير' },
  { id: 'lead', en: 'Team lead', ar: 'قائد فريق' },
  { id: 'officer', en: 'Officer', ar: 'موظف' },
  { id: 'coordinator', en: 'Coordinator', ar: 'منسّق' },
  { id: 'specialist', en: 'Specialist', ar: 'أخصائي' },
  { id: 'other', en: 'Other', ar: 'أخرى' },
]
export const findRole = (id) => ROLE_LEVELS.find(x => x.id === id)
export function roleLabel(member, lang) {
  if (!member) return ''
  const r = findRole(member.role)
  return r ? label(r, lang) : (member.title || '')
}

// Household staff roles.
export const STAFF_ROLES = [
  { id: 'driver', en: 'Driver', ar: 'سائق', icon: 'car' },
  { id: 'maid', en: 'Housemaid', ar: 'عاملة منزلية', icon: 'people' },
  { id: 'nanny', en: 'Nanny', ar: 'مربية', icon: 'people' },
  { id: 'cook', en: 'Cook', ar: 'طبّاخ', icon: 'gift' },
  { id: 'gardener', en: 'Gardener', ar: 'بستاني', icon: 'trip' },
  { id: 'guard', en: 'Guard', ar: 'حارس', icon: 'shield' },
  { id: 'other', en: 'Other', ar: 'أخرى', icon: 'people' },
]
export const findStaffRole = (id) => STAFF_ROLES.find(x => x.id === id)

// Property ledger entry kinds.
export const PROPERTY_LOG_KINDS = [
  { id: 'rent', en: 'Rent received', ar: 'إيجار مستلم', icon: 'wallet', income: true },
  { id: 'utility', en: 'Utility bill', ar: 'فاتورة خدمات', icon: 'wallet' },
  { id: 'maintenance', en: 'Maintenance', ar: 'صيانة', icon: 'wrench' },
  { id: 'fee', en: 'Fees & service', ar: 'رسوم وخدمات', icon: 'doc' },
  { id: 'other', en: 'Other', ar: 'أخرى', icon: 'wallet' },
]
export const findPropertyLogKind = (id) => PROPERTY_LOG_KINDS.find(x => x.id === id)

// Charity / giving types + common causes.
export const GIVING_TYPES = [
  { id: 'zakat', en: 'Zakat', ar: 'زكاة', icon: 'sparkle' },
  { id: 'sadaqah', en: 'Sadaqah', ar: 'صدقة', icon: 'gift' },
  { id: 'zakat_fitr', en: 'Zakat al-Fitr', ar: 'زكاة الفطر', icon: 'sparkle' },
]
export const findGivingType = (id) => GIVING_TYPES.find(x => x.id === id)
export const GIVING_CAUSES = ['Mosque', 'Orphans', 'Family in need', 'Water well', 'Medical aid', 'Education', 'Ramadan iftar', 'Refugees', 'General']

// Appointment / health-calendar types.
export const APPOINTMENT_TYPES = [
  { id: 'doctor', en: 'Doctor', ar: 'طبيب', icon: 'shield' },
  { id: 'dentist', en: 'Dentist', ar: 'أسنان', icon: 'sparkle' },
  { id: 'vaccination', en: 'Vaccination', ar: 'تطعيم', icon: 'shield' },
  { id: 'checkup', en: 'Check-up', ar: 'فحص دوري', icon: 'shield' },
  { id: 'school', en: 'School', ar: 'مدرسة', icon: 'doc' },
  { id: 'meeting', en: 'Meeting', ar: 'اجتماع', icon: 'people' },
  { id: 'other', en: 'Other', ar: 'أخرى', icon: 'calendar' },
]
export const findAppointmentType = (id) => APPOINTMENT_TYPES.find(x => x.id === id)

export const findIncomeSource = (id) => INCOME_SOURCES.find(x => x.id === id)
export const findInvestmentType = (id) => INVESTMENT_TYPES.find(x => x.id === id)
export const findAccountType = (id) => ACCOUNT_TYPES.find(x => x.id === id)

// Icons offered when creating a contact group (must exist in ui/Icon.jsx).
export const GROUP_ICONS = [
  'people', 'cake', 'gift', 'sparkle', 'car', 'trip', 'wallet',
  'flag', 'phone', 'mail', 'shield', 'note', 'wrench', 'doc',
]

// One-tap starter groups shown when no groups exist yet.
export const SUGGESTED_GROUPS = [
  { key: 'family', icon: 'people', en: 'Family', ar: 'العائلة' },
  { key: 'friends', icon: 'sparkle', en: 'Friends', ar: 'الأصدقاء' },
  { key: 'work', icon: 'flag', en: 'Work', ar: 'العمل' },
]

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

// Resolve an expense category label. Custom categories are stored on the
// expense as `custom:<Label>`; built-in ones as their id.
export function catLabel(id, lang = 'en') {
  if (!id) return ''
  if (typeof id === 'string' && id.startsWith('custom:')) return id.slice(7)
  const c = findCategory(id)
  return c ? label(c, lang) : id
}

// Options for the category picker: built-ins + the user's custom categories.
export function categoryOptions(lang = 'en', custom = []) {
  const base = EXPENSE_CATEGORIES.map(c => ({ value: c.id, label: label(c, lang) }))
  const cust = (custom || []).map(l => ({ value: 'custom:' + l, label: l }))
  return [...base, ...cust]
}
