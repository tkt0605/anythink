import '@supabase/functions-js/edge-runtime.d.ts'
import { withSupabase } from '@supabase/server'
import {
  noul,
  TypeSafeClient,
  type NoulQuestion,
} from '@typesafe-ai/sdk'

const TYPESAFE_MODEL = 'jev-latest'
const VOYAGE_CANDIDATE_COUNT = 10
const RELATED_THINK_COUNT = 3
const RELATED_PROBABILITY_THRESHOLD = 0.7
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type MatchedThink = {
  id: string
  text: string
  similarity: number
}

type RankedThink = MatchedThink & {
  related_probability: number | null
}

function voyageFallback(candidates: MatchedThink[]): RankedThink[] {
  return candidates.slice(0, RELATED_THINK_COUNT).map((candidate) => ({
    ...candidate,
    related_probability: null,
  }))
}

function fallbackResponse(candidates: MatchedThink[], reason: string) {
  return Response.json({
    related_thinks: voyageFallback(candidates),
    ranking_method: 'voyage_fallback',
    rerank_reason: reason,
    threshold: RELATED_PROBABILITY_THRESHOLD,
  })
}

export default {
  fetch: withSupabase(
    { auth: 'user' },
    async (request, context) => {
      if (request.method !== 'POST') {
        return Response.json(
          { error: 'POSTリクエストのみ受け付けています。' },
          { status: 405 },
        )
      }

      try {
        let body: unknown

        try {
          body = await request.json()
        } catch {
          return Response.json(
            { error: '正しいJSONを送信してください。' },
            { status: 400 },
          )
        }

        if (
          typeof body !== 'object' ||
          body === null ||
          Array.isArray(body)
        ) {
          return Response.json(
            { error: 'リクエストの形式が正しくありません。' },
            { status: 400 },
          )
        }

        const { sourceThinkId } = body as Record<string, unknown>

        if (
          typeof sourceThinkId !== 'string' ||
          !UUID_PATTERN.test(sourceThinkId)
        ) {
          return Response.json(
            { error: '正しいThink IDが必要です。' },
            { status: 400 },
          )
        }

        const { data: sourceThink, error: sourceError } = await context.supabase
          .from('thinks')
          .select('id, text')
          .eq('id', sourceThinkId)
          .maybeSingle()

        if (sourceError) {
          throw sourceError
        }

        if (!sourceThink) {
          return Response.json(
            { error: '指定されたThinkが存在しません。' },
            { status: 404 },
          )
        }

        const { data, error: matchError } = await context.supabase.rpc(
          'match_thinks',
          {
            source_think_id: sourceThinkId,
            match_count: VOYAGE_CANDIDATE_COUNT,
            match_threshold: 0,
          },
        )

        if (matchError) {
          throw matchError
        }

        const candidates = (data ?? []) as MatchedThink[]

        if (candidates.length === 0) {
          return Response.json({
            related_thinks: [],
            ranking_method: 'jev',
            model: TYPESAFE_MODEL,
            threshold: RELATED_PROBABILITY_THRESHOLD,
          })
        }

        const apiKey = Deno.env.get('TYPESAFE_API_KEY')

        if (!apiKey) {
          console.error('TYPESAFE_API_KEYが設定されていません。')
          return fallbackResponse(candidates, 'typesafe_not_configured')
        }

        try {
          const client = new TypeSafeClient({
            apiKey,
            defaultModel: TYPESAFE_MODEL,
            timeout: 15_000,
            retry: {
              maxRetries: 1,
            },
          })

          const questions: Record<string, NoulQuestion> = {}

          candidates.forEach((candidate, index) => {
            questions[`candidate_${index}`] = noul(
              {
                candidate_think: candidate.text,
                question:
                  'source_thinkとcandidate_thinkを一緒に読むことで、利用者の思考・理解・会話が具体的に発展する関係にありますか？',
              },
              {
                true:
                  '同じ問題、補完関係、具体例、反論、原因と結果など、両者をつなぐ明確な意味上の関係がある。',
                false:
                  '表面的な単語や一般的な話題が似ているだけで、両者を一緒に読む具体的な価値がない。',
              },
            )
          })

          const result = await client.systemOne({
            model: TYPESAFE_MODEL,
            state: {
              source_think: sourceThink.text,
            },
            questions,
          })

          const relatedThinks = candidates
            .map((candidate, index): RankedThink => ({
              ...candidate,
              related_probability:
                result.answers[`candidate_${index}`]?.noul ?? 0,
            }))
            .filter(
              (candidate) =>
                candidate.related_probability !== null &&
                candidate.related_probability >= RELATED_PROBABILITY_THRESHOLD,
            )
            .sort(
              (left, right) =>
                (right.related_probability ?? 0) -
                  (left.related_probability ?? 0) ||
                right.similarity - left.similarity,
            )
            .slice(0, RELATED_THINK_COUNT)

          return Response.json({
            related_thinks: relatedThinks,
            ranking_method: 'jev',
            model: result.model,
            threshold: RELATED_PROBABILITY_THRESHOLD,
          })
        } catch (error) {
          console.error('Jev再ランキング失敗:', error)
          return fallbackResponse(candidates, 'typesafe_request_failed')
        }
      } catch (error) {
        console.error('関連Think取得失敗:', error)
        return Response.json(
          { error: '関連する考えを取得できませんでした。' },
          { status: 500 },
        )
      }
    },
  ),
}
