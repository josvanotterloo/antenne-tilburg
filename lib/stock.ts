// Selling one unit: decrement quantity, floored at 0, with inStock kept in sync.
export function sellOne(quantity: number): {
  quantity: number;
  inStock: boolean;
} {
  const next = Math.max(0, quantity - 1);
  return { quantity: next, inStock: next > 0 };
}
