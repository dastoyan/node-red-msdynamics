const LookupOutcome = {
  ONE_CONTACT: "ONE_CONTACT",
  NO_CONTACTS: "NO_CONTACTS",
  MULTIPLE_CONTACTS: "MULTIPLE_CONTACTS",
  API_ERROR: "API_ERROR",
  INVALID_RESPONSE: "INVALID_RESPONSE",
};

function classifyLookupResponse(httpResponse) {
  if (httpResponse?.body?.error) {
    return LookupOutcome.API_ERROR;
  }

  const values = httpResponse?.body?.value;
  if (!Array.isArray(values)) {
    return LookupOutcome.INVALID_RESPONSE;
  }

  if (values.length === 1) {
    return LookupOutcome.ONE_CONTACT;
  }

  if (values.length === 0) {
    return LookupOutcome.NO_CONTACTS;
  }

  return LookupOutcome.MULTIPLE_CONTACTS;
}

function routeLookupMessage(outcome, msg) {
  const outputMessage = { ...msg, lookupOutcome: outcome };

  if (outcome === LookupOutcome.ONE_CONTACT) {
    return [outputMessage, null, null];
  }

  if (
    outcome === LookupOutcome.NO_CONTACTS ||
    outcome === LookupOutcome.MULTIPLE_CONTACTS
  ) {
    return [null, outputMessage, null];
  }

  return [null, null, outputMessage];
}

module.exports = {
  LookupOutcome,
  classifyLookupResponse,
  routeLookupMessage,
};
