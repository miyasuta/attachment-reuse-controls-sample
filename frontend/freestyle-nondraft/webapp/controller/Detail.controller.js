sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel"
], (Controller, JSONModel) => {
    "use strict";

    return Controller.extend("freestylenondraft.controller.Detail", {
        onInit() {
            this.getView().setModel(new JSONModel({ uploadEnabled: true }), "view");
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
            this.getView().getModel("view").setProperty("/uploadEnabled", bEnabled);
        }
    });
});
