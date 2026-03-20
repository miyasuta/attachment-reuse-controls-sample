sap.ui.define([
    "sap/ui/test/opaQunit",
    "./pages/JourneyRunner"
], function (opaTest, runner) {
    "use strict";

    function journey() {
        QUnit.module("First journey");

        opaTest("Start application", function (Given, When, Then) {
            Given.iStartMyApp();

            Then.onTheQuotationsList.iSeeThisPage();
            Then.onTheQuotationsList.onTable().iCheckColumns(5, {"createdAt":{"header":"Created On"},"createdBy":{"header":"Created By"},"modifiedAt":{"header":"Changed On"},"modifiedBy":{"header":"Changed By"},"Description":{"header":"Description"}});

        });


        opaTest("Navigate to ObjectPage", function (Given, When, Then) {
            // Note: this test will fail if the ListReport page doesn't show any data
            
            When.onTheQuotationsList.onFilterBar().iExecuteSearch();
            
            Then.onTheQuotationsList.onTable().iCheckRows();

            When.onTheQuotationsList.onTable().iPressRow(0);
            Then.onTheQuotationsObjectPage.iSeeThisPage();

        });

        opaTest("Teardown", function (Given, When, Then) { 
            // Cleanup
            Given.iTearDownMyApp();
        });
    }

    runner.run([journey]);
});