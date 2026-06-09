import client from './client';

export const login = (username, password) =>
  client.post('/auth/login/', { username, password }).then((r) => r.data);

export const getMe = () =>
  client.get('/auth/me/').then((r) => r.data);

export const logoutApi = () => {
  const refresh = localStorage.getItem('refresh_token');
  return client.post('/auth/logout/', { refresh }).catch(() => {});
};
