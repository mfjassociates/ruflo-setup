#!/usr/bin/env node
// Syncs the root package.json version into ruflo-setup/package.json.
// Called by both the standard-version `postbump` hook and the npm `version` hook.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(fileURLToPath(import.meta.url), '..', '..');
const rootPkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const wrapperPath = path.join(root, 'ruflo-setup', 'package.json');
const wrapperPkg = JSON.parse(fs.readFileSync(wrapperPath, 'utf8'));

wrapperPkg.version = rootPkg.version;
fs.writeFileSync(wrapperPath, JSON.stringify(wrapperPkg, null, 2) + '\n');

console.log(`synced ruflo-setup version → ${rootPkg.version}`);
