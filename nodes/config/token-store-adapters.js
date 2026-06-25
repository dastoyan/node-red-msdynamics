class NoopTokenStoreAdapter {
  write() {
    // Intentionally empty: this adapter disables external token storage.
  }
}

class GlobalContextTokenStoreAdapter {
  constructor(globalContext, storageKey) {
    this.globalContext = globalContext;
    this.storageKey = storageKey;
  }

  write(data) {
    let dynamicsData = this.globalContext.get(this.storageKey) || {};
    dynamicsData.accessToken = data.accessToken;
    dynamicsData.instanceUrl = data.instanceUrl;
    dynamicsData.expiresAt = data.expiresAt;
    this.globalContext.set(this.storageKey, dynamicsData);
  }
}

function createTokenStoreAdapter({ writeToGlobal, globalContext, storageKey }) {
  if (writeToGlobal) {
    return new GlobalContextTokenStoreAdapter(globalContext, storageKey);
  }
  return new NoopTokenStoreAdapter();
}

module.exports = {
  NoopTokenStoreAdapter,
  GlobalContextTokenStoreAdapter,
  createTokenStoreAdapter,
};
