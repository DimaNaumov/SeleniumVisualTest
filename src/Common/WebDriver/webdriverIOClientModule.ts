﻿import * as fs from "fs";
import {jasmineHelpers} from "../jasmine/jasmineHelpers";
import * as path from "path";

export class webdriverIOClientModule {
    static init = (function() {
        jasmine.getEnv().addReporter({
            specStarted: (spec) => webdriverIOClientModule.currentSpec = spec
        });
    })();
    static currentSpec: jasmine.Spec;

    private modules: string[];
    private loadedModules: string;
    private specInitFunction: () => void;

    constructor(modules?: string[]);
    constructor(specInitFunction?: () => void);
    constructor(modules: string[], specInitFunction: () => void);
    constructor(modules?: any, specInitFunction?: () => void) {
        if(arguments.length < 2 && _.isFunction(modules)) {
            specInitFunction = modules;
            modules = undefined;
        }

        this.specInitFunction = specInitFunction;
        this.modules = <any>modules || [];

        const commonModules = ["../ClientModules/helpers.js", "../ClientModules/colorHelpers.js"];
        commonModules.reverse().forEach(x => this.modules.unshift(path.join(__dirname, x)));
    }

    public execSpec<T>(assertion: (done: () => void) => void | (() => void), timeout?: number) {
        let currentSpecName = webdriverIOClientModule.currentSpec.fullName;
        return this.getFunctionForClient(client => {
            return client
                .execute("return window.jasmineRequire").then(jasmineRequire => {
                    if(!jasmineRequire.value) {
                        return client
                            .execute(function(code) { eval(code); }, jasmineHelpers.getJasmineCoreJs())//load jasmine core
                            .catch(err => { throw "Spec execution: There is an error loading jasmine"; });
                    }
                })
                .execute(this.getJasmineBootJs(), jasmineHelpers.getDefaultTimeoutInterval())//init jasmine
                .execute(function(code) { eval(code); }, jasmineHelpers.getJasmineJQueryJs())//load jasmine jquery
                .executeAsync(//execute spec
                    this.addSpec(),
                    this.specInitFunction ? this.specInitFunction.toString() : "",
                    assertion.toString(),
                    timeout,
                    currentSpecName,
                    this.getLoadedModules())
                .then((result: any) => {
                    try {
                        let specExecutionResult = <SpecExecutionResult>JSON.parse(result.value);//parse results

                        specExecutionResult.failedExpectations.forEach(e => webdriverIOClientModule.currentSpec.failedExpectations.push(e));
                        specExecutionResult.passedExpectations.forEach(e => webdriverIOClientModule.currentSpec.passedExpectations.push(e));
                        specExecutionResult.consoleMessages.forEach(m => {
                            m.message = getCurrentSpecText(m.message, true);
                            switch(m.type) {
                                case "log": return console.log(m.message);
                                case "error": return console.error(Chalk.red(m.message));
                                case "warn": return console.warn(Chalk.yellow(m.message));
                            }
                        });
                    } catch(ex) {
                        throw "Spec execution: There is no valid response from the client: " + result.value;
                    }
                }).catch(err => {
                    throw err;
                });
            });

        function getCurrentSpecText(text: string, isClient?: boolean) {
            return `${currentSpecName}${isClient ? " (client)" : ""}: ${text}`;
        }
    }

    public getItClient(getClient: () => WebdriverIO.Client<void>) {
        return this.getJasmineSpecMethod(it, getClient);
    }

    public getXitClient(getClient: () => WebdriverIO.Client<void>) {
        return this.getJasmineSpecMethod(xit, getClient);
    }

    private getJasmineSpecMethod(
        method: (expectation: string, assertion?: (done: () => void) => void, timeout?: number) => void,
        getClient: () => WebdriverIO.Client<void>) {
        return (expectation: string, assertion?: (done: () => void) => void | (() => void), timeout?: number) =>
             method(expectation, done => getClient().call(this.execSpec(assertion, timeout)).then(() => done()), timeout);
    }

    private addSpec() {
        return function(specInitFunction: string, assertion: string, timeout: number, name: string, clientModules: string, testExecuted: (result: any) => void) {
            var specExecutionResult = <SpecExecutionResult>{ consoleMessages: [] };
            var consoleFnNames = ["log", "error", "warn"];
            var consoleFunctions = consoleFnNames.map(n => <Function>window.console[n]);

            consoleFnNames.forEach((type, i) => window.console[type] = function(message) {
                specExecutionResult.consoleMessages.push({type: type, message: message && message.toString() });
                return consoleFunctions[i].apply(window.console, arguments);
            });

            jasmine.getEnv().addReporter({
                jasmineStarted: function() {},
                jasmineDone: function() {
                    consoleFnNames.forEach((type, i) => window.console[type] = consoleFunctions[i]);
                    var result = jasmine.getEnv()
                        .topSuite()
                        .children[0]
                        .children[0]
                        .result;

                    specExecutionResult.failedExpectations = result.failedExpectations
                    specExecutionResult.passedExpectations = result.passedExpectations

                    testExecuted(JSON.stringify(specExecutionResult));
                }
            });

            describe("", function() {
                eval(clientModules + ";");
                var context: any = eval(`new ${specInitFunction}`);
                var assertionFunction: Function = eval("assertion = " + assertion);
                it(name, assertionFunction.bind(context), timeout);
            });

            setTimeout(function() {
                jasmine.getEnv().execute();
            }, 0);
        };
    }

    private getLoadedModules() {
        if(_.isEmpty(this.modules)) {
            return "";
        }
        if(!_.isNil(this.loadedModules)) {
            return this.loadedModules;
        }

        this.loadedModules = "";
        for(let modulePath of this.modules) {
            let content = fs.readFileSync(path.normalize(modulePath), "utf8");
            this.loadedModules += `/// ${path}\n${content}\n\n\n`;
        }

        return this.loadedModules;
    }

    private getJasmineBootJs() {
        var jasmineRequire, window; //just declarations
        return function(defaultTimeoutInterval: number) {
            window.jasmine = jasmineRequire.core(jasmineRequire);
            var env = jasmine.getEnv();
            var jasmineInterface = jasmineRequire.interface(jasmine, env);
            for (var property in jasmineInterface) {
                window[property] = jasmineInterface[property];
            }

            window.setTimeout = window.setTimeout;
            window.setInterval = window.setInterval;
            window.clearTimeout = window.clearTimeout;
            window.clearInterval = window.clearInterval;

            jasmine.DEFAULT_TIMEOUT_INTERVAL = defaultTimeoutInterval
        }
    }

    private getFunctionForClient(callback: (client: WebdriverIO.Client<void>) => WebdriverIO.Client<void>) {
        return function() {
            return callback(this);
        }
    }
}

interface SpecExecutionResult {
    failedExpectations?: any[];
    passedExpectations?: any[];
    consoleMessages: ({ type: string, message: string })[];
}