const MULTI = "multiFileUpload";
// sapMListTblCol is a stable UI5 class for sap.m.Table column header cells
const MULTI_COL_HEADER = `[id*="${MULTI}"] .sapMListTblHeader th.sapMListTblCol`;

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
    });

    it("TC-3-2-13: カラムヘッダーがODataメタモデルのドイツ語ラベルで表示される", async () => {
        // Wait for column headers to be populated by _bindTableItems
        await browser.waitUntil(
            async () => {
                const headers = await $$(`${MULTI_COL_HEADER} span.sapMText`);
                if (headers.length === 0) return false;
                return (await headers[0].getText()).length > 0;
            },
            { timeout: 10000, timeoutMsg: "カラムヘッダーが設定されませんでした" }
        );
        const headers = await $$(`${MULTI_COL_HEADER} span.sapMText`);
        expect(await headers[0].getText()).toBe("Dateiname");
        expect(await headers[1].getText()).toBe("Angelegt am");
        expect(await headers[2].getText()).toBe("Angelegt von");
    });
});
