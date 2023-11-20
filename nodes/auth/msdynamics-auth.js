const querystring = require("querystring");
const fetch = require("node-fetch");

module.exports = function (RED) {
  if (!fetch) {
    fetch = import("node-fetch").then((mod) => mod.default);
  }
  function MSDynamicsAuthNode(config) {
    RED.nodes.createNode(this, config);

    const node = this;
    let refreshTimeout;

    // Initial status
    node.status({ fill: "yellow", shape: "ring", text: "initializing" });

    const clientId = config.clientId;
    const clientSecret = this.credentials.clientSecret;
    const tenantId = config.tenantId;
    const currentInstanceUrl = config.instanceUrl;
    const autoRefresh = config.autoRefresh;

    // Use user-provided values if available, otherwise use hardcoded defaults
    const refreshInterval = (config.refreshInterval || 30) * 60 * 1000;
    const retryInterval = (config.retryInterval || 15) * 60 * 1000;
    const tokenEndpoint = config.tokenEndpoint;
    const grantType = config.grantType || "client_credentials";
    const scopeSuffix = config.scopeSuffix || ".default";
    const host = config.host || "login.microsoftonline.com";

    // Configuration option for storage object key
    const storageKey = config.storageKey || "msDynamicsToken";
    let storedData = node.context().global.get(storageKey) || {};
    // Update instanceUrl in the storage object
    storedData.instanceUrl = currentInstanceUrl;
    // Save the updated object back to the global context
    node.context().global.set(storageKey, storedData);

    async function refreshToken() {
      try {
        const scope = `${currentInstanceUrl}${scopeSuffix}`;
        const payload = querystring.stringify({
          grant_type: grantType,
          client_id: clientId,
          client_secret: clientSecret,
          scope: scope,
        });

        const response = await fetch(tokenEndpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Host: host,
          },
          body: payload,
        });

        const data = await response.json();

        if (response.ok) {
          //Get the global context var before writing to it in order to ensure that values not managed by this node do not get overwritten. Allows the user to extned the object with their own additional values.
          let storedData = node.context().global.get(storageKey) || {};
          storedData.accessToken = data.access_token;
          //Help the user with a precalulated expiresAt field in case they want to implement their own refresh logic.
          storedData.expiresAt = Date.now() + data.expires_in * 1000;
          node.context().global.set(storageKey, storedData);

          node.send([
            {
              payload: {
                response: data,
                headers: response.headers,
                status: response.status,
              },
            },
            null,
          ]);
          if (autoRefresh) {
            //Avoid memory leaks from multiple running timers.
            clearTimeout(refreshTimeout);
            refreshTimeout = setTimeout(refreshToken, refreshInterval);
          }
        } else {
          // Handle non-ok responses. Log the status to the dubug console.
          node.error("HTTP error from MS Dynamics: " + response.statusText);
          node.status({ fill: "red", shape: "ring", text: "HTTP error" });
          node.send([null, { payload: data, completeResponse: response }]);
        }
      } catch (error) {
        // Handle exceptions. Log the status to the dubug console.
        node.error("Failed to refresh MS Dynamics token: " + error.message);
        node.status({ fill: "red", shape: "ring", text: "refresh failed" });
        node.send([null, { payload: error.message }]);
        if (autoRefresh) {
          clearTimeout(refreshTimeout);
          refreshTimeout = setTimeout(refreshToken, retryInterval);
        }
      }
    }
    // Validate configuration
    if (!clientId || !clientSecret || !tenantId || !currentInstanceUrl) {
      node.error("Missing configuration data");
      node.status({ fill: "red", shape: "ring", text: "not configured" });
      return;
    }
    // Configuration is valid
    node.status({ fill: "green", shape: "dot", text: "configured" });

    if (autoRefresh) {
      refreshToken();
    }

    node.on("input", () => refreshToken());

    node.on("close", () => {
      if (refreshTimeout) {
        clearTimeout(refreshTimeout);
      }
    });
  }

  RED.nodes.registerType("msdynamics-auth", MSDynamicsAuthNode, {
    credentials: {
      clientSecret: { type: "text" },
    },
  });
};
