import client from './client';
const p = (params) => ({ params });

export const getLetters    = (params) => client.get('/do-letters/', p(params)).then(r => r.data.results ?? r.data);
export const uploadLetter  = (formData) =>
  client.post('/do-letters/', formData).then(r => r.data);
export const deleteLetter  = (id) => client.delete(`/do-letters/${id}/`).then(r => r.data);
export const updateLetter  = (id, data) => client.patch(`/do-letters/${id}/`, data).then(r => r.data);
