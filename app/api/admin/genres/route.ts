import { db } from "@/lib/db";
import { collectionHandlers, type ReferenceDelegate } from "@/lib/reference-crud";

export const { GET, POST } = collectionHandlers(
  db.genre as unknown as ReferenceDelegate,
);
