import { request } from './httpClient';

export function getManagementOverview() {
  return request('/management/overview');
}
