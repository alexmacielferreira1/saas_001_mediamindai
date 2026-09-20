function projectPeople(project) {
  const value = project?.equipe || project?.responsaveis || project?.responsavel || [];
  return (Array.isArray(value) ? value : String(value).split(','))
    .map((name) => String(name).trim().toLowerCase())
    .filter(Boolean);
}

export function buildTeamRows(memberships, projects) {
  return memberships.map((membership) => {
    const name = membership.full_name || membership.email || '';
    const normalized = name.trim().toLowerCase();
    const assignedProjects = projects.filter((project) => projectPeople(project).includes(normalized));
    return {
      id: membership.id,
      name,
      email: membership.email || '',
      role: membership.role || 'user',
      assigned: assignedProjects.length,
      active: assignedProjects.filter((project) => project.etapa !== 'finalizado').length,
      completed: assignedProjects.filter((project) => project.etapa === 'finalizado').length,
    };
  });
}

export function buildSectorRows(memberships, projects) {
  const rows = new Map();
  buildTeamRows(memberships, projects).forEach((member) => {
    const current = rows.get(member.role) || { role: member.role, people: 0, assigned: 0, active: 0, completed: 0 };
    current.people += 1;
    current.assigned += member.assigned;
    current.active += member.active;
    current.completed += member.completed;
    rows.set(member.role, current);
  });
  return [...rows.values()];
}
