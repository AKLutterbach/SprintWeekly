// Export limits and cache TTL for Sprint Weekly
// These defaults are chosen to balance performance and usability.

export const CSV_MAX_ISSUES = 5000; // maximum number of issues exported to CSV
export const CSV_MAX_BYTES = 10 * 1024 * 1024; // 10 MB

export const PDF_MAX_ISSUES = 2000; // maximum number of issues rendered into a PDF
export const PDF_MAX_BYTES = 5 * 1024 * 1024; // 5 MB

// Report cache TTL in seconds (30 minutes)
export const REPORT_CACHE_TTL_SECONDS = 30 * 60;

// Exported defaults object for convenience
export default {
  CSV_MAX_ISSUES,
  CSV_MAX_BYTES,
  PDF_MAX_ISSUES,
  PDF_MAX_BYTES,
  REPORT_CACHE_TTL_SECONDS
};
