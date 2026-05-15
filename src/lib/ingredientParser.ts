// Parse, scale, categorize, and format ingredient strings.

const UNICODE_FRACTIONS: Record<string, number> = {
  '½': 0.5, '⅓': 1 / 3, '⅔': 2 / 3,
  '¼': 0.25, '¾': 0.75,
  '⅕': 0.2, '⅖': 0.4, '⅗': 0.6, '⅘': 0.8,
  '⅙': 1 / 6, '⅚': 5 / 6,
  '⅛': 0.125, '⅜': 0.375, '⅝': 0.625, '⅞': 0.875,
};

export interface ParsedIngredient {
  quantity: number | null; // numeric quantity if found
  rest: string;            // everything after the leading quantity (incl. unit + name)
  raw: string;
}

/**
 * Parse the leading numeric quantity from an ingredient line.
 * Handles: "2", "2.5", "1/2", "1 1/2", "½", "1½".
 * Returns the rest of the string untouched (unit + name).
 */
export function parseIngredient(raw: string): ParsedIngredient {
  const trimmed = raw.trim();
  if (!trimmed) return { quantity: null, rest: '', raw };

  // Normalize unicode fractions: "1½" -> "1 1/2", "½" -> "1/2"
  let normalized = trimmed;
  for (const [glyph, val] of Object.entries(UNICODE_FRACTIONS)) {
    if (normalized.includes(glyph)) {
      // Convert to "n/d" approximation using known fractions
      const frac = decimalToFraction(val);
      normalized = normalized.replace(
        new RegExp(`(\\d+)\\s*${glyph}`, 'g'),
        `$1 ${frac}`
      );
      normalized = normalized.replaceAll(glyph, frac);
    }
  }

  // Match: optional whole + optional fraction OR decimal
  const re = /^(\d+(?:\.\d+)?)(?:\s+(\d+)\/(\d+))?\s*(.*)$/;
  const fracOnly = /^(\d+)\/(\d+)\s*(.*)$/;

  let m = normalized.match(re);
  let quantity: number | null = null;
  let rest = trimmed;

  if (m) {
    const whole = parseFloat(m[1]);
    if (m[2] && m[3]) {
      quantity = whole + parseInt(m[2], 10) / parseInt(m[3], 10);
    } else {
      quantity = whole;
    }
    rest = m[4] ?? '';
  } else {
    m = normalized.match(fracOnly);
    if (m) {
      quantity = parseInt(m[1], 10) / parseInt(m[2], 10);
      rest = m[3] ?? '';
    }
  }

  return { quantity, rest: rest.trim(), raw };
}

/**
 * Convert a decimal (0–1 or larger) to a friendly fraction string for cooking.
 * Examples: 0.5 -> "1/2", 0.25 -> "1/4", 1.5 -> "1 1/2".
 */
export function formatQuantity(n: number): string {
  if (!isFinite(n) || n <= 0) return '';

  const whole = Math.floor(n);
  const frac = n - whole;

  if (frac < 0.02) return String(whole || 0);

  const fracStr = decimalToFraction(frac);
  if (!fracStr) {
    // fall back to a clean decimal
    return whole > 0 ? `${whole + +frac.toFixed(2)}` : (+n.toFixed(2)).toString();
  }
  return whole > 0 ? `${whole} ${fracStr}` : fracStr;
}

function decimalToFraction(frac: number): string {
  // Common cooking fractions with tolerance
  const candidates: Array<[number, string]> = [
    [1 / 8, '1/8'], [1 / 6, '1/6'], [1 / 5, '1/5'],
    [1 / 4, '1/4'], [1 / 3, '1/3'], [3 / 8, '3/8'],
    [2 / 5, '2/5'], [1 / 2, '1/2'], [3 / 5, '3/5'],
    [5 / 8, '5/8'], [2 / 3, '2/3'], [3 / 4, '3/4'],
    [4 / 5, '4/5'], [5 / 6, '5/6'], [7 / 8, '7/8'],
  ];
  let best = '';
  let bestDiff = 0.04;
  for (const [v, s] of candidates) {
    const d = Math.abs(frac - v);
    if (d < bestDiff) { bestDiff = d; best = s; }
  }
  return best;
}

/**
 * Scale an ingredient string by a multiplier, replacing the leading quantity.
 */
export function scaleIngredient(raw: string, multiplier: number): string {
  if (multiplier === 1) return raw;
  const { quantity, rest } = parseIngredient(raw);
  if (quantity == null) return raw;
  const scaled = quantity * multiplier;
  const formatted = formatQuantity(scaled);
  return formatted ? `${formatted} ${rest}`.trim() : rest;
}

// ----- Categorization -----

export type ShoppingCategory =
  | 'Produce'
  | 'Dairy & Eggs'
  | 'Meat & Seafood'
  | 'Pantry'
  | 'Bakery'
  | 'Frozen'
  | 'Spices'
  | 'Beverages'
  | 'Other';

const CATEGORY_KEYWORDS: Array<[ShoppingCategory, string[]]> = [
  ['Produce', [
    'apple','banana','berry','strawberry','blueberry','raspberry','grape','lemon','lime','orange','pear','peach','plum','mango','pineapple','melon','watermelon','avocado',
    'lettuce','spinach','kale','arugula','cabbage','broccoli','cauliflower','carrot','celery','cucumber','tomato','potato','onion','shallot','scallion','garlic','ginger','pepper','bell pepper','chili','jalapeno','mushroom','zucchini','squash','pumpkin','eggplant','corn','peas','bean sprout','radish','beet','asparagus','leek','herb','parsley','cilantro','basil','mint','dill','rosemary','thyme','sage','chive',
  ]],
  ['Dairy & Eggs', [
    'milk','cream','half-and-half','butter','yogurt','yoghurt','cheese','cheddar','mozzarella','parmesan','feta','ricotta','cottage','sour cream','egg','eggs',
  ]],
  ['Meat & Seafood', [
    'chicken','beef','pork','bacon','sausage','ham','turkey','lamb','veal','steak','ground','mince','duck',
    'fish','salmon','tuna','cod','tilapia','shrimp','prawn','crab','lobster','scallop','clam','mussel','anchovy',
  ]],
  ['Bakery', [
    'bread','baguette','roll','bun','tortilla','pita','naan','croissant','bagel',
  ]],
  ['Frozen', [
    'frozen','ice cream','ice-cream',
  ]],
  ['Spices', [
    'salt','pepper','cumin','paprika','cinnamon','nutmeg','clove','cardamom','turmeric','coriander','oregano','bay leaf','chili powder','curry','saffron','vanilla','allspice','cayenne','red pepper flake',
  ]],
  ['Beverages', [
    'water','wine','beer','juice','coffee','tea','soda','broth','stock',
  ]],
  ['Pantry', [
    'flour','sugar','brown sugar','rice','pasta','noodle','spaghetti','penne','oat','quinoa','lentil','bean','chickpea','oil','olive oil','vinegar','soy sauce','honey','syrup','maple','baking powder','baking soda','yeast','cocoa','chocolate','nuts','almond','walnut','pecan','cashew','peanut','seed','raisin','tomato sauce','tomato paste','canned','can ','jar','breadcrumb','cornstarch','starch',
  ]],
];

export function categorizeIngredient(name: string): ShoppingCategory {
  const lower = name.toLowerCase();
  for (const [cat, keywords] of CATEGORY_KEYWORDS) {
    if (keywords.some((kw) => lower.includes(kw))) return cat;
  }
  return 'Other';
}
