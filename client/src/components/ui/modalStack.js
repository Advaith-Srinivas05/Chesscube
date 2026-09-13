// Open modal <dialog> elements, newest last. A modal makes everything outside it inert, so the toast region
// renders inside the top one to stay clickable.
let stack = [];
const listeners = new Set();

function emit() {
  listeners.forEach((listener) => listener());
}

export function pushModal(element) {
  stack = [...stack, element];
  emit();
}

export function removeModal(element) {
  stack = stack.filter((item) => item !== element);
  emit();
}

export function subscribeModals(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function topModal() {
  return stack.at(-1) ?? null;
}
