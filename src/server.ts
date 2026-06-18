import Fastify from "fastify";
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import { createWriteStream } from "node:fs";
import { mkdir, readFile, rm } from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { extname, join, resolve } from "node:path";
import { randomUUID } from "node:crypto";

type Summary = Record<string, string | number>;
type MemoryJob = { pdf: Buffer; expiresAt: number };
const app = Fastify({ logger: true, bodyLimit: 40 * 1024 * 1024 });
const root = resolve(process.cwd());
const workRoot = join(tmpdir(), "comparar-dfe-dominio");
const python = process.env.PYTHON_BIN || (process.platform === "win32" ? "python" : "python3");
const memoryJobs = new Map<string, MemoryJob>();
const JOB_TTL_MS = 30 * 60 * 1000;

await rm(workRoot, { recursive: true, force: true });
await mkdir(workRoot, { recursive: true });
await app.register(multipart, { limits: { files: 2, fileSize: 40 * 1024 * 1024 } });
await app.register(fastifyStatic, { root: join(root, "public") });

function runComparison(dominio: string, dfe: string, output: string): Promise<Summary> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(python, [join(root, "compare_cli.py"), dominio, dfe, output], {
      cwd: root,
      env: { ...process.env, PYTHONIOENCODING: "utf-8" },
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => (stdout += chunk.toString()));
    child.stderr.on("data", (chunk) => (stderr += chunk.toString()));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) return reject(new Error(stderr.trim() || "Falha ao executar a conferência."));
      try { resolvePromise(JSON.parse(stdout.trim()) as Summary); }
      catch { reject(new Error("O motor de conferência retornou uma resposta inválida.")); }
    });
  });
}

app.get("/health", async () => ({ status: "ok" }));

setInterval(() => {
  const now = Date.now();
  for (const [jobId, job] of memoryJobs) {
    if (job.expiresAt <= now) memoryJobs.delete(jobId);
  }
}, 60_000).unref();

app.post("/api/compare", async (request, reply) => {
  const jobId = randomUUID().replaceAll("-", "");
  const jobDir = join(workRoot, jobId);
  await mkdir(jobDir, { recursive: true });
  let dominioPath = "";
  let dfePath = "";

  try {
    for await (const part of request.parts()) {
      if (part.type !== "file") continue;
      const extension = extname(part.filename).toLowerCase();
      if (part.fieldname === "dominio" && [".pdf", ".xls", ".xlsx"].includes(extension)) {
        dominioPath = join(jobDir, `dominio${extension}`);
        await pipeline(part.file, createWriteStream(dominioPath));
      } else if (part.fieldname === "dfe" && extension === ".xlsx") {
        dfePath = join(jobDir, "dfe.xlsx");
        await pipeline(part.file, createWriteStream(dfePath));
      } else {
        part.file.resume();
      }
    }
    if (!dominioPath || !dfePath) {
      return reply.code(400).send({ message: "Envie o relatório do Domínio e a planilha DFE nos formatos indicados." });
    }
    const outputPath = join(jobDir, "conferencia-dominio-dfe.pdf");
    const summary = await runComparison(dominioPath, dfePath, outputPath);
    const pdf = await readFile(outputPath);
    memoryJobs.set(jobId, { pdf, expiresAt: Date.now() + JOB_TTL_MS });
    await rm(jobDir, { recursive: true, force: true });
    return { jobId, summary };
  } catch (error) {
    await rm(jobDir, { recursive: true, force: true });
    request.log.error(error);
    return reply.code(422).send({ message: error instanceof Error ? error.message : "Não foi possível concluir a conferência." });
  }
});

app.get<{ Params: { jobId: string } }>("/api/download/:jobId", async (request, reply) => {
  const { jobId } = request.params;
  if (!/^[a-f0-9]{32}$/.test(jobId)) return reply.code(404).send();
  const job = memoryJobs.get(jobId);
  if (!job) return reply.code(404).send({ message: "Relatório não encontrado ou já removido." });
  memoryJobs.delete(jobId);
  return reply
    .header("Content-Type", "application/pdf")
    .header("Content-Disposition", 'attachment; filename="conferencia-dominio-dfe.pdf"')
    .send(job.pdf);
});

app.delete<{ Params: { jobId: string } }>("/api/job/:jobId", async (request, reply) => {
  memoryJobs.delete(request.params.jobId);
  return reply.code(204).send();
});

app.setNotFoundHandler((_request, reply) => reply.sendFile("index.html"));
await app.listen({ host: "0.0.0.0", port: Number(process.env.PORT || 8000) });
