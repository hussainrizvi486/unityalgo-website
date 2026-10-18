import { themeQuartz, iconSetQuartzLight, colorSchemeLight } from 'ag-grid-community';

const INK_50 = 'var(--muted)';
const INK_100 = 'var(--secondary)';
const INK_200 = 'var(--border)';
const INK_400 = 'var(--muted-foreground)';
const INK_500 = 'var(--muted-foreground)';
const INK_900 = 'var(--foreground)';
const BRAND = 'var(--primary)';
const BRAND_SUBDUED = 'var(--accent)';
const SURFACE = 'var(--background)';

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

        backgroundColor: SURFACE,
        foregroundColor: INK_900,
        borderColor: INK_100,
        wrapperBorder: false,
        headerRowBorder: { color: INK_200, width: 1 },
        rowBorder: { color: INK_100, width: 1 },
        headerBackgroundColor: INK_50,

        rowHeight: 'var(--portal-grid-row-height, 60px)',
        headerHeight: 'var(--portal-grid-header-height, 44px)',
        cellHorizontalPadding: 'var(--portal-grid-cell-padding, 20px)',
        oddRowBackgroundColor: SURFACE,
        rowHoverColor: 'color-mix(in srgb, var(--muted) 75%, transparent)',

        // Selection and focus use the brand tint, as elsewhere in the panel.
        selectedRowBackgroundColor: BRAND_SUBDUED,
        rangeSelectionBorderColor: BRAND,
        accentColor: BRAND,
        checkboxCheckedBackgroundColor: INK_900,
        checkboxUncheckedBorderColor: INK_400,

        // Controls
        inputBorder: { color: INK_200, width: 1 },
        inputFocusBorder: { color: 'var(--ring)', width: 1 },
        borderRadius: 'var(--radius-lg)',
        menuBorder: { color: INK_200, width: 1 },
        menuBackgroundColor: SURFACE,
        menuShadow: { radius: 16, spread: 0, offsetY: 4, color: 'color-mix(in srgb, var(--foreground) 10%, transparent)' },
        tooltipBackgroundColor: INK_900,
    });
