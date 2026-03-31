import { wdi5Config } from "wdio-ui5-service";
import { baseConfig } from "./wdio.conf.base";

export const config: wdi5Config = {
    ...(baseConfig as wdi5Config),
    baseUrl: "http://localhost:8080/index.html",
    specs: ["./specs/app1/**/*.e2e.ts"]
};
