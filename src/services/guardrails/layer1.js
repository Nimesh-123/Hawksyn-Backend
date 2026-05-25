const fileType = require('file-type');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const path = require('path');

async function runLayer1(file) {
    // 1. Extension check
    const ext = path.extname(file.originalname).toLowerCase();
    
    if (ext === '.doc') return { pass: false, ruleId: 'RJ_FMT_003', layer: 'L1' };
    if (ext === '.pages') return { pass: false, ruleId: 'RJ_FMT_004', layer: 'L1' };
    if (ext === '.odt') return { pass: false, ruleId: 'RJ_FMT_005', layer: 'L1' };
    if (ext === '.pptx' || ext === '.ppt') return { pass: false, ruleId: 'RJ_FMT_006', layer: 'L1' };
    if (ext === '.xlsx' || ext === '.xls' || ext === '.csv') return { pass: false, ruleId: 'RJ_FMT_007', layer: 'L1' };
    if (['.jpg', '.jpeg', '.png', '.gif', '.heic', '.webp'].includes(ext)) return { pass: false, ruleId: 'RJ_FMT_008', layer: 'L1' };
    if (['.zip', '.rar', '.tar'].includes(ext)) return { pass: false, ruleId: 'RJ_FMT_009', layer: 'L1' };
    if (['.txt', '.rtf', '.md'].includes(ext)) return { pass: false, ruleId: 'RJ_FMT_010', layer: 'L1' };
    if (ext !== '.pdf' && ext !== '.docx') return { pass: false, ruleId: 'RJ_FMT_001', layer: 'L1' };
    
    const format = ext === '.pdf' ? 'pdf' : 'docx';

    // 2. MIME type check
    const type = await fileType.fromBuffer(file.buffer);
    if (!type) return { pass: false, ruleId: 'RJ_FMT_002', layer: 'L1' };
    
    const allowedMimeTypes = [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    if (!allowedMimeTypes.includes(type.mime)) {
        return { pass: false, ruleId: 'RJ_FMT_002', layer: 'L1' };
    }

    // 3. File size upper limit
    if (file.size > 10 * 1024 * 1024) return { pass: false, ruleId: 'RJ_INT_001', layer: 'L1' };

    // 4. File size lower limit
    if (file.size < 1 * 1024) return { pass: false, ruleId: 'RJ_INT_002', layer: 'L1' };

    // 5. File openable check & 6. Page count check
    let pageCount = 0;
    
    if (format === 'pdf') {
        try {
            const data = await pdfParse(file.buffer);
            pageCount = data.numpages;
            if (!pageCount || pageCount === 0) return { pass: false, ruleId: 'RJ_PGE_003', layer: 'L1' };
            if (pageCount > 12) return { pass: false, ruleId: 'RJ_PGE_001', layer: 'L1' };
        } catch (err) {
            if (err.message && err.message.toLowerCase().includes('encrypted')) {
                 return { pass: false, ruleId: 'RJ_INT_005', layer: 'L1' };
            }
            return { pass: false, ruleId: 'RJ_INT_003', layer: 'L1' };
        }
    } else {
        try {
            const result = await mammoth.extractRawText({ buffer: file.buffer });
            const rawText = result.value || '';
            const wordCount = rawText.trim() === '' ? 0 : rawText.trim().split(/\s+/).length;
            pageCount = Math.ceil(wordCount / 500); 
            
            if (wordCount === 0 || pageCount === 0) return { pass: false, ruleId: 'RJ_PGE_003', layer: 'L1' };
            if (wordCount > 6000 || pageCount > 12) return { pass: false, ruleId: 'RJ_PGE_002', layer: 'L1' };
        } catch (err) {
            return { pass: false, ruleId: 'RJ_INT_004', layer: 'L1' };
        }
    }

    return { pass: true, ext: format, pageCount, fileBuffer: file.buffer };
}

module.exports = { runLayer1 };
