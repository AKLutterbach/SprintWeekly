/**
 * Export resolver - generates PDF and CSV exports of sprint reports
 * PDF uses jsPDF library which works in serverless environments
 * Uses Inter font embedded in the PDF for consistent rendering
 */

import { jsPDF } from 'jspdf';
import { METRIC_CARD_STYLES } from '../config/metricCardStyles';
import interRegular from '../assets/fonts/inter-regular.base64';
import interSemiBold from '../assets/fonts/inter-semibold.base64';

interface ExportRequest {
  format: 'pdf' | 'csv';
  reportData: {
    requestId: string;
    generatedAt: string;
    scope: { type: string; id: string };
    metrics: any;
    byStatus?: any;
    issues: {
      completed: any[];
      uncompleted: any[];
      carryoverBlockers: any[];
    };
  };
  sprintName?: string;
  reportTitle?: string;
  startDate?: string;
  endDate?: string;
}

/**
 * Format date from ISO string or YYYY-MM-DD to "Mon DD, YYYY" format
 */
function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  // Handle both ISO datetime strings (2025-11-11T03:39:27.522Z) and simple date strings (2025-11-11)
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return 'Invalid Date';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * Generate PDF export of sprint report
 * Creates a clean, client-ready PDF that mirrors the main report page layout
 */
async function generatePDF(data: ExportRequest['reportData'], sprintName: string, reportTitle: string, startDate?: string, endDate?: string): Promise<Buffer> {
  const { metrics, byStatus, issues } = data;
  // Format date without seconds: MM/DD/YYYY, HH:MM AM/PM
  const now = new Date();
  const generatedAt = now.toLocaleString('en-US', { 
    month: '2-digit', 
    day: '2-digit', 
    year: 'numeric', 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: true 
  });
  
  // Create new PDF document
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  // Register Inter font and embed it in the PDF
  if (interRegular && interSemiBold) {
    doc.addFileToVFS('Inter-Regular.ttf', interRegular);
    doc.addFont('Inter-Regular.ttf', 'Inter', 'normal');
    
    doc.addFileToVFS('Inter-SemiBold.ttf', interSemiBold);
    doc.addFont('Inter-SemiBold.ttf', 'Inter', 'bold');
  }

  let yPos = 25;
  const pageHeight = doc.internal.pageSize.height;
  const pageWidth = doc.internal.pageSize.width;
  const margin = 20;
  const bottomMargin = 20;
  const contentWidth = pageWidth - (margin * 2);
  const maxY = pageHeight - bottomMargin;

  // Helper to check if we need a new page
  const checkPageBreak = (neededSpace: number = 10) => {
    if (yPos + neededSpace > maxY) {
      doc.addPage();
      yPos = 25;
    }
  };

  // ========== HEADER ==========
  // Left side: Title and sprint name
  // Right side: Reporting period and generated timestamp (smaller, 3 lines)
  const headerStartY = yPos;
  
  // Left side - Report title
  doc.setFontSize(24);
  doc.setFont('Inter', 'bold');
  doc.setTextColor(49, 49, 49);  // #313131
  // Don't wrap title - let it extend to the right margin area
  doc.text(reportTitle, margin, yPos);
  doc.setTextColor(0, 0, 0);
  const titleHeight = 9;
  
  // Right side - Reporting period (smaller text, 2 lines)
  // Calculate offset so top of 8pt text aligns with top of 24pt text
  // Font size difference creates baseline difference; adjust by ~16pt to align tops
  const rightX = pageWidth - margin;
  let rightY = headerStartY - 16;
  doc.setFontSize(8);
  doc.setFont('Inter', 'italic');
  doc.setTextColor(150, 150, 150);  // Match footer text color
  
  // Line 1: "Reporting period:"
  doc.text('Reporting period:', rightX, rightY, { align: 'right' });
  rightY += 3.5;
  
  // Line 2: Date range
  if (startDate && endDate) {
    doc.text(`${formatDate(startDate)} - ${formatDate(endDate)}`, rightX, rightY, { align: 'right' });
  }
  doc.setTextColor(0, 0, 0);
  
  // Move yPos past the title (reduced spacing by 2pt: was 9, now 7)
  yPos += titleHeight - 2;
  
  // Left side - Sprint name (increased font size by 3pt: was 10, now 13)
  doc.setFontSize(13);
  doc.setFont('Inter', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text(sprintName, margin, yPos);
  doc.setTextColor(0, 0, 0);
  yPos += 10;

  // ========== SPRINT METRICS SECTION ==========
  checkPageBreak(90);
  doc.setFontSize(16);
  doc.setFont('Inter', 'bold');
  doc.setTextColor(49, 49, 49);  // #313131
  doc.text('Sprint Status Overview', margin, yPos);
  doc.setTextColor(0, 0, 0);
  yPos += 4;

  // Draw a subtle separator line
  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.3);
  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 2;

  // Three-column layout with visual cards - using shared style configuration
  const { layout, colors: cardColors, typography } = METRIC_CARD_STYLES;
  const columnGap = layout.columnGap;
  const columnWidth = (contentWidth - (columnGap * 2)) / 3;
  const largeCardHeight = layout.largeCard.height;
  const smallCardGap = layout.smallCardGap;
  const smallCardWidth = (columnWidth - (smallCardGap * 2)) / 3;
  const smallCardHeight = layout.smallCard.height;
  const cardRadius = layout.largeCard.borderRadius;
  const smallCardRadius = layout.smallCard.borderRadius;
  
  // Helper to calculate light color (80% blend with white) - matches table header backgrounds
  const getLightColor = (color: [number, number, number]): [number, number, number] => [
    Math.round(color[0] * 0.2 + 255 * 0.8),
    Math.round(color[1] * 0.2 + 255 * 0.8),
    Math.round(color[2] * 0.2 + 255 * 0.8)
  ];
  
  // Use light pastel colors for metric card borders (same as table header backgrounds)
  // Committed uses 40% white blend to balance visibility with lightness
  const lightCommitted: [number, number, number] = [
    Math.round(cardColors.committed[0] * 0.6 + 255 * 0.4),
    Math.round(cardColors.committed[1] * 0.6 + 255 * 0.4),
    Math.round(cardColors.committed[2] * 0.6 + 255 * 0.4)
  ];
  const lightComplete = getLightColor(cardColors.complete);
  const lightIncomplete = getLightColor(cardColors.incomplete);
  
  // Helper function to draw a rounded rectangle card with optional colored border and background
  const drawCard = (x: number, y: number, w: number, h: number, borderColor?: [number, number, number], isSmall: boolean = false, backgroundColor?: [number, number, number]) => {
    // Use provided background color, or default to light gray for small cards
    const [r, g, b] = backgroundColor || cardColors.cardBackground;
    doc.setFillColor(r, g, b);
    
    const radius = isSmall ? smallCardRadius : cardRadius;
    
    // Set border color
    if (borderColor) {
      const [br, bg, bb] = borderColor;
      doc.setDrawColor(br, bg, bb);
      doc.setLineWidth(layout.largeCard.borderWidth);
      doc.roundedRect(x, y, w, h, radius, radius, 'FD');
    } else {
      const [dbr, dbg, dbb] = cardColors.smallCardBorder;
      doc.setDrawColor(dbr, dbg, dbb);
      doc.setLineWidth(layout.smallCard.borderWidth);
      doc.roundedRect(x, y, w, h, radius, radius, 'FD');
    }
  };

  // Starting Y position for cards
  const cardsY = yPos;

  // === PROCESS EACH COLUMN ===
  // Use byStatus if available (new structure), otherwise fall back to metrics (old structure)
  const committedTotal = byStatus?.committed?.total ?? (metrics.committedAtStart || 0);
  const completeTotal = byStatus?.complete?.total ?? (metrics.completed || 0);
  const incompleteTotal = byStatus?.incomplete?.total ?? (metrics.incompleteCarryover || 0);
  
  const columns = [
    {
      x: margin,
      title: 'Committed',
      value: committedTotal,
      subtitle: 'Issues the team committed to this sprint',
      color: lightCommitted,
      backgroundColor: cardColors.committedBackground,
      breakdown: [
        { label: 'From last\nsprint', value: byStatus?.committed?.breakdown?.fromLastSprint ?? (metrics.committedCarryover || 0) },
        { label: 'Planned at\nstart', value: byStatus?.committed?.breakdown?.plannedAtStart ?? Math.max(0, (metrics.committedAtStart || 0) - (metrics.committedCarryover || 0) - (metrics.addedMidSprint || 0)) },
        { label: 'Added mid-\nsprint', value: byStatus?.committed?.breakdown?.addedMidSprint ?? (metrics.addedMidSprint || 0) }
      ]
    },
    {
      x: margin + columnWidth + columnGap,
      title: 'Complete',
      value: completeTotal,
      subtitle: 'Issues finished by the end of this sprint',
      color: lightComplete,
      backgroundColor: cardColors.completeBackground,
      breakdown: byStatus?.complete?.breakdown ? [
        { label: 'From last\nsprint', value: byStatus.complete.breakdown.fromLastSprint || 0 },
        { label: 'Planned at\nstart', value: byStatus.complete.breakdown.plannedAtStart || 0 },
        { label: 'Added mid-\nsprint', value: byStatus.complete.breakdown.addedMidSprint || 0 }
      ] : (() => {
        const completedTotal = metrics.completed || 0;
        const committedTotal = metrics.committedAtStart || 0;
        return [
          { label: 'From last\nsprint', value: committedTotal > 0 ? Math.round(completedTotal * ((metrics.committedCarryover || 0) / committedTotal)) : 0 },
          { label: 'Planned at\nstart', value: committedTotal > 0 ? Math.round(completedTotal * (Math.max(0, committedTotal - (metrics.committedCarryover || 0) - (metrics.addedMidSprint || 0)) / committedTotal)) : completedTotal },
          { label: 'Added mid-\nsprint', value: committedTotal > 0 ? Math.round(completedTotal * ((metrics.addedMidSprint || 0) / committedTotal)) : 0 }
        ];
      })()
    },
    {
      x: margin + (columnWidth * 2) + (columnGap * 2),
      title: 'Incomplete',
      value: incompleteTotal,
      subtitle: 'Issues not finished by the end of this sprint',
      color: lightIncomplete,
      backgroundColor: cardColors.incompleteBackground,
      breakdown: byStatus?.incomplete?.breakdown ? [
        { label: 'From last\nsprint', value: byStatus.incomplete.breakdown.fromLastSprint || 0 },
        { label: 'Planned at\nstart', value: byStatus.incomplete.breakdown.plannedAtStart || 0 },
        { label: 'Added mid-\nsprint', value: byStatus.incomplete.breakdown.addedMidSprint || 0 }
      ] : (() => {
        const incompleteTotal = metrics.incompleteCarryover || 0;
        const committedTotal = metrics.committedAtStart || 0;
        return [
          { label: 'From last\nsprint', value: committedTotal > 0 ? Math.round(incompleteTotal * ((metrics.committedCarryover || 0) / committedTotal)) : 0 },
          { label: 'Planned at\nstart', value: committedTotal > 0 ? Math.round(incompleteTotal * (Math.max(0, committedTotal - (metrics.committedCarryover || 0) - (metrics.addedMidSprint || 0)) / committedTotal)) : incompleteTotal },
          { label: 'Added mid-\nsprint', value: committedTotal > 0 ? Math.round(incompleteTotal * ((metrics.addedMidSprint || 0) / committedTotal)) : 0 }
        ];
      })()
    }
  ];

  columns.forEach(col => {
    // Large card with color and background
    drawCard(col.x, cardsY, columnWidth, largeCardHeight, col.color, false, col.backgroundColor);
    doc.setFontSize(typography.largeCard.title.fontSize);
    doc.setFont('Inter', typography.largeCard.title.fontWeight);
    const [tr, tg, tb] = typography.largeCard.title.color;
    doc.setTextColor(tr, tg, tb);
    doc.text(col.title, col.x + (columnWidth / 2), cardsY + 8, { align: 'center' });
    
    doc.setFontSize(typography.largeCard.value.fontSize);
    doc.setFont('Inter', typography.largeCard.value.fontWeight);
    const [vr, vg, vb] = typography.largeCard.value.color;
    doc.setTextColor(vr, vg, vb);
    doc.text(String(col.value), col.x + (columnWidth / 2), cardsY + 18, { align: 'center' });
    
    doc.setFontSize(typography.largeCard.subtitle.fontSize);
    const [sr, sg, sb] = typography.largeCard.subtitle.color;
    doc.setTextColor(sr, sg, sb);
    const subtitle = doc.splitTextToSize(col.subtitle, columnWidth - 8);
    doc.text(subtitle, col.x + (columnWidth / 2), cardsY + 26, { align: 'center' });
    doc.setTextColor(0, 0, 0);
    
    // Small breakdown cards - HORIZONTAL layout (3 cards side by side)
    const smallCardsY = cardsY + largeCardHeight + layout.rowGap;
    
    col.breakdown.forEach((item, idx) => {
      const smallCardX = col.x + (idx * (smallCardWidth + smallCardGap));
      
      drawCard(smallCardX, smallCardsY, smallCardWidth, smallCardHeight, undefined, true);
      
      doc.setFontSize(typography.smallCard.value.fontSize);
      doc.setFont('Inter', typography.smallCard.value.fontWeight);
      const [svr, svg, svb] = typography.smallCard.value.color;
      doc.setTextColor(svr, svg, svb);
      doc.text(String(item.value), smallCardX + (smallCardWidth / 2), smallCardsY + 7, { align: 'center' });
      
      doc.setFontSize(typography.smallCard.label.fontSize);
      const [slr, slg, slb] = typography.smallCard.label.color;
      doc.setTextColor(slr, slg, slb);
      doc.text(item.label, smallCardX + (smallCardWidth / 2), smallCardsY + 11, { align: 'center' });
      doc.setTextColor(0, 0, 0);
    });
  });
  
  // Move Y position down past all the cards
  yPos = cardsY + largeCardHeight + layout.rowGap + smallCardHeight + 15; // Added extra space before issue lists

  // ========== SPRINT STATUS DETAIL SECTION ==========
  checkPageBreak(90);
  doc.setFontSize(14);
  doc.setFont('Inter', 'bold');
  doc.setTextColor(49, 49, 49);  // #313131ff
  doc.text('Sprint Status Detail', margin, yPos);
  doc.setTextColor(0, 0, 0);
  yPos += 4;

  // Draw a subtle separator line
  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.3);
  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 0;

  // ========== TABLE LAYOUT CONSTANTS ==========
  const HEADER_ROW_HEIGHT = 6;
  const HEADER_PADDING_TOP = 2;
  const TABLE_SECTION_SPACING = 8;
  const MIN_ROW_HEIGHT = 5;
  const ROW_PADDING_TOP = 1.0;
  const ROW_PADDING_BOTTOM = 1.0;
  const ROW_SEPARATOR_HEIGHT = 0;
  const SECTION_PADDING = 4;
  const PILL_TO_TABLE_SPACING = 8;

  // Helper to draw rectangle with only top corners rounded
  const drawTopRoundedRect = (x: number, y: number, w: number, h: number, r: number, strokeMode: boolean = false) => {
    if (strokeMode) {
      // For borders: just draw a complete rounded rectangle
      // jsPDF doesn't handle partial rounding well, so we'll accept fully rounded for now
      doc.roundedRect(x, y, w, h, r, r, 'S');
    } else {
      // For fills: draw filled rectangles
      doc.rect(x, y + r, w, h - r, 'F');
      doc.roundedRect(x, y, w, r * 2, r, r, 'F');
    }
  };
  
  // Helper to draw rectangle with only bottom corners rounded
  const drawBottomRoundedRect = (x: number, y: number, w: number, h: number, r: number) => {
    // For borders: just draw a complete rounded rectangle
    // jsPDF doesn't handle partial rounding well, so we'll accept fully rounded for now
    doc.roundedRect(x, y, w, h, r, r, 'S');
  };
  
  // Convert 5px to mm for consistent border radius (1px ≈ 0.264mm, so 5px ≈ 1.32mm)
  const containerBorderRadius = 1.32;

  // Helper function to draw table header
  const drawTableHeader = (keyColX: number, summaryColX: number, statusColX: number) => {
    const headerCellTop = yPos;
    doc.setFontSize(9);
    doc.setFont('Inter', 'bold');
    doc.setFillColor(245, 245, 245);
    // Extend header background to container edges
    doc.rect(margin - 3, headerCellTop, contentWidth + 6, HEADER_ROW_HEIGHT, 'F');
    
    // Vertically align text to bottom of header cell
    const headerTextY = headerCellTop + HEADER_ROW_HEIGHT - HEADER_PADDING_TOP;
    
    doc.text('Key', keyColX + 2, headerTextY);
    doc.text('Summary', summaryColX + 2, headerTextY);
    doc.text('Status', statusColX + 2, headerTextY);
    yPos = headerCellTop + HEADER_ROW_HEIGHT;
    
    // Draw separator line at bottom of header - extend to container edges
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.4);
    doc.line(margin - 3, yPos, pageWidth - margin + 3, yPos);
    yPos += 2;
  };

  // ========== HELPER FUNCTION FOR ISSUE TABLES ==========
  const drawIssueTable = (title: string, issueList: any[], badgeColor: [number, number, number]) => {
    // Helper to draw section header (title + badge + table header)
    const drawSectionHeader = () => {
      const sectionStartY = yPos;
      
      // Add padding before section content
      yPos += SECTION_PADDING;
      
      // Store pill position for title and badge centering
      const pillY = yPos;
      
      // Draw colored background bar starting at container top
      const colorBarHeight = SECTION_PADDING + PILL_TO_TABLE_SPACING;
      doc.setFillColor(...getLightColor(badgeColor));
      // Always draw with rounded top for visual consistency
      drawTopRoundedRect(margin - 3, sectionStartY, contentWidth + 6, colorBarHeight, containerBorderRadius);
      
      // Calculate centered Y position for title text baseline
      const titleTextY = pillY + (PILL_TO_TABLE_SPACING / 2);
      
      // Draw badge with count - centered at same height as title
      const badgeWidth = 6;
      const badgeHeight = 5;
      const badgeY = titleTextY - (badgeHeight / 2) - 2;
      
      // Draw badge with 50% transparency
      doc.setGState(new (doc as any).GState({ opacity: 0.5 }));
      doc.setFillColor(...badgeColor);
      doc.roundedRect(margin, badgeY, badgeWidth, badgeHeight, 1, 1, 'F');
      doc.setGState(new (doc as any).GState({ opacity: 1.0 }));
      
      doc.setFontSize(8);
      doc.setFont('Inter', 'bold');
      doc.setTextColor(255, 255, 255);
      doc.text(String(issueList.length), margin + (badgeWidth / 2), badgeY + (badgeHeight / 2) + 1, { align: 'center' });
      doc.setTextColor(0, 0, 0);
      
      // Move down to reserve space for title
      yPos += PILL_TO_TABLE_SPACING;
      
      // Section title
      doc.setFontSize(14);
      doc.setFont('Inter', 'bold');
      doc.text(title, margin + badgeWidth + 3, titleTextY);
      
      return sectionStartY;
    };
    
    // Helper to close out current page's section container
    const closeSectionContainer = (containerStartY: number, isFirstPage: boolean, isLastPage: boolean) => {
      const containerEndY = yPos + SECTION_PADDING;
      const containerHeight = containerEndY - containerStartY;
      
      // Draw section border with appropriate corner rounding
      doc.setDrawColor(...getLightColor(badgeColor));
      doc.setLineWidth(0.2);
      
      if (isFirstPage && isLastPage) {
        // Single-page section: all corners rounded
        doc.roundedRect(margin - 3, containerStartY, contentWidth + 6, containerHeight, containerBorderRadius, containerBorderRadius, 'S');
      } else if (isFirstPage) {
        // First page of multi-page: top rounded, bottom square
        drawTopRoundedRect(margin - 3, containerStartY, contentWidth + 6, containerHeight, containerBorderRadius, true);
      } else if (isLastPage) {
        // Last page of multi-page: top square, bottom rounded
        drawBottomRoundedRect(margin - 3, containerStartY, contentWidth + 6, containerHeight, containerBorderRadius);
      } else {
        // Middle page: all square corners
        doc.rect(margin - 3, containerStartY, contentWidth + 6, containerHeight, 'S');
      }
      
      doc.setDrawColor(0, 0, 0);
    };
    
    // Check if we have space for section header (minimum 30mm)
    checkPageBreak(30);
    
    // Draw initial section header
    let currentPageSectionStart = drawSectionHeader();
    let isFirstPageSegment = true;
    
    if (issueList.length === 0) {
      const textYPos = yPos + 6;
      yPos += 6;
      yPos += 14;
      yPos += SECTION_PADDING;
      
      // Draw grey background filling entire container first
      // Note: closeSectionContainer adds SECTION_PADDING to yPos, so we match that here
      const containerHeight = (yPos + SECTION_PADDING) - currentPageSectionStart;
      doc.setFillColor(245, 245, 245);
      doc.roundedRect(margin - 3, currentPageSectionStart, contentWidth + 6, containerHeight, containerBorderRadius, containerBorderRadius, 'F');
      
      // Close section container for empty table (draws border)
      closeSectionContainer(currentPageSectionStart, true, true);
      
      // Redraw colored header bar on top
      const colorBarHeight = SECTION_PADDING + PILL_TO_TABLE_SPACING;
      doc.setFillColor(...getLightColor(badgeColor));
      drawTopRoundedRect(margin - 3, currentPageSectionStart, contentWidth + 6, colorBarHeight, containerBorderRadius);
      
      const pillY = currentPageSectionStart + SECTION_PADDING;
      const titleTextY = pillY + (PILL_TO_TABLE_SPACING / 2);
      const badgeWidth = 6;
      const badgeHeight = 5;
      const badgeY = titleTextY - (badgeHeight / 2) - 2;
      
      doc.setGState(new (doc as any).GState({ opacity: 0.5 }));
      doc.setFillColor(...badgeColor);
      doc.roundedRect(margin, badgeY, badgeWidth, badgeHeight, 1, 1, 'F');
      doc.setGState(new (doc as any).GState({ opacity: 1.0 }));
      doc.setFontSize(8);
      doc.setFont('Inter', 'bold');
      doc.setTextColor(255, 255, 255);
      doc.text(String(issueList.length), margin + (badgeWidth / 2), badgeY + (badgeHeight / 2) + 1, { align: 'center' });
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(14);
      doc.setFont('Inter', 'bold');
      doc.text(title, margin + badgeWidth + 3, titleTextY);
      
      doc.setFontSize(11);
      doc.setFont('Inter', 'italic');
      doc.setTextColor(90, 90, 90);
      doc.text('No issues in this category', margin + 3, textYPos + 4);
      doc.setTextColor(0, 0, 0);
      
      return;
    }
    
    // Table column positions
    const keyColX = margin;
    const summaryColX = margin + 25;
    const statusColX = pageWidth - margin - 30;
    const summaryWidth = statusColX - summaryColX - 5;
    
    // Draw initial table header
    drawTableHeader(keyColX, summaryColX, statusColX);
    
    // Table rows with smart pagination
    doc.setFont('Inter', 'normal');
    doc.setFontSize(9);
    
    issueList.forEach((issue: any, index: number) => {
      const key = issue.key || '-';
      const summary = issue.summary || issue.fields?.summary || 'No summary';
      const status = issue.status || issue.fields?.status?.name || 'Unknown';
      
      // Calculate row height BEFORE checking page break
      const summaryLines = doc.splitTextToSize(summary, summaryWidth);
      const textHeight = Math.max(MIN_ROW_HEIGHT, summaryLines.length * 4);
      const rowHeight = ROW_PADDING_TOP + textHeight + ROW_PADDING_BOTTOM;
      const totalRowSpace = rowHeight + (index < issueList.length - 1 ? ROW_SEPARATOR_HEIGHT : 0);
      
      // Check if entire row fits on current page
      if (yPos + totalRowSpace + SECTION_PADDING > maxY) {
        // Close current page's section container (not last page)
        closeSectionContainer(currentPageSectionStart, isFirstPageSegment, false);
        isFirstPageSegment = false;
        
        // Add new page
        doc.addPage();
        yPos = 25;
        
        // Redraw section header on new page (not first page)
        currentPageSectionStart = drawSectionHeader();
        drawTableHeader(keyColX, summaryColX, statusColX);
      }
      
      // Calculate vertical centering for text within the row
      const cellTop = yPos;
      
      // Draw white background for the row
      doc.setFillColor(255, 255, 255);
      doc.rect(margin, cellTop, contentWidth, rowHeight, 'F');
      
      const textStartY = cellTop + ROW_PADDING_TOP + 3.5;
      
      // Draw the row text
      doc.setFont('Inter', 'bold');
      doc.text(key, keyColX + 2, textStartY);
      
      doc.setFont('Inter', 'normal');
      doc.text(summaryLines, summaryColX + 2, textStartY);
      doc.text(status, statusColX + 2, textStartY);
      
      // Move past the entire row
      yPos += rowHeight;
      
      // Draw subtle row separator
      if (index < issueList.length - 1) {
        doc.setDrawColor(240, 240, 240);
        doc.setLineWidth(ROW_SEPARATOR_HEIGHT);
        doc.line(margin, yPos, pageWidth - margin, yPos);
        yPos += ROW_SEPARATOR_HEIGHT;
      }
    });
    
    yPos += SECTION_PADDING;
    
    // Close final page's section container (this is the last page)
    closeSectionContainer(currentPageSectionStart, isFirstPageSegment, true);
  };

  // Add spacing before first table
  yPos += 3;

  // ========== COMPLETE ISSUES SECTION ==========
  drawIssueTable('Complete', issues.completed, [87, 199, 115]); // Green - completed issues
  yPos += TABLE_SECTION_SPACING;

  // ========== INCOMPLETE ISSUES SECTION ==========
  drawIssueTable('Incomplete', issues.uncompleted.concat(issues.carryoverBlockers || []), [230, 135, 0]); // Darker orange - uncompleted + blocked issues

  // ========== FOOTER ON ALL PAGES ==========
  const pageCount = doc.getNumberOfPages();
  doc.setFontSize(8);
  doc.setFont('Inter', 'italic');
  doc.setTextColor(150, 150, 150);
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    // Non-bold part
    doc.text(`Generated ${generatedAt} by `, margin, pageHeight - 10);
    // Bold part
    const nonBoldWidth = doc.getTextWidth(`Generated ${generatedAt} by `);
    doc.setFont('Inter', 'bold');
    doc.text('Sprint Weekly for Jira', margin + nonBoldWidth, pageHeight - 10);
    // Reset to italic for page numbers
    doc.setFont('Inter', 'italic');
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - margin - 20, pageHeight - 10);
  }

  // Convert to buffer
  const pdfOutput = doc.output('arraybuffer');
  return Buffer.from(pdfOutput);
}

/**
 * Generate CSV export of sprint report
 */
function generateCSV(data: ExportRequest['reportData'], sprintName: string): string {
  const lines: string[] = [];
  
  // Header
  lines.push('Sprint Weekly Report');
  lines.push(`Sprint,${sprintName}`);
  lines.push(`Generated,${new Date(data.generatedAt).toLocaleString()}`);
  lines.push('');
  
  // Metrics
  lines.push('Metrics');
  lines.push('Metric,Value');
  lines.push(`Total Issues,${data.metrics.totalIssues}`);
  lines.push(`Completed Issues,${data.metrics.totalIssues - data.metrics.carryoverIssues}`);
  lines.push(`Carryover Issues,${data.metrics.carryoverIssues}`);
  lines.push(`Total Story Points,${data.metrics.totalStoryPoints}`);
  lines.push(`Completed Story Points,${data.metrics.completedStoryPoints}`);
  lines.push(`Committed Story Points,${data.metrics.committedStoryPoints}`);
  lines.push(`Defects,${data.metrics.defects}`);
  lines.push(`Blocked,${data.metrics.blockedIssues || data.metrics.blockers || 0}`);
  lines.push(`Throughput,${data.metrics.throughput}`);
  lines.push('');
  
  // Issues
  lines.push('Issues');
  lines.push('Key,Summary,Status,Story Points,Category');
  
  data.issues.completed.forEach((issue: any) => {
    const summary = (issue.summary || issue.fields?.summary || '').replace(/,/g, ';');
    const status = issue.status || issue.fields?.status || '';
    const points = issue.storyPoints || issue.fields?.storyPoints || 0;
    lines.push(`${issue.key},"${summary}",${status},${points},Completed`);
  });
  
  data.issues.uncompleted.forEach((issue: any) => {
    const summary = (issue.summary || issue.fields?.summary || '').replace(/,/g, ';');
    const status = issue.status || issue.fields?.status || '';
    const points = issue.storyPoints || issue.fields?.storyPoints || 0;
    lines.push(`${issue.key},"${summary}",${status},${points},Uncompleted`);
  });
  
  data.issues.carryoverBlockers.forEach((issue: any) => {
    const summary = (issue.summary || issue.fields?.summary || '').replace(/,/g, ';');
    const status = issue.status || issue.fields?.status || '';
    const points = issue.storyPoints || issue.fields?.storyPoints || 0;
    lines.push(`${issue.key},"${summary}",${status},${points},Carryover/Blocker`);
  });
  
  return lines.join('\n');
}

/**
 * Main export function
 */
export async function exportReport(req: any): Promise<any> {
  const payload = (req && req.payload) ? req.payload : req;
  const { format, reportData, sprintName, reportTitle } = payload as ExportRequest;

  if (!reportData) {
    return { error: 'No report data provided' };
  }

  try {
    if (format === 'pdf') {
      const pdfBuffer = await generatePDF(reportData, sprintName || 'Sprint Report', reportTitle || 'Sprint Weekly Report', payload.startDate, payload.endDate);
      
      // Return base64 encoded PDF
      return {
        success: true,
        format: 'pdf',
        data: pdfBuffer.toString('base64'),
        filename: `sprint-report-${(sprintName || 'report').replace(/\s+/g, '-')}-${Date.now()}.pdf`
      };
    } else if (format === 'csv') {
      const csvContent = generateCSV(reportData, sprintName || 'Sprint Report');
      
      // Return base64 encoded CSV
      return {
        success: true,
        format: 'csv',
        data: Buffer.from(csvContent).toString('base64'),
        filename: `sprint-report-${sprintName.replace(/\s+/g, '-')}-${Date.now()}.csv`
      };
    } else {
      return { error: 'Invalid format. Use "pdf" or "csv"' };
    }
  } catch (error: any) {
    console.error('Export error:', error);
    return { error: error.message || 'Export failed' };
  }
}

export default {
  exportReport
};
