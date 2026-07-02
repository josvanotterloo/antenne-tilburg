import { db } from "@/lib/db";
import { collectionHandlers, type ReferenceDelegate } from "@/lib/reference-crud";

export const { GET, POST } = collectionHandlers(
  db.productType as unknown as ReferenceDelegate,
);
