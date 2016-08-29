﻿import * as fs from "fs";

export module jasmineHelpers {
    export function getDefaultTimeoutInterval(): number {
        return (<any>jasmine.getEnv()).defaultTimeoutInterval;
    }

    export function getJasmineCoreJs() {
        return fs.readFileSync(__dirname.replace("\\","/") + "/../../../node_modules/jasmine-core/lib/jasmine-core/jasmine.js", "utf8");
    }

    export function getJasmineJQueryJs() {
        return fs.readFileSync(__dirname.replace("\\","/") + "/../../../node_modules/jasmine-jquery/lib/jasmine-jquery.js", "utf8");
    }
}