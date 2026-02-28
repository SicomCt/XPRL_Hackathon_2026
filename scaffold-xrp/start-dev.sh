#!/bin/bash
# 解决 EMFILE 问题并启动开发服务
ulimit -n 10240
cd "$(dirname "$0")"
pnpm dev:nuxt
