function escapeODataString(value) {
  return String(value).replace(/'/g, "''");
}

function parseAttributeList(input) {
  if (!input) {
    return [];
  }

  return input
    .split(",")
    .map((attr) => attr.trim())
    .filter(Boolean);
}

function validateAttributeName(attributeName) {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(attributeName);
}

function buildContactLookupFilter({
  phoneNumber,
  lookupTelephone,
  lookupMobile,
  customLookupAttributes,
}) {
  const escapedPhone = escapeODataString(phoneNumber);
  const queryParts = [];

  if (lookupTelephone) {
    queryParts.push(`telephone1 eq '${escapedPhone}'`);
  }

  if (lookupMobile) {
    queryParts.push(`mobilephone eq '${escapedPhone}'`);
  }

  const customAttributes = parseAttributeList(customLookupAttributes);
  for (const attr of customAttributes) {
    if (!validateAttributeName(attr)) {
      throw new Error(`Invalid custom lookup attribute: ${attr}`);
    }
    queryParts.push(`${attr} eq '${escapedPhone}'`);
  }

  if (queryParts.length === 0) {
    throw new Error("No lookup attributes defined.");
  }

  return queryParts.join(" or ");
}

function buildSelectClause(returnAttributesOption, customReturnAttributes) {
  if (returnAttributesOption !== "custom") {
    return "";
  }

  const attributes = parseAttributeList(customReturnAttributes);
  if (attributes.length === 0) {
    return "";
  }

  for (const attr of attributes) {
    if (!validateAttributeName(attr)) {
      throw new Error(`Invalid return attribute: ${attr}`);
    }
  }

  return `&$select=${attributes.join(",")}`;
}

function buildContactsLookupUrl({
  instanceUrl,
  apiVersion,
  phoneNumber,
  lookupTelephone,
  lookupMobile,
  customLookupAttributes,
  returnAttributesOption,
  customReturnAttributes,
}) {
  const filter = buildContactLookupFilter({
    phoneNumber,
    lookupTelephone,
    lookupMobile,
    customLookupAttributes,
  });
  const encodedFilter = encodeURIComponent(filter);
  const selectClause = buildSelectClause(
    returnAttributesOption,
    customReturnAttributes
  );

  return `${instanceUrl}api/data/${apiVersion}/contacts?$filter=${encodedFilter}${selectClause}`;
}

module.exports = {
  escapeODataString,
  parseAttributeList,
  buildContactLookupFilter,
  buildSelectClause,
  buildContactsLookupUrl,
};
