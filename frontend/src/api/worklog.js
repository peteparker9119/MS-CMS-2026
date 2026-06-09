import client from './client';
const p = (params) => ({ params });

export const getTasks   = (params) => client.get('/tasks/', p(params)).then(r => r.data.results ?? r.data);
export const createTask = (data)   => client.post('/tasks/', data).then(r => r.data);
export const updateTask     = (id, data)             => client.patch(`/tasks/${id}/`, data).then(r => r.data);
export const transitionTask = (id, status, hours_taken) =>
  client.patch(`/tasks/${id}/transition/`, { status, ...(hours_taken !== undefined ? { hours_taken } : {}) }).then(r => r.data);

export const logEntry   = (id, data) => client.post(`/tasks/${id}/entries/`, data).then(r => r.data);
export const addComment = (id, data) => client.post(`/tasks/${id}/comments/`, data).then(r => r.data);

export const getWorkSummary = () => client.get('/tasks/summary/').then(r => r.data);
