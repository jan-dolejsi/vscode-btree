import * as assert from 'assert';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';
// import * as myExtension from '../extension';

const btree = require('behavior_tree_service');

suite('Extension Test Suite', () => {
	vscode.window.showInformationMessage('Start all tests.');

	test('loads btree dependency', () => {
		const tree = btree.parse('->');
		console.log(JSON.stringify(tree));
	});

	test('Sample test', () => {
		assert.equal([1, 2, 3].indexOf(5), -1);
		assert.equal([1, 2, 3].indexOf(0), -1);
	});
});
