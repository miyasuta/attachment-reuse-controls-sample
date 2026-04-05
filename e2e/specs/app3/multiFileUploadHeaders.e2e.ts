const MULTI = "multiFileUpload";
// sapMColumnHeaderContent is the class applied to sap.m.Text inside sap.m.Column headers
const MULTI_COL_HEADER_TEXT = `[id="${MULTI}"] th span.sapMColumnHeaderContent`;

describe("App3 - MultiFileUpload column headers (de)", () => {
    before(async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (browser as any).waitForUI5();
        // Navigate to the first item's detail page
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const firstItem = await (browser as any).asControl({
            selector: { controlType: "sap.m.StandardListItem" }
        });
        await firstItem.press();
        await $(`[id*="${MULTI}"]`).waitForExist({
            timeout: 15000,
            timeoutMsg: "MultiFileUpload が表示されませんでした"
        });
        // Wait for OData binding to complete so _bindTableItems() is called
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (browser as any).waitForUI5();
    });

    it("TC-3-2-13: displayProperties=\"mimeType\" でファイル名と Medientyp の2列のみ表示される", async () => {
        // Wait until the resolved label "Dateiname" appears.
        // _bindTableItems() is called asynchronously after OData metadata loads
        // (requestObject("/") in _scheduleBindTableItems), so we must wait for the
        // correct label value rather than just any non-empty text.
        await browser.waitUntil(
            async () => {
                const headers = await $$(MULTI_COL_HEADER_TEXT);
                if (headers.length === 0) return false;
                return (await headers[0].getText()) === "Dateiname";
            },
            { timeout: 30000, timeoutMsg: "カラムヘッダーが設定されませんでした" }
        );
        const headers = await $$(MULTI_COL_HEADER_TEXT);
        expect(headers.length).toBe(2);
        expect(await headers[0].getText()).toBe("Dateiname");
        expect(await headers[1].getText()).toBe("Medientyp");
    });
});
