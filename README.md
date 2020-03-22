# VS Code Behavior Tree editor

[![Downloads](https://vsmarketplacebadge.apphb.com/downloads/jan-dolejsi.btree.svg?subject=Downloads)](https://marketplace.visualstudio.com/items?itemName=jan-dolejsi.btree)
[![Installs](https://vsmarketplacebadge.apphb.com/installs/jan-dolejsi.btree.svg?subject=Installations)](https://marketplace.visualstudio.com/items?itemName=jan-dolejsi.btree)
[![Ratings](https://vsmarketplacebadge.apphb.com/rating-star/jan-dolejsi.btree.svg?subject=Reviews)](https://marketplace.visualstudio.com/items?itemName=jan-dolejsi.btree&ssr=false#review-details)
[![CI/CD](https://img.shields.io/github/workflow/status/jan-dolejsi/vscode-btree/Build/master.svg?logo=github)](https://github.com/jan-dolejsi/vscode-btree/actions?query=workflow%3ABuild)

Behavior trees are a technique used in video games and robotics to model behavior AI. Their use has become increasingly popular due to their simple implementation, ease of understanding, and flexibility.\
This extension provides visualization of trees authored in the language suggested by [Dan Abad's behavior_tree project](https://github.com/0xabad/behavior_tree/).

## Features

Open a `*.tree` that adheres to the [syntax](https://github.com/0xabad/behavior_tree/#syntax).\
Right-click on the editor text and select Preview or invoke the _Open Preview to the Side_ command.\
Double-click on a condition node to toggle its state between _success/_failed_.\
Double-click on an action node to switch its state between _running_/_success_/_failed_. Hold the _shift_ key to transition from _running_ to _failed_.

![Tree visualization and state changes](img/tree_viz.gif)

## Release Notes

See [CHANGELOG.md](CHANGELOG.md).