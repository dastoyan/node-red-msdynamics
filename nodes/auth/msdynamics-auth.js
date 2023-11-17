const querystring = require("querystring");
let fetch;

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
    const instanceUrl = config.instanceUrl;
    const autoRefresh = config.autoRefresh;
    const refreshInterval = (config.refreshInterval || 30) * 60 * 1000;
    const retryInterval = (config.retryInterval || 15) * 60 * 1000;

    async function refreshToken() {
      const fetchModule = await fetch;
      node.warn("Starting refreshToken function");

      const tokenEndpoint = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
      const payload = {
        grant_type: "client_credentials",
        client_id: clientId,
        client_secret: clientSecret,
        scope: `${instanceUrl}.default`,
      };

      fetchModule(tokenEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Host: "login.microsoftonline.com",
        },
        body: querystring.stringify(payload),
      })
        .then((response) =>
          response.ok
            ? response.json()
            : Promise.reject(
                new Error(`HTTP error! status: ${response.status}`)
              )
        )
        .then((data) => {
          const expiresInMilliseconds = data.expires_in * 1000;
          const expiresAt = Date.now() + expiresInMilliseconds;

          const tokenData = {
            accessToken: data.access_token,
            expiresAt: expiresAt,
          };

          node.context().global.set("msDynamicsToken", tokenData);
          node.send([{ payload: data }, null]);

          if (autoRefresh) {
            clearTimeout(refreshTimeout);
            refreshTimeout = setTimeout(refreshToken, refreshInterval);
          }
        })
        .catch((error) => {
          node.error("Failed to refresh MS Dynamics token: " + error.message);
          node.status({ fill: "red", shape: "ring", text: "refresh failed" });
          node.send([null, { payload: error.message }]);

          if (autoRefresh) {
            clearTimeout(refreshTimeout);
            refreshTimeout = setTimeout(refreshToken, retryInterval);
          }
        });
    }
    // Validate configuration
    if (!clientId || !clientSecret || !tenantId || !instanceUrl) {
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
