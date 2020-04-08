/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* --------------------------------------------------------------------------------------------
 * Copyright (c) Jan Dolejsi 2020. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { ExtensionContext, TextDocument, window, ViewColumn, Uri, WebviewPanel, workspace, Disposable } from "vscode";
import * as path from "path";
import { getPreviewTemplate, CONTENT_FOLDER } from "./ContentUtils";

import { BehaviorTree } from 'behavior_tree_service';

interface CommandMessage {
    command: string;
}

export class BehaviorTreePreviewGenerator extends Disposable {

    webviewPanels = new Map<Uri, PreviewPanel>();

    timeout: NodeJS.Timer | undefined;

    constructor(private context: ExtensionContext) {
        super(() => this.dispose());
    }

    setNeedsRebuild(uri: Uri, needsRebuild: boolean): void {
        const panel = this.webviewPanels.get(uri);

        if (panel) {
            panel.setNeedsRebuild(needsRebuild);

            this.resetTimeout();
        }
    }

    resetTimeout(): void {
        if (this.timeout) {
            clearTimeout(this.timeout);
        }
        this.timeout = setTimeout(() => this.rebuild(), 1000);
    }

    dispose(): void {
        if (this.timeout) {
            clearTimeout(this.timeout);
        }
    }

    rebuild(): void {
        this.webviewPanels.forEach(panel => {
            if (panel.getNeedsRebuild() && panel.getPanel().visible) {
                const doc = workspace.textDocuments.find(doc => doc.uri === panel.uri);
                if (doc) {
                    this.updateContent(panel, doc);
                }
            }
        });
    }

    async revealOrCreatePreview(doc: TextDocument, displayColumn: ViewColumn): Promise<void> {
        let previewPanel = this.webviewPanels.get(doc.uri);

        if (previewPanel) {
            previewPanel.reveal(displayColumn);
        }
        else {
            previewPanel = this.createPreviewPanel(doc, displayColumn);
            this.webviewPanels.set(doc.uri, previewPanel);
            // when the user closes the tab, remove the panel
            previewPanel.getPanel().onDidDispose(() => this.webviewPanels.delete(doc.uri), undefined, this.context.subscriptions);
            // when the pane becomes visible again, refresh it
            previewPanel.getPanel().onDidChangeViewState(() => this.rebuild());

            previewPanel.getPanel().webview.onDidReceiveMessage(e => this.handleMessage(previewPanel!, e), undefined, this.context.subscriptions);
        }

        this.updateContent(previewPanel, doc);
    }

    async handleMessage(previewPanel: PreviewPanel, message: CommandMessage): Promise<void> {
        console.log(`Message received from the webview: ${message.command}`);

        switch (message.command) {
            case 'initialized':
                this.updateContent(previewPanel, await workspace.openTextDocument(previewPanel.uri));
                break;
            default:
                console.warn('Unexpected command: ' + message.command);
        }
    }

    createPreviewPanel(doc: TextDocument, displayColumn: ViewColumn): PreviewPanel {
        const previewTitle = `Preview: '${path.basename(window.activeTextEditor?.document.fileName ?? 'no active editor')}'`;

        const webViewPanel = window.createWebviewPanel('behaviortreePreview', previewTitle, displayColumn, {
            enableFindWidget: true,
            enableScripts: true,
            localResourceRoots: [Uri.file(path.join(this.context.extensionPath, CONTENT_FOLDER))]
        });

        webViewPanel.iconPath = Uri.file(this.context.asAbsolutePath(path.join(CONTENT_FOLDER, "icon.svg")));

        return new PreviewPanel(doc.uri, webViewPanel);
    }

    async updateContent(previewPanel: PreviewPanel, doc: TextDocument): Promise<void> {
        if (!previewPanel.getPanel().webview.html) {
            previewPanel.getPanel().webview.html = "Please wait...";
            previewPanel.getPanel().webview.html = await this.getPreviewHtml(previewPanel, doc);
        }
        else {
            previewPanel.setNeedsRebuild(false);
            const tree = BehaviorTree.fromText(doc.getText());
            previewPanel.getPanel().webview.postMessage({'command': 'treeChanged', 'tree': tree});
        }
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    private async getPreviewHtml(previewPanel: PreviewPanel, doc: TextDocument): Promise<string> {
        let templateHtml = await getPreviewTemplate(this.context, "preview.html");

        // change resource URLs to vscode-resource:
        templateHtml = templateHtml.replace(/<script (defer\s+)?src="(.+)">/g, (scriptTag, defer, srcPath) => {
            scriptTag;
            const resource = Uri.file(
                path.join(this.context.extensionPath,
                    CONTENT_FOLDER,
                    srcPath))
                .with({ scheme: "vscode-resource" });
            return `<script ${defer}src="${resource}">`;
        });

        return templateHtml;
    }
}

class PreviewPanel {

    needsRebuild = false;

    constructor(public uri: Uri, private panel: WebviewPanel) { }

    reveal(displayColumn: ViewColumn): void {
        this.panel.reveal(displayColumn);
    }

    setNeedsRebuild(needsRebuild: boolean): void {
        this.needsRebuild = needsRebuild;
    }

    getNeedsRebuild(): boolean {
        return this.needsRebuild;
    }

    getPanel(): WebviewPanel {
        return this.panel;
    }

    postMessage(message: never): Thenable<boolean> {
        return this.panel.webview.postMessage(message);
    }
}