const fetch = require("node-fetch");

module.exports = function (RED) {
  function MSDynamicsContactLookupNode(config) {
    RED.nodes.createNode(this, config);
    let node = this;
    let configNode = RED.nodes.getNode(config.configNodeId);

    // Set default timeout to 3000 ms if not specified
    this.timeout = config.timeout || 3000;

    // Which contact attributes should be used as key for the lookup
    this.lookupTelephone = config.lookupTelephone;
    this.lookupMobile = config.lookupMobile;
    this.customLookupAttributes = config.customLookupAttributes;
    // Or if a custom attribute should be used as a key for the lookup
    this.selectedOption = config.selectedOption;
    this.customAttribute = config.customAttribute;
    // Attributes to return - all or a custom list
    this.returnAttributesOption = config.returnAttributesOption;
    this.customReturnAttributes = config.customReturnAttributes;

    function processPhoneNumber(phoneNumberPath) {
      if (!phoneNumberPath) {
        throw new Error("Phone number path is undefined or null");
      }
      // Remove domain part if present (e.g., 'tel:+123456@domain123.com' becomes 'tel:+123456')
      let phoneNumber = phoneNumberPath.split("@")[0];
      // Clean up the phone number to keep only digits and leading '+'
      phoneNumber = phoneNumber.replace(/[^0-9+]/g, "");
      if (!phoneNumber) {
        throw new Error(
          "Configured phone number attribute does not exist in the incoming message"
        );
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
      const apiVersion = configNode.apiVersion || "v9.2";

      let queryParts = [];
      // Add standard attributes if selected
      if (node.lookupTelephone) {
        queryParts.push(`telephone1 eq '${phoneNumber}'`);
      }
      if (node.lookupMobile) {
        queryParts.push(`mobilephone eq '${phoneNumber}'`);
      }
      // Add custom lookup attributes to the query
      if (node.customLookupAttributes) {
        const customAttributes = node.customLookupAttributes
          .split(",")
          .map((attr) => attr.trim());
        customAttributes.forEach((attr) => {
          if (attr) {
            queryParts.push(`${attr} eq '${phoneNumber}'`);
          }
        });
      }
      if (queryParts.length === 0) {
        throw new Error("No lookup attributes defined.");
      }
      const query = queryParts.join(" or ");
      const encodedQuery = encodeURIComponent(query);

      let selectClause = "";
      console.log("this.returnAttributesOption ", node.returnAttributesOption);
      if (node.returnAttributesOption === "custom") {
        let attributesList = node.customReturnAttributes
          .split(",")
          .map((attr) => attr.trim())
          .join(",");
        selectClause = `&$select=${attributesList}`;
      }

      const url = `${configNode.instanceUrl}api/data/${apiVersion}/contacts?$filter=${encodedQuery}${selectClause}`;
      console.log(url);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), node.timeout);

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
      // Ensure at least one lookup attribute is checked
      /*       if (!config.lookupTelephone && !config.lookupMobile) {
        node.error(
          "At least one of 'Lookup Telephone' or 'Lookup Mobile' must be checked."
        );
        node.send([
          null,
          null,
          {
            error:
              "At least one of 'Lookup Telephone' or 'Lookup Mobile' must be checked.",
          },
        ]);
        return;
      }
 */
      try {
        let pathMap = {
          sessionSipUri: "msg.session.sipUri",
          initiatorId: "msg.dialogue.initiator.platformParticipantId",
          payloadQ: "msg.payload.q",
          custom: node.customAttribute,
        };

        let phoneNumberPath = pathMap[node.selectedOption];
        //let phoneNumberValue = getValueFromPath(msg, phoneNumberPath);
        let phoneNumberValue = eval(phoneNumberPath);
        let phoneNumber = processPhoneNumber(phoneNumberValue);

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
