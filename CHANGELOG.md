# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

### [0.2.8](///compare/v0.2.7...v0.2.8) (2026-03-31)


### Features

* **docs:** add related documentation b67343a
* **docs:** add RuFlo enabled session notes and usage checklist bd9d96a
* enhance setup process with .gitignore updates and cross-platform compatibility for .mcp.json 4b44558


### Bug Fixes

* update toPlatformMcpConfig to use npx instead of pnpm for cross-platform compatibility e7cf99f

### [0.2.7](///compare/v0.2.6...v0.2.7) (2026-03-20)


### Features

* **cli:** add update command to upgrade ruflo-setup to the latest version 569bc0b

### [0.2.6](///compare/v0.2.5...v0.2.6) (2026-03-20)


### Features

* **cli:** add cleanup command to remove Ruflo packages from npm global registry. 5151c70

### [0.2.5](///compare/v0.2.4...v0.2.5) (2026-03-17)

### [0.2.4](https://gitlab.mfj.local:8022/mario/ruflo-setup/compare/v0.2.3...v0.2.4) (2026-03-17)

### [0.2.3](https://gitlab.mfj.local:8022/mario/ruflo-setup/compare/v0.2.2...v0.2.3) (2026-03-14)

### [0.2.2](https://gitlab.mfj.local:8022/mario/ruflo-setup/compare/v0.2.1...v0.2.2) (2026-03-14)


### Features

* **package:** add ruflo-benefits.md to package files ([28a308a](https://gitlab.mfj.local:8022/mario/ruflo-setup/commit/28a308a005516981b06a213a053a1184c9644963))

### [0.2.1](https://gitlab.mfj.local:8022/mario/ruflo-setup/compare/v0.2.0...v0.2.1) (2026-03-14)


### Features

* **docs:** update usage section by moving status command first ([e98f473](https://gitlab.mfj.local:8022/mario/ruflo-setup/commit/e98f473f25f53031d8cf08cf8d6bd3bfedcae949))

## [0.2.0](https://gitlab.mfj.local:8022/mario/ruflo-setup/compare/v0.1.9...v0.2.0) (2026-03-14)


### ⚠ BREAKING CHANGES

* **cli:** The CLI now includes a new command which may affect existing scripts that rely on the previous command structure.

### Features

* **cli:** add 'status' command to check feature status ([d551664](https://gitlab.mfj.local:8022/mario/ruflo-setup/commit/d551664619635e7efbbc9a9810266ecfe2212d1c))
* **docs:** add detailed agents and skills sections to Ruflo benefit documentation ([c66d212](https://gitlab.mfj.local:8022/mario/ruflo-setup/commit/c66d212f4ee25390ab139e43131ecb548b7bcb5c))
* **docs:** add link to ruflo-benefits.md and renamed to plural ([2820aeb](https://gitlab.mfj.local:8022/mario/ruflo-setup/commit/2820aeb5cebbfad0ac7b568291aa55a49076c6c3))
* **docs:** update Ruflo benefit documentation with agents and skills sections ([8feb883](https://gitlab.mfj.local:8022/mario/ruflo-setup/commit/8feb8836c88ec5096a907eb4c842b0b3b4c55b4c))
* **status:** enhance directory checks to display count of agents and skills ([3ade22b](https://gitlab.mfj.local:8022/mario/ruflo-setup/commit/3ade22b10ba1840f405b8f239f2a723f6d4089d7))

### [0.1.9](https://gitlab.mfj.local:8022/mario/ruflo-setup/compare/v0.1.8...v0.1.9) (2026-03-13)

### [0.1.8](https://gitlab.mfj.local:8022/mario/ruflo-setup/compare/v0.1.7...v0.1.8) (2026-03-13)

### [0.1.7](https://gitlab.mfj.local:8022/mario/ruflo-setup/compare/v0.1.6...v0.1.7) (2026-03-13)


### Features

* **setup:** sync global command template and enhance dry-run feedback ([18e8b1d](https://gitlab.mfj.local:8022/mario/ruflo-setup/commit/18e8b1d3111eb2dbe067e0aba6349872bc59a236))

### [0.1.6](https://gitlab.mfj.local:8022/mario/ruflo-setup/compare/v0.1.5...v0.1.6) (2026-03-11)

### [0.1.5](https://gitlab.mfj.local:8022/mario/ruflo-setup/compare/v0.1.4...v0.1.5) (2026-03-11)


### Features

* **cli:** update commands to use pnpm instead of npx for installation and initialization ([5d7e482](https://gitlab.mfj.local:8022/mario/ruflo-setup/commit/5d7e482beaae9b3adfdf2a4c6ea478e8cf6774cb))
* **setup:** enhance pnpm installation instructions and ensure availability checks ([b89cccc](https://gitlab.mfj.local:8022/mario/ruflo-setup/commit/b89cccc978b7e439c6544195c7d480bb95ef07af))

### [0.1.4](https://gitlab.mfj.local:8022/mario/ruflo-setup/compare/v0.1.3...v0.1.4) (2026-03-11)


### Features

* **hooks:** enhance hook status reporting with matched command and source info ([faca4f7](https://gitlab.mfj.local:8022/mario/ruflo-setup/commit/faca4f77a26581a2262548753fb15ca8ee9d4773))

### [0.1.3](https://gitlab.mfj.local:8022/mario/setup-ruflo/compare/v0.1.2...v0.1.3) (2026-03-11)


### Bug Fixes

* **hooks:** update session start hook logic to prevent duplicate commands ([f81388e](https://gitlab.mfj.local:8022/mario/setup-ruflo/commit/f81388e46c4c91d72018e68365c4cc4c9831e778))

### [0.1.2](https://gitlab.mfj.local:8022/mario/setup-ruflo/compare/v0.1.1...v0.1.2) (2026-03-11)


### Features

* **cli:** add version printing functionality and update help options ([ffff66b](https://gitlab.mfj.local:8022/mario/setup-ruflo/commit/ffff66b5503016600724608ec179e06e9ecccaa0))


### Bug Fixes

* **package:** update pack:dry script to use JSON output and add changelog.md ([d6a675e](https://gitlab.mfj.local:8022/mario/setup-ruflo/commit/d6a675eb8b901566079f647b9d4d6e805474712c))

### 0.1.1 (2026-03-10)


### Features

* **package:** add publishConfig for public access ([58ea882](https://gitlab.mfj.local:8022/mario/setup-ruflo/commit/58ea882802edf41c6bb6ad02f8659aa6995ea8aa))
* **setup:** add global /ruflo-setup command and update check message ([9b56d94](https://gitlab.mfj.local:8022/mario/setup-ruflo/commit/9b56d940938b955a2e9cc80e13e1ebb0b26e8dcf))
* **setup:** add setup script for Ruflo + Claude Flow V3 initialization ([554694f](https://gitlab.mfj.local:8022/mario/setup-ruflo/commit/554694f3e936b59bb3989ba132c47ddf1b5c6e52))
* **setup:** implement cross-platform CLI for Ruflo setup ([5afb6a1](https://gitlab.mfj.local:8022/mario/setup-ruflo/commit/5afb6a1f128dcad5c5b17736c61dda87b4d0cea3))
* **setup:** setup for claude and ruflo ([9e68a57](https://gitlab.mfj.local:8022/mario/setup-ruflo/commit/9e68a577ac24827025039a9ef178769630e6ae68))


### Bug Fixes

* **setup:** remove CLAUDE.md template and adjust setup steps ([fdf3304](https://gitlab.mfj.local:8022/mario/setup-ruflo/commit/fdf3304b2572fe79ec8162f3a5bd64e657d0afd5))
* **setup:** update log messages for Ruflo setup ([46c26a9](https://gitlab.mfj.local:8022/mario/setup-ruflo/commit/46c26a99c5066d8313ccff99d1cbe53719b977c2))
