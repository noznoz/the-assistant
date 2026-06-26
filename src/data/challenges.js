// Award trophies riders can pick from when creating a challenge
export const TROPHIES = ['🏆', '🥇', '🎖️', '🏅', '👑', '🔥', '💀', '⚡', '🦅', '🐍', '🛞', '🍺']

// Challenge participation status: invited → joined → awarded
export const INITIAL_CHALLENGES = [
  {
    id: 1,
    title: 'Mile Crusher — June',
    description: 'Most miles logged in the month of June. Post your odometer at the start and end. Highest total takes the trophy.',
    creator: 'Big Mike',
    awardType: 'trophy',
    trophy: '👑',
    bannerImage: null,
    prizeName: 'King of the Road',
    deadline: 'Jun 30, 2026',
    status: 'open',
    participants: [
      { riderName: 'Big Mike', status: 'joined' },
      { riderName: 'Diesel Dave', status: 'joined' },
      { riderName: 'RedRock Ray', status: 'joined' },
      { riderName: 'Steel Lisa', status: 'invited' },
    ],
  },
  {
    id: 2,
    title: 'Best Build Showdown',
    description: 'Show off your latest wrenching. Photo of your bike + the mods. Creator judges the cleanest build.',
    creator: 'Steel Lisa',
    awardType: 'trophy',
    trophy: '🔧',
    bannerImage: null,
    prizeName: 'Golden Wrench',
    deadline: 'Jul 15, 2026',
    status: 'open',
    participants: [
      { riderName: 'Steel Lisa', status: 'joined' },
      { riderName: 'Iron Nate', status: 'joined' },
    ],
  },
  {
    id: 3,
    title: 'Sunrise 100',
    description: 'Ride 100 miles before sunrise and post a photo with a timestamp. First five to finish earn the patch.',
    creator: 'RedRock Ray',
    awardType: 'trophy',
    trophy: '🦅',
    bannerImage: null,
    prizeName: 'Dawn Patrol Patch',
    deadline: 'Completed',
    status: 'closed',
    participants: [
      { riderName: 'RedRock Ray', status: 'awarded' },
      { riderName: 'Diesel Dave', status: 'awarded' },
      { riderName: 'Big Mike', status: 'joined' },
    ],
  },
]
