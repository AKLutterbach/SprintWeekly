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
      inProgress?: any[];
      toDo?: any[];
      carryoverBlockers: any[];
    };
  };
  sprintName?: string;
  reportTitle?: string;
  startDate?: string;
  endDate?: string;
  generatedAt?: string;  // Pre-formatted timestamp in the user's local timezone, sent from the frontend
}

/**
 * Format date to "MM/DD/YY" format
 */
function formatDateShort(dateStr: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '';
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const year = String(date.getFullYear()).slice(-2);
  return `${month}/${day}/${year}`;
}

/**
 * Generate PDF export of sprint report
 * Creates a clean, client-ready PDF that mirrors the main report page layout
 */
export async function generatePDF(data: ExportRequest['reportData'], sprintName: string, reportTitle: string, startDate?: string, endDate?: string, generatedAt?: string): Promise<Buffer> {
  const { byStatus, issues } = data;
  // Use the pre-formatted timestamp from the frontend (user's local timezone) if provided.
  // Fall back to server time (UTC) only if not supplied.
  if (!generatedAt) {
    const now = new Date();
    generatedAt = now.toLocaleString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  }
  
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
  // Icon: rounded-square background with blue bar-chart bars inside,
  // matching the style of the reference image (iOS-style chart icon).
  const iconX = margin;
  const iconBoxSize = 8.5;       // outer rounded square size in mm
  const iconBoxRadius = 2.0;     // corner radius of the square

  // Align the icon box so its vertical centre sits alongside the title text.
  // yPos is the title baseline; we offset upward so the box visually centres on it.
  const iconBoxY = yPos - iconBoxSize + 1.5; // top-left Y of the rounded square

  const iconBoxColor: [number, number, number] = [234, 237, 248]; // light periwinkle-gray
  doc.setFillColor(...iconBoxColor);
  doc.roundedRect(iconX, iconBoxY, iconBoxSize, iconBoxSize, iconBoxRadius, iconBoxRadius, 'F');

  // Blue bars inside the icon box — anchored to the box, not to yPos, so they
  // always sit correctly regardless of where the icon is placed on the page.
  const barPad = 2.2;            // equal top & bottom padding inside the box (slightly larger for breathing room)
  const barMaxH = iconBoxSize - 2 * barPad; // tallest possible bar height in mm
  const barBaseY = iconBoxY + iconBoxSize - barPad; // shared bottom edge of all bars
  const barColor: [number, number, number] = [58, 107, 214]; // medium blue
  doc.setFillColor(...barColor);
  const barW = 1.6;
  const barGap = 0.7;
  // Relative heights: progressively increasing left to right
  const barsData = [0.5, 0.75, 1.0];
  // Centre the three bars horizontally within the icon box
  const barsStartX = iconX + (iconBoxSize - (barW * 3 + barGap * 2)) / 2;
  barsData.forEach((rel, i) => {
    const bh = rel * barMaxH;
    const bx = barsStartX + i * (barW + barGap);
    const by = barBaseY - bh; // top-left Y of this bar
    doc.roundedRect(bx, by, barW, bh, 0.4, 0.4, 'F');
  });
  const iconWidth = iconBoxSize;

  // Report title - 22pt bold, offset right of icon, wraps only if truly needed
  const titleX = iconX + iconWidth + 3.5;
  const titleMaxWidth = contentWidth - iconWidth - 3.5;
  doc.setFontSize(22);
  doc.setFont('Inter', 'bold');
  doc.setTextColor(30, 30, 30);
  const titleLines = doc.splitTextToSize(reportTitle, titleMaxWidth);
  doc.text(titleLines, titleX, yPos);
  doc.setTextColor(0, 0, 0);
  const titleHeight = titleLines.length * 8.5;
  yPos += titleHeight;

  // All metric values come from byStatus (backend is single source of truth).
  // No local issue filtering or proportional splitting — just render what the
  // backend already computed.
  const _completeTotal = byStatus?.complete?.total ?? 0;
  const _inProgressTotal = byStatus?.inProgress?.total ?? 0;
  const _toDoTotal = byStatus?.toDo?.total ?? 0;
  const _grandTotal = _completeTotal + _inProgressTotal + _toDoTotal;

  // Sprint name + date + total issues count: left-aligned to margin, muted
  doc.setFontSize(9);
  doc.setFont('Inter', 'normal');
  doc.setTextColor(130, 130, 140);
  let sprintNameWithDate = sprintName;
  const _totalIssueCount = _grandTotal;
  if (startDate && endDate) {
    sprintNameWithDate = `${sprintName}  ·  ${formatDateShort(startDate)} – ${formatDateShort(endDate)}  ·  ${_totalIssueCount} issue${_totalIssueCount !== 1 ? 's' : ''}`;
  } else {
    sprintNameWithDate = `${sprintName}  ·  ${_totalIssueCount} issue${_totalIssueCount !== 1 ? 's' : ''}`;
  }
  doc.text(sprintNameWithDate, margin, yPos);
  doc.setTextColor(0, 0, 0);
  yPos += 6;

  yPos += 6;  // spacing before Sprint Overview (progress bar removed)

  // ========== SPRINT METRICS SECTION ==========
  checkPageBreak(90);
  doc.setFontSize(15);
  doc.setFont('Inter', 'bold');
  doc.setTextColor(30, 30, 30);
  doc.text('Sprint Overview', margin, yPos);
  doc.setTextColor(0, 0, 0);
  yPos += 4;

  // Subtle separator line under the section heading
  doc.setDrawColor(210, 210, 215);
  doc.setLineWidth(0.4);
  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 4;

  // Three-column layout with visual cards - using shared style configuration
  const { layout, colors: cardColors } = METRIC_CARD_STYLES;
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
  const lightComplete = getLightColor(cardColors.complete);
  // In Progress uses blue; To Do uses gray
  const lightInProgress: [number, number, number] = getLightColor([66, 133, 244]);
  const lightToDo: [number, number, number] = getLightColor([107, 119, 140]);
  
  // Helper function to draw a rounded rectangle card with optional colored border and background
  // Starting Y position for cards
  const cardsY = yPos;

  // === ALL METRIC VALUES FROM BACKEND (single source of truth) ===
  // No local issue filtering or proportional splitting — byStatus contains
  // exact totals and breakdowns computed by report.ts.
  const completeTotal = byStatus?.complete?.total ?? 0;
  const inProgressTotal = byStatus?.inProgress?.total ?? 0;
  const toDoTotal = byStatus?.toDo?.total ?? 0;

  // Helper to extract breakdown array from a byStatus category
  const getBreakdown = (category: any) => [
    { label: 'From last\nsprint', value: category?.breakdown?.fromLastSprint || 0 },
    { label: 'Planned at\nstart', value: category?.breakdown?.plannedAtStart || 0 },
    { label: 'Added mid-\nsprint', value: category?.breakdown?.addedMidSprint || 0 }
  ];
  
  const columns = [
    {
      x: margin,
      title: 'Complete',
      value: completeTotal,
      subtitle: 'Issues finished by the end of this sprint',
      color: lightComplete,
      backgroundColor: cardColors.completeBackground,
      breakdown: getBreakdown(byStatus?.complete)
    },
    {
      x: margin + columnWidth + columnGap,
      title: 'In Progress',
      value: inProgressTotal,
      subtitle: 'Issues actively being worked on',
      color: lightInProgress,
      backgroundColor: [232, 240, 254] as [number, number, number],
      breakdown: getBreakdown(byStatus?.inProgress)
    },
    {
      x: margin + (columnWidth * 2) + (columnGap * 2),
      title: 'To Do',
      value: toDoTotal,
      subtitle: 'Issues not yet started',
      color: lightToDo,
      backgroundColor: [240, 242, 245] as [number, number, number],
      breakdown: getBreakdown(byStatus?.toDo)
    }
  ];

  // Accent colors for the top strip of each card - pulled from the column definition
  const cardAccentColors: [number, number, number][] = [
    [76, 175, 80],   // Complete - green
    [66, 133, 244],  // In Progress - blue
    [107, 119, 140]  // To Do - gray
  ];

  columns.forEach((col, colIdx) => {
    const accentColor = cardAccentColors[colIdx];
    const accentH = 0.88;  // height of colored top accent strip in mm (1.25 * 0.7)

    // ---- LARGE CARD: white background, subtle border, colored top accent ----
    // White card fill
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(220, 220, 225);
    doc.setLineWidth(0.4);
    doc.roundedRect(col.x, cardsY, columnWidth, largeCardHeight, cardRadius, cardRadius, 'FD');

    // Colored top accent strip (covers top border, sits inside card)
    doc.setFillColor(...accentColor);
    // Draw as filled rounded rect on top, then a plain rect to square off the bottom half
    doc.roundedRect(col.x, cardsY, columnWidth, accentH + cardRadius, cardRadius, cardRadius, 'F');
    doc.rect(col.x, cardsY + accentH, columnWidth, cardRadius, 'F'); // fill bottom half of rounded region

    // Status label - 10pt, semibold, muted dark
    doc.setFontSize(10);
    doc.setFont('Inter', 'bold');
    doc.setTextColor(90, 90, 100);
    doc.text(col.title, col.x + (columnWidth / 2), cardsY + accentH + 8, { align: 'center' });

    // Large count number - 30pt
    doc.setFontSize(30);
    doc.setFont('Inter', 'bold');
    doc.setTextColor(20, 20, 20);
    doc.text(String(col.value), col.x + (columnWidth / 2), cardsY + accentH + 20, { align: 'center' });

    // Subtitle - 7.5pt muted
    doc.setFontSize(7.5);
    doc.setFont('Inter', 'normal');
    doc.setTextColor(140, 140, 150);
    const subtitle = doc.splitTextToSize(col.subtitle, columnWidth - 6);
    doc.text(subtitle, col.x + (columnWidth / 2), cardsY + accentH + 27, { align: 'center' });
    doc.setTextColor(0, 0, 0);

    // ---- SMALL BREAKDOWN CARDS: cleaner look with subtle top separator ----
    const smallCardsY = cardsY + largeCardHeight + layout.rowGap;

    col.breakdown.forEach((item, idx) => {
      const smallCardX = col.x + (idx * (smallCardWidth + smallCardGap));

      // White fill, subtle border
      doc.setFillColor(252, 252, 253);
      doc.setDrawColor(225, 225, 230);
      doc.setLineWidth(0.3);
      doc.roundedRect(smallCardX, smallCardsY, smallCardWidth, smallCardHeight, smallCardRadius, smallCardRadius, 'FD');

      // Number - 11pt bold (no colored separator line)
      doc.setFontSize(11);
      doc.setFont('Inter', 'bold');
      doc.setTextColor(25, 25, 30);
      doc.text(String(item.value), smallCardX + (smallCardWidth / 2), smallCardsY + 7.5, { align: 'center' });

      // Label - 6.5pt muted
      doc.setFontSize(6.5);
      doc.setFont('Inter', 'normal');
      doc.setTextColor(130, 130, 140);
      doc.text(item.label, smallCardX + (smallCardWidth / 2), smallCardsY + 12, { align: 'center' });
      doc.setTextColor(0, 0, 0);
    });
  });
  
  // Move Y position down past all the cards
  yPos = cardsY + largeCardHeight + layout.rowGap + smallCardHeight + 15; // Added extra space before issue lists

  // ========== SPRINT STATUS DETAIL SECTION ==========
  checkPageBreak(90);
  doc.setFontSize(15);
  doc.setFont('Inter', 'bold');
  doc.setTextColor(30, 30, 30);
  doc.text('Sprint Status Detail', margin, yPos);
  doc.setTextColor(0, 0, 0);
  yPos += 4;

  // Subtle separator line under the section heading
  doc.setDrawColor(210, 210, 215);
  doc.setLineWidth(0.4);
  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 2;

  // ========== TABLE LAYOUT CONSTANTS ==========
  const HEADER_ROW_HEIGHT = 6;
  const HEADER_PADDING_TOP = 2;
  const TABLE_SECTION_SPACING = 8;
  const MIN_ROW_HEIGHT = 5;
  const ROW_PADDING_TOP = 1.0;
  const ROW_PADDING_BOTTOM = 1.0;
  const ROW_SEPARATOR_HEIGHT = 0;
  const SECTION_PADDING_TOP = 4;  // Top padding for table container header
  const SECTION_PADDING_BOTTOM = 1;  // Tight bottom padding for table container
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

  // Helper function to draw table header - lighter background, thinner bottom border
  const drawTableHeader = (keyColX: number, summaryColX: number, statusColX: number) => {
    const headerCellTop = yPos;
    // Lighter gray header background
    doc.setFillColor(244, 245, 247);
    doc.rect(margin - 3, headerCellTop, contentWidth + 6, HEADER_ROW_HEIGHT, 'F');

    doc.setFontSize(8.5);
    doc.setFont('Inter', 'bold');
    doc.setTextColor(70, 70, 80);
    const headerTextY = headerCellTop + HEADER_ROW_HEIGHT - HEADER_PADDING_TOP;
    doc.text('KEY', keyColX + 2, headerTextY);
    doc.text('SUMMARY', summaryColX + 2, headerTextY);
    doc.text('STATUS', statusColX + 2, headerTextY);
    doc.setTextColor(0, 0, 0);
    yPos = headerCellTop + HEADER_ROW_HEIGHT;

    // Thinner separator below header
    doc.setDrawColor(215, 217, 222);
    doc.setLineWidth(0.25);
    doc.line(margin - 3, yPos, pageWidth - margin + 3, yPos);
    yPos += 2;
  };

  // ========== HELPER FUNCTION FOR ISSUE TABLES ==========
  const drawIssueTable = (title: string, issueList: any[], badgeColor: [number, number, number]) => {
    // Helper to draw section header (title + badge + table header)
    const drawSectionHeader = () => {
      const sectionStartY = yPos;
      
      // Add padding before section content
      yPos += SECTION_PADDING_TOP;
      
      // Store pill position for title and badge centering
      const pillY = yPos;
      
      // Draw colored background bar starting at container top
      const colorBarHeight = SECTION_PADDING_TOP + PILL_TO_TABLE_SPACING;
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
      const containerEndY = yPos + SECTION_PADDING_BOTTOM;
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
      // Compact empty state: just enough height for a single text row, no grey fill.
      const textYPos = yPos + 3;
      yPos += 3;
      yPos += 7;   // single-row height
      yPos += SECTION_PADDING_BOTTOM;
      
      // Close section container (draws border only, no fill)
      closeSectionContainer(currentPageSectionStart, true, true);
      
      // Redraw colored header bar on top
      const colorBarHeight = SECTION_PADDING_TOP + PILL_TO_TABLE_SPACING;
      doc.setFillColor(...getLightColor(badgeColor));
      drawTopRoundedRect(margin - 3, currentPageSectionStart, contentWidth + 6, colorBarHeight, containerBorderRadius);
      
      const pillY = currentPageSectionStart + SECTION_PADDING_TOP;
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
      if (yPos + totalRowSpace + SECTION_PADDING_BOTTOM > maxY) {
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

      // Issue key - bold, indigo accent color for clickability feel
      doc.setFont('Inter', 'bold');
      doc.setTextColor(80, 80, 180);
      doc.text(key, keyColX + 2, textStartY);

      // Summary - normal weight, near-black
      doc.setFont('Inter', 'normal');
      doc.setTextColor(35, 35, 40);
      doc.text(summaryLines, summaryColX + 2, textStartY);

      // ---- STATUS PILL BADGE ----
      // Detect status type and pick pill colors accordingly
      const statusLower = status.toLowerCase();
      let pillBg: [number, number, number];
      let pillText: [number, number, number];
      if (statusLower.includes('done') || statusLower.includes('complete') || statusLower.includes('closed') || statusLower.includes('resolved')) {
        pillBg = [220, 245, 220];   // light green
        pillText = [30, 120, 40];
      } else if (statusLower.includes('progress') || statusLower.includes('review') || statusLower.includes('testing')) {
        pillBg = [219, 234, 254];   // light blue
        pillText = [29, 78, 216];
      } else {
        pillBg = [237, 238, 242];   // light gray
        pillText = [75, 80, 95];
      }
      const pillPadH = 1.8;
      const pillPadV = 0.9;
      doc.setFontSize(7.5);
      doc.setFont('Inter', 'bold');
      const pillTextW = doc.getTextWidth(status);
      const pillW = pillTextW + pillPadH * 2;
      const pillH = 4.2;
      const pillX = statusColX + 2;
      const pillY = textStartY - pillH + pillPadV + 1;
      doc.setFillColor(...pillBg);
      // Fully pill-shaped: radius = half the height
      doc.roundedRect(pillX, pillY, pillW, pillH, pillH / 2, pillH / 2, 'F');
      doc.setTextColor(...pillText);
      doc.text(status, pillX + pillPadH, pillY + pillH - pillPadV - 0.3);
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(9);

      // Move past the entire row
      yPos += rowHeight;

      // Subtle row separator line between rows
      if (index < issueList.length - 1) {
        doc.setDrawColor(235, 235, 240);
        doc.setLineWidth(0.3);
        doc.line(margin, yPos, pageWidth - margin, yPos);
      }
    });
    
    yPos += SECTION_PADDING_BOTTOM;
    
    // Close final page's section container (this is the last page)
    closeSectionContainer(currentPageSectionStart, isFirstPageSegment, true);
  };

  // Add spacing before first table
  yPos += 3;

  // ========== COMPLETE ISSUES SECTION ==========
  drawIssueTable('Complete', issues.completed, [87, 199, 115]); // Green - completed issues
  yPos += TABLE_SECTION_SPACING;

  // ========== IN PROGRESS ISSUES SECTION ==========
  // Use pre-split issue lists from the backend (single source of truth) so the
  // detail table always matches the metric card totals from byStatus.
  const inProgressIssueList = issues.inProgress || issues.uncompleted.filter((i: any) =>
    (i.status || i.fields?.status?.name || '').toLowerCase().includes('progress')
  );
  drawIssueTable('In Progress', inProgressIssueList, [66, 133, 244]); // Blue - in progress
  yPos += TABLE_SECTION_SPACING;

  // ========== TO DO ISSUES SECTION ==========
  const toDoIssueList = issues.toDo || issues.uncompleted.filter((i: any) =>
    !(i.status || i.fields?.status?.name || '').toLowerCase().includes('progress')
  );
  drawIssueTable('To Do', toDoIssueList, [107, 119, 140]); // Gray - not yet started

  // ========== FOOTER ON ALL PAGES ==========
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);

    // Subtle separator line above footer
    doc.setDrawColor(210, 210, 215);
    doc.setLineWidth(0.3);
    doc.line(margin, pageHeight - 14, pageWidth - margin, pageHeight - 14);

    // Footer text - muted, consistent sizing
    doc.setFontSize(7.5);
    doc.setFont('Inter', 'normal');
    doc.setTextColor(160, 160, 165);
    doc.text(`Generated ${generatedAt} by `, margin, pageHeight - 10);
    const nonBoldWidth = doc.getTextWidth(`Generated ${generatedAt} by `);
    doc.setFont('Inter', 'bold');
    doc.setTextColor(130, 130, 140);
    doc.text('Smart Sprints for Jira', margin + nonBoldWidth, pageHeight - 10);
    doc.setFont('Inter', 'normal');
    doc.setTextColor(160, 160, 165);
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - margin, pageHeight - 10, { align: 'right' });
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
  lines.push('Smart Sprints Report');
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
      const pdfBuffer = await generatePDF(reportData, sprintName || 'Sprint Report', reportTitle || 'Smart Sprints Report', payload.startDate, payload.endDate, payload.generatedAt);
      
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
