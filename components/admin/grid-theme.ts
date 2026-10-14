import { themeQuartz, iconSetQuartzLight, colorSchemeLight } from 'ag-grid-community';

/**
 * AG Grid theme, driven by the tokens in app/globals.css.
 *
 * AG Grid v33+ styles itself through the Theming API rather than a stylesheet,
 * so there is no CSS file to import and nothing to override with `!important`.
 * Its params take any CSS colour string, so they reference the custom
 * properties directly instead of duplicating the hexes — change a token in
 * globals.css and the grid follows.
 */

const INK_50 = 'var(--color-ink-50)';
const INK_100 = 'var(--color-ink-100)';
const INK_200 = 'var(--color-ink-200)';
const INK_400 = 'var(--color-ink-400)';
const INK_500 = 'var(--color-ink-500)';
const INK_900 = 'var(--color-ink-900)';
const BRAND = 'var(--color-brand)';
const BRAND_SUBDUED = 'var(--color-brand-subdued)';
const SURFACE = 'var(--color-background)';

export const adminGridTheme = themeQuartz
    .withPart(iconSetQuartzLight)
    .withPart(colorSchemeLight)
    .withParams({
        // Type — inherits the app's font rather than AG Grid's default stack.
        fontFamily: 'inherit',
        fontSize: 'var(--portal-body-size, 14px)',
        headerFontSize: 'var(--portal-caption-size, 13px)',
        headerFontWeight: 500,
        headerTextColor: INK_500,

        // Surfaces. The grid sits inside an already-bordered card, so its own
        // outer border is removed and only the internal rules are kept.
        backgroundColor: SURFACE,
        foregroundColor: INK_900,
        borderColor: INK_100,
        wrapperBorder: false,
        headerRowBorder: { color: INK_200, width: 1 },
        rowBorder: { color: INK_100, width: 1 },
        headerBackgroundColor: INK_50,

        // Rows. Generous height because most cells stack a primary line over a
        // dimmer secondary one, matching the old table's px-6 py-4 rhythm.
        rowHeight: 'var(--portal-grid-row-height, 60px)',
        headerHeight: 'var(--portal-grid-header-height, 44px)',
        cellHorizontalPadding: 'var(--portal-grid-cell-padding, 20px)',
        oddRowBackgroundColor: SURFACE,
        rowHoverColor: 'color-mix(in srgb, var(--color-ink-50) 75%, transparent)',

        // Selection and focus use the brand tint, as elsewhere in the panel.
        selectedRowBackgroundColor: BRAND_SUBDUED,
        rangeSelectionBorderColor: BRAND,
        accentColor: BRAND,
        checkboxCheckedBackgroundColor: INK_900,
        checkboxUncheckedBorderColor: INK_400,

        // Controls
        inputBorder: { color: INK_200, width: 1 },
        inputFocusBorder: { color: 'var(--color-ring)', width: 1 },
        borderRadius: 'var(--radius-lg)',
        menuBorder: { color: INK_200, width: 1 },
        menuBackgroundColor: SURFACE,
        menuShadow: { radius: 16, spread: 0, offsetY: 4, color: 'rgb(var(--shadow-color) / 0.10)' },
        tooltipBackgroundColor: INK_900,
    });
