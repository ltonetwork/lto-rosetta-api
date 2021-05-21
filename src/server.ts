import errorHandler from "errorhandler";
const storage = require('node-persist');

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
const server = app.listen(app.get("port"), async () => {
    console.log(
        "  App is running at http://localhost:%d in %s mode",
        app.get("port"),
        app.get("env")
    );
    console.log("  Press CTRL-C to stop\n");
    await setStorage();
    console.log(`State now stored at: ${__dirname}/storage`)
});

const setStorage = async () => {
    await storage.init({
        dir: `${__dirname}/storage`,

        stringify: JSON.stringify,

        parse: JSON.parse,

        encoding: 'utf8',

        logging: true,  // can also be custom logging function

        ttl: false, // ttl* [NEW], can be true for 24h default or a number in MILLISECONDS or a valid Javascript Date object

        expiredInterval: 2 * 60 * 1000, // every 2 minutes the process will clean-up the expired cache

        // in some cases, you (or some other service) might add non-valid storage files to your
        // storage dir, i.e. Google Drive, make this true if you'd like to ignore these files and not throw an error
        forgiveParseErrors: false

    });
}

server.setTimeout(10000);

export default server;
