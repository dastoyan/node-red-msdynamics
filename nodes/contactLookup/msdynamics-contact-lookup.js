module.exports = function (RED) {
  function MSDynamicsContactLookupNode(config) {
    RED.nodes.createNode(this, config);
    let node = this;
    let configNode = RED.nodes.getNode(config.configNodeId);

    // Set default timeout to 3000 ms if not specified
    this.timeout = config.timeout || 3000;
    this.lookupTelephone = config.lookupTelephone || true;
    this.lookupMobile = config.lookupMobile || true;

    function processPhoneNumber(msg) {
      if (!configNode) {
        node.error("MS Dynamics config node not found");
        node.send([null, { error: "MS Dynamics config node not found" }]);
        return;
      }
      let phoneNumber = msg.session?.sipUri?.replace(/[^0-9+]/g, "");
      if (!phoneNumber) {
        throw new Error("Phone number not found or invalid");
      }
      return phoneNumber;
    }

    async function handleFetchResponse(response) {
      const headers = {}; // Raw headers
      for (const [key, value] of response.headers.entries()) {
        headers[key] = value;
      }
      const result = {
        statusCode: response.status,
        statusText: response.statusText,
        headers: headers,
        body: null,
      };

      // Handle non-OK responses
      if (!response.ok) {
        result.body = { error: `HTTP error! status: ${response.status}` };
        return result;
      }

      try {
        result.body = await response.json();
      } catch (e) {
        result.body = { error: "Failed to parse JSON response" };
      }

      return result;
    }

    async function performLookup(phoneNumber) {
      let queryParts = [];
      if (node.lookupTelephone) {
        queryParts.push(`telephone1 eq '${phoneNumber}'`);
      }
      if (node.lookupMobile) {
        queryParts.push(`mobilephone eq '${phoneNumber}'`);
      }
      const query = queryParts.join(" or ");
      const encodedQuery = encodeURIComponent(query);

      const apiVersion = configNode.apiVersion || "v9.2";
      const url = `${configNode.instanceUrl}api/data/${apiVersion}/contacts?$filter=${encodedQuery}`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), node.timeout);
      console.log("url ", url);

      try {
        const response = await fetch(url, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${configNode.getToken()}`,
            "OData-MaxVersion": "4.0",
            "OData-Version": "4.0",
            Accept: "application/json",
          },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        return await handleFetchResponse(response);
      } catch (error) {
        clearTimeout(timeoutId);
        if (error.name === "AbortError") {
          throw new Error("Lookup request timed out");
        }
        throw new Error(`Error making HTTP request: ${error.message}`);
      }
    }

    node.on("input", async function (msg) {
      try {
        let phoneNumber = processPhoneNumber(msg);
        let httpResponse = await performLookup(phoneNumber);

        // Merge HTTP response properties directly into msg
        Object.assign(msg, httpResponse);

        if (httpResponse.body.error) {
          // Handle HTTP and parsing errors
          throw new Error(httpResponse.body.error);
        }

        let resultCount = httpResponse.body?.value?.length;

        if (resultCount === 0) {
          // No contact found
          node.send([null, { ...msg }, null]);
        } else if (resultCount === 1) {
          // One contact found
          node.send([{ ...msg }, null, null]);
        } else if (resultCount > 1) {
          // Multiple contacts found
          node.send([null, { ...msg }, null]);
        }
      } catch (error) {
        node.error("Error in contact lookup: " + error.message);
        // Merge error details directly into msg
        Object.assign(msg, { error: error.message });
        node.send([null, null, { ...msg }]);
      }
    });
  }

  RED.nodes.registerType(
    "msdynamics-contact-lookup",
    MSDynamicsContactLookupNode
  );
};
