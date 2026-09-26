/** Faux serveur OpenAI des tests bout-en-bout (voir tests/support/mock-openai-server.ts). */
import { startMockOpenAi } from "../tests/support/mock-openai-server";

const port = Number(process.env.MOCK_OPENAI_PORT ?? 4010);
void startMockOpenAi(port).then(() => console.log(`mock-openai sur ${port}`));
