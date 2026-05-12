import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import { initAnalytics } from './services/analytics';
import './styles/crt.css';

initAnalytics();
createApp(App).use(createPinia()).mount('#app');
