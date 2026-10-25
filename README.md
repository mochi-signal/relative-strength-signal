# レラティブストレングス・シグナル

8資産のレラティブストレングス投資の月次シグナルを判定し、GitHub Pages で公開する静的サイトです。

## 仕組み

- `scripts/update.mjs` … 投信総合検索ライブラリーから基準価額を取得し、シグナルを判定して `docs/`（サイト）と `data/history.json`（履歴）を更新
- `.github/workflows/update.yml` … 毎月1〜10日に自動実行。月末の基準価額が出そろうと新しい月のシグナルが追加される
- `funds.json` … 対象ファンド（8資産それぞれの最安ファンド）
- `scripts/select-funds.mjs` … 対象ファンドの見直し用（年1回程度）

外部パッケージは使っていません（Node.js 18 以上）。

## ローカルで動かす

```
node scripts/update.mjs
node scripts/serve.mjs
```

http://localhost:8000/ で確認できます。

## 公開手順（初回のみ）

1. GitHub で新しいリポジトリを作成し、このフォルダの中身を push する
2. リポジトリの Settings → Pages → Build and deployment で「Deploy from a branch」、ブランチ `main`、フォルダ `/docs` を選んで保存
3. Settings → Actions → General → Workflow permissions で「Read and write permissions」を選んで保存
4. Actions タブの「月次シグナル更新」→「Run workflow」で一度手動実行して動作を確認

## ファンドの見直し

```
node scripts/select-funds.mjs
```

表示された候補をもとに `funds.json` を書き換えて（信託報酬は税込）、`reviewed` の日付を更新します。
