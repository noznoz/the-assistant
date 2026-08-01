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

// Top-of-tree members for a department: the head, plus anyone with no manager
// (or a manager outside the team) who isn't the head.
export function deptRoots(dep, members = []) {
  const team = members.filter(m => m.departmentId === dep.id)
  const head = team.find(m => m.id === dep.headId)
  const orphans = team.filter(m => m.id !== dep.headId && (!m.reportsToId || !team.some(x => x.id === m.reportsToId)))
  return { head, orphans, team }
}
