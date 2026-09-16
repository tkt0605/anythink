import {createRouter, createWebHistory} from 'vue-router'
import Home from '../views/Home.vue'

const routes = createRouter({
    history: createWebHistory(),
    routes: [
        {path: '/', component: Home},
    ]
})

export default routes