# RAY_Archives — RAY Archives

アイドルグループ **RAY** の公開Notionアーカイブを、検索・区分別閲覧できる静的サイトにしたリポジトリです。

## 更新

Node.js 18 以降で次を実行すると、公開Notionページの全ブロックを再取得して `data/archive.json` を更新します。

```sh
node scripts/sync-notion.mjs
```

Notionのレート制限を尊重して再試行します。処理の途中にもスナップショットを保存するため、停止した場合も同じコマンドで再開できます。

## 公開

ビルド工程のない静的サイトです。GitHub Pages、Cloudflare Pages、Netlify、Vercelなどでリポジトリのルートを公開ディレクトリに指定できます。

## データについて

`data/archive.json` は原資料の公開ブロック構造・項目・本文・リンクを保持します。画像等のバイナリファイルは複製せず、サイトの見た目はCSSで構成しています。
