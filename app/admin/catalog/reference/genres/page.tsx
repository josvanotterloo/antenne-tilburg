import { ReferenceDataView } from "../ReferenceDataView";

export const dynamic = "force-dynamic";

export default async function GenresReferencePage() {
  return ReferenceDataView({ focusSection: "genres" });
}
