import client from './client';

export const getTasks       = ()       => client.get('/taskboard/tasks/').then(r => r.data.results ?? r.data);
export const createTask     = (data)   => client.post('/taskboard/tasks/', data).then(r => r.data);
export const updateTask     = (id, d)  => client.patch(`/taskboard/tasks/${id}/`, d).then(r => r.data);
export const deleteTask     = (id)     => client.delete(`/taskboard/tasks/${id}/`);

export const getAssignments = (params) => client.get('/taskboard/assignments/', { params }).then(r => r.data.results ?? r.data);
export const createAssignment = (data) => client.post('/taskboard/assignments/', data).then(r => r.data);
export const updateAssignment = (id, d)=> client.patch(`/taskboard/assignments/${id}/`, d).then(r => r.data);
export const deleteAssignment = (id)   => client.delete(`/taskboard/assignments/${id}/`);
export const addActivity    = (id, d)  => client.post(`/taskboard/assignments/${id}/activities/`, d).then(r => r.data);

export const getBoardUsers  = ()       => client.get('/taskboard/users/').then(r => r.data.results ?? r.data);
