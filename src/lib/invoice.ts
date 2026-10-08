/** Facture PDF + Factur-X (profil MINIMUM, XML CII embarqué). Appeler depuis un gestionnaire d'événement. */
export type InvoiceData = {
  seller: { company: string; form: string; capital: string; siret: string; rcs: string; vat: string; seat?: string; tradeName: string; address: string; city: string; phone: string; email: string; logo?: string };
  buyer: { name: string; email: string; address: string; siren?: string; vatNumber?: string; contact?: string };
  orderNumber: number; orderId?: string; orderDate: string; serviceDate?: string;
  lines: { name: string; qty: number; unitTTC: number; totalTTC: number; vatRate?: number }[];
  vatRate: number; vatBreakdown?: { rate: number; ht: number; vat: number; ttc: number }[];
  totalHT: number; totalVAT: number; totalTTC: number; paid: boolean; paymentMethod: string; paymentLabel?: string;
  /** Présent sur un avoir : facture d'origine, motif et prestataire du remboursement. */
  creditNote?: { of: string; ofDate: string; reason: string; provider: string };
};
export type B2BBuyer = { company: string; siren: string; vatNumber?: string; address: string; postalCode: string; city: string; email?: string };
export type Invoice = { number: string; issued_at: string; data: InvoiceData; buyer_b2b?: B2BBuyer | null; buyer_b2b_updated_at?: string | null };
/** Acheteur effectif : données figées, ou complément B2B tracé ajouté après émission. */
export const effectiveBuyer = (inv: Invoice): InvoiceData["buyer"] => inv.buyer_b2b ? { name: inv.buyer_b2b.company, email: inv.buyer_b2b.email || inv.data.buyer.email, address: `${inv.buyer_b2b.address}, ${inv.buyer_b2b.postalCode} ${inv.buyer_b2b.city}`, siren: inv.buyer_b2b.siren, vatNumber: inv.buyer_b2b.vatNumber ?? "", contact: inv.data.buyer.name } : inv.data.buyer;

export const breakdown = (d: InvoiceData) => d.vatBreakdown ?? [{ rate: d.vatRate, ht: d.totalHT, vat: d.totalVAT, ttc: d.totalTTC }];
const lineRate = (d: InvoiceData, l: InvoiceData["lines"][number]) => l.vatRate ?? d.vatRate;

const esc = (s: string) => s.replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[c]!);
const d8 = (iso: string) => iso.slice(0, 10).replace(/-/g, "");
const n2 = (n: number) => n.toFixed(2);
const eur = (n: number) => n.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });

export function facturxXml(inv: Invoice) {
  const s = inv.data.seller, b = effectiveBuyer(inv);
  return `<?xml version="1.0" encoding="UTF-8"?>
<rsm:CrossIndustryInvoice xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100" xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100" xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100">
<rsm:ExchangedDocumentContext><ram:GuidelineSpecifiedDocumentContextParameter><ram:ID>urn:cen.eu:en16931:2017#compliant#urn:factur-x.eu:1p0:basic</ram:ID></ram:GuidelineSpecifiedDocumentContextParameter></rsm:ExchangedDocumentContext>
<rsm:ExchangedDocument><ram:ID>${esc(inv.number)}</ram:ID><ram:TypeCode>${inv.data.creditNote ? 381 : 380}</ram:TypeCode><ram:IssueDateTime><udt:DateTimeString format="102">${d8(inv.issued_at)}</udt:DateTimeString></ram:IssueDateTime></rsm:ExchangedDocument>
<rsm:SupplyChainTradeTransaction>
${inv.data.lines.map((l, i) => { const r = lineRate(inv.data, l); const k = 1 + r / 100; return `<ram:IncludedSupplyChainTradeLineItem><ram:AssociatedDocumentLineDocument><ram:LineID>${i + 1}</ram:LineID></ram:AssociatedDocumentLineDocument><ram:SpecifiedTradeProduct><ram:Name>${esc(l.name)}</ram:Name></ram:SpecifiedTradeProduct><ram:SpecifiedLineTradeAgreement><ram:NetPriceProductTradePrice><ram:ChargeAmount>${n2(l.unitTTC / k)}</ram:ChargeAmount></ram:NetPriceProductTradePrice></ram:SpecifiedLineTradeAgreement><ram:SpecifiedLineTradeDelivery><ram:BilledQuantity unitCode="C62">${l.qty}</ram:BilledQuantity></ram:SpecifiedLineTradeDelivery><ram:SpecifiedLineTradeSettlement><ram:ApplicableTradeTax><ram:TypeCode>VAT</ram:TypeCode><ram:CategoryCode>S</ram:CategoryCode><ram:RateApplicablePercent>${r}</ram:RateApplicablePercent></ram:ApplicableTradeTax><ram:SpecifiedTradeSettlementLineMonetarySummation><ram:LineTotalAmount>${n2(l.totalTTC / k)}</ram:LineTotalAmount></ram:SpecifiedTradeSettlementLineMonetarySummation></ram:SpecifiedLineTradeSettlement></ram:IncludedSupplyChainTradeLineItem>`; }).join("\n")}
<ram:ApplicableHeaderTradeAgreement>
<ram:BuyerReference>${inv.data.orderNumber}</ram:BuyerReference>
<ram:SellerTradeParty><ram:Name>${esc(s.company)}</ram:Name><ram:SpecifiedLegalOrganization><ram:ID schemeID="0002">${esc(s.siret.replace(/\s/g, "").slice(0, 9))}</ram:ID></ram:SpecifiedLegalOrganization><ram:PostalTradeAddress><ram:LineOne>${esc(s.seat || [s.address, s.city].filter(Boolean).join(", "))}</ram:LineOne><ram:CountryID>FR</ram:CountryID></ram:PostalTradeAddress>${s.vat ? `<ram:SpecifiedTaxRegistration><ram:ID schemeID="VA">${esc(s.vat.replace(/\s/g, ""))}</ram:ID></ram:SpecifiedTaxRegistration>` : ""}</ram:SellerTradeParty>
<ram:BuyerTradeParty><ram:Name>${esc(b.name)}</ram:Name>${b.siren ? `<ram:SpecifiedLegalOrganization><ram:ID schemeID="0002">${esc(b.siren)}</ram:ID></ram:SpecifiedLegalOrganization>` : ""}${b.siren ? `<ram:PostalTradeAddress><ram:LineOne>${esc(b.address)}</ram:LineOne><ram:CountryID>FR</ram:CountryID></ram:PostalTradeAddress>` : ""}${b.vatNumber ? `<ram:SpecifiedTaxRegistration><ram:ID schemeID="VA">${esc(b.vatNumber)}</ram:ID></ram:SpecifiedTaxRegistration>` : ""}</ram:BuyerTradeParty>
</ram:ApplicableHeaderTradeAgreement>
<ram:ApplicableHeaderTradeDelivery><ram:ActualDeliverySupplyChainEvent><ram:OccurrenceDateTime><udt:DateTimeString format="102">${d8(inv.data.serviceDate ?? inv.data.orderDate)}</udt:DateTimeString></ram:OccurrenceDateTime></ram:ActualDeliverySupplyChainEvent></ram:ApplicableHeaderTradeDelivery>
<ram:ApplicableHeaderTradeSettlement><ram:InvoiceCurrencyCode>EUR</ram:InvoiceCurrencyCode>
${breakdown(inv.data).map((b) => `<ram:ApplicableTradeTax><ram:CalculatedAmount>${n2(b.vat)}</ram:CalculatedAmount><ram:TypeCode>VAT</ram:TypeCode><ram:BasisAmount>${n2(b.ht)}</ram:BasisAmount><ram:CategoryCode>S</ram:CategoryCode><ram:RateApplicablePercent>${b.rate}</ram:RateApplicablePercent></ram:ApplicableTradeTax>`).join("")}
<ram:SpecifiedTradeSettlementHeaderMonetarySummation><ram:LineTotalAmount>${n2(inv.data.totalHT)}</ram:LineTotalAmount><ram:TaxBasisTotalAmount>${n2(inv.data.totalHT)}</ram:TaxBasisTotalAmount><ram:TaxTotalAmount currencyID="EUR">${n2(inv.data.totalVAT)}</ram:TaxTotalAmount><ram:GrandTotalAmount>${n2(inv.data.totalTTC)}</ram:GrandTotalAmount><ram:DuePayableAmount>${n2(inv.data.paid ? 0 : inv.data.totalTTC)}</ram:DuePayableAmount></ram:SpecifiedTradeSettlementHeaderMonetarySummation>
${inv.data.creditNote ? `<ram:InvoiceReferencedDocument><ram:IssuerAssignedID>${esc(inv.data.creditNote.of)}</ram:IssuerAssignedID><ram:FormattedIssueDateTime><qdt:DateTimeString xmlns:qdt="urn:un:unece:uncefact:data:standard:QualifiedDataType:100" format="102">${d8(inv.data.creditNote.ofDate)}</qdt:DateTimeString></ram:FormattedIssueDateTime></ram:InvoiceReferencedDocument>` : ""}</ram:ApplicableHeaderTradeSettlement>
</rsm:SupplyChainTradeTransaction>
</rsm:CrossIndustryInvoice>`;
}

const XMP = (title: string) => `<?xpacket begin="\ufeff" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
<rdf:Description rdf:about="" xmlns:pdfaid="http://www.aiim.org/pdfa/ns/id/"><pdfaid:part>3</pdfaid:part><pdfaid:conformance>B</pdfaid:conformance></rdf:Description>
<rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title><rdf:Alt><rdf:li xml:lang="x-default">${esc(title)}</rdf:li></rdf:Alt></dc:title></rdf:Description>
<rdf:Description rdf:about="" xmlns:fx="urn:factur-x:pdfa:CrossIndustryDocument:invoice:1p0#"><fx:DocumentType>INVOICE</fx:DocumentType><fx:DocumentFileName>factur-x.xml</fx:DocumentFileName><fx:Version>1.0</fx:Version><fx:ConformanceLevel>BASIC</fx:ConformanceLevel></rdf:Description>
<rdf:Description rdf:about="" xmlns:pdfaExtension="http://www.aiim.org/pdfa/ns/extension/" xmlns:pdfaSchema="http://www.aiim.org/pdfa/ns/schema#" xmlns:pdfaProperty="http://www.aiim.org/pdfa/ns/property#"><pdfaExtension:schemas><rdf:Bag><rdf:li rdf:parseType="Resource"><pdfaSchema:schema>Factur-X PDFA Extension Schema</pdfaSchema:schema><pdfaSchema:namespaceURI>urn:factur-x:pdfa:CrossIndustryDocument:invoice:1p0#</pdfaSchema:namespaceURI><pdfaSchema:prefix>fx</pdfaSchema:prefix><pdfaSchema:property><rdf:Seq>
<rdf:li rdf:parseType="Resource"><pdfaProperty:name>DocumentFileName</pdfaProperty:name><pdfaProperty:valueType>Text</pdfaProperty:valueType><pdfaProperty:category>external</pdfaProperty:category><pdfaProperty:description>Name of the embedded XML invoice file</pdfaProperty:description></rdf:li>
<rdf:li rdf:parseType="Resource"><pdfaProperty:name>DocumentType</pdfaProperty:name><pdfaProperty:valueType>Text</pdfaProperty:valueType><pdfaProperty:category>external</pdfaProperty:category><pdfaProperty:description>INVOICE</pdfaProperty:description></rdf:li>
<rdf:li rdf:parseType="Resource"><pdfaProperty:name>Version</pdfaProperty:name><pdfaProperty:valueType>Text</pdfaProperty:valueType><pdfaProperty:category>external</pdfaProperty:category><pdfaProperty:description>Version of the Factur-X XML schema</pdfaProperty:description></rdf:li>
<rdf:li rdf:parseType="Resource"><pdfaProperty:name>ConformanceLevel</pdfaProperty:name><pdfaProperty:valueType>Text</pdfaProperty:valueType><pdfaProperty:category>external</pdfaProperty:category><pdfaProperty:description>Conformance level of the Factur-X XML</pdfaProperty:description></rdf:li>
</rdf:Seq></pdfaSchema:property></rdf:li></rdf:Bag></pdfaExtension:schemas></rdf:Description>
</rdf:RDF></x:xmpmeta><?xpacket end="w"?>`;

export async function buildInvoicePdf(inv: Invoice): Promise<Uint8Array> {
  const { jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");
  const s = inv.data.seller, b = effectiveBuyer(inv);
  const doc = new jsPDF();
  const cn = inv.data.creditNote;
  const sg = cn ? -1 : 1; // l'avoir affiche des montants négatifs (le XML CII 381 garde des montants positifs, comme l'exige EN 16931)
  doc.setFontSize(20); doc.text(cn ? "AVOIR" : "FACTURE", 14, 20);
  if (cn) { doc.setFontSize(9); doc.text(`Sur facture n° ${cn.of} du ${new Date(cn.ofDate).toLocaleDateString("fr-FR")} — Motif : ${cn.reason}`, 14, 27); }
  doc.setFontSize(10);
  doc.text([`N° ${inv.number}`, `Date d'émission : ${new Date(inv.issued_at).toLocaleDateString("fr-FR")}`, `Date de prestation : ${new Date(inv.data.serviceDate ?? inv.data.orderDate).toLocaleDateString("fr-FR")}`, `Commande n° ${inv.data.orderNumber}`], 135, 16);
  if (inv.data.orderId) { doc.setFontSize(7); doc.text(`Réf. ${inv.data.orderId}`, 135, 37); doc.setFontSize(10); }
  doc.setFont("helvetica", "bold"); doc.text("Vendeur", 14, 42); doc.text("Client", 110, 42); doc.setFont("helvetica", "normal");
  doc.text([s.company + (s.form ? ` (${s.form})` : ""), s.tradeName !== s.company ? `Enseigne : ${s.tradeName}` : "", [s.address, s.city].filter(Boolean).join(", "), s.seat ? `Siège : ${s.seat}` : "", `SIRET : ${s.siret}${s.rcs ? ` — RCS ${s.rcs}` : ""}`, s.capital ? `Capital : ${s.capital}` : "", `TVA intracom. : ${s.vat || "non communiqué"}`].filter(Boolean), 14, 48, { maxWidth: 90 });
  doc.text([b.name, b.contact ? `À l'attention de ${b.contact}` : "", b.address, b.siren ? `SIREN : ${b.siren}` : "", b.vatNumber ? `TVA intracom. : ${b.vatNumber}` : "", b.email].filter(Boolean), 110, 48, { maxWidth: 85 });
  if (inv.buyer_b2b_updated_at) { doc.setFontSize(7); doc.text(`Identité client complétée le ${new Date(inv.buyer_b2b_updated_at).toLocaleDateString("fr-FR")}`, 110, 78); doc.setFontSize(10); }
  autoTable(doc, {
    startY: 82,
    head: [["Désignation", "Qté", "PU HT", "TVA", "Total HT", "Total TTC"]],
    body: inv.data.lines.map((l) => { const r = lineRate(inv.data, l); const k = 1 + r / 100; return [l.name, String(l.qty), eur(sg * l.unitTTC / k), `${String(r).replace(".", ",")} %`, eur(sg * l.totalTTC / k), eur(sg * l.totalTTC)]; }),
    styles: { fontSize: 8 }, headStyles: { fillColor: [0, 122, 245] }, columnStyles: { 0: { cellWidth: 70 } },
  });
  let y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  const bd = breakdown(inv.data);
  doc.text([`Total HT : ${eur(sg * inv.data.totalHT)}`, ...bd.map((b) => `TVA ${String(b.rate).replace(".", ",")} % (base ${eur(sg * b.ht)}) : ${eur(sg * b.vat)}`), `Total TVA : ${eur(sg * inv.data.totalVAT)}`], 120, y);
  y += 6 * (bd.length + 2);
  doc.setFont("helvetica", "bold"); doc.text(`Total TTC : ${eur(sg * inv.data.totalTTC)}`, 120, y); doc.setFont("helvetica", "normal");
  y += 8;
  doc.text(cn ? `Remboursé au client via ${cn.provider} (moyen de paiement d'origine)` : `Paiement : ${inv.data.paymentLabel ?? inv.data.paymentMethod} — ${inv.data.paid ? "Payée" : "À régler"}`, 14, y);
  y += 10;
  doc.setFontSize(8);
  doc.text([
    cn ? "Avoir valant annulation partielle ou totale de la facture d'origine ; montant remboursé, aucune somme restant due." : inv.data.paid ? "Facture acquittée." : "Paiement à réception, pas d'escompte pour paiement anticipé.",
    "Pénalités de retard : 3 fois le taux d'intérêt légal. Indemnité forfaitaire pour frais de recouvrement (clients professionnels) : 40 € (art. L441-10 C. com.).",
    "Document généré au format Factur-X BASIC (EN 16931, XML CII embarqué, PDF/A-3). Conservez cette facture 10 ans (art. L123-22 C. com.).",
  ], 14, y, { maxWidth: 180 });
  const base = new Uint8Array(doc.output("arraybuffer"));

  const { PDFDocument, PDFName, AFRelationship } = await import("pdf-lib");
  const pdf = await PDFDocument.load(base);
  const title = `${cn ? "Avoir" : "Facture"} ${inv.number}`;
  pdf.setTitle(title); pdf.setAuthor(s.company); pdf.setProducer("LC Digitale"); pdf.setCreator("LC Digitale");
  await pdf.attach(new TextEncoder().encode(facturxXml(inv)), "factur-x.xml", { mimeType: "text/xml", description: "Factur-X invoice", afRelationship: AFRelationship.Data, creationDate: new Date(inv.issued_at), modificationDate: new Date(inv.issued_at) });
  const meta = pdf.context.stream(XMP(title), { Type: "Metadata", Subtype: "XML" });
  pdf.catalog.set(PDFName.of("Metadata"), pdf.context.register(meta));
  return pdf.save({ useObjectStreams: false });
}

export async function downloadInvoice(inv: Invoice) {
  const bytes = await buildInvoicePdf(inv);
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/pdf" }));
  a.download = `${inv.number}.pdf`; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
