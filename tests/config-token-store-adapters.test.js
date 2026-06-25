const assert = require("assert");
const {
  NoopTokenStoreAdapter,
  GlobalContextTokenStoreAdapter,
  createTokenStoreAdapter,
} = require("../nodes/config/token-store-adapters");

function run() {
  const store = {};
  const globalContext = {
    get(key) {
      return store[key];
    },
    set(key, value) {
      store[key] = value;
    },
  };

  const globalAdapter = new GlobalContextTokenStoreAdapter(
    globalContext,
    "msDynamicsToken"
  );

  globalAdapter.write({
    accessToken: "token-1",
    instanceUrl: "https://example.crm4.dynamics.com/",
    expiresAt: 111,
  });

  assert.deepStrictEqual(store.msDynamicsToken, {
    accessToken: "token-1",
    instanceUrl: "https://example.crm4.dynamics.com/",
    expiresAt: 111,
  });

  // Existing fields should be preserved while token fields are updated.
  store.msDynamicsToken = {
    customField: "keep-me",
    accessToken: "old",
  };

  globalAdapter.write({
    accessToken: "token-2",
    instanceUrl: "https://example.crm4.dynamics.com/",
    expiresAt: 222,
  });

  assert.deepStrictEqual(store.msDynamicsToken, {
    customField: "keep-me",
    accessToken: "token-2",
    instanceUrl: "https://example.crm4.dynamics.com/",
    expiresAt: 222,
  });

  const noopAdapter = new NoopTokenStoreAdapter();
  assert.doesNotThrow(() => {
    noopAdapter.write({
      accessToken: "noop",
      instanceUrl: "https://noop",
      expiresAt: 1,
    });
  });

  const selectedGlobal = createTokenStoreAdapter({
    writeToGlobal: true,
    globalContext,
    storageKey: "msDynamicsToken",
  });
  assert.ok(selectedGlobal instanceof GlobalContextTokenStoreAdapter);

  const selectedNoop = createTokenStoreAdapter({
    writeToGlobal: false,
    globalContext,
    storageKey: "msDynamicsToken",
  });
  assert.ok(selectedNoop instanceof NoopTokenStoreAdapter);

  console.log("config token-store adapter tests passed");
}

run();
