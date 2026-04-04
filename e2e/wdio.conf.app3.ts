import { wdi5Config } from "wdio-ui5-service";
import { baseConfig } from "./wdio.conf.base";

export const config: wdi5Config = {
    ...(baseConfig as wdi5Config),
    baseUrl: "http://localhost:8082/index.html?sap-ui-language=de",
    specs: ["./specs/app3/**/*.e2e.ts"]
};
