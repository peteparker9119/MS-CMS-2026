import client from './client';

const p = (params) => ({ params });

export const getMeetings    = (params) => client.get('/meetings/', p(params)).then((r) => r.data.results ?? r.data);
export const createMeeting  = (data)   => client.post('/meetings/', data).then((r) => r.data);
export const updateMeeting  = (id, data) => client.patch(`/meetings/${id}/`, data).then((r) => r.data);
export const deleteMeeting  = (id)     => client.delete(`/meetings/${id}/`);

export const getMinutes     = (id)     => client.get(`/meetings/${id}/minutes/`).then((r) => r.data);
export const submitMinutes  = (id, data) => client.post(`/meetings/${id}/minutes/`, data).then((r) => r.data);
export const recordNotHeld  = (id, data) => client.patch(`/meetings/${id}/not-held/`, data).then((r) => r.data);

export const getActionPoints = (params) => client.get('/action-points/', p(params)).then((r) => r.data.results ?? r.data);
export const updateActionPoint = (id, data) => client.patch(`/action-points/${id}/`, data).then((r) => r.data);
export const addComment     = (id, text) => client.post(`/action-points/${id}/comments/`, { text }).then((r) => r.data);

export const getDashboardStats  = (params) => client.get('/dashboard/stats/', p(params)).then((r) => r.data);
export const getDashboardMatrix = (params) => client.get('/dashboard/matrix/', p(params)).then((r) => r.data);
