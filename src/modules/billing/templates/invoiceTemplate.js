/**
 * Invoice HTML Template for Hawksyn
 */
exports.buildInvoiceHtml = ({ invoice, user }) => {
    const formattedDate = new Date(invoice.issuedAt).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
    });

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: 'Inter', sans-serif; color: #333; margin: 0; padding: 40px; line-height: 1.6; }
        .invoice-box { max-width: 800px; margin: auto; }
        .header { display: flex; justify-content: space-between; border-bottom: 2px solid #E8600A; padding-bottom: 20px; }
        .logo { color: #E8600A; font-size: 28px; font-weight: bold; }
        .invoice-details { text-align: right; }
        .billing-info { margin-top: 40px; display: flex; justify-content: space-between; }
        .table { width: 100%; border-collapse: collapse; margin-top: 40px; }
        .table th { background: #f9f9f9; text-align: left; padding: 12px; border-bottom: 1px solid #eee; }
        .table td { padding: 12px; border-bottom: 1px solid #eee; }
        .total-section { margin-top: 30px; text-align: right; }
        .total-row { display: flex; justify-content: flex-end; margin-bottom: 10px; }
        .total-label { font-weight: bold; width: 150px; }
        .total-value { width: 100px; }
        .footer { margin-top: 60px; font-size: 12px; color: #777; border-top: 1px solid #eee; padding-top: 20px; text-align: center; }
        .branding-color { color: #E8600A; }
    </style>
</head>
<body>
    <div class="invoice-box">
        <div class="header">
            <div class="logo">HAWKSYN</div>
            <div class="invoice-details">
                <h2 style="margin:0">TAX INVOICE</h2>
                <p style="margin:5px 0">Invoice #: <strong>${invoice.invoiceNumber}</strong></p>
                <p style="margin:0">Date: ${formattedDate}</p>
            </div>
        </div>

        <div class="billing-info">
            <div>
                <p style="margin:0 0 5px 0; color:#777">BILLED TO:</p>
                <strong>${user.fullName || user.name || user.email || 'Valued Client'}</strong><br>
                ${user.email}<br>
                ${invoice.billingAddress?.country || 'India'}
            </div>
            <div style="text-align: right">
                <p style="margin:0 0 5px 0; color:#777">ISSUED BY:</p>
                <strong>Hawksyn Technologies</strong><br>
                Bengaluru, Karnataka<br>
                GSTIN: 29AAAAA0000A1Z5
            </div>
        </div>

        <table class="table">
            <thead>
                <tr>
                    <th>Description</th>
                    <th style="text-align: center">Qty</th>
                    <th style="text-align: right">Price</th>
                    <th style="text-align: right">Total</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>Professional Assessment Report - AI Analysis<br><small style="color:#777">Run ID: ${invoice.runId || 'N/A'}</small></td>
                    <td style="text-align: center">1</td>
                    <td style="text-align: right">${invoice.currency} ${invoice.baseAmount}</td>
                    <td style="text-align: right">${invoice.currency} ${invoice.baseAmount}</td>
                </tr>
            </tbody>
        </table>

        <div class="total-section">
            <div class="total-row">
                <div class="total-label">Subtotal:</div>
                <div class="total-value">${invoice.currency} ${invoice.baseAmount}</div>
            </div>
            <div class="total-row">
                <div class="total-label">${invoice.taxDetails?.type || 'Tax'} (${invoice.taxDetails?.rate || 0}%):</div>
                <div class="total-value">${invoice.currency} ${invoice.taxAmount}</div>
            </div>
            <div class="total-row" style="font-size: 20px; margin-top: 10px;">
                <div class="total-label branding-color">Grand Total:</div>
                <div class="total-value branding-color"><strong>${invoice.currency} ${invoice.totalAmount}</strong></div>
            </div>
        </div>

        <div class="footer">
            <p>This is a computer-generated invoice and does not require a physical signature.</p>
            <p>Thank you for choosing Hawksyn. For support, reach out to hello@hawksyn.com</p>
        </div>
    </div>
</body>
</html>
    `;
};
