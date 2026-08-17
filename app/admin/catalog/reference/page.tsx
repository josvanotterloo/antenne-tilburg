import { ReferenceDataView } from "./ReferenceDataView";

// Reads live reference data; never prerender at build time.
export const dynamic = "force-dynamic";

export default async function ReferenceDataPage() {
  return ReferenceDataView({});
}
