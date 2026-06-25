function extractPhoneNumberSource(value) {
  if (typeof value !== "string") {
    throw new Error("Configured phone number attribute must resolve to a string");
  }

  return value.split("@")[0];
}

function normalizePhoneNumber(rawPhoneNumber) {
  const sanitized = rawPhoneNumber.trim().replace(/[^0-9+]/g, "");

  if (!sanitized) {
    return "";
  }

  const hasLeadingPlus = sanitized.startsWith("+");
  const digitsOnly = sanitized.replace(/\+/g, "");

  return hasLeadingPlus ? `+${digitsOnly}` : digitsOnly;
}

function validatePhoneNumber(phoneNumber) {
  if (!phoneNumber || phoneNumber === "+") {
    return false;
  }
  return /\d/.test(phoneNumber);
}

function preparePhoneNumber(value) {
  const extracted = extractPhoneNumberSource(value);
  const normalized = normalizePhoneNumber(extracted);

  if (!validatePhoneNumber(normalized)) {
    throw new Error(
      "Configured phone number attribute does not exist in the incoming message"
    );
  }

  return normalized;
}

module.exports = {
  extractPhoneNumberSource,
  normalizePhoneNumber,
  validatePhoneNumber,
  preparePhoneNumber,
};
