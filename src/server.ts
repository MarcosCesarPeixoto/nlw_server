import Fastify from 'fastify'
import cors from '@fastify/cors'
import { appRoutes } from './routes'

const app = Fastify()

app.register(cors) // integrando cors na aplicação, indica q qq api podera acessar,mas deve ser configurado corretamente.
app.register(appRoutes)

app.listen({
    port: 3333,
}).then(() => {
    console.log('HTTP Server Running...')
})
