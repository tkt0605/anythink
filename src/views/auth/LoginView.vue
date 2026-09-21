<script setup lang="ts">
import { ref } from 'vue';
import { supabase } from '../../lib/supabase';
import { useRoute, useRouter } from 'vue-router';
import { AuthApiError } from '@supabase/supabase-js'

const route = useRoute()
const router = useRouter()

const email = ref('')
const password = ref('')
const isSending = ref(false)
const errorMessage = ref(
    route.query.AuthError === '1'
     ? "ログインに失敗しました。もう一度ログインをお願いします。"
     : ""
)


async function AuthSignin() {
    const trimmedEmail = email.value.trim()
    const submittedPass = password.value
    if(!trimmedEmail || !submittedPass || isSending.value){
        return
    }

    isSending.value = true
    errorMessage.value = ''

    try {
        const { error } = await supabase.auth.signInWithPassword({
            email: trimmedEmail,
            password: submittedPass,
        })
        if(error){
            throw error
        }
        const next = route.query.next
        const destination = typeof next === "string" &&
            next.startsWith('/') &&
            !next.startsWith('//') 
                ? next
                : "/home"
        await router.replace(destination)
    } catch (error) {
        console.error('ログインリクエスト・送信失敗:', error)
        if(error instanceof AuthApiError && error.status === 429){
            errorMessage.value = `
                ログイン試行回数が上限に達しました。しばらく待ってからもう一度お試しください。
            `
        }else if (error instanceof AuthApiError && error.status === 400){
            errorMessage.value = `
                ログインできませんでした。内容を確認してください。
            `
        }else{
            errorMessage.value = "ログインできませんでした。時間をおいてもう一度、お試し下さい。"
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
                <h1 id="auth-title">ログイン</h1>
                <p class="auth-description">メールアドレスとパスワードを入力してください。</p>

                <form class="auth-form" @submit.prevent="AuthSignin">
                    <div class="form-field">
                        <label for="auth-email">メールアドレス</label>
                        <input
                            id="auth-email"
                            v-model="email"
                            type="email"
                            autocomplete="email"
                            placeholder="name@example.com"
                            :disabled="isSending"
                            required
                        />
                    </div>
                    <div class="form-field">
                        <label for="auth-pass">パスワード</label>
                        <input
                            id="auth-pass"
                            v-model="password"
                            type="password"
                            autocomplete="current-password"
                            placeholder="パスワードを入力"
                            :disabled="isSending"
                            required
                        />
                    </div>
                    <p v-if="errorMessage" class="status status--error" role="alert">{{ errorMessage }}</p>
                    <button class="button button--primary auth-submit" type="submit" :disabled="isSending || !password || !email.trim()">
                        {{ isSending ? 'ログイン中...' : 'ログイン' }}
                    </button>
                </form>

                <p class="auth-switch">アカウントをお持ちでない方は <RouterLink :to="{ name: 'signup' }">新規登録へ</RouterLink></p>
            </section>
        </div>
    </main>
</template>
