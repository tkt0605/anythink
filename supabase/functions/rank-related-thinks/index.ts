import '@supabase/functions-js/edge-runtime.d.ts'
import { withSupabase } from '@supabase/server'
import { createClient } from '@supabase/supabase-js'
import {
  noul,
  TypeSafeClient,
  type NoulQuestion,
} from '@typesafe-ai/sdk'

const TYPESAFE_MODEL = 'jev-latest'
const CONNECT_PROMPT_VERSION = 'connect-v1'
const VOYAGE_CANDIDATE_COUNT = 5
const RELATED_THINK_COUNT = 3
const RELATED_PROBABILITY_THRESHOLD = 0.4
const RELATED_LOCK_MINUTES = 2
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const RELATION_QUESTION =
  'source_thinkとcandidate_thinkの間に、共通テーマ、連想、補完、対比、原因と結果、応用など、利用者が関連する考えとして一緒に読む価値のある関係がありますか？'
const RELATION_TRUE_CRITERIA =
  '直接同じ問題を扱っていなくても、共通するテーマや概念がある、発想を広げられる、新規アイデアや発明を手助けできるような創造性に長けているか、別の視点を与える、補完・対比・具体例になるなど、自然に接続できる関係がある。'
const RELATION_FALSE_CRITERIA =
  '主題や意図がほとんど無関係で、追加の説明がなければ両者を接続する理由を見いだせない。'

type MatchedThink = {
  id: string
  text: string
  similarity: number
}

type RankedThink = MatchedThink & {
  related_probability: number | null
}

type CachedScore = {
  think_id: string
  related_probability: number
}

type AcquireResult = {
  action: 'started' | 'cached' | 'in_progress' | 'forbidden' | 'invalid_request'
  run_id?: string
  lease_token?: string
  scores?: unknown
  model?: string
  retry_after_seconds?: number
}

type CacheStatus = 'hit' | 'miss' | 'none' | 'pending' | 'unavailable'

function voyageFallback(candidates: MatchedThink[]): RankedThink[] {
  return candidates.slice(0, RELATED_THINK_COUNT).map((candidate) => ({
    ...candidate,
    related_probability: null,
  }))
}

function fallbackResponse(
  candidates: MatchedThink[],
  reason: string,
  cacheStatus: CacheStatus = 'unavailable',
) {
  return Response.json({
    related_thinks: voyageFallback(candidates),
    ranking_method: 'voyage_fallback',
    rerank_reason: reason,
    threshold: RELATED_PROBABILITY_THRESHOLD,
    cache_status: cacheStatus,
  })
}

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(value),
  )

  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0')
  ).join('')
}

function parseCachedScores(
  value: unknown,
  candidates: MatchedThink[],
): CachedScore[] | null {
  if (!Array.isArray(value) || value.length !== candidates.length) {
    return null
  }

  const candidateIds = new Set(candidates.map((candidate) => candidate.id))
  const seenIds = new Set<string>()
  const scores: CachedScore[] = []

  for (const item of value) {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) {
      return null
    }

    const { think_id: thinkId, related_probability: probability } = item as
      Record<string, unknown>

    if (
      typeof thinkId !== 'string' ||
      !candidateIds.has(thinkId) ||
      seenIds.has(thinkId) ||
      typeof probability !== 'number' ||
      !Number.isFinite(probability) ||
      probability < 0 ||
      probability > 1
    ) {
      return null
    }

    seenIds.add(thinkId)
    scores.push({
      think_id: thinkId,
      related_probability: probability,
    })
  }

  return scores
}

function rankedResponse(
  candidates: MatchedThink[],
  scores: CachedScore[],
  model: string,
  cacheStatus: CacheStatus,
) {
  const probabilities = new Map(
    scores.map((score) => [score.think_id, score.related_probability]),
  )
  const relatedThinks = candidates
    .map((candidate): RankedThink => ({
      ...candidate,
      related_probability: probabilities.get(candidate.id) ?? 0,
    }))
    .sort(
      (left, right) =>
        (right.related_probability ?? 0) -
          (left.related_probability ?? 0) ||
        right.similarity - left.similarity,
    )
    .filter(
      (candidate) =>
        candidate.related_probability !== null &&
        candidate.related_probability >= RELATED_PROBABILITY_THRESHOLD,
    )
    .slice(0, RELATED_THINK_COUNT)

  return Response.json({
    related_thinks: relatedThinks,
    ranking_method: 'jev',
    model,
    threshold: RELATED_PROBABILITY_THRESHOLD,
    cache_status: cacheStatus,
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
            cache_status: 'none',
          })
        }

        const callerClaims = context.userClaims as
          | { sub?: string; id?: string }
          | undefined
        const callerId = callerClaims?.sub ?? callerClaims?.id

        if (!callerId) {
          return Response.json({ error: 'ログインが必要です。' }, { status: 401 })
        }

        const cacheSource = JSON.stringify({
          model: TYPESAFE_MODEL,
          prompt: {
            version: CONNECT_PROMPT_VERSION,
            question: RELATION_QUESTION,
            true_criteria: RELATION_TRUE_CRITERIA,
            false_criteria: RELATION_FALSE_CRITERIA,
          },
          source_think: {
            id: sourceThink.id,
            text: sourceThink.text,
          },
          candidates: candidates.map((candidate) => ({
            id: candidate.id,
            text: candidate.text,
          })),
        })
        const inputHash = await sha256Hex(cacheSource)

        const supabaseUrl = Deno.env.get('SUPABASE_URL')
        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

        if (!supabaseUrl || !serviceRoleKey) {
          throw new Error('Supabaseの必須環境変数が設定されていません。')
        }

        const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        })

        const { data: cachedRun, error: cacheError } = await serviceClient
          .from('related_think_runs')
          .select('id, scores, model')
          .eq('user_id', callerId)
          .eq('source_think_id', sourceThinkId)
          .eq('input_hash', inputHash)
          .eq('status', 'completed')
          .maybeSingle()

        if (cacheError) {
          throw cacheError
        }

        if (cachedRun) {
          const cachedScores = parseCachedScores(cachedRun.scores, candidates)

          if (cachedScores) {
            return rankedResponse(
              candidates,
              cachedScores,
              cachedRun.model,
              'hit',
            )
          }

          const { error: invalidCacheError } = await serviceClient
            .from('related_think_runs')
            .update({
              status: 'failed',
              scores: null,
              lease_token: null,
              lease_expires_at: null,
              completed_at: null,
            })
            .eq('id', cachedRun.id)

          if (invalidCacheError) {
            throw invalidCacheError
          }
        }

        const apiKey = Deno.env.get('TYPESAFE_API_KEY')

        if (!apiKey) {
          console.error('TYPESAFE_API_KEYが設定されていません。')
          return fallbackResponse(candidates, 'typesafe_not_configured')
        }

        let runId: string | undefined
        let leaseToken: string | undefined

        try {
          let acquisition: AcquireResult | null = null

          for (let attempt = 0; attempt < 2; attempt += 1) {
            const { data: acquireData, error: acquireError } =
              await serviceClient.rpc('acquire_related_think_run', {
                p_user_id: callerId,
                p_source_think_id: sourceThinkId,
                p_input_hash: inputHash,
                p_model: TYPESAFE_MODEL,
                p_prompt_version: CONNECT_PROMPT_VERSION,
                p_lock_minutes: RELATED_LOCK_MINUTES,
              })

            if (acquireError) {
              throw acquireError
            }

            acquisition = acquireData as AcquireResult | null

            if (!acquisition) {
              throw new Error('Jevキャッシュ開始判定の結果がありません。')
            }

            if (acquisition.action !== 'cached') {
              break
            }

            const acquiredScores = parseCachedScores(
              acquisition.scores,
              candidates,
            )

            if (acquiredScores) {
              return rankedResponse(
                candidates,
                acquiredScores,
                acquisition.model ?? TYPESAFE_MODEL,
                'hit',
              )
            }

            if (!acquisition.run_id) {
              throw new Error('不正なJevキャッシュが返されました。')
            }

            const { error: invalidCacheError } = await serviceClient
              .from('related_think_runs')
              .update({
                status: 'failed',
                scores: null,
                lease_token: null,
                lease_expires_at: null,
                completed_at: null,
              })
              .eq('id', acquisition.run_id)

            if (invalidCacheError) {
              throw invalidCacheError
            }
          }

          if (!acquisition) {
            throw new Error('Jevキャッシュを取得できませんでした。')
          }

          if (acquisition.action === 'in_progress') {
            return fallbackResponse(candidates, 'jev_in_progress', 'pending')
          }

          if (acquisition.action === 'forbidden') {
            return Response.json(
              { error: 'このThinkを参照する権利がありません。' },
              { status: 403 },
            )
          }

          if (
            acquisition.action !== 'started' ||
            !acquisition.run_id ||
            !acquisition.lease_token
          ) {
            throw new Error('Jev判定を開始できませんでした。')
          }

          runId = acquisition.run_id
          leaseToken = acquisition.lease_token

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
                question: RELATION_QUESTION,
              },
              {
                true: RELATION_TRUE_CRITERIA,
                false: RELATION_FALSE_CRITERIA,
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

          const scores = candidates.map((candidate, index): CachedScore => {
            const rawProbability = result.answers[`candidate_${index}`]?.noul
            const probability =
              typeof rawProbability === 'number' &&
                Number.isFinite(rawProbability)
                ? Math.min(Math.max(rawProbability, 0), 1)
                : 0

            return {
              think_id: candidate.id,
              related_probability: probability,
            }
          })

          const { data: completedRun, error: completeError } =
            await serviceClient
              .from('related_think_runs')
              .update({
                status: 'completed',
                scores,
                model: result.model,
                lease_token: null,
                lease_expires_at: null,
                completed_at: new Date().toISOString(),
              })
              .eq('id', runId)
              .eq('user_id', callerId)
              .eq('lease_token', leaseToken)
              .eq('status', 'processing')
              .select('id')
              .maybeSingle()

          if (completeError) {
            throw completeError
          }

          if (!completedRun) {
            throw new Error('Jev判定結果をキャッシュできませんでした。')
          }

          return rankedResponse(candidates, scores, result.model, 'miss')
        } catch (error) {
          if (runId && leaseToken) {
            const { error: releaseError } = await serviceClient
              .from('related_think_runs')
              .update({
                status: 'failed',
                scores: null,
                lease_token: null,
                lease_expires_at: null,
                completed_at: null,
              })
              .eq('id', runId)
              .eq('user_id', callerId)
              .eq('lease_token', leaseToken)

            if (releaseError) {
              console.error('Jevキャッシュロック解放失敗:', releaseError)
            }
          }

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
