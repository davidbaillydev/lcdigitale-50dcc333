/** Facture PDF + Factur-X (profil MINIMUM, XML CII embarqué). Appeler depuis un gestionnaire d'événement. */
export type InvoiceData = {
  seller: { company: string; form: string; capital: string; siret: string; rcs: string; vat: string; tradeName: string; address: string; city: string; phone: string; email: string };
  buyer: { name: string; email: string; address: string };
  orderNumber: number; orderDate: string;
  lines: { name: string; qty: number; unitTTC: number; totalTTC: number }[];
  vatRate: number; totalHT: number; totalVAT: number; totalTTC: number; paid: boolean; paymentMethod: string;
};
export type Invoice = { number: string; issued_at: string; data: InvoiceData };

const esc = (s: string) => s.replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[c]!);
const d8 = (iso: string) => iso.slice(0, 10).replace(/-/g, "");
const n2 = (n: number) => n.toFixed(2);
const eur = (n: number) => n.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });

export function facturxXml(inv: Invoice) {
  const { seller: s, buyer: b } = inv.data;
  return `<?xml version="1.0" encoding="UTF-8"?>
<rsm:CrossIndustryInvoice xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100" xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100" xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100">
<rsm:ExchangedDocumentContext><ram:GuidelineSpecifiedDocumentContextParameter><ram:ID>urn:factur-x.eu:1p0:minimum</ram:ID></ram:GuidelineSpecifiedDocumentContextParameter></rsm:ExchangedDocumentContext>
<rsm:ExchangedDocument><ram:ID>${esc(inv.number)}</ram:ID><ram:TypeCode>380</ram:TypeCode><ram:IssueDateTime><udt:DateTimeString format="102">${d8(inv.issued_at)}</udt:DateTimeString></ram:IssueDateTime></rsm:ExchangedDocument>
<rsm:SupplyChainTradeTransaction>
<ram:ApplicableHeaderTradeAgreement>
<ram:BuyerReference>${inv.data.orderNumber}</ram:BuyerReference>
<ram:SellerTradeParty><ram:Name>${esc(s.company)}</ram:Name><ram:SpecifiedLegalOrganization><ram:ID schemeID="0002">${esc(s.siret.replace(/\s/g, "").slice(0, 9))}</ram:ID></ram:SpecifiedLegalOrganization><ram:PostalTradeAddress><ram:CountryID>FR</ram:CountryID></ram:PostalTradeAddress>${s.vat ? `<ram:SpecifiedTaxRegistration><ram:ID schemeID="VA">${esc(s.vat.replace(/\s/g, ""))}</ram:ID></ram:SpecifiedTaxRegistration>` : ""}</ram:SellerTradeParty>
<ram:BuyerTradeParty><ram:Name>${esc(b.name)}</ram:Name></ram:BuyerTradeParty>
</ram:ApplicableHeaderTradeAgreement>
<ram:ApplicableHeaderTradeDelivery/>
<ram:ApplicableHeaderTradeSettlement><ram:InvoiceCurrencyCode>EUR</ram:InvoiceCurrencyCode>
<ram:SpecifiedTradeSettlementHeaderMonetarySummation><ram:TaxBasisTotalAmount>${n2(inv.data.totalHT)}</ram:TaxBasisTotalAmount><ram:TaxTotalAmount currencyID="EUR">${n2(inv.data.totalVAT)}</ram:TaxTotalAmount><ram:GrandTotalAmount>${n2(inv.data.totalTTC)}</ram:GrandTotalAmount><ram:DuePayableAmount>${n2(inv.data.paid ? 0 : inv.data.totalTTC)}</ram:DuePayableAmount></ram:SpecifiedTradeSettlementHeaderMonetarySummation>
</ram:ApplicableHeaderTradeSettlement>
</rsm:SupplyChainTradeTransaction>
</rsm:CrossIndustryInvoice>`;
}

const XMP = (title: string) => `<?xpacket begin="\ufeff" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
<rdf:Description rdf:about="" xmlns:pdfaid="http://www.aiim.org/pdfa/ns/id/"><pdfaid:part>3</pdfaid:part><pdfaid:conformance>B</pdfaid:conformance></rdf:Description>
<rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title><rdf:Alt><rdf:li xml:lang="x-default">${esc(title)}</rdf:li></rdf:Alt></dc:title></rdf:Description>
<rdf:Description rdf:about="" xmlns:fx="urn:factur-x:pdfa:CrossIndustryDocument:invoice:1p0#"><fx:DocumentType>INVOICE</fx:DocumentType><fx:DocumentFileName>factur-x.xml</fx:DocumentFileName><fx:Version>1.0</fx:Version><fx:ConformanceLevel>MINIMUM</fx:ConformanceLevel></rdf:Description>
<rdf:Description rdf:about="" xmlns:pdfaExtension="http://www.aiim.org/pdfa/ns/extension/" xmlns:pdfaSchema="http://www.aiim.org/pdfa/ns/schema#" xmlns:pdfaProperty="http://www.aiim.org/pdfa/ns/property#"><pdfaExtension:schemas><rdf:Bag><rdf:li rdf:parseType="Resource"><pdfaSchema:schema>Factur-X PDFA Extension Schema</pdfaSchema:schema><pdfaSchema:namespaceURI>urn:factur-x:pdfa:CrossIndustryDocument:invoice:1p0#</pdfaSchema:namespaceURI><pdfaSchema:prefix>fx</pdfaSchema:prefix><pdfaSchema:property><rdf:Seq>
<rdf:li rdf:parseType="Resource"><pdfaProperty:name>DocumentFileName</pdfaProperty:name><pdfaProperty:valueType>Text</pdfaProperty:valueType><pdfaProperty:category>external</pdfaProperty:category><pdfaProperty:description>Name of the embedded XML invoice file</pdfaProperty:description></rdf:li>
<rdf:li rdf:parseType="Resource"><pdfaProperty:name>DocumentType</pdfaProperty:name><pdfaProperty:valueType>Text</pdfaProperty:valueType><pdfaProperty:category>external</pdfaProperty:category><pdfaProperty:description>INVOICE</pdfaProperty:description></rdf:li>
<rdf:li rdf:parseType="Resource"><pdfaProperty:name>Version</pdfaProperty:name><pdfaProperty:valueType>Text</pdfaProperty:valueType><pdfaProperty:category>external</pdfaProperty:category><pdfaProperty:description>Version of the Factur-X XML schema</pdfaProperty:description></rdf:li>
<rdf:li rdf:parseType="Resource"><pdfaProperty:name>ConformanceLevel</pdfaProperty:name><pdfaProperty:valueType>Text</pdfaProperty:valueType><pdfaProperty:category>external</pdfaProperty:category><pdfaProperty:description>Conformance level of the Factur-X XML</pdfaProperty:description></rdf:li>
</rdf:Seq></pdfaSchema:property></rdf:li></rdf:Bag></pdfaExtension:schemas></rdf:Description>
</rdf:RDF></x:xmpmeta><?xpacket end="w"?>`;

export async function downloadInvoice(inv: Invoice) {
  const { jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");
  const { seller: s, buyer: b } = inv.data;
  const doc = new jsPDF();
  doc.setFontSize(20); doc.text("FACTURE", 14, 20);
  doc.setFontSize(10);
  doc.text([`N° ${inv.number}`, `Date d'émission : ${new Date(inv.issued_at).toLocaleDateString("fr-FR")}`, `Date de la vente : ${new Date(inv.data.orderDate).toLocaleDateString("fr-FR")}`, `Commande n° ${inv.data.orderNumber}`], 140, 16);
  doc.setFont("helvetica", "bold"); doc.text("Vendeur", 14, 42); doc.text("Client", 110, 42); doc.setFont("helvetica", "normal");
  doc.text([s.company + (s.form ? ` (${s.form})` : ""), s.tradeName !== s.company ? `Enseigne : ${s.tradeName}` : "", [s.address, s.city].filter(Boolean).join(", "), `SIRET : ${s.siret}${s.rcs ? ` — RCS ${s.rcs}` : ""}`, s.capital ? `Capital : ${s.capital}` : "", `TVA intracom. : ${s.vat || "non communiqué"}`].filter(Boolean), 14, 48, { maxWidth: 90 });
  doc.text([b.name, b.address, b.email].filter(Boolean), 110, 48, { maxWidth: 85 });
  const k = 1 + inv.data.vatRate / 100;
  autoTable(doc, {
    startY: 82,
    head: [["Désignation", "Qté", "PU HT", "TVA", "Total HT", "Total TTC"]],
    body: inv.data.lines.map((l) => [l.name, String(l.qty), eur(l.unitTTC / k), `${inv.data.vatRate} %`, eur(l.totalTTC / k), eur(l.totalTTC)]),
    styles: { fontSize: 8 }, headStyles: { fillColor: [0, 122, 245] }, columnStyles: { 0: { cellWidth: 70 } },
  });
  let y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  doc.text([`Total HT : ${eur(inv.data.totalHT)}`, `TVA ${inv.data.vatRate} % : ${eur(inv.data.totalVAT)}`], 140, y);
  doc.setFont("helvetica", "bold"); doc.text(`Total TTC : ${eur(inv.data.totalTTC)}`, 140, y + 12); doc.setFont("helvetica", "normal");
  y += 24;
  doc.setFontSize(8);
  doc.text([
    inv.data.paid ? `Facture acquittée${inv.data.paymentMethod === "online" ? " — paiement en ligne" : ""}.` : "Paiement à réception, sans escompte.",
    "Pénalités de retard : 3 fois le taux d'intérêt légal. Indemnité forfaitaire pour frais de recouvrement (clients professionnels) : 40 € (art. L441-10 C. com.).",
    "Document généré au format Factur-X (XML CII embarqué).",
  ], 14, y, { maxWidth: 180 });
  const base = new Uint8Array(doc.output("arraybuffer"));

  const { PDFDocument, PDFName, AFRelationship } = await import("pdf-lib");
  const pdf = await PDFDocument.load(base);
  const title = `Facture ${inv.number}`;
  pdf.setTitle(title); pdf.setAuthor(s.company); pdf.setProducer("LC Digitale"); pdf.setCreator("LC Digitale");
  await pdf.attach(new TextEncoder().encode(facturxXml(inv)), "factur-x.xml", { mimeType: "text/xml", description: "Factur-X invoice", afRelationship: AFRelationship.Data, creationDate: new Date(inv.issued_at), modificationDate: new Date(inv.issued_at) });
  const meta = pdf.context.stream(XMP(title), { Type: "Metadata", Subtype: "XML" });
  pdf.catalog.set(PDFName.of("Metadata"), pdf.context.register(meta));
  const bytes = await pdf.save({ useObjectStreams: false });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/pdf" }));
  a.download = `${inv.number}.pdf`; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
