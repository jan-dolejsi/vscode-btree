import * as assert from 'assert';

import * as vscode from 'vscode';

import { parse } from 'behavior_tree_service';

suite('Extension Test Suite', () => {
	vscode.window.showInformationMessage('Start all tests.');

	test('loads btree dependency', () => {
		const tree = parse('->');
		console.log(JSON.stringify(tree));
	});

	test('Sample test', () => {
		assert.equal([1, 2, 3].indexOf(5), -1);
		assert.equal([1, 2, 3].indexOf(0), -1);
	});
});
