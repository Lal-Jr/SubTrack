/**
 * Categorical series colors for the dark surface, assigned in fixed order and validated
 * (lightness band, chroma floor, colorblind separation, 3:1 contrast on the card surface).
 * A color follows its entity, never its rank, so a category keeps its color when others are filtered.
 */
export const SERIES = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767'] as const;

const CATEGORY_ORDER = ['Entertainment', 'Software', 'Utilities', 'Finance', 'Shopping', 'Food & Drink', 'Other'];

export function categoryColor(category: string): string {
    const i = CATEGORY_ORDER.indexOf(category);
    return i === -1 ? '#7f8898' : SERIES[i];
}

export const CATEGORIES = CATEGORY_ORDER;

/** Single-series charts use one calm hue: the first slot. */
export const PRIMARY_SERIES = SERIES[0];
