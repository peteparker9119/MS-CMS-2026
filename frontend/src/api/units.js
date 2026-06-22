import client from './client';

export const getUnits = () => client.get('/units/').then((r) => r.data.results ?? r.data);
export const getPairs = () => client.get('/pairs/').then((r) => r.data.results ?? r.data);
export const createUnit  = (data)      => client.post('/units/', data).then(r => r.data);
export const updateUnit  = (id, data)  => client.patch(`/units/${id}/`, data).then(r => r.data);
export const deleteUnit  = (id)        => client.delete(`/units/${id}/`);
export const getUsersByUnits = (unitIds) => {
  const qs = [].concat(unitIds).map(id => `unit_ids=${id}`).join('&');
  return client.get(`/auth/users-by-units/?${qs}`).then((r) => r.data);
};
