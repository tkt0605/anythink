<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RouterLink, RouterView, useRouter } from 'vue-router'
import { useAuth } from './composables/useAuth'

const router = useRouter()
const { user, isAuthReady, initializeAuth, signOut } = useAuth()
const isSigningOut = ref(false)
const signOutError = ref('')

onMounted(() => {
  initializeAuth()
})

async function handleSignOut() {
  if (isSigningOut.value) return

  isSigningOut.value = true
  signOutError.value = ''

  try {
    await signOut()
    await router.push({ name: 'login' })
  } catch (error) {
    signOutError.value = 'ログアウトできませんでした。もう一度お試しください。'
    console.error('ログアウト失敗:', error)
  } finally {
    isSigningOut.value = false
  }
}
</script>

<template>
  <a class="skip-link" href="#main-content">本文へ移動</a>
  <div class="app-frame">
    <header class="site-header">
      <div class="header-inner">
        <RouterLink class="brand" :to="{ name: 'index' }" aria-label="Anythink ホーム">
          <span>Anythink</span>
        </RouterLink>

        <nav class="site-nav" aria-label="メインメニュー">
          <RouterLink :to="{ name: 'home' }">投稿を見る</RouterLink>
        </nav>

        <div class="header-actions">
          <span v-if="!isAuthReady" class="header-status" role="status">確認中...</span>
          <template v-else-if="!user">
            <RouterLink class="header-link" :to="{ name: 'login' }">ログイン</RouterLink>
            <RouterLink class="button button--primary button--small header-signup" :to="{ name: 'signup' }">新規登録</RouterLink>
          </template>
          <button
            v-else
            class="button button--ghost button--small"
            type="button"
            :disabled="isSigningOut"
            @click="handleSignOut"
          >
            {{ isSigningOut ? 'ログアウト中...' : 'ログアウト' }}
          </button>
        </div>
      </div>
      <p v-if="signOutError" class="header-error" role="alert">{{ signOutError }}</p>
    </header>

    <RouterView />
  </div>
</template>
