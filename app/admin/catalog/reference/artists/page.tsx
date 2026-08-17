import { ReferenceDataView } from "../ReferenceDataView";

export const dynamic = "force-dynamic";

export default async function ArtistsReferencePage() {
  return ReferenceDataView({ focusSection: "artists" });
}
