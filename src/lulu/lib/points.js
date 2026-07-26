// Chore points: completing an assigned task earns the person points
// (weighted by priority). Used to gamify family chores with a leaderboard.
export function pointsFor(task) {
  return { critical: 5, high: 3, medium: 2, low: 1 }[task && task.priority] ?? 2
}

export function awardPoints(person, delta, peopleApi) {
  if (!person || !delta) return
  const current = Number(person.points) || 0
  peopleApi.patch(person.id, { points: Math.max(0, current + delta) })
}
