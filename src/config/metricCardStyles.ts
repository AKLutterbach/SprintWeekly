/**
 * Shared metric card styling configuration
 * Used by both PDF export and in-app UI to ensure 1:1 visual match
 */

export const METRIC_CARD_STYLES = {
  layout: {
    largeCard: {
      height: 35, // mm
      borderRadius: 3, // mm
      borderWidth: 2.5, // px (absolute)
    },
    smallCard: {
      height: 16, // mm
      borderRadius: 3, // mm
      borderWidth: 0.3, // px (absolute)
    },
    columnGap: 5, // mm - gap between columns
    smallCardGap: 1.5, // mm - gap between small cards
    rowGap: 3, // mm - gap between large and small cards
  },
  
  colors: {
    committed: [33, 150, 243] as [number, number, number], // Blue
    complete: [76, 175, 80] as [number, number, number], // Green
    incomplete: [255, 152, 0] as [number, number, number], // Orange
    cardBackground: [245, 245, 245] as [number, number, number], // Light gray
    smallCardBorder: [220, 220, 220] as [number, number, number], // Border gray
  },
  
  typography: {
    largeCard: {
      title: {
        fontSize: 11, // pt
        fontWeight: 'bold' as const,
        color: [100, 100, 100] as [number, number, number],
      },
      value: {
        fontSize: 24, // pt
        fontWeight: 'normal' as const,
        color: [0, 0, 0] as [number, number, number],
      },
      subtitle: {
        fontSize: 8, // pt
        fontWeight: 'normal' as const,
        color: [120, 120, 120] as [number, number, number],
      },
    },
    smallCard: {
      value: {
        fontSize: 12, // pt
        fontWeight: 'normal' as const,
        color: [0, 0, 0] as [number, number, number],
      },
      label: {
        fontSize: 7, // pt
        fontWeight: 'normal' as const,
        color: [100, 100, 100] as [number, number, number],
      },
    },
  },
};

/**
 * Convert mm to pixels for web display (96 DPI)
 * 1mm = 3.7795275591 pixels at 96 DPI
 */
export function mmToPx(mm: number): number {
  return mm * 3.7795275591;
}

/**
 * Helper to convert RGB array to CSS rgba string
 */
export function rgbToRgba(rgb: [number, number, number], alpha: number = 1): string {
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;
}
