/* --------------------------------------------------------------------------------------------
 * Copyright (c) Jan Dolejsi 2020. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

'use strict';

import * as path from 'path';
import { Uri, EventEmitter, Event, Disposable } from 'vscode';
import { TreeWorkspace, WorkspaceTreeEvent, WorkspaceEvent } from './TreeWorkspace';
import { BehaviorTree } from 'behavior_tree_service';
import { TreeParser } from './TreeParser';

export class TreeWorkspaceRegistry implements Disposable {
    private workspaces = new Map<string, TreeWorkspace>();
    private _onChanged = new EventEmitter<WorkspaceTreeEvent>();
    private _onWorkspaceInitialized = new EventEmitter<WorkspaceEvent>();

    constructor(private parser: TreeParser) {

    }

    public get onWorkspaceInitialized(): Event<WorkspaceEvent> {
        return this._onWorkspaceInitialized.event;
    }

    public get onChanged(): Event<WorkspaceTreeEvent> {
        return this._onChanged.event;
    }

    /**
     * Folder path
     * @param folderPath path of the folder
     */
    getWorkspace(folderPath: string): TreeWorkspace | undefined {
        return this.workspaces.get(folderPath);
    }

    updateWorkspace(uri: Uri, tree: BehaviorTree): void {
        const folder = path.dirname(uri.fsPath);
        if (!this.workspaces.has(folder)) {
            const newTreeWorkspace = new TreeWorkspace(folder, this.parser);
            newTreeWorkspace.onChanged(e => this._onChanged.fire(e));
            newTreeWorkspace.onInitialized(e => this._onWorkspaceInitialized.fire(e));
            this.workspaces.set(folder, newTreeWorkspace);
        }

        const workspace = this.workspaces.get(folder);
        if (workspace) {
            workspace.upsert(uri, tree);
        }
    }

    /**
     * Awaits a `T` event.
     * @param event event emitter to subscribe to 
     * @param param1 action to execute after subscribing to the event and filter to apply to events
     */
    private async waitFor<T>(event: EventEmitter<T>, { action, filter }: { action?: () => void; filter?: (event: T) => boolean; } = {}): Promise<T> {
        return new Promise<T>(resolve => {
            const subscription = event.event(e => {
                if ((filter && filter(e)) ?? true) {
                    resolve(e);
                    subscription.dispose();
                }
            });

            action && action();
        });
    }

    /**
     * Awaits a `WorkspaceTreeEvent` change.
     * @param param0 action to execute after subscribing to the event and filter to apply to events
     */
    async change({ action, filter }: { action?: () => void; filter?: (event: WorkspaceTreeEvent) => boolean; } = {}): Promise<WorkspaceTreeEvent> {
        return this.waitFor(this._onChanged, { action, filter });
    }

    /**
     * Awaits a `WorkspaceEvent` initialization change.
     * @param param0 action to execute after subscribing to the event and filter to apply to events
     */
    async initialization({ action, filter }: { action?: () => void; filter?: (event: WorkspaceEvent) => boolean; } = {}): Promise<WorkspaceEvent> {
        return this.waitFor(this._onWorkspaceInitialized, { action, filter });
    }

    clear() {
        this.workspaces.forEach(workspace => workspace.dispose());
        this.workspaces.clear();
    }

    dispose(): void {
        this._onChanged.dispose();
        this._onWorkspaceInitialized.dispose();
    }
}