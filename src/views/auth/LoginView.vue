<script setup lang="ts">
import { ref } from 'vue';
import { supabase } from '../../lib/supabase';
import { useRoute } from 'vue-router';
import { AuthApiError } from '@supabase/supabase-js'

const route = useRoute();

const email = ref('')
const isSending = ref(false)
const isSent = ref(false)
const errorMessage = ref(
    route.query.AuthError === '1'
     ? "認証リンクが無効か、期限切れです。もう一度ログインをお願いします。"
     : ""
)


async function sendMagicLink() {
    const trimmedEmail = email.value.trim()

    if(!trimmedEmail || isSending.value){
        return
    }

    isSending.value = true
    isSent.value = false
    errorMessage.value = ''

    try {
        const {error} = await supabase.auth.signInWithOtp({
            email: trimmedEmail,
            options: {
                emailRedirectTo: `${window.location.origin}/auth/callback`,
                shouldCreateUser: true
            }
        })

        if(error){
            throw error
        }

        isSent.value = true
    } catch (error) {
        console.error('認証メール送信失敗:', error)
        if(error instanceof AuthApiError && error.status === 429){
             errorMessage.value ='認証メールの送信回数が上限に達しました。しばらく待ってからもう一度お試しください。'
        }
        errorMessage.value = "認証メールを送信できませんでした。時間をおいてもう一度、お試し下さい。"
    }finally{
        isSending.value = false
        // isSent.value = false
    }
}

</script>
<template>
    <main>
        <h1>ログイン</h1>

        <form @submit.prevent="sendMagicLink">
            <label for="auth-email">メールアドレス</label>
            <input
                type="email"
                id="auth-email"
                v-model="email"
                autocomplete="email"
                :disabled="isSending"
                required
            />

            <button
                type="submit"
                :disabled="isSending || isSent || !email.trim()"
            >
                {{ isSending ? "送信中..." : isSent ? "送信済み" : "ログイン" }}
            </button>
        </form>
        <p v-if="isSent">
            認証メールを送信しました。
            メール内のリンクを開いてください。
        </p>

        <p v-if="errorMessage" role="alert">
            {{ errorMessage }}
        </p>
    </main>
</template>
