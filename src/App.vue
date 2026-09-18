<script setup lang="ts">
// import HelloWorld from './components/HelloWorld.vue'
import { 
  RouterView,
  useRouter
 } from 'vue-router'
import { onMounted, ref } from 'vue';
import { useAuth } from './composables/useAuth';

const router = useRouter();
const { 
  user, 
  isAuthReady, 
  isLoggedIn, 
  initializeAuth, 
  signOut 
} = useAuth();
const isSignOut = ref(false)
const isSignOutError = ref('')


onMounted(() =>{
  initializeAuth()
})

async function handleSignOut() {
  if(isSignOut.value){
    return
  }
  isSignOut.value = true
  isSignOutError.value = ''
  try {
    await signOut()
    await router.push({
      name: "signup"
    })
  } catch (error) {
    isSignOutError.value = "ログアウトできませんでした。もう一度お試しください。"
    console.error("ログアウト失敗:", error);
  }finally{
    isSignOut.value = false
  }
}

</script>

<template>
  <!-- ユーザー認証用のHeader -->
   <!-- <template>は、HTMLの中身が表示されないテンプレ保管用要素。　-->
  <header>
    <div>
      <b>AnyThink</b>
    </div>
    <p v-if="!isAuthReady">認証状況を確認中...</p>

    <RouterLink 
      v-else-if="!user"
      type="button"
      to="/signin"
    >
      ログイン
    </RouterLink>
    <button 
      v-else
      type="button"
      :disabled="isSignOut"
      @click="handleSignOut"
    >
     {{ isSignOut ? "ログアウト中..." : "ログアウト" }}
    </button>
    <p
      v-if="isSignOutError"
      role="alert"
    >
      {{ isSignOutError }}
    </p>
  </header>
  <!-- ページの表示欄 -->
  <RouterView />
</template>
