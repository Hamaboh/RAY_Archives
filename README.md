# RAY_Archives — RAY Archives

アイドルグループ **RAY** の活動記録を、目的別のページで閲覧する静的アーカイブです。

現在公開しているページは以下です。

- `/` — TOP（各アーカイブページへの入口）
- `/events/` — イベント出演情報（年・月・キーワードで検索、各記録の詳細表示）
- `/songs/` — オリジナル楽曲（初披露日・アーティスト・クレジットで閲覧）
- `/limited-songs/` — 限定披露楽曲（当日限定で披露された楽曲・パフォーマンスを閲覧）
- `/statistics/` — セットリスト統計（楽曲別の披露回数を閲覧）
- `/media/` — メディア一覧（記事・配信・投稿を発信日順に閲覧）

## データ更新

Notionアーカイブを更新する場合は、Node.js 18 以降で次を実行します。

```sh
node scripts/sync-notion.mjs
node scripts/build-event-data.mjs
```

`scripts/build-event-data.mjs` は、アーカイブ内の「イベント出演情報」を閲覧用の `data/events.json` に整形します。

Google スプレッドシートから楽曲情報を更新する場合は、それぞれのシートを全選択・コピーし、対応する取込スクリプトを起動して貼り付けます。

```sh
IMPORT_PORT=4178 node scripts/import-song-sheet.mjs
IMPORT_PORT=4179 node scripts/import-limited-performance-sheet.mjs
IMPORT_PORT=4181 node scripts/import-media-sheet.mjs
```

前者は「オリジナル楽曲」、後者は「当日限定パフォーマンス」、3つ目は「メディア情報」を、それぞれ `data/songs.json`、`data/limited-performances.json`、`data/media.json` に同期します。

## 公開

`main` ブランチへのpushでGitHub Pagesへ自動デプロイします。ビルド工程は不要です。

## データについて

`data/archive.json` は原資料の公開ブロック構造・項目・本文・リンクを保持します。画像などのバイナリ資産は複製せず、サイトの見た目はCSSで構成しています。
