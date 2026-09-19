<script setup lang="ts">
import { ref } from 'vue';
import { supabase } from '../../lib/supabase';
import { useRoute } from 'vue-router';
import { AuthApiError } from '@supabase/supabase-js';

const route = useRoute()

const email = ref("")
const password = ref("")
const isSending = ref(false)
const isSent = ref(false)

const errorMessage = ref(
    route.query.AuthError === "1"
        ? "ユーザー作成時にエラーが発生しました。もう一度登録をお願いします。"
        : ""
)

async function AuthSignup() {
    const trimmedEmail = email.value.trim()
    const trimmedPass = password.value.trim()
    if (!trimmedEmail || !trimmedPass || isSending.value) return

    isSending.value = true
    isSent.value = false
    errorMessage.value = ""

    try {
        const { error } = await supabase.auth.signUp({
            email: trimmedEmail,
            password: trimmedPass,
            options: {
                emailRedirectTo: `${window.location.origin}/auth/callback`,
            }
        })

        if(error){
            throw error
        }

        isSent.value = true
    } catch (error) {
        console.error('アカウント作成失敗:', error)
        if(error instanceof AuthApiError && error.status === 429){
            errorMessage.value = '認証メールの送信回数が上限に達しました。しばらく待ってからもう一度お試しください。'
        }
        errorMessage.value = "アカウントを作成できませんでした。時間をおいてもう一度、お試し下さい。"
    }finally{
        isSending.value = false
    }
}


</script>
<template>
    <main>
        <h1>新規登録</h1>

        <form @submit.prevent="AuthSignup">
            <label for="auth-email">メールアドレス</label>
            <input
                type="email"
                id="auth-email"
                v-model="email"
                autocomplete="email"
                :disabled="isSending"
                required
            />
            <label for="auth-pass">パスワード</label>
            <input
                type="password"
                id="auth-pass"
                v-model="password"
                autocomplete="password"
                :disabled="isSending"
                required
            />
            <button
                type="submit"
                :disabled="isSending || isSent || !email.trim()"
            >
                {{ isSending ? "送信中..." : isSent ? "送信済み" : "新規アカウント作成" }}
            </button>
        </form>
        <p v-if="isSent">
            認証メールを送信しました。
            メール内のリンクを開いてください。
        </p>

        <p v-if="errorMessage" role="alert">
            {{ errorMessage }}
        </p>
        
        <div>
            既に、アカウントをお持ちの方は<RouterLink to="/auth/login">こちら</RouterLink>です。
        </div>
    </main>
</template>