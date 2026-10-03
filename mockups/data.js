/* Shared SAMPLE data for all mockups. Placeholder only, not real rates.
   Factory names are invented to avoid implying real brands. */
window.DATA = {
  business: 'Radhe General',
  user: { name: 'Owner', role: 'owner' },
  factories: [
    { id: 'f1', name: 'Sunrise Ceramics', city: 'Morbi', category: 'Tiles', contact: 'Hitesh Bhai', phone: '98250 11234', current: 'pl1', updated: '2 days ago', lists: 6 },
    { id: 'f2', name: 'Kailash Vitrified', city: 'Morbi', category: 'Tiles', contact: 'Dinesh Patel', phone: '98240 55671', current: 'pl2', updated: '1 week ago', lists: 4 },
    { id: 'f3', name: 'Shree Ganesh Sanitary', city: 'Thangadh', category: 'Sanitaryware', contact: 'Jayesh Bhai', phone: '99090 22418', current: 'pl3', updated: '3 days ago', lists: 5 },
    { id: 'f4', name: 'Aarav Tiles Pvt Ltd', city: 'Himmatnagar', category: 'Tiles', contact: 'Manish Shah', phone: '97270 88102', current: 'pl4', updated: '3 weeks ago', lists: 3 },
    { id: 'f5', name: 'Ocean Bath Fittings', city: 'Rajkot', category: 'Sanitaryware', contact: 'Kunal Mehta', phone: '98795 30045', current: 'pl5', updated: 'Yesterday', lists: 7 }
  ],
  pricelists: [
    { id: 'pl1', factory: 'f1', title: 'GVT Collection Oct 2026', source: 'items', effective: '01 Oct 2026', count: 84, status: 'Current', note: 'Rates ex-factory, GST extra' },
    { id: 'pl2', factory: 'f2', title: 'Full Body Vitrified Sep 2026', source: 'pdf', effective: '24 Sep 2026', pages: 12, status: 'Current', note: 'PDF received on WhatsApp' },
    { id: 'pl3', factory: 'f3', title: 'Sanitaryware Price List Q4', source: 'items', effective: '29 Sep 2026', count: 61, status: 'Current', note: 'Includes freight to Surat' },
    { id: 'pl4', factory: 'f4', title: 'Parking Tiles Sep 2026', source: 'image', effective: '12 Sep 2026', pages: 3, status: 'Current', note: 'Photo of printed list' },
    { id: 'pl5', factory: 'f5', title: 'CP Fittings Oct 2026', source: 'items', effective: '02 Oct 2026', count: 47, status: 'Current', note: '' }
  ],
  /* Items of pl1 (tiles). unit: sqft | box | pc. rate in INR. */
  tileItems: [
    { name: 'Calacatta Gold', size: '600x1200', finish: 'Glossy', unit: 'sqft', rate: 38.5, box: '2 pcs', thickness: '9 mm' },
    { name: 'Calacatta Gold', size: '800x1600', finish: 'Glossy', unit: 'sqft', rate: 68, box: '1 pc', thickness: '10 mm' },
    { name: 'Statuario Ice', size: '600x1200', finish: 'Matt', unit: 'sqft', rate: 36, box: '2 pcs', thickness: '9 mm' },
    { name: 'Carrara Grey', size: '600x600', finish: 'Glossy', unit: 'sqft', rate: 27.5, box: '4 pcs', thickness: '8.5 mm' },
    { name: 'Onyx Honey', size: '800x800', finish: 'Glossy', unit: 'sqft', rate: 44, box: '3 pcs', thickness: '9.5 mm' },
    { name: 'Slate Black', size: '600x1200', finish: 'Rustic', unit: 'sqft', rate: 33, box: '2 pcs', thickness: '9 mm' },
    { name: 'Terrazzo Sand', size: '600x600', finish: 'Matt', unit: 'sqft', rate: 25, box: '4 pcs', thickness: '8.5 mm' },
    { name: 'Wood Walnut Plank', size: '200x1200', finish: 'Matt', unit: 'sqft', rate: 29.5, box: '6 pcs', thickness: '9 mm' }
  ],
  sanitaryItems: [
    { name: 'Wall Hung WC Rimless', code: 'WH-204', finish: 'White', unit: 'pc', rate: 6850 },
    { name: 'Two Piece WC S-Trap', code: 'TP-118', finish: 'Ivory', unit: 'pc', rate: 3250 },
    { name: 'Table Top Basin Round', code: 'TB-330', finish: 'Matt Black', unit: 'pc', rate: 2980 },
    { name: 'Pedestal Basin', code: 'PB-071', finish: 'White', unit: 'pc', rate: 1450 },
    { name: 'Health Faucet Set', code: 'HF-09', finish: 'Chrome', unit: 'pc', rate: 640 }
  ],
  /* Compare example: query "600x1200 glossy" rate per sqft across factories. */
  compare: {
    query: '600x1200 Glossy',
    rows: [
      { factory: 'Sunrise Ceramics', item: 'Calacatta Gold', rate: 38.5, unit: 'sqft', updated: '2 days ago', best: true },
      { factory: 'Kailash Vitrified', item: 'Marble White Glossy', rate: 40, unit: 'sqft', updated: '1 week ago' },
      { factory: 'Aarav Tiles Pvt Ltd', item: 'Statuario Premium', rate: 41.5, unit: 'sqft', updated: '3 weeks ago', stale: true },
      { factory: 'Sunrise Ceramics', item: 'Armani Grey', rate: 43, unit: 'sqft', updated: '2 days ago' }
    ]
  },
  users: [
    { name: 'Owner', role: 'Owner', pin: 'Set' },
    { name: 'Rakesh', role: 'Staff', pin: 'Set', note: 'Cost rates hidden' },
    { name: 'Pooja', role: 'Staff', pin: 'Set', note: 'Cost rates hidden' }
  ]
};
