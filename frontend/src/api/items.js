import client from './client';

const p = (params) => ({ params });

export const getItems         = (params)         => client.get('/items/', p(params)).then((r) => r.data.results ?? r.data);
export const createItem       = (data)           => client.post('/items/', data).then((r) => r.data);
export const updateItem       = (id, data)       => client.patch(`/items/${id}/`, data).then((r) => r.data);
export const setItemStatus    = (id, status)     => client.patch(`/items/${id}/status/`, { status }).then((r) => r.data);
export const addActionItem    = (id, text)       => client.post(`/items/${id}/action-items/`, { text }).then((r) => r.data);
export const toggleActionItem = (itemId, aidPk)  => client.patch(`/items/${itemId}/action-items/${aidPk}/`).then((r) => r.data);
export const getItemSLAHistory  = (id)           => client.get(`/items/${id}/sla-history/`).then((r) => r.data);
export const getUsersByUnits    = (unitIds)      => client.get('/auth/users-by-units/', { params: { unit_ids: unitIds } }).then((r) => r.data);
export const askItemStatus      = (id, note='') => client.post(`/action-points/${id}/ask-status/`, { note }).then(r => r.data);
