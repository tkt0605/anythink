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
        ? "メールアドレスの確認に失敗しました。確認リンクが無効か、期限切れの可能性があります。"
        : ""
)

async function AuthSignup() {
    const trimmedEmail = email.value.trim()
    const submittedPass = password.value
    if (!trimmedEmail || !submittedPass || isSending.value) return

    isSending.value = true
    isSent.value = false
    errorMessage.value = ""

    try {
        const { error } = await supabase.auth.signUp({
            email: trimmedEmail,
            password: submittedPass,
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
            errorMessage.value =`
                アカウント作成の試行回数が上限に達しました。しばらく待ってからもう一度お試しください。
            `
        }else if( error instanceof AuthApiError && error.status === 400 ){
            errorMessage.value = `
                アカウント作成に失敗しました。内容を確認してください。
            `
        }else{
            errorMessage.value = "アカウントを作成できませんでした。時間をおいてもう一度、お試し下さい。"
        }
    }finally{
        isSending.value = false
    }
}


</script>
<template>
    <main id="main-content" class="auth-main page-shell">
        <div class="auth-layout">
            <section class="auth-card surface" aria-labelledby="auth-title">
                <h1 id="auth-title">新規登録</h1>
                <p class="auth-description">メールアドレスとパスワードを設定してください。</p>

                <form class="auth-form" @submit.prevent="AuthSignup">
                    <div class="form-field">
                        <label for="auth-email">メールアドレス</label>
                        <input
                            id="auth-email"
                            v-model="email"
                            type="email"
                            autocomplete="email"
                            placeholder="name@example.com"
                            :disabled="isSending || isSent"
                            required
                        />
                    </div>
                    <div class="form-field">
                        <label for="auth-pass">パスワード</label>
                        <input
                            id="auth-pass"
                            v-model="password"
                            type="password"
                            autocomplete="new-password"
                            placeholder="パスワードを設定"
                            :disabled="isSending || isSent"
                            required
                        />
                    </div>
                    <p v-if="errorMessage" class="status status--error" role="alert">{{ errorMessage }}</p>
                    <p v-if="isSent" class="status status--success" role="status">確認メールを送信しました。メール内のリンクを開いてください。</p>
                    <button class="button button--primary auth-submit" type="submit" :disabled="isSending || isSent || !email.trim() || !password">
                        {{ isSending ? '送信中...' : isSent ? '送信済み' : 'アカウントを作成' }}
                    </button>
                </form>

                <p class="auth-switch">すでにアカウントをお持ちの方は <RouterLink :to="{ name: 'login' }">ログインへ</RouterLink></p>
            </section>
        </div>
    </main>
</template>
