import dotenv from "dotenv";
import fs from "fs";
import {logger} from "../logger/WinstonLogger";

if (fs.existsSync(".env")) {
    logger.debug("Using .env file to supply config environment variables");
    dotenv.config({ path: ".env" });
} else {
    logger.debug("Using .env.example file to supply config environment variables");
    dotenv.config({ path: ".env.example" });  // you can delete this after you create your own .env file!
}
export const ENVIRONMENT = process.env.NODE_ENV;

export const API_BASE = process.env.API_BASE;
export const REFERENCE_API_BASE = process.env.REFERENCE_API_BASE;

export const BURN_ACTIVATION_HEIGHT: number = parseInt(process.env.BURN_ACTIVATION_HEIGHT);
export const CHAIN_ID: string = process.env.CHAIN_ID;
