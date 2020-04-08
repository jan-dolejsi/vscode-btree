/* --------------------------------------------------------------------------------------------
 * Copyright (c) Jan Dolejsi 2020. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { ExtensionContext } from "vscode";
import * as path from "path";
import * as fs from "fs";

export const CONTENT_FOLDER = path.join("webview", "out");

export async function getPreviewTemplate(context: ExtensionContext, templateName: string): Promise<string> {
    const previewPath = context.asAbsolutePath(path.join(CONTENT_FOLDER, templateName));

    return new Promise<string>((resolve, reject) => {
        fs.readFile(previewPath, "utf8", function (err, data) {
            if (err) {
                reject(err);
            }
            else {
                resolve(data);
            }
        });
    });
}