import { createGameServer } from './server.js';

const port = Number(process.env.PORT ?? 3001);
const server = createGameServer();
await server.listen(port);
console.log(`True Mask 서버 실행 중: http://localhost:${port}`);
