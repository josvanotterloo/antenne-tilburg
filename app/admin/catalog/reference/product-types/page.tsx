import { ReferenceDataView } from "../ReferenceDataView";

export const dynamic = "force-dynamic";

export default async function ProductTypesReferencePage() {
  return ReferenceDataView({ focusSection: "product-types" });
}
