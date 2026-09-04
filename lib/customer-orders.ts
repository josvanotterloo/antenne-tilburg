import { mkdir, readFile, writeFile } from "fs/promises";
import { dirname, join } from "path";

// Operational data, not source code — gitignored (see .gitignore), created on
// first read/write. No DB model for this: it's free-form staff notes, not a
// managed entity.
export const CUSTOMER_ORDERS_PATH = join(
  process.cwd(),
  "data",
  "customer-orders.md",
);

export const DEFAULT_CUSTOMER_ORDERS_CONTENT = `## Customer Orders
<!-- Add customer orders below. Format:
## Customer Name — contact
- [ ] Artist - Title (Label) — IN STOCK / BACKORDER — notes
- [x] Artist - Title (Label) — fulfilled note
-->
`;

export async function readCustomerOrders(): Promise<string> {
  try {
    return await readFile(CUSTOMER_ORDERS_PATH, "utf-8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return DEFAULT_CUSTOMER_ORDERS_CONTENT;
    }
    throw err;
  }
}

export async function writeCustomerOrders(content: string): Promise<void> {
  await mkdir(dirname(CUSTOMER_ORDERS_PATH), { recursive: true });
  await writeFile(CUSTOMER_ORDERS_PATH, content, "utf-8");
}
