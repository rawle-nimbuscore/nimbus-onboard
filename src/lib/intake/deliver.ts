import { createServerFn } from "@tanstack/react-start";
import { QUESTIONS, questionIssue, type AnswerMap } from "./questions";

function asAnswers(input: unknown): AnswerMap {
  if (!input || typeof input !== "object") {
    throw new Error("The brief was empty.");
  }
  const source = input as Record<string, unknown>;
  const answers: AnswerMap = {};
  for (const [key, value] of Object.entries(source)) {
    if (typeof value === "string") answers[key] = value;
  }
  for (const question of QUESTIONS) {
    const issue = questionIssue(question.id, answers);
    if (issue) throw new Error(issue);
  }
  if (answers.confirm !== "yes") throw new Error("Confirm the brief before sending.");
  return answers;
}

export const deliverBrief = createServerFn({ method: "POST" })
  .validator((input: unknown) => asAnswers(input))
  .handler(async ({ data }) => {
    const { buildBriefPdf, briefFilename } = await import("./pdf.server");
    const pdf = await buildBriefPdf(data);
    return {
      filename: briefFilename(data),
      pdfBase64: Buffer.from(pdf).toString("base64"),
    };
  });
