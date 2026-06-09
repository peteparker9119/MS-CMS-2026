import client from './client';
const p = (params) => ({ params });

export const getGanttTasks   = (params) => client.get('/gantt/', p(params)).then(r => r.data.results ?? r.data);
export const createGanttTask = (data)   => client.post('/gantt/', data).then(r => r.data);
export const updateGanttTask = (id, data) => client.patch(`/gantt/${id}/`, data).then(r => r.data);
export const deleteGanttTask = (id)     => client.delete(`/gantt/${id}/`).then(r => r.data);
