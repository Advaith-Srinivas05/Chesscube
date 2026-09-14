import { api } from './api.js';

const name = (username) => encodeURIComponent(username);

export const friendsApi = {
  list: (options) => api.get('/friends', options),
  // → { status: 'pending', request } or { status: 'accepted', friend } when they had already asked you
  sendRequest: (username) => api.post('/friends/requests', { username }),
  accept: (requestId) => api.post(`/friends/requests/${requestId}/accept`),
  // Declines an incoming request or cancels an outgoing one.
  removeRequest: (requestId) => api.delete(`/friends/requests/${requestId}`),
  unfriend: (username) => api.delete(`/friends/${name(username)}`),
  search: (q, options) => api.get(`/users/search?${new URLSearchParams({ q })}`, options),
  preview: (username, options) => api.get(`/users/${name(username)}/friends`, options),
};
