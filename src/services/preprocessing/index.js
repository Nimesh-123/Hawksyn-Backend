/**
 * Final Production Preprocessing
 * Features: Word repair, Paragraph reconstruction, CID normalization
 */

function normalizeResume(rawText) {
    if (!rawText) return '';

    // 1. Basic Cleaning
    let text = rawText
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, '')
        .replace(/\(cid:\d+\)/g, '•')
        .replace(/[•●▪‣◦]/g, '•');

    // 2. Repair Broken Words (Hyphenated at line breaks)
    // "trans- \n formation" -> "transformation"
    text = text.replace(/(\w+)-\s*\n\s*(\w+)/g, '$1$2');

    // 3. Paragraph Reconstruction & Line Merging
    text = mergeWrappedLines(text);

    return text;
}

function mergeWrappedLines(text) {
    const lines = text.split('\n');
    const result = [];

    for (let i = 0; i < lines.length; i++) {
        let current = lines[i].trim();
        if (!current) continue;

        while (i < lines.length - 1) {
            const next = lines[i + 1].trim();
            if (!next) break;

            const lastChar = current.slice(-1);
            const isBullet = current.startsWith('•') || current.startsWith('-');
            const nextIsBullet = next.startsWith('•') || next.startsWith('-');
            const isSentenceEnd = /[.!?:]/.test(lastChar);
            const nextStartsLowercase = /^[a-z]/.test(next);

            // Repair truncated words that didn't have hyphens
            // "transfo" + "mation" -> "transformation"
            const lastWord = current.split(' ').pop();
            const firstWordNext = next.split(' ')[0];
            const isBrokenWord = /^[a-z]+$/.test(lastWord) && /^[a-z]+$/.test(firstWordNext) && !isSentenceEnd;

            if (!nextIsBullet && (!isSentenceEnd || nextStartsLowercase || isBrokenWord)) {
                current = current + (isBrokenWord ? '' : ' ') + next;
                i++;
            } else {
                break;
            }
        }
        result.push(current);
    }

    return result.join('\n');
}

module.exports = { normalizeResume };
