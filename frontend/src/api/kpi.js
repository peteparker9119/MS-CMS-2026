import client from './client';
const p = (params) => ({ params });

export const getKPIs      = (params) => client.get('/kpis/', p(params)).then(r => r.data.results ?? r.data);
export const createKPI    = (data)   => client.post('/kpis/', data).then(r => r.data);
export const updateKPI    = (id, data) => client.patch(`/kpis/${id}/`, data).then(r => r.data);

export const getKPIEntries  = (params) => client.get('/kpi-entries/', p(params)).then(r => r.data.results ?? r.data);
export const createKPIEntry = (data)   => client.post('/kpi-entries/', data).then(r => r.data);

export const getKPISummary  = () => client.get('/kpi-summary/').then(r => r.data);
