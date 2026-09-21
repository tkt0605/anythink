<script setup lang="ts">
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { supabase } from '../../lib/supabase';

const router = useRouter();

onMounted(async() => {
    try {
        const code = new URL(window.location.href).searchParams.get('code') ?? ''
        if (!code){
            throw new Error("認証コードがありません。");
        }
        const { error } = await supabase.auth.exchangeCodeForSession(code)

        if(error){
            throw error
        }

        await router.replace({
            name: "home"
        })
    } catch (error) {
        console.error('認証処理失敗:', error)

        await router.replace({
            name: 'signup',
            query: {
                AuthError: '1',
            }
        })
    }
})
</script>
<template>
    <main id="main-content" class="callback-main page-shell">
        <div class="callback-card surface" role="status">
            <span class="callback-spinner" aria-hidden="true"></span>
            <h1>認証しています</h1>
            <p>確認が終わるまで、少しお待ちください。</p>
        </div>
    </main>
</template>
