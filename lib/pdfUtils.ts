import { jsPDF } from 'jspdf';

/**
 * Robustly saves a jsPDF document, especially for mobile browsers.
 */
export const savePDF = async (doc: jsPDF, filename: string) => {
  // Check if we are on a mobile device and if sharing is supported
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  const canShare = typeof navigator !== 'undefined' && !!navigator.share && !!navigator.canShare;

  if (isMobile && canShare) {
    try {
      const blob = doc.output('blob');
      const file = new File([blob], filename, { type: 'application/pdf' });

      if (navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: filename,
          text: 'Unduh Nota PDF'
        });
        return; // Success!
      }
    } catch (e) {
      console.error('Mobile PDF share error:', e);
      // Fallback to standard save if sharing fails
    }
  }

  // Fallback for desktop or when sharing is not available/fails
  try {
    doc.save(filename);
  } catch (e) {
    console.error('PDF save error:', e);
    // Ultimate fallback: open in new tab
    const blob = doc.output('blob');
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  }
};
