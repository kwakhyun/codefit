import { z } from "zod";
export const dialogueInputSchema = z
  .object({
    questionIndex: z.number().int().min(0).max(4),
    answer: z.string().trim().min(1).max(1500),
    previousId: z.string().max(120).optional(),
  })
  .strict();
export const dialogueReplySchema = z
  .object({
    alignment: z.enum(["supported", "uncertain", "conflict"]),
    explanation: z.string().min(1).max(700),
    codeEvidence: z.string().max(1100),
    nextQuestion: z.string().max(350).nullable(),
    nextAction: z.string().min(1).max(350),
  })
  .strict();
type DialogueReply = z.infer<typeof dialogueReplySchema>;
export interface ProjectDialogue {
  id: string;
  questionIndex: number;
  turns: { answer: string; reply: DialogueReply }[];
}

export const projectDialogueSchema = z
  .object({
    id: z.string().max(120),
    questionIndex: z.number().int().min(0).max(4),
    turns: z
      .array(z.object({ answer: z.string().min(1).max(1500), reply: dialogueReplySchema }).strict())
      .min(1)
      .max(3),
  })
  .strict();
