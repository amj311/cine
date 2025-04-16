import axios from 'axios'

export const baseURL = window.location.href.includes('localhost:517') ? 'http://localhost:5000/api' : '/api'

const api = axios.create({
	baseURL,
})

export default api;
