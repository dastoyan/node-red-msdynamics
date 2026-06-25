const assert = require("assert");
const {
  LookupOutcome,
  classifyLookupResponse,
  routeLookupMessage,
} = require("../nodes/contactLookup/lookup-result-classifier");

function run() {
  assert.strictEqual(
    classifyLookupResponse({ body: { value: [{ id: 1 }] } }),
    LookupOutcome.ONE_CONTACT
  );
  assert.strictEqual(
    classifyLookupResponse({ body: { value: [] } }),
    LookupOutcome.NO_CONTACTS
  );
  assert.strictEqual(
    classifyLookupResponse({ body: { value: [{ id: 1 }, { id: 2 }] } }),
    LookupOutcome.MULTIPLE_CONTACTS
  );
  assert.strictEqual(
    classifyLookupResponse({ body: { error: "boom" } }),
    LookupOutcome.API_ERROR
  );
  assert.strictEqual(
    classifyLookupResponse({ body: { value: null } }),
    LookupOutcome.INVALID_RESPONSE
  );

  const msg = { payload: { id: 1 } };

  const one = routeLookupMessage(LookupOutcome.ONE_CONTACT, msg);
  assert.strictEqual(one[0].lookupOutcome, LookupOutcome.ONE_CONTACT);
  assert.strictEqual(one[1], null);
  assert.strictEqual(one[2], null);

  const none = routeLookupMessage(LookupOutcome.NO_CONTACTS, msg);
  assert.strictEqual(none[0], null);
  assert.strictEqual(none[1].lookupOutcome, LookupOutcome.NO_CONTACTS);
  assert.strictEqual(none[2], null);

  const many = routeLookupMessage(LookupOutcome.MULTIPLE_CONTACTS, msg);
  assert.strictEqual(many[0], null);
  assert.strictEqual(many[1].lookupOutcome, LookupOutcome.MULTIPLE_CONTACTS);
  assert.strictEqual(many[2], null);

  const error = routeLookupMessage(LookupOutcome.API_ERROR, msg);
  assert.strictEqual(error[0], null);
  assert.strictEqual(error[1], null);
  assert.strictEqual(error[2].lookupOutcome, LookupOutcome.API_ERROR);

  console.log("contact-lookup result classifier tests passed");
}

run();
