import {
  MOCK_ASSETS,
  MOCK_AUDIT_LOGS,
  MOCK_MONITORING,
  MOCK_PUBLICATION_CALENDAR,
  MOCK_PUBLICATION_SUMMARY,
  MOCK_SOCIAL_METRICS,
  MOCK_USERS,
} from '../data';

export const DEMO_MEMBERSHIPS = [
  {
    id: 'demo-superadmin-alex',
    email: 'alexmacielferreira@gmail.com',
    full_name: 'Alex Maciel Ferreira',
    role: 'superadmin',
    status: 'active',
    restricted_screens: [],
    extra_screens: [],
  },
  ...MOCK_USERS.map((user) => ({
    id: `demo-${user.id}`,
    email: user.email,
    full_name: user.name,
    role: user.role,
    status: user.status,
    restricted_screens: user.restricted_screens || [],
    extra_screens: [],
  })),
];

export const DEMO_MANAGEMENT_OVERVIEW = {
  publications: {
    published: MOCK_PUBLICATION_SUMMARY.total_published,
    scheduled: MOCK_PUBLICATION_SUMMARY.total_scheduled,
    pending: MOCK_PUBLICATION_SUMMARY.total_pending,
    approval_rate: MOCK_PUBLICATION_SUMMARY.avg_approval_rate,
    calendar: MOCK_PUBLICATION_CALENDAR.map((item, index) => ({
      id: `demo-publication-${index + 1}`,
      ...item,
      date: item.date.includes('/') ? `2026-09-${item.date.slice(0, 2)}` : item.date,
    })),
  },
  social_metrics: MOCK_SOCIAL_METRICS,
  assets: {
    total: 14808,
    indexed: 14291,
    failures: 12,
    storage_bytes: MOCK_ASSETS.reduce((total, asset) => total + Number(asset.file_size || 0), 0),
  },
  processing: {
    total: MOCK_MONITORING.processing + MOCK_MONITORING.completed + MOCK_MONITORING.failed,
    active: MOCK_MONITORING.processing,
    completed: MOCK_MONITORING.completed,
    failed: MOCK_MONITORING.failed,
  },
  audit_events: MOCK_AUDIT_LOGS.length,
  services: MOCK_MONITORING.services,
};

export const DEMO_ASSETS = MOCK_ASSETS;

export const DEMO_AUDIT_LOGS = MOCK_AUDIT_LOGS.map((log, index) => ({
  ...log,
  entity_type: log.asset,
  created_date: new Date(Date.UTC(2026, 8, 20 - index, 12, index * 7)).toISOString(),
}));

export async function withDemoFallback(request, fallback) {
  try {
    const result = await request();
    return Array.isArray(result) && result.length === 0 ? fallback : result;
  } catch {
    return fallback;
  }
}
