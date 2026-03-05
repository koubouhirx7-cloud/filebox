const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const docs = await prisma.document.findMany({
        select: { id: true, filename: true, isRegisteredToFreee: true },
        orderBy: { createdAt: 'desc' },
        take: 10
    });
    console.log(docs);
}

main()
    .then(() => prisma.$disconnect())
    .catch(e => {
        console.error(e);
        prisma.$disconnect();
    });
