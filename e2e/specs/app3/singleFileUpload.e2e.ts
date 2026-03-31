import path from "path";

describe("App3 (freestyle-nondraft) - Single File Upload", () => {
    before(async () => {
        // wdi5 サービスが baseUrl への遷移とブリッジ注入を完了済み
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (browser as any).waitForUI5();
    });

    it("TC-3-1-4: enabled=true のときファイルを選択するとアップロードが成功すること", async () => {
        // 一覧の最初のアイテムをクリック（sap.m.StandardListItem）
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const firstItem = await browser.asControl({
            selector: { controlType: "sap.m.StandardListItem" }
        } as any);
        await firstItem.press();

        // Detail ページが開くのを待つ（singleFileUpload の file input が現れるまで）
        const fileInput = await $('[id*="singleFileUpload"] input[type="file"]');
        await fileInput.waitForExist({
            timeout: 15000,
            timeoutMsg: "Detail ページへの遷移がタイムアウトしました"
        });

        // ファイルをアップロード
        const localFilePath = path.join(__dirname, "../../fixtures/upload.txt");
        const remoteFilePath = await browser.uploadFile(localFilePath);
        await fileInput.setValue(remoteFilePath);

        // UI5 FileUploader の change イベントをトリガー
        await browser.execute((el: HTMLInputElement) => {
            el.dispatchEvent(new Event("change", { bubbles: true }));
        }, fileInput as unknown as HTMLInputElement);

        // ファイル名リンクが表示されるのを待つ
        const filenameLink = await $('[id*="singleFileUpload"] a.sapMLnk');
        await filenameLink.waitForDisplayed({
            timeout: 15000,
            timeoutMsg: "ファイル名リンクが表示されませんでした"
        });

        const linkText = await filenameLink.getText();
        expect(linkText).toBe("upload.txt");
    });
});
