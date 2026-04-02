sap.ui.define([
    "sap/ui/core/mvc/Controller"
], (Controller) => {
    "use strict";

    return Controller.extend("freestylenondraft.controller.View1", {
        onInit() {
        },

        onItemPress(oEvent) {
            const oContext = oEvent.getSource().getBindingContext("mainModel");
            const sId = oContext.getProperty("ID");
            this.getOwnerComponent().getRouter().navTo("RouteDetail", { id: sId });
        }
    });
});
