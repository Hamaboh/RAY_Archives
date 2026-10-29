# RAY_Archives — RAY Archives

アイドルグループ **RAY** の活動記録を、目的別のページで閲覧する静的アーカイブです。

現在公開しているページは以下です。

- `/` — TOP（各アーカイブページへの入口）
- `/events/` — イベント出演情報（年・月・キーワードで検索、各記録の詳細表示）

## データ更新

Notionアーカイブを更新する場合は、Node.js 18 以降で次を実行します。

```sh
node scripts/sync-notion.mjs
node scripts/build-event-data.mjs
```

`scripts/build-event-data.mjs` は、アーカイブ内の「イベント出演情報」を閲覧用の `data/events.json` に整形します。

## 公開

`main` ブランチへのpushでGitHub Pagesへ自動デプロイします。ビルド工程は不要です。

## データについて

`data/archive.json` は原資料の公開ブロック構造・項目・本文・リンクを保持します。画像などのバイナリ資産は複製せず、サイトの見た目はCSSで構成しています。
