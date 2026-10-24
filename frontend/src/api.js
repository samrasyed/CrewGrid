import axios from 'axios'

const api = axios.create({ baseURL: '/api' })

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && localStorage.getItem('token')) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  },
)

export const errMsg = (e) => {
  const d = e?.response?.data?.detail
  if (Array.isArray(d)) return d.map((x) => x.msg).join(', ')
  return d || e?.message || 'Something went wrong'
}

// tiny toast pub/sub, rendered by <Toaster/> in App.jsx
const listeners = new Set()
export const toast = (text, type = 'success') => listeners.forEach((fn) => fn({ id: Math.random(), text, type }))
toast.error = (e) => toast(typeof e === 'string' ? e : errMsg(e), 'error')
export const onToast = (fn) => {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

// cross-component refresh signal (e.g. sidebar project list after creating/joining)
export const bus = new EventTarget()
export const emit = (name) => bus.dispatchEvent(new Event(name))

export const getUser = () => {
  try {
    return JSON.parse(localStorage.getItem('user'))
  } catch {
    return null
  }
}

export const fmtDate = (d) => (d ? new Date(d.length === 10 ? d + 'T00:00:00' : d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '—')

export default api
