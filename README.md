# VS Code Behavior Tree editor

[![Downloads](https://vsmarketplacebadge.apphb.com/downloads/jan-dolejsi.btree.svg?subject=Downloads)](https://marketplace.visualstudio.com/items?itemName=jan-dolejsi.btree)
[![Installs](https://vsmarketplacebadge.apphb.com/installs/jan-dolejsi.btree.svg?subject=Installations)](https://marketplace.visualstudio.com/items?itemName=jan-dolejsi.btree)
[![Ratings](https://vsmarketplacebadge.apphb.com/rating-star/jan-dolejsi.btree.svg?subject=Reviews)](https://marketplace.visualstudio.com/items?itemName=jan-dolejsi.btree&ssr=false#review-details)
[![CI/CD](https://img.shields.io/github/workflow/status/jan-dolejsi/vscode-btree/Build/master.svg?logo=github)](https://github.com/jan-dolejsi/vscode-btree/actions?query=workflow%3ABuild)
[![Visual Studio Marketplace](https://vsmarketplacebadge.apphb.com/version/jan-dolejsi.btree.svg)](https://marketplace.visualstudio.com/items?itemName=jan-dolejsi.btree)

Behavior trees are a technique used in video games and robotics to model behavior AI. Their use has become increasingly popular due to their simple implementation, ease of understanding, and flexibility.\
This extension provides visualization of trees authored in the language suggested by [Dan Abad's behavior_tree project](https://github.com/0xabad/behavior_tree/).

Specifying behavior trees in a declarative concise way gives you these benefits:

- the model is very readable; a subject matter expert can review it for correctness
- the implementation of action logic is separate (see [SoC](https://en.wikipedia.org/wiki/Separation_of_concerns))
  - the logic is testable
  - implementation may evolve separately
  - new version of the tree may be deployed without pushing any code changes (which are inherently more difficult to validate and verify)

## Features

### Behavior Tree Visualization and Testing

Open a `*.tree` that adheres to the [syntax](https://github.com/0xabad/behavior_tree/#syntax).\
Right-click on the editor text and select Preview or invoke the _Open Preview to the Side_ command.

> Note that for the _preview_ options to be visible, the file has to be _saved_.

Double-click on a condition node to toggle its state between _success/_failed_.\
Double-click on an action node to switch its state between _running_/_success_/_failed_. Hold the _shift_ key to transition from _running_ to _failed_.

![Tree visualization and state changes](img/tree_viz.gif)

### Behavior Tree Editing

Enable the `editor.formatOnType` in your VS Code settings. This enables following behaviors:

- When you type `|`, white-space corresponding to one `tab` (per your configuration) is inserted
- When you press `[Enter]`, the same indentation is inserted to the new line
- When you press `[Backspace]` one level of indentation is removed
- When you press `Ctrl+[` or `Cmd+[`, the active row (or all selected rows) are indented +1 level
- When you press `Ctrl+]` or `Cmd+]`, the active row (or all selected rows) are un-indented -1 level

![Tree editing](img/tree_editing.gif)

> You can enable the on-type formatting selectively just for the _Tree_ language and/or just for one workspace using the `settings.json` in your workspace `.vscode` or in your global user settings:
>
> ```json
>     "[tree]": {
>         "editor.formatOnType": true
>     }
> }
> ```

## Release Notes

See [CHANGELOG.md](CHANGELOG.md).
