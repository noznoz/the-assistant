import * as db from './db.js'
import { todayISO } from '../lib/format.js'

// Seeds a realistic, executive-flavoured starter dataset on first launch only.
// Users can wipe it any time from Settings → Delete all data.
export function maybeSeed() {
  if (db.isSeeded()) return
  const d = (offset) => {
    const t = new Date(); t.setDate(t.getDate() + offset)
    return t.toISOString().slice(0, 10)
  }

  const vAlmas = db.insert('vehicles', {
    name: 'Range Rover Autobiography', nickname: 'Almas', type: 'car',
    brand: 'Land Rover', model: 'Range Rover', year: 2023, color: 'Santorini Black',
    plate: 'RUH 4820', vin: 'SALGA2AKXPA1XXXXX', mileage: '24,800 km', fuel: 'Petrol',
    purchaseDate: '2023-02-10', purchasePrice: 620000, currentValue: 540000,
    insuranceCompany: 'Tawuniya', policyExpiry: d(38),
    bio: 'The daily executive command centre. Quiet, commanding, effortless on the long Riyadh–Jeddah runs.',
  })
  const vRaven = db.insert('vehicles', {
    name: 'BMW R 1250 GS', nickname: 'Iron Raven', type: 'motorcycle',
    brand: 'BMW', model: 'R 1250 GS Adventure', year: 2022, color: 'Ice Grey',
    plate: 'RUH 9017', mileage: '14,200 km', fuel: 'Petrol',
    purchaseDate: '2022-09-01', purchasePrice: 92000, currentValue: 78000,
    insuranceCompany: 'Malath', policyExpiry: d(12),
    bio: 'Weekend freedom machine. Built for the Taif escarpment and the empty roads before dawn.',
  })
  const vBoat = db.insert('vehicles', {
    name: 'Axopar 37 Sun Top', nickname: 'Blue Hour', type: 'boat',
    brand: 'Axopar', model: '37 Sun Top', year: 2021, color: 'Deep Blue',
    mileage: '320 hrs', fuel: 'Diesel', purchaseDate: '2021-06-20',
    purchasePrice: 1250000, currentValue: 1100000,
    insuranceCompany: 'Bupa Marine', policyExpiry: d(85),
    bio: 'Sunset cruises off the Corniche and long weekends on the Red Sea.',
  })

  db.insert('services', { vehicleId: vAlmas.id, date: d(-40), odo: '22,000 km', workshop: 'Land Rover Riyadh', work: 'Full service + brake fluid', cost: 3200, nextDate: d(50), nextOdo: '30,000 km' })
  db.insert('services', { vehicleId: vRaven.id, date: d(-15), odo: '13,500 km', workshop: 'BMW Motorrad', work: 'Chain, oil & filter', cost: 1450, nextDate: d(5), nextOdo: '18,000 km' })

  db.insert('accessories', { vehicleId: vAlmas.id, name: 'Ceramic window tint', cost: 2800, date: d(-60), fitted: true, note: 'Full body, 70% front' })
  db.insert('accessories', { vehicleId: vAlmas.id, name: 'Dash cam (front + rear)', cost: 1200, date: d(-30), fitted: true })
  db.insert('accessories', { vehicleId: vRaven.id, name: 'Touratech panniers', cost: 6500, date: d(-45), fitted: true, note: 'Aluminium, 38L pair' })

  db.insert('documents', { title: 'Vehicle registration (Istimara)', category: 'vehicle_reg', vehicleId: vAlmas.id, expiry: d(210), notes: 'Renew via Absher', attachments: [] })
  db.insert('documents', { title: 'Insurance policy', category: 'insurance', vehicleId: vAlmas.id, expiry: d(38), attachments: [] })

  const tasks = [
    { title: 'Approve Q3 marketing budget', type: 'approval', classification: 'work', priority: 'critical', status: 'waiting_me', dueDate: todayISO(), project: 'Finance', requestedBy: 'Khalid Al-Otaibi' },
    { title: 'Call Ahmed about the Jeddah contract', type: 'follow_up', classification: 'work', priority: 'high', status: 'planned', dueDate: todayISO(), dueTime: '10:00', assignedTo: 'Ahmed Al-Sayed' },
    { title: 'Renew Iron Raven insurance', type: 'task', classification: 'personal', priority: 'high', status: 'planned', dueDate: d(12), relatedVehicle: vRaven.id },
    { title: 'Send the board pack to Sara', type: 'request', classification: 'work', priority: 'medium', status: 'waiting_someone', dueDate: d(-1), assignedTo: 'Sara Al-Nasser' },
    { title: 'Book Blue Hour marina slot for Eid', type: 'errand', classification: 'personal', priority: 'medium', status: 'new', dueDate: d(9), relatedVehicle: vBoat.id },
    { title: 'Idea: quarterly family trip to AlUla', type: 'idea', classification: 'personal', priority: 'low', status: 'inbox' },
  ]
  tasks.forEach(t => db.insert('tasks', t))

  const exp = [
    { amount: 450, category: 'moto_acc', merchant: 'Touratech', item: 'Crash bars + tank bag', method: 'credit', date: todayISO(), classification: 'personal', kind: 'special', account: 'Other account', relatedVehicle: vRaven.id },
    { amount: 120, currency: 'USD', category: 'dining', merchant: 'Nobu', item: 'Dinner abroad', method: 'credit', date: todayISO(), classification: 'personal', account: 'Salary account' },
    { amount: 280, category: 'fuel', merchant: 'Aramco', method: 'apple_pay', date: todayISO(), account: 'Salary account', relatedVehicle: vAlmas.id, liters: 62, odometer: 24800 },
    { amount: 265, category: 'fuel', merchant: 'Aramco', method: 'apple_pay', date: d(-14), relatedVehicle: vAlmas.id, liters: 58, odometer: 24240 },
    { amount: 275, category: 'fuel', merchant: 'Sasco', method: 'apple_pay', date: d(-27), relatedVehicle: vAlmas.id, liters: 60, odometer: 23700 },
    { amount: 1450, category: 'vehicle_maint', merchant: 'BMW Motorrad', method: 'credit', date: d(-15), kind: 'special', relatedVehicle: vRaven.id },
    { amount: 3200, category: 'vehicle_maint', merchant: 'Land Rover Riyadh', method: 'company', date: d(-40), kind: 'special', relatedVehicle: vAlmas.id },
    { amount: 620, category: 'dining', merchant: 'Myazu', method: 'amex', date: d(-2), classification: 'personal', account: 'Salary account' },
    { amount: 12000, category: 'shopping', merchant: 'Apple Store', item: 'MacBook Pro', method: 'installment', installmentMonths: 12, date: d(-1), classification: 'personal', kind: 'special', account: 'Salary account' },
    { amount: 190, category: 'groceries', merchant: 'Danube', method: 'apple_pay', date: d(-3), account: 'Salary account' },
    { amount: 2400, category: 'marina', merchant: 'Jeddah Yacht Club', method: 'transfer', date: d(-6), account: 'Other account', relatedVehicle: vBoat.id },
  ]
  exp.forEach(e => db.insert('expenses', e))

  // A sample expense project with a custom category to showcase the feature.
  db.writeSettings({ ...db.readSettings(), customCategories: ['Landscaping'], categoryBudgets: { dining: 2000, fuel: 1500, groceries: 1200 } })

  // Funding accounts (Salary is the default; Savings is excluded from net).
  db.insert('accounts', { name: 'Salary account', type: 'salary', openingBalance: 0, includeInNet: true, isDefault: true })
  db.insert('accounts', { name: 'Other account', type: 'current', openingBalance: 0, includeInNet: true, isDefault: false })
  db.insert('accounts', { name: 'Savings', type: 'savings', openingBalance: 250000, includeInNet: false, isDefault: false })

  // Liabilities / loans
  db.insert('liabilities', { name: 'Villa mortgage', type: 'mortgage', lender: 'Al Rajhi Bank', principal: 1800000, balance: 1240000, monthlyPayment: 9800, rate: 4.2 })
  db.insert('liabilities', { name: 'Range Rover finance', type: 'car_loan', lender: 'SNB', principal: 420000, balance: 168000, monthlyPayment: 7200, rate: 3.5 })

  // Income — a recurring salary plus a one-off bonus.
  db.insert('income', { source: 'salary', amount: 85000, currency: 'SAR', date: todayISO(), recurring: true, account: 'Salary account', note: 'Monthly salary' })
  db.insert('income', { source: 'rental', amount: 9000, currency: 'SAR', date: d(-4), recurring: true, account: 'Other account', note: 'Villa rent' })
  db.insert('income', { source: 'bonus', amount: 15000, currency: 'SAR', date: d(-6), recurring: false, account: 'Salary account', note: 'Q2 performance bonus' })

  // Investments / holdings, with a dividend logged as income.
  const invAramco = db.insert('investments', { name: 'Aramco shares', type: 'stocks', invested: 200000, currentValue: 236000, currency: 'SAR', note: '2,000 shares' })
  db.insert('investments', { name: 'Rental flat — Jeddah', type: 'realestate', invested: 1200000, currentValue: 1350000, currency: 'SAR' })
  db.insert('investments', { name: 'Global index fund', type: 'fund', invested: 50000, currentValue: 58500, currency: 'USD' })
  db.insert('income', { source: 'dividend', investmentId: invAramco.id, amount: 4200, currency: 'SAR', date: d(-8), recurring: false, note: 'Aramco shares' })

  // Subscriptions / recurring bills
  db.insert('subscriptions', { name: 'Netflix', amount: 56, currency: 'SAR', cycle: 'monthly', category: 'subscriptions', method: 'credit', nextDue: d(3), active: true })
  db.insert('subscriptions', { name: 'iCloud+', amount: 11.99, currency: 'SAR', cycle: 'monthly', category: 'subscriptions', method: 'apple_pay', nextDue: d(12), active: true })
  db.insert('subscriptions', { name: 'Car insurance', amount: 4200, currency: 'SAR', cycle: 'yearly', category: 'insurance', method: 'transfer', nextDue: d(38), active: true })

  // Rewards store (redeem chore points)
  db.insert('rewards', { name: 'Extra hour of screen time', cost: 10 })
  db.insert('rewards', { name: 'Choose the weekend outing', cost: 25 })
  db.insert('rewards', { name: 'New Lego set', cost: 50 })

  // A trip with a budget and linked expenses
  const trip = db.insert('trips', { name: 'AlUla Family Trip', destination: 'AlUla', start: d(20), end: d(24), budget: 15000, vehicleId: vAlmas.id });
  [
    { amount: 3200, category: 'hotels', merchant: 'Habitas AlUla', method: 'credit', date: d(20), tripId: trip.id, classification: 'personal' },
    { amount: 850, category: 'dining', merchant: 'Local restaurant', method: 'credit', date: d(21), tripId: trip.id, classification: 'personal' },
    { amount: 1200, category: 'entertainment', merchant: 'Desert tour', method: 'credit', date: d(22), tripId: trip.id, classification: 'personal' },
  ].forEach(e => db.insert('expenses', e))
  const proj = db.insert('projects', { name: 'House Renovation', budget: 60000, note: 'Villa upgrade' });
  [
    { amount: 12500, category: 'household', merchant: 'IKEA', method: 'credit', date: d(-5), projectId: proj.id, classification: 'personal' },
    { amount: 8400, category: 'custom:Landscaping', merchant: 'Green Oasis', method: 'transfer', date: d(-10), projectId: proj.id, classification: 'personal' },
    { amount: 3200, category: 'shopping', merchant: 'Home Centre', method: 'credit', date: d(-2), projectId: proj.id, classification: 'personal' },
  ].forEach(e => db.insert('expenses', e))

  const people = [
    { name: 'Layla', relationship: 'family', jobTitle: 'Spouse', mobile: '+966500000010', whatsapp: '+966500000010', birthday: d(40) },
    { name: 'Omar', relationship: 'family', jobTitle: 'Son', mobile: '+966500000011', whatsapp: '+966500000011', birthday: d(9) },
    { name: 'Noura', relationship: 'family', jobTitle: 'Daughter', mobile: '+966500000012', whatsapp: '+966500000012', birthday: d(120) },
    { name: 'Khalid Al-Otaibi', jobTitle: 'CFO', company: 'Group Finance', relationship: 'colleague', mobile: '+966500000001' },
    { name: 'Ahmed Al-Sayed', jobTitle: 'Partner', company: 'Al-Sayed Legal', relationship: 'supplier', mobile: '+966500000002' },
    { name: 'Sara Al-Nasser', jobTitle: 'Executive Assistant', company: 'Office', relationship: 'report', mobile: '+966500000003' },
  ]
  // Contact groups
  const gFamily = db.insert('groups', { name: 'Family', icon: 'people' })
  const gFriends = db.insert('groups', { name: 'Friends', icon: 'sparkle' })
  const gWork = db.insert('groups', { name: 'Work', icon: 'flag' })
  const groupFor = (rel) => rel === 'family' ? [gFamily.id] : ['colleague', 'report', 'manager'].includes(rel) ? [gWork.id] : []
  const savedPeople = people.map(p => db.insert('people', { ...p, groupIds: groupFor(p.relationship) }))
  // A couple of family-assigned tasks to demonstrate delegation.
  const layla = savedPeople[0], omar = savedPeople[1]
  db.insert('tasks', { title: 'Pick up the AlUla trip documents', type: 'request', classification: 'personal', priority: 'high', status: 'waiting_someone', dueDate: todayISO(), assigneeId: layla.id, assignedTo: layla.name })
  db.insert('tasks', { title: 'Finish school project & email teacher', type: 'request', classification: 'personal', priority: 'medium', status: 'waiting_someone', dueDate: d(2), assigneeId: omar.id, assignedTo: omar.name })

  db.insert('notes', { text: 'Reminder: renew boat registration before the summer season.' })

  db.markSeeded()
}
