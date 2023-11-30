const querystring = require("querystring");
const fetch = require("node-fetch");

module.exports = function (RED) {
  class MSDynamicsConfigNode {
    constructor(config) {
      RED.nodes.createNode(this, config);
      this.clientId = config.clientId;
      this.tenantId = config.tenantId;
      this.instanceUrl = config.instanceUrl;
      this.refreshInterval = (config.refreshInterval || 30) * 60 * 1000; // Default to 30 minutes
      this.retryInterval = (config.retryInterval || 15) * 60 * 1000; // Default to 15 minutes
      this.clientSecret = this.credentials.clientSecret;
      this.tokenEndpoint = config.tokenEndpoint;
      this.grantType = config.grantType || "client_credentials";
      this.scopeSuffix = config.scopeSuffix || ".default";
      this.host = config.host || "login.microsoftonline.com";
      this.storageKey = config.storageKey || "msDynamicsToken";
      this.accessToken = null;
      this.expiresAt = null;

      this.refreshTimer = null;

      this.writeToGlobal = config.writeToGlobal;

      // Trigger token refresh when the node is created
      this.refreshToken();

      // Handle flow deployment event
      RED.events.on("nodes:deploy", () => {
        this.refreshToken();
      });

      // Handle Node-RED environment restart event
      RED.events.on("runtime-event", (event) => {
        if (event.id === "restart") {
          this.refreshToken();
        }
      });
    }

    async refreshToken() {
      // Clear any existing timer
      if (this.refreshTimer) {
        clearTimeout(this.refreshTimer);
        this.refreshTimer = null;
      }
      try {
        const scope = `${this.instanceUrl}${this.scopeSuffix}`;
        const payload = querystring.stringify({
          grant_type: this.grantType,
          client_id: this.clientId,
          client_secret: this.clientSecret,
          scope: scope,
        });

        const response = await fetch(this.tokenEndpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: payload,
        });

        const data = await response.json();
        if (response.ok) {
          this.accessToken = data.access_token;
          this.expiresAt = Date.now() + data.expires_in * 1000;

          if (this.writeToGlobal) {
            // Store token and instance URL in global context
            // This is not needed for the other nodes, but is intended as a helper for the users that develop flows to have a token that they can use when doing custom function calls.
            let globalContext = this.context().global;
            let dynamicsData = globalContext.get(this.storageKey) || {};
            dynamicsData.accessToken = this.accessToken;
            dynamicsData.instanceUrl = this.instanceUrl;
            dynamicsData.expiresAt = this.expiresAt;
            globalContext.set(this.storageKey, dynamicsData);
          }
          // Set up next refresh
          this.refreshTimer = setTimeout(
            () => this.refreshToken(),
            this.refreshInterval
          );
        } else {
          this.error(`Failed to refresh token: ${response.statusText}`);
          // Retry after some delay in case of failure
          // Set up next refresh
          this.refreshTimer = setTimeout(
            () => this.refreshToken(),
            this.retryInterval
          );
        }
      } catch (error) {
        this.error(`Error refreshing token: ${error.message}`);
        // Set up next refresh
        this.refreshTimer = setTimeout(
          () => this.refreshToken(),
          this.retryInterval
        );
      }
    }

    getToken() {
      // Check if token is expired before passing it to other nodes
      if (this.expiresAt && Date.now() < this.expiresAt) {
        return this.accessToken;
      } else {
        this.refreshToken();
        return null; // Return null while the token is being refreshed
      }
    }
  }

  RED.nodes.registerType("msdynamics-config", MSDynamicsConfigNode, {
    credentials: {
      clientSecret: { type: "password" },
    },
  });
};
