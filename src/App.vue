<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router'
import { useAuth } from './composables/useAuth'

const router = useRouter()
const route = useRoute()
const { user, isAuthReady, initializeAuth, signOut } = useAuth()
const isSigningOut = ref(false)
const signOutError = ref('')

const isHome = computed(() => route.name === 'home')
const isThinkDetail = computed(() => route.name === 'think-detail')
const isLanding = computed(() => route.name === 'index')
const isAuthPage = computed(() =>
  route.name === 'login' ||
  route.name === 'signup' ||
  route.path === '/auth/callback'
)
const isPublicPage = computed(() => isLanding.value || isAuthPage.value)
const showRightRail = computed(() => isHome.value || isThinkDetail.value)
const pageTitle = computed(() => {
  if (isHome.value) return 'ホーム'
  if (isThinkDetail.value) return 'Think'
  return 'Anythink'
})

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

  <div
    v-if="isPublicPage"
    class="public-shell"
    :class="{
      'public-shell--landing': isLanding,
      'public-shell--auth': isAuthPage
    }"
  >
    <header class="public-header">
      <div class="public-header-inner">
        <RouterLink class="brand" :to="{ name: 'index' }" aria-label="Anythink はじめのページ">
          <!-- <span class="brand-mark" aria-hidden="true">A</span> -->
          <span class="brand-name">Anythink</span>
        </RouterLink>

        <nav class="public-header-nav" aria-label="アカウントメニュー">
          <span v-if="!isAuthReady" class="header-status" role="status">確認中...</span>
          <RouterLink v-else-if="user" class="button button--soft button--small" :to="{ name: 'home' }">
            ホームへ
          </RouterLink>
          <template v-else-if="isLanding">
            <RouterLink class="public-login-link" :to="{ name: 'login' }">ログイン</RouterLink>
            <RouterLink class="button button--primary button--small" :to="{ name: 'signup' }">無料ではじめる</RouterLink>
          </template>
          <template v-else-if="route.name === 'login'">
            <span class="public-header-prompt">はじめての方</span>
            <RouterLink class="button button--ghost button--small" :to="{ name: 'signup' }">新規登録</RouterLink>
          </template>
          <template v-else-if="route.name === 'signup'">
            <span class="public-header-prompt">アカウントをお持ちの方</span>
            <RouterLink class="button button--ghost button--small" :to="{ name: 'login' }">ログイン</RouterLink>
          </template>
        </nav>
      </div>
    </header>

    <div class="public-content">
      <RouterView />
    </div>
  </div>

  <div v-else class="app-shell" :class="{ 'app-shell--with-rail': showRightRail }">
    <aside class="left-rail" aria-label="メインメニュー">
      <div class="left-rail-top">
        <RouterLink class="brand" :to="{ name: 'index' }" aria-label="Anythink はじめのページ">
          <!-- <span class="brand-mark" aria-hidden="true">A</span> -->
          <span class="brand-name">Anythink</span>
        </RouterLink>

        <nav class="side-nav">
          <RouterLink :to="{ name: 'home' }">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M3 11.5 12 4l9 7.5M5.5 10v9h5v-5h3v5h5v-9" />
            </svg>
            <span>ホーム</span>
          </RouterLink>
          <!-- <RouterLink :to="{ name: 'index' }">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M5 4.5h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H11l-5 3v-3H5a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2Z" />
            </svg>
            <span>はじめに</span>
          </RouterLink> -->
        </nav>

        <RouterLink class="button button--primary compose-link" :to="{ name: 'home', hash: '#think-text' }">
          Thinkを書く
        </RouterLink>
      </div>

      <div class="left-rail-account">
        <p v-if="!isAuthReady" class="header-status" role="status">認証状況を確認中...</p>
        <template v-else-if="!user">
          <RouterLink class="button button--primary" :to="{ name: 'login' }">ログイン</RouterLink>
          <RouterLink class="header-link" :to="{ name: 'signup' }">新規登録</RouterLink>
        </template>
        <template v-else>
          <span class="account-label">ログイン中</span>
          <button
            class="button button--ghost button--small"
            type="button"
            :disabled="isSigningOut"
            @click="handleSignOut"
          >
            {{ isSigningOut ? 'ログアウト中...' : 'ログアウト' }}
          </button>
        </template>
        <p v-if="signOutError" class="header-error" role="alert">{{ signOutError }}</p>
      </div>
    </aside>

    <aside v-if="showRightRail" class="right-rail" aria-label="補足情報">
      <div v-if="isHome" class="right-rail-default">
        <section class="rail-card">
          <h2>考えをつなげる</h2>
          <p>Thinkを投稿し、近い考えを見つけ、会話から理解を深める場所です。</p>
        </section>
        <section class="rail-card">
          <h2>公開範囲</h2>
          <dl class="rail-definition-list">
            <div>
              <dt>公開</dt>
              <dd>ほかの利用者も閲覧できます。</dd>
            </div>
            <div>
              <dt>非公開</dt>
              <dd>自分だけが閲覧できます。</dd>
            </div>
          </dl>
        </section>
      </div>
      <div id="think-right-rail"></div>
    </aside>

    <section class="center-column">
      <header class="column-header">
        <h1>{{ pageTitle }}</h1>
        <div class="mobile-header-actions">
          <span v-if="!isAuthReady" class="header-status" role="status">確認中...</span>
          <template v-else-if="!user">
            <RouterLink class="header-link" :to="{ name: 'login' }">ログイン</RouterLink>
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
      </header>

      <div class="center-scroll">
        <RouterView />
      </div>
    </section>
  </div>
</template>
