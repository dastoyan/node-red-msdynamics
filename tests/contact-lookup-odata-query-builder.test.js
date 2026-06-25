const assert = require("assert");
const {
  escapeODataString,
  parseAttributeList,
  buildContactLookupFilter,
  buildSelectClause,
  buildContactsLookupUrl,
} = require("../nodes/contactLookup/odata-query-builder");

function expectThrows(fn, expectedMessagePart) {
  let thrown = false;
  try {
    fn();
  } catch (error) {
    thrown = true;
    assert.ok(
      error.message.includes(expectedMessagePart),
      `Expected error to include '${expectedMessagePart}', got '${error.message}'`
    );
  }
  assert.ok(thrown, "Expected function to throw");
}

function run() {
  assert.strictEqual(escapeODataString("O'Hara"), "O''Hara");
  assert.deepStrictEqual(parseAttributeList("telephone1, mobilephone"), [
    "telephone1",
    "mobilephone",
  ]);

  const filter = buildContactLookupFilter({
    phoneNumber: "+123",
    lookupTelephone: true,
    lookupMobile: true,
    customLookupAttributes: "fax",
  });
  assert.strictEqual(
    filter,
    "telephone1 eq '+123' or mobilephone eq '+123' or fax eq '+123'"
  );

  assert.strictEqual(buildSelectClause("all", "firstname"), "");
  assert.strictEqual(
    buildSelectClause("custom", "firstname, lastname"),
    "&$select=firstname,lastname"
  );

  const url = buildContactsLookupUrl({
    instanceUrl: "https://example.crm4.dynamics.com/",
    apiVersion: "v9.2",
    phoneNumber: "O'Hara",
    lookupTelephone: true,
    lookupMobile: false,
    customLookupAttributes: "",
    returnAttributesOption: "custom",
    customReturnAttributes: "firstname,emailaddress1",
  });
  assert.ok(url.includes("api/data/v9.2/contacts?$filter="));
  assert.ok(url.includes("telephone1%20eq%20'O''Hara'"));
  assert.ok(url.endsWith("&$select=firstname,emailaddress1"));

  expectThrows(
    () =>
      buildContactLookupFilter({
        phoneNumber: "1",
        lookupTelephone: false,
        lookupMobile: false,
        customLookupAttributes: "",
      }),
    "No lookup attributes defined"
  );

  expectThrows(
    () =>
      buildContactLookupFilter({
        phoneNumber: "1",
        lookupTelephone: false,
        lookupMobile: false,
        customLookupAttributes: "telephone1, bad-attr",
      }),
    "Invalid custom lookup attribute"
  );

  expectThrows(
    () => buildSelectClause("custom", "firstname, bad-attr"),
    "Invalid return attribute"
  );

  console.log("contact-lookup OData query builder tests passed");
}

run();
