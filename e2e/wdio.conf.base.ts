import { wdi5Config } from "wdio-ui5-service";

export const baseConfig: Partial<wdi5Config> = {
    maxInstances: 10,
    capabilities: [
        {
            browserName: "chrome",
            "goog:chromeOptions": {
                args:
                    process.argv.indexOf("--headless") > -1
                        ? ["--headless=new"]
                        : process.argv.indexOf("--debug") > -1
                          ? ["window-size=1440,800", "--auto-open-devtools-for-tabs"]
                          : ["window-size=1440,800"]
            },
            acceptInsecureCerts: true
        }
    ],
    logLevel: "error",
    bail: 0,
    waitforTimeout: 10000,
    connectionRetryTimeout: process.argv.indexOf("--debug") > -1 ? 1200000 : 120000,
    connectionRetryCount: 3,
    services: ["ui5"],
    framework: "mocha",
    reporters: ["spec"],
    mochaOpts: {
        ui: "bdd",
        timeout: process.argv.indexOf("--debug") > -1 ? 600000 : 60000
    }
};
