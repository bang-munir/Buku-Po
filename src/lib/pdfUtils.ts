import { jsPDF } from 'jspdf';

/**
 * Utility to save a jsPDF document with a specific filename.
 * This can be extended to handle different saving strategies (e.g., mobile apps, blob storage, etc.)
 */
export const savePDF = async (doc: jsPDF, fileName: string): Promise<void> => {
  try {
    doc.save(fileName);
  } catch (error) {
    console.error('Error saving PDF:', error);
    throw error;
  }
};
