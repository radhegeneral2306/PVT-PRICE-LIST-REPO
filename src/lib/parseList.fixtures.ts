// Realistic pasted pricelist samples used by parseList.test.ts.

/** The 8 line example from the "Add pricelist / paste text" mockup. */
export const MOCKUP_8 = `Calacatta Gold 600x1200 glossy 38.5/sqft
Calacatta Gold 800x1600 glossy 68/sqft
Statuario Ice 600x1200 matt 36/sqft
carrara grey 600x600 glossy 27.5
Onyx Honey 800x800 glossy 44/sqft
Slate Black 600x1200 rustic  ???
Terrazzo Sand 600x600 matt 25/sqft
Wood Walnut Plank 200x1200 matt 29.5/sqft`;

/** A typical forwarded WhatsApp message with emojis, stars and chatter. */
export const WHATSAPP = `Good morning sir 🙏
🔥 *NEW RATE LIST* 🔥
Price list effective 01/10/2026
*GVT Collection 600x600 mm*
1️⃣ Sky Onyx glossy ✅ *Rs 28/-*
2️⃣ _Nero Marquina_ matt *30* per sqft
3️⃣ Botticino Beige satin ₹ 26.5/sqft
Terms: GST extra, freight extra
Call 98250 11234 for orders
Thanks 🙏`;

/** Excel paste (tab separated) with a header row and a serial number column. */
export const TSV_HEADER = [
  'Sr\tItem\tSize\tFinish\tRate\tUnit',
  '1\tCalacatta Gold\t60x120 cm\tGlossy\t38.5\tsqft',
  '2\tStatuario Ice\t600x1200\tMatt\t36\tsqft',
  '3\tOnyx Honey\t24x48 inch\tglossy\t1,450\tbox',
  '4\tSlate Black\t600x1200\trustic\t\tsqft'
].join('\n');

/** Comma separated export with a quoted field that contains a comma. */
export const CSV_HEADER = `Design,Size,Finish,Rate/sqft
"Calacatta Gold, Premium",600*1200,Glossy,38.50
Nero Marquina,2x2 ft,Matt,Rs 41
Carrara Grey,600x600,Satin,27`;

/** Same data with no header row. */
export const CSV_NO_HEADER = `Calacatta Gold,600x1200,glossy,38.5
Nero Marquina,600x600,matt,41`;

/** Pipe separated with a header. */
export const PIPE_HEADER = `Item | Size | Finish | Price | Unit
Sky Onyx | 600x600 | Glossy | 28 | sqft
Nero Marquina | 600x1200 | Matt | 1,450 | box`;

/** Sanitaryware with codes, Rs ... /- and per pc. */
export const SANITARY = `SANITARYWARE
WH-204 Wall Hung WC Rs 6850/-
TB330 Table Top Basin 1,450
EWC S-Trap White Rs 3,200 per pc
PD-110 Pedestal Basin - Rs.2750/- + GST
Health Faucet ABS 450/-
Shower Set Rs 640 per pc
Bath Towel Rail 18% GST extra 1250`;

/** Different units in one list. */
export const MIXED_UNITS = `Sky Onyx 600x600 glossy Rs 28/sqft
Sky Onyx 600x600 glossy 300 per sqm
Nero Marquina 600x1200 matt 1,450 per box
Border Strip 300x100 matt 120 per pc
Basin Mixer Rs 1850 / set
Cornice Piece 90/pc
Skirting 100x600 matt 12 nos`;

/** Section headings that carry a size, followed by rows without one. */
export const HEADING_SIZES = `GVT COLLECTION 600x600 mm
Sky Onyx glossy 28
Nero Marquina matt 30
PGVT COLLECTION 800x1600 mm
Calacatta Gold glossy 68
Statuario Ice matt 72
WALL TILES
Beige Flower 300x600 glossy 14.5`;

/** Hindi-English mix, as typed by traders. */
export const HINGLISH = `Calacatta Gold 600x1200 glossy rate 38.5 per sqft
Sky Onyx 600x600 matt bhav 28 sqft
Nero Marquina 600x1200 matt kimat Rs 30
Statuario Ice ka rate 36 per sqft 600x1200 glossy`;

/** Lines that must all be skipped. */
export const GARBAGE = `-----------------
98250 11234
+91 98250 11234
15/09/2026
Terms: GST extra
Price list effective from 1st Oct 2026
Hello team
www.example.com
😀😀😀
=====`;

/** Messy typing: odd separators, bullets and spacing. */
export const MESSY = `  - Calacatta   Gold    600 x 1200    glossy     38.5   /sqft
* Statuario Ice, 600*1200, matt, 36
• Onyx Honey | 800X800 | glossy | Rs. 44 /-
3. carrara grey 60x60 cm satin 27.5`;

/** A larger realistic paste used by the performance test. */
export function bigPaste(lines: number): string {
  const names = ['Calacatta Gold', 'Statuario Ice', 'Sky Onyx', 'Nero Marquina', 'Botticino Beige', 'Carrara Grey'];
  const sizes = ['600x1200', '600x600', '800x1600', '800x800', '300x600'];
  const finishes = ['glossy', 'matt', 'satin', 'rustic', 'hi-gloss'];
  const out: string[] = [];
  for (let i = 0; i < lines; i++) {
    const n = names[i % names.length];
    const s = sizes[i % sizes.length];
    const f = finishes[i % finishes.length];
    const r = (20 + (i % 60) + 0.5).toFixed(1);
    if (i % 7 === 0) out.push(`WH-${100 + (i % 900)} Wall Hung WC Rs ${1000 + i}/-`);
    else if (i % 11 === 0) out.push(`*${n}* ${s} ${f} ??? 😀`);
    else if (i % 13 === 0) out.push(`Terms: GST extra, call 98250 11234`);
    else out.push(`${i + 1}. ${n} ${s} ${f} ${r}/sqft`);
  }
  return out.join('\n');
}
