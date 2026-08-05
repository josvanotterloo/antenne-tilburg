import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { CATALOG_INCLUDE } from "@/lib/catalog";
import { generateLabelXml, missingLabelFields } from "@/lib/dymo-label";

type RouteContext = { params: Promise<{ productId: string }> };

const DYMO_PRINT_URL = "http://localhost:41951/DYMO/DLS/Printing/PrintLabel";

export async function GET(_req: Request, ctx: RouteContext) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { productId } = await ctx.params;
  const product = await db.product.findUnique({
    where: { id: productId },
    include: CATALOG_INCLUDE,
  });
  if (!product) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const missing = missingLabelFields(product);
  if (missing.length > 0) {
    return NextResponse.json(
      { error: "Missing required fields", fields: missing },
      { status: 422 },
    );
  }

  const xml = generateLabelXml(product);
  const mode = process.env.DYMO_MODE ?? "preview";

  if (mode === "print") {
    const printerName = process.env.DYMO_PRINTER_NAME;
    if (!printerName) {
      return NextResponse.json(
        { error: "DYMO_PRINTER_NAME is not set" },
        { status: 500 },
      );
    }
    const body = new URLSearchParams({ printerName, labelXml: xml });
    let res: Response;
    try {
      res = await fetch(DYMO_PRINT_URL, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body,
      });
    } catch {
      return NextResponse.json(
        { error: "Could not reach Dymo Connect — is it running?" },
        { status: 502 },
      );
    }
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return NextResponse.json(
        { error: "Dymo Connect print failed", detail },
        { status: 502 },
      );
    }
    return NextResponse.json({ ok: true });
  }

  return new Response(xml, {
    headers: {
      "content-type": "text/xml",
      "content-disposition": "inline",
    },
  });
}
