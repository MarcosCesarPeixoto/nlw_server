import { PrismaClient} from '@prisma/client'

// colocando pra fazer log 
export const prisma = new PrismaClient({
    log: ['query']
})