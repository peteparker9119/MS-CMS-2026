import client from './client';
const p = (params) => ({ params });

export const getTemplates    = (params) => client.get('/review-templates/', p(params)).then(r => r.data.results ?? r.data);
export const createTemplate  = (data)   => client.post('/review-templates/', data).then(r => r.data);

export const getReviewEntries   = (params) => client.get('/review-entries/', p(params)).then(r => r.data.results ?? r.data);
export const createReviewEntry  = (data)   => client.post('/review-entries/', data).then(r => r.data);

export const getReviewSummary   = () => client.get('/reviews/summary/').then(r => r.data);
