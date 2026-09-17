// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";

console.log("Hello from Distill-Knowledge Functions!");

type DistillRequest = {
  rhinkId?: string
}

const fixedKnowledge = {
  summary: 'ThinkとDiscussの内容を短く整理した固定の要約する。',
  common_points: '参加者は、このテーマに関して考える価値があると認識している。',
  disagreements: '具体的な実現方法について意見が分かれている。',
  open_questions: '次に、どの方法を検証すべきかは未解決です。',
}

// This endpoint uses 'publishable' | 'secret' access, apiKey is required.
// Use publishable for Client-facing, key-validated endpoints
// Use secret for Server-to-server, internal calls
export default {
  fetch: withSupabase(
    {auth: 'publishable'},
    async (request) => {
      if(request.method !== 'POST'){
        return Response.json(
          {
            error: 'POSTリクエストのみ受け付けてます。'
          },
          {
            status: 405,
          }
        )
      }
      try {
        const body = (await request.json()) as DistillRequest
        const thinkId = body.thinkId?.trim()
        if(!thinkId) {
          return Response.json(
            {error: "ThinkIDが必要です。"},
            {status: 400}
          )
        }
        
        return Response.json({
          think_id: thinkId,
          ...fixedKnowledge
        })
      } catch (error) {
        const messgae =
          error instanceof Error
            ? error.message
            : "不明なエラーが発生しました。"
        console.error('Distill Error:', error)

        return Response.json(
          {
            error: message
          },
          {
            status: 500
          },
        )
      }
    },
  ),
}
// export default {
//   fetch: withSupabase({ auth: ["publishable", "secret"] }, async (req, ctx) => {
//     // Called by another service with a secret key
//     // ctx.supabaseAdmin bypasses RLS — use for privileged operations
//     /*
//     if (ctx.authMode === "secret") {
//       const { user_id } = await req.json();
//       const { data } = await ctx.supabaseAdmin.auth.admin.getUserById(user_id);

//       return Response.json({
//         email: data?.user?.email,
//       });
//     }
//     */

//     const { name } = await req.json();

//     return Response.json({
//       message: `Hello ${name}!`,
//     });
//   }),
// };

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/distill-knowledge' \
    --header 'apiKey: sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH' \
    --data '{"name":"Functions"}'

*/
