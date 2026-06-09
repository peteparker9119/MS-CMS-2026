import client from './client';

export const getUnits = () => client.get('/units/').then((r) => r.data.results ?? r.data);
export const getPairs = () => client.get('/pairs/').then((r) => r.data.results ?? r.data);
