export const DEMO_DATASET = 'demo_seed_v1';

const marker = Object.freeze({ is_demo: true, demo_dataset: DEMO_DATASET });

const users = Object.freeze([
  Object.freeze({ ...marker, id: 'demo-user-admin', full_name: 'Administrador Demo', email: 'admin.demo@mediamind.invalid', tenant_role: 'Administrador', profile_name: 'Administrador', profile_id: 'demo-profile-admin', status: 'active' }),
  Object.freeze({ ...marker, id: 'demo-user-editor', full_name: 'Editora Demo', email: 'editora.demo@mediamind.invalid', tenant_role: 'Produtora', profile_name: 'Editor', profile_id: 'demo-profile-editor', status: 'active' }),
  Object.freeze({ ...marker, id: 'demo-user-reviewer', full_name: 'Revisor Demo', email: 'revisor.demo@mediamind.invalid', tenant_role: 'Revisor', profile_name: 'Revisor', profile_id: 'demo-profile-reviewer', status: 'invited' }),
  Object.freeze({ ...marker, id: 'demo-user-viewer', full_name: 'Consulta Demo', email: 'consulta.demo@mediamind.invalid', tenant_role: 'Consulta', profile_name: 'Visualizador', profile_id: 'demo-profile-viewer', status: 'suspended' }),
]);

const groups = Object.freeze([
  Object.freeze({ ...marker, id: 'demo-profile-admin', name: 'Administrador', description: 'Acesso total no ambiente demonstrativo.', is_active: true, permission_codes: Object.freeze(['admin.manage', 'users.manage', 'archive.manage', 'production.approve']) }),
  Object.freeze({ ...marker, id: 'demo-profile-editor', name: 'Editor Broadcast', description: 'Edição e finalização no ambiente demonstrativo.', is_active: true, permission_codes: Object.freeze(['production.view', 'production.edit', 'archive.view']) }),
  Object.freeze({ ...marker, id: 'demo-profile-reviewer', name: 'Revisor', description: 'Revisão e aprovação no ambiente demonstrativo.', is_active: true, permission_codes: Object.freeze(['production.view', 'production.approve']) }),
  Object.freeze({ ...marker, id: 'demo-profile-viewer', name: 'Visualizador', description: 'Consulta no ambiente demonstrativo.', is_active: true, permission_codes: Object.freeze(['production.view', 'archive.view']) }),
]);

export function getDemoUsers() {
  return users.map((user) => ({ ...user }));
}

export function getDemoPermissionGroups() {
  return groups.map((group) => ({ ...group, permission_codes: [...group.permission_codes] }));
}

export function isDemoRecord(record) {
  return record?.is_demo === true && record?.demo_dataset === DEMO_DATASET;
}
