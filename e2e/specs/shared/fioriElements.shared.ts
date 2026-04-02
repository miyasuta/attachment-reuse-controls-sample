import path from "path";

const FIXTURE_FILE = path.join(__dirname, "../../fixtures/upload.txt");
const FIXTURE_NAME = "upload.txt";

// ---------- helpers ----------

async function navigateToObjectPage(): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const firstRow = await (browser as any).asControl({
        selector: { controlType: "sap.m.ColumnListItem" }
    });
    await firstRow.press();
    await browser.waitUntil(
        async () => (await browser.getUrl()).includes("IsActiveEntity=true"),
        { timeout: 15000, timeoutMsg: "Object Page への遷移がタイムアウトしました" }
    );
    // URL の変化だけでは Object Page の UI がまだ構築中の場合がある。
    // waitForUI5() で全 UI5 非同期処理の完了を待ってから Edit ボタンを探す。
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (browser as any).waitForUI5();
}

async function clickEdit(): Promise<void> {
    // ロケール非依存: Fiori Elements の Edit ボタンは ID に "StandardAction::Edit" を含む
    // button タグに絞ることで内部 span 要素との混同を防ぐ
    const editBtn = $('button[id*="StandardAction::Edit"]');
    await editBtn.waitForClickable({ timeout: 10000, timeoutMsg: "Edit ボタンが見つかりません" });
    await editBtn.click();
    await browser.waitUntil(
        async () => (await browser.getUrl()).includes("IsActiveEntity=false"),
        { timeout: 10000, timeoutMsg: "編集モードへの遷移がタイムアウトしました" }
    );
}

async function clickSave(): Promise<void> {
    // ロケール非依存: Fiori Elements の Save ボタンは ID に "StandardAction::Save" を含む
    // button タグに絞ることで内部 span 要素との混同を防ぐ
    const saveBtn = $('button[id*="StandardAction::Save"]');
    await saveBtn.waitForClickable({ timeout: 10000, timeoutMsg: "Save ボタンが見つかりません" });
    await saveBtn.click();
    await browser.waitUntil(
        async () => (await browser.getUrl()).includes("IsActiveEntity=true"),
        { timeout: 10000, timeoutMsg: "Save がタイムアウトしました" }
    );
}

async function uploadSingleFile(controlIdPart: string): Promise<void> {
    const fileInput = await $(`[id*="${controlIdPart}"] input[type="file"]`);
    await fileInput.waitForExist({ timeout: 5000 });
    const remoteFilePath = await browser.uploadFile(FIXTURE_FILE);
    await fileInput.setValue(remoteFilePath);
    await browser.execute((el: HTMLInputElement) => {
        el.dispatchEvent(new Event("change", { bubbles: true }));
    }, fileInput as unknown as HTMLInputElement);
}

async function uploadMultiFile(controlIdPart: string): Promise<void> {
    // UploadSetwithTable の file input にセット
    // 実際の DOM: id="...--{controlIdPart}--uploadPlugin-uploader-fu" (type="file")
    const fileInput = await $(`input[type="file"][id*="${controlIdPart}--uploadPlugin-uploader-fu"]`);
    await fileInput.waitForExist({ timeout: 5000 });
    const remoteFilePath = await browser.uploadFile(FIXTURE_FILE);
    await fileInput.setValue(remoteFilePath);
    await browser.execute((el: HTMLInputElement) => {
        el.dispatchEvent(new Event("change", { bubbles: true }));
    }, fileInput as unknown as HTMLInputElement);
}

async function cleanupSingleFileUpload(controlIdPart: string): Promise<void> {
    const deleteBtn = await $(`[id*="${controlIdPart}"] button.sapMBtn`);
    if (await deleteBtn.isExisting() && await deleteBtn.isDisplayed()) {
        await deleteBtn.click();
        await browser.waitUntil(
            async () => !(await $(`[id*="${controlIdPart}"] a.sapMLnk`).isDisplayed()),
            { timeout: 10000, timeoutMsg: `${controlIdPart} の削除がタイムアウトしました` }
        );
    }
}

// Row selector for MultiFileUpload table
// sapMLIB: sap.m.ListItemBase の基底クラス (ColumnListItem が該当)
const MULTI_ROW = ".sapMListTbl tbody tr.sapMLIB";

// Empty state illustration shown when the table has no data
const MULTI_EMPTY = 'use[href="#sapIllus-Spot-DragFilesToUpload"]';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function jsClick(el: any): Promise<void> {
    // フッターバーがテーブル下部に重なる場合に備えて、要素をビューポート中央にスクロールしてからクリックする。
    // browser.execute(e => e.click()) は UI5 の press イベントを発火させないケースがあるため使わない。
    const resolved = await el;
    await browser.execute((e: HTMLElement) => e.scrollIntoView({ block: "center" }), resolved as unknown as HTMLElement);
    await resolved.click();
}

async function ensureDisplayMode(): Promise<void> {
    // draftOnly=false の自動ドラフトライフサイクル後にページが edit mode に遷移している場合に Save する
    const url = await browser.getUrl();
    if (url.includes("IsActiveEntity=false")) {
        await clickSave();
    }
}

async function cleanupMultiFileUpload(controlIdPart: string): Promise<void> {
    // 空状態イラストが表示されるまで削除を繰り返す
    while (!await $(`[id*="${controlIdPart}"] ${MULTI_EMPTY}`).isDisplayed()) {
        const deleteBtn = $(`[id*="${controlIdPart}"] ${MULTI_ROW} button.sapMBtn`);
        if (!(await deleteBtn.isExisting()) || !(await deleteBtn.isEnabled())) break;
        await jsClick(deleteBtn);
        // 空状態イラストが現れるまで待つ（1行ずつ削除してループ）
        await browser.waitUntil(
            async () => await $(`[id*="${controlIdPart}"] ${MULTI_EMPTY}`).isDisplayed(),
            { timeout: 10000, timeoutMsg: `${controlIdPart} の行削除がタイムアウトしました`, interval: 500 }
        );
    }
}

// ---------- exported test suite ----------

export function runFioriElementsTests(appNum: string = "1"): void {
    describe(`App${appNum} — Fiori Elements — Object Page`, () => {
        before(async () => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (browser as any).waitForUI5();
            await navigateToObjectPage();
            // 前回テスト中断等でエンティティにファイルが残っている場合に備えてクリーンアップ
            await clickEdit();
            await cleanupSingleFileUpload("idDraftOnlySingleFileUpload");
            await cleanupSingleFileUpload("idNonDraftSingleFileUpload");
            await cleanupMultiFileUpload("idDraftOnlyMultiFileUpload");
            await cleanupMultiFileUpload("idNonDraftMultiFileUpload");
            await clickSave();
        });

        // =====================================================================
        // x-2. Single File Upload（draftOnly=false）
        // =====================================================================
        describe(`${appNum}-2. Single File Upload（draftOnly=false）`, () => {
            // 前提: before フック直後の照会モード、ファイルなし（編集ボタンを押さない状態）

            it(`TC-${appNum}-2-1: 未アップロード状態で照会モードを開いた時、リンクと削除ボタンが表示されない`, async () => {
                const link = await $('[id*="idNonDraftSingleFileUpload"] a.sapMLnk');
                expect(await link.isDisplayed()).toBe(false);
                const deleteBtn = await $('[id*="idNonDraftSingleFileUpload"] button.sapMBtn');
                expect(await deleteBtn.isDisplayed()).toBe(false);
            });

            it(`TC-${appNum}-2-10: 照会モードで FileUploader が活性化（draftOnly=false のため有効）`, async () => {
                const fileInput = await $('[id*="idNonDraftSingleFileUpload"] input[type="file"]');
                expect(await fileInput.isEnabled()).toBe(true);
            });

            it(`TC-${appNum}-2-11+12: 照会モードでアップロードするとリンクが表示される`, async () => {
                await uploadSingleFile("idNonDraftSingleFileUpload");
                const link = await $('[id*="idNonDraftSingleFileUpload"] a.sapMLnk');
                await link.waitForDisplayed({ timeout: 15000, timeoutMsg: "ファイル名リンクが表示されませんでした" });
                expect(await link.getText()).toBe(FIXTURE_NAME);
            });

            it(`TC-${appNum}-2-2: ファイルアップロード済み状態で照会モードを開いた時、リンクが表示される`, async () => {
                // TC-x-2-11+12 の後、照会モードにリンクが表示されていることを確認
                const link = await $('[id*="idNonDraftSingleFileUpload"] a.sapMLnk');
                expect(await link.isDisplayed()).toBe(true);
            });

            it(`TC-${appNum}-2-13: 照会モードのリンクに content への href が設定されている`, async () => {
                const link = await $('[id*="idNonDraftSingleFileUpload"] a.sapMLnk');
                const href = await link.getAttribute("href");
                expect(href).toMatch(/\/file$/);
            });

            it(`TC-${appNum}-2-14: 照会モードで削除ボタンが活性化されている`, async () => {
                const deleteBtn = await $('[id*="idNonDraftSingleFileUpload"] button.sapMBtn');
                expect(await deleteBtn.isDisplayed()).toBe(true);
                expect(await deleteBtn.isEnabled()).toBe(true);
            });

            it(`TC-${appNum}-2-15+16: 照会モードで削除するとリンクと削除ボタンが消える`, async () => {
                const deleteBtn = await $('[id*="idNonDraftSingleFileUpload"] button.sapMBtn');
                await deleteBtn.click();
                const link = await $('[id*="idNonDraftSingleFileUpload"] a.sapMLnk');
                await browser.waitUntil(
                    async () => !(await link.isDisplayed()),
                    { timeout: 10000, timeoutMsg: "削除後もリンクが表示されたまま" }
                );
                expect(await deleteBtn.isDisplayed()).toBe(false);
            });

            it(`TC-${appNum}-2-3: 編集モードで FileUploader が活性化`, async () => {
                await clickEdit();
                const fileInput = await $('[id*="idNonDraftSingleFileUpload"] input[type="file"]');
                expect(await fileInput.isEnabled()).toBe(true);
            });

            it(`TC-${appNum}-2-4+5: 編集モードでアップロードするとリンクが表示される`, async () => {
                await uploadSingleFile("idNonDraftSingleFileUpload");
                const link = await $('[id*="idNonDraftSingleFileUpload"] a.sapMLnk');
                await link.waitForDisplayed({ timeout: 15000, timeoutMsg: "ファイル名リンクが表示されませんでした" });
                expect(await link.getText()).toBe(FIXTURE_NAME);
            });

            it(`TC-${appNum}-2-7: 編集モードで削除ボタンが表示される`, async () => {
                const deleteBtn = await $('[id*="idNonDraftSingleFileUpload"] button.sapMBtn');
                expect(await deleteBtn.isDisplayed()).toBe(true);
            });

            it(`TC-${appNum}-2-6: 編集モードのリンクに content への href が設定されている`, async () => {
                const link = await $('[id*="idNonDraftSingleFileUpload"] a.sapMLnk');
                const href = await link.getAttribute("href");
                expect(href).toMatch(/\/file$/);
            });

            it(`TC-${appNum}-2-8+9: 編集モードで削除するとリンクと削除ボタンが消える`, async () => {
                const deleteBtn = await $('[id*="idNonDraftSingleFileUpload"] button.sapMBtn');
                await deleteBtn.click();
                const link = await $('[id*="idNonDraftSingleFileUpload"] a.sapMLnk');
                await browser.waitUntil(
                    async () => !(await link.isDisplayed()),
                    { timeout: 10000, timeoutMsg: "削除後もリンクが表示されたまま" }
                );
                expect(await deleteBtn.isDisplayed()).toBe(false);
            });

            after(async () => {
                await clickSave();
            });
        });

        // =====================================================================
        // x-4. Multi File Upload（draftOnly=false）
        // =====================================================================
        describe(`${appNum}-4. Multi File Upload（draftOnly=false）`, () => {
            // 前提: 照会モード、添付ファイルなし（編集ボタンを押さない状態）

            it(`TC-${appNum}-4-1: 未アップロード状態でテーブルに行が表示されない`, async () => {
                expect(await $(`[id*="idNonDraftMultiFileUpload"] ${MULTI_EMPTY}`).isDisplayed()).toBe(true);
            });

            it(`TC-${appNum}-4-9: 照会モードで Upload ボタンが活性化（draftOnly=false のため有効）`, async () => {
                const uploadBtn = $('[id*="idNonDraftMultiFileUpload--uploadPlugin-uploader-fu_button"]');
                expect(await uploadBtn.isEnabled()).toBe(true);
            });

            it(`TC-${appNum}-4-10+11: 照会モードでアップロード後テーブルにファイル名・日時・作成者が表示される`, async () => {
                await uploadMultiFile("idNonDraftMultiFileUpload");
                await browser.waitUntil(
                    async () => $(`[id*="idNonDraftMultiFileUpload"] ${MULTI_ROW}`).isExisting(),
                    { timeout: 15000, timeoutMsg: "テーブルに行が追加されませんでした" }
                );
                // draftOnly=false の自動ドラフトライフサイクルで edit mode になった場合に戻す
                await ensureDisplayMode();
                const link = await $(`[id*="idNonDraftMultiFileUpload"] ${MULTI_ROW} a.sapMLnk`);
                expect(await link.getText()).toBe(FIXTURE_NAME);
                const cells = await $$(`[id*="idNonDraftMultiFileUpload"] ${MULTI_ROW} td.sapMListTblCell`);
                expect((await cells[1].getText()).length).toBeGreaterThan(0);
                expect((await cells[2].getText()).length).toBeGreaterThan(0);
            });

            it(`TC-${appNum}-4-2: ファイルアップロード済み状態で照会モードにテーブルが表示される`, async () => {
                expect(await $(`[id*="idNonDraftMultiFileUpload"] ${MULTI_ROW}`).isExisting()).toBe(true);
            });

            it(`TC-${appNum}-4-12: 照会モードのリンクに content への href が設定されている`, async () => {
                const link = await $(`[id*="idNonDraftMultiFileUpload"] ${MULTI_ROW} a.sapMLnk`);
                const href = await link.getAttribute("href");
                expect(href).toMatch(/\/content$/);
            });

            it(`TC-${appNum}-4-13: 照会モードで削除ボタンが活性化されている`, async () => {
                const deleteBtn = await $(`[id*="idNonDraftMultiFileUpload"] ${MULTI_ROW} button.sapMBtn`);
                expect(await deleteBtn.isEnabled()).toBe(true);
            });

            it(`TC-${appNum}-4-14+15: 照会モードで削除するとテーブルから行が消える`, async () => {
                const deleteBtn = $(`[id*="idNonDraftMultiFileUpload"] ${MULTI_ROW} button.sapMBtn`);
                await jsClick(deleteBtn);
                await browser.waitUntil(
                    async () => await $(`[id*="idNonDraftMultiFileUpload"] ${MULTI_EMPTY}`).isDisplayed(),
                    { timeout: 10000, timeoutMsg: "削除後もテーブルが空になりませんでした" }
                );
            });

            it(`TC-${appNum}-4-3: 編集モードで Upload ボタンが活性化`, async () => {
                await clickEdit();
                const uploadBtn = $('[id*="idNonDraftMultiFileUpload--uploadPlugin-uploader-fu_button"]');
                expect(await uploadBtn.isEnabled()).toBe(true);
            });

            it(`TC-${appNum}-4-4+5: 編集モードでアップロード後テーブルにファイル名・日時・作成者が表示される`, async () => {
                await uploadMultiFile("idNonDraftMultiFileUpload");
                await browser.waitUntil(
                    async () => $(`[id*="idNonDraftMultiFileUpload"] ${MULTI_ROW}`).isExisting(),
                    { timeout: 15000 }
                );
                const link = await $(`[id*="idNonDraftMultiFileUpload"] ${MULTI_ROW} a.sapMLnk`);
                expect(await link.getText()).toBe(FIXTURE_NAME);
            });

            it(`TC-${appNum}-4-6: 編集モードのリンクに content への href が設定されている`, async () => {
                const link = await $(`[id*="idNonDraftMultiFileUpload"] ${MULTI_ROW} a.sapMLnk`);
                const href = await link.getAttribute("href");
                expect(href).toMatch(/\/content$/);
            });

            it(`TC-${appNum}-4-7+8: 編集モードで削除するとテーブルから行が消える`, async () => {
                const deleteBtn = $(`[id*="idNonDraftMultiFileUpload"] ${MULTI_ROW} button.sapMBtn`);
                await jsClick(deleteBtn);
                await browser.waitUntil(
                    async () => await $(`[id*="idNonDraftMultiFileUpload"] ${MULTI_EMPTY}`).isDisplayed(),
                    { timeout: 10000, timeoutMsg: "削除後もテーブルが空になりませんでした" }
                );
            });

            after(async () => {
                await clickSave();
            });
        });

        // =====================================================================
        // x-1. Single File Upload（draftOnly=true）
        // =====================================================================
        describe(`${appNum}-1. Single File Upload（draftOnly=true）`, () => {
            // 前提: 照会モード (IsActiveEntity=true)、ファイルなし

            it(`TC-${appNum}-1-1: 未アップロード状態で照会モードを開いた時、リンクと削除ボタンが表示されない`, async () => {
                const link = await $('[id*="idDraftOnlySingleFileUpload"] a.sapMLnk');
                expect(await link.isDisplayed()).toBe(false);
                const deleteBtn = await $('[id*="idDraftOnlySingleFileUpload"] button.sapMBtn');
                expect(await deleteBtn.isDisplayed()).toBe(false);
            });

            it(`TC-${appNum}-1-10: 照会モードで FileUploader が非活性`, async () => {
                const fileInput = await $('[id*="idDraftOnlySingleFileUpload"] input[type="file"]');
                expect(await fileInput.isEnabled()).toBe(false);
            });

            it(`TC-${appNum}-1-3: Edit ボタンを押すと編集モードへ遷移し FileUploader が活性化される`, async () => {
                await clickEdit();
                const fileInput = await $('[id*="idDraftOnlySingleFileUpload"] input[type="file"]');
                expect(await fileInput.isEnabled()).toBe(true);
            });

            it(`TC-${appNum}-1-4+5: 編集モードでファイルをアップロードするとリンクが表示される`, async () => {
                await uploadSingleFile("idDraftOnlySingleFileUpload");
                const link = await $('[id*="idDraftOnlySingleFileUpload"] a.sapMLnk');
                await link.waitForDisplayed({ timeout: 15000, timeoutMsg: "ファイル名リンクが表示されませんでした" });
                expect(await link.getText()).toBe(FIXTURE_NAME);
            });

            it(`TC-${appNum}-1-7: アップロード後に削除ボタンが表示される`, async () => {
                const deleteBtn = await $('[id*="idDraftOnlySingleFileUpload"] button.sapMBtn');
                expect(await deleteBtn.isDisplayed()).toBe(true);
            });

            it(`TC-${appNum}-1-6: ファイル名リンクに content への href が設定されている`, async () => {
                const link = await $('[id*="idDraftOnlySingleFileUpload"] a.sapMLnk');
                const href = await link.getAttribute("href");
                expect(href).toMatch(/\/file$/);
            });

            it(`TC-${appNum}-1-2+Save: 保存後の照会モードでもリンクが表示される`, async () => {
                await clickSave();
                const link = await $('[id*="idDraftOnlySingleFileUpload"] a.sapMLnk');
                expect(await link.isDisplayed()).toBe(true);
            });

            it(`TC-${appNum}-1-8+9: 編集モードで削除すると、リンクと削除ボタンが消える`, async () => {
                await clickEdit();
                const deleteBtn = await $('[id*="idDraftOnlySingleFileUpload"] button.sapMBtn');
                await deleteBtn.click();
                const link = await $('[id*="idDraftOnlySingleFileUpload"] a.sapMLnk');
                await browser.waitUntil(
                    async () => !(await link.isDisplayed()),
                    { timeout: 10000, timeoutMsg: "削除後もリンクが表示されたまま" }
                );
                expect(await deleteBtn.isDisplayed()).toBe(false);
            });

            after(async () => {
                // 後片付け: Save して照会モード・ファイルなし状態に戻す
                await clickSave();
            });
        });

        // =====================================================================
        // x-3. Multi File Upload（draftOnly=true）
        // =====================================================================
        describe(`${appNum}-3. Multi File Upload（draftOnly=true）`, () => {
            // 前提: 照会モード、添付ファイルなし

            it(`TC-${appNum}-3-1: 未アップロード状態でテーブルに行が表示されない`, async () => {
                expect(await $(`[id*="idDraftOnlyMultiFileUpload"] ${MULTI_EMPTY}`).isDisplayed()).toBe(true);
            });

            it(`TC-${appNum}-3-9: 照会モードで Upload ボタンが非活性`, async () => {
                const uploadBtn = $('[id*="idDraftOnlyMultiFileUpload--uploadPlugin-uploader-fu_button"]');
                expect(await uploadBtn.isEnabled()).toBe(false);
            });

            it(`TC-${appNum}-3-3: 編集モードで Upload ボタンが活性化`, async () => {
                await clickEdit();
                const uploadBtn = $('[id*="idDraftOnlyMultiFileUpload--uploadPlugin-uploader-fu_button"]');
                expect(await uploadBtn.isEnabled()).toBe(true);
            });

            it(`TC-${appNum}-3-4+5: アップロード後テーブルにファイル名・日時・作成者が表示される`, async () => {
                await uploadMultiFile("idDraftOnlyMultiFileUpload");
                await browser.waitUntil(
                    async () => $(`[id*="idDraftOnlyMultiFileUpload"] ${MULTI_ROW}`).isExisting(),
                    { timeout: 15000, timeoutMsg: "テーブルに行が追加されませんでした" }
                );
                const link = await $(`[id*="idDraftOnlyMultiFileUpload"] ${MULTI_ROW} a.sapMLnk`);
                expect(await link.getText()).toBe(FIXTURE_NAME);
                // createdAt, createdBy は空でないことを確認
                const cells = await $$(`[id*="idDraftOnlyMultiFileUpload"] ${MULTI_ROW} td.sapMListTblCell`);
                expect((await cells[1].getText()).length).toBeGreaterThan(0);
                expect((await cells[2].getText()).length).toBeGreaterThan(0);
            });

            it(`TC-${appNum}-3-6: ファイル名リンクに content への href が設定されている`, async () => {
                const link = await $(`[id*="idDraftOnlyMultiFileUpload"] ${MULTI_ROW} a.sapMLnk`);
                const href = await link.getAttribute("href");
                expect(href).toMatch(/\/content$/);
            });

            it(`TC-${appNum}-3-2+Save: 保存後の照会モードでテーブルに行が表示される`, async () => {
                await clickSave();
                expect(await $(`[id*="idDraftOnlyMultiFileUpload"] ${MULTI_ROW}`).isExisting()).toBe(true);
            });

            it(`TC-${appNum}-3-10: 照会モードで削除ボタンが非活性`, async () => {
                // Save直後はバインディングコンテキスト更新が遅れる場合があるため、非活性になるまで待つ
                const deleteBtn = $(`[id*="idDraftOnlyMultiFileUpload"] ${MULTI_ROW} button.sapMBtn`);
                await deleteBtn.waitForEnabled({ reverse: true, timeout: 5000, timeoutMsg: "削除ボタンが非活性になりませんでした" });
            });

            it(`TC-${appNum}-3-7+8: 編集モードで削除するとテーブルから行が消える`, async () => {
                await clickEdit();
                const deleteBtn = $(`[id*="idDraftOnlyMultiFileUpload"] ${MULTI_ROW} button.sapMBtn`);
                // clickEdit 直後はバインディングコンテキストの更新が遅れる場合があるため、ボタンが有効になるまで待つ
                await deleteBtn.waitForEnabled({ timeout: 10000, timeoutMsg: "削除ボタンが有効になりませんでした" });
                await jsClick(deleteBtn);
                await browser.waitUntil(
                    async () => await $(`[id*="idDraftOnlyMultiFileUpload"] ${MULTI_EMPTY}`).isDisplayed(),
                    { timeout: 10000, timeoutMsg: "削除後もテーブルが空になりませんでした" }
                );
            });

            after(async () => {
                await clickSave();
            });
        });
    });
}
