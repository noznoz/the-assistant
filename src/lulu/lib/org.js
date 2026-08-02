// Reporting-hierarchy helpers over the flat members list.

// All descendants (direct + indirect reports) of a member within their team.
export function teamSize(memberId, members = []) {
  const direct = members.filter(m => m.reportsToId === memberId)
  return direct.reduce((n, d) => n + 1 + teamSize(d.id, members), 0)
}

// Direct reports of a member.
export function directReports(memberId, members = []) {
  return members.filter(m => m.reportsToId === memberId)
}

// Normalised list of assigned member ids for a work task. Supports the new
// multi-assignee `memberIds` array while staying backward-compatible with the
// legacy single `memberId` field.
export function taskMemberIds(task = {}) {
  if (Array.isArray(task.memberIds) && task.memberIds.length) return task.memberIds
  return task.memberId ? [task.memberId] : []
}

// Human summary of who a task is assigned to. Collapses to "Whole <Dept>" when
// every current member of a department is included; otherwise lists names, and
// spans departments freely.
export function assigneeSummary(task, allMembers = [], departments = []) {
  const ids = taskMemberIds(task)
  if (!ids.length) return ''
  const chosen = allMembers.filter(m => ids.includes(m.id))
  const parts = []
  const covered = new Set()
  for (const dep of departments) {
    const depMembers = allMembers.filter(m => m.departmentId === dep.id)
    if (depMembers.length && depMembers.every(m => ids.includes(m.id))) {
      parts.push(dep.name)
      depMembers.forEach(m => covered.add(m.id))
    }
  }
  const leftover = chosen.filter(m => !covered.has(m.id)).map(m => m.name)
  return [...parts, ...leftover].join(', ')
}

// Top-of-tree members for a department: the head, plus anyone with no manager
// (or a manager outside the team) who isn't the head.
export function deptRoots(dep, members = []) {
  const team = members.filter(m => m.departmentId === dep.id)
  const head = team.find(m => m.id === dep.headId)
  const orphans = team.filter(m => m.id !== dep.headId && (!m.reportsToId || !team.some(x => x.id === m.reportsToId)))
  return { head, orphans, team }
}
