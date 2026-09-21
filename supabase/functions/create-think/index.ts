import '@supabase/functions-js/edge-runtime.d.ts'
import { withSupabase } from "@supabase/server";


const MAX_TEXT_LENGTH = 30_000
const EMBEDDING_DIMENSION = 256


type VoyaEmbeddingResponse = {
    data?: Array<{
        embedding?: unknown
    }>
}

async function generateEmbedding(
    text: string,
): Promise<number[] | null> {
    const apikey = Deno.env.get('VOYAGE_API_KEY')

    if(!apikey){
        console.error("VOYAGE_API_KEYが設定されていません。");
        return null
    }

    try {
        const response = await fetch(
            'https://api.voyageai.com/v1/embeddings', 
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${apikey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    input: [text],
                    model: 'voyage-4-nano',
                    input_type: 'document',
                    output_dimension: EMBEDDING_DIMENSION,
                    output_dtype: 'float'
                }),
                signal: AbortSignal.timeout(30_000),
            },
        )
        if(!response.ok){
            const responseText = await response.text()
            console.error(
                'Voyage API Error:',
                response.status,
                responseText.slice(0, 500)
            )
            return null
        }

        const result = (await response.json()) as VoyaEmbeddingResponse
        const embedding = result.data?.[0]?.embedding

        // if (
        //     !Array.isArray(embedding) ||
        //     embedding.every(
        //         (value) => 
        //             typeof value === "number" &&
        //             Number.isFinite(value)
        //     )
        // ) {
        // }
        if (
            !Array.isArray(embedding) ||
            embedding.length !== EMBEDDING_DIMENSION ||
            !embedding.every(
                (value) => typeof value === 'number' && Number.isFinite(value),
            )
        ) {
            console.error('Voyageから正しい256次元Embeddingが返りませんでした。',)
            return null
        }
        return embedding as number[]
    } catch (error) {
        console.error('Embedding生成失敗:', error)
        return null
    }
}
export default {
    fetch: withSupabase(
        {auth: 'user'},
        async (request, context) => {
            if(request.method !== 'POST'){
                return Response.json(
                    {
                        error: 'POSTリクエストのみ受け付けています。'
                    },
                    {
                        status: 405
                    }
                )
            }
            try {
                let body : unknown
                
                try {
                    body = await request.json()
                } catch (error) {
                    return Response.json(
                        {
                            error: "正しいJSONを入れてください。",
                        },
                        {
                            status: 400,
                        },
                    )
                }
                if (
                    typeof body !== 'object' ||
                    body === null ||
                    Array.isArray(body)
                ) {
                    return Response.json(
                        {
                            error: 'リクエストの形式が正しくありません。',
                        },
                        {
                            status: 400,
                        },
                    )
                }
                const {
                    text,
                    is_public: isPublic,
                } = body as Record<string, unknown>

                if(typeof text !== "string"){
                    return Response.json(
                        {
                            error: "Thinkの本文が必要です。"
                        },
                        {
                            status: 400
                        }
                    )
                }

                const trimmedText = text.trim()

                if(!trimmedText){
                    return Response.json(
                        {
                            error: "Thinkの本文が必要です。"
                        },
                        {
                            status: 400
                        },
                    )
                }else if(trimmedText.length > MAX_TEXT_LENGTH){
                    return Response.json(
                        {
                            error: "本文が長すぎます。",
                        },
                        {
                            status: 413,
                        },
                    )
                }else if (typeof isPublic !== 'boolean'){
                    return Response.json(
                        {
                            error: "公開範囲の指定が必要です。",
                        },
                        {
                            status: 400,
                        },
                    )
                }
                const embedding = await generateEmbedding(trimmedText)

                const { 
                    data: think,
                    error: insertError
                } = await context.supabase
                    .from("thinks")
                    .insert({
                        text: trimmedText,
                        is_public: isPublic,
                        embedding
                    })
                    .select(
                        "id, text, is_public, created_at"
                    )
                    .single()
                if(insertError){
                    throw insertError;
                }

                return Response.json(
                    {
                        think,
                        embedding_created: embedding !== null
                    },
                    {
                        status: 201
                    },
                )

            } catch (error) {
                console.error("Create Think Error:", error);
                return Response.json(
                    {
                        error: "Thinkを投稿できませんでした。",
                    },
                    {
                        status: 500,
                    },
                )
            }
        },
    ),
}