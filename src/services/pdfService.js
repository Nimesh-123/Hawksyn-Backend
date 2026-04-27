const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

/**
 * Generates a PDF based on the provided HTML content.
 * @param {string} html - The complete HTML document string.
 * @returns {Promise<Buffer>} - The generated PDF as a buffer.
 */
async function generatePdfFromHtml(html) {
    let browser;
    try {
        console.log('[PdfService] Launching Puppeteer...');
        // For production on linux servers, you might need --no-sandbox
        browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        const page = await browser.newPage();

        // 1. Set Content
        await page.setContent(html, { waitUntil: 'networkidle0' });

        // 2. Generate PDF
        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true, // Crucial for CSS colors/backgrounds
            margin: {
                top: '20px',
                bottom: '20px',
                right: '20px',
                left: '20px'
            },
            displayHeaderFooter: false
        });

        console.log('[PdfService] PDF generated successfully.');
        return pdfBuffer;

    } catch (error) {
        console.error('[PdfService] PDF Generation failed:', error.message);
        throw error;
    } finally {
        if (browser) await browser.close();
    }
}

module.exports = { generatePdfFromHtml };
