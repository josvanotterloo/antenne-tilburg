import "@testing-library/jest-dom/vitest";

// Ensure localStorage is available in jsdom test environment
if (typeof window !== "undefined" && !window.localStorage) {
  const store: Record<string, string> = {};
  const mockLocalStorage = {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = String(value);
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      for (const key in store) {
        delete store[key];
      }
    },
    key: (index: number) => {
      const keys = Object.keys(store);
      return keys[index] || null;
    },
    length: 0,
  };
  Object.defineProperty(mockLocalStorage, "length", {
    get: () => Object.keys(store).length,
  });
  Object.defineProperty(window, "localStorage", {
    value: mockLocalStorage,
  });
}
