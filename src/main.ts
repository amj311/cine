import './assets/main.scss'

import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router/router'

const app = createApp(App)

app.use(createPinia())
app.use(router)

app.mount('#app')


const canvas = document.createElement('canvas');
canvas.width = 64;
canvas.height = 64;
const ctx = canvas.getContext('2d');

if (ctx) {
	ctx.font = '55px serif';
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.fillText('🍿', canvas.width / 2, canvas.height / 2);

	const link = document.createElement('link');
	link.rel = 'icon';
	link.href = canvas.toDataURL();
	document.head.appendChild(link);
}
