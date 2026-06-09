import client from './client';
const p = params => ({ params });
export const getNotifications      = (params)           => client.get('/notifications/', p(params)).then(r => r.data.results ?? r.data);
export const markRead              = (id)               => client.patch(`/notifications/${id}/read/`).then(r => r.data);
export const markAllRead           = ()                 => client.post('/notifications/mark-all-read/').then(r => r.data);
export const respondToNotification = (id, response)     => client.post(`/notifications/${id}/respond/`, { response }).then(r => r.data);
