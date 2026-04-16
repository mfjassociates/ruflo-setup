#!/usr/bin/env node
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

// Resolve @mfjjs/ruflo-setup's bin entry and delegate to it.
const require = createRequire(import.meta.url);
const binPath = require.resolve('@mfjjs/ruflo-setup/bin/ruflo-setup.js');
await import(pathToFileURL(binPath).href);
