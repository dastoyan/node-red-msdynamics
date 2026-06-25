const assert = require("assert");
const {
  extractPhoneNumberSource,
  normalizePhoneNumber,
  validatePhoneNumber,
  preparePhoneNumber,
} = require("../nodes/contactLookup/phone-number-utils");

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
  assert.strictEqual(
    extractPhoneNumberSource("tel:+12345@example.com"),
    "tel:+12345"
  );

  assert.strictEqual(normalizePhoneNumber("+1 (234) 567-890"), "+1234567890");
  assert.strictEqual(normalizePhoneNumber(" 123-456 "), "123456");
  assert.strictEqual(normalizePhoneNumber("+++"), "+");

  assert.strictEqual(validatePhoneNumber("+123"), true);
  assert.strictEqual(validatePhoneNumber("123"), true);
  assert.strictEqual(validatePhoneNumber("+"), false);
  assert.strictEqual(validatePhoneNumber(""), false);

  assert.strictEqual(
    preparePhoneNumber("tel:+12345@example.com"),
    "+12345"
  );

  expectThrows(() => preparePhoneNumber(undefined), "must resolve to a string");
  expectThrows(
    () => preparePhoneNumber("sip:+++@example.com"),
    "Configured phone number attribute does not exist"
  );

  console.log("contact-lookup phone number utils tests passed");
}

run();
