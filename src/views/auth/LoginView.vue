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
const isSubmiting = ref(false)
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
    isSubmiting.value = false
    errorMessage.value = ''

    try {
        // const {error} = await supabase.auth.signInWithOtp({
        //     email: trimmedEmail,
        //     options: {
        //         emailRedirectTo: `${window.location.origin}/auth/callback`,
        //         shouldCreateUser: true
        //     }
        // })
        const { error } = await supabase.auth.signInWithPassword({
            email: trimmedEmail,
            password: submittedPass,
        })
        if(error){
            throw error
        }
        isSubmiting.value = true
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
        // isSubmiting..value = false
    }
}

</script>
<template>
    <main>
        <h1>ログイン</h1>

        <form @submit.prevent="AuthSignin">
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
                :disabled="isSending || !password || !email.trim()"
            >
                {{   isSubmiting ? "ログイン中..." : "ログイン" }}
            </button>
        </form>
        <!-- <p v-if="isSubmiting">
            認証メールを送信しました。
            メール内のリンクを開いてください。
        </p> -->

        <p v-if="errorMessage" role="alert">
            {{ errorMessage }}
        </p>
        <div>
            まだ、アカウントをお持ちでない方は<RouterLink to="/auth/signup">こちら</RouterLink>です。
        </div>
    </main>
</template>
