const assert = require("assert");
const {
  normalizeMsgPath,
  getValueFromMsgPath,
} = require("../nodes/contactLookup/msg-path-utils");

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
  assert.strictEqual(normalizeMsgPath("msg.payload.q"), "payload.q");
  assert.strictEqual(
    normalizeMsgPath("msg.dialogue.participants[0].id"),
    "dialogue.participants.0.id"
  );

  const msg = {
    payload: { q: "tel:+12345@example.com" },
    dialogue: { participants: [{ id: "abc123" }] },
  };

  assert.strictEqual(getValueFromMsgPath(msg, "msg.payload.q"), "tel:+12345@example.com");
  assert.strictEqual(getValueFromMsgPath(msg, "msg.dialogue.participants[0].id"), "abc123");
  assert.strictEqual(getValueFromMsgPath(msg, "msg.payload.missing"), undefined);

  expectThrows(() => normalizeMsgPath("msg"), "Invalid phone number path");
  expectThrows(() => normalizeMsgPath("payload.q"), "Invalid phone number path");
  expectThrows(() => normalizeMsgPath("msg.payload['q']"), "Invalid phone number path");
  expectThrows(() => normalizeMsgPath("msg.payload.constructor"), "Invalid phone number path");
  expectThrows(() => normalizeMsgPath("msg.payload;process.exit(1)"), "Invalid phone number path");

  console.log("contact-lookup msg path utils tests passed");
}

run();
