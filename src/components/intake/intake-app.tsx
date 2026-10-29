import { useServerFn } from "@tanstack/react-start";
import { useEffect, useId, useState } from "react";
import { deliverBrief } from "@/lib/intake/deliver";
import {
  QUESTIONS,
  briefPlainText,
  chapters,
  displayValue,
  emptyAnswers,
  questionIssue,
  type AnswerMap,
  type Question,
} from "@/lib/intake/questions";

const STORAGE = "nimbus-intake-v3";

type Phase = "form" | "sending" | "done";

function loadDraft(): { index: number; answers: AnswerMap } | null {
  try {
    const raw = sessionStorage.getItem(STORAGE);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { index?: number; answers?: AnswerMap };
    if (!parsed.answers || typeof parsed.index !== "number") return null;
    return { index: parsed.index, answers: { ...emptyAnswers(), ...parsed.answers } };
  } catch {
    return null;
  }
}

const OWNER_ENDPOINT = "https://formsubmit.co/ajax/47ed5e10d0c8f36ac677611728b2d4e7";

type MailResult = "attached" | "text" | "sending" | "failed";

function activationError(message: string): Error | null {
  if (!/activation/i.test(message)) return null;
  return new Error(
    "This website address still needs a one-time email activation. Open the FormSubmit message in rawle@nimbus-core.com, click Activate Form, then send the brief again.",
  );
}

async function readFormSubmit(response: Response): Promise<void> {
  const text = await response.text();
  let payload: { success?: boolean | string; message?: string } = {};
  try {
    payload = JSON.parse(text) as { success?: boolean | string; message?: string };
  } catch {
    payload = { message: text.replace(/\s+/g, " ").slice(0, 180) };
  }
  const ok = payload.success === true || payload.success === "true";
  if (response.ok && ok) return;
  const message = payload.message || "The email could not be sent.";
  throw activationError(message) ?? new Error(message);
}

async function emailBrief(answers: AnswerMap, pdfBase64: string, filename: string): Promise<MailResult> {
  const fields = {
    _subject: `Project brief — ${answers.projectName.trim()}`,
    _captcha: "false",
    _template: "box",
    _replyto: answers.email.trim(),
    name: answers.name.trim(),
    email: answers.email.trim(),
    project: answers.projectName.trim(),
    project_id: answers.projectId.trim(),
    message: briefPlainText(answers),
  };

  const bytes = Uint8Array.from(atob(pdfBase64), (char) => char.charCodeAt(0));
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.set(key, value);
  form.append("attachment", new Blob([bytes], { type: "application/pdf" }), filename);

  try {
    const response = await fetch(OWNER_ENDPOINT, {
      method: "POST",
      headers: { Accept: "application/json" },
      body: form,
      signal: AbortSignal.timeout(20000),
    });
    await readFormSubmit(response);
    return "attached";
  } catch (error) {
    if (activationError(error instanceof Error ? error.message : "")) throw error;
    const response = await fetch(OWNER_ENDPOINT, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify(fields),
      signal: AbortSignal.timeout(20000),
    });
    await readFormSubmit(response);
    return "text";
  }
}

function pdfObjectUrl(base64: string): string {
  const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
  return URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
}

export function IntakeApp() {
  const send = useServerFn(deliverBrief);
  const [answers, setAnswers] = useState<AnswerMap>(emptyAnswers);
  const [index, setIndex] = useState(0);
  const [attempted, setAttempted] = useState(false);
  const [phase, setPhase] = useState<Phase>("form");
  const [mailMode, setMailMode] = useState<MailResult>("failed");
  const [mailNote, setMailNote] = useState("");
  const [file, setFile] = useState<{ name: string; pdf: string } | null>(null);
  const [sendError, setSendError] = useState("");

  useEffect(() => {
    const draft = loadDraft();
    if (draft) {
      setAnswers(draft.answers);
      setIndex(Math.min(draft.index, QUESTIONS.length));
    }
  }, []);

  useEffect(() => {
    if (phase !== "form") return;
    sessionStorage.setItem(STORAGE, JSON.stringify({ index, answers }));
  }, [index, answers, phase]);

  useEffect(() => {
    const field = document.getElementById("intake-field");
    if (field instanceof HTMLElement) field.focus();
  }, [index, phase]);

  const reviewing = index >= QUESTIONS.length;
  const question = QUESTIONS[index];
  const issue = question ? questionIssue(question.id, answers) : null;
  const total = QUESTIONS.length;

  function setAnswer(id: string, value: string) {
    setAnswers((current) => ({ ...current, [id]: value }));
    setAttempted(false);
  }

  function goNext() {
    if (reviewing) return;
    if (issue) {
      setAttempted(true);
      return;
    }
    setAttempted(false);
    setIndex((current) => current + 1);
  }

  function goBack() {
    setAttempted(false);
    setIndex((current) => Math.max(0, current - 1));
  }

  async function submit() {
    if (answers.confirm !== "yes") {
      setAttempted(true);
      return;
    }
    setPhase("sending");
    setSendError("");
    try {
      const result = await send({ data: answers });
      setFile({ name: result.filename, pdf: result.pdfBase64 });
      setMailMode("sending");
      setMailNote("");
      sessionStorage.removeItem(STORAGE);
      setPhase("done");
      try {
        const mode = await emailBrief(answers, result.pdfBase64, result.filename);
        setMailMode(mode);
        setMailNote(
          mode === "text"
            ? "The email service would not take the PDF, so the email has the answers in writing. Save the PDF below."
            : "",
        );
      } catch (error) {
        setMailMode("failed");
        setMailNote(error instanceof Error ? error.message : "The email could not be sent.");
      }
    } catch (error) {
      setSendError(error instanceof Error ? error.message : "The brief could not be sent.");
      setPhase("form");
    }
  }

  function restart() {
    setAnswers(emptyAnswers());
    setIndex(0);
    setAttempted(false);
    setPhase("form");
    setFile(null);
    setMailMode("failed");
    setMailNote("");
    sessionStorage.removeItem(STORAGE);
  }

  return (
    <div className="min-h-screen bg-paper text-ink">
      <div className="brand-bar" />
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-5 py-4">
          <a href="https://nimbus-core.com/" className="flex items-center" aria-label="NimbusCore home">
            <img src="/brand/logo.png" alt="NimbusCore" className="h-10 w-auto" />
          </a>
          <p className="text-xs font-medium text-muted">Project intake</p>
        </div>
        <div className="h-1 bg-line" aria-hidden>
          <div
            className="h-1 bg-accent transition-all duration-200"
            style={{ width: `${Math.min(100, Math.round((Math.min(index, total) / total) * 100))}%` }}
          />
        </div>
      </header>

      <div className="mx-auto grid max-w-5xl gap-10 px-5 py-8 md:grid-cols-[240px_minmax(0,1fr)] md:py-12">
        <aside className="hidden md:block">
          <ol className="sticky top-8 space-y-2">
            {chapters().map((chapter) => {
              const state = chapterState(chapter.name, index);
              return (
                <li key={chapter.name}>
                  <button
                    type="button"
                    disabled={state === "later"}
                    onClick={() => {
                      if (state === "later") return;
                      setAttempted(false);
                      setIndex(chapter.start);
                    }}
                    className={
                      "flex w-full items-center gap-2 py-1 text-left text-sm " +
                      (state === "now" ? "font-semibold text-ink" : "text-muted")
                    }
                  >
                    <span
                      className={
                        "size-1.5 rounded-full " + (state === "later" ? "bg-line" : "bg-accent")
                      }
                      aria-hidden
                    />
                    {chapter.name}
                  </button>
                </li>
              );
            })}
            <li>
              <p className={"py-1 text-sm " + (reviewing ? "font-semibold text-ink" : "text-muted")}>
                <span className={"mr-2 inline-block size-1.5 rounded-full " + (reviewing ? "bg-accent" : "bg-line")} />
                Send
              </p>
            </li>
          </ol>
        </aside>

        <main className="mx-auto w-full max-w-xl">
          {phase === "done" && file ? (
            <Done
              file={file}
              mailMode={mailMode}
              mailNote={mailNote}
              onRestart={restart}
            />
          ) : phase === "sending" ? (
            <p className="font-sans text-4xl font-semibold leading-tight tracking-tight text-navy">Preparing the brief…</p>
          ) : reviewing ? (
            <Review
              answers={answers}
              attempted={attempted}
              sendError={sendError}
              onEdit={(next) => {
                setAttempted(false);
                setIndex(next);
              }}
              onConfirm={(yes) => setAnswer("confirm", yes ? "yes" : "")}
              onBack={goBack}
              onSubmit={() => void submit()}
            />
          ) : (
            question && (
              <QuestionStep
                question={question}
                index={index}
                total={total}
                answers={answers}
                issue={attempted ? issue : null}
                onChange={setAnswer}
                onBack={index > 0 ? goBack : undefined}
                onNext={goNext}
              />
            )
          )}
        </main>
      </div>
    </div>
  );
}

function chapterState(name: string, index: number): "done" | "now" | "later" {
  const indexes = QUESTIONS.flatMap((question, itemIndex) =>
    question.chapter === name ? [itemIndex] : [],
  );
  const first = indexes[0] ?? 0;
  const last = indexes[indexes.length - 1] ?? 0;
  if (index > last) return "done";
  if (index >= first) return "now";
  return "later";
}

function QuestionStep({
  question,
  index,
  total,
  answers,
  issue,
  onChange,
  onBack,
  onNext,
}: {
  question: Question;
  index: number;
  total: number;
  answers: AnswerMap;
  issue: string | null;
  onChange: (id: string, value: string) => void;
  onBack?: () => void;
  onNext: () => void;
}) {
  const fieldId = useId();
  const value = answers[question.id] ?? "";
  const min = question.min ?? 0;
  const remaining = question.kind === "textarea" ? Math.max(0, min - value.trim().length) : 0;

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onNext();
      }}
    >
      <p className="text-sm text-muted">
        {question.chapter}
        <span className="px-2 text-line">/</span>
        {index + 1} of {total}
      </p>
      <h1 className="mt-3 font-sans text-4xl font-semibold leading-tight tracking-tight text-navy md:text-5xl">{question.prompt}</h1>
      <p className="mt-3 max-w-lg text-base leading-relaxed text-muted">{question.hint}</p>

      <div className="mt-8">
        <Field
          question={question}
          fieldId={fieldId}
          value={value}
          answers={answers}
          invalid={Boolean(issue)}
          onChange={onChange}
        />
      </div>

      {remaining > 0 && question.kind === "textarea" && value.trim().length > 0 && (
        <p className="mt-3 text-sm text-muted">{remaining} more characters to continue.</p>
      )}
      {issue && (
        <p className="mt-3 text-sm text-danger" role="alert">
          {issue}
        </p>
      )}

      <div className="mt-8 flex items-center gap-3">
        {onBack && (
          <button type="button" onClick={onBack} className="h-12 px-3 text-sm font-medium text-muted">
            Back
          </button>
        )}
        <button
          type="submit"
          className="h-12 rounded-md bg-accent px-6 text-sm font-semibold text-accent-ink shadow-sm"
        >
          Continue
        </button>
      </div>
    </form>
  );
}

function Field({
  question,
  fieldId,
  value,
  answers,
  invalid,
  onChange,
}: {
  question: Question;
  fieldId: string;
  value: string;
  answers: AnswerMap;
  invalid: boolean;
  onChange: (id: string, value: string) => void;
}) {
  const control =
    "w-full rounded-md border bg-surface px-4 py-3 text-base text-ink placeholder:text-muted " +
    (invalid ? "border-danger" : "border-line");

  if (question.kind === "choice" && question.options) {
    return (
      <div className="grid gap-2" role="radiogroup" aria-label={question.prompt} id="intake-field" tabIndex={-1}>
        {question.options.map((option) => {
          const selected = value === option;
          return (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(question.id, option)}
              className={
                "min-h-12 rounded-md border px-4 py-3 text-left text-base " +
                (selected ? "border-accent bg-tint font-medium" : "border-line bg-surface")
              }
            >
              {option}
            </button>
          );
        })}
      </div>
    );
  }

  if (question.kind === "multi" && question.options) {
    const picked = new Set(value.split("|").filter(Boolean));
    return (
      <div className="grid gap-2" id="intake-field" tabIndex={-1}>
        {question.options.map((option) => {
          const selected = picked.has(option);
          return (
            <button
              key={option}
              type="button"
              aria-pressed={selected}
              onClick={() => {
                const next = new Set(picked);
                if (option === "None") {
                  onChange(question.id, selected ? "" : "None");
                  return;
                }
                next.delete("None");
                if (selected) next.delete(option);
                else next.add(option);
                onChange(question.id, [...next].join("|"));
              }}
              className={
                "min-h-12 rounded-md border px-4 py-3 text-left text-base " +
                (selected ? "border-accent bg-tint font-medium" : "border-line bg-surface")
              }
            >
              {option}
            </button>
          );
        })}
      </div>
    );
  }

  if (question.kind === "website") {
    const none = answers.websiteNone === "yes";
    return (
      <div className="grid gap-3">
        <label className="sr-only" htmlFor={fieldId}>
          Website
        </label>
        <input
          id="intake-field"
          className={control + (none ? " opacity-50" : "")}
          value={none ? "" : value}
          disabled={none}
          placeholder={question.placeholder}
          inputMode="url"
          autoComplete="url"
          onChange={(event) => onChange(question.id, event.target.value)}
        />
        <label className="flex min-h-12 items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={none}
            onChange={(event) => onChange("websiteNone", event.target.checked ? "yes" : "")}
          />
          We don't have a public website
        </label>
      </div>
    );
  }

  if (question.kind === "textarea") {
    return (
      <>
        <label className="sr-only" htmlFor={fieldId}>
          {question.prompt}
        </label>
        <textarea
          id="intake-field"
          className={control + " min-h-36 resize-y leading-relaxed"}
          value={value}
          placeholder={question.placeholder}
          onChange={(event) => onChange(question.id, event.target.value)}
        />
      </>
    );
  }

  if (question.kind === "date") {
    return (
      <>
        <label className="sr-only" htmlFor={fieldId}>
          {question.prompt}
        </label>
        <input
          id="intake-field"
          className={control + " max-w-xs"}
          type="date"
          value={value}
          onChange={(event) => onChange(question.id, event.target.value)}
        />
      </>
    );
  }

  const type = question.kind === "email" ? "email" : question.kind === "tel" ? "tel" : "text";
  return (
    <>
      <label className="sr-only" htmlFor={fieldId}>
        {question.prompt}
      </label>
      <input
        id="intake-field"
        className={control}
        type={type}
        value={value}
        placeholder={question.placeholder}
        autoComplete={question.autoComplete}
        onChange={(event) => onChange(question.id, event.target.value)}
      />
    </>
  );
}

function Review({
  answers,
  attempted,
  sendError,
  onEdit,
  onConfirm,
  onBack,
  onSubmit,
}: {
  answers: AnswerMap;
  attempted: boolean;
  sendError: string;
  onEdit: (index: number) => void;
  onConfirm: (yes: boolean) => void;
  onBack: () => void;
  onSubmit: () => void;
}) {
  const confirmed = answers.confirm === "yes";
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <p className="text-sm text-muted">Send</p>
      <h1 className="mt-3 font-sans text-4xl font-semibold leading-tight tracking-tight text-navy md:text-5xl">Review the brief</h1>
      <p className="mt-3 text-base leading-relaxed text-muted">
        Nothing is sent until you confirm. We'll email a PDF of these answers to the Nimbus Core team.
      </p>
      <ul className="mt-8 divide-y divide-line border-y border-line">
        {QUESTIONS.map((question, questionIndex) => (
          <li key={question.id} className="flex items-start justify-between gap-4 py-3">
            <div>
              <p className="text-xs text-muted">{question.chapter}</p>
              <p className="mt-1 text-sm font-medium">{displayValue(question.id, answers)}</p>
            </div>
            <button
              type="button"
              onClick={() => onEdit(questionIndex)}
              className="shrink-0 py-1 text-sm font-medium text-accent"
            >
              Edit
            </button>
          </li>
        ))}
      </ul>
      <label className="mt-6 flex min-h-12 items-start gap-3 text-sm leading-relaxed">
        <input
          id="intake-field"
          type="checkbox"
          className="mt-1"
          checked={confirmed}
          onChange={(event) => onConfirm(event.target.checked)}
        />
        I confirm these details are accurate, and Nimbus Core may contact me about this project.
      </label>
      {attempted && !confirmed && (
        <p className="mt-3 text-sm text-danger" role="alert">
          Confirm the brief before it can be sent.
        </p>
      )}
      {sendError && (
        <p className="mt-3 text-sm text-danger" role="alert">
          {sendError}
        </p>
      )}
      <div className="mt-8 flex items-center gap-3">
        <button type="button" onClick={onBack} className="h-12 px-3 text-sm font-medium text-muted">
          Back
        </button>
        <button type="submit" className="h-12 rounded-md bg-accent px-6 text-sm font-semibold text-accent-ink shadow-sm">
          Email the PDF
        </button>
      </div>
    </form>
  );
}

function Done({
  file,
  mailMode,
  mailNote,
  onRestart,
}: {
  file: { name: string; pdf: string };
  mailMode: MailResult;
  mailNote: string;
  onRestart: () => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [pdfError, setPdfError] = useState("");

  useEffect(() => {
    try {
      const next = pdfObjectUrl(file.pdf);
      setUrl(next);
      return () => URL.revokeObjectURL(next);
    } catch {
      setPdfError("The PDF could not be opened in this browser.");
      return undefined;
    }
  }, [file.pdf]);

  const heading =
    mailMode === "sending"
      ? "Your PDF is ready."
      : mailMode === "attached"
        ? "The brief is on its way."
        : mailMode === "text"
          ? "The answers were emailed."
          : "Your PDF is ready.";
  const detail =
    mailMode === "sending"
      ? "Sending the email now. Download the PDF only if you want a copy."
      : mailMode === "attached"
        ? "A PDF of this project brief was emailed to the Nimbus Core team. Download a copy only if you want one."
        : mailMode === "text"
          ? "Nimbus Core has the written brief. Download the PDF if you want a copy on this device."
          : "The email did not go through. Download the PDF if you want to send it yourself.";

  return (
    <div>
      <p className="text-sm text-muted">Received</p>
      <h1 className="mt-3 font-sans text-4xl font-semibold leading-tight tracking-tight text-navy md:text-5xl">
        {heading}
      </h1>
      <p className="mt-4 max-w-lg text-base leading-relaxed text-muted">{detail}</p>
      {mailNote && <p className="mt-3 max-w-lg text-sm text-muted">{mailNote}</p>}
      {pdfError && (
        <p className="mt-3 text-sm text-danger" role="alert">
          {pdfError}
        </p>
      )}
      {url && (
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <a
            href={url}
            download={file.name}
            className="inline-flex h-12 items-center rounded-md bg-accent px-6 text-sm font-semibold text-accent-ink shadow-sm"
          >
            Download PDF
          </a>
          <a href={url} target="_blank" rel="noopener" className="inline-flex h-12 items-center px-3 text-sm font-medium text-muted">
            Open PDF
          </a>
        </div>
      )}
      <button type="button" onClick={onRestart} className="mt-4 h-12 px-3 text-sm font-medium text-muted">
        Start another brief
      </button>
    </div>
  );
}
