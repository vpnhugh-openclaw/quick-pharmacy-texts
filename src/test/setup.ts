import "@testing-library/jest-dom";

const localStorageStore = new Map<string, string>();

Object.defineProperty(globalThis, 'localStorage', {
  writable: true,
  value: {
    getItem: (key: string) => localStorageStore.get(key) ?? null,
    setItem: (key: string, value: string) => {
      localStorageStore.set(key, String(value));
    },
    removeItem: (key: string) => {
      localStorageStore.delete(key);
    },
    clear: () => {
      localStorageStore.clear();
    },
    key: (index: number) => Array.from(localStorageStore.keys())[index] ?? null,
    get length() {
      return localStorageStore.size;
    },
  },
});

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});
