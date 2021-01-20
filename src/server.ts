import errorHandler from "errorhandler";

import app from "./app";

/**
 * Error Handler. Provides full stack
 */
if (!app.get("prod")) {
    app.use(errorHandler());
}

/**
 * Start Express server.
 */
const server = app.listen(app.get("port"), () => {
    console.log(
        "  App is running at http://localhost:%d in %s mode",
        app.get("port"),
        app.get("env")
    );
    console.log("  Press CTRL-C to stop\n");
});

server.setTimeout(10000);

export default server;
