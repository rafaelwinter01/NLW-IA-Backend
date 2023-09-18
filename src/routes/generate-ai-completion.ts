import { FastifyInstance } from "fastify";
import { z } from "zod";
import { createReadStream } from "node:fs";
import { prisma } from "../lib/prisma";
import { create } from "node:domain";
import { openAI } from "../lib/openai";
import { streamToResponse, OpenAIStream } from "ai";

export async function generateAICompletionRoute(app: FastifyInstance) {
  app.post("/ai/generate", async (request, reply) => {
    const bodySchema = z.object({
      videoId: z.string().uuid(),
      prompt: z.string(),
      temperature: z.number().min(0).max(1).default(0.5),
    });

    const { videoId, prompt, temperature } = bodySchema.parse(request.body);

    const video = await prisma.video.findFirstOrThrow({
      where: {
        id: videoId,
      },
    });

    if (!video.transcript) {
      return reply
        .status(400)
        .send({ error: "Video transcription was not found" });
    }

    const promptMessage = prompt.replace("{transcription}", video.transcript);

    const response = await openAI.chat.completions.create({
      model: "gpt-3.5-turbo-16k",
      temperature,
      messages: [
        {
          role: "user",
          content: promptMessage,
        },
      ],
      stream: true,
    });

    const stream = OpenAIStream(response);
    streamToResponse(stream, reply.raw, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST",
      },
    });
  });
}
