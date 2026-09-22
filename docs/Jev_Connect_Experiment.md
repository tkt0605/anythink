# CONNECT: Voyage候補検索 + Jev再ランキング

## 目的

既存の`match_thinks` RPCによるベクトル検索を高速な候補発見に使い、その候補をJevで再評価する。

- Voyage: 意味的に近い候補を上位10件まで取得
- Jev: 2つのThinkを一緒に読むことで、思考・理解・会話が発展する確率を判定
- 表示: Jevの関連確率が70%以上の候補から上位3件

## 処理フロー

1. 詳細画面から`sourceThinkId`を`rank-related-thinks` Edge Functionへ送る
2. Edge FunctionがユーザーJWTを使って元Thinkを取得する
3. 同じRLSコンテキストで`match_thinks`を呼び、Voyage候補を10件取得する
4. 候補ごとにJevのNoul質問を作り、1回のAPIリクエストで並列評価する
5. Noul値が`0.7`以上の候補を降順に並べ、最大3件返す
6. Jev APIが利用できない場合はVoyage上位3件を返す

`security invoker`の`match_thinks`とユーザーJWT付きSupabaseクライアントを使うため、他人の非公開ThinkはJevへ送信されない。

## Supabase secret

TypeSafe AIのAPIキーを取得した後、次のコマンドで登録する。

```bash
npx supabase secrets set TYPESAFE_API_KEY="取得したAPIキー"
```

キーは`.env`、Vueコード、`VITE_*`変数には置かない。

## デプロイ

```bash
npx supabase functions deploy rank-related-thinks
```

## フォールバック

- ログイン中: Edge FunctionでJev再ランキングを試し、失敗時はVoyage検索へ切り替える
- 未ログイン: 有料APIの公開エンドポイント化を避け、従来のRLS付きVoyage検索を使う

## 調整値

初期値は次のとおり。

```text
Voyage候補数: 10
Jev関連確率の閾値: 0.70
表示件数: 3
```

本番データで関連・非関連のThinkペアを評価し、閾値を調整する。Noul値はコサイン類似度ではなく、「質問に対するYesの確率」として扱う。
