import html2canvas from "html2canvas";
import jsPDF from "jspdf";

/**
 * Captures a DOM element as A4 PDF pages and triggers a browser download.
 *
 * Temporarily removes the `dark` class during capture so the PDF is always
 * produced in light mode regardless of the user''s current theme.
 */
export async function generateTransformerReport(
  container: HTMLElement,
  filename: string,
): Promise<void> {
  const root = document.documentElement;
  const wasDark = root.classList.contains("dark");
  if (wasDark) root.classList.remove("dark");

  try {
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: "#ffffff",
      scrollX: 0,
      scrollY: 0,
    });

    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    const pageWidth = 210;
    const pageHeight = 297;
    const margin = 10;
    const contentWidth = pageWidth - 2 * margin;
    const contentHeight = pageHeight - 2 * margin;

    const pxPerMm = canvas.width / contentWidth;
    const totalHeightMm = canvas.height / pxPerMm;
    const totalPages = Math.ceil(totalHeightMm / contentHeight);

    for (let page = 0; page < totalPages; page++) {
      if (page > 0) pdf.addPage();
      const srcY = page * contentHeight * pxPerMm;
      const srcH = Math.min(contentHeight * pxPerMm, canvas.height - srcY);
      const sliceCanvas = document.createElement("canvas");
      sliceCanvas.width = canvas.width;
      sliceCanvas.height = Math.ceil(srcH);
      const ctx = sliceCanvas.getContext("2d");
      if (!ctx) continue;
      ctx.drawImage(canvas, 0, srcY, canvas.width, srcH, 0, 0, canvas.width, srcH);
      const sliceData = sliceCanvas.toDataURL("image/jpeg", 0.92);
      const sliceHeightMm = srcH / pxPerMm;
      pdf.addImage(sliceData, "JPEG", margin, margin, contentWidth, sliceHeightMm);
    }
    pdf.save(filename);
  } finally {
    if (wasDark) root.classList.add("dark");
  }
}
