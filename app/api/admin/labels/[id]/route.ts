import { db } from "@/lib/db";
import { itemHandlers, type ReferenceDelegate } from "@/lib/reference-crud";

export const { PATCH, DELETE } = itemHandlers(
  db.label as unknown as ReferenceDelegate,
);
