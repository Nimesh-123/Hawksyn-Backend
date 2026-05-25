const REJECTION_MESSAGES = {
  RJ_FMT_001: {
    message: "Hawksyn accepts only PDF and Word (.docx) files. Please convert your CV and try again.",
    remediation: "ASK_USER_TO_CONVERT_FORMAT"
  },
  RJ_FMT_002: {
    message: "This file type is not supported. Please upload a PDF or Word (.docx) file.",
    remediation: "ASK_USER_TO_CONVERT_FORMAT"
  },
  RJ_FMT_003: {
    message: "Older Word format (.doc) is not supported. Please save as .docx and re-upload.",
    remediation: "ASK_USER_TO_CONVERT_FORMAT"
  },
  RJ_FMT_004: {
    message: "Apple Pages format is not supported. Please export as PDF and re-upload.",
    remediation: "ASK_USER_TO_CONVERT_FORMAT"
  },
  RJ_FMT_005: {
    message: "OpenDocument format is not supported. Please save as PDF or .docx and re-upload.",
    remediation: "ASK_USER_TO_CONVERT_FORMAT"
  },
  RJ_FMT_006: {
    message: "PowerPoint format is not supported. If your CV is in PowerPoint, please export to PDF and re-upload.",
    remediation: "ASK_USER_TO_CONVERT_FORMAT"
  },
  RJ_FMT_007: {
    message: "Spreadsheet format is not supported. Please upload a PDF or Word document.",
    remediation: "ASK_USER_TO_CONVERT_FORMAT"
  },
  RJ_FMT_008: {
    message: "Image files are not supported. Please upload a PDF or Word (.docx) version of your CV.",
    remediation: "ASK_USER_TO_UPLOAD_TEXT_VERSION"
  },
  RJ_FMT_009: {
    message: "Archive files are not supported. Please upload a single PDF or Word document.",
    remediation: "ASK_USER_TO_CONVERT_FORMAT"
  },
  RJ_FMT_010: {
    message: "Plain text formats are not supported. Please upload a formatted PDF or Word document.",
    remediation: "ASK_USER_TO_CONVERT_FORMAT"
  },
  RJ_INT_001: {
    message: "Your file is larger than 10 MB. Please compress or shorten your CV and try again.",
    remediation: "ASK_USER_TO_SHORTEN_CV"
  },
  RJ_INT_002: {
    message: "This file appears empty or corrupted. Please upload a valid CV.",
    remediation: "ASK_USER_TO_RE_UPLOAD"
  },
  RJ_INT_003: {
    message: "We could not open this PDF. The file may be corrupted. Please try uploading again.",
    remediation: "ASK_USER_TO_RE_UPLOAD"
  },
  RJ_INT_004: {
    message: "We could not open this Word document. The file may be corrupted. Please try uploading again.",
    remediation: "ASK_USER_TO_RE_UPLOAD"
  },
  RJ_INT_005: {
    message: "This PDF is password-protected. Please upload an unlocked version.",
    remediation: "ASK_USER_TO_REMOVE_PASSWORD"
  },
  RJ_INT_006: {
    message: "This PDF requires authentication. Please upload a standard PDF version of your CV.",
    remediation: "ASK_USER_TO_RE_UPLOAD"
  },
  RJ_PGE_001: {
    message: "Your CV is longer than 12 pages. Please upload a CV under 12 pages. Hawksyn analyses your career narrative, not appendices.",
    remediation: "ASK_USER_TO_SHORTEN_CV"
  },
  RJ_PGE_002: {
    message: "Your CV is longer than 12 pages. Please upload a shorter version.",
    remediation: "ASK_USER_TO_SHORTEN_CV"
  },
  RJ_PGE_003: {
    message: "This document appears to be empty. Please upload a CV with content.",
    remediation: "ASK_USER_TO_RE_UPLOAD"
  },
  RJ_TXT_001: {
    message: "We could not read text from this PDF. Hawksyn does not process scanned images. Please upload a PDF where text can be selected and copied.",
    remediation: "ASK_USER_TO_UPLOAD_TEXT_VERSION"
  },
  RJ_TXT_002: {
    message: "The text in this PDF is not in a readable format. Please re-export your CV from the original document.",
    remediation: "ASK_USER_TO_UPLOAD_TEXT_VERSION"
  },
  RJ_TXT_003: {
    message: "Your CV does not contain enough text for analysis. Please upload a complete CV with role descriptions and details.",
    remediation: "ASK_USER_TO_RE_UPLOAD"
  },
  RJ_TXT_004: {
    message: "This CV appears to be a scanned image rather than a text document. Hawksyn requires a text-based PDF or Word file.",
    remediation: "ASK_USER_TO_UPLOAD_TEXT_VERSION"
  },
  RJ_TXT_006: {
    message: "Your CV is too long to process. Please upload a more focused version under 12 pages.",
    remediation: "ASK_USER_TO_SHORTEN_CV"
  },
  RJ_LNG_001: {
    message: "Hawksyn currently supports only English-language CVs. Please upload an English version.",
    remediation: "ASK_USER_TO_UPLOAD_ENGLISH_VERSION"
  },
  RJ_LNG_002: {
    message: "Your CV contains significant non-English content. Please upload a CV where the primary language is English.",
    remediation: "ASK_USER_TO_UPLOAD_ENGLISH_VERSION"
  },
  RJ_LNG_003: {
    message: "Hawksyn currently supports only English-language CVs. Please upload an English version.",
    remediation: "ASK_USER_TO_UPLOAD_ENGLISH_VERSION"
  }
};

module.exports = REJECTION_MESSAGES;
