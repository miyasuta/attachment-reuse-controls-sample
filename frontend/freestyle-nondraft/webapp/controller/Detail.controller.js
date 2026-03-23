sap.ui.define([
    "sap/ui/core/mvc/Controller"
], (Controller) => {
    "use strict";

    return Controller.extend("freestylenondraft.controller.Detail", {
        onInit() {
            const oRouter = this.getOwnerComponent().getRouter();
            oRouter.getRoute("RouteDetail").attachPatternMatched(this._onPatternMatched, this);
        },

        _onPatternMatched(oEvent) {
            const sId = oEvent.getParameter("arguments").id;
            this.getView().bindElement({
                path: "/Quotations(ID=" + sId + ")",
                parameters: {
                    $$updateGroupId: "$auto"
                }
            });
        },

        onNavBack() {
            this.getOwnerComponent().getRouter().navTo("RouteView1", {}, true);
        },

        onToggleEnabled(oEvent) {
            const bEnabled = oEvent.getParameter("state");
            this.byId("singleFileUpload").setEnabled(bEnabled);
        }
    });
});
