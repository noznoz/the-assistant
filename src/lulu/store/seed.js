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
    { amount: 450, category: 'moto_acc', merchant: 'Touratech', method: 'credit', date: todayISO(), classification: 'personal', relatedVehicle: vRaven.id, note: 'Crash bars + tank bag' },
    { amount: 280, category: 'fuel', merchant: 'Aramco', method: 'apple_pay', date: todayISO(), relatedVehicle: vAlmas.id, liters: 62, odometer: 24800 },
    { amount: 265, category: 'fuel', merchant: 'Aramco', method: 'apple_pay', date: d(-14), relatedVehicle: vAlmas.id, liters: 58, odometer: 24240 },
    { amount: 275, category: 'fuel', merchant: 'Sasco', method: 'apple_pay', date: d(-27), relatedVehicle: vAlmas.id, liters: 60, odometer: 23700 },
    { amount: 1450, category: 'vehicle_maint', merchant: 'BMW Motorrad', method: 'credit', date: d(-15), relatedVehicle: vRaven.id },
    { amount: 3200, category: 'vehicle_maint', merchant: 'Land Rover Riyadh', method: 'company', date: d(-40), relatedVehicle: vAlmas.id },
    { amount: 620, category: 'dining', merchant: 'Myazu', method: 'credit', date: d(-2), classification: 'personal' },
    { amount: 190, category: 'groceries', merchant: 'Danube', method: 'apple_pay', date: d(-3) },
    { amount: 2400, category: 'marina', merchant: 'Jeddah Yacht Club', method: 'transfer', date: d(-6), relatedVehicle: vBoat.id },
  ]
  exp.forEach(e => db.insert('expenses', e))

  const people = [
    { name: 'Layla', relationship: 'family', jobTitle: 'Spouse', mobile: '+966500000010', whatsapp: '+966500000010' },
    { name: 'Omar', relationship: 'family', jobTitle: 'Son', mobile: '+966500000011', whatsapp: '+966500000011' },
    { name: 'Noura', relationship: 'family', jobTitle: 'Daughter', mobile: '+966500000012', whatsapp: '+966500000012' },
    { name: 'Khalid Al-Otaibi', jobTitle: 'CFO', company: 'Group Finance', relationship: 'colleague', mobile: '+966500000001' },
    { name: 'Ahmed Al-Sayed', jobTitle: 'Partner', company: 'Al-Sayed Legal', relationship: 'supplier', mobile: '+966500000002' },
    { name: 'Sara Al-Nasser', jobTitle: 'Executive Assistant', company: 'Office', relationship: 'report', mobile: '+966500000003' },
  ]
  const savedPeople = people.map(p => db.insert('people', p))
  // A couple of family-assigned tasks to demonstrate delegation.
  const layla = savedPeople[0], omar = savedPeople[1]
  db.insert('tasks', { title: 'Pick up the AlUla trip documents', type: 'request', classification: 'personal', priority: 'high', status: 'waiting_someone', dueDate: todayISO(), assigneeId: layla.id, assignedTo: layla.name })
  db.insert('tasks', { title: 'Finish school project & email teacher', type: 'request', classification: 'personal', priority: 'medium', status: 'waiting_someone', dueDate: d(2), assigneeId: omar.id, assignedTo: omar.name })

  db.insert('notes', { text: 'Reminder: renew boat registration before the summer season.' })

  db.markSeeded()
}
