export class ApiError extends Error {
  constructor({ status, message, code, field }) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.field = field;
  }
}

async function request(method, path, { body, signal } = {}) {
  let res;
  try {
    res = await fetch('/api' + path, {
      method,
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    throw new ApiError({ status: 0, message: 'Cannot reach the server' });
  }

  const text = await res.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }

  if (!res.ok) {
    throw new ApiError({
      status: res.status,
      message: data?.message ?? `Request failed (${res.status})`,
      code: data?.code,
      field: data?.field,
    });
  }
  return data;
}

export const api = {
  get: (path, { signal } = {}) => request('GET', path, { signal }),
  post: (path, body, { signal } = {}) => request('POST', path, { body, signal }),
  patch: (path, body, { signal } = {}) => request('PATCH', path, { body, signal }),
  delete: (path, body, { signal } = {}) => request('DELETE', path, { body, signal }),
};
