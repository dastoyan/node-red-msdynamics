function normalizeMsgPath(rawPath) {
  if (!rawPath || typeof rawPath !== "string") {
    throw new Error("Phone number path is undefined or invalid");
  }

  const trimmedPath = rawPath.trim();
  const validMsgPath = /^msg(?:\.(?:[A-Za-z_$][A-Za-z0-9_$]*|\d+)|\[\d+\])*$/;

  if (!validMsgPath.test(trimmedPath) || trimmedPath === "msg") {
    throw new Error(
      "Invalid phone number path. Use msg.<property> (for example msg.payload.q)"
    );
  }

  const normalizedPath = trimmedPath
    .replace(/^msg\.?/, "")
    .replace(/\[(\d+)\]/g, ".$1");
  const forbiddenSegments = new Set(["__proto__", "prototype", "constructor"]);
  const segments = normalizedPath.split(".").filter(Boolean);

  if (segments.some((segment) => forbiddenSegments.has(segment))) {
    throw new Error(
      "Invalid phone number path. Unsafe object segment is not allowed"
    );
  }

  return normalizedPath;
}

function getValueFromMsgPath(msg, rawPath) {
  const normalizedPath = normalizeMsgPath(rawPath);
  const segments = normalizedPath.split(".").filter(Boolean);
  let current = msg;

  for (const segment of segments) {
    if (current === null || current === undefined) {
      return undefined;
    }
    current = current[segment];
  }

  return current;
}

module.exports = {
  normalizeMsgPath,
  getValueFromMsgPath,
};
