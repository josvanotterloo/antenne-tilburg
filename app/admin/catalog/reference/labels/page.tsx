import { ReferenceDataView } from "../ReferenceDataView";

export const dynamic = "force-dynamic";

export default async function LabelsReferencePage() {
  return ReferenceDataView({ focusSection: "labels" });
}
