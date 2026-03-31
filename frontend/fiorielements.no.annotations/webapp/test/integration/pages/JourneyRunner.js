sap.ui.define([
    "sap/fe/test/JourneyRunner",
	"ns/fiorielements/no/annotations/test/integration/pages/QuotationsList",
	"ns/fiorielements/no/annotations/test/integration/pages/QuotationsObjectPage"
], function (JourneyRunner, QuotationsList, QuotationsObjectPage) {
    'use strict';

    var runner = new JourneyRunner({
        launchUrl: sap.ui.require.toUrl('ns/fiorielements/no/annotations') + '/test/flp.html#app-preview',
        pages: {
			onTheQuotationsList: QuotationsList,
			onTheQuotationsObjectPage: QuotationsObjectPage
        },
        async: true
    });

    return runner;
});

