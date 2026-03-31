import path from "path";

/**
 * TC-1-2-4 / TC-2-2-4:
 * draftOnly=false の SingleFileUpload に対して、編集モードでファイルをアップロードするとファイル名リンクが表示される
 */
export function runSingleFileUploadNonDraft() {
    describe("1-2. Single File Upload（draftOnly=false）", () => {
        before(async () => {
            // wdi5 サービスが baseUrl への遷移とブリッジ注入を完了済み
            // browser.url() を呼ぶとブリッジが失われるため呼ばない
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (browser as any).waitForUI5();
        });

        it("TC-x-2-4: 編集モードでファイルを選択するとアップロードが成功すること", async () => {
            // List Report の最初の行をクリック
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const firstRow = await browser.asControl({
                selector: { controlType: "sap.m.ColumnListItem" }
            } as any);
            await firstRow.press();

            // Object Page が開くのを待つ（URL に "Quotations(" が含まれる）
            await browser.waitUntil(
                async () => {
                    const url = await browser.getUrl();
                    return url.includes("Quotations(");
                },
                { timeout: 15000, timeoutMsg: "Object Page への遷移がタイムアウトしました" }
            );

            // SingleFileUpload セクション (draftOnly=false) が表示されるまで待つ
            const singleFileUploadSection = await $('[id*="idNonDraftSingleFileUpload"]');
            await singleFileUploadSection.waitForDisplayed({
                timeout: 15000,
                timeoutMsg: "SingleFileUpload セクションが表示されませんでした"
            });

            // file input を取得してファイルをアップロード
            const fileInput = await $('[id*="idNonDraftSingleFileUpload"] input[type="file"]');
            await fileInput.waitForExist({
                timeout: 10000,
                timeoutMsg: "file input が見つかりませんでした"
            });

            const localFilePath = path.join(__dirname, "../../fixtures/upload.txt");
            const remoteFilePath = await browser.uploadFile(localFilePath);
            await fileInput.setValue(remoteFilePath);

            // UI5 FileUploader の change イベントをトリガー
            await browser.execute((el: HTMLInputElement) => {
                el.dispatchEvent(new Event("change", { bubbles: true }));
            }, fileInput as unknown as HTMLInputElement);

            // ファイル名リンクが表示されるのを待つ
            const filenameLink = await $('[id*="idNonDraftSingleFileUpload"] a.sapMLnk');
            await filenameLink.waitForDisplayed({
                timeout: 15000,
                timeoutMsg: "ファイル名リンクが表示されませんでした"
            });

            const linkText = await filenameLink.getText();
            expect(linkText).toBe("upload.txt");
        });
    });
}
