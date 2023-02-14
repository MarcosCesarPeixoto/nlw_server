import dayjs from 'dayjs'
import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from "./lib/prisma"

export async function appRoutes(app: FastifyInstance) {
    // app.get('/hello', async () => {
    //     const habits = await prisma.habit.findMany()
        
    //     return habits
    // }),

    app.post('/habits', async (request) => {

        // validando se os parâmeteros recebidos estão corretos
        const createHabitBody = z.object({
            title: z.string(),
            weekDays: z.array(
                z.number().min(0).max(6)
            )
        })

        const { title, weekDays } = createHabitBody.parse(request.body)

        // tratando a data - zerando hora, minuto e segundo
        const today = dayjs().startOf('day').toDate()        
        
        // criando um novo habit (habito)
        await prisma.habit.create({
            data: {
                title,
                created_at: today,
                weekDays: {
                    create: weekDays.map(weekDay => {
                        return {
                            week_day: weekDay,
                        }
                    })
                }
            }
        }) 
    })

    app.get('/day', async (request) => {
        
        const getDayParams = z.object({
            date: z.coerce.date() // vai converter o parâmetro recebido em data
        })

        const { date } = getDayParams.parse(request.query)

        const parsedDate = dayjs(date).startOf('day') 
        const weekDay = parsedDate.get('day')

        console.log(date, weekDay)

        // carregar todos os habitos possiveis do dia e os já completados
        const possibleHabits = await prisma.habit.findMany({
            where: {
                created_at: {
                    // menor ou igual a data informada
                    lte: date,
                },
                weekDays: {
                    // pelo menos um preeenchido
                    some: {
                        week_day: weekDay,
                    }
                }
            }
        })

        // carregar apenas os habitos do dia (da data passada)
        const day = await prisma.day.findUnique({
            where: {
                date: parsedDate.toDate(),
            },
            // incluindo também a busca dos registros em dayHabits com mesma chave (espécie de join)
            include: {
                dayHabits: true,
            }
        })

        // pode vir com registros não completados, aqui filtra somente os ids dos completados no dia
        const completedHabits = day?.dayHabits.map(dayHabit => {
            return dayHabit.habit_id
        })

        return {
            possibleHabits,
            completedHabits
        }

    })

    // rota para completar/não completar um hábito
    app.patch('/habits/:id/toggle', async (request) => {

        const toggleHabitsParams = z.object({

            id: z.string().uuid(),
        })

        const { id } = toggleHabitsParams.parse(request.params) 

        const today = dayjs().startOf('day').toDate() // retirando hora, minutos e segundos

        // procurando uma data que seja igual ao today
        let day = await prisma.day.findUnique({
            where: {
                date: today,
            }    
        })

        // se não encontrar vai criar
        if (!day) {
            day = await prisma.day.create({
                data: {
                    date: today,
                }
            })
        }

        // buscando em dayHabit pra ver se esse dia já tem registro completo
        const dayHabit = await prisma.dayHabit.findUnique({
            where: {
                day_id_habit_id: {
                    day_id: day.id,
                    habit_id: id,
                }
            }
        })

        // se existir, remover a marcação de habito completado
        if (dayHabit) {
            await prisma.dayHabit.delete({
                where: {
                    id: dayHabit.id
                }
            })
        } else {
            // completar o hábito (no dia) - pega o id do parãmetro recebido e o id do dia criado
            await prisma.dayHabit.create({
                data: {
                    day_id: day.id,
                    habit_id: id,
                }
            })
        }
    })

    // resumo - dia, quantos habitos possíveis de serem completados e quantos foram completados
    app.get('/summary', async () => {
        // query mais complexa, internamente serão necessários vários selects
        // necessario escrever o sql na mao: raw sql, no prisma tem a opção queryraw
        // no caso, as instruções aqui serveriam para sqlite

        const summary = await prisma.$queryRaw`
            select 
                D.id, 
                D.date,
                (select 
                    cast(count(*) as float)
                 from day_habits DH
                 where DH.day_id = D.id
                ) as completed,
                (select
                    cast(count(*) as float)
                 from habit_week_days HWD
                 join habits H on H.id = HWD.habit_id
                   
                 where 
                   HWD.week_day = cast(strftime('%w', D.date/1000.0, 'unixepoch') as int)
                   and H.created_at <= D.date
                ) as amount
            from days D
        `
        return summary
    })

}

