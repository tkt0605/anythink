# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

Anythink は「思考 → 接続 → 会話 → 集合知」へ成長する AI ネイティブなネットワークを目指すアプリ。
AI は「しゃべる主役」ではなく、理解・接続・整理を担う静かな知性として位置づける。
滞在時間やフォロワー数ではなく、考えと接続密度を高めることを指標にする(README より)。

README が宣言している想定スタック:

- フロントエンド: Vue 3 + Vite
- バックエンド: TypeScript
- DB: Supabase
- CSS: Tailwind CSS
- LLM: AI API

## 現状(2026-09 時点)

`create-vue` / `create-vite` の初期テンプレートそのままの状態。以下は **まだ入っていない**:

- Tailwind CSS、Supabase クライアント、LLM SDK(README の宣言のみ)
- テストランナー、ESLint / Prettier
- git リポジトリ(未初期化。ホーム全体ではなくこのディレクトリ単位で `git init` すること)
- Vue Router、Pinia などの状態管理

`src/components/HelloWorld.vue` と `src/style.css` はテンプレートのデモ UI で、実装開始時に置き換える前提。

## コマンド

```bash
npm install          # 依存インストール
npm run dev          # Vite 開発サーバー(HMR)
npm run build        # vue-tsc -b で型チェック → vite build(型エラーがあるとビルド失敗)
npm run preview      # dist/ をローカル配信して確認
npx vue-tsc -b       # 型チェックのみ(ビルドせずに確認したいとき)
```

テストと lint のスクリプトは存在しない。追加する場合は `package.json` の scripts と、このファイルの本節を更新する。

## 構成と TypeScript 設定

- エントリは `index.html` → `src/main.ts` → `src/App.vue`。`main.ts` で `style.css` をグローバル読み込みしている。
- `tsconfig.json` は project references のルートで、実体は 2 つに分かれる:
  - `tsconfig.app.json`: `src/**` 用。`@vue/tsconfig/tsconfig.dom.json` を継承し、`vite/client` 型を有効化。
  - `tsconfig.node.json`: `vite.config.ts` 用。`module: nodenext` + `verbatimModuleSyntax`。
- 両 tsconfig で `noUnusedLocals` / `noUnusedParameters` / `erasableSyntaxOnly` / `noFallthroughCasesInSwitch` が有効。
  特に `erasableSyntaxOnly` により **enum・namespace・コンストラクタのパラメータプロパティは使えない**。型は `type` / `interface` と `as const` オブジェクトで表現する。
- `.vue` の型チェックは `vue-tsc` が担う。`tsc` 単体では `.vue` を検査しないので、型確認は必ず `vue-tsc -b` 経由で行う。
- SFC は `<script setup lang="ts">` 形式で統一する(既存コンポーネントに準拠)。
- `public/` 配下(`favicon.svg`, `icons.svg`)は `/` 直下パスで参照、`src/assets/` 配下は `import` で参照する(Vite の慣例)。
