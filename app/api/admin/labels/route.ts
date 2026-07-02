import { db } from "@/lib/db";
import { collectionHandlers, type ReferenceDelegate } from "@/lib/reference-crud";

export const { GET, POST } = collectionHandlers(
  db.label as unknown as ReferenceDelegate,
);
