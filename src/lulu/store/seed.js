import * as db from './db.js'
import { todayISO } from '../lib/format.js'

// Seeds a realistic, executive-flavoured starter dataset on first launch only.
// Users can wipe it any time from Settings → Delete all data.
export function maybeSeed() {
  if (db.isSeeded()) return
  // Tag every seeded record so it can be one-tap removed later and is never
  // pushed to the cloud (sample data stays local-only).
  const S = (coll, obj) => db.insert(coll, { ...obj, seed: true })
  const d = (offset) => {
    const t = new Date(); t.setDate(t.getDate() + offset)
    return t.toISOString().slice(0, 10)
  }

  const vAlmas = S('vehicles', {
    name: 'Range Rover Autobiography', nickname: 'Almas', type: 'car',
    brand: 'Land Rover', model: 'Range Rover', year: 2023, color: 'Santorini Black',
    plate: 'RUH 4820', vin: 'SALGA2AKXPA1XXXXX', mileage: '24,800 km', fuel: 'Petrol',
    purchaseDate: '2023-02-10', purchasePrice: 620000, currentValue: 540000, ownership: 'finance',
    insuranceCompany: 'Tawuniya', policyExpiry: d(38), registrationExpiry: d(24),
    bio: 'The daily executive command centre. Quiet, commanding, effortless on the long Riyadh–Jeddah runs.',
  })
  const vRaven = S('vehicles', {
    name: 'BMW R 1250 GS', nickname: 'Iron Raven', type: 'motorcycle',
    brand: 'BMW', model: 'R 1250 GS Adventure', year: 2022, color: 'Ice Grey',
    plate: 'RUH 9017', mileage: '14,200 km', fuel: 'Petrol',
    purchaseDate: '2022-09-01', purchasePrice: 92000, currentValue: 78000, ownership: 'owned',
    insuranceCompany: 'Malath', policyExpiry: d(12), registrationExpiry: d(-6),
    bio: 'Weekend freedom machine. Built for the Taif escarpment and the empty roads before dawn.',
  })
  const vBoat = S('vehicles', {
    name: 'Axopar 37 Sun Top', nickname: 'Blue Hour', type: 'boat',
    brand: 'Axopar', model: '37 Sun Top', year: 2021, color: 'Deep Blue',
    mileage: '320 hrs', fuel: 'Diesel', purchaseDate: '2021-06-20', ownership: 'owned',
    purchasePrice: 1250000, currentValue: 1100000,
    insuranceCompany: 'Bupa Marine', policyExpiry: d(85),
    bio: 'Sunset cruises off the Corniche and long weekends on the Red Sea.',
  })

  S('services', { vehicleId: vAlmas.id, date: d(-40), odo: '22,000 km', workshop: 'Land Rover Riyadh', work: 'Full service + brake fluid', cost: 3200, nextDate: d(50), nextOdo: '30,000 km' })
  S('services', { vehicleId: vRaven.id, date: d(-15), odo: '13,500 km', workshop: 'BMW Motorrad', work: 'Chain, oil & filter', cost: 1450, nextDate: d(5), nextOdo: '18,000 km' })

  S('accessories', { vehicleId: vAlmas.id, name: 'Ceramic window tint', group: 'protection', cost: 2800, shipping: 0, install: 400, installedBy: 'XPEL Riyadh', date: d(-60), status: 'fitted', fitted: true, note: 'Full body, 70% front' })
  S('accessories', { vehicleId: vAlmas.id, name: 'Dash cam (front + rear)', group: 'accessory', cost: 1200, shipping: 120, install: 250, installedBy: 'Sound Studio', website: 'https://www.thinkware.com', date: d(-30), status: 'fitted', fitted: true })
  S('accessories', { vehicleId: vRaven.id, name: 'Touratech panniers', group: 'gears', cost: 6500, shipping: 800, install: 0, installedBy: 'Self', website: 'https://touratech.com', date: d(-45), status: 'fitted', fitted: true, note: 'Aluminium, 38L pair' })
  S('accessories', { vehicleId: vAlmas.id, name: 'Roof cross bars', group: 'gears', cost: 3400, shipping: 300, install: 0, date: todayISO(), status: 'wishlist', fitted: false, note: 'For the Genesis roof box' })
  S('accessories', { vehicleId: vRaven.id, name: 'Akrapovič exhaust', group: 'performance', cost: 9800, shipping: 1500, install: 600, date: todayISO(), status: 'wishlist', fitted: false, website: 'https://www.akrapovic.com' })

  const vaultVehicles = S('vaults', { name: 'Vehicles', icon: 'car' })
  const vaultPersonal = S('vaults', { name: 'Personal', icon: 'people' })
  const vaultProperty = S('vaults', { name: 'Property', icon: 'doc' })
  const vaultVehInsurance = S('vaults', { name: 'Insurance', icon: 'shield', parentId: vaultVehicles.id })
  S('documents', { title: 'Vehicle registration (Istimara)', category: 'vehicle_reg', vaultId: vaultVehicles.id, vehicleId: vAlmas.id, expiry: d(210), notes: 'Renew via Absher', attachments: [] })
  S('documents', { title: 'Insurance policy', category: 'insurance', vaultId: vaultVehInsurance.id, vehicleId: vAlmas.id, expiry: d(38), attachments: [] })
  S('documents', { title: 'Passport', category: 'personal', vaultId: vaultPersonal.id, expiry: d(400), notes: 'Renew a year before expiry', attachments: [] })
  S('documents', { title: 'Motorcycle license', category: 'custom:Motorcycle', vaultId: vaultVehicles.id, expiry: d(150), attachments: [] })
  db.writeSettings({ ...db.readSettings(), customDocCategories: ['Motorcycle'] })

  const tasks = [
    { title: 'Approve Q3 marketing budget', type: 'approval', classification: 'work', priority: 'critical', status: 'waiting_me', dueDate: todayISO(), project: 'Finance', requestedBy: 'Khalid Al-Otaibi' },
    { title: 'Call Ahmed about the Jeddah contract', type: 'follow_up', classification: 'work', priority: 'high', status: 'planned', dueDate: todayISO(), dueTime: '10:00', assignedTo: 'Ahmed Al-Sayed' },
    { title: 'Renew Iron Raven insurance', type: 'task', classification: 'personal', priority: 'high', status: 'planned', dueDate: d(12), relatedVehicle: vRaven.id },
    { title: 'Send the board pack to Sara', type: 'request', classification: 'work', priority: 'medium', status: 'waiting_someone', dueDate: d(-1), assignedTo: 'Sara Al-Nasser' },
    { title: 'Book Blue Hour marina slot for Eid', type: 'errand', classification: 'personal', priority: 'medium', status: 'new', dueDate: d(9), relatedVehicle: vBoat.id },
    { title: 'Idea: quarterly family trip to AlUla', type: 'idea', classification: 'personal', priority: 'low', status: 'inbox' },
  ]
  tasks.forEach(t => S('tasks', t))

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
  exp.forEach(e => S('expenses', e))

  // A sample expense project with a custom category to showcase the feature.
  db.writeSettings({ ...db.readSettings(), customCategories: ['Landscaping'], categoryBudgets: { dining: 2000, fuel: 1500, groceries: 1200 } })

  // Funding accounts (Salary is the default; Savings is excluded from net).
  S('accounts', { name: 'Salary account', type: 'salary', openingBalance: 0, includeInNet: true, isDefault: true })
  S('accounts', { name: 'Other account', type: 'current', openingBalance: 0, includeInNet: true, isDefault: false })
  S('accounts', { name: 'Savings', type: 'savings', openingBalance: 250000, includeInNet: false, isDefault: false })

  // Liabilities / loans
  S('liabilities', { name: 'Villa mortgage', type: 'mortgage', lender: 'Al Rajhi Bank', principal: 1800000, balance: 1240000, monthlyPayment: 9800, rate: 4.2 })
  S('liabilities', { name: 'Range Rover finance', type: 'car_loan', lender: 'SNB', principal: 420000, balance: 168000, monthlyPayment: 7200, rate: 3.5 })

  // Income — a recurring salary plus a one-off bonus.
  S('income', { source: 'salary', amount: 85000, currency: 'SAR', date: todayISO(), recurring: true, account: 'Salary account', note: 'Monthly salary' })
  S('income', { source: 'rental', amount: 9000, currency: 'SAR', date: d(-4), recurring: true, account: 'Other account', note: 'Villa rent' })
  S('income', { source: 'bonus', amount: 15000, currency: 'SAR', date: d(-6), recurring: false, account: 'Salary account', note: 'Q2 performance bonus' })

  // Investments / holdings, with a dividend logged as income.
  const invAramco = S('investments', { name: 'Aramco shares', type: 'stocks', currency: 'SAR', lots: [{ qty: 1500, price: 32 }, { qty: 500, price: 35 }], shares: 2000, avgPrice: 32.75, invested: 65500, currentPrice: 34.9, currentValue: 69800, note: 'Averaged across 2 buys' })
  S('investments', { name: 'Global index fund', type: 'fund', invested: 50000, currentValue: 58500, currency: 'USD' })
  S('income', { source: 'dividend', investmentId: invAramco.id, amount: 4200, currency: 'SAR', date: d(-8), recurring: false, note: 'Aramco shares' })

  // Properties / real estate
  S('properties', { name: 'Family villa', type: 'villa', address: 'Al Malqa, Riyadh', purchasePrice: 1800000, currentValue: 1950000, currency: 'SAR', ownership: 'finance', monthlyRent: 0, note: 'Primary residence' })
  const propFlat = S('properties', { name: 'Rental flat — Jeddah', type: 'apartment', address: 'Al Shati, Jeddah', purchasePrice: 1200000, currentValue: 1350000, currency: 'SAR', ownership: 'owned', monthlyRent: 4500, rentedTo: 'Mr. Faisal', contractEnd: d(64) });
  [
    { kind: 'rent', amount: 4500, date: d(-3), note: 'February rent' },
    { kind: 'rent', amount: 4500, date: d(-33), note: 'January rent' },
    { kind: 'utility', amount: 620, date: d(-12), note: 'Electricity & water' },
    { kind: 'maintenance', amount: 850, date: d(-20), note: 'AC service' },
    { kind: 'fee', amount: 300, date: d(-40), note: 'Building service fee' },
  ].forEach(l => S('propertylog', { ...l, propertyId: propFlat.id, currency: 'SAR' }))

  // Valuables & warranties
  S('valuables', { name: 'Rolex Submariner', category: 'watch', brand: 'Rolex', value: 48000, currency: 'SAR', purchaseDate: d(-400), warrantyExpiry: d(1400), receipts: [] })
  S('valuables', { name: 'MacBook Pro 16"', category: 'electronics', brand: 'Apple', model: 'M4 Pro', serial: 'C02XXXX', value: 12000, currency: 'SAR', purchaseDate: d(-1), warrantyExpiry: d(364), receipts: [] })
  S('valuables', { name: 'Samsung fridge', category: 'appliance', brand: 'Samsung', value: 6500, currency: 'SAR', purchaseDate: d(-320), warrantyExpiry: d(20), receipts: [] })

  // Wishlist — things to buy / aspire to
  S('wishlist', { name: 'Patek Philippe Nautilus', category: 'watch', priority: 'someday', price: 480000, currency: 'SAR', forWho: 'Myself', note: 'The grail. One day.', purchased: false })
  S('wishlist', { name: 'Sony WH-1000XM6', category: 'tech', priority: 'want', price: 1699, currency: 'SAR', url: 'https://www.sony.com', forWho: 'Myself', purchased: false })
  S('wishlist', { name: 'PlayStation 5 Pro', category: 'tech', priority: 'must', price: 3200, currency: 'SAR', forWho: 'Omar', targetDate: d(9), note: 'Birthday gift', purchased: false })
  S('wishlist', { name: 'Dyson Airwrap', category: 'home', priority: 'want', price: 2400, currency: 'SAR', forWho: 'Layla', purchased: false })
  S('wishlist', { name: 'Maldives family trip', category: 'travel', priority: 'someday', price: 60000, currency: 'SAR', forWho: 'Family', note: 'Eid break next year', purchased: false })

  // Work — department structure, members, tasks and boss (two-way) tasks.
  db.writeSettings({ ...db.readSettings(), profile: { ...(db.readSettings().profile || {}), managerName: 'Abdullah Al-Rashid', managerTitle: 'Group CEO', managerWhatsapp: '+966500000040' } })
  const opsDept = S('departments', { name: 'Operations', note: 'Regional operations team' })
  const mFaisal = S('members', { name: 'Faisal Al-Harbi', title: 'Operations Director', role: 'head', departmentId: opsDept.id, mobile: '+966500000031', whatsapp: '+966500000031' })
  const mSara = S('members', { name: 'Sara Khan', title: 'Operations Manager', role: 'manager', departmentId: opsDept.id, mobile: '+966500000032', whatsapp: '+966500000032', reportsToId: mFaisal.id })
  S('members', { name: 'Yousef Ali', title: 'Logistics Officer', role: 'officer', departmentId: opsDept.id, mobile: '+966500000034', reportsToId: mSara.id })
  db.update('departments', opsDept.id, { headId: mFaisal.id })
  const salesDept = S('departments', { name: 'Sales', note: 'Commercial team' })
  const mOmar = S('members', { name: 'Omar Nasser', title: 'Sales Director', role: 'head', departmentId: salesDept.id, mobile: '+966500000033', whatsapp: '+966500000033' })
  db.update('departments', salesDept.id, { headId: mOmar.id })
  S('tasks', { title: 'Prepare Q3 operations report', description: 'Consolidate regional KPIs and cost variances.', classification: 'work', departmentId: opsDept.id, memberId: mFaisal.id, assignedTo: mFaisal.name, status: 'waiting_someone', priority: 'high', dueDate: d(5), subtasks: [{ id: 'sb1', text: 'Collect KPI data', done: true }, { id: 'sb2', text: 'Draft summary', done: false }, { id: 'sb3', text: 'Review with finance', done: false }] })
  S('tasks', { title: 'Vendor contract renewals', classification: 'work', departmentId: opsDept.id, memberId: mSara.id, assignedTo: mSara.name, status: 'waiting_someone', priority: 'medium', dueDate: d(12) })
  // Recurring weekly report (regenerates on completion).
  S('tasks', { title: 'Weekly operations report', classification: 'work', departmentId: opsDept.id, memberIds: [mSara.id], memberId: mSara.id, assignedTo: mSara.name, status: 'in_progress', priority: 'medium', dueDate: d(3), repeat: 'weekly' })
  S('tasks', { title: 'Follow up Q3 pipeline', classification: 'work', departmentId: salesDept.id, memberId: mOmar.id, assignedTo: mOmar.name, status: 'waiting_someone', priority: 'high', dueDate: d(4) })
  S('tasks', { title: 'Signed off vendor SLA', classification: 'work', departmentId: opsDept.id, memberId: mFaisal.id, assignedTo: mFaisal.name, status: 'completed', priority: 'medium', dueDate: d(-2) })
  // Whole-department task (everyone in Operations).
  S('tasks', { title: 'Complete annual safety training', description: 'All operations staff to finish the online modules.', classification: 'work', departmentId: opsDept.id, memberIds: [mFaisal.id, mSara.id], memberId: mFaisal.id, assignedTo: 'Operations', status: 'waiting_someone', priority: 'medium', dueDate: d(20) })
  // Cross-department task (Operations + Sales).
  S('tasks', { title: 'Plan Q4 kickoff event', description: 'Joint effort between Ops and Sales.', classification: 'work', departmentId: opsDept.id, departmentIds: [opsDept.id, salesDept.id], memberIds: [mSara.id, mOmar.id], memberId: mSara.id, assignedTo: 'Sara Khan, Omar Nasser', status: 'in_progress', priority: 'high', dueDate: d(15) })
  S('tasks', { title: 'Discuss 2026 budget with CEO', description: 'Bring capex priorities.', classification: 'work', boss: 'up', priority: 'high', dueDate: d(3) })
  S('tasks', { title: 'Board deck requested by CEO', classification: 'work', boss: 'down', priority: 'critical', dueDate: d(2) })
  S('meetings', { title: 'Weekly ops sync', date: d(-1), attendees: 'Faisal, Sara', context: 'team', departmentId: opsDept.id, notes: 'Reviewed Q3 pipeline and vendor risks. Agreed to fast-track two renewals.', actions: [{ id: 'ma1', text: 'Send vendor list to Sara' }, { id: 'ma2', text: 'Book finance review' }] })

  // A recurring utility charge across 3 months (fuels the "detected recurring"
  // suggestion) plus repeat merchants so category auto-suggest has history.
  ;[
    { amount: 480, category: 'utilities', merchant: 'STC', method: 'credit', date: d(-2), classification: 'personal' },
    { amount: 495, category: 'utilities', merchant: 'STC', method: 'credit', date: d(-33), classification: 'personal' },
    { amount: 470, category: 'utilities', merchant: 'STC', method: 'credit', date: d(-63), classification: 'personal' },
    { amount: 320, category: 'dining', merchant: 'Nozomi', method: 'amex', date: d(-6), classification: 'personal' },
    { amount: 410, category: 'dining', merchant: 'Nozomi', method: 'amex', date: d(-26), classification: 'personal' },
  ].forEach(e => S('expenses', e))

  // Household staff
  S('staff', { name: 'Rahul', role: 'driver', nationality: 'Indian', mobile: '+966500000021', whatsapp: '+966500000021', salary: 2200, currency: 'SAR', iqamaNumber: '2412xxxxxx', iqamaExpiry: d(28), passportExpiry: d(210), contractEnd: d(400) })
  S('staff', { name: 'Maria', role: 'nanny', nationality: 'Filipino', mobile: '+966500000022', whatsapp: '+966500000022', salary: 1800, currency: 'SAR', iqamaNumber: '2418xxxxxx', iqamaExpiry: d(120), passportExpiry: d(-8) })
  S('staff', { name: 'Joseph', role: 'gardener', nationality: 'Sri Lankan', mobile: '+966500000023', salary: 1200, currency: 'SAR', iqamaExpiry: d(75) })

  // Spiritual — a few days of prayer tracking to seed a streak.
  for (let i = 1; i <= 5; i++) {
    S('spiritual', { date: d(-i), prayers: { fajr: true, dhuhr: true, asr: true, maghrib: true, isha: true }, quran: i % 2 ? 4 : 2, fasted: false })
  }
  S('spiritual', { date: todayISO(), prayers: { fajr: true, dhuhr: true, asr: false, maghrib: false, isha: false }, quran: 3, fasted: false })

  // Charity & Zakat giving
  S('giving', { type: 'zakat', amount: 42000, currency: 'SAR', cause: 'Orphans', date: d(-40), note: 'Annual Zakat — first tranche' })
  S('giving', { type: 'sadaqah', amount: 1500, currency: 'SAR', cause: 'Mosque', date: d(-10) })
  S('giving', { type: 'sadaqah', amount: 800, currency: 'SAR', cause: 'Family in need', date: d(-3) })

  // Net-worth history — a rising trend that crosses the SR 2M milestone.
  const nwSeed = [1620000, 1710000, 1795000, 1880000, 1948000, 2020000, 2088000, 2150000, 2214000]
  nwSeed.forEach((value, i) => {
    const dt = new Date(); dt.setMonth(dt.getMonth() - (nwSeed.length - i))
    const month = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`
    S('networth', { month, value, assets: value + 1400000, liabilities: 1400000 })
  })

  // Appointments / health calendar (personIds wired after people are seeded below)
  const apptSeed = [
    { title: 'Pediatric check-up', type: 'checkup', who: 'Omar', date: d(4), time: '16:30', location: 'Dr. Sami Clinic, Riyadh' },
    { title: 'Dental cleaning', type: 'dentist', who: 'Layla', date: d(9), time: '11:00', location: 'Smile Dental' },
    { title: 'Annual physical', type: 'doctor', who: '', date: d(20), time: '09:00', location: 'Dr. Soliman Fakeeh Hospital' },
    { title: 'School parents evening', type: 'school', who: 'Noura', date: d(2), time: '18:00', location: 'British International School' },
  ]

  // Savings goals
  S('goals', { name: 'Hajj fund', target: 60000, saved: 38000, currency: 'SAR', targetDate: d(150), icon: 'sparkle', note: 'For the whole family' })
  S('goals', { name: 'Maldives family trip', target: 60000, saved: 12000, currency: 'SAR', targetDate: d(300), icon: 'trip' })
  S('goals', { name: 'Emergency buffer', target: 200000, saved: 200000, currency: 'SAR', icon: 'shield', note: '6 months of expenses — done' })

  // Subscriptions / recurring bills
  S('subscriptions', { name: 'Netflix', amount: 56, currency: 'SAR', cycle: 'monthly', category: 'subscriptions', method: 'credit', nextDue: d(3), active: true })
  S('subscriptions', { name: 'iCloud+', amount: 11.99, currency: 'SAR', cycle: 'monthly', category: 'subscriptions', method: 'apple_pay', nextDue: d(12), active: true })
  S('subscriptions', { name: 'Car insurance', amount: 4200, currency: 'SAR', cycle: 'yearly', category: 'insurance', method: 'transfer', nextDue: d(38), active: true })

  // Rewards store (redeem chore points)
  S('rewards', { name: 'Extra hour of screen time', cost: 10 })
  S('rewards', { name: 'Choose the weekend outing', cost: 25 })
  S('rewards', { name: 'New Lego set', cost: 50 })

  // A trip with a budget and linked expenses
  const trip = S('trips', { name: 'AlUla Family Trip', destination: 'AlUla', start: d(20), end: d(24), budget: 15000, vehicleId: vAlmas.id });
  [
    { amount: 3200, category: 'hotels', merchant: 'Habitas AlUla', method: 'credit', date: d(20), tripId: trip.id, classification: 'personal' },
    { amount: 850, category: 'dining', merchant: 'Local restaurant', method: 'credit', date: d(21), tripId: trip.id, classification: 'personal' },
    { amount: 1200, category: 'entertainment', merchant: 'Desert tour', method: 'credit', date: d(22), tripId: trip.id, classification: 'personal' },
  ].forEach(e => S('expenses', e));
  // Trip itinerary + packing to demonstrate the planner.
  [
    { date: d(20), time: '14:00', title: 'Check in — Habitas AlUla', note: 'Confirmation #AL-8842' },
    { date: d(20), time: '19:30', title: 'Dinner at the resort' },
    { date: d(21), time: '08:00', title: 'Hegra guided tour', note: 'Meet at reception' },
    { date: d(22), time: '16:00', title: 'Desert 4x4 & sunset', note: 'Bring jackets' },
    { date: d(24), time: '11:00', title: 'Check out & drive back' },
  ].forEach(x => S('itinerary', { ...x, tripId: trip.id }))
  db.update('trips', trip.id, { packing: [
    { id: 'pk1', text: 'Passports & IDs', done: true },
    { id: 'pk2', text: 'Chargers', done: false },
    { id: 'pk3', text: 'Sunscreen & hats', done: false },
    { id: 'pk4', text: 'Kids’ medication', done: false },
  ] })
  const proj = S('projects', { name: 'House Renovation', budget: 60000, note: 'Villa upgrade' });
  [
    { amount: 12500, category: 'household', merchant: 'IKEA', method: 'credit', date: d(-5), projectId: proj.id, classification: 'personal' },
    { amount: 8400, category: 'custom:Landscaping', merchant: 'Green Oasis', method: 'transfer', date: d(-10), projectId: proj.id, classification: 'personal' },
    { amount: 3200, category: 'shopping', merchant: 'Home Centre', method: 'credit', date: d(-2), projectId: proj.id, classification: 'personal' },
  ].forEach(e => S('expenses', e))

  const people = [
    { name: 'Layla', relationship: 'family', jobTitle: 'Spouse', mobile: '+966500000010', whatsapp: '+966500000010', birthday: d(40), anniversary: d(23), bloodType: 'A+', healthInsurer: 'Bupa Arabia', healthPolicy: 'BUP-8842', passportNumber: 'K1234567', passportExpiry: d(75), nationalId: '1088xxxxxx', iqamaExpiry: '' },
    { name: 'Omar', relationship: 'family', jobTitle: 'Son', mobile: '+966500000011', whatsapp: '+966500000011', birthday: d(9), bloodType: 'O+', allergies: 'Peanuts', doctor: 'Dr. Sami (Pediatrics)', passportNumber: 'K2345678', passportExpiry: d(18) },
    { name: 'Noura', relationship: 'family', jobTitle: 'Daughter', mobile: '+966500000012', whatsapp: '+966500000012', birthday: d(120), bloodType: 'A-', passportExpiry: d(-12) },
    { name: 'Khalid Al-Otaibi', jobTitle: 'CFO', company: 'Group Finance', relationship: 'colleague', mobile: '+966500000001', whatsapp: '+966500000001', keepInTouchDays: 30, lastContacted: d(-45) },
    { name: 'Ahmed Al-Sayed', jobTitle: 'Partner', company: 'Al-Sayed Legal', relationship: 'supplier', mobile: '+966500000002', whatsapp: '+966500000002', keepInTouchDays: 90, lastContacted: d(-20) },
    { name: 'Sara Al-Nasser', jobTitle: 'Executive Assistant', company: 'Office', relationship: 'report', mobile: '+966500000003' },
  ]
  // Contact groups
  const gFamily = S('groups', { name: 'Family', icon: 'people' })
  const gFriends = S('groups', { name: 'Friends', icon: 'sparkle' })
  const gWork = S('groups', { name: 'Work', icon: 'flag' })
  const groupFor = (rel) => rel === 'family' ? [gFamily.id] : ['colleague', 'report', 'manager'].includes(rel) ? [gWork.id] : []
  const savedPeople = people.map(p => S('people', { ...p, groupIds: groupFor(p.relationship) }))
  // Now that people exist, seed appointments linked to them by name.
  const personIdByName = (nm) => (savedPeople.find(p => p.name === nm) || {}).id || ''
  apptSeed.forEach(a => S('appointments', { title: a.title, type: a.type, personId: personIdByName(a.who), date: a.date, time: a.time, location: a.location }))
  // A couple of family-assigned tasks to demonstrate delegation.
  const layla = savedPeople[0], omar = savedPeople[1]
  S('tasks', { title: 'Pick up the AlUla trip documents', type: 'request', classification: 'personal', priority: 'high', status: 'waiting_someone', dueDate: todayISO(), assigneeId: layla.id, assignedTo: layla.name })
  S('tasks', { title: 'Finish school project & email teacher', type: 'request', classification: 'personal', priority: 'medium', status: 'waiting_someone', dueDate: d(2), assigneeId: omar.id, assignedTo: omar.name })

  S('memberships', { name: 'Saudia AlFursan', category: 'airline', number: 'SV 1234567', tier: 'Gold' })
  S('memberships', { name: 'Hilton Honors', category: 'hotel', number: '600123456', tier: 'Diamond' })
  S('memberships', { name: 'Fitness Time', category: 'gym', number: 'FT-99213', expiry: d(160) })

  S('notes', { text: 'Reminder: renew boat registration before the summer season.' })

  db.markSeeded()
}
