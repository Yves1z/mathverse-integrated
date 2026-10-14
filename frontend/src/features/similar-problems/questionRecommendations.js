import { normalizeFeatures } from './featureNormalizer.js'
import { SIMILARITY_DEMO_CORPUS } from './demoCorpus.js'
import { extractLocalFeatures, rankSimilarProblems } from './similarityEngine.js'

const LEVEL_DIFFICULTY = {
  white: 0.2,
  green: 0.32,
  cyan: 0.43,
  blue: 0.56,
  purple: 0.68,
  red: 0.76,
  orange: 0.82,
  yellow: 0.88,
  black: 0.94,
}

function cleanValues(values) {
  return Array.isArray(values)
    ? values.map((value) => String(value ?? '').trim()).filter(Boolean)
    : []
}

function problemText(problem) {
  return [problem?.title, problem?.detail, problem?.content, ...cleanValues(problem?.tags)]
    .filter(Boolean)
    .join(' ')
}

export function buildQuestionFeature(problem) {
  const text = problemText(problem)
  const local = extractLocalFeatures(text)
  return normalizeFeatures({
    ...local,
    knowledge: [...local.knowledge, ...cleanValues(problem?.tags)],
    structure: [...local.structure, problem?.typeLabel || problem?.type || ''].filter(Boolean),
    difficulty: LEVEL_DIFFICULTY[problem?.level] ?? local.difficulty,
  }, text)
}

export function mapProblemToSimilarityCandidate(problem) {
  const features = buildQuestionFeature(problem)
  return {
    ...features,
    id: String(problem?.id || '').trim(),
    title: problem?.title || `题目 ${problem?.id || ''}`,
    detail: problem?.detail || String(problem?.content || '').replace(/\s+/g, ' ').slice(0, 88),
    year: problem?.year || '题库',
    sourceLabel: problem?.sourceLabel || problem?.source || '站内题库',
    typeLabel: problem?.typeLabel || problem?.type || '题目',
    level: problem?.level || 'green',
    quality: 0.9,
    isDemo: false,
  }
}

export function buildQuestionRecommendations(problem, problems = [], limit = 3) {
  if (!problem) return []
  const query = buildQuestionFeature(problem)
  const realCandidates = problems
    .filter((candidate) => String(candidate?.id || '') !== String(problem.id || ''))
    .map(mapProblemToSimilarityCandidate)
  const demoCandidates = SIMILARITY_DEMO_CORPUS.map((candidate) => ({
    ...candidate,
    text: `${candidate.title} ${candidate.detail}`,
    isDemo: true,
  }))
  const realResults = rankSimilarProblems(query, realCandidates, 'comprehensive')
  const demoResults = rankSimilarProblems(query, demoCandidates, 'comprehensive')
  return [...realResults, ...demoResults]
    .filter((candidate) => (
      candidate.metrics.knowledge > 0.1
      || (candidate.metrics.method > 0.12 && candidate.metrics.strategy > 0.38)
    ))
    .filter((candidate, index, values) => values.findIndex((item) => item.id === candidate.id) === index)
    .slice(0, limit)
}
