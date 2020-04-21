/* --------------------------------------------------------------------------------------------
 * Copyright (c) Jan Dolejsi 2020. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
'use strict';

import * as path from 'path';
import * as ncp from 'ncp';
import { Uri, workspace, extensions, FileType, TextDocument } from 'vscode';
import { validateAndUpdateWorkspace, parser } from '../../extension';
import { assert } from 'chai';
import { assertDefined } from '../../utils';


export async function openTreeDocument(treeUri: Uri): Promise<TextDocument> {
    const alreadyOpen = workspace.textDocuments.find(d => d.uri.toString() === treeUri.toString());
    if (alreadyOpen) {
        validateAndUpdateWorkspace(assertDefined(parser, "parser"), alreadyOpen);
        return alreadyOpen;
    }
    else {
        return await workspace.openTextDocument(treeUri);
    }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function activateExtension(): Promise<any> {
    const thisExtension = assertDefined(extensions.getExtension("jan-dolejsi.btree"), `Extension 'jan-dolejsi.btree' not found`);
    if (!thisExtension.isActive) {
        return await thisExtension.activate();
    }
}

export async function deleteTempFiles(filesToDelete: Uri[]): Promise<void> {
    await Promise.all(filesToDelete.map(async (fileUri) => {
        try {
            await workspace.fs.stat(fileUri);
            await workspace.fs.delete(fileUri);
            console.debug(`Deleted: ${fileUri}`);
        }
        catch (err) {
            console.error(`File requested for deletion does not exist: ${fileUri} ${err?.message ?? err}`);
        }
    }));
    filesToDelete.length = 0;
}

/**
 * Deletes all files in the workspace folder(s) recursively. 
 */
export async function clearWorkspaceFolder(): Promise<void> {

    if (!workspace.workspaceFolders) {
        console.warn('No workspace folder is open.');
        return;
    }
    else {

        const workspaceFolderDeletions = workspace.workspaceFolders.map(async wf => {
            const workspaceFolderEntries = await workspace.fs.readDirectory(wf.uri);

            const fileDeletions = workspaceFolderEntries
                .filter(entry => entry[0] !== '.gitkeep')
                .map(async entry => {
                    const [fileName, fileType] = entry;
                    console.log(`Deleting ${fileName}`);
                    const fileAbsPath = path.join(wf.uri.fsPath, fileName);
                    const recursive = fileType === FileType.Directory;
                    return await workspace.fs.delete(Uri.file(fileAbsPath), { recursive: recursive, useTrash: false });
                });

            await Promise.all(fileDeletions);
        });

        await Promise.all(workspaceFolderDeletions);
    }
}

export async function copyDirectory(sourceDirectory: string, targetDirectory: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        ncp(sourceDirectory, targetDirectory, error => {
            if (error) {
                reject(error);
            } else {
                resolve();
            }
        });
    });
}

export async function primeWorkspaceFolder(): Promise<void> {

    await clearWorkspaceFolder();

    if (!workspace.workspaceFolders) {
        assert.fail('No workspace folder open');
    }

    // re-populate the test workspace with test data
    const workspaceTemplate = path.join(path.dirname(__dirname), "..", "..", "src", "test", "workspace");
    await copyDirectory(workspaceTemplate, workspace.workspaceFolders[0].uri.fsPath);
}

export async function prepareWorkspaceFolder(template: string, target: string): Promise<string> {

    if (!workspace.workspaceFolders) {
        assert.fail('No workspace folder open');
    }

    // re-populate the test workspace with test data
    const workspaceTemplate = path.join(path.dirname(__dirname), "..", "..", "src", "test", "workspace", template);
    const targetPath = path.join(workspace.workspaceFolders[0].uri.fsPath, target);
    await copyDirectory(workspaceTemplate, targetPath);
    return targetPath;
}