import { ref, computed } from "vue";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

const user = ref<User | null>(null)
const isAuthReady = ref(false)

let isInitialized = false

export function useAuth() {
    const isLoggedIn = computed(() => user.value !== null)
    async function initializeAuth() {
        if(isInitialized) return

        isInitialized = true

        supabase.auth.onAuthStateChange((_event, session) => {
            user.value = session?.user ?? null
            isAuthReady.value = true
        })

        const {data, error} = await supabase.auth.getSession()

        if(error){
            console.error('セッション取得失敗:', error)
        }else if(data){
            user.value = data.session?.user ?? null
        }

        isAuthReady.value = true
    }
    async function signOut() {
        const {error} = await supabase.auth.signOut({
            scope: 'local',
        })
        if(error){
            throw error
        }
        user.value = null
    }

    return {
        user,
        isAuthReady,
        isLoggedIn,
        initializeAuth,
        signOut,
    }
}