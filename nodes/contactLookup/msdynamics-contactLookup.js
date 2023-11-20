module.exports = function (RED) {
  function MSDynamicsContactLookupNode(config) {
    RED.nodes.createNode(this, config);
    var node = this;

    node.on("input", function (msg) {
      // Example: Extract phone number from msg.session.sipUri and clean it
      const sipUri = msg.session.sipUri;
      const phoneNumber = sipUri
        .split("@")[0]
        .replace(/^(sip:|tel:)/, "")
        .replace(/[^\d+]/g, "");

      // Mock Dynamics lookup logic
      var mockData = {
        contact: { name: "John Doe", phone: phoneNumber },
        // Add other mock data if needed
      };

      msg.payload = mockData; // Replace with actual lookup logic in future
      node.send(msg);
    });
  }

  RED.nodes.registerType(
    "msdynamics-contactlookup",
    MSDynamicsContactLookupNode
  );
};
