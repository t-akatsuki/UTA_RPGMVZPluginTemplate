// =============================================================================
// rollup.js設定ファイル
// https://rollupjs.org/configuration-options
// =============================================================================
import { defineConfig } from "rollup";
import path from "node:path";
import fs from "node:fs";
import replace from "@rollup/plugin-replace";

import pkg from "./package.json" with { type: "json" };

/**
 * ビルドターゲット。
 * 環境変数を引数で渡して指定する。
 * debug | release
 * @type {string}
 */
const buildTarget = process.env?.TARGET || "debug";

/**
 * プラグインのバージョン。
 * package.jsonで定義したバージョンに合わせる。
 * 数値として置換されないようにjson string化しておく。
 * @type {string}
 */
const PLUGIN_VERSION = JSON.stringify(pkg.version);

/**
 * 出力先ディレクトリのパス。
 * @type {string}
 */
const DEST_DIR = "./build";

/**
 * ビルドしたプラグインファイルをコピー配置するディレクトリのパス。
 * @type {string}
 */
const PROJECT_PLUGIN_DIR = "./project/js/plugins";

/**
 * プラグインアノテーションファイルのパス。
 * @type {string}
 */
const PLUGIN_ANNOTATION_FILEPATH = path.resolve("./src/annotation.js");

/**
 * 出力ファイル名の定義。
 * @type {string}
 */
const PLUGIN_FILENAME = "UTA_PluginTemplateMVZ.js";

/**
 * プラグイン内で利用する外部モジュールの定義。
 * ビルド時にバンドルしないように指定の必要がある。
 * @type {string[]}
 */
const externalModules = [
  "fs",
  "path",
];

/**
 * 改行コード調整用自前プラグイン。
 * @param {string} linefeedType 改行コードの種類。(crlf | lf)
 * @return {Plugin} プラグインの返り値。
 */
function linefeed(linefeedType = "crlf") {
  // 指定した改行コード種別に対応した変換後改行コード文字の定義
  let targetLinefeed = "";

  // crは現在使われていないはずなので対象外とする
  switch (linefeedType) {
    case "crlf":
      targetLinefeed = "\r\n";
      break;
    case "lf":
      targetLinefeed = "\n";
      break;
    default:
      throw new Error(`Invalid linefeed type comming. (${linefeedType})`);
  }

  return {
    "name": "linefeed",
    // rollupの出力をチャンク単位で変換
    renderChunk(code, _) {
      // 対象の改行コードに置換した結果を返す
      const ret = code.replace(/\r?\n/g, targetLinefeed);
      return {
        "code": ret,
        "map": null,
      };
    },
  };
}

/**
 * watch対象ファイルを追加する自前プラグイン。  
 * importされていないファイルはwatch対象に含まれない仕様なので、
 * プラグインで明示的に登録させる。
 * @param {string} filepath watch対象に追加するファイルのパス。
 */
function extendsWatchFile(filepath) {
  return {
    "name": "extends-watch-file",
    // ビルド時処理にフックしてwatch対象ファイルを追加
    buildStart() {
      this.addWatchFile(filepath);
    },
  };
}

/**
 * ビルドしたファイルを指定したディレクトリにコピーするプラグイン。
 * @param {string} targetDir コピー先ディレクトリのパス。
 */
function copyBuiltFile(targetDir) {
  return {
    "name": "copy-built-file",
    // ビルド後処理にフックして対象ディレクトリが存在する場合にファイルをコピー
    writeBundle(options, _) {
      // コピー先ディレクトリが存在しない場合は何もしない
      if (!fs.existsSync(PROJECT_PLUGIN_DIR)) {
        console.info(`Ingore copy built file. Directory '${targetDir}' does not exists.`);
        return;
      }

      // ビルド生成物をコピー先ディレクトリにコピー
      if (options.file) {
        const fileName = path.basename(options.file);
        const destPath = path.join(targetDir, fileName);

        fs.copyFileSync(options.file, destPath);
        console.info(`Copy '${options.file}' to '${destPath}'.`)
      }
    },
  };
}

export default defineConfig({
  "input": "./src/main.js",
  "output": {
    "file": path.join(DEST_DIR, PLUGIN_FILENAME),
    // scriptタグから読み込まれる為、IIFE形式のJavaScriptとして出力させる
    "format": "iife",
    // 'use strict'を出力する
    "strict": true,
    // ソースマップはデバッグビルド時のみ有効にする
    "sourcemap": buildTarget === "debug" ? "inline" : false,
    // 出力インデントはスペースとする
    "indent": "    ",
    // 生成するJavaScriptコードの調整
    "generatedCode": {
      /**
       * RPGツクールMV: 古いバージョンはES5だが、直近はES2015(ES6)に対応している
       * RPGツクールMZ: 初期からES2015(ES6)に対応している
       */
      "preset": "es2015",
      // アロー関数を許可
      "arrowFunctions": true,
      // const / letを許可
      "constBindings": true,
      // オブジェクトの胆略記法は可読性観点から許可しない
      "objectShorthand": false,
      // プロパティ名の予約語をそのまま利用する
      "reservedNamesAsProps": true,
      // Symbolの利用を許可しない
      "symbols": false,
    },
    // アノテーションはプラグインの先頭部分に記述する為、
    // 出力ファイルの先頭に挿入する
    // 単純にエントリーポイントの先頭に書いてもバンドラーの仕様上期待する形にならない
    // watch時に内容が固定化されないように都度評価させる
    "banner": () => {
      return fs.readFileSync(
        PLUGIN_ANNOTATION_FILEPATH,
        {
          "encoding": "utf-8",
          "flag": "r",
        }
      );
    },
  },
  // バンドル対象としない外部モジュールの定義
  "external": [
    ...externalModules,
  ],
  // DevContainer上ではファイルシステムの差異から--watchによる変更検知が上手く働かない事がある
  // pollingオプションを有効にして変更を検知できるようにする
  "watch": {
    "chokidar": {
      "usePolling": true,
      "interval": 100,
    },
  },
  "plugins": [
    // watch対象にアノテーションファイルを追加する
    extendsWatchFile(PLUGIN_ANNOTATION_FILEPATH),
    // 特定文字列を置換
    // https://www.npmjs.com/package/@rollup/plugin-replace
    replace({
      // 直後に単一の符号が続く対象の置換を防ぐ
      // 変数が置換される事故を抑制する
      "preventAssignment": true,
      // __VERSION__: package.jsonに記載のバージョン(作成プラグインのバージョン)
      "__VERSION__": PLUGIN_VERSION,
    }),
    // 改行コードの調整
    // RPGツクールMV/MZのプラグインはcrlfが利用されているので統一
    linefeed("crlf"),
    // ビルド後にプラグインファイルをプロジェクトにコピー
    // 都度手動コピーしなくてもRPGツクール上でのデバッグを容易にする
    copyBuiltFile(PROJECT_PLUGIN_DIR),
  ],
});
