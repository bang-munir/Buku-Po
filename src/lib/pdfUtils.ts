import { jsPDF } from 'jspdf';

/**
 * Utility to save a jsPDF document with a specific filename.
 * Optimized for desktop and mobile, especially iOS devices (iPhone, iPad, Safari, etc.)
 */
export const savePDF = async (doc: jsPDF, fileName: string): Promise<void> => {
  try {
    // Detect iOS devices
    const isIOS = typeof window !== 'undefined' && (
      /iPad|iPhone|iPod/.test(navigator.userAgent) || 
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
    );

    if (isIOS) {
      const pdfBlob = doc.output('blob');
      const file = new File([pdfBlob], fileName, { type: 'application/pdf' });

      // Try native Share Sheet first on iOS (modern iOS Safari/Chrome supports file sharing)
      if (typeof navigator !== 'undefined' && navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            files: [file],
            title: fileName,
            text: 'Nota / Surat Jalan PDF'
          });
          return;
        } catch (shareErr) {
          console.warn('Share sheet was cancelled or failed, falling back to direct download:', shareErr);
        }
      }

      // Fallback for iOS: Open in a new tab or trigger a downloadable blob link
      const blobURL = URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = blobURL;
      link.download = fileName;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Revoke the object URL after a delay to free memory
      setTimeout(() => {
        URL.revokeObjectURL(blobURL);
      }, 60000);
    } else {
      // Standard desktop/Android save
      doc.save(fileName);
    }
  } catch (error) {
    console.error('Error saving PDF:', error);
    throw error;
  }
};

