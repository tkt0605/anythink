# CONNECT・CLARIFY実装プラン

## Context

前回のレビューで、企画書が定義するAIの3役割(CLARIFY/CONNECT/DISTILL)のうち、実際にAIが動いているのはDISTILLだけだと判明した。CONNECT(`thinkDetail.vue`の`fetchRelatedThinkss`)は文字の2-gram一致率で計算しているだけの疑似実装で、CLARIFYはコード自体が存在しない。企画書が「次世代」を名乗る根拠は「AIが静かに媒介して人と知識をつなぐ」という体験そのものなので、この2つを本物のAI連携に置き換える。

技術的な前提として、AnthropicはEmbeddings APIを持たず、公式にVoyage AIを推奨している(`platform.claude.com/docs/en/build-with-claude/embeddings`で確認済み)。ユーザーは「オープンソースのAIで構築したい」という希望を出したため、Voyageのラインナップの中で唯一オープンウェイト(Apache 2.0ライセンス、Hugging Faceで公開)である **`voyage-4-lite`** を採用する。Voyage経由のホスティングAPIを使う点は他モデルと同じ(新規インフラ不要)だが、モデル自体はオープンソースなので、将来的に同じ重みを自前ホスティングへ移行する道も残せる。

決定事項まとめ:
- Embeddingプロバイダー: Voyage AI、モデルは`voyage-4-lite`(オープンウェイト)、次元数は256に切り詰め(Matryoshka)
- CLARIFYの発火タイミング: 投稿ボタンを押した瞬間に1回だけ判定(下書き中の連続判定はしない)
- 公開範囲: 投稿時に`is_public`を決定し、投稿後は変更しない。CONNECTはRLSによって、その利用者が閲覧できるThinkだけを候補にする
- スキーマ変更: `supabase/migrations/`にSQLファイルを新規作成し、この機能から migration ベースの運用を始める
- 実装: このプランを本人が実装する。以下は設計仕様であり、コードそのものではない

---

## 1. CONNECT — 意味ベースの関連思考

### 1-1. スキーマ変更(新規: `supabase/migrations/<timestamp>_add_think_embeddings.sql`)

```sql
create extension if not exists vector;

alter table public.thinks
  add column if not exists embedding vector(256);
```

- インデックス(`hnsw`/`ivfflat`)は現段階の投稿数(数十〜数百件想定)では不要。数千件を超えてクエリが遅くなったタイミングで追加を検討する。
- `voyage-4-lite`のデフォルト次元は1024だが、Matryoshka特性により`output_dimension: 256`で呼び出せば256次元のベクトルが直接返る(既存埋め込みの後処理切り詰めは不要)。

### 1-2. 類似検索用RPC(同じmigrationファイルに追記)

```sql
create or replace function public.match_thinks(
  query_embedding vector(256),
  exclude_id uuid,
  match_count int default 3
)
returns table (id uuid, text text, similarity float)
language sql
stable
security invoker
as $$
  select
    think.id,
    think.text,
    1 - (think.embedding <=> query_embedding) as similarity
  from public.thinks as think
  where think.id != exclude_id
    and think.embedding is not null
  order by think.embedding <=> query_embedding
  limit match_count;
$$;
```

- `thinks.id`はUUIDなので、引数と戻り値の`id`も`uuid`に統一する。
- `security invoker`を明示し、呼び出した利用者のRLSを関連検索にも適用する。`security definer`にはしない。
- 未ログインでは公開Thinkだけ、ログイン中は公開Thinkと自分の非公開Thinkだけが候補になる。他人の非公開ThinkはRPCの検索対象にも戻り値にも含まれない。

### 1-3. 新規Edge Function: `supabase/functions/create-think/index.ts`

`distill-knowledge/index.ts`と同じ構成(`withSupabase({auth: 'user'})`、`deno.json`にimport追加)を踏襲する。ユーザーのJWTでRLSを適用し、`service_role`では投稿しない。

- 入力: `{ text: string, is_public: boolean }`
- 処理:
  1. `text`をtrimし、空・長すぎる場合は400を返す(`distill-knowledge`の30,000文字ガードと同様の考え方)。`is_public`がbooleanでなければ、安全のため補完せず400を返す
  2. `Deno.env.get('VOYAGE_API_KEY')`を読み、未設定なら500
  3. Voyage HTTP APIを呼ぶ:
     ```
     POST https://api.voyageai.com/v1/embeddings
     Authorization: Bearer <VOYAGE_API_KEY>
     {
       "input": [text],
       "model": "voyage-4-lite",
       "input_type": "document",
       "output_dimension": 256
     }
     ```
  4. Voyage呼び出しが失敗しても**投稿自体は失敗させない** — `embedding`を`null`のまま`thinks`にinsertし、サーバー側で`console.error`だけ残す。CONNECTはあくまで補助機能であり、投稿という中核体験をAI連携の不調で止めない、という企画書の「AIは静かな脇役」という原則に沿う判断。
  5. `context.supabase.from('thinks').insert({ text, is_public, embedding })`で作成し、作成行を返す。`user_id`はDBの`auth.uid()`デフォルトとINSERTポリシーに任せる

### 1-4. クライアント変更

- `Home.vue`の`createThinks()`: `supabase.from('thinks').insert(...)`を`supabase.functions.invoke('create-think', { body: { text: trimmedText, is_public: !isPrivate.value } })`に置き換える
- `thinkDetail.vue`:
  - `createBigrams` / `calculateSimilarity` / `fetchRelatedThinkss`を削除
  - `fetchThinkDetail`の`select`に`embedding`を追加
  - 新しい`fetchRelatedThinks(think)`は`supabase.rpc('match_thinks', { query_embedding: think.embedding, exclude_id: think.id, match_count: 3 })`を呼ぶ
  - `think.embedding`が`null`(Voyage失敗時など)の場合は、関連リストを「まだありません」と同じ空表示にフォールバックする

---

## 2. CLARIFY — 投稿時に一度だけ問い返す

### 2-1. 新規Edge Function: `supabase/functions/clarify-think/index.ts`

- モデル: `claude-haiku-4-5`(投稿のたびに呼ぶ軽量な分類+質問生成タスクのため、速度とコストを優先)
- 入力: `{ text: string }`
- システムプロンプトの原則(`distill-knowledge`のガードレールと同じ思想):
  - 一問だけ、必要な場合のみ質問する
  - 答えや意見を先回りして提案しない、問い返すだけに徹する
  - 曖昧さ・省略された前提を掘り下げる質問に限定する
  - 日本語で簡潔に
- 構造化出力スキーマ:
  ```json
  {
    "needs_clarification": "boolean",
    "question": "string | null"
  }
  ```
- `max_tokens`は小さめ(300程度)で十分。thinkingは不要。

### 2-2. `Home.vue`の投稿フロー変更

状態を追加: `clarifyQuestion: string | null`, `clarifyAnswer: string`, `isClarifying: boolean`, `pendingIsPublic: boolean | null`

投稿ボタンの挙動を2段階にする:

1. `clarifyQuestion`が未設定の状態で送信 → `pendingIsPublic`へ`!isPrivate.value`を保存してから`clarify-think`を呼ぶ
   - `needs_clarification === false` → そのまま`create-think`を呼んで投稿完了
   - `needs_clarification === true` → `clarifyQuestion`をセットして表示、ここで一旦停止(まだ投稿しない)
2. 質問表示中のUIに2つの選択肢を出す:
   - 「回答して投稿する」: `clarifyAnswer`をtrimして`text`に追記(例: `` `${trimmedText}\n\n${clarifyAnswer.trim()}` ``)し、`pendingIsPublic`を`is_public`として`create-think`を呼ぶ
   - 「そのまま投稿する」: 元の`text`と`pendingIsPublic`で`create-think`を呼ぶ(回答をスキップ)
3. 投稿成功後は`clarifyQuestion` / `clarifyAnswer` / `pendingIsPublic`をリセットし、`isPrivate`を`false`へ戻す

CLARIFYの待機中に公開範囲が変わって投稿結果と表示が食い違わないよう、最初の送信時点のbooleanを`pendingIsPublic`へ固定する。

耐障害性: `clarify-think`自体がエラーになった場合も投稿をブロックしない。CONNECTと同じ方針で、判定に失敗したら質問なしでそのまま`create-think`に進む。

---

## 動作確認手順

1. migrationを適用(`supabase db push`、またはこれまで通りダッシュボードSQL Editorで実行)
2. Voyage AIでAPIキーを取得し、`supabase secrets set VOYAGE_API_KEY=...`で登録
3. `supabase functions deploy create-think clarify-think`
4. 曖昧な投稿(例:「設定画面ってなくなるのかな」)→ 保存前に一問だけ質問が出ることを確認
5. 曖昧でない投稿 → 質問なしでそのまま保存されることを確認
6. 公開と非公開をそれぞれ投稿し、CLARIFYを経由した場合も選択した`is_public`で保存されることを確認
7. 投稿詳細ページで「関連する考え」が、表記の重なりではなく意味的に近い投稿を拾っていることを確認(言い回しは違うが内容が近い文と、表記は似ているが内容が違う文を用意して比較する)
8. 未ログイン、投稿者、別ユーザーで確認し、他人の非公開Thinkが一覧・直URL・関連候補のいずれにも現れないことを確認
9. `npx vue-tsc -b`で型チェックが通ることを確認

## この計画に含まないもの(別対応)

- 投稿後の公開/非公開の変更(投稿時に決定し、その後は変更しない仕様)
- `voyage-4-nano`の日本語・多言語品質の実地検証(オープンウェイトゆえ他のVoyageモデルより検証が薄い可能性があるため、導入後に言い換え文のペアで精度を軽く確認しておくことを推奨)
- 通報・モデレーション機能
