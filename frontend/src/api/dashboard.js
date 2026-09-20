import { request } from './httpClient';

export function getMyDashboard() {
  return request('/dashboard/me');
}
