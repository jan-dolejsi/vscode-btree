/* --------------------------------------------------------------------------------------------
 * Copyright (c) Jan Dolejsi 2020. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
'use strict';
import { Uri, workspace } from 'vscode';
import { validateAndUpdateWorkspace, parser } from '../../extension';


export function openTreeDocument(treeUri: Uri): void {
	const alreadyOpen = workspace.textDocuments.find(d => d.uri.toString() === treeUri.toString());
	if (alreadyOpen) {
		validateAndUpdateWorkspace(parser, alreadyOpen);
	}
	else {
		workspace.openTextDocument(treeUri);
	}
}