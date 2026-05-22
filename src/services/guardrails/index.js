const { runLayer1 } = require('./layer1.js');
const { runLayer2 } = require('./layer2.js');
const REJECTION_MESSAGES = require('./messages.js');

async function runGuardrails(file) {
  // file = { buffer, originalname, size, mimetype }

  const l1Result = await runLayer1(file);
  if (!l1Result.pass) return buildRejectResponse(l1Result);

  const l2Result = await runLayer2(l1Result.fileBuffer, l1Result.ext, l1Result.pageCount);
  if (!l2Result.pass) return buildRejectResponse(l2Result);

  return {
    pass: true,
    ext: l1Result.ext,
    pageCount: l1Result.pageCount,
    rawText: l2Result.rawText,
    charCount: l2Result.charCount
  };
}

function buildRejectResponse({ ruleId, layer }) {
  const msg = REJECTION_MESSAGES[ruleId] || { message: 'Unknown error', remediation: 'CONTACT_SUPPORT' };
  return {
    pass: false,
    ruleId,
    layer,
    userMessage: msg.message,
    remediationAction: msg.remediation
  };
}

module.exports = { runGuardrails };
