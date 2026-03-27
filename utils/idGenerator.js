/**
 * Helper: Generate IDs in format PREFIX_YYYYMMDD_XXXX
 * This is used for creating unique runIds, paymentIds, and caseFileIds.
 */
exports.generateFormattedId = async (Model, prefix, fieldName) => {
    const now = new Date();
    // Use local components for consistency with the day-based sequence
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const dateStr = `${year}${month}${day}`;

    // Find the current highest sequence for this specific prefix + date
    const regex = new RegExp(`^${prefix}_${dateStr}_`);
    const lastRecord = await Model.findOne({ [fieldName]: regex })
        .sort({ [fieldName]: -1 })
        .lean();

    let sequence = 1;
    if (lastRecord && lastRecord[fieldName]) {
        const parts = lastRecord[fieldName].split('_');
        if (parts.length >= 3) {
            const lastSeq = parseInt(parts[2], 10);
            if (!isNaN(lastSeq)) {
                sequence = lastSeq + 1;
            }
        }
    }

    const sequenceStr = sequence.toString().padStart(4, '0');
    return `${prefix}_${dateStr}_${sequenceStr}`;
};
