/**
 * Question bank MCP server (tools and prompts), shared by the two entry points:
 * - local stdio: src/mcp/server.ts (`npm run mcp`), owner from MCP_OWNER_EMAIL or the only account, images by local path or base64;
 * - remote HTTP: src/app/api/mcp/route.ts, owner from the API key (Authorization: Bearer rqb_…), images as base64 only.
 *
 * Lets whichever agent the user is working in (Claude Code, Claude Desktop, Cursor…) put questions into the bank, however
 * the user wants them made (transcribed from their material, adapted, or newly written): the agent does the work;
 * this server supplies the institution's context, validates and saves (images are copied into the bank's storage).
 * Questions added here are stored with origin "AI" and stay "pending review" until a teacher approves them in the bank.
 *
 * Like src/app, this is a thin entry layer: it calls modules' server.ts functions and never touches the database directly.
 * Modules are imported inside createBankServer so the stdio entry can set cwd and env first.
 */
import path from "path";
import os from "os";
import { existsSync, readFileSync } from "fs";
import { readFile, stat } from "fs/promises";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { importQuestionsPrompt, INSTRUCTIONS, writeQuestionsPrompt } from "./guide";

/** Institution rules (layer 2–3), read on every call so edits apply without restarting. Relative to the repo root (cwd). */
const institutionRules = () => {
  const f = path.join(process.cwd(), "src/mcp/rules/institution.md");
  return existsSync(f) ? readFileSync(f, "utf8").trim() : "";
};

const IMAGE_MAX = 5 * 1024 * 1024;

/**
 * Image bytes from a local path or base64 (data: URL prefix allowed). Format and size are checked again by the bank;
 * here only what the bank can't know: the file exists, and we don't read something huge into memory.
 */
async function imageBytes(img: { path?: string; base64?: string } | undefined, label: string, localFiles: boolean) {
  if (!img) return null;
  const at = label ? `${label}: ` : "";
  if (img.path && !localFiles) throw new Error(`${at}image.path works only with the local server; send the image as base64.`);
  if (img.path) {
    const p = path.resolve(img.path.replace(/^~(?=$|\/)/, os.homedir()));
    const st = await stat(p).catch(() => null);
    if (!st?.isFile()) throw new Error(`${at}image file not found: ${p}`);
    if (st.size > IMAGE_MAX) throw new Error(`${at}image is larger than 5 MB.`);
    return new Uint8Array(await readFile(p));
  }
  if (img.base64) {
    const b = Buffer.from(img.base64.replace(/^data:[^;]+;base64,/, ""), "base64");
    if (!b.length) throw new Error(`${at}image base64 is empty or invalid.`);
    return new Uint8Array(b);
  }
  throw new Error(`${at}image needs path or base64.`);
}

/** Tool result as JSON text; module errors (AppError) go back to the agent as readable messages so it can fix and retry. */
async function run(fn: () => Promise<unknown>) {
  try {
    const data = await fn();
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { content: [{ type: "text" as const, text: `Error: ${message}` }], isError: true };
  }
}


export type BankServerOptions = {
  /** Institution id, resolved on every call (re-seeding the database gives the account a new id) */
  ownerId: () => Promise<string>;
  /** App base URL for review links */
  appUrl: string;
  /** true: image.path reads the local disk (stdio only). Remote callers must send base64 */
  localFiles: boolean;
};

export async function createBankServer(opts: BankServerOptions) {
  const { institutionName } = await import("@/modules/identity/server");
  const qb = await import("@/modules/question-bank");
  const { bankSummary, createWrittenItems, listItems, similarForDrafts } = await import("@/modules/question-bank/server");
  const { curriculumOutcomes } = await import("@/modules/curriculum/server");
  const { mergeSubjectNames, normGrade, subjectKey } = await import("@/modules/curriculum");
  const { listCourses } = await import("@/modules/schedule/server");
  const { COGNITIVE_LEVELS, COGNITIVE_HINTS } = await import("@/shared/cognitive");

  const ownerId = opts.ownerId;
  const reviewUrl = `${opts.appUrl.replace(/\/$/, "")}/kurum/soru-havuzu?durum=onay`;

  /** Subjects and grades the institution already uses (courses, curriculum, bank, defaults): what agents may save under. */
  async function known(id: string) {
    const [summary, courses, outcomes] = await Promise.all([bankSummary(id), listCourses(id), curriculumOutcomes(id)]);
    const subjects = mergeSubjectNames(
      courses.filter((c) => c.kind !== "STUDY").map((c) => c.name),
      summary.subjects,
      [...new Set(outcomes.map((o) => o.subject))],
      qb.DEFAULT_SUBJECTS,
    );
    const grades = [...new Set([...qb.GRADES, ...outcomes.map((o) => o.grade)])];
    return { summary, outcomes, subjects, grades };
  }

  const server = new McpServer({ name: "rea-question-bank", version: "0.4.0" }, { instructions: INSTRUCTIONS });

  server.registerTool(
    "get_bank_context",
    {
      title: "Question bank context",
      description:
        "Call this first; without arguments it lists subjects and grades to offer the user. Returns the institution's subjects, grades, question types with exact answer formats, difficulty and cognitive levels, " +
        "and curriculum topics / learning outcomes. Pass subject (and grade) to get that curriculum's units, topics and outcomes. " +
        "Use subject and topic names exactly as returned so questions link to the curriculum. Follow institutionRules in the result. " +
        "Curriculum and bank content are in the institution's language; write questions in the language the user asks for.",
      inputSchema: {
        subject: z.string().optional().describe("Subject name, e.g. Matematik"),
        grade: z.string().optional().describe("Grade, e.g. 9, 10, LGS, TYT"),
      },
    },
    ({ subject, grade }) =>
      run(async () => {
        const id = await ownerId();
        const [{ summary, outcomes, subjects, grades }, name] = await Promise.all([known(id), institutionName(id)]);
        const sets = new Map<string, { subject: string; grade: string; topics: number }>();
        for (const o of outcomes) {
          const k = `${o.subject}|${o.grade}`;
          const s = sets.get(k) ?? { subject: o.subject, grade: o.grade, topics: 0 };
          s.topics++;
          sets.set(k, s);
        }
        const same = (a: string, b: string) => a.toLocaleLowerCase("tr-TR") === b.toLocaleLowerCase("tr-TR");
        const curriculum = subject
          ? outcomes
              .filter((o) => same(o.subject, subject) && (!grade || same(o.grade, normGrade(grade))))
              .map(({ grade, unit, topic, code, outcome }) => ({ grade, unit, topic, code, outcome }))
          : undefined;
        return {
          institution: name,
          institutionRules: institutionRules(),
          subjects,
          grades,
          questionTypes: {
            MC: { label: qb.QUESTION_TYPES.MC.label, rules: `2–${qb.MAX_OPTIONS} options; answer is the letter of the correct option (A–E).` },
            TF: { label: qb.QUESTION_TYPES.TF.label, rules: 'stem is a statement; answer "D" (doğru / true) or "Y" (yanlış / false). No options.' },
            FILL: { label: qb.QUESTION_TYPES.FILL.label, rules: "mark each blank in the stem with ___ (three underscores); answer is an array with one entry per blank, in order. No options." },
            OPEN: { label: qb.QUESTION_TYPES.OPEN.label, rules: "answer is an optional model answer or grading note. No options." },
          },
          difficulty: qb.DIFFICULTY,
          cognitiveLevels: Object.fromEntries(COGNITIVE_LEVELS.map((l) => [l, COGNITIVE_HINTS[l]])),
          textLimits: qb.TEXT_LIMITS,
          maxQuestionsPerCall: qb.LIMITS.batch,
          curriculumSets: [...sets.values()],
          ...(curriculum ? { curriculum } : {}),
          bankTopics: subject ? Object.entries(summary.topics).find(([s]) => same(s, subject))?.[1] ?? [] : undefined,
          bankSize: summary.total,
          pendingReview: summary.pending,
        };
      }),
  );

  server.registerTool(
    "search_questions",
    {
      title: "Search the question bank",
      description:
        "Two modes. (1) similarTo: give a draft question (and subject); returns bank questions that are the same question (kind 'same': likely duplicate) " +
        "or a sibling (kind 'sibling': same pattern, different numbers), including pending and archived ones. Use it before saving to catch duplicates even when the wording differs. " +
        "(2) query/subject/topic/type: keyword search in approved questions (newest first), to see what exists and match the institution's style.",
      inputSchema: {
        similarTo: z
          .object({
            stem: z.string().min(1),
            options: z.array(z.string()).optional(),
            type: z.enum(["MC", "TF", "FILL", "OPEN"]).optional(),
            answer: z.string().optional().describe("With type: questions with a different correct answer count as siblings, not duplicates"),
          })
          .optional()
          .describe("Draft question to compare against the bank (needs subject). Text-only: figures are not compared"),
        query: z.string().optional().describe("Words to search in subject, topic, question text and source note"),
        subject: z.string().optional(),
        topic: z.string().optional(),
        type: z.enum(["MC", "TF", "FILL", "OPEN"]).optional(),
        limit: z.number().int().min(1).max(50).default(20),
      },
    },
    ({ similarTo, query, subject, topic, type, limit }) =>
      run(async () => {
        if (similarTo) {
          if (!subject) throw new Error("similarTo needs subject.");
          const [r] = await similarForDrafts(await ownerId(), [{ subject, content: { stem: similarTo.stem, options: similarTo.options }, type: similarTo.type, answer: similarTo.answer }], { top: Math.min(limit, 10) });
          return {
            similar: r.bank.map((q) => ({
              id: q.id,
              kind: q.kind,
              label: qb.SIMILAR_KINDS[q.kind].label,
              status: q.archived ? "archived" : q.pending ? "pending review" : "approved",
              type: q.type,
              topic: q.topic,
              grade: q.grade,
              stem: q.stem,
              options: q.options,
              answer: q.answer,
            })),
            note: r.bank.length
              ? "'same' is a likely duplicate: tell the user and don't save it unless they want to. 'sibling' is fine if the user wants variants; mention it."
              : "No similar question found (text comparison only; figures are not compared).",
          };
        }
        const { total, items } = await listItems(await ownerId(), { q: query, subject, topic, type });
        return {
          total,
          questions: items.slice(0, limit).map((q) => ({
            id: q.id,
            type: q.type,
            subject: q.subject,
            topic: q.topic,
            grade: q.grade,
            difficulty: q.difficulty,
            level: q.level,
            stem: q.content?.stem ?? "(image-only question)",
            options: q.content?.options,
            answer: q.answer,
            explanation: q.explanation || undefined,
          })),
        };
      }),
  );

  const question = z.object({
    type: z.enum(["MC", "TF", "FILL", "OPEN"]),
    stem: z.string().describe("Question text, in the language the user wants. FILL: mark blanks with ___. May be empty only if the image holds the question"),
    options: z.array(z.string()).optional().describe("MC only: option texts without letters"),
    answer: z.union([z.string(), z.array(z.string())]).optional().describe("MC: letter; TF: D or Y; FILL: one answer per blank; OPEN: model answer"),
    subject: z.string().min(1).describe("One of the subjects from get_bank_context. Ask the user if unknown"),
    topic: z.string().optional().describe("Use a curriculum topic name from get_bank_context"),
    grade: z.string().min(1).describe("One of the grades from get_bank_context. Ask the user if unknown"),
    confirmedNew: z.boolean().optional().describe("true only if the user confirmed saving under a subject or grade the bank doesn't know yet"),
    difficulty: z.number().int().min(1).max(3).optional().describe("1 easy, 2 medium, 3 hard"),
    level: z.enum(COGNITIVE_LEVELS).optional().describe("Cognitive level"),
    basis: z.enum(["transcribed", "adapted", "original"]).describe("transcribed: from the user's material as-is; adapted: based on a source, changed; original: written by you"),
    explanation: z.string().optional().describe("Worked solution, printed on the booklet's solutions page. Required unless basis is transcribed"),
    sourceNote: z.string().optional().describe("Source and location: file, page, mm:ss"),
    image: z
      .object({ path: z.string().optional().describe("Local file path (local server only)"), base64: z.string().optional().describe("Base64 data (data: URL allowed)") })
      .optional()
      .describe("Figure the question needs: PNG, JPG or WEBP, max 5 MB. Copied into the bank"),
    answerSource: z
      .enum(["key", "solved"])
      .optional()
      .describe("transcribed only: 'key' if the answer comes from the source's answer key, 'solved' if the source has no key and you solved it"),
    agentNote: z.string().optional().describe("Only real doubts (unclear text, suspected errors, assumptions); not routine facts like a missing answer key"),
  });

  /**
   * Forgiving about what agents commonly get "almost right": "A) …" prefixes on options (the booklet adds letters itself)
   * and grades written as "9. sınıf". Everything else is validated by the bank, and errors go back to the agent.
   */
  const tidy = (q: z.infer<typeof question>) => {
    const lettered = (q.options ?? []).length > 0 && q.options!.every((o, i) => new RegExp(`^\\s*${qb.OPTION_LETTERS[i]}\\s*[).:-]\\s*`, "i").test(o));
    return {
      ...q,
      options: lettered ? q.options!.map((o) => o.replace(/^\s*[A-Ea-e]\s*[).:-]\s*/, "")) : q.options,
      grade: q.grade ? normGrade(q.grade) : q.grade,
    };
  };

  server.registerTool(
    "add_questions",
    {
      title: "Add questions to the bank",
      description:
        "Saves questions to the bank (transcribed, adapted or original; with an optional image). They wait for a teacher's approval before appearing in the bank or in exams. " +
        "Follow the server instructions: record basis and sourceNote, self-check adapted and original questions (explanation required for them), put doubts in agentNote. " +
        "All-or-nothing per call: if one question is invalid nothing in the batch is saved and the error names it (e.g. '3. soru: ...'); fix it and resend the batch.",
      inputSchema: { questions: z.array(question).min(1).max(qb.LIMITS.batch) },
    },
    ({ questions }) =>
      run(async () => {
        const many = questions.length > 1;
        const id = await ownerId();
        // Subject and grade must be ones the institution uses, so questions don't scatter under "Mathematics" or "Grade 9"
        const k = await known(id);
        const subjectKeys = new Set(k.subjects.map(subjectKey));
        const gradeSet = new Set(k.grades);
        questions.forEach((q, i) => {
          if (q.confirmedNew) return;
          const at = many ? `${i + 1}. soru: ` : "";
          if (!subjectKeys.has(subjectKey(q.subject)))
            throw new Error(`${at}unknown subject "${q.subject}". Use one of: ${k.subjects.join(", ")}. If the user wants a new subject, confirm with them and set confirmedNew: true.`);
          if (!gradeSet.has(normGrade(q.grade)))
            throw new Error(`${at}unknown grade "${q.grade}". Use one of: ${k.grades.join(", ")}. If the user wants a new grade, confirm with them and set confirmedNew: true.`);
        });
        const images = await Promise.all(questions.map((q, i) => imageBytes(q.image, many ? `${i + 1}. soru` : "", opts.localFiles)));
        const r = await createWrittenItems(
          id,
          questions.map((q) => ({ ...tidy({ ...q, image: undefined, confirmedNew: undefined, answerSource: undefined }), answerBy: q.answerSource === "key" ? "key" : q.answerSource === "solved" ? "agent" : undefined })),
          images,
          { origin: "AI" },
        );
        const byBasis = questions.reduce<Record<string, number>>((a, q) => ({ ...a, [q.basis]: (a[q.basis] ?? 0) + 1 }), {});
        return {
          ...r,
          byBasis,
          withImage: images.filter(Boolean).length,
          reviewUrl,
          next:
            "Report to the user: how many were saved (by basis), every doubt you put in agentNote, and reviewUrl. The questions are not approved yet. " +
            (r.similar.length
              ? "'similar' lists saved questions that match a bank question or another question in this batch: tell the user about each 'same' (likely duplicate; the teacher sees it flagged while reviewing) and mention 'sibling' ones."
              : "No duplicates were found."),
        };
      }),
  );

  server.registerPrompt(
    "write_questions",
    {
      title: "Write questions",
      description: "Write new questions for the bank (optionally inspired by a source): context, duplicate search, writing, self-check, saving, report.",
      argsSchema: {
        subject: z.string().describe("Subject, e.g. Matematik"),
        grade: z.string().describe("Grade, e.g. 9, 10, LGS"),
        count: z.string().optional().describe("How many questions (default 5)"),
        type: z.string().optional().describe("MC, TF, FILL or OPEN (default MC)"),
        topic: z.string().optional().describe("Curriculum topic"),
        difficulty: z.string().optional().describe("easy, medium or hard"),
        level: z.string().optional().describe("Cognitive level: Bilgi, Kavrama, Uygulama, Analiz"),
        source: z.string().optional().describe("Optional source to draw on: file paths or a description"),
        notes: z.string().optional().describe("Anything else, e.g. the language of the questions"),
      },
    },
    (args) => ({ messages: [{ role: "user", content: { type: "text", text: writeQuestionsPrompt(args) } }] }),
  );

  server.registerPrompt(
    "import_questions",
    {
      title: "Import questions from material",
      description: "Put the questions in a PDF, photo or other material into the bank as they are, with their answer key and figures.",
      argsSchema: {
        files: z.string().describe("File paths (PDF, images…), separated by commas"),
        subject: z.string().optional().describe("Subject, if not clear from the material"),
        grade: z.string().optional().describe("Grade, if not clear from the material"),
        notes: z.string().optional().describe("Anything else, e.g. which pages"),
      },
    },
    (args) => ({ messages: [{ role: "user", content: { type: "text", text: importQuestionsPrompt(args) } }] }),
  );

  return server;
}
