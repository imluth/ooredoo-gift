// ============================================================
// Backend item catalog — IDs, names, and initial quantities.
// This is the source of truth for inventory seeding.
// The frontend (index.html) embeds the same IDs + names + images,
// so both sides must stay in sync if you change this file.
// ============================================================

import items from './items-data.json' with { type: 'json' };

export const ITEMS = items;

// Lookup map: item_id -> { name, qty }
export const ITEM_BY_ID = Object.fromEntries(
  ITEMS.map(i => [i.id, { name: i.name, qty: i.qty }])
);

// Initial inventory as a flat hash { item_id: qty_string }
// (Redis hash values are strings, so we cast here)
export const INITIAL_INVENTORY = Object.fromEntries(
  ITEMS.map(i => [i.id, String(i.qty)])
);

// Redis keys
export const K = {
  ITEMS: 'vault:items',       // HASH: item_id -> remaining qty
  CLAIMS: 'vault:claims',     // HASH: staff_id -> JSON claim record
  SEED_FLAG: 'vault:seeded',  // STRING: "1" once seeded
};
