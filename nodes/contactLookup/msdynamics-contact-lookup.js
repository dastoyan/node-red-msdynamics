const fetch = require("node-fetch");
const { getValueFromMsgPath } = require("./msg-path-utils");
const { preparePhoneNumber } = require("./phone-number-utils");
const { buildContactsLookupUrl } = require("./odata-query-builder");
const {
  LookupOutcome,
  classifyLookupResponse,
  routeLookupMessage,
} = require("./lookup-result-classifier");

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
      const url = buildContactsLookupUrl({
        instanceUrl: configNode.instanceUrl,
        apiVersion: configNode.apiVersion,
        phoneNumber,
        lookupTelephone: node.lookupTelephone,
        lookupMobile: node.lookupMobile,
        customLookupAttributes: node.customLookupAttributes,
        returnAttributesOption: node.returnAttributesOption,
        customReturnAttributes: node.customReturnAttributes,
      });
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
        let phoneNumberValue = getValueFromMsgPath(msg, phoneNumberPath);
        let phoneNumber = preparePhoneNumber(phoneNumberValue);

        let httpResponse = await performLookup(phoneNumber);

        // Merge HTTP response properties directly into msg
        Object.assign(msg, httpResponse);

        const lookupOutcome = classifyLookupResponse(httpResponse);

        if (lookupOutcome === LookupOutcome.API_ERROR) {
          // Handle HTTP and parsing errors
          throw new Error(httpResponse.body.error);
        }

        if (lookupOutcome === LookupOutcome.INVALID_RESPONSE) {
          throw new Error("Invalid lookup response from Dynamics API");
        }

        node.send(routeLookupMessage(lookupOutcome, msg));
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
