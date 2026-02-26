// src/utils/pdfExport.js
import { jsPDF } from 'jspdf';
import { save } from '@tauri-apps/plugin-dialog';
import { writeFile, readFile } from '@tauri-apps/plugin-fs';
import { PDFDocument } from 'pdf-lib';
import { CURRENCIES, EVENT_COLORS } from './constants';

export const handleExportPDF = async (trip, currency, getAttachmentUrl, setIsExporting, rootDir = null, tripId = null) => {
  setIsExporting(true);
  try {
    if (!trip) { setIsExporting(false); return; }

    const activeVersion = trip.versions?.find(v => v.id === trip.activeVersionId) || trip.versions?.[0];
    const sortedEvents = Array.isArray(activeVersion?.events)
      ? [...activeVersion.events].sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
      : [];

    const filename = `${trip.title?.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'itinerary'}.pdf`;
    const currSymbol = currency + ' ';

    // --- PDF setup (points unit for precision) ---
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' });
    const W = pdf.internal.pageSize.getWidth();   // 612
    const H = pdf.internal.pageSize.getHeight();   // 792
    const M = 40; // margin
    const CW = W - M * 2; // content width
    let y = M;
    let pageNum = 1;

    // --- Color palette (ASCII-safe labels — no emoji, jsPDF can't render them) ---
    const C = {
      primary: [67, 56, 202],
      primaryLight: [238, 242, 255],
      text: [15, 23, 42],
      textMid: [71, 85, 105],
      textLight: [100, 116, 139],
      border: [226, 232, 240],
      bg: [248, 250, 252],
      white: [255, 255, 255],
      emerald: [5, 150, 105],
      emeraldBg: [236, 253, 245],
      types: {
        flight: { bg: [219, 234, 254], text: [37, 99, 235], label: 'FLIGHT' },
        bus: { bg: [209, 250, 229], text: [5, 150, 105], label: 'BUS' },
        train: { bg: [224, 231, 255], text: [79, 70, 229], label: 'TRAIN' },
        food: { bg: [255, 237, 213], text: [234, 88, 12], label: 'FOOD' },
        lodging: { bg: [243, 232, 255], text: [147, 51, 234], label: 'LODGING' },
        activity: { bg: [252, 231, 243], text: [219, 39, 119], label: 'ACTIVITY' },
        other: { bg: [243, 244, 246], text: [107, 114, 128], label: 'OTHER' },
      }
    };

    // --- Helpers ---
    const setColor = (rgb) => pdf.setTextColor(rgb[0], rgb[1], rgb[2]);
    const setFill = (rgb) => pdf.setFillColor(rgb[0], rgb[1], rgb[2]);
    const setDraw = (rgb) => pdf.setDrawColor(rgb[0], rgb[1], rgb[2]);

    const newPage = () => {
      addFooter();
      pdf.addPage();
      pageNum++;
      y = M;
      addPageHeader();
    };

    const checkPage = (needed) => {
      if (y + needed > H - M - 20) {
        newPage();
        return true;
      }
      return false;
    };

    const addFooter = () => {
      pdf.setFontSize(7);
      setColor(C.textLight);
      pdf.setFont('helvetica', 'normal');
      pdf.text(String(trip.title || 'Itinerary').substring(0, 60), M, H - 18);
      pdf.text('Page ' + pageNum, W - M, H - 18, { align: 'right' });
      setDraw(C.border);
      pdf.setLineWidth(0.5);
      pdf.line(M, H - 28, W - M, H - 28);
    };

    const addPageHeader = () => {
      setDraw(C.border);
      pdf.setLineWidth(0.5);
      pdf.line(M, M + 12, W - M, M + 12);
      pdf.setFontSize(7);
      setColor(C.textLight);
      pdf.setFont('helvetica', 'normal');
      pdf.text(String(trip.title || '').substring(0, 60), M, M + 8);
      pdf.text(String(trip.destination || '').substring(0, 60), W - M, M + 8, { align: 'right' });
      y = M + 30;
    };

    const wrapText = (text, maxWidth, fontSize, fontStyle = 'normal') => {
      pdf.setFont('helvetica', fontStyle);
      pdf.setFontSize(fontSize);
      return pdf.splitTextToSize(String(text || ''), maxWidth);
    };

    const fmtTime = (iso) => {
      if (!iso) return '';
      const d = new Date(iso);
      return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    };

    const fmtDateLong = (iso) => {
      if (!iso) return '';
      const d = new Date(iso);
      return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    };

    const fmtDuration = (startIso, endIso) => {
      if (!startIso || !endIso) return '';
      const ms = new Date(endIso).getTime() - new Date(startIso).getTime();
      if (ms <= 0) return '';
      const hrs = Math.floor(ms / 3600000);
      const mins = Math.floor((ms % 3600000) / 60000);
      return hrs > 0 ? (mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`) : `${mins}m`;
    };

    // --- Build appendix references ---
    // Normalize attachment property names: DB uses fileName/fileType/localPath,
    // in-memory uses name/type/url
    let appendixCounter = 1;
    const allAppendixItems = [];
    sortedEvents.forEach(event => {
      if (Array.isArray(event.attachments) && event.attachments.length > 0) {
        event.attachments.forEach(att => {
          allAppendixItems.push({
            ...att,
            name: att.name || att.fileName || 'Attachment',
            type: att.type || att.fileType || '',
            eventTitle: event.title,
            refId: appendixCounter++
          });
        });
      }
    });

    // =============================================
    // 1. TITLE SECTION
    // =============================================
    setFill(C.primary);
    pdf.rect(M, y, CW, 4, 'F');
    y += 26;

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(24);
    setColor(C.text);
    const titleLines = wrapText(trip.title || 'Untitled Trip', CW, 24, 'bold');
    for (const line of titleLines) {
      pdf.text(line, M, y);
      y += 28;
    }
    y += 2;

    // Destination
    pdf.setFontSize(13);
    pdf.setFont('helvetica', 'normal');
    setColor(C.primary);
    pdf.text('Destination: ' + (trip.destination || ''), M, y);
    y += 20;

    // Dates
    pdf.setFontSize(9);
    setColor(C.textMid);
    pdf.text(fmtDateLong(trip.startDate) + '  -  ' + fmtDateLong(trip.endDate), M, y);
    y += 14;

    // Version name
    if (activeVersion?.name) {
      pdf.setFontSize(8);
      setColor(C.textLight);
      pdf.text('Version: ' + activeVersion.name, M, y);
      y += 12;
    }

    // Group events by day (needed for summary + day rendering)
    const grouped = {};
    sortedEvents.forEach(ev => {
      if (!ev.startTime) return;
      const key = new Date(ev.startTime).toDateString();
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(ev);
    });

    // Summary line
    pdf.setFontSize(8);
    setColor(C.textLight);
    pdf.text(sortedEvents.length + ' events  |  ' + Object.keys(grouped).length + ' days', M, y);
    y += 6;

    // Divider
    setDraw(C.border);
    pdf.setLineWidth(1);
    pdf.line(M, y, W - M, y);
    y += 18;

    // =============================================
    // 2. ITINERARY EVENTS BY DAY
    // =============================================
    const dayKeys = Object.keys(grouped);
    let dayNum = 0;

    for (const dayKey of dayKeys) {
      dayNum++;
      const dayEvents = grouped[dayKey];

      // Day Header
      checkPage(50);

      // Day badge
      setFill(C.primary);
      const dayLabel = 'DAY ' + dayNum;
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'bold');
      const badgeW = pdf.getTextWidth(dayLabel) + 14;
      const badgeH = 16;
      pdf.roundedRect(M, y - 4, badgeW, badgeH, 3, 3, 'F');
      setColor(C.white);
      pdf.text(dayLabel, M + 7, y + 7);

      // Day date — baseline aligned with badge center
      setColor(C.text);
      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'bold');
      const dayDateStr = new Date(dayKey).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
      pdf.text(dayDateStr, M + badgeW + 10, y + 7);
      y += badgeH + 4;

      setDraw(C.border);
      pdf.setLineWidth(0.5);
      pdf.line(M, y, W - M, y);
      y += 16;

      // Events
      for (const event of dayEvents) {
        const typeInfo = C.types[event.type] || C.types.other;
        const notesLines = event.notes ? wrapText(event.notes, CW - 40, 8, 'normal') : [];
        const evTitleLines = wrapText(event.title || 'Untitled', CW - 50, 11, 'bold');
        const hasAttachments = Array.isArray(event.attachments) && event.attachments.length > 0;

        // Calculate dynamic card height
        let cardH = 12; // top padding
        cardH += 14; // type badge + time row
        cardH += evTitleLines.length * 14; // title lines
        cardH += 12; // duration/cost row
        if (notesLines.length > 0) cardH += notesLines.length * 11 + 4;
        if (event.locationLink) cardH += 12;
        if (hasAttachments) cardH += 12;
        cardH += 6; // bottom padding

        checkPage(cardH + 6);

        const cardTop = y;

        // Left accent bar
        setFill(typeInfo.bg);
        pdf.rect(M, cardTop, 4, cardH, 'F');

        // Card background
        setFill(C.bg);
        pdf.roundedRect(M + 6, cardTop, CW - 6, cardH, 4, 4, 'F');
        setDraw(C.border);
        pdf.setLineWidth(0.5);
        pdf.roundedRect(M + 6, cardTop, CW - 6, cardH, 4, 4, 'S');

        let cx = M + 16;
        let cy = cardTop + 12;

        // Type badge
        setFill(typeInfo.bg);
        pdf.setFontSize(7);
        pdf.setFont('helvetica', 'bold');
        const typeLabelW = pdf.getTextWidth(typeInfo.label) + 12;
        // Shift the background to the left by 6 so that the text of the pill aligns with cx
        pdf.roundedRect(cx - 6, cy - 8, typeLabelW, 13, 2, 2, 'F');
        pdf.setTextColor(typeInfo.text[0], typeInfo.text[1], typeInfo.text[2]);
        pdf.text(typeInfo.label, cx, cy + 1);

        // Time on right
        const timeStr = fmtTime(event.startTime) + (event.endTime ? ' - ' + fmtTime(event.endTime) : '');
        pdf.setFontSize(8);
        pdf.setFont('helvetica', 'normal');
        setColor(C.textMid);
        pdf.text(timeStr, W - M - 14, cy + 1, { align: 'right' });
        cy += 20; // Increased to prevent vertical overlap

        // Event title
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(11);
        setColor(C.text);
        for (const line of evTitleLines) {
          pdf.text(line, cx, cy);
          cy += 14;
        }

        // Duration + Cost
        const dur = fmtDuration(event.startTime, event.endTime);
        pdf.setFontSize(8);
        pdf.setFont('helvetica', 'normal');
        setColor(C.textLight);

        let metaX = cx;
        if (dur) {
          pdf.text('Duration: ' + dur, metaX, cy);
          metaX += pdf.getTextWidth('Duration: ' + dur) + 16;
        }
        if (event.cost > 0) {
          setColor(C.emerald);
          pdf.setFont('helvetica', 'bold');
          pdf.text(currSymbol + Number(event.cost).toFixed(2), metaX, cy);
          pdf.setFont('helvetica', 'normal');
        }
        cy += 12;

        // Notes
        if (notesLines.length > 0) {
          pdf.setFontSize(8);
          setColor(C.textMid);
          pdf.setFont('helvetica', 'normal');
          for (const nline of notesLines) {
            pdf.text(nline, cx, cy);
            cy += 11;
          }
          cy += 2;
        }

        // Location link
        if (event.locationLink) {
          pdf.setFontSize(7);
          setColor(C.primary);
          pdf.setFont('helvetica', 'normal');
          const locText = 'Location: ' + (event.locationLink.length > 65 ? event.locationLink.substring(0, 65) + '...' : event.locationLink);
          pdf.text(locText, cx, cy);
          cy += 13;
        }

        // Attachment references
        if (hasAttachments) {
          const evAppendix = allAppendixItems.filter(a => a.eventTitle === event.title);
          if (evAppendix.length > 0) {
            pdf.setFontSize(7);
            setColor(C.textLight);
            pdf.setFont('helvetica', 'italic');
            const refStr = 'Attachments: See Appendix ' + evAppendix.map(a => a.refId).join(', ');
            pdf.text(refStr, cx, cy);
            cy += 13;
          }
        }

        y = cardTop + cardH + 4;
      }

      y += 6;
    }

    // =============================================
    // 3. COST SUMMARY (fresh page)
    // =============================================
    const costByType = {};
    let totalCost = 0;
    sortedEvents.forEach(ev => {
      const c = Number(ev.cost) || 0;
      if (c > 0) {
        costByType[ev.type] = (costByType[ev.type] || 0) + c;
        totalCost += c;
      }
    });

    if (totalCost > 0) {
      // Always start cost summary on a fresh page
      newPage();

      // Section title
      setFill(C.primary);
      pdf.rect(M, y, CW, 3, 'F');
      y += 20;

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(18);
      setColor(C.text);
      pdf.text('Cost Estimation Breakdown', M, y);
      y += 10;

      pdf.setFontSize(8);
      setColor(C.textLight);
      pdf.setFont('helvetica', 'normal');
      pdf.text('All amounts in ' + currency, M, y);
      y += 20;

      // Cost rows
      const costTypes = ['flight', 'lodging', 'activity', 'food', 'bus', 'train', 'other'];
      for (const type of costTypes) {
        if (!costByType[type]) continue;
        checkPage(28);

        const typeInfo = C.types[type] || C.types.other;
        setFill(typeInfo.bg);
        pdf.roundedRect(M, y - 10, CW, 24, 3, 3, 'F');

        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(typeInfo.text[0], typeInfo.text[1], typeInfo.text[2]);
        pdf.text(typeInfo.label, M + 12, y + 4);

        setColor(C.text);
        const costText = currSymbol + costByType[type].toFixed(2);
        const costW = pdf.getTextWidth(costText);
        pdf.text(costText, W - M - 12 - costW, y + 4);

        y += 30;
      }

      // Total bar
      y += 4;
      checkPage(36);
      setFill(C.emeraldBg);
      pdf.roundedRect(M, y - 10, CW, 30, 4, 4, 'F');
      setDraw(C.emerald);
      pdf.setLineWidth(1.5);
      pdf.roundedRect(M, y - 10, CW, 30, 4, 4, 'S');

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(11);
      setColor(C.textMid);
      pdf.text('TOTAL TRIP ESTIMATE', M + 12, y + 7);

      pdf.setFontSize(16);
      setColor(C.emerald);
      const totalStr = currSymbol + totalCost.toFixed(2);
      const totalStrW = pdf.getTextWidth(totalStr);
      pdf.text(totalStr, W - M - 12 - totalStrW, y + 8);

      y += 40;
    }

    // =============================================
    // 4. APPENDIX (Cover Pages + Attachment Merging)
    // =============================================

    // Convert main jsPDF (itinerary & summary) to pdf-lib document
    let mainPdfDoc = await PDFDocument.load(pdf.output('arraybuffer'));
    let currentAppendixIndex = 0;

    if (allAppendixItems.length > 0) {
      for (const item of allAppendixItems) {
        currentAppendixIndex++;

        // Create a temporary jsPDF document for this attachment's cover page
        const coverPdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' });
        let cy = M;

        // Add footer for the cover page (maintaining original jsPDF pageNum visually)
        coverPdf.setFontSize(7);
        coverPdf.setTextColor(C.textLight[0], C.textLight[1], C.textLight[2]);
        coverPdf.setFont('helvetica', 'normal');
        coverPdf.text(String(trip.title || 'Itinerary').substring(0, 60), M, H - 18);
        coverPdf.text('Page ' + (pageNum + currentAppendixIndex), W - M, H - 18, { align: 'right' });
        coverPdf.setDrawColor(C.border[0], C.border[1], C.border[2]);
        coverPdf.setLineWidth(0.5);
        coverPdf.line(M, H - 28, W - M, H - 28);

        // Add Header
        coverPdf.setDrawColor(C.border[0], C.border[1], C.border[2]);
        coverPdf.setLineWidth(0.5);
        coverPdf.line(M, M + 12, W - M, M + 12);
        coverPdf.setFontSize(7);
        coverPdf.setTextColor(C.textLight[0], C.textLight[1], C.textLight[2]);
        coverPdf.setFont('helvetica', 'normal');
        coverPdf.text(String(trip.title || '').substring(0, 60), M, M + 8);
        coverPdf.text(String(trip.destination || '').substring(0, 60), W - M, M + 8, { align: 'right' });
        cy = M + 30;

        // Appendix header
        coverPdf.setFillColor(C.primary[0], C.primary[1], C.primary[2]);
        coverPdf.rect(M, cy, CW, 3, 'F');
        cy += 18;

        coverPdf.setFont('helvetica', 'bold');
        coverPdf.setFontSize(18);
        coverPdf.setTextColor(C.text[0], C.text[1], C.text[2]);
        coverPdf.text('Appendix ' + item.refId, M, cy);
        cy += 18;

        // Subtitle
        coverPdf.setFontSize(10);
        coverPdf.setTextColor(C.textMid[0], C.textMid[1], C.textMid[2]);
        coverPdf.setFont('helvetica', 'normal');
        coverPdf.text('From event: ' + (item.eventTitle || 'Unknown'), M, cy);
        cy += 16;

        // File info
        coverPdf.setFontSize(9);
        coverPdf.setTextColor(C.textLight[0], C.textLight[1], C.textLight[2]);
        coverPdf.text('File: ' + (item.name || 'Attachment'), M, cy);
        cy += 20;

        // Divider
        coverPdf.setDrawColor(C.border[0], C.border[1], C.border[2]);
        coverPdf.setLineWidth(0.5);
        coverPdf.line(M, cy, W - M, cy);
        cy += 16;

        // Image or PDF placeholder on the cover page
        if (item.type?.startsWith('image/')) {
          coverPdf.setFillColor(C.bg[0], C.bg[1], C.bg[2]);
          coverPdf.roundedRect(M, cy, CW, 60, 6, 6, 'F');
          coverPdf.setDrawColor(C.border[0], C.border[1], C.border[2]);
          coverPdf.setLineWidth(0.5);
          coverPdf.roundedRect(M, cy, CW, 60, 6, 6, 'S');

          coverPdf.setFontSize(10);
          coverPdf.setTextColor(C.textMid[0], C.textMid[1], C.textMid[2]);
          coverPdf.setFont('helvetica', 'bold');
          coverPdf.text(String(item.name || 'Image').substring(0, 80), M + CW / 2, cy + 25, { align: 'center', maxWidth: CW - 20 });

          coverPdf.setFontSize(8);
          coverPdf.setTextColor(C.textLight[0], C.textLight[1], C.textLight[2]);
          coverPdf.setFont('helvetica', 'normal');
          coverPdf.text('This image is appended on the following page.', M + CW / 2, cy + 40, { align: 'center', maxWidth: CW - 20 });
        } else if (item.type === 'application/pdf') {
          coverPdf.setFillColor(C.bg[0], C.bg[1], C.bg[2]);
          coverPdf.roundedRect(M, cy, CW, 60, 6, 6, 'F');
          coverPdf.setDrawColor(C.border[0], C.border[1], C.border[2]);
          coverPdf.setLineWidth(0.5);
          coverPdf.roundedRect(M, cy, CW, 60, 6, 6, 'S');

          coverPdf.setFontSize(10);
          coverPdf.setTextColor(C.textMid[0], C.textMid[1], C.textMid[2]);
          coverPdf.setFont('helvetica', 'bold');
          coverPdf.text(String(item.name || 'Document').substring(0, 80), M + CW / 2, cy + 25, { align: 'center', maxWidth: CW - 20 });

          coverPdf.setFontSize(8);
          coverPdf.setTextColor(C.textLight[0], C.textLight[1], C.textLight[2]);
          coverPdf.setFont('helvetica', 'normal');
          coverPdf.text('This PDF document has been appended on the following pages.', M + CW / 2, cy + 40, { align: 'center', maxWidth: CW - 20 });
        } else {
          coverPdf.setFillColor(C.bg[0], C.bg[1], C.bg[2]);
          coverPdf.roundedRect(M, cy, CW, 60, 6, 6, 'F');
          coverPdf.setDrawColor(C.border[0], C.border[1], C.border[2]);
          coverPdf.setLineWidth(0.5);
          coverPdf.roundedRect(M, cy, CW, 60, 6, 6, 'S');

          coverPdf.setFontSize(10);
          coverPdf.setTextColor(C.textMid[0], C.textMid[1], C.textMid[2]);
          coverPdf.setFont('helvetica', 'bold');
          coverPdf.text(String(item.name || 'Document').substring(0, 80), M + CW / 2, cy + 25, { align: 'center', maxWidth: CW - 20 });

          coverPdf.setFontSize(8);
          coverPdf.setTextColor(C.textLight[0], C.textLight[1], C.textLight[2]);
          coverPdf.setFont('helvetica', 'normal');
          coverPdf.text('This document attachment cannot be previewed in PDF.', M + CW / 2, cy + 40, { align: 'center', maxWidth: CW - 20 });
        }

        // Merge the jsPDF cover page into main document
        const coverPdfBytes = coverPdf.output('arraybuffer');
        const coverPdfDoc = await PDFDocument.load(coverPdfBytes);
        const [copiedCover] = await mainPdfDoc.copyPages(coverPdfDoc, [0]);
        mainPdfDoc.addPage(copiedCover);

        let trueUrl = getAttachmentUrl ? getAttachmentUrl(item) : item.url;

        if (item.type?.startsWith('image/')) {
          try {
            // Fetch raw bytes and base64 encode to prevent canvas tainting errors
            let base64Data = null;
            if (item.localPath && rootDir && tripId) {
              try {
                const fullPath = `${rootDir}/projects/${tripId}/files/${item.localPath}`;
                const fileData = await readFile(fullPath);
                // Safari-safe Uint8Array to base64
                let binary = '';
                for (let i = 0; i < fileData.length; i++) binary += String.fromCharCode(fileData[i]);
                base64Data = `data:${item.type};base64,${btoa(binary)}`;
              } catch (fsErr) {
                console.warn('Filesystem read failed, fallback to url');
              }
            }

            if (!base64Data && trueUrl) {
              if (trueUrl.startsWith('data:')) {
                base64Data = trueUrl;
              } else {
                const resp = await fetch(trueUrl);
                const blob = await resp.blob();
                const reader = new FileReader();
                base64Data = await new Promise((resolve) => {
                  reader.onloadend = () => resolve(reader.result);
                  reader.readAsDataURL(blob);
                });
              }
            }

            if (base64Data) {
              // Get natural image dimensions safely
              const img = new Image();
              await new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = reject;
                img.src = base64Data;
              });

              // Create pure image page
              const imgPdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' });
              const imgMaxW = CW - 20;
              const imgMaxH = H - M - 40; // Full height minus margins
              const ratio = Math.min(imgMaxW / img.naturalWidth, imgMaxH / img.naturalHeight, 1);
              const drawW = img.naturalWidth * ratio;
              const drawH = img.naturalHeight * ratio;
              const imgX = M + (CW - drawW) / 2;

              imgPdf.addImage(base64Data, 'JPEG', imgX, M, drawW, drawH);

              // Increment page counter just for numbering tracker
              currentAppendixIndex++;

              const imgPdfBytes = imgPdf.output('arraybuffer');
              const imgPdfDoc = await PDFDocument.load(imgPdfBytes);
              const [copiedImgPage] = await mainPdfDoc.copyPages(imgPdfDoc, [0]);
              mainPdfDoc.addPage(copiedImgPage);
            }
          } catch (e) {
            console.error("Failed to embed image:", item.name, e);
          }
        } else if (item.type === 'application/pdf') {
          try {
            let attachedPdfBytes = null;
            const localPath = item.localPath;
            if (localPath && rootDir && tripId) {
              try {
                const fullPath = `${rootDir}/projects/${tripId}/files/${localPath}`;
                const fileData = await readFile(fullPath);
                attachedPdfBytes = fileData.buffer || fileData;
              } catch (fsErr) {
                console.warn('Could not read PDF from filesystem, trying URL:', fsErr);
              }
            }

            if (!attachedPdfBytes && trueUrl) {
              if (trueUrl.startsWith('data:')) {
                const b64 = trueUrl.split(',')[1];
                const binary = atob(b64);
                const bytes = new Uint8Array(binary.length);
                for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
                attachedPdfBytes = bytes.buffer;
              } else {
                const resp = await fetch(trueUrl);
                attachedPdfBytes = await resp.arrayBuffer();
              }
            }

            if (attachedPdfBytes) {
              const attachmentPdf = await PDFDocument.load(attachedPdfBytes);
              const copiedPages = await mainPdfDoc.copyPages(attachmentPdf, attachmentPdf.getPageIndices());
              copiedPages.forEach((page) => {
                mainPdfDoc.addPage(page);
                currentAppendixIndex++; // increment for each attached page so numbering stays sane
              });
            }
          } catch (e) {
            console.error("Failed to merge PDF attachment:", item.name, e);
          }
        }
      }
    }

    // =============================================
    // 5. SAVE
    // =============================================
    const finalPdfBytes = await mainPdfDoc.save();

    if (window.__TAURI_INTERNALS__) {
      const filePath = await save({
        filters: [{ name: 'PDF Document', extensions: ['pdf'] }],
        defaultPath: filename,
      });
      if (filePath) {
        await writeFile(filePath, finalPdfBytes);
      }
    } else {
      const blob = new Blob([finalPdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  } catch (error) {
    console.error("PDF Export failed:", error);
    const errMsg = error instanceof Error ? error.message : (typeof error === 'string' ? error : JSON.stringify(error));
    alert("Failed to export PDF. " + errMsg);
  } finally {
    setIsExporting(false);
  }
};
