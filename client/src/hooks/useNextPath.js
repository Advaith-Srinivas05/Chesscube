import { useSearchParams } from 'react-router-dom';

// Only same-site paths, so ?next= can't send people to another website.
export function safeNext(value) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) {
    return '/';
  }
  return value;
}

export function useNextPath() {
  const [params] = useSearchParams();
  return safeNext(params.get('next'));
}

// Appends ?next= (or &next=) when there's somewhere to return to.
export function withNext(path, next) {
  if (!next || next === '/') return path;
  return `${path}${path.includes('?') ? '&' : '?'}next=${encodeURIComponent(next)}`;
}
