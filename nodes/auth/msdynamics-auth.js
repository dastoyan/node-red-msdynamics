module.exports = function(RED) {
    function MSDynamicsAuthNode(config) {
        RED.nodes.createNode(this, config);

        var node = this;

        // Retrieve configuration from the node's settings
        var clientId = config.clientId;
        var clientSecret = this.credentials.clientSecret;
        var tenantId = config.tenantId;
        var instanceUrl = config.instanceUrl;
        
        // Function to refresh the token
        function refreshToken() {
            const tokenEndpoint = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
            const scope = `${instanceUrl}.default`;
            const host = "login.microsoftonline.com";

            const payload = {
                grant_type: "client_credentials",
                client_id: clientId,
                client_secret: clientSecret,
                scope: scope
            };

            const requestOptions = {
                method: "POST",
                url: tokenEndpoint,
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                    "Host": host
                },
                form: payload
            };

            RED.util.httpRequest(requestOptions, function(error, response, body) {
                if (!error && response.statusCode === 200) {
                    const tokenResponse = JSON.parse(body);
                    const expiresInMilliseconds = tokenResponse.expires_in * 1000;
                    const expiresAt = Date.now() + expiresInMilliseconds;

                    const tokenData = {
                        accessToken: tokenResponse.access_token,
                        expiresAt: expiresAt
                    };

                    // Save token data to global context
                    node.context().global.set("msDynamicsToken", tokenData);

                    // Schedule the next refresh
                    setTimeout(refreshToken, expiresInMilliseconds - (10 * 60 * 1000)); // refresh 10 minutes before expiry
                } else {
                    node.error("Failed to refresh MS Dynamics token: " + error);
                    // Retry after a delay
                    setTimeout(refreshToken, 15 * 60 * 1000); // retry in 15 minutes
                }
            });
        }

        // Initial token refresh
        refreshToken();

        // In case the user wants to manually trigger a refresh
        node.on('input', function(msg) {
            refreshToken();
        });
    }

    RED.nodes.registerType("msdynamics-auth", MSDynamicsAuthNode, {
        credentials: {
            clientSecret: { type: "text" }
        }
    });
}
