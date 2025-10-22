module.exports = {
  name: 'disconnect',
  isNodeEvent: true,
  execute(client, node, reason) {
    let reasonStr;
    try {
      reasonStr =
        reason && typeof reason === 'object' ? JSON.stringify(reason, Object.getOwnPropertyNames(reason), 2) : String(reason);
    } catch (e) {
      reasonStr = String(reason);
    }

    console.log(
      global.styles.errorColor(`[Node Disconnect] `) +
        global.styles.warningColor(`Node ${node.id} disconnected`) +
        global.styles.secondaryColor(` - Reason: ${reasonStr}`)
    );
  },
};
