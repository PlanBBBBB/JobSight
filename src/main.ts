import { createApp } from 'vue'
import naive from 'naive-ui'
import App from './App.vue'

// 全局样式重置
import './styles/global.css'

const app = createApp(App)
app.use(naive)
app.mount('#app')
