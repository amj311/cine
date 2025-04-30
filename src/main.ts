import 'primeflex/primeflex.css'
import 'primeicons/primeicons.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router/router'
import PrimeVue from 'primevue/config';
import Aura from '@primeuix/themes/aura';
import { definePreset } from '@primeuix/themes'
import './assets/main.scss'

import ConfirmationService from 'primevue/confirmationservice';
import ToastService from 'primevue/toastservice';

const app = createApp(App)

app.use(createPinia())
app.use(router)


const MyPreset = definePreset(Aura, {
	semantic: {
		colorScheme: {
			light: {
				formField: {
					hoverBorderColor: '{primary.color}'
				}
			},
			dark: {
				formField: {
					hoverBorderColor: '{primary.color}'
				}
			}
		}
	}
});


app.use(PrimeVue, {
	// Default theme configuration
	theme: {
		preset: Aura,
		options: {
			prefix: 'p',
			darkModeSelector: '.dark-app', // always dark mode
			cssLayer: false,
			ripple: true,
		}
	}
});

app.use(ConfirmationService);
app.use(ToastService);

app.mount('#app')


// const canvas = document.createElement('canvas');
// canvas.width = 64;
// canvas.height = 64;
// const ctx = canvas.getContext('2d');

// if (ctx) {
// 	ctx.font = '55px serif';
// 	ctx.textAlign = 'center';
// 	ctx.textBaseline = 'middle';
// 	ctx.fillText('🎞️', canvas.width / 2, canvas.height / 2);

// 	const link = document.createElement('link');
// 	link.rel = 'icon';
// 	link.href = canvas.toDataURL();
// 	document.head.appendChild(link);
// }
