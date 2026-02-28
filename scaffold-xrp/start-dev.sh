#!/bin/bash
# Increase file descriptor limit and start dev server
ulimit -n 65536 2>/dev/null || ulimit -n 10240
cd "$(dirname "$0")"
pnpm dev:nuxt
