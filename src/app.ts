import express, {NextFunction, Request, Response} from "express";
import compression from "compression";  // compresses requests
import bodyParser from "body-parser";
const storage = require('node-persist');
// Controllers (route handlers)
import NetworkController from "./controllers/network";
import AccountController from "./controllers/account";
import {logger} from "./logger/WinstonLogger";
import MempoolController from "./controllers/mempool";
import BlockController from "./controllers/block";
import ConstructionController from "./controllers/construction";
import {ErrorCodes, ErrorResponse} from "./types/ErrorResponse";

// Create Express server
const app = express();

// Express configuration
app.set("port", process.env.PORT || 3000);
app.set("prod", process.env.NODE_ENV === "production")
app.use(compression());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));

app.use((req: Request, res: Response, next: NextFunction) => {
    logger.verbose(`Routing request for: ${req.url}`);
    logger.verbose(req.body);
    next();
});

/**
 * Primary app routes.
 */
app.use("/network", NetworkController);
app.use("/account", AccountController);
app.use("/mempool", MempoolController);
app.use("/block", BlockController);
app.use("/construction", ConstructionController);

app.use((err: ErrorResponse | any, req: Request, res: Response, next: NextFunction) => {
    if (err instanceof ErrorResponse) {
        res.json(err.getJson());
    } else {
        res
            .status(500)
            .json({
                code: ErrorCodes.UnknownError,
                message: err.message,
                details: err,
                retriable: true
            });
    }
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

setStorage();

module.exports = app;
