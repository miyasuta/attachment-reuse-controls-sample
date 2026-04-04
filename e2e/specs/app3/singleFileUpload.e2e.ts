import path from "path";

const FIXTURE_FILE = path.join(__dirname, "../../fixtures/upload.txt");
const FIXTURE_NAME = "upload.txt";

const SINGLE = "singleFileUpload";
const MULTI = "multiFileUpload";
const MULTI_ROW = ".sapMListTbl tbody tr.sapMLIB";
const MULTI_EMPTY = 'use[href="#sapIllus-Spot-DragFilesToUpload"]';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function jsClick(el: any): Promise<void> {
    const resolved = await el;
    await browser.execute(
        (e: HTMLElement) => e.scrollIntoView({ block: "center" }),
        resolved as unknown as HTMLElement
    );
    await resolved.click();
}

async function uploadSingleFile(): Promise<void> {
    const fileInput = await $(`[id*="${SINGLE}"] input[type="file"]`);
    await fileInput.waitForExist({ timeout: 5000 });
    const remote = await browser.uploadFile(FIXTURE_FILE);
    await fileInput.setValue(remote);
    await browser.execute((el: HTMLInputElement) => {
        el.dispatchEvent(new Event("change", { bubbles: true }));
    }, fileInput as unknown as HTMLInputElement);
}

async function uploadMultiFile(): Promise<void> {
    const fileInput = await $(`input[type="file"][id*="${MULTI}--uploadPlugin-uploader-fu"]`);
    await fileInput.waitForExist({ timeout: 5000 });
    const remote = await browser.uploadFile(FIXTURE_FILE);
    await fileInput.setValue(remote);
    await browser.execute((el: HTMLInputElement) => {
        el.dispatchEvent(new Event("change", { bubbles: true }));
    }, fileInput as unknown as HTMLInputElement);
}

async function cleanupSingleFile(): Promise<void> {
    // Use `>` (direct child) to target the delete button, not the FileUploader's browse button
    const deleteBtn = $(`[id*="${SINGLE}"] > button.sapMBtn`);
    if (await deleteBtn.isExisting() && await deleteBtn.isDisplayed()) {
        await deleteBtn.click();
        await browser.waitUntil(
            async () => !(await $(`[id*="${SINGLE}"] a.sapMLnk`).isDisplayed()),
            { timeout: 10000, timeoutMsg: `${SINGLE} の削除がタイムアウトしました` }
        );
    }
}

async function cleanupMultiFile(): Promise<void> {
    while (!await $(`[id*="${MULTI}"] ${MULTI_EMPTY}`).isDisplayed()) {
        const deleteBtn = $(`[id*="${MULTI}"] ${MULTI_ROW} button.sapMBtn`);
        if (!(await deleteBtn.isExisting()) || !(await deleteBtn.isEnabled())) break;
        await jsClick(deleteBtn);
        await browser.waitUntil(
            async () => await $(`[id*="${MULTI}"] ${MULTI_EMPTY}`).isDisplayed(),
            { timeout: 10000, interval: 500, timeoutMsg: `${MULTI} の行削除がタイムアウトしました` }
        );
    }
}

async function toggleSwitch(): Promise<void> {
    const sw = await $('[id*="enabledSwitch"]');
    await sw.click();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (browser as any).waitForUI5();
}

describe("App3 (freestyle-nondraft)", () => {
    before(async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (browser as any).waitForUI5();
        // Navigate to the first item's detail page
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const firstItem = await (browser as any).asControl({
            selector: { controlType: "sap.m.StandardListItem" }
        });
        await firstItem.press();
        // Wait for the detail page to load
        await $(`[id*="${SINGLE}"]`).waitForExist({
            timeout: 15000,
            timeoutMsg: "Detail ページへの遷移がタイムアウトしました"
        });
    });

    // =====================================================================
    // 3-1. Single File Upload（enabled=true）
    // =====================================================================
    describe("3-1. Single File Upload（enabled=true）", () => {
        it("TC-3-1-1: 未アップロード状態でリンクと削除ボタンが表示されない", async () => {
            const link = $(`[id*="${SINGLE}"] a.sapMLnk`);
            const deleteBtn = $(`[id*="${SINGLE}"] > button.sapMBtn`);
            expect(await link.isDisplayed()).toBe(false);
            expect(await deleteBtn.isDisplayed()).toBe(false);
        });

        it("TC-3-1-3: FileUploaderが活性化されていること", async () => {
            const fileInput = $(`[id*="${SINGLE}"] input[type="file"]`);
            expect(await fileInput.isEnabled()).toBe(true);
        });

        it("TC-3-1-4+5: ファイルをアップロードするとリンクが表示される", async () => {
            await uploadSingleFile();
            const link = $(`[id*="${SINGLE}"] a.sapMLnk`);
            await link.waitForDisplayed({ timeout: 15000, timeoutMsg: "ファイル名リンクが表示されませんでした" });
            expect(await link.getText()).toBe(FIXTURE_NAME);
        });

        it("TC-3-1-2: ファイルアップロード済みの場合、ファイル名リンクが表示されること", async () => {
            const link = $(`[id*="${SINGLE}"] a.sapMLnk`);
            expect(await link.isDisplayed()).toBe(true);
        });

        it("TC-3-1-6: ファイル名リンクに正しい href が設定されている", async () => {
            const link = $(`[id*="${SINGLE}"] a.sapMLnk`);
            const href = await link.getAttribute("href");
            expect(href).toMatch(/\/file$/);
        });

        it("TC-3-1-7: ファイルアップロード済みの場合、削除ボタンが表示されること", async () => {
            const deleteBtn = $(`[id*="${SINGLE}"] > button.sapMBtn`);
            expect(await deleteBtn.isDisplayed()).toBe(true);
        });

        it("TC-3-1-8+9: 削除ボタンを押すとファイルが削除され、リンクとボタンが消える", async () => {
            const deleteBtn = $(`[id*="${SINGLE}"] > button.sapMBtn`);
            await deleteBtn.click();
            const link = $(`[id*="${SINGLE}"] a.sapMLnk`);
            await browser.waitUntil(
                async () => !(await link.isDisplayed()),
                { timeout: 10000, timeoutMsg: "削除後もリンクが表示されたまま" }
            );
            expect(await deleteBtn.isDisplayed()).toBe(false);
        });
    });

    // =====================================================================
    // 3-2. Multi File Upload（enabled=true）
    // =====================================================================
    describe("3-2. Multi File Upload（enabled=true）", () => {
        it("TC-3-2-1: 未アップロード状態でテーブルに行が表示されない", async () => {
            expect(await $(`[id*="${MULTI}"] ${MULTI_EMPTY}`).isDisplayed()).toBe(true);
        });

        it("TC-3-2-3: Upload ボタンが活性化されていること", async () => {
            const uploadBtn = $(`[id*="${MULTI}--uploadPlugin-uploader-fu_button"]`);
            expect(await uploadBtn.isEnabled()).toBe(true);
        });

        it("TC-3-2-4+5: ファイルをアップロードするとテーブルにファイル名・MIMEタイプが表示される", async () => {
            await uploadMultiFile();
            await browser.waitUntil(
                async () => $(`[id*="${MULTI}"] ${MULTI_ROW}`).isExisting(),
                { timeout: 15000, timeoutMsg: "テーブルに行が追加されませんでした" }
            );
            const link = $(`[id*="${MULTI}"] ${MULTI_ROW} a.sapMLnk`);
            expect(await link.getText()).toBe(FIXTURE_NAME);
            const cells = await $$(`[id*="${MULTI}"] ${MULTI_ROW} td.sapMListTblCell`);
            expect((await cells[1].getText()).length).toBeGreaterThan(0);
        });

        it("TC-3-2-2: ファイルアップロード済みの場合、テーブルにファイルが表示されること", async () => {
            expect(await $(`[id*="${MULTI}"] ${MULTI_ROW}`).isExisting()).toBe(true);
        });

        it("TC-3-2-6: ファイル名リンクに正しい href が設定されている", async () => {
            const link = $(`[id*="${MULTI}"] ${MULTI_ROW} a.sapMLnk`);
            const href = await link.getAttribute("href");
            expect(href).toMatch(/\/content$/);
        });

        it("TC-3-2-7+8: 削除ボタンを押すとテーブルから行が消える", async () => {
            const deleteBtn = $(`[id*="${MULTI}"] ${MULTI_ROW} button.sapMBtn`);
            await jsClick(deleteBtn);
            await browser.waitUntil(
                async () => await $(`[id*="${MULTI}"] ${MULTI_EMPTY}`).isDisplayed(),
                { timeout: 10000, timeoutMsg: "削除後もテーブルが空になりませんでした" }
            );
        });
    });

    // =====================================================================
    // enabled スイッチ切り替えテスト
    // =====================================================================
    describe("enabled スイッチ切り替えテスト", () => {
        before(async () => {
            // ファイルをそれぞれ 1 つアップロードしておく
            await uploadSingleFile();
            await $(`[id*="${SINGLE}"] a.sapMLnk`).waitForDisplayed({
                timeout: 15000,
                timeoutMsg: "Single file upload timed out"
            });
            await uploadMultiFile();
            await browser.waitUntil(
                async () => $(`[id*="${MULTI}"] ${MULTI_ROW}`).isExisting(),
                { timeout: 15000, timeoutMsg: "Multi file upload timed out" }
            );
            // Switch を OFF にする
            await toggleSwitch();
            // FileUploader が非活性になるまで待つ
            await browser.waitUntil(
                async () => !(await $(`[id*="${SINGLE}"] input[type="file"]`).isEnabled()),
                { timeout: 5000, timeoutMsg: "enabled switch did not disable upload" }
            );
        });

        it("TC-3-1-10: FileUploaderが非活性になること", async () => {
            const fileInput = $(`[id*="${SINGLE}"] input[type="file"]`);
            expect(await fileInput.isEnabled()).toBe(false);
        });

        it("TC-3-1-11: ファイルアップロード済みの場合、削除ボタンが非活性になること", async () => {
            const deleteBtn = $(`[id*="${SINGLE}"] > button.sapMBtn`);
            expect(await deleteBtn.isDisplayed()).toBe(true);
            expect(await deleteBtn.isEnabled()).toBe(false);
        });

        it("TC-3-2-9: Upload ボタンが非活性になること", async () => {
            const uploadBtn = $(`[id*="${MULTI}--uploadPlugin-uploader-fu_button"]`);
            expect(await uploadBtn.isEnabled()).toBe(false);
        });

        it("TC-3-2-10: 各行の削除ボタンが非活性になること", async () => {
            const deleteBtn = $(`[id*="${MULTI}"] ${MULTI_ROW} button.sapMBtn`);
            expect(await deleteBtn.isEnabled()).toBe(false);
        });

        // ------------------------------------------------------------------
        // enabled=true への復帰確認
        // ------------------------------------------------------------------
        describe("enabled=true に戻した後", () => {
            before(async () => {
                await toggleSwitch();
                // FileUploader が活性化されるまで待つ
                await browser.waitUntil(
                    async () => await $(`[id*="${SINGLE}"] input[type="file"]`).isEnabled(),
                    { timeout: 5000, timeoutMsg: "enabled switch did not re-enable upload" }
                );
            });

            it("TC-3-1-12: FileUploaderが再び活性化されること", async () => {
                const fileInput = $(`[id*="${SINGLE}"] input[type="file"]`);
                expect(await fileInput.isEnabled()).toBe(true);
            });

            it("TC-3-1-13: 削除ボタンが再び活性化されること", async () => {
                const deleteBtn = $(`[id*="${SINGLE}"] > button.sapMBtn`);
                expect(await deleteBtn.isEnabled()).toBe(true);
            });

            it("TC-3-2-11: Upload ボタンが再び活性化されること", async () => {
                const uploadBtn = $(`[id*="${MULTI}--uploadPlugin-uploader-fu_button"]`);
                expect(await uploadBtn.isEnabled()).toBe(true);
            });

            it("TC-3-2-12: 各行の削除ボタンが再び活性化されること", async () => {
                const deleteBtn = $(`[id*="${MULTI}"] ${MULTI_ROW} button.sapMBtn`);
                expect(await deleteBtn.isEnabled()).toBe(true);
            });

            after(async () => {
                await cleanupSingleFile();
                await cleanupMultiFile();
            });
        });
    });
});
