import {WebdriverIO, webdriverIOHelpers, config, webdriverIOClientModule} from "../../_references";

describe("AsterPlot", config.getSpecs(__dirname, (browser, reportUrl) => {
    let client: WebdriverIO.Client<void>;
    let clientModule: webdriverIOClientModule = new webdriverIOClientModule([__dirname + "/helpers.js"], function() {
    });
    
    beforeEach((done) => {
        client = webdriverIOHelpers.getWebClient(browser);
        client
            .url(reportUrl)
            .waitForVisible("div.bulletChart rect.range")
            .then(() => done());
    });

    afterEach((done) => client.endAll().finally(() => done()));

    it("selection test", (done) => {
        client.call(clientModule.execSpec(function (done) {
            var visual = new clientModules.BulletChart();

            clientModules.helpers.clickElement(visual.rangeRectsGrouped[0].first());
            clientModules.helpers.clickElement(visual.rangeRectsGrouped[1].first(), true);

            visual.rangeRectsGrouped.map(e => e.first()).forEach((e,i) => {
                if(i >= 2) {
                    expect(parseFloat(e.css('opacity'))).toBeLessThan(1);
                } else {
                    expect(parseFloat(e.css('opacity'))).toBe(1);
                }
            });

            setTimeout(() => {
                expect(clientModules.helpers.getTextWithoutChild($("svg.card > g > text.value"))).toBe("222K");
                done();
            }, 500);
        }))
        .then(() => done());
    });
}));