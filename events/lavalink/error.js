module.exports = {
  name: 'error',
  isNodeEvent: true,
  execute(client, node, error, payload) {
    const errMsg =
      error && typeof error === 'object' ? JSON.stringify(error, Object.getOwnPropertyNames(error), 2) : String(error);
    console.log(
      global.styles.errorColor(`[Node Error] `) +
        global.styles.warningColor(`Node ${node.id} encountered an error:`) +
        '\n' +
        global.styles.errorColor(errMsg)
    );

    // If the error has a stack, print it too
    if (error && error.stack) {
      console.log(global.styles.secondaryColor(`Stack:`) + '\n' + global.styles.infoColor(error.stack));
    }

    if (payload) {
      try {
        console.log(
          global.styles.secondaryColor(`Payload:`) +
            '\n' +
            global.styles.infoColor(JSON.stringify(payload, null, 2))
        );
      } catch (e) {
        console.log(global.styles.secondaryColor(`Payload:`) + '\n' + global.styles.infoColor(String(payload)));
      }
    }
  },
};
