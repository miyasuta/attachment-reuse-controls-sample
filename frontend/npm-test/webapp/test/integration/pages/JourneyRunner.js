sap.ui.define([
    "sap/fe/test/JourneyRunner",
	"npmtest/test/integration/pages/QuotationsList",
	"npmtest/test/integration/pages/QuotationsObjectPage"
], function (JourneyRunner, QuotationsList, QuotationsObjectPage) {
    'use strict';

    var runner = new JourneyRunner({
        launchUrl: sap.ui.require.toUrl('npmtest') + '/test/flpSandbox.html#npmtest-tile',
        pages: {
			onTheQuotationsList: QuotationsList,
			onTheQuotationsObjectPage: QuotationsObjectPage
        },
        async: true
    });

    return runner;
});

