const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

/**
 * Generates a PDF based on the provided HTML content.
 * @param {string} html - The complete HTML document string.
 * @returns {Promise<Buffer>} - The generated PDF as a buffer.
 */
async function generatePdfFromHtml(html, options = {}) {
    let browser;
    try {
        console.log('[PdfService] Launching Puppeteer...');
        browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: 'networkidle0' });

        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: {
                top: options.marginTop || '20px',
                bottom: options.marginBottom || '20px',
                right: options.marginRight || '0px',
                left: options.marginLeft || '0px'
            },
            displayHeaderFooter: options.displayHeaderFooter || false,
            headerTemplate: options.headerTemplate || '',
            footerTemplate: options.footerTemplate || ''
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
