import type { CatalogProduct } from "@/lib/catalog";

// DYMO Connect Framework XML for the 89x36mm label (part 99012), built as
// plain string templates — no DYMO SDK dependency. Visual fidelity is
// checked by hand: DYMO_MODE=preview serves this XML for the admin to
// paste into DYMO Connect Desktop.

const LABEL_WIDTH_TWIPS = 5040; // 89mm
const LABEL_HEIGHT_TWIPS = 2040; // 36mm

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

const CONDITION_LABEL: Record<CatalogProduct["condition"], string> = {
  NEW: "Nieuw",
  SECONDHAND: "Tweedehands",
};

function joinedArtistNames(product: CatalogProduct): string {
  return [...product.productArtists]
    .sort((a, b) => a.position - b.position)
    .map((pa) => pa.artist.name)
    .join(" / ");
}

interface TextSpec {
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  align: "Left" | "Center" | "Right";
  fontSize: number;
  bold: boolean;
  text: string;
  shrinkToFit?: boolean;
}

function textObject(spec: TextSpec): string {
  return `  <ObjectInfo>
    <TextObject>
      <Name>${spec.name}</Name>
      <ForeColor Alpha="255" Red="0" Green="0" Blue="0"/>
      <BackColor Alpha="0" Red="255" Green="255" Blue="255"/>
      <LinkedObjectName></LinkedObjectName>
      <Rotation>Rotation0</Rotation>
      <IsMirrored>False</IsMirrored>
      <IsVariable>False</IsVariable>
      <GroupID>-1</GroupID>
      <IsOutlined>False</IsOutlined>
      <HorizontalAlignment>${spec.align}</HorizontalAlignment>
      <VerticalAlignment>Middle</VerticalAlignment>
      <TextFitMode>${spec.shrinkToFit ? "ShrinkToFit" : "None"}</TextFitMode>
      <UseFullFontHeight>True</UseFullFontHeight>
      <Verticalized>False</Verticalized>
      <StyledText>
        <Element>
          <String>${escapeXml(spec.text)}</String>
          <Attributes>
            <Font Family="Helvetica" Size="${spec.fontSize}" Bold="${spec.bold ? "True" : "False"}" Italic="False" Underline="False" Strikeout="False"/>
            <ForeColor Alpha="255" Red="0" Green="0" Blue="0"/>
          </Attributes>
        </Element>
      </StyledText>
    </TextObject>
    <Bounds X="${spec.x}" Y="${spec.y}" Width="${spec.width}" Height="${spec.height}"/>
  </ObjectInfo>`;
}

// Row layout (twips), landscape 5040x2040 canvas — sums exactly:
// 60 (top margin) + 640 + 560 + 380 + 340 + 60 (bottom margin) = 2040.
export function generateLabelXml(product: CatalogProduct): string {
  const artistLine = joinedArtistNames(product).toUpperCase();
  const conditionLabel = CONDITION_LABEL[product.condition];
  const line3Right = [product.catalogNumber, product.productType.name, conditionLabel]
    .filter((v): v is string => Boolean(v))
    .join(" · ");
  const priceText = `€ ${Number(product.price).toFixed(2)}`;

  const objects = [
    textObject({
      name: "ARTIST", x: 80, y: 60, width: 4880, height: 640,
      align: "Left", fontSize: 16, bold: true, text: artistLine, shrinkToFit: true,
    }),
    textObject({
      name: "TITLE", x: 80, y: 700, width: 4880, height: 560,
      align: "Left", fontSize: 14, bold: true, text: product.title, shrinkToFit: true,
    }),
    textObject({
      name: "LABEL", x: 80, y: 1260, width: 2400, height: 380,
      align: "Left", fontSize: 9, bold: false, text: product.label.name,
    }),
    textObject({
      name: "CATINFO", x: 2560, y: 1260, width: 2400, height: 380,
      align: "Right", fontSize: 9, bold: false, text: line3Right,
    }),
    textObject({
      name: "GENRE", x: 80, y: 1640, width: 1600, height: 340,
      align: "Left", fontSize: 9, bold: false, text: product.genre.name,
    }),
    textObject({
      name: "BRAND", x: 1680, y: 1640, width: 1680, height: 340,
      align: "Center", fontSize: 9, bold: true, text: "ANTENNE TILBURG",
    }),
    textObject({
      name: "PRICE", x: 3360, y: 1640, width: 1600, height: 340,
      align: "Right", fontSize: 9, bold: false, text: priceText,
    }),
  ].join("\n");

  return `<?xml version="1.0" encoding="utf-8"?>
<DieCutLabel Version="8.0" Units="twips">
  <PaperOrientation>Landscape</PaperOrientation>
  <Id>Small99012</Id>
  <PaperName>99012</PaperName>
  <DrawCommands>
    <RoundRectangle X="0" Y="0" Width="${LABEL_WIDTH_TWIPS}" Height="${LABEL_HEIGHT_TWIPS}" Rx="270" Ry="270"/>
  </DrawCommands>
${objects}
</DieCutLabel>`;
}

interface RequiredField {
  key: string;
  present: (p: CatalogProduct) => boolean;
}

const REQUIRED_FIELDS: RequiredField[] = [
  { key: "Artist", present: (p) => p.productArtists.length > 0 },
  { key: "Title", present: (p) => p.title.trim().length > 0 },
  { key: "Price", present: (p) => p.price != null },
  { key: "Label", present: (p) => Boolean(p.label) },
  { key: "Genre", present: (p) => Boolean(p.genre) },
  { key: "Product Type", present: (p) => Boolean(p.productType) },
];

// Gates both the API route (422 if non-empty) and the two UI print
// affordances (hidden if non-empty) — see the API route and the edit/list
// pages.
export function missingLabelFields(product: CatalogProduct): string[] {
  return REQUIRED_FIELDS.filter((f) => !f.present(product)).map((f) => f.key);
}
