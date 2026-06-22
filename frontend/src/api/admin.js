import client from './client';

export const getUsers      = ()          => client.get('/auth/users/').then(r => r.data);
export const createUser    = (data)      => client.post('/auth/users/create/', data).then(r => r.data);
export const updateUser    = (id, data)  => client.patch(`/auth/users/${id}/`, data).then(r => r.data);
export const deleteUser    = (id)        => client.delete(`/auth/users/${id}/delete/`);

// Custom menus
export const getCustomMenus  = ()         => client.get('/custom-menus/').then(r => r.data.results ?? r.data);
export const createCustomMenu= (data)     => client.post('/custom-menus/', data).then(r => r.data);
export const updateCustomMenu= (id, data) => client.patch(`/custom-menus/${id}/`, data).then(r => r.data);
export const deleteCustomMenu= (id)       => client.delete(`/custom-menus/${id}/`);

// Menu entries (submissions)
export const getMenuEntries  = (menuId)        => client.get(`/custom-menus/${menuId}/entries/`).then(r => r.data);
export const createMenuEntry = (menuId, data)  => client.post(`/custom-menus/${menuId}/entries/`, { data }).then(r => r.data);
