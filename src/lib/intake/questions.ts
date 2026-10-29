export type AnswerMap = Record<string, string>;

export type QuestionKind = "text" | "email" | "tel" | "textarea" | "choice" | "website" | "multi" | "date";

export type Question = {
  id: string;
  chapter: string;
  prompt: string;
  hint: string;
  kind: QuestionKind;
  placeholder?: string;
  options?: string[];
  min?: number;
  autoComplete?: string;
};

export const QUESTIONS: Question[] = [
  {
    id: "name",
    chapter: "Your contact details",
    prompt: "Name?",
    hint: "Who should we consider as the project manager(s)?",
    kind: "text",
    autoComplete: "name",
  },
  {
    id: "email",
    chapter: "Your contact details",
    prompt: "Email?",
    hint: "Your email please!",
    kind: "email",
    autoComplete: "email",
  },
  {
    id: "projectName",
    chapter: "Project Details",
    prompt: "What is the project name?",
    hint: "When we communicate regarding a project, we will reference it with this name.",
    kind: "text",
    placeholder: "RCA - Retina Associates of Earth - 8 Doc P+ & ICP - 6.4.26",
  },
  {
    id: "projectId",
    chapter: "Project Details",
    prompt: "What is the project ID?",
    hint: "A unique ID we can use for billing purposes.",
    kind: "text",
    placeholder: "PR-047691",
  },
  {
    id: "sourceSystems",
    chapter: "Project Details",
    prompt: "What system(s) are they coming from?",
    hint: "ModMed, EyeMD, Nextgen, Medflow, Compulink",
    kind: "text",
  },
  {
    id: "products",
    chapter: "Project Details",
    prompt: "What products did they purchase?",
    hint: "Choose one or more.",
    kind: "multi",
    options: ["Practice+", "IntelleChartPro", "TouchMD", "NexCloud"],
  },
  {
    id: "goLive",
    chapter: "Project Details",
    prompt: "When do you need this live?",
    hint: "A target day is enough. It can move later.",
    kind: "date",
  },
  {
    id: "services",
    chapter: "Project Details",
    prompt: "What services are they looking for us to render?",
    hint: "PM Data (Patient Demographics, Appointments, Providers transfer), ICP Discrete (field-to-field opthalmology data conversion and transfer), Documents (files and images import transfer)",
    kind: "multi",
    options: ["PM Data", "ICP Discrete", "Documents & Images"],
  },
  {
    id: "providers",
    chapter: "Project Details",
    prompt: "How many providers (MDs/ODs/DOs) does the clinic plan to employ?",
    hint: "We use this to gauge the amount of data we'll be processing.",
    kind: "text",
  },
  {
    id: "tsrName",
    chapter: "Technical Service Representative(s)",
    prompt: "Who is the TSR on the project?",
    hint: "Who should we consider as the project manager(s)?",
    kind: "text",
  },
  {
    id: "tsrEmail",
    chapter: "Technical Service Representative(s)",
    prompt: "What's their email?",
    hint: "Will use to get mappable values and target delivery of the various dataset.",
    kind: "email",
  },
];

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DOMAIN = /^(https?:\/\/)?([a-z0-9-]+\.)+[a-z]{2,}(\/\S*)?$/i;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function emptyAnswers(): AnswerMap {
  return { websiteNone: "", confirm: "" };
}

function digits(value: string): number {
  return value.replace(/\D/g, "").length;
}

export function formatAnswerDate(value: string): string {
  const match = ISO_DATE.exec(value.trim());
  if (!match) return value.trim();
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  if (Number.isNaN(date.getTime())) return value.trim();
  return date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

export function questionIssue(id: string, answers: AnswerMap): string | null {
  const value = (answers[id] ?? "").trim();
  const question = QUESTIONS.find((item) => item.id === id);
  if (!question) return "That question is missing.";

  if (question.kind === "email") {
    return EMAIL.test(value) ? null : "Enter a real work email.";
  }
  if (question.kind === "tel") {
    return digits(value) >= 10 ? null : "Enter a phone number with at least 10 digits.";
  }
  if (question.kind === "date") {
    const match = ISO_DATE.exec(value);
    if (!match) return "Choose a date to continue.";
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    const real =
      date.getFullYear() === Number(match[1]) &&
      date.getMonth() === Number(match[2]) - 1 &&
      date.getDate() === Number(match[3]);
    return real ? null : "Choose a date to continue.";
  }
  if (question.kind === "website") {
    if (answers.websiteNone === "yes") return null;
    return DOMAIN.test(value) ? null : "Enter a website, or choose that you don't have one.";
  }
  if (question.kind === "choice") {
    return question.options?.includes(value) ? null : "Choose one to continue.";
  }
  if (question.kind === "multi") {
    const picked = value.split("|").map((item) => item.trim()).filter(Boolean);
    const allowed = new Set(question.options ?? []);
    if (picked.length === 0 || picked.some((item) => !allowed.has(item))) return "Select at least one.";
    return null;
  }
  if (question.kind === "textarea") {
    const min = question.min ?? 1;
    if (value.length >= min) return null;
    const left = min - value.length;
    return `Add ${left} more character${left === 1 ? "" : "s"} so we have enough to act on.`;
  }
  return value.length >= 1 ? null : "This needs an answer before you can continue.";
}

export function isAnswered(id: string, answers: AnswerMap): boolean {
  return questionIssue(id, answers) === null;
}

export function chapters(): { name: string; start: number }[] {
  const list: { name: string; start: number }[] = [];
  QUESTIONS.forEach((question, index) => {
    if (!list.some((item) => item.name === question.chapter)) {
      list.push({ name: question.chapter, start: index });
    }
  });
  return list;
}

export function displayValue(id: string, answers: AnswerMap): string {
  const question = QUESTIONS.find((item) => item.id === id);
  if (id === "website" && answers.websiteNone === "yes") return "No public website";
  if (question?.kind === "multi") return (answers[id] ?? "").split("|").filter(Boolean).join(", ");
  if (question?.kind === "date") return formatAnswerDate(answers[id] ?? "");
  return (answers[id] ?? "").trim();
}

export function briefLines(answers: AnswerMap): { chapter: string; label: string; value: string }[] {
  return QUESTIONS.map((question) => ({
    chapter: question.chapter,
    label: question.prompt.replace(/\?$/, ""),
    value: displayValue(question.id, answers),
  }));
}

export function briefPlainText(answers: AnswerMap): string {
  const lines = briefLines(answers).map((row) => `${row.chapter} — ${row.label}\n${row.value}`);
  return ["NimbusCore client project brief", "", ...lines].join("\n\n");
}
