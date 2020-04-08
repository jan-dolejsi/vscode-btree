/* --------------------------------------------------------------------------------------------
 * Copyright (c) Jan Dolejsi 2020. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
'use strict';
import { Uri, workspace, extensions } from 'vscode';
import { validateAndUpdateWorkspace, parser } from '../../extension';


export async function openTreeDocument(treeUri: Uri): Promise<void> {
    const alreadyOpen = workspace.textDocuments.find(d => d.uri.toString() === treeUri.toString());
    if (alreadyOpen) {
        validateAndUpdateWorkspace(parser, alreadyOpen);
    }
    else {
        await workspace.openTextDocument(treeUri);
    }
}

export function throwForUndefined<T>(part: string): T {
    throw new Error(`No ${part} defined.`);
}

export function assertDefined<T>(value: T | undefined, message: string): T {
    if (value === undefined || value === null) {
        throw new Error("Assertion error: " + message);
    }
    else {
        return value;
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
