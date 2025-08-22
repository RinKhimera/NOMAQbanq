import { v } from "convex/values"
import { mutation, query } from "./_generated/server"

// Créer une nouvelle question
export const createQuestion = mutation({
  args: {
    question: v.string(),
    imageSrc: v.optional(v.string()),
    options: v.array(v.string()),
    correctAnswer: v.string(),
    explanation: v.string(),
    references: v.optional(v.array(v.string())),
    objectifCMC: v.string(),
    domain: v.string(),
  },
  handler: async (ctx, args) => {
    const questionId = await ctx.db.insert("questions", {
      question: args.question,
      imageSrc: args.imageSrc,
      options: args.options,
      correctAnswer: args.correctAnswer,
      explanation: args.explanation,
      references: args.references,
      objectifCMC: args.objectifCMC,
      domain: args.domain,
    })
    return questionId
  },
})

// Récupérer toutes les questions
export const getAllQuestions = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("questions").order("desc").collect()
  },
})

// Récupérer les domaines uniques
export const getUniqueDomains = query({
  args: {},
  handler: async (ctx) => {
    const questions = await ctx.db.query("questions").collect()
    const domains = [...new Set(questions.map((q) => q.domain))].sort()
    return domains
  },
})

// Récupérer les questions par domaine
export const getQuestionsByDomain = query({
  args: {
    domain: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("questions")
      .withIndex("by_domain", (q) => q.eq("domain", args.domain))
      .order("desc")
      .collect()
  },
})

// Supprimer une question
export const deleteQuestion = mutation({
  args: { id: v.id("questions") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id)
  },
})

// Mettre à jour une question
export const updateQuestion = mutation({
  args: {
    id: v.id("questions"),
    question: v.optional(v.string()),
    imageSrc: v.optional(v.string()),
    options: v.optional(v.array(v.string())),
    correctAnswer: v.optional(v.string()),
    explanation: v.optional(v.string()),
    references: v.optional(v.array(v.string())),
    objectifCMC: v.optional(v.string()),
    domain: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...updateData } = args
    // Filtrer les valeurs undefined
    const filteredData = Object.fromEntries(
      Object.entries(updateData).filter(([, value]) => value !== undefined),
    )
    await ctx.db.patch(id, filteredData)
  },
})
