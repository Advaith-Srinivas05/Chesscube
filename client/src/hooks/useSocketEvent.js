import { useEffect, useRef } from 'react';
import { socket } from '../lib/socket.js';

// Subscribes to a server event for the component's lifetime, always calling the latest handler.
export default function useSocketEvent(event, handler) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    const listener = (...args) => handlerRef.current(...args);
    socket.on(event, listener);
    return () => socket.off(event, listener);
  }, [event]);
}
