import { useEffect, useSyncExternalStore } from 'react';
import { getSocketState, retainSocket, socket, subscribeSocketState } from '../lib/socket.js';

export function useSocketState() {
  return useSyncExternalStore(subscribeSocketState, getSocketState);
}

// Keeps the game server connection open while the component is mounted.
export default function useSocket() {
  useEffect(() => retainSocket(), []);
  const state = useSocketState();
  return { socket, ...state, connected: state.status === 'connected' };
}
