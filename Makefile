# =============================================================================
# パッケージング用Makefile
# =============================================================================
# shellの指定
SHELL := /usr/bin/bash

# 出力ディレクトリの定義
DIST_DIR := ./dist

# デフォルトゴールの定義
.DEFAULT_GOAL := help

# 仮想ターゲットの定義
.PHONY := help clean pack

# コマンド群を1つのシェルプロセスで実行するように
.ONESHELL:

# 使い方の表示
help:
	@cat <<-'EOS'
	# Usage
	make [target]
	  
	# Targets
	clean : Clean dist directory.
	pack  : Create package from built files.
	EOS

# 出力ディレクトリのお掃除
clean:
	@echo "Clean dist directory... ($(DIST_DIR))"
	@find $(DIST_DIR) -mindepth 1 -delete

# パッケージングスクリプトを実行
pack:
	@$(SHELL) ./tools/make_package.sh
